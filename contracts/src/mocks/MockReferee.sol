// Adapted from ethblockdigger at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/mocks/MockReferee.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IReferee, Outcome} from "../interfaces/IReferee.sol";

/// @notice Test referee that returns the Outcome set for each (level, journal, weightBp), such
/// as a vector's, and reverts on inputs it has none for, as the real referee reverts on what
/// replay rejects. The real referee is a Stylus contract that the EVM cannot execute. The proof
/// is ignored, so this mock stands in for either backend.
contract MockReferee is IReferee {
    uint16 public immutable rulesVersion;
    mapping(bytes32 inputs => Outcome) private outcomeOf;
    mapping(bytes32 inputs => bool) private hasOutcome;

    error NoOutcome(bytes32 levelId, bytes32 journalHash, uint16 weightBp);

    constructor(uint16 rulesVersion_) {
        rulesVersion = rulesVersion_;
    }

    function setOutcome(bytes calldata level, bytes calldata journal, uint16 weightBp, Outcome calldata outcome)
        external
    {
        bytes32 inputs = inputsKey(keccak256(level), keccak256(journal), weightBp);
        outcomeOf[inputs] = outcome;
        hasOutcome[inputs] = true;
    }

    function verifyRun(
        bytes[6] calldata levels,
        bytes[6] calldata journals,
        uint16[6] calldata weightsBp,
        bytes calldata
    ) external view returns (Outcome[6] memory outcomes) {
        for (uint256 i; i < 6; ++i) {
            outcomes[i] = configuredOutcome(levels[i], journals[i], weightsBp[i]);
        }
    }

    function verify(bytes calldata level, bytes calldata journal, uint16 weightBp, bytes calldata)
        external
        view
        returns (Outcome memory)
    {
        return configuredOutcome(level, journal, weightBp);
    }

    function configuredOutcome(bytes calldata level, bytes calldata journal, uint16 weightBp)
        private
        view
        returns (Outcome memory)
    {
        bytes32 levelId = keccak256(level);
        bytes32 journalHash = keccak256(journal);
        bytes32 inputs = inputsKey(levelId, journalHash, weightBp);
        // forge-lint: disable-next-line(require-revert-in-loop)
        if (!hasOutcome[inputs]) revert NoOutcome(levelId, journalHash, weightBp);
        return outcomeOf[inputs];
    }

    function inputsKey(bytes32 levelId, bytes32 journalHash, uint16 weightBp) private pure returns (bytes32) {
        return keccak256(abi.encode(levelId, journalHash, weightBp));
    }
}
