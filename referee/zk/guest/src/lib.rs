//! The guest programs' shared parts: the inputs of one `verify` call per level (README §7.3),
//! read from the prover's input stream, and an Outcome encoded as the ABI words of
//! `(uint16 weightBp, Outcome)`.

use jiro_core::replay::Outcome;

pub const OUTCOME_LEN: usize = 12 * 32;

pub struct LevelInput {
    pub level: Vec<u8>,
    pub journal: Vec<u8>,
    pub weight_bp: u16,
}

/// A count, then that many (level bytes, journal bytes, weightBp): one level for `verify`, six
/// for `verifyRun`.
pub fn read_inputs() -> Vec<LevelInput> {
    let count = sp1_zkvm::io::read::<u8>();
    (0..count)
        .map(|_| LevelInput {
            level: sp1_zkvm::io::read_vec(),
            journal: sp1_zkvm::io::read_vec(),
            weight_bp: sp1_zkvm::io::read::<u16>(),
        })
        .collect()
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
