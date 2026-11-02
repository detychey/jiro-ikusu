//! The markdown of a bot-advantage study: the studied policy's run scores paired with each
//! baseline's over the same runs, with 95 % percentile-bootstrap intervals over the runs, and
//! the score ceiling that no play can pass. Integers only, so the report is a pure function of
//! the shards.

use std::iter::once;

use jiro_core::consts::{RULES_VERSION, RUN_LEVELS};
use jiro_core::game::{EndReason, Game};
use jiro_core::grid::claim_bp;
use jiro_core::replay::level_score;

use super::super::shard::{LevelPlay, Played};
use super::super::{LevelFile, percent, quartile};
use super::Study;
use crate::bots::Policy;
use crate::bots::search::{RESERVE_TICKS, WORST_NS_PER_UNIT};
use crate::scenarios::play::Rng;

const RESAMPLES: usize = 10_000;
const RESAMPLE_SEED: u64 = 1;
/// A ratio over zero.
const INFINITE: i64 = i64::MAX;

/// The 95 % percentile interval of `statistic` over `RESAMPLES` resamples of the runs, each of
/// `runs` runs drawn with replacement: every statistic sees the same resamples.
pub(super) fn interval(runs: usize, statistic: impl Fn(&[usize]) -> i64) -> [i64; 2] {
    let mut rng = Rng::new(RESAMPLE_SEED);
    let mut resample = vec![0; runs];
    let mut values: Vec<i64> = (0..RESAMPLES)
        .map(|_| {
            for run in &mut resample {
                *run = rng.below(runs as u64) as usize;
            }
            statistic(&resample)
        })
        .collect();
    values.sort_unstable();
    [
        values[RESAMPLES / 40],
        values[RESAMPLES - 1 - RESAMPLES / 40],
    ]
}

/// `statistic` over every run, and its interval.
fn estimate(runs: usize, statistic: impl Fn(&[usize]) -> i64) -> [i64; 3] {
    let all: Vec<usize> = (0..runs).collect();
    let [low, high] = interval(runs, &statistic);
    [statistic(&all), low, high]
}

/// The mean of `values` over `runs`, in tenths, rounded down.
pub(super) fn mean_tenths(values: &[i64], runs: &[usize]) -> i64 {
    (runs.iter().map(|&k| values[k]).sum::<i64>() * 10).div_euclid(runs.len() as i64)
}

fn median(values: &[i64], runs: &[usize]) -> i64 {
    let mut sorted: Vec<i64> = runs.iter().map(|&k| values[k]).collect();
    sorted.sort_unstable();
    quartile(&sorted, 2)
}

/// Σ numerator / Σ denominator over `runs`, in thousandths, rounded down, or `INFINITE`.
pub(super) fn ratio(numerator: &[i64], denominator: &[i64], runs: &[usize]) -> i64 {
    let sum = |values: &[i64]| runs.iter().map(|&k| values[k]).sum::<i64>();
    match sum(denominator) {
        0 => INFINITE,
        total => sum(numerator) * 1_000 / total,
    }
}

/// The highest claim any play reaches on `level`: the boss's B × B body covers only open cells
/// (R4.6-1), which no capture claims (R4.8-4).
pub(super) fn ceiling_bp(level: &LevelFile) -> Result<u16, String> {
    let game = Game::new(&level.level, &[0; 32], 0)
        .map_err(|error| format!("level {:02}: rule {}", level.index, error.code()))?;
    let body = u16::from(level.level.boss_size).pow(2);
    let claim = claim_bp(game.claimable.get() - body, game.claimable);
    Ok(u16::try_from(claim).expect("a claim is at most 10,000 bp"))
}

/// Each run's score if it clears at least `min_clears` levels, and 0 otherwise.
pub(super) fn qualified(scores: &[i64], clears: &[i64], min_clears: i64) -> Vec<i64> {
    scores
        .iter()
        .zip(clears)
        .map(|(&score, &clear)| if clear >= min_clears { score } else { 0 })
        .collect()
}

/// The run score of the scripted portfolio: on each level, the best scripted level score.
pub(super) fn portfolio(levels: &[LevelPlay]) -> i64 {
    levels
        .iter()
        .map(|level| {
            let best = level.scripted.iter().map(|game| game.level_score).max();
            i64::from(best.unwrap_or(0))
        })
        .sum()
}

fn tenths(value: i64) -> String {
    let sign = if value < 0 { "-" } else { "" };
    format!("{sign}{}.{}", value.abs() / 10, value.abs() % 10)
}

fn thousandths(value: i64) -> String {
    match value {
        INFINITE => "∞".to_string(),
        _ => format!("{}.{:03}", value / 1_000, value % 1_000),
    }
}

fn points(value: i64) -> String {
    value.to_string()
}

fn with_interval([value, low, high]: [i64; 3], show: fn(i64) -> String) -> String {
    format!("{} [{}, {}]", show(value), show(low), show(high))
}

/// The game of column `column`: the studied policy's, then those of `Policy::ALL`.
fn played(level: &LevelPlay, column: usize) -> Played {
    match column {
        0 => level.studied,
        _ => level.scripted[column - 1],
    }
}

fn column_of(policy: Policy) -> usize {
    1 + Policy::ALL
        .iter()
        .position(|&scripted| scripted == policy)
        .expect("Targets::read keeps the mix to Policy::ALL")
}

pub(super) fn markdown(
    study: &Study,
    levels: &[LevelFile],
    weights: &[u16],
    mix: &[Policy],
) -> Result<String, String> {
    let ceilings = levels
        .iter()
        .map(ceiling_bp)
        .collect::<Result<Vec<_>, _>>()?;
    let runs = &study.runs;
    let n = runs.len();
    let names: Vec<&str> = once(study.policy.as_str())
        .chain(Policy::ALL.iter().map(|policy| policy.name()))
        .collect();
    let per_run = |value: &dyn Fn(&[LevelPlay]) -> i64| -> Vec<i64> {
        runs.iter().map(|run| value(&run.levels)).collect()
    };
    let scores: Vec<Vec<i64>> = (0..names.len())
        .map(|column| {
            per_run(&|levels| {
                levels
                    .iter()
                    .map(|level| i64::from(played(level, column).level_score))
                    .sum()
            })
        })
        .collect();
    let clears: Vec<Vec<i64>> = (0..names.len())
        .map(|column| {
            per_run(&|levels| {
                levels
                    .iter()
                    .filter(|level| played(level, column).end == EndReason::Cleared)
                    .count() as i64
            })
        })
        .collect();
    let mix_columns: Vec<usize> = mix.iter().map(|&policy| column_of(policy)).collect();
    let mix_size = mix_columns.len() as i64;
    let mix_scores: Vec<i64> = (0..n)
        .map(|k| mix_columns.iter().map(|&c| scores[c][k]).sum::<i64>() / mix_size)
        .collect();
    let portfolio = per_run(&portfolio);
    let best: Vec<i64> = (0..n)
        .map(|k| (1..names.len()).map(|c| scores[c][k]).max().unwrap_or(0))
        .collect();
    let ceiling = per_run(&|levels| {
        levels
            .iter()
            .map(|level| {
                let slot = usize::from(level.slot);
                i64::from(level_score(
                    ceilings[slot],
                    weights[slot],
                    EndReason::Cleared,
                ))
            })
            .sum()
    });
    let mix_names: Vec<&str> = mix.iter().map(|policy| policy.name()).collect();
    let mix_name = format!("reference mix ({})", mix_names.join(", "));
    let studied = &scores[0];
    let all: Vec<usize> = (0..n).collect();

    let mut text = format!(
        "# Bot advantage\n\nGenerated by `jiro-tools playtest --merge` from the {shards} shards of \
         `{dir}`: rules version {RULES_VERSION}, seed {seed}, {n} six-level Challenge runs. Run k \
         has the run nonce `nonce({seed}, k)`, plays the levels its draw names under Challenge \
         headers (README §6.3, §8.2), and scores them at the calibration's weights. Every policy \
         played the same {games} games, so each comparison pairs the runs. Intervals: 95 % \
         percentile bootstrap over the runs, {RESAMPLES} resamples, the same for every \
         statistic. Means in points, to a tenth; ratios to a thousandth; both rounded down.\n",
        shards = study.shards,
        dir = study.dir.display(),
        seed = study.seed,
        games = n * RUN_LEVELS,
    );
    if study.policy == Policy::Search.name() {
        text.push_str(&format!(
            "\nThe studied policy, `search`, searches each level's future with the core (plan \
             M4.13). It spends at most {upt} work units per tick played, and a unit costs at \
             most {WORST_NS_PER_UNIT} ns on one container core, so it computes at most {ms} ms \
             per game second on one core. A search spends only the units accrued since the \
             state it searches from became known, on the level it plays: the bot uses no \
             `commitSlack`, no nonce preview and no second core. It pads half the ticks a level \
             can spare beyond {RESERVE_TICKS} (README §7.2: padding costs only the fewer-ticks \
             tiebreak).\n",
            upt = study.units_per_tick,
            ms = u128::from(study.units_per_tick) * u128::from(WORST_NS_PER_UNIT) * 15 / 1_000_000,
        ));
    }

    text.push_str(&format!(
        "\n## Uplift of {policy}\n\nThe uplift of a run is {policy}'s run score minus the \
         baseline's. A run is won when the uplift is above 0. The ceiling column bounds the \
         uplift of any play over the baseline: the ceiling's mean run score over the \
         baseline's.\n\n| Baseline | Mean run score | Mean uplift | Median uplift | Ratio of \
         means | Runs won | Ceiling over the baseline |\n|---|---|---|---|---|---|---|\n",
        policy = study.policy,
    ));
    let baselines: Vec<(String, &Vec<i64>)> = [
        (format!("{mix_name}, the primary baseline"), &mix_scores),
        (
            "scripted portfolio: the best scripted policy on each level, the key secondary \
             baseline"
                .to_string(),
            &portfolio,
        ),
        ("the best scripted policy of each run".to_string(), &best),
    ]
    .into_iter()
    .chain((1..names.len()).map(|c| (names[c].to_string(), &scores[c])))
    .collect();
    for (name, baseline) in &baselines {
        let uplift: Vec<i64> = studied.iter().zip(*baseline).map(|(s, b)| s - b).collect();
        text.push_str(&format!(
            "| {name} | {} | {} | {} | {} | {} | {} |\n",
            tenths(mean_tenths(baseline, &all)),
            with_interval(estimate(n, |r| mean_tenths(&uplift, r)), tenths),
            with_interval(estimate(n, |r| median(&uplift, r)), points),
            with_interval(estimate(n, |r| ratio(studied, baseline, r)), thousandths),
            uplift.iter().filter(|&&d| d > 0).count(),
            with_interval(estimate(n, |r| ratio(&ceiling, baseline, r)), thousandths),
        ));
    }
    text.push_str(&format!(
        "\nPot share (README §8.2): the ratio of mean run scores of {policy} over the {mix_name} \
         is {}.\n",
        with_interval(estimate(n, |r| ratio(studied, &mix_scores, r)), thousandths),
        policy = study.policy,
    ));

    text.push_str(&format!(
        "\n## Score ceiling\n\nNo play claims more than (claimable − B²) × 10,000 / claimable bp \
         on a level, rounded down: the boss's B × B body covers only open cells (R4.6-1), which \
         no capture claims. The ceiling run scores each drawn level at that claim, cleared: \
         {} points on average. {policy} reaches {} of it, a share in thousandths, and the \
         ceiling is {} times its score.\n",
        tenths(mean_tenths(&ceiling, &all)),
        with_interval(estimate(n, |r| ratio(studied, &ceiling, r)), thousandths),
        with_interval(estimate(n, |r| ratio(&ceiling, studied, r)), thousandths),
        policy = study.policy,
    ));

    text.push_str(&format!(
        "\n## Qualification (D10)\n\nThe share of runs that clear at least m levels, and A(m): \
         {policy}'s payout per run over the other's under pro-rata payout with `minClears` m, \
         the mean score of the runs that qualify, the others counting 0. Against the reference \
         mix, each of its policies counts as a player.\n\n| m | {} | reference mix | A(m) \
         over the mix | A(m) over greedy |\n|---|{}---|---|---|\n",
        names.join(" | "),
        "---|".repeat(names.len()),
        policy = study.policy,
    ));
    for m in 1..=RUN_LEVELS as i64 {
        let qualified: Vec<Vec<i64>> = scores
            .iter()
            .zip(&clears)
            .map(|(scores, clears)| qualified(scores, clears, m))
            .collect();
        let count = |column: usize| clears[column].iter().filter(|&&c| c >= m).count() as u32;
        let rates: Vec<String> = (0..names.len())
            .map(|column| percent(count(column) * 1_000 / n as u32))
            .collect();
        let mix_count: u32 = mix_columns.iter().map(|&c| count(c)).sum();
        let mix_rate = mix_count * 1_000 / (n as u32 * mix_columns.len() as u32);
        let over_mix: Vec<i64> = qualified[0].iter().map(|score| score * mix_size).collect();
        let mix_paid: Vec<i64> = (0..n)
            .map(|k| mix_columns.iter().map(|&c| qualified[c][k]).sum())
            .collect();
        let greedy = &qualified[column_of(Policy::Greedy)];
        text.push_str(&format!(
            "| {m} | {} | {} | {} | {} |\n",
            rates.join(" | "),
            percent(mix_rate),
            with_interval(estimate(n, |r| ratio(&over_mix, &mix_paid, r)), thousandths),
            with_interval(
                estimate(n, |r| ratio(&qualified[0], greedy, r)),
                thousandths
            ),
        ));
    }

    text.push_str(
        "\n## Run scores\n\n| Policy | Mean | Q1 / median / Q3 | Mean clears |\n|---|---|---|---|\n",
    );
    let rows = (0..names.len())
        .map(|c| (names[c].to_string(), &scores[c], Some(&clears[c])))
        .chain([
            (mix_name.clone(), &mix_scores, None),
            ("scripted portfolio".to_string(), &portfolio, None),
            (
                "the best scripted policy of each run".to_string(),
                &best,
                None,
            ),
            ("ceiling".to_string(), &ceiling, None),
        ]);
    for (name, values, clears) in rows {
        let mut sorted = values.clone();
        sorted.sort_unstable();
        let [q1, q2, q3] = [1, 2, 3].map(|k| quartile(&sorted, k));
        text.push_str(&format!(
            "| {name} | {} | {q1} / {q2} / {q3} | {} |\n",
            tenths(mean_tenths(values, &all)),
            clears.map_or("–".to_string(), |clears| tenths(mean_tenths(
                clears, &all
            ))),
        ));
    }

    text.push_str(&per_level(study, levels, &ceilings, &mix_columns));
    text.push_str(&format!(
        "\n## Reproduce\n\nShard i: `cargo run -p jiro-tools --release --locked -- playtest \
         --policy {policy} --runs {n} --seed {seed} --shard <i>/{shards} --out {shard}` writes \
         the same bytes. One level of a run: `cargo run -p jiro-tools --release --locked -- \
         playtest --policy {policy} --nonce <runNonce> --level-index <i> --out level.jrn` \
         writes the journal the shard holds. Then `cargo run -p jiro-tools --release --locked \
         -- playtest --merge {dir} --out <this file>`.\n",
        policy = study.policy,
        seed = study.seed,
        shards = study.shards,
        shard = study.dir.join("shard-<i>.json").display(),
        dir = study.dir.display(),
    ));
    Ok(text)
}

/// The levels as the runs drew them: the studied policy's, greedy's and the reference mix's
/// clear rate and mean effective claim, and the studied policy's ticks used.
fn per_level(study: &Study, levels: &[LevelFile], ceilings: &[u16], mix: &[usize]) -> String {
    let mut text = format!(
        "\n## Per level\n\nClear rate and mean effective claim in bp; {policy}'s mean and most \
         ticks used.\n\n| # | Name | Ceiling | Draws | {policy} | {policy} ticks | greedy | \
         reference mix |\n|---|---|---|---|---|---|---|---|\n",
        policy = study.policy,
    );
    let greedy = column_of(Policy::Greedy);
    for (slot, level) in levels.iter().enumerate() {
        let plays: Vec<&LevelPlay> = study
            .runs
            .iter()
            .flat_map(|run| &run.levels)
            .filter(|play| usize::from(play.slot) == slot)
            .collect();
        let games = |columns: &[usize]| -> Vec<Played> {
            plays
                .iter()
                .flat_map(|play| columns.iter().map(|&column| played(play, column)))
                .collect()
        };
        let describe = |games: &[Played]| match games.len() as u32 {
            0 => "–".to_string(),
            count => {
                let cleared = games.iter().filter(|g| g.end == EndReason::Cleared).count();
                let claims: u32 = games.iter().map(|g| u32::from(g.effective_bp)).sum();
                format!(
                    "{}, {}",
                    percent(cleared as u32 * 1_000 / count),
                    claims / count
                )
            }
        };
        let studied = games(&[0]);
        let ticks = match studied.len() as u32 {
            0 => "–".to_string(),
            count => {
                let total: u32 = studied.iter().map(|g| u32::from(g.ticks_used)).sum();
                let most = studied.iter().map(|g| g.ticks_used).max().unwrap_or(0);
                format!("{}, {most}", total / count)
            }
        };
        text.push_str(&format!(
            "| {:02} | {} | {} | {} | {} | {ticks} | {} | {} |\n",
            level.index,
            level.name,
            ceilings[slot],
            plays.len(),
            describe(&studied),
            describe(&games(&[greedy])),
            describe(&games(mix)),
        ));
    }
    text
}
