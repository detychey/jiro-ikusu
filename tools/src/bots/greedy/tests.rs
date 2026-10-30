use jiro_core::level::{Level, decode};
use jiro_core::minion::{Minion, State};

use super::*;

fn open_field() -> Game {
    let bytes = std::fs::read(crate::repo_root().join("levels/01-open.bin")).expect("L01");
    let level: Level = decode(&bytes).expect("decode");
    Game::new(&level, &[1; 32], 0).expect("game")
}

fn at(x: u8, y: u8) -> Pos {
    Pos { x, y }
}

/// A cut up from the bottom rail at (30, 59): 5 cells up, then 4 to the left, then back down.
fn cut() -> Cut {
    Cut {
        plan: Plan {
            out: Dir::Up,
            side: Dir::Left,
            start: at(30, 59),
            depth: 5,
            width: 4,
        },
        leg: Leg::Out,
    }
}

/// Where the player stands on the cut, and the mask the cut asks for there.
#[test]
fn a_cut_follows_its_legs_and_holds_a_while_two_cells_are_left() {
    let mut game = open_field();
    game.player.cutting = true;
    let cases = [
        (at(30, 57), mask(&[InputMask::UP, InputMask::A])),
        (at(30, 55), InputMask::UP),
        (at(30, 54), mask(&[InputMask::LEFT, InputMask::A])),
        (at(27, 54), InputMask::LEFT),
        (at(26, 54), mask(&[InputMask::DOWN, InputMask::A])),
        (at(26, 58), InputMask::DOWN),
    ];
    let mut cut = cut();
    for (pos, expected) in cases {
        game.player.pos = pos;
        assert_eq!(cut.mask(&game), expected, "{pos:?}");
    }
}

#[test]
fn a_cut_never_returns_to_an_earlier_leg() {
    let mut game = open_field();
    game.player.cutting = true;
    let mut cut = cut();
    game.player.pos = at(26, 54);
    cut.mask(&game);
    game.player.pos = at(26, 56);
    assert_eq!(cut.mask(&game), mask(&[InputMask::DOWN, InputMask::A]));
}

/// With the boss in the top-left corner, Greedy cuts the largest rectangle it may: up from the
/// bottom rail and to the right, away from the boss.
#[test]
fn greedy_cuts_the_largest_safe_rectangle() {
    let mut game = open_field();
    game.boss.pos = at(1, 1);
    let plan = best_cut(&game, Caution::CAREFUL).expect("a cut");
    assert_eq!(
        (plan.out, plan.side, plan.depth, plan.width),
        (Dir::Up, Dir::Right, 57, 23)
    );
}

/// On L01's start, with its boss at (20, 22) moving every third tick, Bold cuts the same
/// rectangle six rows deeper than Greedy.
#[test]
fn bold_cuts_deeper_than_greedy_beside_the_same_boss() {
    let game = open_field();
    let depth = |caution| best_cut(&game, caution).map(|plan| plan.depth);
    assert_eq!(
        (depth(Caution::CAREFUL), depth(Caution::BOLD)),
        (Some(17), Some(23))
    );
}

#[test]
fn greedy_keeps_the_boss_beyond_the_cells_it_can_move() {
    let mut game = open_field();
    game.boss.pos = at(1, 1);
    let plan = best_cut(&game, Caution::CAREFUL).expect("a cut");
    let rectangle = Area::spanned(plan.start, plan.out, plan.side, plan.depth, plan.width)
        .expect("inside the grid");
    let ticks = (2 * i16::from(plan.depth) + i16::from(plan.width)) / 2 + 1;
    let margin = Caution::CAREFUL.margin(ticks, game.boss.period);
    assert!(Area::of_boss(&game.boss).gap(rectangle) >= margin);
}

#[test]
fn greedy_cuts_only_a_one_cell_strip_beside_a_minion() {
    let mut game = open_field();
    game.boss.pos = at(1, 1);
    game.minions.slots[0] = Some(Minion {
        spawn: at(31, 59),
        state: State::Live {
            pos: at(31, 59),
            heading: Dir::Left,
        },
    });
    let plan = best_cut(&game, Caution::CAREFUL).expect("a strip");
    assert_eq!(plan.depth, 1);
}

#[test]
fn an_area_outside_the_grid_is_none() {
    assert!(Area::spanned(at(30, 59), Dir::Down, Dir::Left, 1, 1).is_none());
}

#[test]
fn open_cells_count_the_whole_interior_of_the_open_field() {
    let open = OpenCells::new(&open_field().grid);
    let field = Area {
        x0: 0,
        y0: 0,
        x1: 59,
        y1: 59,
    };
    assert_eq!(open.count(field), 58 * 58);
}
