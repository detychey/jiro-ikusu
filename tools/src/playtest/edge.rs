//! `playtest --edge` (plan M5.16): the bot edge ρ of README §8.4 on a level set, for scripted
//! players standing in for people: the reference mix of `levels/targets.json`, and the mix with
//! 20 % and 40 % novices, edge-nibbler and random-walk in equal shares. A game's ticket is
//! min(claim, target) / target, and 0 when the lives ran out. A run draws six different levels
//! of the 16, so every level is equally likely: people's average ticket w̄ is the mean over the
//! levels, and a perfect bot's ticket is 1, so ρ = 1 / w̄. Integers only, rounded down.
//!
//! playtest [--levels <dir>] --edge <file.md> [--runs <n>] [--seed <n>]

use std::fs;
use std::path::{Path, PathBuf};

use jiro_core::consts::{BP, RULES_VERSION, RUN_LEVELS};
use jiro_core::game::EndReason;
use jiro_core::level::level_id;

use super::merge::report::{INFINITE, thousandths};
use super::{
    LevelFile, MAX_RUNS, REFERENCE_RUNS, REFERENCE_SEED, Sample, Targets, levels_hash, load_levels,
    number, percent, play_all,
};
use crate::bots::Policy;

#[cfg(test)]
mod tests;

const USAGE: &str =
    "usage: jiro-tools playtest [--levels <dir>] --edge <file.md> [--runs <n>] [--seed <n>]";

/// The reference mix's file: the mix belongs to the project, not to a level set.
const TARGETS: &str = "levels/targets.json";

/// The novices of README §8.4's populations, in equal shares.
const NOVICES: [Policy; 2] = [Policy::EdgeNibbler, Policy::RandomWalk];

/// The novices' share of each population, in percent.
const NOVICE_PCT: [u64; 3] = [0, 20, 40];

/// One policy's games on one level.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(super) struct Tally {
    pub(super) games: u64,
    pub(super) cleared: u64,
    pub(super) died: u64,
    /// The sum of the games' tickets, in basis points.
    pub(super) tickets_bp: u64,
    pub(super) ticks: u64,
}

impl Tally {
    pub(super) fn of(samples: &[Sample], target_bp: u16) -> Self {
        let mut tally = Self::default();
        for sample in samples {
            tally.games += 1;
            tally.cleared += u64::from(sample.end == EndReason::Cleared);
            tally.died += u64::from(sample.end == EndReason::OutOfLives);
            tally.tickets_bp += ticket_bp(sample.effective_bp, target_bp);
            tally.ticks += u64::from(sample.ticks_used);
        }
        tally
    }
}

/// README §8.4's `ticket_bp`: min(claim, target) × 10,000 / target, rounded down, where the
/// effective claim is already 0 when the lives ran out.
pub(super) fn ticket_bp(effective_bp: u16, target_bp: u16) -> u64 {
    u64::from(effective_bp.min(target_bp)) * u64::from(BP) / u64::from(target_bp)
}

/// A statistic over some levels' tallies, each policy weighted: the weighted sum of a count and
/// the weighted number of games.
#[derive(Clone, Copy)]
struct Weighted {
    sum: u128,
    games: u128,
}

impl Weighted {
    fn of(tallies: &[&[Tally]], weights: &[u64], count: fn(&Tally) -> u64) -> Self {
        let mut weighted = Self { sum: 0, games: 0 };
        for level in tallies {
            for (tally, &weight) in level.iter().zip(weights) {
                weighted.sum += u128::from(weight) * u128::from(count(tally));
                weighted.games += u128::from(weight) * u128::from(tally.games);
            }
        }
        weighted
    }

    /// The mean, rounded down.
    fn mean(self) -> u128 {
        self.sum / self.games
    }

    /// The mean of a count of games, in tenths of a percent.
    fn rate(self) -> String {
        percent(u32::try_from(self.sum * 1_000 / self.games).expect("at most 1,000"))
    }

    /// The mean ticket, in thousandths.
    fn ticket(self) -> String {
        thousandths(milli(self.sum * 1_000, self.games * u128::from(BP)))
    }

    /// ρ, a perfect bot's ticket of 1 over the mean ticket, in thousandths.
    fn edge(self) -> String {
        thousandths(milli(self.games * u128::from(BP) * 1_000, self.sum))
    }
}

/// `numerator / denominator`, rounded down, or `INFINITE` over zero.
fn milli(numerator: u128, denominator: u128) -> i64 {
    match denominator {
        0 => INFINITE,
        _ => i64::try_from(numerator / denominator).expect("a ratio within i64"),
    }
}

pub(super) fn run(args: &[&str]) -> Result<(), String> {
    let (mut dir, mut out) = (PathBuf::from("levels"), None);
    let (mut runs, mut seed) = (REFERENCE_RUNS, REFERENCE_SEED);
    let mut rest = args;
    while let [flag, value, tail @ ..] = rest {
        match *flag {
            "--levels" => dir = PathBuf::from(value),
            "--edge" => out = Some(PathBuf::from(value)),
            "--runs" => runs = number(flag, value)?,
            "--seed" => seed = number(flag, value)?,
            _ => return Err(USAGE.to_string()),
        }
        rest = tail;
    }
    let (Some(out), []) = (out, rest) else {
        return Err(USAGE.to_string());
    };
    if !(1..=MAX_RUNS).contains(&runs) {
        return Err(format!("--runs: 1 to {MAX_RUNS}, got {runs}"));
    }
    let levels = load_levels(&dir)?;
    if levels.is_empty() {
        return Err(format!("{}: no level", dir.display()));
    }
    let mix = Targets::read(Path::new(TARGETS))?.mix;
    if let Some(policy) = mix.iter().find(|policy| NOVICES.contains(policy)) {
        return Err(format!(
            "{TARGETS}: the mix holds the novice {}",
            policy.name()
        ));
    }
    let policies: Vec<Policy> = mix.iter().copied().chain(NOVICES).collect();
    let samples = play_all(&levels, &policies, runs, seed)?;
    let tallies: Vec<Vec<Tally>> = levels
        .iter()
        .zip(&samples)
        .map(|(level, per_policy)| {
            per_policy
                .iter()
                .map(|samples| Tally::of(samples, level.level.target_bp))
                .collect()
        })
        .collect();
    let markdown = markdown(&levels, &policies, mix.len(), &tallies, runs, seed);
    if let Some(parent) = out.parent().filter(|dir| !dir.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    }
    fs::write(&out, markdown).map_err(|e| format!("{}: {e}", out.display()))?;
    println!("wrote {}", out.display());
    Ok(())
}

/// The policy weights of the population with `novice_pct` % novices, the first `mix` policies
/// being the reference mix and the rest the novices, in equal shares within each group.
pub(super) fn population(policies: usize, mix: usize, novice_pct: u64) -> Vec<u64> {
    let novices = (policies - mix) as u64;
    (0..policies)
        .map(|i| match i < mix {
            true => (100 - novice_pct) * novices,
            false => novice_pct * mix as u64,
        })
        .collect()
}

fn population_name(novice_pct: u64) -> String {
    match novice_pct {
        0 => "the reference mix".to_string(),
        pct => format!("{pct} % novices"),
    }
}

pub(super) fn markdown(
    levels: &[LevelFile],
    policies: &[Policy],
    mix: usize,
    tallies: &[Vec<Tally>],
    runs: u32,
    seed: u64,
) -> String {
    let ids: Vec<[u8; 32]> = levels.iter().map(|level| level_id(&level.bytes)).collect();
    let all: Vec<&[Tally]> = tallies.iter().map(Vec::as_slice).collect();
    let names = |range: std::ops::Range<usize>| {
        policies[range]
            .iter()
            .map(|policy| policy.name())
            .collect::<Vec<_>>()
            .join(", ")
    };
    let mut text = format!(
        "# Bot edge {hash}\n\nGenerated by `jiro-tools playtest --edge`: rules version \
         {RULES_VERSION}, seed {seed}, {runs} Training runs per policy and level, on the {count} \
         levels of hash {hash}. A game's ticket is min(claim, target) / target, and 0 when the \
         lives ran out (README §8.4). The people are scripted players: the reference mix of \
         `levels/targets.json` ({mix_names}), with 0, 20 % or 40 % novices ({novices}), the \
         policies of each group in equal shares. A run draws six different levels, so every \
         level is equally likely, and people's average ticket w̄ is the mean over the levels. A \
         perfect bot's ticket is 1, so the bot edge ρ is 1 / w̄. d is the share of games that \
         ran out of lives. Ratios to a thousandth, rates to a tenth of a percent, rounded \
         down.\n\n## Populations\n\n| People | w̄ | ρ | d | Clear | Ticks a game | Ticks a run |\n\
         |---|---|---|---|---|---|---|\n",
        hash = levels_hash(&ids),
        count = levels.len(),
        mix_names = names(0..mix),
        novices = names(mix..policies.len()),
    );
    for pct in NOVICE_PCT {
        let weights = population(policies.len(), mix, pct);
        let of = |count| Weighted::of(&all, &weights, count);
        let tickets = of(|t| t.tickets_bp);
        let ticks = of(|t| t.ticks).mean();
        text.push_str(&format!(
            "| {} | {} | {} | {} | {} | {ticks} | {} |\n",
            population_name(pct),
            tickets.ticket(),
            tickets.edge(),
            of(|t| t.died).rate(),
            of(|t| t.cleared).rate(),
            ticks * RUN_LEVELS as u128,
        ));
    }
    text.push_str(
        "\n## Policies\n\n| Policy | Mean ticket | Death | Clear | Ticks a game |\n\
         |---|---|---|---|---|\n",
    );
    for (i, policy) in policies.iter().enumerate() {
        let weights: Vec<u64> = (0..policies.len()).map(|j| u64::from(i == j)).collect();
        let of = |count| Weighted::of(&all, &weights, count);
        text.push_str(&format!(
            "| {} | {} | {} | {} | {} |\n",
            policy.name(),
            of(|t| t.tickets_bp).ticket(),
            of(|t| t.died).rate(),
            of(|t| t.cleared).rate(),
            of(|t| t.ticks).mean(),
        ));
    }
    text.push_str(
        "\n## Levels\n\nThe reference mix's clear and death rates and ticks a game, and each \
         population's average ticket.\n\n| # | Name | Lives | Target | Clear | Death | Ticks a \
         game | w̄ | w̄, 20 % novices | w̄, 40 % novices |\n|---|---|---|---|---|---|---|---|---|---|\n",
    );
    for (level, tallies) in levels.iter().zip(&all) {
        let one = [*tallies];
        let mix_weights = population(policies.len(), mix, 0);
        let of = |weights: &[u64], count| Weighted::of(&one, weights, count);
        let ticket = |pct| of(&population(policies.len(), mix, pct), |t| t.tickets_bp).ticket();
        text.push_str(&format!(
            "| {:02} | {} | {} | {} bp | {} | {} | {} | {} | {} | {} |\n",
            level.index,
            level.name,
            level.level.lives,
            level.level.target_bp,
            of(&mix_weights, |t| t.cleared).rate(),
            of(&mix_weights, |t| t.died).rate(),
            of(&mix_weights, |t| t.ticks).mean(),
            ticket(0),
            ticket(20),
            ticket(40),
        ));
    }
    text
}
