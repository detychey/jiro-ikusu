use super::*;

fn levels_dir() -> PathBuf {
    crate::repo_root().join("levels")
}

fn l01() -> LevelFile {
    load_levels(&levels_dir())
        .expect("levels")
        .into_iter()
        .find(|level| level.index == 1)
        .expect("L01")
}

/// A fresh directory for one test.
fn scratch(test: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("jiro-playtest-{}-{test}", std::process::id()));
    if dir.exists() {
        fs::remove_dir_all(&dir).expect("clear the scratch directory");
    }
    fs::create_dir_all(&dir).expect("scratch directory");
    dir
}

fn targets(clear_rate_pct: u16, floor_bp: u16) -> Targets {
    Targets {
        mix: vec![Policy::Greedy, Policy::Committer],
        tolerance_pct: 5,
        floor_bp,
        clear_rate_pct: vec![clear_rate_pct; SEASON_LEVELS],
    }
}

fn checked(targets: &Targets) -> Result<(), String> {
    let levels = vec![l01()];
    let samples = play_all(&levels, &targets.mix, 20, 1).expect("play");
    Report {
        levels: &levels,
        policies: &targets.mix,
        mix: true,
        samples: &samples,
        runs: 20,
        seed: 1,
    }
    .check(targets)
}

#[test]
fn two_runs_with_one_seed_write_identical_reports() {
    let dir = scratch("identical");
    let levels = levels_dir().display().to_string();
    for out in ["first", "second"] {
        let out = dir.join(out).display().to_string();
        let args = [
            "--levels", &levels, "--runs", "20", "--seed", "3", "--out", &out,
        ];
        run(&args).expect("playtest");
    }
    let files = |out: &str| {
        let mut files: Vec<(String, Vec<u8>)> = fs::read_dir(dir.join(out))
            .expect("reports")
            .map(|entry| {
                let path = entry.expect("entry").path();
                let name = path
                    .file_name()
                    .expect("name")
                    .to_string_lossy()
                    .into_owned();
                (name, fs::read(&path).expect("report"))
            })
            .collect();
        files.sort();
        files
    };
    let first = files("first");
    assert!(first.len() == 2 && first == files("second"));
}

/// Every policy's journals decode strictly, and `replay()` scores them as the runner reports.
#[test]
fn every_bot_journal_decodes_and_replays_to_its_sample() {
    let level = l01();
    for policy in Policy::ALL {
        for k in 0..5 {
            let header = Header {
                mode: Mode::Training,
                run_nonce: nonce(1, k),
                level_id: level_id(&level.bytes),
                level_index: 0,
            };
            let (journal, sample) = play_level(&level, &header, policy).expect("play");
            let decoded = journal::decode(&journal).expect("strict decode");
            let outcome = replay(&level.bytes, &journal, BP).expect("replay");
            assert_eq!(
                (
                    decoded.header,
                    outcome.end_reason,
                    outcome.level_score,
                    outcome.ticks_used
                ),
                (
                    header,
                    sample.end,
                    u32::from(sample.effective_bp),
                    sample.ticks_used
                ),
                "{} run {k}",
                policy.name()
            );
        }
    }
}

#[test]
fn a_run_that_runs_out_of_lives_scores_zero() {
    let level = l01();
    let died = (0..50)
        .map(|k| {
            let header = Header {
                mode: Mode::Training,
                run_nonce: nonce(1, k),
                level_id: level_id(&level.bytes),
                level_index: 0,
            };
            play_level(&level, &header, Policy::EdgeNibbler)
                .expect("play")
                .1
        })
        .find(|sample| sample.end == EndReason::OutOfLives)
        .expect("EdgeNibbler runs out of lives on L01");
    assert_eq!(died.effective_bp, 0);
}

#[test]
fn check_passes_on_l01_with_the_committed_targets() {
    let targets = Targets::read(&levels_dir().join("targets.json")).expect("targets");
    assert_eq!(checked(&targets), Ok(()));
}

#[test]
fn check_names_a_level_outside_its_band() {
    let error = checked(&targets(50, 500)).expect_err("out of band");
    assert!(
        error.contains("level 01 open: clear rate 100.0 % is outside its band, 45 % to 55 %"),
        "{error}"
    );
}

#[test]
fn check_names_a_level_at_or_below_the_floor() {
    let error = checked(&targets(95, 9_000)).expect_err("floor");
    assert!(
        error.contains("level 01 open: median effective claim") && error.contains("the floor"),
        "{error}"
    );
}

#[test]
fn check_measures_only_the_reference_mix() {
    let levels = vec![l01()];
    let policies = [Policy::Greedy];
    let samples = play_all(&levels, &policies, 2, 1).expect("play");
    let report = Report {
        levels: &levels,
        policies: &policies,
        mix: false,
        samples: &samples,
        runs: 2,
        seed: 1,
    };
    assert!(report.check(&targets(95, 500)).is_err());
}

#[test]
fn targets_hold_16_non_increasing_rates() {
    let dir = scratch("increasing");
    let path = dir.join("targets.json");
    let mut rates = vec![50; SEASON_LEVELS];
    rates[15] = 60;
    let text =
        json!({"mix": ["greedy"], "tolerance_pct": 5, "floor_bp": 500, "clear_rate_pct": rates});
    fs::write(&path, text.to_string()).expect("targets");
    assert!(Targets::read(&path).is_err());
}

/// `--only` takes one index or an inclusive range, from 1.
#[test]
fn only_takes_an_index_or_a_range() {
    let cases = [
        ("1", Some(1..2)),
        ("1-8", Some(1..9)),
        ("9-16", Some(9..17)),
        ("0", None),
        ("3-2", None),
        ("a", None),
    ];
    for (text, expected) in cases {
        assert_eq!(range(text).ok(), expected, "{text}");
    }
}

#[test]
fn quartiles_sit_at_index_n_minus_1_times_k_over_4() {
    let sorted = [10, 20, 30, 40, 50];
    assert_eq!([1, 2, 3].map(|k| quartile(&sorted, k)), [20, 30, 40]);
}

#[test]
fn a_nonce_plays_one_challenge_level_at_its_index() {
    let dir = scratch("nonce");
    let out = dir.join("level.jrn");
    let run_nonce = keccak256(&[b"a run"]);
    let levels = levels_dir().display().to_string();
    let (nonce_hex, out_text) = (hex(&run_nonce), out.display().to_string());
    let args = [
        "--levels",
        &levels,
        "--only",
        "1",
        "--policy",
        "greedy",
        "--nonce",
        &nonce_hex,
        "--level-index",
        "4",
        "--out",
        &out_text,
    ];
    run(&args).expect("playtest");
    let journal = fs::read(&out).expect("journal");
    let header = journal::decode(&journal).expect("decode").header;
    assert_eq!(
        (header.mode, header.run_nonce, header.level_index),
        (Mode::Challenge, run_nonce, 4)
    );
}
