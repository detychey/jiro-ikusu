//! Writes vectors/format/ and vectors/game/ (README §6.6) from the scenarios, after checking
//! each case against the core. Each directory is rewritten whole, so a removed or renamed case
//! leaves no file.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use jiro_core::consts::{CAPTURE_STACK, MAX_JOURNAL_LEN, RULES_VERSION};
use jiro_core::hash::state_hash;
use jiro_core::journal::{self, Event};
use jiro_core::keccak::keccak256;
use jiro_core::level::{self, level_id};
use jiro_core::replay::{Outcome, replay_observed};

use crate::coverage;
use crate::json::{Value, hex, object};
use crate::scenarios::game::GameCase;
use crate::scenarios::{self, Case};

/// Writes vectors/format/, vectors/game/ and vectors/COVERAGE.md under the repository `root`.
pub fn write(root: &Path) -> Result<(), String> {
    let vectors = root.join("vectors");
    let mut files = BTreeMap::new();
    for case in scenarios::journal::cases()? {
        add(
            &mut files,
            format!("journal-{}.json", case.name),
            journal_vector(&case)?,
        )?;
    }
    for case in scenarios::level::cases()? {
        add(
            &mut files,
            format!("level-{}.json", case.name),
            level_vector(&case)?,
        )?;
    }
    rewrite(&vectors.join("format"), &["json", "trace"], &files)?;
    let mut games = BTreeMap::new();
    let cases = scenarios::game::cases()?;
    for case in &cases {
        let (vector, trace) = game_vector(case)?;
        add(
            &mut games,
            format!("{}.json", case.name),
            vector.into_bytes(),
        )?;
        add(&mut games, format!("{}.trace", case.name), trace)?;
    }
    rewrite(&vectors.join("game"), &["json", "trace"], &games)?;
    let covers: Vec<(String, Vec<String>)> = cases
        .into_iter()
        .map(|case| (case.name, case.covers))
        .collect();
    coverage::write(root, &covers)
}

/// Replaces the `.json` and `.trace` files of `dir` with `files`.
pub fn rewrite<T: AsRef<[u8]>>(
    dir: &Path,
    extensions: &[&str],
    files: &BTreeMap<String, T>,
) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    for entry in fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path
            .extension()
            .is_some_and(|ext| extensions.iter().any(|wanted| ext == *wanted))
        {
            fs::remove_file(&path).map_err(|e| format!("{}: {e}", path.display()))?;
        }
    }
    for (name, contents) in files {
        let path = dir.join(name);
        fs::write(&path, contents).map_err(|e| format!("{}: {e}", path.display()))?;
    }
    println!("wrote {} files to {}", files.len(), dir.display());
    Ok(())
}

fn add<T>(files: &mut BTreeMap<String, T>, name: String, contents: T) -> Result<(), String> {
    match files.insert(name.clone(), contents) {
        None => Ok(()),
        Some(_) => Err(format!("two scenarios are named {name}")),
    }
}

fn journal_vector(case: &Case) -> Result<String, String> {
    let mut fields = header_fields("journal", case);
    match (journal::decode(&case.input), case.expect) {
        (Ok(decoded), Ok(())) => {
            let events: Vec<Event> = decoded.events().collect();
            let mut out = [0; MAX_JOURNAL_LEN];
            let reencoded = journal::encode(&decoded.header, &events, &mut out)
                .map_err(|error| format!("journal {}: encode returns {error:?}", case.name))?;
            fields.push(("reencoded", Value::Str(hex(reencoded))));
        }
        (Err(error), Err(expected)) if error == expected => {
            fields.push(("error", Value::Int(u64::from(error.code()))));
        }
        (actual, expected) => {
            return Err(format!(
                "journal {}: the core returns {:?}, the scenario expects {expected:?}",
                case.name,
                actual.map(|_| ())
            ));
        }
    }
    object(&fields)
}

fn level_vector(case: &Case) -> Result<String, String> {
    let mut fields = header_fields("level", case);
    let mut stack = [0; CAPTURE_STACK];
    let result = level::decode(&case.input)
        .and_then(|decoded| level::validate(&decoded, &mut stack).map(|_| decoded));
    match (result, case.expect) {
        (Ok(decoded), Ok(())) => {
            fields.push(("levelId", Value::Str(hex(&level_id(&case.input)))));
            fields.push(("reencoded", Value::Str(hex(&level::encode(&decoded)))));
        }
        (Err(error), Err(expected)) if error == expected => {
            fields.push(("error", Value::Int(u64::from(error.code()))));
        }
        (actual, expected) => {
            return Err(format!(
                "level {}: the core returns {:?}, the scenario expects {expected:?}",
                case.name,
                actual.map(|_| ())
            ));
        }
    }
    object(&fields)
}

fn header_fields<'a>(kind: &str, case: &Case) -> Vec<(&'a str, Value)> {
    vec![
        ("kind", Value::Str(kind.to_string())),
        ("name", Value::Str(case.name.clone())),
        ("input", Value::Str(hex(&case.input))),
    ]
}

/// The vector and its trace: the state hash of every processed tick, in tick order.
fn game_vector(case: &GameCase) -> Result<(String, Vec<u8>), String> {
    let mut trace = Vec::new();
    let result = replay_observed(&case.level, &case.journal, case.weight_bp, |game| {
        trace.extend(state_hash(game))
    });
    let mut fields = vec![
        ("kind", Value::Str("game".to_string())),
        ("name", Value::Str(case.name.clone())),
        ("covers", Value::List(case.covers.clone())),
        ("rulesVersion", Value::Int(u64::from(RULES_VERSION))),
        ("level", Value::Str(hex(&case.level))),
        ("runNonce", Value::Str(hex(&case.header.run_nonce))),
        ("levelIndex", Value::Int(u64::from(case.header.level_index))),
        ("mode", Value::Int(case.header.mode as u64)),
        ("weightBp", Value::Int(u64::from(case.weight_bp))),
        ("journal", Value::Str(hex(&case.journal))),
    ];
    match (result, case.expect) {
        (Ok(outcome), Ok(end)) if outcome.end_reason == end => {
            fields.push(("outcome", Value::Object(outcome_fields(&outcome))));
        }
        (Err(error), Err(expected)) if error == expected => {
            fields.push(("error", Value::Int(u64::from(error.code()))));
        }
        (actual, expected) => {
            return Err(format!(
                "game {}: replay returns {:?}, the scenario expects {expected:?}",
                case.name,
                actual.map(|outcome| outcome.end_reason)
            ));
        }
    }
    if let Some(expected) = case.tick_0_hash {
        let tick_0 = trace.get(..32).map(hex);
        if tick_0.as_deref() != Some(expected) {
            return Err(format!(
                "game {}: the tick-0 state hash is {tick_0:?}, the README gives {expected}",
                case.name
            ));
        }
    }
    fields.push(("trace", Value::Str(format!("{}.trace", case.name))));
    fields.push(("traceKeccak", Value::Str(hex(&keccak256(&[&trace])))));
    Ok((object(&fields)?, trace))
}

/// The eleven fields of README §7.3's Outcome, under their Solidity names.
fn outcome_fields(outcome: &Outcome) -> Vec<(&'static str, Value)> {
    vec![
        ("journalHash", Value::Str(hex(&outcome.journal_hash))),
        ("levelId", Value::Str(hex(&outcome.level_id))),
        ("runNonce", Value::Str(hex(&outcome.run_nonce))),
        ("levelIndex", Value::Int(u64::from(outcome.level_index))),
        ("drawSlot", Value::Int(u64::from(outcome.draw_slot))),
        ("mode", Value::Int(outcome.mode as u64)),
        ("rulesVersion", Value::Int(u64::from(outcome.rules_version))),
        ("endReason", Value::Int(outcome.end_reason as u64)),
        ("claimBp", Value::Int(u64::from(outcome.claim_bp))),
        ("ticksUsed", Value::Int(u64::from(outcome.ticks_used))),
        ("levelScore", Value::Int(u64::from(outcome.level_score))),
    ]
}
