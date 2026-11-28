use jiro_core::level::{BossRecord, Level, Rect, decode};

use super::*;

/// Level 1 with a second boss of B = 4, both bosses parked (period 255) at `first` and `second`.
fn parked(first: Pos, second: Pos) -> Game {
    let bytes = std::fs::read(crate::repo_root().join("levels/01-open.bin")).expect("L01");
    let rect = |pos: Pos| Rect {
        x0: pos.x,
        y0: pos.y,
        x1: pos.x,
        y1: pos.y,
    };
    let level = Level {
        spawn: rect(first),
        boss_period: 255,
        second_boss: Some(BossRecord {
            size: 4,
            spawn: rect(second),
            period: 255,
        }),
        ..decode(&bytes).expect("decode")
    };
    Game::new(&level, &[1; 32], 0).expect("game")
}

fn at(x: u8, y: u8) -> Pos {
    Pos { x, y }
}

/// With a boss on each half, the blind cut up the middle column separates them.
#[test]
fn a_blind_middle_cut_splits_bosses_on_either_half() {
    let seed = openings(&parked(at(5, 20), at(48, 20)));
    assert!(seed.blind_split);
}

/// With both bosses on the left, the blind line up column 40 captures the right side.
#[test]
fn a_blind_line_captures_the_side_without_bosses() {
    let game = parked(at(3, 10), at(3, 40));
    let (_, line) = plans(&game)
        .into_iter()
        .find(|(name, _)| name == "column 40 up")
        .expect("column 40");
    let end = run_plan(&game, &line, Timing::Blind);
    assert!(end.split_at.is_none() && end.claim_bp >= LARGE_BP);
}

/// A blind plan that walks into a boss's body does not close.
#[test]
fn a_blind_column_through_a_boss_does_not_close() {
    let game = parked(at(28, 50), at(3, 10));
    let plan = vec![
        Segment {
            start: Some(at(30, 59)),
            dir: Dir::Up,
        };
        1
    ];
    assert_eq!(
        run_plan(&game, &plan, Timing::Blind),
        End {
            split_at: None,
            claim_bp: 0
        }
    );
}
