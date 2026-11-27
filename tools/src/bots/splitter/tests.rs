use jiro_core::boss::Boss;
use jiro_core::level::{BossRecord, Level, Rect, decode};

use super::*;

/// Level 1 with a second boss of B = 4, both bosses parked, at `first` and `second`.
fn twin(first: Pos, second: Pos) -> Game {
    let bytes = std::fs::read(crate::repo_root().join("levels/01-open.bin")).expect("L01");
    let level = Level {
        second_boss: Some(BossRecord {
            size: 4,
            spawn: Rect {
                x0: 45,
                y0: 45,
                x1: 45,
                y1: 45,
            },
            period: 255,
        }),
        ..decode(&bytes).expect("decode")
    };
    let mut game = Game::new(&level, &[1; 32], 0).expect("game");
    game.bosses.first.pos = first;
    game.bosses.first.period = 255;
    let parked = |boss: Boss| Boss {
        pos: second,
        ..boss
    };
    game.bosses.second = game.bosses.second.map(parked);
    game
}

fn at(x: u8, y: u8) -> Pos {
    Pos { x, y }
}

/// With a boss on each side of column 30, the cut straight up from (30, 59) separates them.
#[test]
fn splitter_cuts_between_bosses_on_either_side() {
    let game = twin(at(5, 20), at(48, 20));
    assert_eq!(splitting_cut(&game), Some(Dir::Up));
}

/// With both bosses right of column 30, no straight cut from (30, 59) separates them.
#[test]
fn splitter_takes_no_cut_that_keeps_the_bosses_together() {
    let game = twin(at(40, 10), at(48, 40));
    assert_eq!(splitting_cut(&game), None);
}

/// A boss two cells from the cut's column, moving every tick, is within Bold's reach of it for
/// the 30 ticks the cut takes, so the cut is not taken.
#[test]
fn splitter_takes_no_cut_a_boss_can_reach() {
    let mut game = twin(at(24, 20), at(48, 20));
    game.bosses.first.period = 1;
    assert_eq!(splitting_cut(&game), None);
}

/// On a level with one boss, Splitter plays as Bold.
#[test]
fn splitter_plays_bold_with_one_boss() {
    let bytes = std::fs::read(crate::repo_root().join("levels/01-open.bin")).expect("L01");
    let game = Game::new(&decode(&bytes).expect("decode"), &[1; 32], 0).expect("game");
    let (mut splitter, mut bold) = (Splitter::new(7), Greedy::new(7, Caution::BOLD));
    assert_eq!(splitter.mask(&game), bold.mask(&game));
}
