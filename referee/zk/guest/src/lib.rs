//! The guest programs' shared parts: the inputs of one `verify` call per level (README §7.3),
//! read from the prover's input stream, and an Outcome encoded as the ABI words of
//! `(uint16 weightBp, Outcome)`.

use jiro_core::replay::Outcome;
use risc0_zkvm::guest::env;

pub const OUTCOME_LEN: usize = 12 * 32;

pub struct LevelInput {
    pub level: Vec<u8>,
    pub journal: Vec<u8>,
    pub weight_bp: u16,
}

/// A count, then that many (level bytes, journal bytes, weightBp): one level for `verify`, six
/// for `verifyRun`. Each value is a little-endian u32 word, and each byte string is its length
/// word followed by its bytes, read raw rather than through the serde codec, which spends a
/// word per byte.
pub fn read_inputs() -> Vec<LevelInput> {
    let count = read_word();
    (0..count)
        .map(|_| LevelInput {
            level: read_bytes(),
            journal: read_bytes(),
            weight_bp: u16::try_from(read_word()).expect("weightBp exceeds u16"),
        })
        .collect()
}

fn read_word() -> u32 {
    let mut word = 0u32;
    env::read_slice(core::slice::from_mut(&mut word));
    word
}

fn read_bytes() -> Vec<u8> {
    let mut bytes = vec![0; read_word() as usize];
    env::read_slice(&mut bytes);
    bytes
}

pub fn encode(weight_bp: u16, outcome: &Outcome) -> Vec<u8> {
    [
        uint(weight_bp.into()),
        outcome.journal_hash,
        outcome.level_id,
        outcome.run_nonce,
        uint(outcome.level_index.into()),
        uint(outcome.draw_slot.into()),
        uint(outcome.mode as u64),
        uint(outcome.rules_version.into()),
        uint(outcome.end_reason as u64),
        uint(outcome.claim_bp.into()),
        uint(outcome.ticks_used.into()),
        uint(outcome.level_score.into()),
    ]
    .concat()
}

fn uint(value: u64) -> [u8; 32] {
    let mut word = [0; 32];
    word[24..].copy_from_slice(&value.to_be_bytes());
    word
}
