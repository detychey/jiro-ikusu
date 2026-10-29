//! Long game vectors: the synthetic worst case for gas and cycles, a full journal, and random
//! games.

use jiro_core::consts::MAX_EVENTS;
use jiro_core::game::{EndReason, Game};
use jiro_core::journal::Header;
use jiro_core::level::{Level, Rect};
use jiro_core::types::InputMask;

use super::game::{GameCase, check, game_case};
use super::level::{open_field, with_minions, with_obstacles};
use super::play::{CaptureBot, Run, every_tick, first_run, random_play, record};

pub fn cases() -> Result<Vec<GameCase>, String> {
    let mut cases = vec![worst_case()?, full_journal()?];
    cases.extend(random_games()?);
    Ok(cases)
}

/// The case of a run that holds its own end, whatever it is.
fn ran(name: &str, covers: &[&str], level: &Level, header: Header, run: Run) -> GameCase {
    let end = run.last().end.expect("a recorded run ends");
    game_case(name, covers, level, header, run.journal, Ok(end))
}

/// Square blocks of obstacles, `side` cells wide, with their top-left cells at `corners`.
fn blocks(level: Level, side: u8, corners: &[(u8, u8)]) -> Level {
    let cells = corners.iter().flat_map(|&(x, y)| {
        (x..x + side).flat_map(move |dx| (y..y + side).map(move |dy| (dx, dy)))
    });
    with_obstacles(level, cells)
}

/// A synthetic worst case for Stylus gas and zk cycles: 2,700 ticks, a B = 8 boss moving every
/// tick, 3 minions moving every tick, obstacles, frequent captures, and an event on every tick.
fn worst_case() -> Result<GameCase, String> {
    let name = "worst-case";
    let level = Level {
        boss_size: 8,
        boss_period: 1,
        spawn: Rect {
            x0: 10,
            y0: 10,
            x1: 40,
            y1: 28,
        },
        minion_period: 1,
        respawn_delay: 30,
        lives: 255,
        target_bp: 10_000,
        ..blocks(
            with_minions(open_field(), &[(0, 20), (59, 40), (20, 0)]),
            3,
            &[(5, 45), (50, 40), (20, 50), (45, 5)],
        )
    };
    let (level_header, run) = first_run(
        name,
        &level,
        || {
            let mut bot = CaptureBot::new(3, 5);
            Box::new(every_tick(move |game: &Game| bot.direction(game).mask()))
        },
        |run| run.last().end == Some(EndReason::TimeLimit) && run.captures() >= 20,
    )?;
    check(
        name,
        run.events() == usize::from(MAX_EVENTS),
        "has an event on every tick",
    )?;
    Ok(ran(
        name,
        &[
            "§7.3", "R4.4-5", "R4.6-3", "R4.7-2", "R4.7-10", "R4.8-4", "R4.9-1", "R4.9-13",
            "COV-13",
        ],
        &level,
        level_header,
        run,
    ))
}

/// COV-13: 2,700 events, the mask alternating between left and right along the bottom border.
fn full_journal() -> Result<GameCase, String> {
    let name = "full-journal";
    let level = open_field();
    let level_header = super::journal::header();
    let run = record(&level, &level_header, |game| {
        if game.ticks_used % 2 == 0 {
            InputMask::LEFT
        } else {
            InputMask::RIGHT
        }
    })?;
    check(
        name,
        run.events() == usize::from(MAX_EVENTS),
        "fills the journal",
    )?;
    Ok(ran(
        name,
        &["§6.2", "§6.3", "R4.4-6", "R4.5-1", "COV-13"],
        &level,
        level_header,
        run,
    ))
}

/// Random games, at least 500 ticks long: four with direction and X bits only, then four with
/// all bits, on levels with and without minions and obstacles.
fn random_games() -> Result<Vec<GameCase>, String> {
    let minions = Level {
        minion_period: 2,
        respawn_delay: 60,
        ..with_minions(open_field(), &[(0, 20), (59, 40), (20, 0)])
    };
    let obstacles = blocks(open_field(), 4, &[(8, 45), (46, 44), (40, 8), (6, 6)]);
    let small_boss = Level {
        boss_size: 2,
        boss_period: 1,
        lives: 9,
        ..minions
    };
    let levels = [open_field(), minions, obstacles, small_boss];
    let mut cases = Vec::new();
    for (all_bits, label) in [(false, "dirs"), (true, "all")] {
        for (k, level) in levels.iter().enumerate() {
            let name = format!("random-{label}-{}", k + 1);
            let mut seed = 100 * (k as u64 + 1) + if all_bits { 10 } else { 0 };
            let (level_header, run) = first_run(
                &name,
                level,
                || {
                    seed += 1;
                    Box::new(random_play(seed, 6, 1_500, all_bits))
                },
                |run| run.last().ticks_used >= 500,
            )?;
            let covers: &[&str] = if all_bits {
                &["§4", "R4.4-3", "R4.5-6", "R4.5-7"]
            } else {
                &["§4", "R4.4-3", "R4.5-1"]
            };
            cases.push(ran(&name, covers, level, level_header, run));
        }
    }
    Ok(cases)
}
