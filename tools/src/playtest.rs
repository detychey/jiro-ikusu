//! `jiro-tools playtest` (plan M2.6): the bots of `bots` play the levels of a directory through the
//! core's Recorder, and `replay()` scores every journal, so a bot cannot score differently from
//! the referee. Runs are deterministic per integer seed, and parallel across nonces.
//!
//! playtest --levels <dir> [--only <n>|<a>-<b>] [--runs <n>] [--seed <n>] [--policy <name>]
//!          [--out <dir>] [--check <targets.json>]
//! playtest --levels <dir> --only <n> --policy <name> --nonce <hex> --level-index <i> --out <file>
//!
//! Without `--policy`, the bots are the reference mix that `<dir>/targets.json` names.

use std::fs;
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::thread;

use jiro_core::consts::{BP, RULES_VERSION, SEASON_LEVELS};
use jiro_core::game::EndReason;
use jiro_core::journal::{self, Header, Mode};
use jiro_core::keccak::keccak256;
use jiro_core::level::{Level, decode, level_id};
use jiro_core::replay::replay;
use serde_json::{Value, json};

use crate::bots::Policy;
use crate::json::{hex, parse_hex};
use crate::levels::level_index;
use crate::scenarios::play::play;

#[cfg(test)]
mod tests;

const USAGE: &str = concat!(
    "usage: jiro-tools playtest --levels <dir> [--only <n>|<a>-<b>] [--runs <n>] [--seed <n>] ",
    "[--policy <name>] [--out <dir>] [--check <targets.json>] | jiro-tools playtest --levels ",
    "<dir> --only <n> --policy <name> --nonce <hex> --level-index <i> --out <file>"
);

struct Args {
    levels: PathBuf,
    only: Option<Range<u8>>,
    runs: u32,
    seed: u64,
    policy: Option<Policy>,
    out: Option<PathBuf>,
    check: Option<PathBuf>,
    nonce: Option<[u8; 32]>,
    level_index: Option<u8>,
}

/// A level of the levels directory.
struct LevelFile {
    index: u8,
    name: String,
    bytes: Vec<u8>,
    level: Level,
}

/// How one run ended, from `replay()`.
#[derive(Clone, Copy)]
struct Sample {
    end: EndReason,
    /// The claim the run scores: `claim_bp`, or 0 when its lives ran out (D5).
    effective_bp: u16,
    ticks_used: u16,
}

/// The reference mix and the bands of `levels/targets.json` (P11).
pub struct Targets {
    pub mix: Vec<Policy>,
    pub tolerance_pct: u16,
    pub floor_bp: u16,
    pub clear_rate_pct: Vec<u16>,
}

pub fn run(args: &[&str]) -> Result<(), String> {
    let args = parse(args)?;
    let mut levels = load_levels(&args.levels)?;
    if let Some(only) = &args.only {
        levels.retain(|level| only.contains(&level.index));
    }
    if levels.is_empty() {
        return Err(format!("{}: no level is selected", args.levels.display()));
    }
    if let Some(nonce) = args.nonce {
        return play_one(&args, &levels, nonce);
    }
    let targets = Targets::read(&args.levels.join("targets.json"))?;
    let policies = match args.policy {
        Some(policy) => vec![policy],
        None => targets.mix.clone(),
    };
    let samples = play_all(&levels, &policies, args.runs, args.seed)?;
    let report = Report {
        levels: &levels,
        policies: &policies,
        mix: args.policy.is_none(),
        samples: &samples,
        runs: args.runs,
        seed: args.seed,
    };
    let out = args.out.clone().unwrap_or_else(|| PathBuf::from("reports"));
    report.write(&out)?;
    match &args.check {
        Some(path) => report.check(&Targets::read(path)?),
        None => Ok(()),
    }
}

fn parse(args: &[&str]) -> Result<Args, String> {
    let mut parsed = Args {
        levels: PathBuf::new(),
        only: None,
        runs: 1_000,
        seed: 1,
        policy: None,
        out: None,
        check: None,
        nonce: None,
        level_index: None,
    };
    let mut levels = None;
    let mut rest = args;
    while let [flag, value, tail @ ..] = rest {
        match *flag {
            "--levels" => levels = Some(PathBuf::from(value)),
            "--only" => parsed.only = Some(range(value)?),
            "--runs" => parsed.runs = number(flag, value)?,
            "--seed" => parsed.seed = number(flag, value)?,
            "--policy" => parsed.policy = Some(Policy::parse(value)?),
            "--out" => parsed.out = Some(PathBuf::from(value)),
            "--check" => parsed.check = Some(PathBuf::from(value)),
            "--nonce" => {
                let bytes = parse_hex(value)?;
                parsed.nonce = Some(bytes.try_into().map_err(|_| "--nonce: 32 bytes")?);
            }
            "--level-index" => parsed.level_index = Some(number(flag, value)?),
            _ => return Err(USAGE.to_string()),
        }
        rest = tail;
    }
    if !rest.is_empty() || parsed.runs == 0 {
        return Err(USAGE.to_string());
    }
    parsed.levels = levels.ok_or(USAGE)?;
    if parsed.nonce.is_some() != parsed.level_index.is_some() {
        return Err("--nonce and --level-index go together".to_string());
    }
    Ok(parsed)
}

fn number<T: std::str::FromStr>(flag: &str, value: &str) -> Result<T, String> {
    value
        .parse()
        .map_err(|_| format!("{flag}: not a number in range: {value}"))
}

/// The level indices of `n` or `a-b`, inclusive.
fn range(text: &str) -> Result<Range<u8>, String> {
    let bad = || format!("--only: expected n or a-b, got {text}");
    let (first, last) = text.split_once('-').unwrap_or((text, text));
    let (first, last): (u8, u8) = (
        first.parse().map_err(|_| bad())?,
        last.parse().map_err(|_| bad())?,
    );
    if first == 0 || first > last {
        return Err(bad());
    }
    Ok(first..last + 1)
}

/// The `NN-name.bin` levels of `dir`, in index order, each checked by the core.
fn load_levels(dir: &Path) -> Result<Vec<LevelFile>, String> {
    let mut levels = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        let stem = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("");
        let Some(index) =
            level_index(stem).filter(|_| path.extension().is_some_and(|e| e == "bin"))
        else {
            continue;
        };
        let bytes = fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
        let level =
            decode(&bytes).map_err(|error| format!("{}: rule {}", path.display(), error.code()))?;
        let name = stem
            .split_once('-')
            .map_or("", |(_, name)| name)
            .to_string();
        levels.push(LevelFile {
            index,
            name,
            bytes,
            level,
        });
    }
    levels.sort_by_key(|level| level.index);
    Ok(levels)
}

/// The run nonce of run `k` under `seed`: keccak256("jiro.playtest." ‖ seed ‖ k), big-endian.
fn nonce(seed: u64, k: u32) -> [u8; 32] {
    keccak256(&[b"jiro.playtest.", &seed.to_be_bytes(), &k.to_be_bytes()])
}

/// The randomness seed of a bot playing under `nonce`.
fn bot_seed(nonce: &[u8; 32]) -> u64 {
    u64::from_be_bytes(nonce[..8].try_into().expect("8 bytes"))
}

/// Plays one level and returns its journal and how it ended. The journal must decode strictly,
/// and `replay()` scores it; a replay that disagrees with the Recorder's game fails loud.
fn play_level(
    level: &LevelFile,
    header: &Header,
    policy: Policy,
) -> Result<(Vec<u8>, Sample), String> {
    let context = || format!("level {:02}, {}", level.index, policy.name());
    let recorder = play(
        &level.level,
        header,
        policy.bot(bot_seed(&header.run_nonce)),
        |_| {},
    )?;
    let journal = recorder.journal().to_vec();
    journal::decode(&journal)
        .map_err(|error| format!("{}: journal rule {}", context(), error.code()))?;
    let outcome = replay(&level.bytes, &journal, BP)
        .map_err(|error| format!("{}: replay rule {}", context(), error.code()))?;
    let game = recorder.game();
    let played = (game.end, game.claim_bp().ok(), game.ticks_used);
    if played
        != (
            Some(outcome.end_reason),
            Some(outcome.claim_bp),
            outcome.ticks_used,
        )
    {
        return Err(format!("{}: replay disagrees with the Recorder", context()));
    }
    let effective_bp = u16::try_from(outcome.level_score).expect("a claim is at most 10,000 bp");
    Ok((
        journal,
        Sample {
            end: outcome.end_reason,
            effective_bp,
            ticks_used: outcome.ticks_used,
        },
    ))
}

/// `samples[level][policy][k]`: every policy plays run k of every level, k in `0..runs`.
fn play_all(
    levels: &[LevelFile],
    policies: &[Policy],
    runs: u32,
    seed: u64,
) -> Result<Vec<Vec<Vec<Sample>>>, String> {
    let threads = thread::available_parallelism()
        .map_or(1, |n| n.get() as u32)
        .min(runs);
    let chunk = runs.div_ceil(threads);
    let chunks: Vec<Range<u32>> = (0..threads)
        .map(|t| t * chunk..((t + 1) * chunk).min(runs))
        .collect();
    let played: Vec<Result<Vec<Vec<Vec<Sample>>>, String>> = thread::scope(|scope| {
        let handles: Vec<_> = chunks
            .iter()
            .map(|ks| {
                let ks = ks.clone();
                scope.spawn(move || {
                    levels
                        .iter()
                        .map(|level| {
                            policies
                                .iter()
                                .map(|&policy| {
                                    ks.clone()
                                        .map(|k| {
                                            let header = Header {
                                                mode: Mode::Training,
                                                run_nonce: nonce(seed, k),
                                                level_id: level_id(&level.bytes),
                                                level_index: 0,
                                            };
                                            play_level(level, &header, policy).map(|(_, s)| s)
                                        })
                                        .collect()
                                })
                                .collect()
                        })
                        .collect()
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|handle| handle.join().expect("a playtest thread panicked"))
            .collect()
    });
    let mut samples: Vec<Vec<Vec<Sample>>> = vec![vec![Vec::new(); policies.len()]; levels.len()];
    for part in played {
        for (level, per_policy) in samples.iter_mut().zip(part?) {
            for (all, chunk) in level.iter_mut().zip(per_policy) {
                all.extend(chunk);
            }
        }
    }
    Ok(samples)
}

/// Plays one level of the Challenge run `nonce` at `--level-index`, writes its journal to
/// `--out`, and prints the Outcome (plan M4.16).
fn play_one(args: &Args, levels: &[LevelFile], nonce: [u8; 32]) -> Result<(), String> {
    let ([level], Some(policy), Some(out), Some(level_index)) =
        (levels, args.policy, &args.out, args.level_index)
    else {
        return Err("--nonce plays one level: give --only <n>, --policy and --out".to_string());
    };
    let header = Header {
        mode: Mode::Challenge,
        run_nonce: nonce,
        level_id: level_id(&level.bytes),
        level_index,
    };
    let (journal, sample) = play_level(level, &header, policy)?;
    fs::write(out, &journal).map_err(|e| format!("{}: {e}", out.display()))?;
    println!(
        "level {:02} {}: {:?}, effective claim {} bp, {} ticks; journal {}",
        level.index,
        level.name,
        sample.end,
        sample.effective_bp,
        sample.ticks_used,
        out.display()
    );
    Ok(())
}

impl Targets {
    pub fn read(path: &Path) -> Result<Self, String> {
        let text = fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let value: Value =
            serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
        let bad = |what: &str| format!("{}: {what}", path.display());
        let number = |key: &str| {
            value[key]
                .as_u64()
                .and_then(|n| u16::try_from(n).ok())
                .ok_or_else(|| bad(&format!("{key} is a number")))
        };
        let mix = value["mix"]
            .as_array()
            .ok_or_else(|| bad("mix lists policy names"))?
            .iter()
            .map(|name| Policy::parse(name.as_str().unwrap_or("")))
            .collect::<Result<Vec<_>, _>>()?;
        let clear_rate_pct = value["clear_rate_pct"]
            .as_array()
            .ok_or_else(|| bad("clear_rate_pct lists the levels' target clear rates"))?
            .iter()
            .map(|n| {
                n.as_u64()
                    .and_then(|n| u16::try_from(n).ok())
                    .filter(|&n| n <= 100)
            })
            .collect::<Option<Vec<u16>>>()
            .ok_or_else(|| bad("a target clear rate is 0 to 100"))?;
        if clear_rate_pct.len() != SEASON_LEVELS || !clear_rate_pct.is_sorted_by(|a, b| a >= b) {
            return Err(bad("clear_rate_pct holds 16 non-increasing rates"));
        }
        if mix.is_empty() {
            return Err(bad("the mix names at least one policy"));
        }
        Ok(Self {
            mix,
            tolerance_pct: number("tolerance_pct")?,
            floor_bp: number("floor_bp")?,
            clear_rate_pct,
        })
    }
}

/// The statistics of a set of runs.
struct Stats {
    runs: u32,
    cleared: u32,
    died: u32,
    committed: u32,
    timed_out: u32,
    /// The first quartile, median and third quartile of the effective claim.
    effective_bp: [u16; 3],
    median_ticks: u16,
}

impl Stats {
    fn of<'a>(samples: impl Iterator<Item = &'a Sample>) -> Self {
        let samples: Vec<&Sample> = samples.collect();
        let count = |end: EndReason| samples.iter().filter(|s| s.end == end).count() as u32;
        let mut effective: Vec<u16> = samples.iter().map(|s| s.effective_bp).collect();
        let mut ticks: Vec<u16> = samples.iter().map(|s| s.ticks_used).collect();
        effective.sort_unstable();
        ticks.sort_unstable();
        Self {
            runs: samples.len() as u32,
            cleared: count(EndReason::Cleared),
            died: count(EndReason::OutOfLives),
            committed: count(EndReason::Committed),
            timed_out: count(EndReason::TimeLimit),
            effective_bp: [1, 2, 3].map(|k| quartile(&effective, k)),
            median_ticks: quartile(&ticks, 2),
        }
    }

    /// A count as a rate in tenths of a percent, rounded down.
    fn per_mille(&self, count: u32) -> u32 {
        count * 1_000 / self.runs
    }

    fn json(&self) -> Value {
        json!({
            "runs": self.runs,
            "clearRatePerMille": self.per_mille(self.cleared),
            "deathRatePerMille": self.per_mille(self.died),
            "commitRatePerMille": self.per_mille(self.committed),
            "timeLimitRatePerMille": self.per_mille(self.timed_out),
            "effectiveClaimQuartilesBp": self.effective_bp,
            "medianTicksUsed": self.median_ticks,
        })
    }

    fn row(&self, name: &str) -> String {
        let pct = |count| percent(self.per_mille(count));
        let [q1, median, q3] = self.effective_bp;
        format!(
            "| {name} | {} | {} | {} | {} | {} | {q1} / {median} / {q3} | {} |\n",
            self.runs,
            pct(self.cleared),
            pct(self.died),
            pct(self.committed),
            pct(self.timed_out),
            self.median_ticks
        )
    }
}

/// The k-th quartile of `sorted`, at index (n − 1) × k / 4.
fn quartile(sorted: &[u16], k: usize) -> u16 {
    sorted[(sorted.len() - 1) * k / 4]
}

fn percent(per_mille: u32) -> String {
    format!("{}.{} %", per_mille / 10, per_mille % 10)
}

struct Report<'a> {
    levels: &'a [LevelFile],
    policies: &'a [Policy],
    /// Whether the policies are the reference mix, reported together as well.
    mix: bool,
    samples: &'a [Vec<Vec<Sample>>],
    runs: u32,
    seed: u64,
}

impl Report<'_> {
    /// The first 6 bytes of keccak256 over the played levels' ids, in index order.
    fn levels_hash(&self) -> String {
        let ids: Vec<[u8; 32]> = self
            .levels
            .iter()
            .map(|level| level_id(&level.bytes))
            .collect();
        let parts: Vec<&[u8]> = ids.iter().map(|id| id.as_slice()).collect();
        hex(&keccak256(&parts)[..6])[2..].to_string()
    }

    fn mix_stats(&self, level: usize) -> Stats {
        Stats::of(self.samples[level].iter().flatten())
    }

    fn write(&self, out: &Path) -> Result<(), String> {
        fs::create_dir_all(out).map_err(|e| format!("{}: {e}", out.display()))?;
        let base = out.join(format!("playtest-{}", self.levels_hash()));
        let names: Vec<&str> = self.policies.iter().map(|policy| policy.name()).collect();
        let mut markdown = format!(
            "# Playtest {}\n\nGenerated by `jiro-tools playtest`: rules version {RULES_VERSION}, seed {}, \
             {} runs per policy and level, policies {}{}. Effective claim: `claim_bp`, or 0 \
             when the lives ran out (D5). Quartiles at index (n − 1) × k / 4 of the sorted runs.\n",
            self.levels_hash(),
            self.seed,
            self.runs,
            names.join(", "),
            if self.mix { " (the reference mix)" } else { "" },
        );
        let mut levels = Vec::new();
        for (i, level) in self.levels.iter().enumerate() {
            markdown.push_str(&format!(
                "\n## {:02} {}\n\n`{}`\n\n| Policy | Runs | Clear | Death | Commit | Time limit | Effective claim Q1 / median / Q3 (bp) | Median ticks |\n|---|---|---|---|---|---|---|---|\n",
                level.index,
                level.name,
                hex(&level_id(&level.bytes)),
            ));
            let mut per_policy = serde_json::Map::new();
            for (policy, samples) in self.policies.iter().zip(&self.samples[i]) {
                let stats = Stats::of(samples.iter());
                markdown.push_str(&stats.row(policy.name()));
                per_policy.insert(policy.name().to_string(), stats.json());
            }
            let mix = self.mix.then(|| self.mix_stats(i));
            if let Some(stats) = &mix {
                markdown.push_str(&stats.row("**reference mix**"));
            }
            levels.push(json!({
                "index": level.index,
                "name": level.name,
                "levelId": hex(&level_id(&level.bytes)),
                "policies": per_policy,
                "mix": mix.map(|stats| stats.json()),
            }));
        }
        let report = json!({
            "rulesVersion": RULES_VERSION,
            "seed": self.seed,
            "runs": self.runs,
            "levelsHash": self.levels_hash(),
            "policies": names,
            "referenceMix": self.mix,
            "levels": levels,
        });
        let json = serde_json::to_string_pretty(&report).map_err(|e| e.to_string())? + "\n";
        for (extension, text) in [("md", markdown), ("json", json)] {
            let path = base.with_extension(extension);
            fs::write(&path, text).map_err(|e| format!("{}: {e}", path.display()))?;
            println!("wrote {}", path.display());
        }
        Ok(())
    }

    /// Names each level whose reference-mix clear rate is outside its band, or whose median
    /// effective claim is at or below the floor.
    fn check(&self, targets: &Targets) -> Result<(), String> {
        if !self.mix || self.policies != targets.mix.as_slice() {
            return Err("--check measures the reference mix of the targets: drop --policy".into());
        }
        let mut failures = Vec::new();
        for (i, level) in self.levels.iter().enumerate() {
            let stats = self.mix_stats(i);
            let target = targets.clear_rate_pct[usize::from(level.index) - 1];
            let low = target.saturating_sub(targets.tolerance_pct);
            let high = (target + targets.tolerance_pct).min(100);
            let clear = stats.per_mille(stats.cleared);
            let median = stats.effective_bp[1];
            let name = format!("level {:02} {}", level.index, level.name);
            let in_band = (u32::from(low) * 10..=u32::from(high) * 10).contains(&clear);
            if !in_band {
                failures.push(format!(
                    "{name}: clear rate {} is outside its band, {low} % to {high} % (target {target} %)",
                    percent(clear)
                ));
            }
            if median <= targets.floor_bp {
                failures.push(format!(
                    "{name}: median effective claim {median} bp is at or below the floor, {} bp",
                    targets.floor_bp
                ));
            }
            if in_band && median > targets.floor_bp {
                println!(
                    "{name}: clear rate {} in {low} % to {high} %, median effective claim {median} bp",
                    percent(clear)
                );
            }
        }
        if failures.is_empty() {
            Ok(())
        } else {
            Err(failures.join("\n"))
        }
    }
}
