use std::time::Instant;

use jiro_core::level::{Level, decode};
use jiro_core::types::Pos;

use super::*;
use crate::playtest::{load_levels, nonce};
use crate::scenarios::play::{header, play};

/// Debug builds run a unit about 25 times slower than release: the tests that search play
/// short levels at small budgets.
const TEST_UNITS_PER_TICK: u64 = 1_000;

fn l01() -> Level {
    let bytes = std::fs::read(crate::repo_root().join("levels/01-open.bin")).expect("L01");
    decode(&bytes).expect("decode")
}

/// L01 cut to `time_limit` ticks.
fn short_l01(time_limit: u16) -> Level {
    Level {
        time_limit,
        ..l01()
    }
}

fn start(level: &Level) -> Game {
    Game::new(level, &nonce(1, 0), 0).expect("game")
}

/// Plays `level` with the bot through the Recorder and returns its journal.
fn journal(level: &Level, bot: &mut Search) -> Vec<u8> {
    let recorder = play(
        level,
        &header(level, nonce(1, 0)),
        |game| bot.mask(game),
        |_| {},
    )
    .expect("play");
    recorder.journal().to_vec()
}

fn key(cleared: bool, claim_bp: u16, ticks: u16) -> Key {
    Key {
        cleared,
        claim_bp,
        fewer_ticks: Reverse(ticks),
    }
}

#[test]
fn the_bot_never_spends_more_than_it_has_accrued() {
    let level = short_l01(400);
    let mut bot = Search::new(TEST_UNITS_PER_TICK);
    play(
        &level,
        &header(&level, nonce(1, 0)),
        |game| {
            let mask = bot.mask(game);
            assert!(bot.spent <= bot.accrued, "tick {}", game.ticks_used);
            mask
        },
        |_| {},
    )
    .expect("play");
}

/// L01 has no minions, so the pad stands: 2,700 − 300 reserve ticks, halved.
#[test]
fn the_first_decision_pads_half_the_ticks_beyond_the_reserve() {
    let mut bot = Search::new(UNITS_PER_TICK);
    bot.mask(&start(&l01()));
    assert_eq!(bot.plan.len() + 1, 1_200);
}

/// L01 with a minion that patrols the bottom rail toward the player's start, one cell a tick.
fn l01_with_a_minion() -> Level {
    let mut level = l01();
    level.minion_count = 1;
    level.minion_spawns[0] = Pos { x: 36, y: 59 };
    level.minion_period = 1;
    level.respawn_delay = 60;
    level
}

/// The ticks the player can stand at its start before it loses a life.
fn ticks_standing(game: &Game) -> u16 {
    let mut standing = game.clone();
    while standing.player.lives == game.player.lives {
        standing.step(InputMask::NONE).expect("step");
    }
    standing.ticks_used - 1
}

#[test]
fn a_pad_walks_out_of_a_minion_s_way_instead_of_standing_into_its_hit() {
    let game = start(&l01_with_a_minion());
    let line = pad(&mut Budget { left: u64::MAX }, &game, PAD_CHUNK).expect("a pad");
    assert!(
        line.game.player.lives == game.player.lives && line.game.ticks_used > ticks_standing(&game),
        "padded to tick {}, standing loses a life at tick {}",
        line.game.ticks_used,
        ticks_standing(&game)
    );
}

#[test]
fn a_clear_outranks_a_larger_claim_that_does_not_clear() {
    assert!(key(true, 7_500, 900) > key(false, 9_000, 10));
}

#[test]
fn among_clears_the_larger_claim_wins() {
    assert!(key(true, 9_000, 900) > key(true, 8_000, 10));
}

#[test]
fn among_equal_claims_fewer_ticks_win() {
    assert!(key(true, 9_000, 10) > key(true, 9_000, 11));
}

#[test]
fn the_budget_refuses_a_step_it_cannot_afford() {
    let mut budget = Budget {
        left: MAX_STEP_UNITS - 1,
    };
    let mut line = Budget { left: CLONE_UNITS }
        .root(&start(&l01()))
        .expect("root");
    assert_eq!(budget.advance(&mut line, InputMask::NONE), None);
}

#[test]
fn an_executed_plan_reaches_its_simulated_state() {
    let game = start(&l01());
    let line = search(&mut Budget { left: 200_000 }, &game).expect("a line");
    let mut played = game.clone();
    for mask in line.plan.stack().into_iter().rev() {
        played.step(mask).expect("step");
    }
    assert_eq!(state_hash(&played), state_hash(&line.game));
}

#[test]
fn two_plays_of_one_level_write_the_same_journal() {
    let level = short_l01(400);
    let first = journal(&level, &mut Search::new(TEST_UNITS_PER_TICK));
    assert_eq!(
        first,
        journal(&level, &mut Search::new(TEST_UNITS_PER_TICK))
    );
}

#[test]
fn with_no_line_found_the_bot_commits_at_its_last_life() {
    let game = start(&Level { lives: 1, ..l01() });
    assert_eq!(Search::new(0).mask(&game), InputMask::X);
}

#[test]
fn with_no_line_found_the_bot_stands_while_it_has_lives_to_spare() {
    assert_eq!(Search::new(0).mask(&start(&l01())), InputMask::NONE);
}

/// Pins the search bot's play. The bot-advantage shards (plan M4.13) were played by this bot:
/// if this moves, rerun them, or mark `reports/bot-advantage.md` stale.
#[test]
fn search_plays_l01_as_pinned() {
    let level = short_l01(400);
    let mut bot = Search::new(TEST_UNITS_PER_TICK);
    let recorder = play(
        &level,
        &header(&level, nonce(1, 0)),
        |game| bot.mask(game),
        |_| {},
    )
    .expect("play");
    let game = recorder.game();
    assert_eq!(
        (game.end, game.claim_bp(), game.ticks_used, bot.spent),
        (Some(EndReason::Cleared), Ok(9643), 101, 50_856)
    );
}

/// Run alone, in release, on an idle machine: `cargo test -p jiro-tools --release -- --ignored
/// --test-threads 1 --nocapture no_level_spends_more_than_the_worst_ns_per_unit`. Each level plays
/// its Training run 0 of seed 1 at the full budget on one thread, and prints its ns per unit and
/// its compute per game second; `WORST_NS_PER_UNIT` is the largest, rounded up.
#[test]
#[ignore = "about 15 min of release compute; measures the machine"]
fn no_level_spends_more_than_the_worst_ns_per_unit() {
    let levels = load_levels(&crate::repo_root().join("levels")).expect("levels");
    for level in &levels {
        let mut bot = Search::new(UNITS_PER_TICK);
        let mut ns: u128 = 0;
        let recorder = play(
            &level.level,
            &header(&level.level, nonce(1, 0)),
            |game| {
                let started = Instant::now();
                let mask = bot.mask(game);
                ns += started.elapsed().as_nanos();
                mask
            },
            |_| {},
        )
        .expect("play");
        let ticks = recorder.game().ticks_used;
        let spent = u128::from(bot.spent);
        let ns_per_tenth_unit = ns * 10 / spent;
        let per_mille_of_a_second = ns * 15 * 1_000 / (u128::from(ticks) * 1_000_000_000);
        println!(
            "level {:02} {}: {ticks} ticks, {spent} units, {}.{} ns per unit, {per_mille_of_a_second} ‰ of a second of compute per game second",
            level.index,
            level.name,
            ns_per_tenth_unit / 10,
            ns_per_tenth_unit % 10
        );
        assert!(
            ns <= u128::from(WORST_NS_PER_UNIT) * spent,
            "level {:02}",
            level.index
        );
    }
}
