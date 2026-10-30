//! `jiro-tools difffuzz`: writes the random cases of plan M1.10, each with the native outcome and
//! trace digest, for every target's differential test to replay. Seed 1 with 200 cases is the
//! shared fixed set.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use jiro_core::journal;
use jiro_core::keccak::keccak256;
use jiro_tools::cases::{Case, case};

use crate::json::{Value, hex, object};
use crate::playtest::number;
use crate::vectors::{game_inputs, outcome_fields, rewrite, traced_replay};

#[cfg(test)]
mod tests;

const USAGE: &str = "usage: jiro-tools difffuzz --seed <n> --cases <n> --out <dir>";

/// The most cases one call writes: the largest set a planned reader asks for (plan M1.13).
const MAX_CASES: u32 = 10_000;

pub fn run(args: &[&str]) -> Result<(), String> {
    let (seed, cases, out) = parse(args)?;
    let mut files = BTreeMap::new();
    for index in 0..cases {
        files.insert(format!("case-{index:05}.json"), case_file(seed, index)?);
    }
    rewrite(&out, is_case_file, &files)
}

fn parse(args: &[&str]) -> Result<(u64, u32, PathBuf), String> {
    let (mut seed, mut cases, mut out) = (None, None, None);
    let mut rest = args;
    while let [flag, value, tail @ ..] = rest {
        match *flag {
            "--seed" => seed = Some(number(flag, value)?),
            "--cases" => cases = Some(number(flag, value)?),
            "--out" => out = Some(PathBuf::from(value)),
            _ => return Err(USAGE.to_string()),
        }
        rest = tail;
    }
    if !rest.is_empty() {
        return Err(USAGE.to_string());
    }
    let cases = cases.ok_or(USAGE)?;
    if !(1..=MAX_CASES).contains(&cases) {
        return Err(format!("--cases: 1 to {MAX_CASES}, got {cases}"));
    }
    Ok((seed.ok_or(USAGE)?, cases, out.ok_or(USAGE)?))
}

/// The case as a game vector without a trace file: its inputs, its outcome and its traceKeccak.
fn case_file(seed: u64, index: u32) -> Result<String, String> {
    let Case {
        level,
        journal,
        weight_bp,
    } = case(seed, index);
    let header = journal::decode(&journal)
        .map_err(|error| format!("case {index}: the journal decodes to {error:?}"))?
        .header;
    let (result, trace) = traced_replay(&level, &journal, weight_bp);
    let outcome = result
        .map_err(|error| format!("case {index}: replay of a recorded case gives {error:?}"))?;
    let mut fields = vec![
        ("kind", Value::Str("difffuzz".to_string())),
        ("name", Value::Str(format!("difffuzz-{seed}-{index}"))),
    ];
    fields.extend(game_inputs(&level, &header, weight_bp, &journal));
    fields.push(("outcome", Value::Object(outcome_fields(&outcome))));
    fields.push(("traceKeccak", Value::Str(hex(&keccak256(&[&trace])))));
    object(&fields)
}

fn is_case_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with("case-") && name.ends_with(".json"))
}
