//! The proving guest: replays each level and commits its encoded Outcome. Commits happen only
//! once every level has replayed, so a rejected journal halts the program with no public values,
//! and no proof of an Outcome can exist for it (README §7.3, "Rejections revert").

#![no_main]
sp1_zkvm::entrypoint!(main);

use jiro_core::replay::replay;
use zk_guest::{encode, read_inputs};

pub fn main() {
    let committed: Vec<u8> = read_inputs()
        .iter()
        .flat_map(|input| {
            let outcome = replay(&input.level, &input.journal, input.weight_bp)
                .unwrap_or_else(|error| panic!("replay rejects: code {}", error.code()));
            encode(input.weight_bp, &outcome)
        })
        .collect();
    sp1_zkvm::io::commit_slice(&committed);
}
