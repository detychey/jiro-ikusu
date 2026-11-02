// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRiscZeroVerifier} from "risc0/IRiscZeroVerifier.sol";
import {IReferee, Outcome} from "./interfaces/IReferee.sol";

/// @notice One level of the verify program's public values: `abi.encode(uint16 weightBp, Outcome)`
/// (referee/zk/README.md, README §7.3). A run's six are concatenated, which is how
/// `abi.encode(ScoredOutcome[6])` lays them out.
struct ScoredOutcome {
    uint16 weightBp;
    Outcome outcome;
}

/// @notice The zk backend of `IReferee` (README §7.3, D2): a RISC Zero proof that the verify program
/// of `imageId` replayed the submitted levels and journals at their weights and committed these
/// Outcomes. `proof` is `abi.encode(bytes seal, bytes publicValues)`, as `zk-host prove` prints
/// them. The verifier is a fixed version, held immutably and called directly, never an upgradeable
/// router (docs/ECONOMY.md, zk prover trust). Rejections revert: a journal that replay rejects has
/// no proof.
contract ZkReferee is IReferee {
    uint256 private constant LEVEL_PUBLIC_VALUES_LENGTH = 12 * 32;

    IRiscZeroVerifier public immutable verifier;
    bytes32 public immutable imageId;
    uint16 public immutable rulesVersion;

    error ZeroAddress();
    error ZeroImageId();
    error PublicValuesLengthMismatch(uint256 length, uint256 expected);
    error WeightMismatch(uint256 position, uint16 provenWeightBp, uint16 weightBp);
    error JournalHashMismatch(uint256 position, bytes32 provenJournalHash, bytes32 journalHash);
    error LevelIdMismatch(uint256 position, bytes32 provenLevelId, bytes32 levelId);

    constructor(IRiscZeroVerifier verifier_, bytes32 imageId_, uint16 rulesVersion_) {
        if (address(verifier_) == address(0)) revert ZeroAddress();
        if (imageId_ == bytes32(0)) revert ZeroImageId();
        verifier = verifier_;
        imageId = imageId_;
        rulesVersion = rulesVersion_;
    }

    /// @notice One run proof of six levels, in run mode.
    function verifyRun(
        bytes[6] calldata levels,
        bytes[6] calldata journals,
        uint16[6] calldata weightsBp,
        bytes calldata proof
    ) external view returns (Outcome[6] memory outcomes) {
        bytes memory publicValues = verifiedPublicValues(proof, 6);
        ScoredOutcome[6] memory scored = abi.decode(publicValues, (ScoredOutcome[6]));
        for (uint256 i; i < 6; ++i) {
            outcomes[i] = boundOutcome(i, levels[i], journals[i], weightsBp[i], scored[i]);
        }
    }

    /// @notice One level proof, in level mode.
    function verify(bytes calldata level, bytes calldata journal, uint16 weightBp, bytes calldata proof)
        external
        view
        returns (Outcome memory)
    {
        bytes memory publicValues = verifiedPublicValues(proof, 1);
        return boundOutcome(0, level, journal, weightBp, abi.decode(publicValues, (ScoredOutcome)));
    }

    /// @notice The public values of `levelCount` levels, once the seal proves that the program
    /// committed them. The length also tells a run proof from a level proof.
    function verifiedPublicValues(bytes calldata proof, uint256 levelCount) private view returns (bytes memory) {
        (bytes memory seal, bytes memory publicValues) = abi.decode(proof, (bytes, bytes));
        uint256 expected = levelCount * LEVEL_PUBLIC_VALUES_LENGTH;
        if (publicValues.length != expected) revert PublicValuesLengthMismatch(publicValues.length, expected);
        verifier.verify(seal, imageId, sha256(publicValues));
        return publicValues;
    }

    /// @notice Binds the proven level at `position` to the submitted level, journal and weight.
    function boundOutcome(
        uint256 position,
        bytes calldata level,
        bytes calldata journal,
        uint16 weightBp,
        ScoredOutcome memory scored
    ) private pure returns (Outcome memory) {
        Outcome memory outcome = scored.outcome;
        // forge-lint: disable-start(require-revert-in-loop)
        if (scored.weightBp != weightBp) revert WeightMismatch(position, scored.weightBp, weightBp);
        bytes32 journalHash = keccak256(journal);
        if (outcome.journalHash != journalHash) revert JournalHashMismatch(position, outcome.journalHash, journalHash);
        bytes32 levelId = keccak256(level);
        if (outcome.levelId != levelId) revert LevelIdMismatch(position, outcome.levelId, levelId);
        // forge-lint: disable-end(require-revert-in-loop)
        return outcome;
    }
}
