//! The proving guest: replays each level and commits its encoded Outcome. Commits happen only
//! once every level has replayed, and a rejected journal panics, so the session ends with no
//! receipt and no proof of an Outcome can exist for it (README §7.3, "Rejections revert").

#![no_main]
risc0_zkvm::guest::entry!(main);

use jiro_core::replay::replay;
use risc0_zkvm::guest::env;
use zk_guest::{encode, read_inputs};

fn main() {
    let committed: Vec<u8> = read_inputs()
        .iter()
        .flat_map(|input| {
            let outcome = replay(&input.level, &input.journal, input.weight_bp)
                .unwrap_or_else(|error| panic!("replay rejects: code {}", error.code()));
            encode(input.weight_bp, &outcome)
        })
        .collect();
    env::commit_slice(&committed);
}
