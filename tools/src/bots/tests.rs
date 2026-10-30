use jiro_core::game::{EndReason, Game};
use jiro_core::journal::{Header, Mode};
use jiro_core::level::{Level, decode, encode, level_id};

use super::*;
use crate::scenarios::play::play;

fn l01() -> Level {
    let bytes = std::fs::read(crate::repo_root().join("levels/01-open.bin")).expect("L01");
    decode(&bytes).expect("decode")
}

fn header(level: &Level, k: u8) -> Header {
    Header {
        mode: Mode::Training,
        run_nonce: [k; 32],
        level_id: level_id(&encode(level)),
        level_index: 0,
    }
}

#[test]
fn greedy_clears_the_open_field_level() {
    let level = l01();
    for k in 0..10 {
        let recorder = play(
            &level,
            &header(&level, k),
            Policy::Greedy.bot(u64::from(k)),
            |_| {},
        )
        .expect("play");
        assert_eq!(recorder.game().end, Some(EndReason::Cleared), "run {k}");
    }
}

#[test]
fn committer_banks_once_a_lost_life_leaves_its_last() {
    let level = l01();
    let mut game = Game::new(&level, &[1; 32], 0).expect("game");
    let mut bot = Policy::Committer.bot(1);
    assert_ne!(bot(&game), InputMask::X);
    game.player.lives = 1;
    assert_eq!(bot(&game), InputMask::X);
}

#[test]
fn committer_plays_on_a_level_that_starts_with_one_life() {
    let level = Level { lives: 1, ..l01() };
    let game = Game::new(&level, &[1; 32], 0).expect("game");
    assert_ne!(Policy::Committer.bot(1)(&game), InputMask::X);
}

#[test]
fn every_policy_parses_from_its_name() {
    for policy in Policy::ALL {
        assert_eq!(Policy::parse(policy.name()), Ok(policy));
    }
}
