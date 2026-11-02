// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ControlID} from "risc0/groth16/ControlID.sol";
import {RiscZeroGroth16Verifier} from "risc0/groth16/RiscZeroGroth16Verifier.sol";
import {VerificationFailed} from "risc0/IRiscZeroVerifier.sol";
import {Outcome} from "../src/interfaces/IReferee.sol";

/// The zk proofs of `zk-host prove` (plan M4.8), from the logs of a zk-prove.yml run and of the
/// container's proof of `worst-case` (test/fixtures/zk-proofs.json names each source), verified by
/// RISC Zero's 3.0 Groth16 verifier, called directly as a zk referee calls it, never through the
/// upgradeable router (docs/ECONOMY.md, zk prover trust). The public values are rebuilt here from
/// the proven game vectors, in the encoding of referee/zk/README.md, the way a zk referee builds
/// them from what settlement submits.
contract ZkVerifyTest is Test {
    RiscZeroGroth16Verifier internal verifier;
    string internal fixtures;

    function setUp() public {
        verifier = new RiscZeroGroth16Verifier(ControlID.CONTROL_ROOT, ControlID.BN254_CONTROL_ID);
        fixtures = vm.readFile(string.concat(vm.projectRoot(), "/test/fixtures/zk-proofs.json"));
    }

    function test_aLevelProofVerifies() public view {
        verifyFixture(".level", publicValuesOf(".level"));
    }

    function test_aRunProofVerifies() public view {
        verifyFixture(".run", publicValuesOf(".run"));
    }

    function test_theWorstCaseLevelProofVerifies() public view {
        verifyFixture(".worstCase", publicValuesOf(".worstCase"));
    }

    function test_theLevelProofCommitsTheVectorsEncoding() public view {
        assertEq(publicValuesOf(".level"), vm.parseJsonBytes(fixtures, ".level.publicValues"));
    }

    function test_theRunProofCommitsTheVectorsEncoding() public view {
        assertEq(publicValuesOf(".run"), vm.parseJsonBytes(fixtures, ".run.publicValues"));
    }

    function test_aLevelProofOfAnotherScoreReverts() public {
        bytes memory publicValues = publicValuesOf(".level");
        // The last word is the Outcome's levelScore.
        publicValues[publicValues.length - 1] ^= 0x01;
        vm.expectRevert(VerificationFailed.selector);
        this.verifyFixture(".level", publicValues);
    }

    function test_aLevelProofDoesNotVerifyARun() public {
        bytes memory publicValues = publicValuesOf(".run");
        vm.expectRevert(VerificationFailed.selector);
        this.verifyFixture(".level", publicValues);
    }

    function verifyFixture(string memory mode, bytes memory publicValues) public view {
        bytes memory seal = vm.parseJsonBytes(fixtures, string.concat(mode, ".seal"));
        bytes32 imageId = vm.parseJsonBytes32(fixtures, string.concat(mode, ".imageId"));
        verifier.verify(seal, imageId, sha256(publicValues));
    }

    /// One `abi.encode(uint16 weightBp, Outcome)` per proven level, in order, with the Outcome's
    /// journalHash and levelId computed from the vector's journal and level bytes.
    function publicValuesOf(string memory mode) internal view returns (bytes memory publicValues) {
        string[] memory paths = vm.parseJsonStringArray(fixtures, string.concat(mode, ".vectors"));
        for (uint256 i; i < paths.length; ++i) {
            string memory vector = vm.readFile(string.concat(vm.projectRoot(), "/../", paths[i]));
            uint16 weightBp = uint16(vm.parseJsonUint(vector, ".weightBp"));
            publicValues = bytes.concat(publicValues, abi.encode(weightBp, outcomeOf(vector)));
        }
    }

    function outcomeOf(string memory vector) internal pure returns (Outcome memory outcome) {
        outcome.journalHash = keccak256(vm.parseJsonBytes(vector, ".journal"));
        outcome.levelId = keccak256(vm.parseJsonBytes(vector, ".level"));
        outcome.runNonce = vm.parseJsonBytes32(vector, ".outcome.runNonce");
        outcome.levelIndex = uint8(vm.parseJsonUint(vector, ".outcome.levelIndex"));
        outcome.drawSlot = uint8(vm.parseJsonUint(vector, ".outcome.drawSlot"));
        outcome.mode = uint8(vm.parseJsonUint(vector, ".outcome.mode"));
        outcome.rulesVersion = uint16(vm.parseJsonUint(vector, ".outcome.rulesVersion"));
        outcome.endReason = uint8(vm.parseJsonUint(vector, ".outcome.endReason"));
        outcome.claimBp = uint16(vm.parseJsonUint(vector, ".outcome.claimBp"));
        outcome.ticksUsed = uint16(vm.parseJsonUint(vector, ".outcome.ticksUsed"));
        outcome.levelScore = uint32(vm.parseJsonUint(vector, ".outcome.levelScore"));
    }
}
