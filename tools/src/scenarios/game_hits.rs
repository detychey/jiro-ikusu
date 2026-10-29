//! Game vectors of hits, lives and minions (README §4.7, §4.9).

use jiro_core::consts::PLAYER_START;
use jiro_core::game::{EndReason, Game};
use jiro_core::level::Level;
use jiro_core::minion::{State, right_hand_step};
use jiro_core::types::{Dir, InputMask, Pos};

use super::game::{GameCase, calm, check, minion_pos, recorded};
use super::level::{open_field, with_minions};
use super::play::{Run, at, first_run, header, in_boss, mask, neighbor, record, script};

pub fn cases() -> Result<Vec<GameCase>, String> {
    let mut cases = boss_body_steps()?;
    cases.extend(minion_meetings()?);
    cases.extend(several_hits()?);
    cases.extend(same_tick_ends()?);
    cases.push(respawn_after_bottom_captured()?);
    cases.push(minion_stranded_respawns()?);
    cases.push(boss_bumps_trail()?);
    Ok(cases)
}

/// A minion on the bottom border at (40, 59), moving W every tick from tick 0: at the start of
/// tick t it stands at (40 − t, 59).
fn with_border_minion(level: Level) -> Level {
    Level {
        minion_period: 1,
        respawn_delay: 20,
        ..with_minions(level, &[(40, 59)])
    }
}

fn lost_a_life(before: &Game, after: &Game) -> bool {
    after.player.lives < before.player.lives
}

/// Commits on the tick after the first life lost; until then, plays `policy`.
fn until_hit(mut policy: impl FnMut(&Game) -> InputMask) -> impl FnMut(&Game) -> InputMask {
    let mut lives = None;
    move |game| {
        let start = *lives.get_or_insert(game.player.lives);
        if game.player.lives < start {
            InputMask::X
        } else {
            policy(game)
        }
    }
}

/// COV-03: the player steps onto the bottom-right cell of the still boss's body, from below and
/// from the right.
fn boss_body_steps() -> Result<Vec<GameCase>, String> {
    let level = calm((25, 40));
    let level_header = header(&level, super::journal::header().run_nonce);
    let below = record(
        &level,
        &level_header,
        until_hit(|game| {
            let (boss, player) = (game.boss.pos, game.player.pos);
            toward_column(player, boss.x + 4).unwrap_or(InputMask::UP)
        }),
    )?;
    let right = record(
        &level,
        &level_header,
        until_hit(|game| {
            let (boss, player) = (game.boss.pos, game.player.pos);
            toward_column(player, boss.x + 5).unwrap_or(if player.y > boss.y + 4 {
                InputMask::UP
            } else {
                InputMask::LEFT
            })
        }),
    )?;
    let hit_from = |run: &Run, mask: InputMask, offset: (u8, u8)| {
        run.ticks().any(|(before, ran, after)| {
            let corner = at(before.boss.pos.x + offset.0, before.boss.pos.y + offset.1);
            lost_a_life(before, after) && ran == mask && before.player.pos == corner
        })
    };
    check(
        "step-onto-boss-from-below",
        hit_from(&below, InputMask::UP, (4, 5)),
        "steps up onto the body's bottom-right cell",
    )?;
    check(
        "step-onto-boss-from-right",
        hit_from(&right, InputMask::LEFT, (5, 4)),
        "steps left onto the body's bottom-right cell",
    )?;
    let covers = [
        "§4.9", "R4.9-1", "R4.9-3", "R4.9-16", "R4.9-17", "PIN-05", "COV-03",
    ];
    Ok(vec![
        recorded(
            "step-onto-boss-from-below",
            &covers,
            &level,
            level_header,
            below,
            EndReason::Committed,
        )?,
        recorded(
            "step-onto-boss-from-right",
            &covers,
            &level,
            level_header,
            right,
            EndReason::Committed,
        )?,
    ])
}

/// Along the bottom border to `column`, or None once the player is in it or has left the border.
fn toward_column(player: Pos, column: u8) -> Option<InputMask> {
    if player.y != 59 || player.x == column {
        None
    } else if player.x < column {
        Some(InputMask::RIGHT)
    } else {
        Some(InputMask::LEFT)
    }
}

/// COV-04 and COV-06: the swap on the rail, and a minion's hit absorbed by the shield.
fn minion_meetings() -> Result<Vec<GameCase>, String> {
    let level = with_border_minion(calm((25, 10)));
    let level_header = header(&level, super::journal::header().run_nonce);
    let swap = record(
        &level,
        &level_header,
        until_hit(|game| {
            if minion_pos(game, 0) == Some(at(game.player.pos.x + 1, 59)) {
                InputMask::RIGHT
            } else {
                InputMask::NONE
            }
        }),
    )?;
    check(
        "swap-collision",
        swap.ticks().any(|(before, _, after)| {
            lost_a_life(before, after)
                && (before.player.pos, after.player.pos) == (at(30, 59), at(31, 59))
                && (minion_pos(before, 0), minion_pos(after, 0))
                    == (Some(at(31, 59)), Some(at(30, 59)))
        }),
        "swaps cells with the minion on the rail",
    )?;

    let shield = record(
        &level,
        &level_header,
        script(&[(InputMask::B, 12)], InputMask::X),
    )?;
    check(
        "shield-absorbs-a-hit",
        shield.ticks().any(|(before, _, after)| {
            (before.player.shield, after.player.shield) == (1, 0)
                && after.player.lives == before.player.lives
        }) && shield.states[1].player.press_tick == 0,
        "spends the shield charge on a minion's hit, with B held from tick 0",
    )?;
    Ok(vec![
        recorded(
            "swap-collision",
            &[
                "§4.9", "R4.9-4", "R4.9-6", "R4.9-7", "R4.9-8", "R4.9-10", "R4.7-1", "R4.7-10",
                "R4.4-10", "PIN-15", "COV-04",
            ],
            &level,
            level_header,
            swap,
            EndReason::Committed,
        )?,
        recorded(
            "shield-absorbs-a-hit",
            &["§4.9", "R4.9-9", "R4.9-13", "R4.9-15", "PIN-03", "COV-06"],
            &level,
            level_header,
            shield,
            EndReason::Committed,
        )?,
    ])
}

/// COV-09: a step onto the boss's body and a minion's share on the same tick, plain, with B
/// held and a charge left, and while invulnerable. The boss's body must rest on the bottom row
/// over (30, 58) after tick 0, which the run nonce decides.
fn several_hits() -> Result<Vec<GameCase>, String> {
    let level = with_border_minion(Level {
        boss_period: 255,
        ..calm((28, 54))
    });
    let both_hits = |before: &Game, after: &Game| {
        in_boss(before, at(30, 58))
            && before.player.pos == PLAYER_START
            && minion_pos(after, 0) == Some(PLAYER_START)
    };
    let variants: [(&str, InputMask, Option<u8>, &[&str]); 3] = [
        (
            "several-hits-one-life",
            InputMask::UP,
            None,
            &["R4.9-5", "R4.9-16", "R4.9-17"],
        ),
        (
            "several-hits-with-shield",
            mask(&[InputMask::UP, InputMask::B]),
            None,
            &["R4.9-5", "R4.9-15"],
        ),
        (
            "several-hits-while-invulnerable",
            InputMask::UP,
            Some(35),
            &["R4.9-5", "R4.9-14", "PIN-02"],
        ),
    ];
    variants
        .into_iter()
        .map(|(name, press, first_hit_at, tags)| {
            let (level_header, run) = first_run(
                name,
                &level,
                || {
                    let mut pressed = 0;
                    Box::new(move |game: &Game| {
                        let minion_x = minion_pos(game, 0).map(|pos| pos.x);
                        let press_at = match (first_hit_at, pressed) {
                            (Some(first), 0) => first,
                            _ => 31,
                        };
                        if pressed == 2 || (pressed == 1 && first_hit_at.is_none()) {
                            InputMask::X
                        } else if minion_x == Some(press_at) {
                            pressed += 1;
                            press
                        } else {
                            InputMask::NONE
                        }
                    })
                },
                |run| {
                    run.ticks().any(|(before, ran, after)| {
                        let lives = after.player.lives.cmp(&before.player.lives);
                        let shield = after.player.shield.cmp(&before.player.shield);
                        ran == press
                            && both_hits(before, after)
                            && match first_hit_at {
                                Some(_) => {
                                    before.player.invulnerable > 0
                                        && lives.is_eq()
                                        && shield.is_eq()
                                }
                                None if press.contains(InputMask::B) => {
                                    lives.is_eq() && shield.is_lt()
                                }
                                None => lives.is_lt() && shield.is_eq(),
                            }
                    })
                },
            )?;
            let covers: Vec<&str> = ["§4.9", "R4.9-1", "R4.9-3", "R4.9-9", "R4.9-13", "COV-09"]
                .into_iter()
                .chain(tags.iter().copied())
                .collect();
            recorded(
                name,
                &covers,
                &level,
                level_header,
                run,
                EndReason::Committed,
            )
        })
        .collect()
}

/// COV-10: a cut that clears the level closes onto the cell a minion is about to share with the
/// last life left, and the clear wins; and the last life lost on tick T − 1 ends the level out of
/// lives, not on time.
fn same_tick_ends() -> Result<Vec<GameCase>, String> {
    let level = with_border_minion(Level {
        lives: 1,
        target_bp: 1,
        ..calm((25, 10))
    });
    let level_header = header(&level, super::journal::header().run_nonce);
    let mut presses = [InputMask::UP, InputMask::RIGHT, InputMask::DOWN].into_iter();
    let mut started = false;
    let clear = record(&level, &level_header, move |game| {
        started |= minion_pos(game, 0) == Some(at(34, 59));
        if started {
            presses.next().unwrap_or(game.mask)
        } else {
            InputMask::NONE
        }
    })?;
    let last = clear.last();
    let minion_would_share = last.minions.slots[0].is_some_and(|minion| match minion.state {
        State::Live { pos, heading } => {
            right_hand_step(&last.grid, pos, heading).0 == last.player.pos
        }
        State::Destroyed { .. } => false,
    });
    check(
        "clear-and-last-life",
        minion_would_share && last.player.lives == 1,
        "clears on the tick a minion would take the last life",
    )?;

    let timed = with_border_minion(Level {
        lives: 1,
        time_limit: 10,
        ..calm((25, 10))
    });
    let timed_header = header(&timed, super::journal::header().run_nonce);
    let last_tick = record(&timed, &timed_header, |_| InputMask::NONE)?;
    check(
        "last-life-on-last-tick",
        last_tick.last().ticks_used == 10,
        "loses the last life on tick T − 1",
    )?;
    Ok(vec![
        recorded(
            "clear-and-last-life",
            &[
                "§4.10", "R4.10-1", "R4.4-4", "R4.4-8", "PIN-09", "PIN-10", "COV-10",
            ],
            &level,
            level_header,
            clear,
            EndReason::Cleared,
        )?,
        recorded(
            "last-life-on-last-tick",
            &[
                "§4.10", "R4.10-1", "R4.10-3", "R4.4-11", "R4.4-12", "R4.9-16", "COV-10",
            ],
            &timed,
            timed_header,
            last_tick,
            EndReason::OutOfLives,
        )?,
    ])
}

/// COV-07: two cuts capture the bottom rows on both sides of (30, 59), which leaves the rail; a
/// third cut from the left border runs into the boss's body, and the player respawns at that
/// cut's start.
fn respawn_after_bottom_captured() -> Result<GameCase, String> {
    let name = "respawn-after-bottom-captured";
    let level = calm((40, 20));
    let level_header = header(&level, super::journal::header().run_nonce);
    let mut captures = 0;
    let mut captured = 0;
    let run = record(
        &level,
        &level_header,
        until_hit(move |game: &Game| {
            if game.captured > captured {
                captures += 1;
                captured = game.captured;
            }
            let (player, boss) = (game.player.pos, game.boss.pos);
            match captures {
                0 if player.y > 56 => InputMask::UP,
                0 => InputMask::RIGHT,
                1 => InputMask::LEFT,
                _ if player.x == 0 && player.y > boss.y + 2 => InputMask::UP,
                _ => InputMask::RIGHT,
            }
        }),
    )?;
    check(
        name,
        run.ticks().any(|(before, _, after)| {
            lost_a_life(before, after)
                && before.player.cutting
                && after.player.pos == before.player.cut_start
                && !after.grid.is_rail(PLAYER_START)
        }),
        "respawns at the cut start once (30, 59) is off the rail",
    )?;
    recorded(
        name,
        &["§4.9", "R4.9-3", "R4.9-17", "R4.2-1", "COV-07"],
        &level,
        level_header,
        run,
        EndReason::Committed,
    )
}

/// A capture strands a minion: it is destroyed, and R − 1 ticks later it respawns at the first
/// rail cell in row-major order, (0, 0), since its spawn is off the rail too.
fn minion_stranded_respawns() -> Result<GameCase, String> {
    let name = "minion-stranded-respawns";
    let level = Level {
        minion_period: 255,
        respawn_delay: 20,
        ..with_minions(calm((25, 10)), &[(41, 59)])
    };
    let level_header = header(&level, super::journal::header().run_nonce);
    let steps = [
        (InputMask::UP, 3),
        (InputMask::RIGHT, 29),
        (InputMask::NONE, 25),
    ];
    let run = record(&level, &level_header, script(&steps, InputMask::X))?;
    let destroyed_at = run
        .ticks()
        .position(|(before, _, after)| {
            minion_pos(before, 0).is_some() && minion_pos(after, 0).is_none()
        })
        .ok_or(format!(
            "game {name}: the run no longer destroys the minion"
        ))?;
    let respawn_tick = destroyed_at + usize::from(level.respawn_delay) - 1;
    check(
        name,
        minion_pos(&run.states[respawn_tick], 0).is_none()
            && minion_pos(&run.states[respawn_tick + 1], 0) == Some(at(0, 0)),
        "respawns at (0, 0) at step 5 of tick t + R − 1",
    )?;
    recorded(
        name,
        &[
            "§4.7", "R4.7-7", "R4.7-8", "R4.7-9", "R4.7-11", "R4.4-10", "PIN-16", "PIN-17",
            "R4.3-5",
        ],
        &level,
        level_header,
        run,
        EndReason::Committed,
    )
}

/// The boss, moving every tick, bumps into the trail of a cut going straight up.
fn boss_bumps_trail() -> Result<GameCase, String> {
    let name = "boss-bumps-trail";
    let level = Level {
        boss_period: 1,
        spawn: jiro_core::level::Rect {
            x0: 20,
            y0: 35,
            x1: 34,
            y1: 45,
        },
        ..open_field()
    };
    let (level_header, run) = first_run(
        name,
        &level,
        || {
            Box::new(until_hit(|game: &Game| {
                if game.ticks_used > 200 {
                    InputMask::X
                } else {
                    InputMask::UP
                }
            }))
        },
        |run| {
            run.ticks().any(|(before, ran, after)| {
                let target = neighbor(before.player.pos, Dir::Up);
                lost_a_life(before, after)
                    && before.player.cutting
                    && ran == InputMask::UP
                    && target.is_some_and(|cell| !in_boss(before, cell))
            })
        },
    )?;
    recorded(
        name,
        &[
            "§4.6", "R4.6-3", "R4.9-2", "R4.4-9", "R4.4-11", "R4.9-17", "PIN-02",
        ],
        &level,
        level_header,
        run,
        EndReason::Committed,
    )
}
