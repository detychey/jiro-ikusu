//! Game vectors of cuts and captures (README §4.5, §4.8), and of the boss's moves (§4.6).

use jiro_core::game::{EndReason, Game};
use jiro_core::journal::Header;
use jiro_core::level::Level;
use jiro_core::types::{Cell, InputMask};

use super::game::{GameCase, calm, check, recorded};
use super::level::{open_field, with_obstacles};
use super::play::{CaptureBot, Run, at, first_run, header, mask, record, script};

pub fn cases() -> Result<Vec<GameCase>, String> {
    let mut cases = capture_shapes()?;
    cases.extend(boss_corridors()?);
    cases.extend(cut_moves()?);
    cases.extend(bot_captures()?);
    Ok(cases)
}

/// Plays `steps` on `level` with the example nonce, then commits.
fn scripted(level: &Level, steps: &[(InputMask, u16)]) -> Result<(Header, Run), String> {
    let header = header(level, super::journal::header().run_nonce);
    let run = record(level, &header, script(steps, InputMask::X))?;
    Ok((header, run))
}

/// A scripted cut, and the cells its capture must claim.
struct Shape<'a> {
    name: &'a str,
    level: Level,
    steps: &'a [(InputMask, u16)],
    size: u16,
    tags: &'a [&'a str],
}

/// COV-01: an edge rectangle, an L-shaped cut, a cut around an obstacle, and a cut across the
/// field with the boss on either side.
fn capture_shapes() -> Result<Vec<GameCase>, String> {
    let (up, down, left, right) = (
        InputMask::UP,
        InputMask::DOWN,
        InputMask::LEFT,
        InputMask::RIGHT,
    );
    let rectangle = [(up, 5), (right, 6), (down, 5)];
    let shapes = [
        Shape {
            name: "capture-edge-rectangle",
            level: calm((25, 10)),
            steps: &rectangle,
            size: 7 * 5,
            tags: &["R4.5-2", "R4.5-5"],
        },
        Shape {
            name: "capture-l-shape",
            level: calm((25, 10)),
            steps: &[(up, 5), (left, 30)],
            size: 30 * 5,
            tags: &["R4.5-5"],
        },
        Shape {
            name: "capture-around-obstacle",
            level: with_obstacles(calm((25, 10)), [(32, 56), (33, 56), (32, 57), (33, 57)]),
            steps: &rectangle,
            size: 7 * 5 - 4,
            tags: &["R4.1-8", "R4.8-4"],
        },
        Shape {
            name: "capture-split-boss-left",
            level: calm((5, 20)),
            steps: &[(up, 59)],
            size: 28 * 58 + 58,
            tags: &["R4.8-2", "R4.8-3"],
        },
        Shape {
            name: "capture-split-boss-right",
            level: calm((50, 20)),
            steps: &[(up, 59)],
            size: 29 * 58 + 58,
            tags: &["R4.8-2", "R4.8-3"],
        },
    ];
    shapes
        .into_iter()
        .map(
            |Shape {
                 name,
                 level,
                 steps,
                 size,
                 tags,
             }| {
                let (header, run) = scripted(&level, steps)?;
                check(
                    name,
                    run.last().captured == size,
                    &format!("captures {size} cells"),
                )?;
                let covers: Vec<&str> = ["§4.8", "R4.8-1", "R4.4-8", "COV-01"]
                    .into_iter()
                    .chain(tags.iter().copied())
                    .collect();
                recorded(name, &covers, &level, header, run, EndReason::Committed)
            },
        )
        .collect()
}

/// COV-02: the boss in a horizontal corridor exactly B cells high, which it follows to both
/// ends, bouncing off each end's corner, for B = 2 and B = 8.
fn boss_corridors() -> Result<Vec<GameCase>, String> {
    [2u8, 8]
        .into_iter()
        .map(|size| {
            let name = format!("boss-corridor-b{size}");
            let top = 10;
            let corridor = top..top + size;
            let walls = (1..59u8)
                .flat_map(|x| (1..30u8).map(move |y| (x, y)))
                .filter(|&(x, y)| !corridor.contains(&y) && !(x == 40 && y >= top + size));
            let level = Level {
                boss_size: size,
                boss_period: 1,
                time_limit: 400,
                ..with_obstacles(calm((20, top)), walls)
            };
            let right_end = 59 - size;
            let (header, run) = first_run(
                &name,
                &level,
                || Box::new(|_: &Game| InputMask::NONE),
                |run| {
                    let positions = || run.states.iter().map(|game| game.boss.pos);
                    positions().all(|pos| pos.y == top)
                        && positions().any(|pos| pos.x == 1)
                        && positions().any(|pos| pos.x == right_end)
                },
            )?;
            recorded(
                &name,
                &[
                    "§4.6", "R4.6-1", "R4.6-2", "R4.6-3", "R4.6-4", "R4.6-6", "R4.6-7", "COV-02",
                ],
                &level,
                header,
                run,
                EndReason::TimeLimit,
            )
        })
        .collect()
}

/// The fast cut, a fast cut closing on its first sub-step, the slow shield, and a player
/// stranded off the rail by their own capture.
fn cut_moves() -> Result<Vec<GameCase>, String> {
    let (up, down, left, right) = (
        InputMask::UP,
        InputMask::DOWN,
        InputMask::LEFT,
        InputMask::RIGHT,
    );
    let calm = calm((25, 10));

    let (fast_header, fast) = scripted(&calm, &[(up, 1), (mask(&[up, InputMask::A]), 5)])?;
    check(
        "fast-cut",
        fast.ticks()
            .skip(1)
            .take(5)
            .all(|(before, _, after)| before.player.pos.y - after.player.pos.y == 2),
        "takes two sub-steps per tick while cutting with A held",
    )?;

    let blocked = with_obstacles(calm, [(30, 50)]);
    let (close_header, close) = scripted(&blocked, &[(up, 8), (mask(&[up, InputMask::A]), 1)])?;
    let closing = close.ticks().nth(8).ok_or("fast-cut-close: too short")?;
    let (before, _, after) = closing;
    check(
        "fast-cut-close-first-sub-step",
        after.player.pos == at(30, 50)
            && !after.player.cutting
            && after.captured > before.captured
            && after.grid.at(at(30, 49)) == Some(Cell::Empty),
        "closes on the first sub-step and takes no second one",
    )?;

    let (slow_header, slow) = scripted(&calm, &[(mask(&[up, InputMask::B]), 10)])?;
    check(
        "slow-shield",
        slow.ticks()
            .take(10)
            .enumerate()
            .all(|(tick, (before, _, after))| {
                (before.player.pos != after.player.pos) == (tick % 2 == 0)
            })
            && slow.states[1].player.press_tick == 0,
        "moves only on even ticks with B held from tick 0",
    )?;

    let pocket: Vec<(u8, u8)> = (10..=14)
        .flat_map(|x| (1..=2).map(move |y| (x, y)))
        .chain([
            (10, 3),
            (15, 2),
            (15, 3),
            (15, 4),
            (14, 4),
            (13, 4),
            (14, 3),
            (13, 5),
            (14, 5),
            (15, 5),
        ])
        .collect();
    let stranding = with_obstacles(calm, pocket);
    let walk = [
        (left, 30),
        (up, 59),
        (right, 10),
        (down, 3),
        (right, 4),
        (down, 2),
    ];
    let (stranded_header, stranded) = scripted(&stranding, &walk)?;
    check(
        "stranded-off-rail",
        stranded.ticks().any(|(before, _, after)| {
            !before.player.cutting
                && !before.grid.is_rail(before.player.pos)
                && after.player.pos != before.player.pos
                && !after.grid.is_rail(after.player.pos)
        }) && stranded.last().grid.is_rail(stranded.last().player.pos),
        "walks off the rail over a claimed cell off the rail, back to the rail",
    )?;

    Ok(vec![
        recorded(
            "fast-cut",
            &["§4.5", "R4.5-6", "R4.4-8"],
            &calm,
            fast_header,
            fast,
            EndReason::Committed,
        )?,
        recorded(
            "fast-cut-close-first-sub-step",
            &["§4.5", "R4.5-5", "R4.5-6", "PIN-04", "COV-05"],
            &blocked,
            close_header,
            close,
            EndReason::Committed,
        )?,
        recorded(
            "slow-shield",
            &["§4.5", "R4.5-7", "PIN-03", "R4.3-5"],
            &calm,
            slow_header,
            slow,
            EndReason::Committed,
        )?,
        recorded(
            "stranded-off-rail",
            &["§4.5", "R4.5-3", "R4.2-1", "R4.2-2", "COV-08"],
            &stranding,
            stranded_header,
            stranded,
            EndReason::Committed,
        )?,
    ])
}

/// The capture bot: several captures on the open-field level, then a commit; and a level
/// cleared at a low target.
fn bot_captures() -> Result<Vec<GameCase>, String> {
    let open_field = open_field();
    let (capture_header, capture) = first_run(
        "open-field-capture",
        &open_field,
        || {
            let mut bot = CaptureBot::new(1, 6);
            let mut captures = 0;
            let mut captured = 0;
            Box::new(move |game: &Game| {
                if game.captured > captured {
                    captures += 1;
                    captured = game.captured;
                }
                if captures >= 5 {
                    InputMask::X
                } else {
                    bot.direction(game).mask()
                }
            })
        },
        |run| run.captures() >= 5 && run.last().end == Some(EndReason::Committed),
    )?;

    let low_target = Level {
        target_bp: 500,
        ..calm((25, 10))
    };
    let (clear_header, clear) = first_run(
        "clear-the-level",
        &low_target,
        || {
            let mut bot = CaptureBot::new(2, 8);
            Box::new(move |game: &Game| bot.direction(game).mask())
        },
        |run| run.last().end == Some(EndReason::Cleared),
    )?;
    Ok(vec![
        recorded(
            "open-field-capture",
            &[
                "§4.8", "R4.5-2", "R4.5-5", "R4.8-1", "R4.8-4", "R4.10-2", "R4.1-8",
            ],
            &open_field,
            capture_header,
            capture,
            EndReason::Committed,
        )?,
        recorded(
            "clear-the-level",
            &["§4.10", "R4.10-1", "PIN-10", "R4.1-8"],
            &low_target,
            clear_header,
            clear,
            EndReason::Cleared,
        )?,
    ])
}
