//! A xorshift64 generator and random play, in-repo so that seeded runs add no dependency.

use jiro_core::game::Game;
use jiro_core::types::{Dir, InputMask};

/// A xorshift64 generator for scripted randomness.
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Self(seed.wrapping_mul(0x9e37_79b9_7f4a_7c15) | 1)
    }

    pub fn next_u64(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    /// A number below `bound`.
    pub fn below(&mut self, bound: u64) -> u64 {
        self.next_u64() % bound
    }

    /// A number in `low..=high`.
    pub fn range(&mut self, low: u8, high: u8) -> u8 {
        low + (self.next_u64() % u64::from(high - low + 1)) as u8
    }

    /// True with probability 1 / `odds`.
    pub fn one_in(&mut self, odds: u64) -> bool {
        self.next_u64().is_multiple_of(odds)
    }

    pub fn shuffled(&mut self, mut dirs: [Dir; 4]) -> [Dir; 4] {
        for i in (1..4).rev() {
            dirs.swap(i, (self.next_u64() % (i as u64 + 1)) as usize);
        }
        dirs
    }
}

/// Random masks: a new mask on about one tick in `hold`, with each direction bit set at
/// random, A and B (with `all_bits`) set one time in three, and X one time in `commit_odds`.
pub fn random_play(
    seed: u64,
    hold: u64,
    commit_odds: u64,
    all_bits: bool,
) -> impl FnMut(&Game) -> InputMask {
    let mut rng = Rng::new(seed);
    move |game| {
        if game.ticks_used > 0 && !rng.one_in(hold) {
            return game.mask;
        }
        let mut bits = (rng.next_u64() & 0x0f) as u8;
        if all_bits {
            if rng.one_in(3) {
                bits |= InputMask::A.bits();
            }
            if rng.one_in(3) {
                bits |= InputMask::B.bits();
            }
        }
        if rng.one_in(commit_odds) {
            bits |= InputMask::X.bits();
        }
        InputMask::new(bits).expect("bit 7 clear")
    }
}
