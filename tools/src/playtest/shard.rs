//! `playtest --shard <i>/<n>` (plan M4.13): the i-th of n ranges of the runs of a bot-advantage
//! study. Run k draws its six levels from its run nonce `nonce(seed, k)`, and each level is played
//! at its level index under a Challenge header, as in a paid run (README §6.3, §8.2), by the
//! studied policy and by every scripted policy, so that every comparison is paired. The shard
//! file holds how each game ended and its level score at the calibration's weight, and the
//! studied policy's journals, which `--merge` replays. Every shard also plays run 0, the canary:
//! shards played by different code disagree on it.

use std::fs;
use std::iter::once;
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::thread;
use std::time::Instant;

use jiro_core::consts::{BP, RULES_VERSION, RUN_LEVELS};
use jiro_core::game::EndReason;
use jiro_core::level::level_id;
use jiro_core::replay::level_score;
use serde_json::{Map, Value, json};

use super::{Args, LevelFile, Sample, drawn_level, levels_hash, nonce, play_level};
use crate::bots::Policy;
use crate::bots::search::UNITS_PER_TICK;
use crate::json::{hex, parse_hex};

#[cfg(test)]
pub(super) mod tests;

pub(super) const CALIBRATION: &str = "seasons/calibration-1.json";

/// The shard `i/n` of `--shard`: 1 ≤ i ≤ n.
pub(super) fn index_of(text: &str) -> Result<(u32, u32), String> {
    let bad = || format!("--shard: expected i/n with 1 ≤ i ≤ n, got {text}");
    let (index, count) = text.split_once('/').ok_or_else(bad)?;
    let (index, count): (u32, u32) = (
        index.parse().map_err(|_| bad())?,
        count.parse().map_err(|_| bad())?,
    );
    if index == 0 || index > count {
        return Err(bad());
    }
    Ok((index, count))
}

/// The runs of shard `index` of `count`: from (index − 1) × runs / count to index × runs / count.
pub(super) fn runs_of(index: u32, count: u32, runs: u32) -> Range<u32> {
    let bound = |i: u32| u32::try_from(u64::from(i) * u64::from(runs) / u64::from(count));
    bound(index - 1).expect("at most runs")..bound(index).expect("at most runs")
}

/// The weights of the calibration file `path`, which must be of the core's rules and of
/// `levels`, in index order.
pub(super) fn read_weights(path: &Path, levels: &[LevelFile]) -> Result<Vec<u16>, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let value: Value =
        serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
    let ids: Vec<String> = levels
        .iter()
        .map(|level| hex(&level_id(&level.bytes)))
        .collect();
    if value["rulesVersion"] != json!(RULES_VERSION) || value["levelIds"] != json!(ids) {
        return Err(format!(
            "{}: not a calibration of rules version {RULES_VERSION} and of these levels: rerun \
             calibrate",
            path.display()
        ));
    }
    value["weightsBp"]
        .as_array()
        .filter(|weights| weights.len() == ids.len())
        .and_then(|weights| {
            weights
                .iter()
                .map(|weight| weight.as_u64().and_then(|w| u16::try_from(w).ok()))
                .collect()
        })
        .ok_or_else(|| format!("{}: weightsBp holds a u16 per level", path.display()))
}

/// How a game ended, and its level score at its level's weight.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct Played {
    pub(super) end: EndReason,
    pub(super) effective_bp: u16,
    pub(super) ticks_used: u16,
    pub(super) level_score: u32,
}

impl Played {
    fn of(sample: Sample, weight_bp: u16) -> Self {
        Self {
            end: sample.end,
            effective_bp: sample.effective_bp,
            ticks_used: sample.ticks_used,
            level_score: level_score(sample.effective_bp, weight_bp, sample.end),
        }
    }

    fn json(self) -> Value {
        json!({
            "endReason": self.end as u8,
            "effectiveClaimBp": self.effective_bp,
            "ticksUsed": self.ticks_used,
            "levelScore": self.level_score,
        })
    }

    fn read(value: &Value) -> Result<Self, String> {
        let code = field::<u8>(value, "endReason")?;
        let end = [
            EndReason::Committed,
            EndReason::Cleared,
            EndReason::OutOfLives,
            EndReason::TimeLimit,
        ]
        .into_iter()
        .find(|end| *end as u8 == code)
        .ok_or(format!("endReason {code} is not an Outcome's"))?;
        let effective_bp = field(value, "effectiveClaimBp")?;
        if effective_bp > BP {
            return Err(format!("effectiveClaimBp {effective_bp} is above {BP}"));
        }
        Ok(Self {
            end,
            effective_bp,
            ticks_used: field(value, "ticksUsed")?,
            level_score: field(value, "levelScore")?,
        })
    }
}

/// A level of a run: its draw slot, the studied policy's game and journal, and the scripted
/// policies' games, in the order of `Policy::ALL`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct LevelPlay {
    pub(super) slot: u8,
    pub(super) studied: Played,
    pub(super) journal: Vec<u8>,
    pub(super) scripted: Vec<Played>,
}

/// A run's six levels, in level index order.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct RunPlay {
    pub(super) run: u32,
    pub(super) levels: Vec<LevelPlay>,
}

impl RunPlay {
    fn json(&self, seed: u64) -> Value {
        let levels: Vec<Value> = self
            .levels
            .iter()
            .map(|level| {
                let scripted: Map<String, Value> = Policy::ALL
                    .iter()
                    .zip(&level.scripted)
                    .map(|(policy, game)| (policy.name().to_string(), game.json()))
                    .collect();
                json!({
                    "slot": level.slot,
                    "journal": hex(&level.journal),
                    "studied": level.studied.json(),
                    "scripted": scripted,
                })
            })
            .collect();
        json!({ "run": self.run, "runNonce": hex(&nonce(seed, self.run)), "levels": levels })
    }

    /// A run of the file, whose run nonce must be that of its run under `seed`.
    pub(super) fn read(value: &Value, seed: u64) -> Result<Self, String> {
        let run = field(value, "run")?;
        let context = |error: String| format!("run {run}: {error}");
        if value["runNonce"] != json!(hex(&nonce(seed, run))) {
            return Err(context(format!("its runNonce is not that of seed {seed}")));
        }
        let levels = value["levels"]
            .as_array()
            .filter(|levels| levels.len() == RUN_LEVELS)
            .ok_or_else(|| context(format!("levels holds {RUN_LEVELS} levels")))?
            .iter()
            .map(|level| {
                let scripted = Policy::ALL
                    .iter()
                    .map(|policy| Played::read(&level["scripted"][policy.name()]))
                    .collect::<Result<_, _>>()?;
                Ok(LevelPlay {
                    slot: field(level, "slot")?,
                    studied: Played::read(&level["studied"])?,
                    journal: parse_hex(level["journal"].as_str().unwrap_or(""))?,
                    scripted,
                })
            })
            .collect::<Result<_, String>>()
            .map_err(context)?;
        Ok(Self { run, levels })
    }
}

/// The integer `key` of `value`, in range for `T`.
pub(super) fn field<T: TryFrom<u64>>(value: &Value, key: &str) -> Result<T, String> {
    value[key]
        .as_u64()
        .and_then(|n| T::try_from(n).ok())
        .ok_or(format!("{key} is not a number in range"))
}

/// The fields every shard of a study shares: all but its index, its runs and its canary.
pub(super) fn study(shard: &Value) -> Value {
    let mut study = shard.clone();
    if let Some(fields) = study.as_object_mut() {
        for key in ["records", "canary"] {
            fields.remove(key);
        }
        fields.insert("shard".into(), json!({ "count": shard["shard"]["count"] }));
    }
    study
}

pub(super) fn run(
    args: &Args,
    levels: &[LevelFile],
    (index, count): (u32, u32),
    policy: Policy,
) -> Result<(), String> {
    let calibration = args
        .calibration
        .clone()
        .unwrap_or_else(|| PathBuf::from(CALIBRATION));
    let weights = read_weights(&calibration, levels)?;
    let runs = runs_of(index, count, args.runs);
    let canary = (!runs.contains(&0)).then_some(0);
    let played: Vec<u32> = runs.clone().chain(canary).collect();
    let jobs: Vec<(u32, u8)> = played
        .iter()
        .flat_map(|&run| (0..RUN_LEVELS as u8).map(move |level_index| (run, level_index)))
        .collect();
    let policies: Vec<Policy> = once(policy).chain(Policy::ALL).collect();
    let threads = thread::available_parallelism().map_or(1, |n| n.get());
    let started = Instant::now();
    let games = parallel(threads, jobs.len(), |job| {
        let (run, level_index) = jobs[job];
        play_job(args, levels, &weights, &policies, run, level_index)
    })?;
    let compute_ms: u128 = games.iter().map(|(_, ms)| ms).sum();
    let ticks: u64 = games
        .iter()
        .map(|(level, _)| u64::from(level.studied.ticks_used))
        .sum();
    let mut records: Vec<RunPlay> = played
        .iter()
        .zip(games.chunks(RUN_LEVELS))
        .map(|(&run, games)| RunPlay {
            run,
            levels: games.iter().map(|(level, _)| level.clone()).collect(),
        })
        .collect();
    let canary = match canary {
        Some(_) => records.pop().expect("the canary is played last"),
        None => records[0].clone(),
    };
    let ids: Vec<[u8; 32]> = levels.iter().map(|level| level_id(&level.bytes)).collect();
    let shard = json!({
        "rulesVersion": RULES_VERSION,
        "levelsHash": levels_hash(&ids),
        "weightsBp": weights,
        "policy": policy.name(),
        "unitsPerTick": UNITS_PER_TICK,
        "seed": args.seed,
        "runs": args.runs,
        "shard": { "index": index, "count": count },
        "canary": canary.json(args.seed),
        "records": records.iter().map(|run| run.json(args.seed)).collect::<Vec<_>>(),
    });
    let text = serde_json::to_string_pretty(&shard).map_err(|e| e.to_string())? + "\n";
    write_whole(&args.out, &text)?;
    println!(
        "wrote {}: {} games of {} in {} s; {} ms of compute per game second",
        args.out.display(),
        games.len(),
        policy.name(),
        started.elapsed().as_secs(),
        compute_ms * 15 / u128::from(ticks.max(1))
    );
    Ok(())
}

/// Plays the level that run `run` draws at `level_index` with every policy, the studied one
/// first, and returns it with the studied policy's compute in ms.
fn play_job(
    args: &Args,
    levels: &[LevelFile],
    weights: &[u16],
    policies: &[Policy],
    run: u32,
    level_index: u8,
) -> Result<(LevelPlay, u128), String> {
    let (slot, level, header) =
        drawn_level(levels, &args.levels, nonce(args.seed, run), level_index)?;
    let weight = weights[usize::from(slot)];
    let started = Instant::now();
    let (journal, studied) = play_level(level, &header, policies[0])?;
    let compute_ms = started.elapsed().as_millis();
    let scripted = policies[1..]
        .iter()
        .map(|&policy| {
            play_level(level, &header, policy).map(|(_, sample)| Played::of(sample, weight))
        })
        .collect::<Result<_, _>>()?;
    println!(
        "run {run} level index {level_index}: level {:02} {}, {} {:?}, effective claim {} bp, {} \
         ticks, {compute_ms} ms",
        level.index,
        level.name,
        policies[0].name(),
        studied.end,
        studied.effective_bp,
        studied.ticks_used
    );
    let level = LevelPlay {
        slot,
        studied: Played::of(studied, weight),
        journal,
        scripted,
    };
    Ok((level, compute_ms))
}

/// `job(j)` for every j in 0..count on `threads` threads: each takes the next job when it ends
/// one, and a failed job stops the rest. The results come back in job order, so they do not
/// depend on the threads, or the first error in job order.
pub(super) fn parallel<T: Send>(
    threads: usize,
    count: usize,
    job: impl Fn(usize) -> Result<T, String> + Sync,
) -> Result<Vec<T>, String> {
    let next = AtomicUsize::new(0);
    let failed = AtomicBool::new(false);
    let mut done: Vec<(usize, Result<T, String>)> = thread::scope(|scope| {
        let handles: Vec<_> = (0..threads.clamp(1, count.max(1)))
            .map(|_| {
                scope.spawn(|| {
                    let mut done = Vec::new();
                    while !failed.load(Ordering::Relaxed) {
                        let j = next.fetch_add(1, Ordering::Relaxed);
                        if j >= count {
                            break;
                        }
                        let result = job(j);
                        failed.fetch_or(result.is_err(), Ordering::Relaxed);
                        done.push((j, result));
                    }
                    done
                })
            })
            .collect();
        handles
            .into_iter()
            .flat_map(|handle| handle.join().expect("a playtest thread panicked"))
            .collect()
    });
    done.sort_by_key(|(j, _)| *j);
    done.into_iter().map(|(_, result)| result).collect()
}

/// Writes `text` to `path` through `<path>.partial`, so that a run cut short never leaves a
/// truncated file.
fn write_whole(path: &Path, text: &str) -> Result<(), String> {
    if let Some(dir) = path.parent().filter(|dir| !dir.as_os_str().is_empty()) {
        fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    }
    let mut partial = path.as_os_str().to_owned();
    partial.push(".partial");
    fs::write(&partial, text).map_err(|e| format!("{}: {e}", Path::new(&partial).display()))?;
    fs::rename(&partial, path).map_err(|e| format!("{}: {e}", path.display()))
}
