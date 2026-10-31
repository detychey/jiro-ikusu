//! `jiro-tools calibrate` (plan M2.9): every playtest bot plays the 16 season levels of a
//! directory, on the run nonces of `playtest`, and the reference mix's median effective claim m
//! on each level sets the level's weight for the testnet seasons (README §8.4):
//! weight_bp = P × 10,000 / max(m, floor), rounded down, so that a median run scores P points on
//! every level, within integer rounding. P is the largest multiple of 1,000 points for which
//! every weight fits in a u16.
//!
//! calibrate --out <file.json> [--levels <dir>] [--runs <n>] [--seed <n>] [--check]
//!
//! It writes the calibration file `--out`, its report `reports/<the file's name>.md`, and the
//! gate set of the M4 gas gate (plan §4) in `vectors/levels/`, all under the directory that
//! holds `--out`'s directory: per level, `NN-worst`, the longest bot journal, and
//! `NN-synthetic`, the longest run of the worst-case scenario's policy, both scored with the
//! level's weight. `--check` asserts the bands and the floor of the levels' `targets.json` first
//! and writes nothing if one fails.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

use jiro_core::consts::{BP, RULES_VERSION, SEASON_LEVELS};
use jiro_core::game::EndReason;
use jiro_core::journal::Header;
use jiro_core::level::level_id;
use serde_json::json;

use crate::bots::Policy;
use crate::json::hex;
use crate::playtest::{
    LevelFile, Sample, Stats, Targets, check_mix, events, load_levels, nonce, number, percent,
    play_all, play_level,
};
use crate::scenarios::game::GameCase;
use crate::scenarios::game_long::worst_case_policy;
use crate::scenarios::play::{header, play};
use crate::vectors::{game_vector, is_vector_file, rewrite};

#[cfg(test)]
mod tests;

const USAGE: &str = "usage: jiro-tools calibrate --out <file.json> [--levels <dir>] [--runs <n>] \
                     [--seed <n>] [--check]";

/// The run count and seed of the committed calibration, those of the reference playtest report.
const RUNS: u32 = 1_000;
const SEED: u64 = 1;
const MAX_RUNS: u32 = 1_000_000;
/// P is a whole number of this many points.
const POINTS_STEP: u64 = 1_000;

struct Args {
    out: PathBuf,
    levels: PathBuf,
    runs: u32,
    seed: u64,
    check: bool,
}

/// A run of the gate set, and where it comes from.
struct Gate {
    case: GameCase,
    policy: &'static str,
    run: u32,
    ticks_used: u16,
    events: u16,
}

pub fn run(args: &[&str]) -> Result<(), String> {
    let args = parse(args)?;
    let levels = load_levels(&args.levels)?;
    let indices: Vec<u8> = levels.iter().map(|level| level.index).collect();
    if indices != (1..=SEASON_LEVELS as u8).collect::<Vec<u8>>() {
        return Err(format!(
            "{}: a season has the levels 01 to {SEASON_LEVELS}",
            args.levels.display()
        ));
    }
    let targets = Targets::read(&args.levels.join("targets.json"))?;
    let samples = play_all(&levels, &Policy::ALL, args.runs, args.seed)?;
    let mix = mix_samples(&samples, &targets.mix);
    let mix_stats: Vec<Stats> = mix
        .iter()
        .map(|level| Stats::of(level.iter().flatten()))
        .collect();
    let medians: Vec<u16> = mix_stats
        .iter()
        .map(|stats| stats.effective_bp[1])
        .collect();
    let (points, weights) = weights(&medians, targets.floor_bp)?;
    if args.check {
        check_mix(&levels, &mix, &targets)?;
    }
    let gates = gate_set(&levels, &samples, &weights, args.runs, args.seed)?;

    let root = args
        .out
        .parent()
        .and_then(Path::parent)
        .unwrap_or(Path::new(""));
    let name = args
        .out
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or("--out: a file name")?;
    let calibration = json!({
        "rulesVersion": RULES_VERSION,
        "levelIds": levels.iter().map(|level| hex(&level_id(&level.bytes))).collect::<Vec<_>>(),
        "weightsBp": weights,
        "medianPoints": points,
        "floorBp": targets.floor_bp,
    });
    let mut vectors = BTreeMap::new();
    for gate in gates.iter().flatten() {
        let (vector, trace) = game_vector(&gate.case)?;
        vectors.insert(format!("{}.json", gate.case.name), vector.into_bytes());
        vectors.insert(format!("{}.trace", gate.case.name), trace);
    }
    rewrite(&root.join("vectors/levels"), is_vector_file, &vectors)?;
    let report = Report {
        name,
        levels: &levels,
        samples: &samples,
        targets: &targets,
        mix: &mix_stats,
        weights: &weights,
        points,
        gates: &gates,
        runs: args.runs,
        seed: args.seed,
    };
    write(
        &root.join("reports").join(format!("{name}.md")),
        &report.markdown(),
    )?;
    write(
        &args.out,
        &(serde_json::to_string_pretty(&calibration).map_err(|e| e.to_string())? + "\n"),
    )
}

fn parse(args: &[&str]) -> Result<Args, String> {
    let (mut out, mut levels, mut runs, mut seed, mut check) =
        (None, PathBuf::from("levels"), RUNS, SEED, false);
    let mut rest = args;
    loop {
        match rest {
            ["--check", tail @ ..] => {
                check = true;
                rest = tail;
            }
            [flag, value, tail @ ..] => {
                match *flag {
                    "--out" => out = Some(PathBuf::from(value)),
                    "--levels" => levels = PathBuf::from(value),
                    "--runs" => runs = number(flag, value)?,
                    "--seed" => seed = number(flag, value)?,
                    _ => return Err(USAGE.to_string()),
                }
                rest = tail;
            }
            [] => break,
            [_] => return Err(USAGE.to_string()),
        }
    }
    if !(1..=MAX_RUNS).contains(&runs) {
        return Err(format!("--runs: 1 to {MAX_RUNS}, got {runs}"));
    }
    Ok(Args {
        out: out.ok_or(USAGE)?,
        levels,
        runs,
        seed,
        check,
    })
}

/// `samples[level][policy]` restricted to the policies of `mix`, in its order.
fn mix_samples(samples: &[Vec<Vec<Sample>>], mix: &[Policy]) -> Vec<Vec<Vec<Sample>>> {
    let columns: Vec<usize> = mix
        .iter()
        .map(|policy| {
            Policy::ALL
                .iter()
                .position(|all| all == policy)
                .expect("Policy::ALL holds every policy")
        })
        .collect();
    samples
        .iter()
        .map(|level| {
            columns
                .iter()
                .map(|&column| level[column].clone())
                .collect()
        })
        .collect()
}

/// P and each level's weight for the median effective claims `medians` (README §8.4):
/// weight_bp = P × 10,000 / max(median, floor), rounded down, with P the largest multiple of
/// 1,000 points that keeps every weight within a u16.
fn weights(medians: &[u16], floor_bp: u16) -> Result<(u32, Vec<u16>), String> {
    let claims: Vec<u64> = medians
        .iter()
        .map(|&median| u64::from(median.max(floor_bp)))
        .collect();
    let lowest = *claims.iter().min().ok_or("no level")?;
    if lowest == 0 {
        return Err("a median effective claim of 0 bp, with a floor of 0 bp, has no weight".into());
    }
    // A weight floor(P × BP / claim) fits in a u16 while P × BP < 65,536 × claim.
    let points =
        ((u64::from(u16::MAX) + 1) * lowest - 1) / u64::from(BP) / POINTS_STEP * POINTS_STEP;
    if points == 0 {
        return Err(format!(
            "no P of {POINTS_STEP} points or more keeps a weight within a u16 for a claim of \
             {lowest} bp"
        ));
    }
    let weights = claims
        .iter()
        .map(|&claim| {
            u16::try_from(points * u64::from(BP) / claim).expect("P keeps every weight in a u16")
        })
        .collect();
    Ok((
        u32::try_from(points).expect("at most 65,535 × 10,000 / 10,000"),
        weights,
    ))
}

/// The gate set of each level, `[NN-worst, NN-synthetic]`, one thread per level.
fn gate_set(
    levels: &[LevelFile],
    samples: &[Vec<Vec<Sample>>],
    weights: &[u16],
    runs: u32,
    seed: u64,
) -> Result<Vec<[Gate; 2]>, String> {
    thread::scope(|scope| {
        let handles: Vec<_> = levels
            .iter()
            .zip(samples)
            .zip(weights)
            .map(|((level, samples), &weight_bp)| {
                scope.spawn(move || -> Result<[Gate; 2], String> {
                    Ok([
                        worst(level, samples, weight_bp, seed)?,
                        synthetic(level, weight_bp, runs, seed)?,
                    ])
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|handle| handle.join().expect("a gate-set thread panicked"))
            .collect()
    })
}

/// The longest bot journal of a level, played again from its policy and run.
fn worst(
    level: &LevelFile,
    samples: &[Vec<Sample>],
    weight_bp: u16,
    seed: u64,
) -> Result<Gate, String> {
    let (column, run) = longest(samples);
    let policy = Policy::ALL[column];
    let header = header(&level.level, nonce(seed, run));
    let (journal, sample) = play_level(level, &header, policy)?;
    Ok(Gate {
        case: gate_case(level, "worst", header, journal, weight_bp, sample.end),
        policy: policy.name(),
        run,
        ticks_used: sample.ticks_used,
        events: sample.events,
    })
}

/// The column and run of the longest sample of `samples[policy][run]`: the most ticks, then the
/// most events, then the first in policy and run order.
fn longest(samples: &[Vec<Sample>]) -> (usize, u32) {
    let mut best = (0, 0, (0, 0));
    for (column, runs) in samples.iter().enumerate() {
        for (run, sample) in (0..).zip(runs) {
            if (sample.ticks_used, sample.events) > best.2 {
                best = (column, run, (sample.ticks_used, sample.events));
            }
        }
    }
    (best.0, best.1)
}

/// The longest of the worst-case policy's runs of a level, on the same run nonces as the bots,
/// with the same tie-breaks as `longest`.
fn synthetic(level: &LevelFile, weight_bp: u16, runs: u32, seed: u64) -> Result<Gate, String> {
    let mut best: Option<(u16, u16, u32, Vec<u8>, EndReason)> = None;
    for run in 0..runs {
        let header = header(&level.level, nonce(seed, run));
        let recorder = play(&level.level, &header, worst_case_policy(), |_| {})?;
        let game = recorder.game();
        let events = events(recorder.journal());
        if best
            .as_ref()
            .is_none_or(|(ticks, most, ..)| (game.ticks_used, events) > (*ticks, *most))
        {
            let end = game.end.expect("a played level has ended");
            best = Some((
                game.ticks_used,
                events,
                run,
                recorder.journal().to_vec(),
                end,
            ));
        }
    }
    let (ticks_used, events, run, journal, end) = best.ok_or("no run")?;
    Ok(Gate {
        case: gate_case(
            level,
            "synthetic",
            header(&level.level, nonce(seed, run)),
            journal,
            weight_bp,
            end,
        ),
        policy: "worst-case",
        run,
        ticks_used,
        events,
    })
}

fn gate_case(
    level: &LevelFile,
    kind: &str,
    header: Header,
    journal: Vec<u8>,
    weight_bp: u16,
    end: EndReason,
) -> GameCase {
    GameCase {
        name: format!("{:02}-{kind}", level.index),
        covers: Vec::new(),
        level: level.bytes.clone(),
        header,
        journal,
        weight_bp,
        expect: Ok(end),
        tick_0_hash: None,
    }
}

fn write(path: &Path, text: &str) -> Result<(), String> {
    if let Some(dir) = path.parent().filter(|dir| !dir.as_os_str().is_empty()) {
        fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    }
    fs::write(path, text).map_err(|e| format!("{}: {e}", path.display()))?;
    println!("wrote {}", path.display());
    Ok(())
}

struct Report<'a> {
    name: &'a str,
    levels: &'a [LevelFile],
    samples: &'a [Vec<Vec<Sample>>],
    targets: &'a Targets,
    mix: &'a [Stats],
    weights: &'a [u16],
    points: u32,
    gates: &'a [[Gate; 2]],
    runs: u32,
    seed: u64,
}

impl Report<'_> {
    fn markdown(&self) -> String {
        let mix: Vec<&str> = self
            .targets
            .mix
            .iter()
            .map(|policy| policy.name())
            .collect();
        let mut text = format!(
            "# {name}\n\nGenerated by `jiro-tools calibrate`: rules version {RULES_VERSION}, seed \
             {seed}, {runs} runs per policy and level, on the run nonces of `jiro-tools \
             playtest`. The reference mix ({mix}) sets each level's weight from its median \
             effective claim m (README §8.4): weight_bp = P × 10,000 / max(m, floor), rounded \
             down, with P = {points} points, the largest multiple of 1,000 that keeps every \
             weight within a u16, and a floor of {floor} bp. A median run therefore scores P \
             points, or P − 1 by rounding, on every level. Effective claim: `claim_bp`, or 0 \
             when the lives ran out (D5). Medians at index (n − 1) / 2 of the sorted runs.\n\n\
             | # | Name | Clear rate | Band | Median effective claim | Weight | Median score |\n\
             |---|---|---|---|---|---|---|\n",
            name = self.name,
            seed = self.seed,
            runs = self.runs,
            mix = mix.join(", "),
            points = self.points,
            floor = self.targets.floor_bp,
        );
        for ((level, stats), &weight) in self.levels.iter().zip(self.mix).zip(self.weights) {
            let target = self.targets.clear_rate_pct[usize::from(level.index) - 1];
            let tolerance = self.targets.tolerance_pct;
            let median = stats.effective_bp[1];
            text.push_str(&format!(
                "| {:02} | {} | {} | {} % to {} % | {median} bp | {weight} bp | {} |\n",
                level.index,
                level.name,
                percent(stats.per_mille(stats.cleared)),
                target.saturating_sub(tolerance),
                (target + tolerance).min(100),
                u32::from(median) * u32::from(weight) / u32::from(BP),
            ));
        }
        let names: Vec<&str> = Policy::ALL.iter().map(|policy| policy.name()).collect();
        text.push_str(&format!(
            "\n## Every policy\n\nClear rate, and median effective claim in bp.\n\n| # | Name | {} |\n|---|---|{}\n",
            names.join(" | "),
            "---|".repeat(names.len()),
        ));
        for (level, samples) in self.levels.iter().zip(self.samples) {
            let cells: Vec<String> = samples
                .iter()
                .map(|runs| {
                    let stats = Stats::of(runs.iter());
                    format!(
                        "{}, {}",
                        percent(stats.per_mille(stats.cleared)),
                        stats.effective_bp[1]
                    )
                })
                .collect();
            text.push_str(&format!(
                "| {:02} | {} | {} |\n",
                level.index,
                level.name,
                cells.join(" | ")
            ));
        }
        text.push_str(
            "\n## Gate set\n\nThe runs of `vectors/levels/` that the M4 gas gate measures (plan \
             §4): `NN-worst`, the longest journal of every policy's runs (the most ticks, then \
             the most events, then the first policy and run), and `NN-synthetic`, the longest of \
             the worst-case scenario's runs on the same run nonces, with an event on every tick. \
             Each is scored with its level's weight.\n\n\
             | # | Name | `NN-worst` | `NN-synthetic` |\n|---|---|---|---|\n",
        );
        for (level, [worst, synthetic]) in self.levels.iter().zip(self.gates) {
            let describe = |gate: &Gate| {
                format!(
                    "{}, run {}: {} ticks, {} events",
                    gate.policy, gate.run, gate.ticks_used, gate.events
                )
            };
            text.push_str(&format!(
                "| {:02} | {} | {} | {} |\n",
                level.index,
                level.name,
                describe(worst),
                describe(synthetic)
            ));
        }
        text
    }
}
