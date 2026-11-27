//! Game vectors of levels with two bosses (README §4.6, §4.8): a bounce off the other body, a
//! boss pinned between the other body and a wall, a capture that separates the bosses under the
//! separation floor, a later capture that reaches the floor with the bosses apart, one that
//! leaves them together, and a random game.

use jiro_core::boss::Boss;
use jiro_core::game::{EndReason, Game};
use jiro_core::level::{BossRecord, Level, Rect};
use jiro_core::types::InputMask;

use super::game::{GameCase, calm, check, game_case, recorded};
use super::level::{twin_field, with_obstacles};
use super::play::{Run, first_run, header, random_play, record, script};

pub fn cases() -> Result<Vec<GameCase>, String> {
    Ok(vec![
        bounce()?,
        pinned()?,
        separation()?,
        separation_floor()?,
        capture_together()?,
        random_twin()?,
    ])
}

/// A second boss of size `size` held still at `spawn`, as `calm` holds the first.
fn calm_second(size: u8, spawn: (u8, u8)) -> BossRecord {
    let (x, y) = spawn;
    BossRecord {
        size,
        spawn: Rect {
            x0: x,
            y0: y,
            x1: x,
            y1: y,
        },
        period: 255,
    }
}

/// How each boss moved on a tick, compared with the move it would have made alone: whether it
/// moved at all, and whether the other body changed its move. The player stands still in the
/// runs that use it, so the grid of step 4 is the grid before the tick.
struct BossMoves {
    /// The other body changed the boss's move.
    bounced: bool,
    /// The boss moved on this tick and stayed in place: blocked on both axes.
    held: bool,
}

fn boss_moves(before: &Game, after: &Game) -> [BossMoves; 2] {
    let tick = after.ticks_used - 1;
    let alone = |boss: Boss| {
        let mut alone = boss;
        alone.step(&before.grid, tick, None);
        alone
    };
    let second_before = before.bosses.second.expect("a level with two bosses");
    let second_after = after.bosses.second.expect("a level with two bosses");
    let moves = |boss: Boss, after: Boss| BossMoves {
        bounced: alone(boss) != after,
        held: tick.is_multiple_of(u16::from(boss.period)) && boss.pos == after.pos,
    };
    [
        moves(before.bosses.first, after.bosses.first),
        moves(second_before, second_after),
    ]
}

/// A boss bounces off the other body on the open field, the player standing still.
fn bounce() -> Result<GameCase, String> {
    let name = "twin-bosses-bounce";
    let level = Level {
        boss_period: 1,
        time_limit: 600,
        ..twin_field()
    };
    let (level_header, run) = first_run(
        name,
        &level,
        || Box::new(|_: &Game| InputMask::NONE),
        |run| {
            run.ticks().any(|(before, _, after)| {
                boss_moves(before, after)
                    .iter()
                    .any(|boss| boss.bounced && !boss.held)
            })
        },
    )?;
    recorded(
        name,
        &["§4.6", "R4.6-13", "R4.6-14", "R4.6-5", "R4.6-7", "R4.4-9"],
        &level,
        level_header,
        run,
        EndReason::TimeLimit,
    )
}

/// Two B = 8 bosses in a corridor exactly 8 cells high: every move bounces on y, so a boss that
/// meets the other body on x is blocked on both axes, reverses both and holds still.
fn pinned() -> Result<GameCase, String> {
    let name = "twin-bosses-pinned";
    let top = 10;
    let corridor = top..top + 8;
    let walls = (1..59u8)
        .flat_map(|x| (1..30u8).map(move |y| (x, y)))
        .filter(|&(x, y)| !corridor.contains(&y) && !(x == 50 && y >= top + 8));
    let level = Level {
        boss_size: 8,
        boss_period: 1,
        time_limit: 300,
        second_boss: Some(BossRecord {
            period: 2,
            ..calm_second(8, (30, top))
        }),
        ..with_obstacles(calm((5, top)), walls)
    };
    let (level_header, run) = first_run(
        name,
        &level,
        || Box::new(|_: &Game| InputMask::NONE),
        |run| {
            run.ticks().any(|(before, _, after)| {
                boss_moves(before, after)
                    .iter()
                    .any(|boss| boss.bounced && boss.held)
            })
        },
    )?;
    recorded(
        name,
        &["§4.6", "R4.6-14", "R4.6-15"],
        &level,
        level_header,
        run,
        EndReason::TimeLimit,
    )
}

/// The bosses still on either side of x = 30, and a cut up that column: the capture separates
/// them, under the floor of half the target, so both sides stay open and the level goes on
/// until the commit.
fn separation() -> Result<GameCase, String> {
    let name = "twin-bosses-separation";
    let level = Level {
        second_boss: Some(calm_second(4, (45, 20))),
        ..calm((5, 20))
    };
    let level_header = header(&level, super::journal::header().run_nonce);
    let run = record(
        &level,
        &level_header,
        script(&[(InputMask::UP, 59)], InputMask::X),
    )?;
    let last = run.last();
    check(
        name,
        last.separated && last.captured == 58 && last.claim_bp() == Ok(172),
        "separates the bosses with a cut of 58 cells, under the floor",
    )?;
    recorded(
        name,
        &["§4.8", "R4.8-2", "R4.8-5", "R4.8-6", "R4.11-2"],
        &level,
        level_header,
        run,
        EndReason::Committed,
    )
}

/// Both bosses near the top, on either side of x = 30: the cut up that column separates them
/// under the floor, then a cut right along y = 15 takes the bossless region below it, which
/// brings the claim to 3,834 bp, past the floor of 3,750: the level clears at the target.
fn separation_floor() -> Result<GameCase, String> {
    let name = "twin-bosses-separation-floor";
    let level = Level {
        second_boss: Some(calm_second(4, (45, 5))),
        ..calm((5, 5))
    };
    let level_header = header(&level, super::journal::header().run_nonce);
    let run = record(
        &level,
        &level_header,
        script(
            &[
                (InputMask::UP, 59),
                (InputMask::DOWN, 15),
                (InputMask::RIGHT, 59),
            ],
            InputMask::X,
        ),
    )?;
    let last = run.last();
    check(
        name,
        last.separated
            && last.captured == 58 + 28 * 43 + 28
            && last.claim_bp() == Ok(level.target_bp),
        "reaches the floor with the bosses apart, at the target",
    )?;
    recorded(
        name,
        &["§4.8", "R4.8-5", "R4.8-6", "PIN-10"],
        &level,
        level_header,
        run,
        EndReason::Cleared,
    )
}

/// Both bosses right of x = 30, and the same cut: the capture takes the left side and the level
/// goes on until the commit.
fn capture_together() -> Result<GameCase, String> {
    let name = "twin-bosses-capture-together";
    let level = Level {
        second_boss: Some(calm_second(4, (45, 40))),
        ..calm((45, 10))
    };
    let level_header = header(&level, super::journal::header().run_nonce);
    let run = record(
        &level,
        &level_header,
        script(&[(InputMask::UP, 59)], InputMask::X),
    )?;
    let last = run.last();
    check(
        name,
        !last.separated && last.captured == 29 * 58 + 58,
        "captures the left side and keeps the bosses together",
    )?;
    recorded(
        name,
        &["§4.8", "R4.8-2", "R4.8-3", "R4.8-5"],
        &level,
        level_header,
        run,
        EndReason::Committed,
    )
}

/// Random play on the twin field with both bosses moving every tick, for at least 500 ticks.
fn random_twin() -> Result<GameCase, String> {
    let name = "random-twin";
    let level = Level {
        boss_period: 1,
        lives: 9,
        second_boss: twin_field()
            .second_boss
            .map(|boss| BossRecord { period: 1, ..boss }),
        ..twin_field()
    };
    let mut seed = 900;
    let (level_header, run) = first_run(
        name,
        &level,
        || {
            seed += 1;
            Box::new(random_play(seed, 6, 1_500, false))
        },
        |run: &Run| run.last().ticks_used >= 500 && run.captures() >= 3,
    )?;
    let end = run.last().end.expect("a recorded run ends");
    Ok(game_case(
        name,
        &["§4", "R4.6-13", "R4.8-5", "R4.9-3"],
        &level,
        level_header,
        run.journal,
        Ok(end),
    ))
}
