//! `playtest --merge <dir>` (plan M4.13): the report of a bot-advantage study, from its shards.
//! It checks the shards against each other and against the current rules, levels, calibration
//! and budget, and replays every journal of the studied policy, failing at the first mismatch.
//! It plays no game: the shards hold the scripted policies' games too.

mod report;
#[cfg(test)]
mod tests;

use std::fs;
use std::path::{Path, PathBuf};

use jiro_core::consts::{BP, RULES_VERSION};
use jiro_core::journal::Mode;
use jiro_core::level::level_id;
use jiro_core::replay::{level_score, replay};
use jiro_core::seed::draw;
use serde_json::{Value, json};

use super::shard::{CALIBRATION, Played, RunPlay, field, read_weights, runs_of, study};
use super::{LevelFile, Targets, levels_hash, load_levels, nonce};
use crate::bots::search::UNITS_PER_TICK;

const USAGE: &str = "usage: jiro-tools playtest [--levels <dir>] --merge <dir> [--calibration \
                     <file>] --out <file.md>";

/// The runs of a study, from its shards, checked.
struct Study {
    dir: PathBuf,
    policy: String,
    seed: u64,
    shards: u32,
    units_per_tick: u64,
    runs: Vec<RunPlay>,
}

pub(super) fn run(args: &[&str]) -> Result<(), String> {
    let (mut levels, mut dir, mut out) = (PathBuf::from("levels"), None, None);
    let mut calibration = PathBuf::from(CALIBRATION);
    let mut rest = args;
    while let [flag, value, tail @ ..] = rest {
        match *flag {
            "--levels" => levels = PathBuf::from(value),
            "--merge" => dir = Some(PathBuf::from(value)),
            "--calibration" => calibration = PathBuf::from(value),
            "--out" => out = Some(PathBuf::from(value)),
            _ => return Err(USAGE.to_string()),
        }
        rest = tail;
    }
    let (Some(dir), Some(out), []) = (dir, out, rest) else {
        return Err(USAGE.to_string());
    };
    let files = load_levels(&levels)?;
    let weights = read_weights(&calibration, &files)?;
    let mix = Targets::read(&levels.join("targets.json"))?.mix;
    let study = Study::read(&dir, &files, &weights)?;
    let markdown = report::markdown(&study, &files, &weights, &mix)?;
    if let Some(parent) = out.parent().filter(|dir| !dir.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    }
    fs::write(&out, markdown).map_err(|e| format!("{}: {e}", out.display()))?;
    println!("wrote {}", out.display());
    Ok(())
}

impl Study {
    fn read(dir: &Path, levels: &[LevelFile], weights: &[u16]) -> Result<Self, String> {
        let mut shards = shard_files(dir)?;
        shards.sort_by_key(|(index, ..)| *index);
        let (_, first_path, first) = shards
            .first()
            .ok_or_else(|| format!("{}: no shard-<i>.json", dir.display()))?;
        let ids: Vec<[u8; 32]> = levels.iter().map(|level| level_id(&level.bytes)).collect();
        let current = [
            ("rulesVersion", json!(RULES_VERSION)),
            ("levelsHash", json!(levels_hash(&ids))),
            ("weightsBp", json!(weights)),
            ("unitsPerTick", json!(UNITS_PER_TICK)),
        ];
        for (key, value) in current {
            if first[key] != value {
                return Err(format!(
                    "{}: its {key} is not the current {value}: the study is stale",
                    first_path.display()
                ));
            }
        }
        let count: u32 = field(&first["shard"], "count")?;
        let total_runs: u32 = field(first, "runs")?;
        let seed: u64 = field(first, "seed")?;
        for (_, path, shard) in &shards {
            if study(shard) != study(first) {
                return Err(format!(
                    "{}: not of the study of {}",
                    path.display(),
                    first_path.display()
                ));
            }
        }
        let indices: Vec<u32> = shards.iter().map(|(index, ..)| *index).collect();
        if let Some(missing) = (1..=count).find(|index| !indices.contains(index)) {
            return Err(format!(
                "{}: shard {missing} of {count} is missing",
                dir.display()
            ));
        }
        if let Some(extra) = indices.iter().find(|&&index| index > count) {
            return Err(format!(
                "{}: shard {extra} is beyond {count}",
                dir.display()
            ));
        }
        let canary = &first["records"][0];
        let mut runs = Vec::new();
        for (index, path, shard) in &shards {
            let context = |error: String| format!("{}: {error}", path.display());
            if shard["canary"] != *canary {
                return Err(context(
                    "its canary, run 0, is not shard 1's: the shards were played by other code"
                        .into(),
                ));
            }
            let records = shard["records"].as_array().map_or(&[][..], Vec::as_slice);
            let played: Vec<RunPlay> = records
                .iter()
                .map(|record| RunPlay::read(record, seed))
                .collect::<Result<_, _>>()
                .map_err(context)?;
            let expected = runs_of(*index, count, total_runs);
            if !played.iter().map(|run| run.run).eq(expected.clone()) {
                return Err(context(format!(
                    "its runs are not runs {} to {}",
                    expected.start,
                    expected.end - 1
                )));
            }
            for run in &played {
                verify(run, seed, levels, weights).map_err(context)?;
            }
            runs.extend(played);
        }
        Ok(Self {
            dir: dir.to_path_buf(),
            policy: first["policy"].as_str().unwrap_or("").to_string(),
            seed,
            shards: count,
            units_per_tick: field(first, "unitsPerTick")?,
            runs,
        })
    }
}

/// Every `.json` file of `dir`, each a `shard-<i>.json` holding shard i, with its index.
fn shard_files(dir: &Path) -> Result<Vec<(u32, PathBuf, Value)>, String> {
    let mut shards = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().is_none_or(|ext| ext != "json") {
            continue;
        }
        let index: u32 = path
            .file_stem()
            .and_then(|stem| stem.to_str()?.strip_prefix("shard-")?.parse().ok())
            .ok_or_else(|| format!("{}: a shard file is shard-<i>.json", path.display()))?;
        let text = fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))?;
        let shard: Value =
            serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
        if field::<u32>(&shard["shard"], "index") != Ok(index) {
            return Err(format!("{}: does not hold shard {index}", path.display()));
        }
        shards.push((index, path, shard));
    }
    Ok(shards)
}

/// Checks a run against its draw, every scripted level score against its claim and weight, and
/// every journal of the studied policy against the game it replays to.
fn verify(run: &RunPlay, seed: u64, levels: &[LevelFile], weights: &[u16]) -> Result<(), String> {
    let run_nonce = nonce(seed, run.run);
    for ((level_index, level), slot) in (0u8..).zip(&run.levels).zip(draw(&run_nonce)) {
        let context = |what: &str| format!("run {} level index {level_index}: {what}", run.run);
        if level.slot != slot {
            return Err(context("its slot is not the draw's"));
        }
        let weight = weights[usize::from(slot)];
        let scored =
            |game: &Played| game.level_score == level_score(game.effective_bp, weight, game.end);
        if !level.scripted.iter().all(scored) {
            return Err(context(
                "a scripted level score is not its claim at its weight",
            ));
        }
        let outcome = replay(&levels[usize::from(slot)].bytes, &level.journal, weight)
            .map_err(|error| context(&format!("its journal breaks rule {}", error.code())))?;
        let replayed = Played {
            end: outcome.end_reason,
            effective_bp: u16::try_from(level_score(outcome.claim_bp, BP, outcome.end_reason))
                .expect("a claim is at most 10,000 bp"),
            ticks_used: outcome.ticks_used,
            level_score: outcome.level_score,
        };
        let header = (
            outcome.mode,
            outcome.run_nonce,
            outcome.level_index,
            outcome.draw_slot,
        );
        if header != (Mode::Challenge, run_nonce, level_index, slot) || replayed != level.studied {
            return Err(context("its journal replays to another game"));
        }
    }
    Ok(())
}
