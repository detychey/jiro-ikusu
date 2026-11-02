use std::sync::OnceLock;

use jiro_core::journal;

use super::*;
use crate::playtest::tests::{levels_dir, scratch};
use crate::playtest::{load_levels, run as playtest};

pub(in crate::playtest) const SEED: u64 = 7;

/// Plays shard `index` of a 2-run greedy study at seed 7 into `dir`.
pub(in crate::playtest) fn play_shard(dir: &Path, index: u32) {
    let (levels, calibration, out) = (
        levels_dir().display().to_string(),
        crate::repo_root().join(CALIBRATION).display().to_string(),
        dir.join(format!("shard-{index}.json"))
            .display()
            .to_string(),
    );
    let shard = format!("{index}/2");
    let seed = SEED.to_string();
    let args = [
        "--levels",
        &levels,
        "--policy",
        "greedy",
        "--runs",
        "2",
        "--seed",
        &seed,
        "--shard",
        &shard,
        "--calibration",
        &calibration,
        "--out",
        &out,
    ];
    playtest(&args).expect("shard");
}

/// Both shards of the 2-run greedy study, played once for every test.
pub(in crate::playtest) fn study_dir() -> &'static Path {
    static DIR: OnceLock<PathBuf> = OnceLock::new();
    DIR.get_or_init(|| {
        let dir = scratch("study");
        play_shard(&dir, 1);
        play_shard(&dir, 2);
        dir
    })
}

pub(in crate::playtest) fn shard_file(index: u32) -> Value {
    let path = study_dir().join(format!("shard-{index}.json"));
    serde_json::from_str(&fs::read_to_string(path).expect("shard")).expect("json")
}

/// Every shard holds its share of the runs, in order, and together they hold every run once.
#[test]
fn shard_ranges_split_the_runs_in_order() {
    for (runs, count) in [(200, 8), (10, 3), (1, 1), (7, 7)] {
        let ranges: Vec<Range<u32>> = (1..=count).map(|i| runs_of(i, count, runs)).collect();
        let all: Vec<u32> = ranges.iter().cloned().flatten().collect();
        let sizes_even = ranges.iter().all(|range| {
            range.len() as u32 == runs / count || range.len() as u32 == runs / count + 1
        });
        assert!(
            all == (0..runs).collect::<Vec<_>>() && sizes_even,
            "{runs} runs, {count} shards"
        );
    }
}

#[test]
fn a_shard_index_runs_from_1_to_its_count() {
    let cases = [
        ("1/8", Some((1, 8))),
        ("8/8", Some((8, 8))),
        ("0/8", None),
        ("9/8", None),
        ("1-8", None),
        ("a/8", None),
    ];
    for (text, expected) in cases {
        assert_eq!(index_of(text).ok(), expected, "{text}");
    }
}

/// Run 1, in shard 2 of 2: each journal is the level the draw names, as a Challenge level.
#[test]
fn a_shard_plays_the_levels_its_runs_draw_as_challenge_levels() {
    let levels = load_levels(&levels_dir()).expect("levels");
    let run = RunPlay::read(&shard_file(2)["records"][0], SEED).expect("run 1");
    let headers: Vec<_> = run
        .levels
        .iter()
        .map(|level| journal::decode(&level.journal).expect("journal").header)
        .collect();
    let drawn: Vec<_> = (0..RUN_LEVELS as u8)
        .map(|i| {
            drawn_level(&levels, &levels_dir(), nonce(SEED, 1), i)
                .expect("drawn")
                .2
        })
        .collect();
    assert!(
        headers == drawn
            && drawn
                .iter()
                .all(|header| header.mode == jiro_core::journal::Mode::Challenge)
    );
}

#[test]
fn two_runs_of_one_shard_write_identical_files() {
    let dir = scratch("identical-shard");
    play_shard(&dir, 2);
    let again = fs::read(dir.join("shard-2.json")).expect("shard");
    assert_eq!(
        again,
        fs::read(study_dir().join("shard-2.json")).expect("shard")
    );
}

/// Shard 2 does not hold run 0, so it plays it as its canary: as shard 1 records it.
#[test]
fn a_shard_plays_run_0_as_its_canary() {
    assert_eq!(shard_file(2)["canary"], shard_file(1)["records"][0]);
}

/// Jobs of decreasing length finish out of order; the results come back in job order.
#[test]
fn the_job_queue_returns_results_in_job_order_on_any_number_of_threads() {
    let job = |j: usize| {
        let spins = (20 - j) * 20_000;
        Ok((0..spins).fold(j, |acc, _| std::hint::black_box(acc)))
    };
    let expected: Vec<usize> = (0..20).collect();
    assert!(parallel(1, 20, job) == Ok(expected.clone()) && parallel(3, 20, job) == Ok(expected));
}

#[test]
fn the_job_queue_returns_the_first_failure() {
    let job = |j: usize| {
        if j >= 4 {
            Err(format!("job {j}"))
        } else {
            Ok(j)
        }
    };
    assert_eq!(parallel(1, 10, job), Err("job 4".to_string()));
}

#[test]
fn a_shard_refuses_a_calibration_of_other_levels() {
    let mut levels = load_levels(&levels_dir()).expect("levels");
    levels.swap(0, 1);
    let error = read_weights(&crate::repo_root().join(CALIBRATION), &levels).expect_err("stale");
    assert!(error.contains("rerun calibrate"), "{error}");
}
