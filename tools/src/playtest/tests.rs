use jiro_core::level::encode;
use jiro_core::types::Pos;

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

fn level_file(level: Level) -> LevelFile {
    LevelFile {
        index: 1,
        name: "test".to_string(),
        bytes: encode(&level).to_vec(),
        level,
    }
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

fn targets(mix: &[Policy], clear_rate_pct: u16, floor_bp: u16) -> Targets {
    Targets {
        mix: mix.to_vec(),
        tolerance_pct: 5,
        floor_bp,
        clear_rate_pct: vec![clear_rate_pct; SEASON_LEVELS],
    }
}

fn sample(end: EndReason, effective_bp: u16) -> Sample {
    Sample {
        end,
        effective_bp,
        ticks_used: 100,
    }
}

/// The check of one Greedy-only level whose runs are `samples`.
fn check_samples(samples: Vec<Sample>, targets: &Targets) -> Result<(), String> {
    let levels = [l01()];
    let runs = samples.len() as u32;
    Report {
        levels: &levels,
        policies: &[Policy::Greedy],
        mix: true,
        samples: &[vec![samples]],
        runs,
        seed: 1,
    }
    .check(targets)
}

/// `cleared` clears and a Committed claim of 5,000 bp for the rest.
fn clears(cleared: usize, runs: usize) -> Vec<Sample> {
    (0..runs)
        .map(|i| match i < cleared {
            true => sample(EndReason::Cleared, 7_500),
            false => sample(EndReason::Committed, 5_000),
        })
        .collect()
}

fn write_targets(dir: &Path, mix: &[&str], tolerance_pct: u16, rates: Vec<u16>) -> PathBuf {
    let path = dir.join("targets.json");
    let text = json!({
        "mix": mix,
        "tolerance_pct": tolerance_pct,
        "floor_bp": 500,
        "clear_rate_pct": rates,
    });
    fs::write(&path, text.to_string()).expect("targets");
    path
}

#[test]
fn two_runs_with_one_seed_write_identical_reports() {
    let dir = scratch("identical");
    let levels = levels_dir().display().to_string();
    for out in ["first", "second"] {
        let out = dir.join(out).display().to_string();
        let args = [
            "--levels", &levels, "--only", "1", "--runs", "20", "--seed", "3", "--out", &out,
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
            let header = header(&level.level, nonce(1, k));
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

/// Run 0 of seed 1 on L01, per policy: pins each policy's parameters and the nonce derivation.
#[test]
fn each_policy_plays_run_0_of_l01_as_pinned() {
    let level = l01();
    let cases = [
        (Policy::EdgeNibbler, EndReason::Cleared, 7654, 2340),
        (Policy::Greedy, EndReason::Cleared, 7514, 266),
        (Policy::Bold, EndReason::Cleared, 8041, 409),
        (Policy::Committer, EndReason::Cleared, 8041, 409),
        (Policy::RandomWalk, EndReason::OutOfLives, 0, 1072),
    ];
    for (policy, end, effective_bp, ticks_used) in cases {
        let (_, played) =
            play_level(&level, &header(&level.level, nonce(1, 0)), policy).expect("play");
        let pinned = Sample {
            end,
            effective_bp,
            ticks_used,
        };
        assert_eq!(played, pinned, "{}", policy.name());
    }
}

#[test]
fn run_nonces_derive_from_the_seed_and_the_run() {
    assert_eq!(
        hex(&nonce(1, 0)),
        "0x262a89fba6fc52859bb04c4b7dfdd02a2c2e432246df02315e4cdeb55286098d"
    );
}

#[test]
fn a_bot_seeds_from_the_first_8_bytes_of_its_nonce() {
    assert_eq!(bot_seed(&nonce(1, 0)), 0x262a_89fb_a6fc_5285);
}

#[test]
fn the_levels_hash_names_the_committed_report() {
    let levels = load_levels(&levels_dir()).expect("levels");
    let report = Report {
        levels: &levels,
        policies: &[],
        mix: true,
        samples: &[],
        runs: 1,
        seed: 1,
    };
    assert!(
        crate::repo_root()
            .join(format!("reports/playtest-{}.md", report.levels_hash()))
            .exists()
    );
}

#[test]
fn a_run_that_runs_out_of_lives_scores_zero() {
    let level = l01();
    let died = (0..50)
        .map(|k| {
            let header = header(&level.level, nonce(1, k));
            play_level(&level, &header, Policy::EdgeNibbler)
                .expect("play")
                .1
        })
        .find(|sample| sample.end == EndReason::OutOfLives)
        .expect("EdgeNibbler runs out of lives on L01");
    assert_eq!(died.effective_bp, 0);
}

/// A minion with move period 1 follows the player along the rail; Greedy must keep cutting.
#[test]
fn greedy_keeps_cutting_beside_a_fast_minion() {
    let mut level = l01().level;
    level.minion_count = 1;
    level.minion_spawns[0] = Pos { x: 15, y: 0 };
    level.minion_period = 1;
    level.respawn_delay = 60;
    let level = level_file(level);
    for k in 0..30 {
        let header = header(&level.level, nonce(1, k));
        let (_, played) = play_level(&level, &header, Policy::Greedy).expect("play");
        assert_ne!(played.end, EndReason::TimeLimit, "run {k}");
    }
}

#[test]
fn every_policy_plays_every_run_once_in_order() {
    let levels = [l01()];
    let policies = [Policy::Greedy, Policy::EdgeNibbler];
    let samples = play_all(&levels, &policies, 7, 2).expect("play");
    let sequential: Vec<Vec<Sample>> = policies
        .iter()
        .map(|&policy| {
            (0..7)
                .map(|k| {
                    let header = header(&levels[0].level, nonce(2, k));
                    play_level(&levels[0], &header, policy).expect("play").1
                })
                .collect()
        })
        .collect();
    assert_eq!(samples, vec![sequential]);
}

#[test]
fn stats_count_the_ends_and_take_quartiles_of_unsorted_runs() {
    let samples = [
        sample(EndReason::OutOfLives, 0),
        sample(EndReason::Cleared, 9_000),
        sample(EndReason::Committed, 3_000),
        sample(EndReason::TimeLimit, 6_000),
        sample(EndReason::Cleared, 8_000),
        sample(EndReason::Committed, 1_000),
        sample(EndReason::OutOfLives, 0),
    ];
    let stats = Stats::of(samples.iter());
    assert_eq!(
        (
            [stats.cleared, stats.died, stats.committed, stats.timed_out],
            stats.effective_bp,
            stats.per_mille(stats.cleared)
        ),
        ([2, 2, 2, 1], [0, 3_000, 6_000], 285)
    );
}

#[test]
fn quartiles_sit_at_index_n_minus_1_times_k_over_4() {
    let sorted: Vec<u16> = (0..10).map(|i| i * 10).collect();
    assert_eq!([1, 2, 3].map(|k| quartile(&sorted, k)), [20, 40, 60]);
}

#[test]
fn check_passes_on_l01_with_the_committed_targets() {
    let levels = [l01()];
    let targets = Targets::read(&levels_dir().join("targets.json")).expect("targets");
    let samples = play_all(&levels, &targets.mix, 20, 1).expect("play");
    let report = Report {
        levels: &levels,
        policies: &targets.mix,
        mix: true,
        samples: &samples,
        runs: 20,
        seed: 1,
    };
    assert_eq!(report.check(&targets), Ok(()));
}

/// The band's edges, with exact counts: 45 % to 55 % around a 50 % target.
#[test]
fn check_bands_include_their_edges_and_nothing_beyond() {
    let band = targets(&[Policy::Greedy], 50, 500);
    let cases = [
        (8_999, false),
        (9_000, true),
        (11_000, true),
        (11_001, false),
    ];
    for (cleared, in_band) in cases {
        let result = check_samples(clears(cleared, 20_000), &band);
        assert_eq!(result.is_ok(), in_band, "{cleared} clears: {result:?}");
    }
}

#[test]
fn check_names_a_level_outside_its_band() {
    let error = check_samples(clears(20, 20), &targets(&[Policy::Greedy], 50, 500))
        .expect_err("out of band");
    assert!(
        error.contains("level 01 open: clear rate 100.0 % is outside its band, 45 % to 55 %"),
        "{error}"
    );
}

/// The median effective claim must be above the floor: equal to it fails.
#[test]
fn check_fails_a_median_at_the_floor() {
    let band = targets(&[Policy::Greedy], 0, 5_000);
    let cases = [(5_000, false), (5_001, true)];
    for (claim, passes) in cases {
        let runs = vec![sample(EndReason::Committed, claim); 4];
        let result = check_samples(runs, &band);
        assert_eq!(result.is_ok(), passes, "{claim} bp: {result:?}");
    }
}

#[test]
fn check_measures_only_a_report_of_the_mix() {
    let levels = [l01()];
    let report = Report {
        levels: &levels,
        policies: &[Policy::Greedy],
        mix: false,
        samples: &[vec![clears(20, 20)]],
        runs: 20,
        seed: 1,
    };
    assert!(report.check(&targets(&[Policy::Greedy], 95, 500)).is_err());
}

#[test]
fn check_measures_only_the_mix_of_its_targets() {
    let error = check_samples(
        clears(20, 20),
        &targets(&[Policy::Greedy, Policy::Committer], 95, 500),
    );
    assert!(error.is_err());
}

#[test]
fn the_check_file_names_the_mix_that_plays() {
    let dir = scratch("check-mix");
    let path = write_targets(&dir, &["greedy"], 5, vec![95; SEASON_LEVELS]);
    let (levels, out, path) = (
        levels_dir().display().to_string(),
        dir.join("out").display().to_string(),
        path.display().to_string(),
    );
    let args = [
        "--levels", &levels, "--only", "1", "--runs", "10", "--out", &out, "--check", &path,
    ];
    run(&args).expect("in band");
    let json = fs::read_dir(dir.join("out"))
        .expect("reports")
        .map(|entry| entry.expect("entry").path())
        .find(|path| path.extension().is_some_and(|ext| ext == "json"))
        .expect("a JSON report");
    let report = fs::read_to_string(json).expect("report");
    let report: Value = serde_json::from_str(&report).expect("json");
    assert_eq!(report["policies"], json!(["greedy"]));
}

#[test]
fn the_check_file_fails_a_level_outside_its_band() {
    let dir = scratch("check-band");
    let path = write_targets(&dir, &["greedy"], 5, vec![50; SEASON_LEVELS]);
    let (levels, out, path) = (
        levels_dir().display().to_string(),
        dir.join("out").display().to_string(),
        path.display().to_string(),
    );
    let args = [
        "--levels", &levels, "--only", "1", "--runs", "10", "--out", &out, "--check", &path,
    ];
    let error = run(&args).expect_err("out of band");
    assert!(error.contains("level 01 open"), "{error}");
}

/// Malformed targets files: each is refused.
#[test]
fn targets_refuse_malformed_files() {
    let dir = scratch("targets");
    let mut increasing = vec![50; SEASON_LEVELS];
    increasing[15] = 60;
    let cases: [(&str, &[&str], u16, Vec<u16>); 4] = [
        ("increasing rates", &["greedy"], 5, increasing),
        ("15 rates", &["greedy"], 5, vec![50; 15]),
        ("a policy twice", &["greedy", "greedy"], 5, vec![50; 16]),
        ("tolerance above 100", &["greedy"], 101, vec![50; 16]),
    ];
    for (name, mix, tolerance, rates) in cases {
        let path = write_targets(&dir, mix, tolerance, rates);
        assert!(Targets::read(&path).is_err(), "{name}");
    }
}

/// Command lines that are refused before any run is played.
#[test]
fn parse_refuses_inconsistent_flags() {
    let cases: [(&str, &[&str]); 9] = [
        ("no runs", &["--levels", "l", "--runs", "0", "--out", "o"]),
        (
            "too many runs",
            &["--levels", "l", "--runs", "1000001", "--out", "o"],
        ),
        ("level 17", &["--levels", "l", "--only", "1-17"]),
        ("level 255", &["--levels", "l", "--only", "255"]),
        (
            "level index 6",
            &[
                "--levels",
                "l",
                "--policy",
                "greedy",
                "--nonce",
                "0x00",
                "--level-index",
                "6",
                "--out",
                "o",
            ],
        ),
        (
            "nonce without level index",
            &[
                "--levels", "l", "--policy", "greedy", "--out", "o", "--nonce", "0x00",
            ],
        ),
        (
            "check with a policy",
            &[
                "--levels", "l", "--policy", "greedy", "--check", "t", "--out", "o",
            ],
        ),
        (
            "a policy without --out",
            &["--levels", "l", "--policy", "greedy"],
        ),
        (
            "another seed without --out",
            &["--levels", "l", "--seed", "2"],
        ),
    ];
    for (name, args) in cases {
        assert!(parse(args).is_err(), "{name}");
    }
}

#[test]
fn only_takes_an_index_or_a_range_from_1_to_16() {
    let cases = [
        ("1", Some(1..2)),
        ("1-8", Some(1..9)),
        ("9-16", Some(9..17)),
        ("0", None),
        ("3-2", None),
        ("16-17", None),
        ("a", None),
    ];
    for (text, expected) in cases {
        assert_eq!(range(text).ok(), expected, "{text}");
    }
}

#[test]
fn only_names_levels_that_exist() {
    let error = select(vec![l01()], Some(1..4), &levels_dir())
        .err()
        .expect("levels 2 and 3 are missing");
    assert!(error.ends_with("no level 02, 03"), "{error}");
}

#[test]
fn a_levels_directory_refuses_a_misnamed_bin_file() {
    let dir = scratch("misnamed");
    fs::copy(levels_dir().join("01-open.bin"), dir.join("1-open.bin")).expect("copy");
    assert!(load_levels(&dir).is_err());
}

#[test]
fn a_levels_directory_refuses_two_levels_with_one_index() {
    let dir = scratch("one-index");
    fs::copy(levels_dir().join("01-open.bin"), dir.join("01-open.bin")).expect("copy");
    fs::copy(levels_dir().join("01-open.bin"), dir.join("01-again.bin")).expect("copy");
    assert!(load_levels(&dir).is_err());
}

/// The first nonce of "jiro.test.draw" ‖ i that draws slot 0, L01, and its level index.
fn nonce_drawing_l01() -> ([u8; 32], u8) {
    (0u32..)
        .map(|i| keccak256(&[b"jiro.test.draw", &i.to_be_bytes()]))
        .find_map(|nonce| {
            let index = draw(&nonce).iter().position(|&slot| slot == 0)?;
            Some((nonce, u8::try_from(index).expect("below 6")))
        })
        .expect("a nonce that draws L01")
}

#[test]
fn a_nonce_plays_the_level_it_draws_as_a_challenge_level() {
    let dir = scratch("nonce");
    let out = dir.join("level.jrn");
    let (run_nonce, level_index) = nonce_drawing_l01();
    let (levels, nonce_hex, index, out_text) = (
        levels_dir().display().to_string(),
        hex(&run_nonce),
        level_index.to_string(),
        out.display().to_string(),
    );
    let args = [
        "--levels",
        &levels,
        "--policy",
        "greedy",
        "--nonce",
        &nonce_hex,
        "--level-index",
        &index,
        "--out",
        &out_text,
    ];
    run(&args).expect("playtest");
    let journal = fs::read(&out).expect("journal");
    let outcome = replay(&l01().bytes, &journal, BP).expect("the drawn level replays");
    assert_eq!(
        (
            outcome.mode,
            outcome.run_nonce,
            outcome.level_index,
            outcome.draw_slot
        ),
        (Mode::Challenge, run_nonce, level_index, 0)
    );
}

#[test]
fn a_nonce_refuses_a_level_its_run_does_not_draw() {
    let dir = scratch("nonce-missing");
    let only_l01 = dir.join("levels");
    fs::create_dir(&only_l01).expect("levels directory");
    fs::copy(
        levels_dir().join("01-open.bin"),
        only_l01.join("01-open.bin"),
    )
    .expect("copy L01");
    let (run_nonce, level_index) = nonce_drawing_l01();
    let other = (level_index + 1) % 6;
    let (levels, nonce_hex, index, out) = (
        only_l01.display().to_string(),
        hex(&run_nonce),
        other.to_string(),
        dir.join("level.jrn").display().to_string(),
    );
    let args = [
        "--levels",
        &levels,
        "--policy",
        "greedy",
        "--nonce",
        &nonce_hex,
        "--level-index",
        &index,
        "--out",
        &out,
    ];
    let error = run(&args).expect_err("the drawn level is missing");
    assert!(error.contains("is missing"), "{error}");
}

#[test]
fn random_walk_never_commits() {
    let level = l01();
    let committed = (0..20).any(|k| {
        let header = header(&level.level, nonce(1, k));
        play_level(&level, &header, Policy::RandomWalk)
            .expect("play")
            .1
            .end
            == EndReason::Committed
    });
    assert!(!committed);
}
