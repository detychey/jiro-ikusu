use std::fs;

use super::*;

/// A fresh directory for one test.
fn scratch(test: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("jiro-difffuzz-{}-{test}", std::process::id()));
    if dir.exists() {
        fs::remove_dir_all(&dir).expect("clear the scratch directory");
    }
    dir
}

fn write(dir: &Path, seed: &str, cases: &str) -> Result<(), String> {
    let out = dir.display().to_string();
    run(&["--seed", seed, "--cases", cases, "--out", &out])
}

fn files(dir: &Path) -> Vec<(String, String)> {
    let mut files: Vec<(String, String)> = fs::read_dir(dir)
        .expect("out directory")
        .map(|entry| {
            let path = entry.expect("entry").path();
            let name = path
                .file_name()
                .expect("name")
                .to_string_lossy()
                .into_owned();
            (name, fs::read_to_string(&path).expect("case file"))
        })
        .collect();
    files.sort();
    files
}

#[test]
fn a_seed_writes_the_same_cases_every_time() {
    let (first, second) = (scratch("same-first"), scratch("same-second"));
    write(&first, "5", "3").expect("first run");
    write(&second, "5", "3").expect("second run");
    assert_eq!(files(&first), files(&second));
}

#[test]
fn a_smaller_set_removes_the_case_files_of_a_larger_one() {
    let dir = scratch("smaller");
    write(&dir, "1", "3").expect("three cases");
    write(&dir, "1", "2").expect("two cases");
    let names: Vec<String> = files(&dir).into_iter().map(|(name, _)| name).collect();
    assert_eq!(names, ["case-00000.json", "case-00001.json"]);
}

fn refusal(args: &[&str]) -> String {
    parse(args).expect_err("refused")
}

#[test]
fn zero_cases_are_refused() {
    let error = refusal(&["--seed", "1", "--cases", "0", "--out", "x"]);
    assert_eq!(error, "--cases: 1 to 10000, got 0");
}

#[test]
fn more_cases_than_the_most_are_refused() {
    let error = refusal(&["--seed", "1", "--cases", "10001", "--out", "x"]);
    assert_eq!(error, "--cases: 1 to 10000, got 10001");
}

#[test]
fn a_missing_seed_is_refused() {
    assert_eq!(refusal(&["--cases", "2", "--out", "x"]), USAGE);
}

#[test]
fn a_missing_case_count_is_refused() {
    assert_eq!(refusal(&["--seed", "1", "--out", "x"]), USAGE);
}

#[test]
fn a_missing_out_directory_is_refused() {
    assert_eq!(refusal(&["--seed", "1", "--cases", "2"]), USAGE);
}
