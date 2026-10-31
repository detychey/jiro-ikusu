// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// The verifier interface of README §7.3, copied from it verbatim, behind which the Stylus referee
// (referee/stylus) or a proof verifier sits. Every function is view, and a level or journal that
// replay rejects reverts: no Outcome is ever returned for it.

struct Outcome {
    bytes32 journalHash;  // keccak256 of the journal bytes
    bytes32 levelId;      // the header's levelId, which replay checks against the level bytes
    bytes32 runNonce;     // from the header
    uint8 levelIndex;     // from the header
    uint8 drawSlot;       // draw(runNonce)[levelIndex] (§8.2), computed by the core
    uint8 mode;           // from the header
    uint16 rulesVersion;  // from the header
    uint8 endReason;      // 1 Committed, 2 Cleared, 3 out of lives, 4 time limit (§4.10)
    uint16 claimBp;       // claim_bp when the level ended
    uint16 ticksUsed;     // §4.10
    uint32 levelScore;    // claimBp × weightBp / 10_000, rounded down; 0 if endReason is 3
}

interface IReferee {
    function verifyRun(bytes[6] calldata levels, bytes[6] calldata journals,
        uint16[6] calldata weightsBp, bytes calldata proof)
        external view returns (Outcome[6] memory);
    function verify(bytes calldata level, bytes calldata journal, uint16 weightBp,
        bytes calldata proof) external view returns (Outcome memory);
    function rulesVersion() external view returns (uint16);
}
