//! The test-only guest: replays each level and commits, per level, replay's error code (0 when it
//! accepts), the keccak256 of the trace of state hashes (the `traceKeccak` of a game vector,
//! vectors/README.md), and the encoded Outcome, or zeros when replay rejects.

#![no_main]
risc0_zkvm::guest::entry!(main);

use jiro_core::hash::state_hash;
use jiro_core::keccak::keccak256;
use jiro_core::replay::replay_observed;
use risc0_zkvm::guest::env;
use zk_guest::{OUTCOME_LEN, encode, read_inputs};

fn main() {
    let committed: Vec<u8> = read_inputs()
        .iter()
        .flat_map(|input| {
            let mut trace = Vec::new();
            let result = replay_observed(&input.level, &input.journal, input.weight_bp, |game| {
                trace.extend(state_hash(game))
            });
            let (code, outcome) = match result {
                Ok(outcome) => (0, encode(input.weight_bp, &outcome)),
                Err(error) => (error.code(), vec![0; OUTCOME_LEN]),
            };
            [vec![code], keccak256(&[&trace]).to_vec(), outcome].concat()
        })
        .collect();
    env::commit_slice(&committed);
}
