//! The Stylus referee (README §7.3): the core, deployed as an Arbitrum Stylus contract that
//! replays journals. It implements `IReferee`: `verify` replays one level, `verifyRun` replays the
//! six levels of a run in order, each as `verify` does, and `rulesVersion` is the core's
//! `RULES_VERSION`. Every rejection reverts with `Error(string)`: `replay error <code>`, with
//! replay's code (README §6.3), prefixed in `verifyRun` by the level's index in the run, or
//! `proof not empty`, since a Stylus verification takes no proof. No Outcome is returned for
//! bytes that replay rejects, and the verify path computes no state hash.

#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

// The stylus-sdk macros expand to `vec!`.
#[macro_use]
extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

use jiro_core::consts::{RULES_VERSION, RUN_LEVELS};
use jiro_core::replay::replay;
use stylus_sdk::abi::Bytes;
use stylus_sdk::alloy_primitives::FixedBytes;
use stylus_sdk::alloy_sol_types::{Revert, SolError};
use stylus_sdk::prelude::*;

/// README §7.3's `Outcome`, field for field and in ABI order: journalHash, levelId, runNonce,
/// levelIndex, drawSlot, mode, rulesVersion, endReason, claimBp, ticksUsed and levelScore. A
/// tuple of static fields encodes exactly as the struct does.
pub type Outcome = (
    FixedBytes<32>,
    FixedBytes<32>,
    FixedBytes<32>,
    u8,
    u8,
    u8,
    u16,
    u8,
    u16,
    u16,
    u32,
);

#[storage]
#[entrypoint]
pub struct Referee;

#[public]
impl Referee {
    /// Replays `journal` on `level` and scores it with `weight_bp` (README §7.3).
    pub fn verify(
        &self,
        level: Bytes,
        journal: Bytes,
        weight_bp: u16,
        proof: Bytes,
    ) -> Result<Outcome, Vec<u8>> {
        no_proof(&proof)?;
        verified(&level, &journal, weight_bp).map_err(|code| revert(format!("replay error {code}")))
    }

    /// Replays the six levels of a run in order, each as `verify` does, with no check across
    /// them: binding them to one run is the calling contract's job (README §7.2).
    pub fn verify_run(
        &self,
        levels: [Bytes; RUN_LEVELS],
        journals: [Bytes; RUN_LEVELS],
        weights_bp: [u16; RUN_LEVELS],
        proof: Bytes,
    ) -> Result<[Outcome; RUN_LEVELS], Vec<u8>> {
        no_proof(&proof)?;
        let mut outcomes = [Outcome::default(); RUN_LEVELS];
        for (index, ((outcome, level), (journal, weight_bp))) in outcomes
            .iter_mut()
            .zip(&levels)
            .zip(journals.iter().zip(weights_bp))
            .enumerate()
        {
            *outcome = verified(level, journal, weight_bp)
                .map_err(|code| revert(format!("level {index}: replay error {code}")))?;
        }
        Ok(outcomes)
    }

    /// The core's `RULES_VERSION` (README §6.3).
    pub fn rules_version(&self) -> u16 {
        RULES_VERSION
    }
}

/// The Outcome of a replay that the core accepts, or the code of the first rule it breaks.
fn verified(level: &[u8], journal: &[u8], weight_bp: u16) -> Result<Outcome, u8> {
    let outcome = replay(level, journal, weight_bp).map_err(|error| error.code())?;
    Ok((
        outcome.journal_hash.into(),
        outcome.level_id.into(),
        outcome.run_nonce.into(),
        outcome.level_index,
        outcome.draw_slot,
        outcome.mode as u8,
        outcome.rules_version,
        outcome.end_reason as u8,
        outcome.claim_bp,
        outcome.ticks_used,
        outcome.level_score,
    ))
}

fn no_proof(proof: &[u8]) -> Result<(), Vec<u8>> {
    if proof.is_empty() {
        Ok(())
    } else {
        Err(revert("proof not empty".into()))
    }
}

/// The revert data of `Error(reason)`, which Solidity's `catch Error(string)` decodes.
fn revert(reason: String) -> Vec<u8> {
    Revert { reason }.abi_encode()
}
