use super::report::{ceiling_bp, interval, mean_tenths, portfolio, qualified, ratio};
use super::*;
use crate::bots::Policy;
use crate::playtest::shard::tests::{shard_file, study_dir};
use crate::playtest::shard::{LevelPlay, Played};
use crate::playtest::tests::{levels_dir, scratch};
use jiro_core::game::EndReason;

/// Merges `dir` into `<dir>/report.md`, with the repository's levels and calibration.
fn merge(dir: &Path) -> Result<String, String> {
    let out = dir.join("report.md");
    let (levels, calibration, dir_text, out_text) = (
        levels_dir().display().to_string(),
        crate::repo_root().join(CALIBRATION).display().to_string(),
        dir.display().to_string(),
        out.display().to_string(),
    );
    let args = [
        "--levels",
        &levels,
        "--merge",
        &dir_text,
        "--calibration",
        &calibration,
        "--out",
        &out_text,
    ];
    run(&args)?;
    Ok(fs::read_to_string(out).expect("report"))
}

/// A copy of the study's two shards, shard `index` changed by `edit`.
fn edited_study(test: &str, index: u32, edit: impl Fn(&mut Value)) -> PathBuf {
    let dir = scratch(test);
    for i in 1..=2 {
        let mut shard = shard_file(i);
        if i == index {
            edit(&mut shard);
        }
        let text = serde_json::to_string_pretty(&shard).expect("json");
        fs::write(dir.join(format!("shard-{i}.json")), text).expect("write");
    }
    dir
}

fn played(level_score: u32) -> Played {
    Played {
        end: EndReason::Cleared,
        effective_bp: 8_000,
        ticks_used: 100,
        level_score,
    }
}

#[test]
fn a_merged_report_names_every_scripted_policy() {
    let report = merge(&edited_study("report", 0, |_| {})).expect("merge");
    let named = Policy::ALL
        .iter()
        .all(|policy| report.contains(&format!("| {} |", policy.name())));
    assert!(
        named && report.contains("reference mix (bold, committer)"),
        "{report}"
    );
}

#[test]
fn a_merge_refuses_a_missing_shard() {
    let dir = scratch("missing");
    fs::copy(study_dir().join("shard-1.json"), dir.join("shard-1.json")).expect("copy");
    let error = merge(&dir).expect_err("shard 2 is missing");
    assert!(error.contains("shard 2 of 2 is missing"), "{error}");
}

#[test]
fn a_merge_refuses_a_shard_file_name_with_a_leading_zero() {
    let dir = edited_study("leading-zero", 0, |_| {});
    fs::copy(dir.join("shard-2.json"), dir.join("shard-02.json")).expect("copy");
    let error = merge(&dir).expect_err("shard-02.json would count shard 2 twice");
    assert!(
        error.contains("shard-02.json: a shard file is shard-<i>.json"),
        "{error}"
    );
}

#[test]
fn a_merge_refuses_a_journal_that_replays_to_another_score() {
    let dir = edited_study("score", 2, |shard| {
        let score = &mut shard["records"][0]["levels"][0]["studied"]["levelScore"];
        *score = json!(score.as_u64().expect("score") + 1);
    });
    let error = merge(&dir).expect_err("another score");
    assert!(error.contains("replays to another game"), "{error}");
}

#[test]
fn a_merge_refuses_shards_of_different_budgets() {
    let dir = edited_study("budget", 2, |shard| shard["unitsPerTick"] = json!(1));
    let error = merge(&dir).expect_err("another budget");
    assert!(error.contains("not of the study of"), "{error}");
}

#[test]
fn a_merge_refuses_weights_other_than_the_calibration() {
    let dir = edited_study("weights", 1, |shard| shard["weightsBp"][0] = json!(1));
    let error = merge(&dir).expect_err("other weights");
    assert!(
        error.contains("its weightsBp is not the current"),
        "{error}"
    );
}

#[test]
fn a_merge_refuses_a_canary_that_differs_from_run_0() {
    let dir = edited_study("canary", 2, |shard| {
        shard["canary"]["levels"][0]["studied"]["ticksUsed"] = json!(1);
    });
    let error = merge(&dir).expect_err("another canary");
    assert!(error.contains("its canary"), "{error}");
}

#[test]
fn the_interval_of_a_constant_difference_is_that_constant() {
    let differences = vec![70; 50];
    assert_eq!(
        interval(50, |runs| mean_tenths(&differences, runs)),
        [700, 700]
    );
}

/// Means are in tenths, rounded down, below 0 too.
#[test]
fn a_mean_rounds_down_to_a_tenth() {
    let cases = [
        (vec![1, 2, 2], 16),
        (vec![-1, -2, -2], -17),
        (vec![3, 4], 35),
    ];
    for (values, tenths) in cases {
        let runs: Vec<usize> = (0..values.len()).collect();
        assert_eq!(mean_tenths(&values, &runs), tenths, "{values:?}");
    }
}

#[test]
fn a_ratio_of_means_is_in_thousandths_rounded_down() {
    assert_eq!(ratio(&[2, 3], &[1, 2], &[0, 1]), 1_666);
}

#[test]
fn a_ratio_over_zero_is_infinite() {
    assert_eq!(ratio(&[5], &[0], &[0]), i64::MAX);
}

/// The ceilings of the 16 levels, which the M4.13 design panel's judges computed on their own.
#[test]
fn the_ceiling_leaves_the_boss_body_open() {
    let ceilings: Vec<u16> = load_levels(&levels_dir())
        .expect("levels")
        .iter()
        .map(|level| ceiling_bp(level).expect("ceiling"))
        .collect();
    let expected = [
        9925, 9925, 9809, 9952, 9920, 9888, 9925, 9892, 9890, 9884, 9847, 9842, 9925, 9809, 9854,
        9809,
    ];
    assert_eq!(ceilings, expected);
}

#[test]
fn a_d10_ratio_counts_only_the_runs_that_qualify() {
    assert_eq!(qualified(&[100, 200, 300], &[1, 3, 2], 2), [0, 200, 300]);
}

#[test]
fn the_portfolio_takes_the_best_scripted_score_of_each_level() {
    let level = |scores: [u32; 5]| LevelPlay {
        slot: 0,
        studied: played(0),
        journal: Vec::new(),
        scripted: scores.map(played).to_vec(),
    };
    let levels = [level([1, 5, 2, 0, 0]), level([7, 0, 0, 3, 0])];
    assert_eq!(portfolio(&levels), 12);
}
