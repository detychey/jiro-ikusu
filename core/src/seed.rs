//! Derivations from the run nonce (README §6.4, §8.2). keccak256 runs once per level and
//! once per draw step, never per tick.

use core::num::NonZeroU32;

use crate::consts::{RUN_LEVELS, SEASON_LEVELS};
use crate::keccak::keccak256;
use crate::level::Rect;
use crate::types::Pos;

/// The draw step i reduces its hash modulo 16 − i (README §8.2).
const DRAW_MODULI: [NonZeroU32; RUN_LEVELS] = [
    NonZeroU32::new(16).unwrap(),
    NonZeroU32::new(15).unwrap(),
    NonZeroU32::new(14).unwrap(),
    NonZeroU32::new(13).unwrap(),
    NonZeroU32::new(12).unwrap(),
    NonZeroU32::new(11).unwrap(),
];

/// The boss's top-left cell and diagonal direction at level start (R4.6-5).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BossStart {
    pub pos: Pos,
    pub vx: i8,
    pub vy: i8,
}

/// Where a boss's seed material lies in the level seed (README §6.4).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SeedBytes {
    /// The first of the 4 bytes of the start index.
    pub start: usize,
    /// The bit of seed byte 4 that sets vx = +1; the next bit sets vy = +1.
    pub direction_bit: u8,
    /// The first of the 4 bytes of the deflection key.
    pub key: usize,
}

/// Boss 0: the start index from bytes 0 to 3, vx and vy from bits 0 and 1 of byte 4, the key from
/// bytes 5 to 8.
pub const FIRST_BOSS_SEED: SeedBytes = SeedBytes {
    start: 0,
    direction_bit: 0,
    key: 5,
};

/// Boss 1: the start index from bytes 21 to 24, vx and vy from bits 2 and 3 of byte 4, the key
/// from bytes 25 to 28.
pub const SECOND_BOSS_SEED: SeedBytes = SeedBytes {
    start: 21,
    direction_bit: 2,
    key: 25,
};

/// keccak256("jiro.level" ‖ runNonce ‖ levelIndex), packed as `abi.encodePacked` does.
pub fn level_seed(run_nonce: &[u8; 32], level_index: u8) -> [u8; 32] {
    keccak256(&[b"jiro.level", run_nonce, &[level_index]])
}

/// The candidate whose row-major index in the spawn rectangle is the big-endian u32 of the
/// boss's 4 start bytes modulo the number of candidates; vx = +1 if the boss's direction bit of
/// seed byte 4 is set, and vy = +1 if the next bit is. `None` if the rectangle is empty, which
/// level validity rules out (codes 24 and 41).
pub fn boss_start(spawn: &Rect, seed: &[u8; 32], bytes: &SeedBytes) -> Option<BossStart> {
    let width = u32::from(spawn.x1.checked_sub(spawn.x0)?) + 1;
    let height = u32::from(spawn.y1.checked_sub(spawn.y0)?) + 1;
    let candidates = NonZeroU32::new(width.checked_mul(height)?)?;
    let width = NonZeroU32::new(width)?;
    let index = word(seed, bytes.start) % candidates;
    let pos = Pos {
        x: spawn.x0.checked_add(u8::try_from(index % width).ok()?)?,
        y: spawn.y0.checked_add(u8::try_from(index / width).ok()?)?,
    };
    let direction = |bit: u8| {
        let set = 1_u8
            .checked_shl(u32::from(bit))
            .is_some_and(|mask| seed[4] & mask != 0);
        if set { 1 } else { -1 }
    };
    Some(BossStart {
        pos,
        vx: direction(bytes.direction_bit),
        vy: direction(bytes.direction_bit.checked_add(1)?),
    })
}

/// The key of a boss's deflections: the big-endian u32 of its 4 key bytes (R4.6-7).
pub fn deflection_key(seed: &[u8; 32], bytes: &SeedBytes) -> u32 {
    word(seed, bytes.key)
}

/// The big-endian u32 of seed bytes `first` to `first` + 3; bytes past the seed read as 0, which
/// the fixed offsets above never reach.
fn word(seed: &[u8; 32], first: usize) -> u32 {
    let mut word = [0; 4];
    for (slot, byte) in word.iter_mut().zip(seed.iter().skip(first)) {
        *slot = *byte;
    }
    u32::from_be_bytes(word)
}

/// The run's draw slots: a forward partial Fisher–Yates shuffle of the 16 season levels,
/// where step i swaps deck[i] with deck[i + h mod (16 − i)] and h is
/// keccak256("jiro.draw" ‖ runNonce ‖ i) read as a big-endian integer (README §8.2).
pub fn draw(run_nonce: &[u8; 32]) -> [u8; RUN_LEVELS] {
    let mut deck: [u8; SEASON_LEVELS] = core::array::from_fn(|slot| slot as u8);
    for (step, modulus) in DRAW_MODULI.into_iter().enumerate() {
        let hash = keccak256(&[b"jiro.draw", run_nonce, &[step as u8]]);
        let offset = hash
            .iter()
            .fold(0, |rest, &byte| ((rest << 8) | u32::from(byte)) % modulus);
        let (_, unshuffled) = deck.split_at_mut(step);
        unshuffled.swap(0, offset as usize);
    }
    let [s0, s1, s2, s3, s4, s5, ..] = deck;
    [s0, s1, s2, s3, s4, s5]
}
