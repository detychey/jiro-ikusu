//! A level in play (README §4.4, §4.9, §4.10): the hit sources, the minion hit predicate of
//! PIN-15, the resolution of hits at step 6, and the end conditions that `Game::step` reaches.
//! Each test arranges the state directly, starting at tick 1 with the boss parked, so that only
//! the arranged pieces move.

use jiro_core::boss::deflection_draw;
use jiro_core::consts::WORK_BUDGET;
use jiro_core::game::{EndReason, Game};
use jiro_core::level::{BossRecord, Level, Rect};
use jiro_core::minion::{Minion, State};
use jiro_core::types::{Cell, CellIndex, Dir, InputMask, Pos};

fn level(obstacles: &[(u8, u8)]) -> Level {
    let mut level = Level {
        obstacles: [0; 450],
        boss_size: 5,
        spawn: Rect {
            x0: 20,
            y0: 20,
            x1: 34,
            y1: 34,
        },
        boss_period: 2,
        minion_count: 0,
        minion_spawns: [Pos { x: 0, y: 0 }; 3],
        minion_period: 0,
        respawn_delay: 0,
        time_limit: 2_700,
        lives: 3,
        target_bp: 7_500,
        second_boss: None,
    };
    for &(x, y) in obstacles {
        let cell = usize::from(y) * 60 + usize::from(x);
        level.obstacles[cell / 8] |= 0x80 >> (cell % 8);
    }
    level
}

/// The level at tick 1, with the boss parked at (40, 10): its period of 255 keeps it still
/// until tick 255.
fn game_on(level: &Level) -> Game {
    let mut game = Game::new(level, &[7; 32], 0).unwrap();
    game.ticks_used = 1;
    game.bosses.first.pos = at(40, 10);
    game.bosses.first.period = 255;
    game
}

fn game() -> Game {
    game_on(&level(&[]))
}

fn at(x: u8, y: u8) -> Pos {
    Pos { x, y }
}

fn paint(game: &mut Game, cells: &[(u8, u8)], cell: Cell) {
    for &(x, y) in cells {
        game.grid.set(CellIndex::new(at(x, y)).unwrap(), cell);
    }
}

/// The player cutting at `pos`, from `cut_start`, along `trail`.
fn cutting(game: &mut Game, pos: Pos, cut_start: Pos, trail: &[(u8, u8)]) {
    paint(game, trail, Cell::Trail);
    game.player.pos = pos;
    game.player.cut_start = cut_start;
    game.player.cutting = true;
}

/// A live minion in `slot` at `pos`, facing `heading`, moving every tick from tick 1 on, or
/// never when `period` is 255.
fn minion(game: &mut Game, slot: usize, pos: Pos, heading: Dir, period: u8) {
    game.minions.period = period;
    game.minions.slots[slot] = Some(Minion {
        spawn: pos,
        state: State::Live { pos, heading },
    });
}

/// The boss moving at every tick toward −x and −y from `pos`, with a deflection key that draws
/// no deflection on ticks 1 to 40.
fn boss_moving(game: &mut Game, pos: Pos) {
    game.bosses.first.pos = pos;
    game.bosses.first.period = 1;
    (game.bosses.first.vx, game.bosses.first.vy) = (-1, -1);
    game.bosses.first.deflection_key = (0..)
        .find(|&key| (1..=40).all(|tick| deflection_draw(key, tick) >= 2))
        .unwrap();
}

fn lives_after(game: &mut Game, masks: &[InputMask]) -> u8 {
    for &mask in masks {
        game.step(mask).unwrap();
    }
    game.player.lives
}

/// [R4.9-2] [R4.4-9] The boss's leading edge on x reaches the trail the player just laid.
#[test]
fn boss_bumping_into_the_trail_hits() {
    let mut game = game();
    boss_moving(&mut game, at(31, 54));
    assert_eq!(lives_after(&mut game, &[InputMask::UP]), 2);
}

/// [R4.9-3] A step onto the boss's body is a hit, and the player stays.
#[test]
fn step_onto_the_boss_body_hits_and_does_not_move() {
    let mut game = game();
    game.bosses.first.pos = at(28, 54);
    let lives = lives_after(&mut game, &[InputMask::UP]);
    assert_eq!((lives, game.player.pos), (2, at(30, 59)));
}

/// [R4.9-4] A minion walking onto a player who stands still hits.
#[test]
fn minion_walking_onto_the_player_hits() {
    let mut game = game();
    minion(&mut game, 0, at(31, 59), Dir::Left, 1);
    assert_eq!(lives_after(&mut game, &[InputMask::NONE]), 2);
}

/// [R4.9-9] Share: the minion ends on Pn, the cell the player moved into.
#[test]
fn minion_ending_on_the_players_new_cell_hits() {
    let mut game = game();
    minion(&mut game, 0, at(32, 59), Dir::Left, 1);
    assert_eq!(lives_after(&mut game, &[InputMask::RIGHT]), 2);
}

/// [R4.9-10] Swap on the rail: the player moves from (30, 59) to (31, 59) as the minion moves
/// from (31, 59) to (30, 59).
#[test]
fn minion_swapping_cells_with_the_player_on_the_rail_hits() {
    let mut game = game();
    minion(&mut game, 0, at(31, 59), Dir::Left, 1);
    assert_eq!(lives_after(&mut game, &[InputMask::RIGHT]), 2);
}

/// [R4.9-10] Swap at a fast-cut close: the cut closes onto (31, 59), where the minion stands,
/// and after the capture the minion, oriented W, turns right onto the captured trail cell
/// (31, 58) the player left.
#[test]
fn minion_swapping_cells_at_a_fast_cut_close_hits() {
    let mut game = game();
    cutting(&mut game, at(31, 58), at(30, 59), &[(30, 58), (31, 58)]);
    minion(&mut game, 0, at(31, 59), Dir::Up, 1);
    let lives = lives_after(&mut game, &[InputMask::DOWN]);
    assert_eq!((lives, game.captured), (2, 2));
}

/// [R4.9-11] Pass: the fast cut passes through (31, 58) and closes onto (31, 59); after the
/// capture, the minion on the obstacle (32, 58) steps W onto (31, 58).
#[test]
fn minion_stopping_on_the_cell_a_fast_cut_passed_through_hits() {
    let mut game = game_on(&level(&[(32, 58)]));
    cutting(
        &mut game,
        at(31, 57),
        at(30, 59),
        &[(30, 58), (30, 57), (31, 57)],
    );
    minion(&mut game, 0, at(32, 58), Dir::Up, 1);
    let lives = lives_after(&mut game, &[InputMask::DOWN]);
    assert_eq!((lives, game.captured), (2, 4));
}

/// [R4.9-12] The player moves from (30, 59) to (31, 59), and a minion moves into (30, 59)
/// from (29, 59), not from (31, 59): no hit.
#[test]
fn minion_moving_into_the_cell_the_player_left_does_not_hit() {
    let mut game = game();
    minion(&mut game, 0, at(29, 59), Dir::Right, 1);
    assert_eq!(lives_after(&mut game, &[InputMask::RIGHT]), 3);
}

/// [PIN-11] A minion respawning at step 5 onto the player's cell hits, by the share case.
#[test]
fn minion_respawning_onto_the_player_hits() {
    let mut game = game();
    game.minions.period = 1;
    game.minions.slots[0] = Some(Minion {
        spawn: at(30, 59),
        state: State::Destroyed { countdown: 1 },
    });
    assert_eq!(lives_after(&mut game, &[InputMask::NONE]), 2);
}

/// [R4.9-5] A step onto the boss's body and two minions sharing the player's cell: one life.
#[test]
fn three_hits_in_one_tick_cost_one_life() {
    let mut game = game();
    game.bosses.first.pos = at(28, 54);
    minion(&mut game, 0, at(29, 59), Dir::Right, 1);
    minion(&mut game, 1, at(31, 59), Dir::Left, 1);
    assert_eq!(lives_after(&mut game, &[InputMask::UP]), 2);
}

/// [R4.9-14] An invulnerable player ignores a hit, and invulnerability counts down.
#[test]
fn hit_while_invulnerable_does_nothing() {
    let mut game = game();
    game.player.invulnerable = 5;
    minion(&mut game, 0, at(31, 59), Dir::Left, 1);
    game.step(InputMask::NONE).unwrap();
    let player = game.player;
    assert_eq!((player.lives, player.invulnerable), (3, 4));
}

/// A minion that never moves shares the player's cell on every tick from tick 1 on, so tick 1
/// is the hit tick h.
fn game_hit_every_tick() -> Game {
    let mut game = game();
    minion(&mut game, 0, at(30, 59), Dir::Left, 255);
    game
}

/// [PIN-02] A life lost at tick h protects ticks h + 1 to h + 30: tick h + 30 is protected.
#[test]
fn tick_h_plus_30_is_protected() {
    let mut game = game_hit_every_tick();
    assert_eq!(lives_after(&mut game, &[InputMask::NONE; 31]), 2);
}

/// [PIN-02] Tick h + 31 is not protected.
#[test]
fn tick_h_plus_31_is_not_protected() {
    let mut game = game_hit_every_tick();
    assert_eq!(lives_after(&mut game, &[InputMask::NONE; 32]), 1);
}

/// [PIN-02] [R4.9-17] Starting a cut ends invulnerability at step 3, before that tick's
/// collisions: the boss's bump into the new trail costs a life.
#[test]
fn starting_a_cut_ends_invulnerability() {
    let mut game = game();
    game.player.invulnerable = 10;
    boss_moving(&mut game, at(31, 54));
    assert_eq!(lives_after(&mut game, &[InputMask::UP]), 2);
}

/// [R4.9-17] After a capture along the bottom border, (30, 59) is off the rail; a hit during a
/// cut returns the player to the cut start (30, 50), and the trail is erased.
#[test]
fn player_respawns_at_the_cut_start_after_the_bottom_border_was_captured() {
    let mut game = game();
    let captured: Vec<(u8, u8)> = (1..59)
        .flat_map(|x| (50..59).map(move |y| (x, y)))
        .collect();
    paint(&mut game, &captured, Cell::Claimed);
    game.player.pos = at(30, 50);
    boss_moving(&mut game, at(31, 45));
    game.step(InputMask::UP).unwrap();
    let respawned = (game.player.lives, game.player.pos, game.player.cutting);
    assert_eq!(respawned, (2, at(30, 50), false));
    assert_eq!(game.grid.count(Cell::Trail), 0);
}

/// [R4.4-7] [R4.10-2] X during a cut ends the level as committed: the trail is erased, the
/// player returns to the cut start, and nothing is captured.
#[test]
fn x_during_a_cut_erases_the_trail_and_keeps_the_claim() {
    let mut game = game();
    game.captured = 100;
    cutting(&mut game, at(30, 57), at(30, 59), &[(30, 58), (30, 57)]);
    let end = game.step(InputMask::X).unwrap();
    let after = (
        end,
        game.player.pos,
        game.grid.count(Cell::Trail),
        game.captured,
    );
    assert_eq!(after, (Some(EndReason::Committed), at(30, 59), 0, 100));
}

/// [PIN-09] A clear wins the tick: the cut that reaches the target closes onto the cell where
/// a minion stands, with the last life left, and the level ends cleared at step 3.
#[test]
fn clear_and_last_life_lost_on_the_same_tick_end_the_level_as_cleared() {
    let mut level = level(&[]);
    level.target_bp = 1;
    let mut game = game_on(&level);
    game.player.lives = 1;
    cutting(&mut game, at(31, 58), at(30, 59), &[(30, 58), (31, 58)]);
    minion(&mut game, 0, at(31, 59), Dir::Up, 255);
    let end = game.step(InputMask::DOWN).unwrap();
    assert_eq!(end, Some(EndReason::Cleared));
}

/// [R4.10-3] Losing the last life ends the level at step 6.
#[test]
fn losing_the_last_life_ends_the_level() {
    let mut game = game();
    game.player.lives = 1;
    minion(&mut game, 0, at(31, 59), Dir::Left, 1);
    assert_eq!(
        game.step(InputMask::NONE).unwrap(),
        Some(EndReason::OutOfLives)
    );
}

/// [R4.4-4] An ended level does not change.
#[test]
fn ended_level_does_not_change() {
    let mut game = game();
    game.step(InputMask::X).unwrap();
    let ticks_used = game.ticks_used;
    let end = game.step(InputMask::UP).unwrap();
    assert_eq!(
        (end, game.ticks_used),
        (Some(EndReason::Committed), ticks_used)
    );
}

/// [R4.10-3] A lost life that leaves lives keeps the level running.
#[test]
fn losing_a_life_with_lives_left_keeps_the_level_running() {
    let mut game = game();
    game.player.lives = 2;
    minion(&mut game, 0, at(31, 59), Dir::Left, 1);
    let end = game.step(InputMask::NONE).unwrap();
    assert_eq!((end, game.player.lives), (None, 1));
}

/// [R4.9-9] Share with two sub-steps: the fast cut passes (31, 58) and closes onto (31, 59),
/// where a minion stands still; it shares Pn = P2.
#[test]
fn minion_on_the_cell_a_fast_cut_closes_onto_hits() {
    let mut game = game();
    cutting(
        &mut game,
        at(31, 57),
        at(30, 59),
        &[(30, 58), (30, 57), (31, 57)],
    );
    minion(&mut game, 0, at(31, 59), Dir::Up, 255);
    let lives = lives_after(&mut game, &[InputMask::DOWN]);
    assert_eq!((lives, game.captured), (2, 4));
}

/// [PIN-10] A claim exactly at the target clears: 2 of 3,364 cells is 5 bp.
#[test]
fn claim_exactly_at_the_target_clears_the_level() {
    let mut level = level(&[]);
    level.target_bp = 5;
    let mut game = game_on(&level);
    cutting(&mut game, at(31, 58), at(30, 59), &[(30, 58), (31, 58)]);
    let end = game.step(InputMask::DOWN).unwrap();
    assert_eq!(
        (end, game.claim_bp().unwrap()),
        (Some(EndReason::Cleared), 5)
    );
}

/// [R4.1-8] Captures add up: 2 cells captured on top of 100.
#[test]
fn captured_cells_add_up_across_captures() {
    let mut game = game();
    game.captured = 100;
    cutting(&mut game, at(31, 58), at(30, 59), &[(30, 58), (31, 58)]);
    game.step(InputMask::DOWN).unwrap();
    assert_eq!(game.captured, 102);
}

/// The player cutting at (31, 58) from (30, 59): a step down closes a cut of 2 cells, whose
/// fill marks the other 3,362 interior cells `BOSS_ZONE`.
fn closing_a_two_cell_cut(game: &mut Game) {
    cutting(game, at(31, 58), at(30, 59), &[(30, 58), (31, 58)]);
}

/// [R4.11-1] [R4.11-2] A capture adds 150 and its `BOSS_ZONE` cells to the level's work.
#[test]
fn capture_adds_its_work() {
    let mut game = game();
    game.work = 1_000;
    closing_a_two_cell_cut(&mut game);
    game.step(InputMask::DOWN).unwrap();
    assert_eq!(game.work, 1_000 + 150 + 3_362);
}

/// [R4.11-3] A respawn on its spawn cell, a rail cell, tests 1 cell.
#[test]
fn respawn_on_its_spawn_cell_adds_1() {
    let mut game = game();
    game.minions.period = 1;
    game.minions.slots[0] = Some(Minion {
        spawn: at(10, 59),
        state: State::Destroyed { countdown: 1 },
    });
    game.step(InputMask::NONE).unwrap();
    assert_eq!(game.work, 1);
}

/// [R4.11-3] A respawn whose spawn (5, 5) is off the rail tests it, then the row-major search up
/// to (0, 9), the first rail cell once rows 1 to 9 are claimed: cell 540, the 541st tested.
#[test]
fn respawn_off_its_spawn_cell_adds_the_cells_searched() {
    let mut game = game();
    let claimed: Vec<(u8, u8)> = (1..10).flat_map(|y| (1..59).map(move |x| (x, y))).collect();
    paint(&mut game, &claimed, Cell::Claimed);
    game.minions.period = 1;
    game.minions.slots[0] = Some(Minion {
        spawn: at(5, 5),
        state: State::Destroyed { countdown: 1 },
    });
    game.step(InputMask::NONE).unwrap();
    let respawned = game.minions.slots[0].map(|minion| minion.state);
    assert!(matches!(respawned, Some(State::Live { pos, .. }) if pos == at(0, 9)));
    assert_eq!(game.work, 1 + 541);
}

/// [R4.11-4] [R4.4-12] [R4.10-5] Work that reaches the budget ends the level at step 7, claim
/// kept.
#[test]
fn work_reaching_the_budget_ends_the_level() {
    let mut game = game();
    game.work = WORK_BUDGET - 1;
    closing_a_two_cell_cut(&mut game);
    let end = game.step(InputMask::DOWN).unwrap();
    assert_eq!((end, game.captured), (Some(EndReason::WorkBudget), 2));
}

/// [R4.11-4] Work below the budget keeps the level running.
#[test]
fn work_below_the_budget_keeps_the_level_running() {
    let mut game = game();
    game.work = WORK_BUDGET - 150 - 3_362 - 1;
    closing_a_two_cell_cut(&mut game);
    assert_eq!(game.step(InputMask::DOWN).unwrap(), None);
}

/// [R4.11-4] A clear at step 3 wins over the work budget.
#[test]
fn clear_wins_over_the_work_budget() {
    let mut level = level(&[]);
    level.target_bp = 1;
    let mut game = game_on(&level);
    game.work = WORK_BUDGET - 1;
    closing_a_two_cell_cut(&mut game);
    let end = game.step(InputMask::DOWN).unwrap();
    assert_eq!(end, Some(EndReason::Cleared));
}

/// [R4.11-4] [R4.10-4] On the last tick, the time limit wins over the work budget.
#[test]
fn time_limit_wins_over_the_work_budget() {
    let mut level = level(&[]);
    level.time_limit = 2;
    let mut game = game_on(&level);
    game.work = WORK_BUDGET;
    assert_eq!(
        game.step(InputMask::NONE).unwrap(),
        Some(EndReason::TimeLimit)
    );
}

/// The open field with a second boss parked at `second`, B = 4: both bosses still until tick 255.
fn twin_game(second: Pos) -> Game {
    let level = Level {
        second_boss: Some(BossRecord {
            size: 4,
            spawn: Rect {
                x0: 40,
                y0: 40,
                x1: 50,
                y1: 50,
            },
            period: 3,
        }),
        ..level(&[])
    };
    let mut game = game_on(&level);
    let boss = game.bosses.second.as_mut().unwrap();
    boss.pos = second;
    boss.period = 255;
    game
}

/// The player at (30, 1), cutting a wall from (30, 58) up to it: a step up closes the cut.
fn wall_at_x_30(game: &mut Game) {
    let wall: Vec<(u8, u8)> = (1..59).map(|y| (30, y)).collect();
    cutting(game, at(30, 1), at(30, 59), &wall);
}

/// [R4.8-5] [R4.8-6] A capture that leaves the bosses on either side of a wall separates them,
/// but its claim of 172 bp is under the floor of 3,750 bp: both sides stay open, and the level
/// goes on with the claim of the 58 trail cells.
#[test]
fn separating_the_bosses_under_the_floor_does_not_clear() {
    let mut game = twin_game(at(10, 10));
    wall_at_x_30(&mut game);
    let end = game.step(InputMask::UP).unwrap();
    assert_eq!(
        (end, game.captured, game.claim_bp().unwrap(), game.separated),
        (None, 58, 172, true)
    );
}

/// [R4.8-6] With a target of 344 bp, the floor is 172 bp, which the separating capture's claim
/// reaches: the level is cleared at step 3, with the claim raised to the target.
#[test]
fn separating_the_bosses_at_the_floor_clears_at_the_target() {
    let mut game = twin_game(at(10, 10));
    game.target_bp = 344;
    wall_at_x_30(&mut game);
    let end = game.step(InputMask::UP).unwrap();
    assert_eq!(
        (end, game.claim_bp().unwrap()),
        (Some(EndReason::Cleared), 344)
    );
}

/// [R4.8-6] With a target of 347 bp, the floor is 173 bp, one above the separating capture's
/// claim: the level goes on.
#[test]
fn separating_the_bosses_one_under_the_floor_does_not_clear() {
    let mut game = twin_game(at(10, 10));
    game.target_bp = 347;
    wall_at_x_30(&mut game);
    let end = game.step(InputMask::UP).unwrap();
    assert_eq!((end, game.claim_bp().unwrap()), (None, 172));
}

/// [R4.8-5] [R4.8-6] The bosses stay apart, so a later capture that brings the claim to the floor
/// clears the level: a wall at y = 16 left of x = 30 takes the 1,247 cells below it, boss 1 above
/// it, for 3,879 bp, raised to the target.
#[test]
fn a_later_capture_reaching_the_floor_clears_with_the_bosses_apart() {
    let mut game = twin_game(at(10, 10));
    wall_at_x_30(&mut game);
    game.step(InputMask::UP).unwrap();
    let wall: Vec<(u8, u8)> = (1..30).map(|x| (x, 16)).collect();
    cutting(&mut game, at(1, 16), at(30, 16), &wall);
    let end = game.step(InputMask::LEFT).unwrap();
    assert_eq!(
        (end, game.captured, game.claim_bp().unwrap(), game.separated),
        (Some(EndReason::Cleared), 58 + 1_247, 7_500, true)
    );
}

/// [R4.8-5] [R4.11-2] The separating capture fills from both bodies, and its work counts both
/// fills: every interior cell but the 58 of the wall.
#[test]
fn a_separating_capture_counts_both_fills() {
    let mut game = twin_game(at(10, 10));
    wall_at_x_30(&mut game);
    game.step(InputMask::UP).unwrap();
    assert_eq!(game.work, 150 + 3_364 - 58);
}

/// [R4.8-6] Separation raises the claim to the target, never lowers it: with a target of 5 bp,
/// the floor is 2 bp, and the claim stays 172 bp.
#[test]
fn separation_keeps_a_claim_above_the_target() {
    let mut game = twin_game(at(10, 10));
    game.target_bp = 5;
    wall_at_x_30(&mut game);
    let end = game.step(InputMask::UP).unwrap();
    assert_eq!(
        (end, game.claim_bp().unwrap()),
        (Some(EndReason::Cleared), 172)
    );
}

/// [R4.8-2] [R4.8-5] With both bosses right of the wall, the capture takes the left side, and the
/// level goes on.
#[test]
fn a_capture_that_keeps_the_bosses_together_does_not_clear() {
    let mut game = twin_game(at(45, 40));
    wall_at_x_30(&mut game);
    let end = game.step(InputMask::UP).unwrap();
    assert_eq!(
        (end, game.captured, game.separated),
        (None, 29 * 58 + 58, false)
    );
}

/// [R4.9-3] A step onto the second boss's body is a hit, and the player stays.
#[test]
fn step_onto_the_second_boss_body_hits_and_does_not_move() {
    let mut game = twin_game(at(28, 55));
    let lives = lives_after(&mut game, &[InputMask::UP]);
    assert_eq!((lives, game.player.pos), (2, at(30, 59)));
}
