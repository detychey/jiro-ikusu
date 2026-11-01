// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The two derivations of README §6.4 that the contracts compute, packed as
/// `abi.encodePacked` packs them.
library RunDerivations {
    /// @notice keccak256("jiro.run" ‖ entropy ‖ runId), derived when the player reveals the run.
    function runNonce(bytes32 entropy, uint256 runId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("jiro.run", entropy, runId));
    }

    /// @notice keccak256(keccak256(journal₀) ‖ … ‖ keccak256(journal₅)), the journals in
    /// `levelIndex` order.
    function runCommitment(bytes[6] calldata journals) internal pure returns (bytes32) {
        return commitmentOf(journalHashesOf(journals));
    }

    function journalHashesOf(bytes[6] calldata journals) internal pure returns (bytes32[6] memory journalHashes) {
        for (uint256 i; i < 6; ++i) {
            journalHashes[i] = keccak256(journals[i]);
        }
    }

    /// @notice The run commitment from the six journal hashes, as `settleLevel` receives them.
    function commitmentOf(bytes32[6] memory journalHashes) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(journalHashes));
    }
}
