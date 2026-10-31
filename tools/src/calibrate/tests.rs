use std::fs;

use super::*;

fn levels_dir() -> PathBuf {
    crate::repo_root().join("levels")
}

/// A fresh directory for one test.
fn scratch(test: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("jiro-calibrate-{}-{test}", std::process::id()));
    if dir.exists() {
        fs::remove_dir_all(&dir).expect("clear the scratch directory");
    }
    fs::create_dir_all(&dir).expect("scratch directory");
    dir
}

fn sample(ticks_used: u16, events: u16) -> Sample {
    Sample {
        end: EndReason::TimeLimit,
        effective_bp: 5_000,
        ticks_used,
        events,
    }
}

/// Calibrates the committed levels with `runs` runs into `root`.
fn calibrate(root: &Path, runs: &str, check: bool) -> Result<(), String> {
    let out = root.join("seasons/calibration-test.json");
    let (out, levels) = (
        out.display().to_string(),
        levels_dir().display().to_string(),
    );
    let mut args = vec!["--out", &out, "--levels", &levels, "--runs", runs];
    if check {
        args.push("--check");
    }
    run(&args)
}

#[test]
fn p_is_the_largest_multiple_of_1000_that_keeps_every_weight_in_a_u16() {
    assert_eq!(
        weights(&[1_857, 7_740], 500),
        Ok((12_000, vec![64_620, 15_503]))
    );
}

#[test]
fn a_median_below_the_floor_is_weighted_at_the_floor() {
    assert_eq!(
        weights(&[300, 9_000], 500),
        Ok((3_000, vec![60_000, 3_333]))
    );
}

#[test]
fn a_median_run_scores_p_points_or_one_less_on_every_level() {
    let medians: Vec<u16> = (501..=10_000).step_by(7).collect();
    let (points, weights) = weights(&medians, 500).expect("weights");
    let scores: Vec<u32> = medians
        .iter()
        .zip(&weights)
        .map(|(&median, &weight)| u32::from(median) * u32::from(weight) / u32::from(BP))
        .filter(|&score| score != points && score != points - 1)
        .collect();
    assert_eq!(scores, Vec::<u32>::new());
}

#[test]
fn claims_too_low_for_any_p_are_refused() {
    assert!(weights(&[100], 100).is_err());
}

#[test]
fn the_longest_sample_has_the_most_ticks_then_the_most_events_then_comes_first() {
    let samples = vec![
        vec![sample(900, 10), sample(2_700, 5)],
        vec![sample(2_700, 9), sample(2_700, 9)],
    ];
    assert_eq!(longest(&samples), (1, 0));
}

#[test]
fn the_out_file_is_required() {
    assert_eq!(parse(&["--runs", "2"]).err(), Some(USAGE.to_string()));
}

#[test]
fn a_run_count_outside_its_range_is_refused() {
    assert_eq!(
        parse(&["--out", "x.json", "--runs", "0"]).err(),
        Some("--runs: 1 to 1000000, got 0".to_string())
    );
}

#[test]
fn a_calibration_writes_the_file_the_report_and_the_32_gate_set_vectors() {
    let root = scratch("writes");
    calibrate(&root, "2", false).expect("calibrate");
    let calibration: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(root.join("seasons/calibration-test.json")).expect("file"),
    )
    .expect("JSON");
    let vectors = fs::read_dir(root.join("vectors/levels"))
        .expect("vectors/levels")
        .count();
    assert_eq!(
        (
            calibration["weightsBp"].as_array().map(Vec::len),
            calibration["levelIds"].as_array().map(Vec::len),
            vectors,
            root.join("reports/calibration-test.md").is_file(),
        ),
        (Some(16), Some(16), 64, true)
    );
}

#[test]
fn a_check_that_fails_writes_nothing() {
    let root = scratch("check");
    assert!(calibrate(&root, "1", true).is_err());
    assert_eq!(fs::read_dir(&root).expect("root").count(), 0);
}
