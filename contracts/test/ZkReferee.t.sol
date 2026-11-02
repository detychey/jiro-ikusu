// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ControlID} from "risc0/groth16/ControlID.sol";
import {RiscZeroGroth16Verifier} from "risc0/groth16/RiscZeroGroth16Verifier.sol";
import {IRiscZeroVerifier, VerificationFailed} from "risc0/IRiscZeroVerifier.sol";
import {Challenge, SettlementStatus} from "../src/Challenge.sol";
import {Outcome} from "../src/interfaces/IReferee.sol";
import {ZkReferee} from "../src/ZkReferee.sol";
import {runOf} from "./Challenge.t.sol";
import {SettlementFixture, settlementOf} from "./Settlement.t.sol";
import {ZkFixtures} from "./ZkVerify.t.sol";

/// ZkReferee (plan M4.10) over RISC Zero's 3.0 Groth16 verifier, with the real proofs of
/// test/fixtures/zk-proofs.json. `.challengeRun` proves the run file test/fixtures/zk-run.json: run 1
/// of this fixture's deployment, whose run nonce follows from MockArbSys's block hashes, played by
/// the bold bot and committed as it is. `.level` and `.run` prove game vectors (M4.8).
contract ZkRefereeTest is SettlementFixture, ZkFixtures {
    string private constant RUN = ".challengeRun";

    RiscZeroGroth16Verifier private verifier;
    ZkReferee private zkReferee;

    /// SettlementFixture's calibration season settles through MockReferee; the next one, opened
    /// at its end, through ZkReferee.
    function setUp() public override {
        super.setUp();
        verifier = new RiscZeroGroth16Verifier(ControlID.CONTROL_ROOT, ControlID.BN254_CONTROL_ID);
        zkReferee = new ZkReferee(verifier, imageIdOf(RUN), calibrationRulesVersion);
        vm.warp(season.endOf(number));
        number = openSeason(calibrationParams(zkReferee));
    }

    function imageIdOf(string memory fixture) private view returns (bytes32) {
        return vm.parseJsonBytes32(zkFixtures(), string.concat(fixture, ".imageId"));
    }

    function proofOf(string memory fixture, bytes memory publicValues) private view returns (bytes memory) {
        return abi.encode(vm.parseJsonBytes(zkFixtures(), string.concat(fixture, ".seal")), publicValues);
    }

    function provenPublicValues(string memory fixture) private view returns (bytes memory) {
        return vm.parseJsonBytes(zkFixtures(), string.concat(fixture, ".publicValues"));
    }

    function runProof() private view returns (bytes memory) {
        return proofOf(RUN, provenPublicValues(RUN));
    }

    function runFile() private view returns (string memory) {
        string memory path = vm.parseJsonString(zkFixtures(), string.concat(RUN, ".runFile"));
        return vm.readFile(string.concat(vm.projectRoot(), "/../", path));
    }

    function runLevels() private view returns (bytes[6] memory levels) {
        bytes[] memory parsed = vm.parseJsonBytesArray(runFile(), ".levels");
        for (uint256 i; i < 6; ++i) {
            levels[i] = parsed[i];
        }
    }

    function runJournals() private view returns (bytes[6] memory journals) {
        bytes[] memory parsed = vm.parseJsonBytesArray(runFile(), ".journals");
        for (uint256 i; i < 6; ++i) {
            journals[i] = parsed[i];
        }
    }

    function runWeights() private view returns (uint16[6] memory weightsBp) {
        uint256[] memory slots = vm.parseJsonUintArray(runFile(), ".drawSlots");
        for (uint256 i; i < 6; ++i) {
            weightsBp[i] = uint16(calibrationWeightsBp[slots[i]]);
        }
    }

    /// Alice's run 1, revealed and committed with `journals`; the run file was written for its nonce.
    function committedRunOf(bytes[6] memory journals) private returns (uint256 runId) {
        runId = startAndRevealAs(alice, number);
        assertEq(runId, vm.parseJsonUint(runFile(), ".runId"), "the run file's run id");
        assertEq(runOf(challenge, runId).runNonce, vm.parseJsonBytes32(runFile(), ".runNonce"), "the run file's nonce");
        commitAs(alice, runId, journals);
    }

    function nativeTotal(string memory field) private view returns (uint256) {
        return vm.parseJsonUint(zkFixtures(), string.concat(RUN, ".nativeReplay.", field));
    }

    // Settlement through Challenge.

    function test_SettleRun_SettlesTheProvenRun() public {
        uint256 runId = committedRunOf(runJournals());
        vm.expectEmit(address(challenge));
        emit Challenge.RunSettled(
            runId, alice, uint32(nativeTotal("score")), uint32(nativeTotal("ticks")), uint8(nativeTotal("clears"))
        );
        challenge.settleRun(runId, runLevels(), runJournals(), runProof());
        assertEq(uint8(settlementOf(challenge, runId).status), uint8(SettlementStatus.Settled), "status");
    }

    function test_SettleRun_RevertsOnAProofOfAnotherJournal() public {
        bytes[6] memory journals = runJournals();
        bytes32 provenJournalHash = keccak256(journals[3]);
        // The last byte is the mask of the X that closes the level.
        journals[3][journals[3].length - 1] = 0x00;
        uint256 runId = committedRunOf(journals);
        bytes[6] memory levels = runLevels();
        bytes memory proof = runProof();
        vm.expectRevert(
            abi.encodeWithSelector(ZkReferee.JournalHashMismatch.selector, 3, provenJournalHash, keccak256(journals[3]))
        );
        challenge.settleRun(runId, levels, journals, proof);
    }

    // verifyRun.

    function test_VerifyRun_RevertsOnTamperedPublicValues() public {
        bytes memory publicValues = provenPublicValues(RUN);
        // The last word is level 5's levelScore.
        publicValues[publicValues.length - 1] ^= 0x01;
        bytes memory proof = proofOf(RUN, publicValues);
        vm.expectRevert(VerificationFailed.selector);
        zkReferee.verifyRun(runLevels(), runJournals(), runWeights(), proof);
    }

    function test_VerifyRun_RevertsUnderAnotherImageId() public {
        ZkReferee otherReferee = new ZkReferee(verifier, bytes32(uint256(imageIdOf(RUN)) ^ 1), calibrationRulesVersion);
        bytes memory proof = runProof();
        vm.expectRevert(VerificationFailed.selector);
        otherReferee.verifyRun(runLevels(), runJournals(), runWeights(), proof);
    }

    function test_VerifyRun_RevertsOnAnotherWeight() public {
        uint16[6] memory weightsBp = runWeights();
        uint16 provenWeightBp = weightsBp[2];
        weightsBp[2] += 1;
        bytes memory proof = runProof();
        vm.expectRevert(
            abi.encodeWithSelector(ZkReferee.WeightMismatch.selector, 2, provenWeightBp, provenWeightBp + 1)
        );
        zkReferee.verifyRun(runLevels(), runJournals(), weightsBp, proof);
    }

    function test_VerifyRun_RevertsOnAnotherLevel() public {
        bytes[6] memory levels = runLevels();
        bytes32 provenLevelId = keccak256(levels[0]);
        levels[0] = levels[1];
        bytes memory proof = runProof();
        vm.expectRevert(
            abi.encodeWithSelector(ZkReferee.LevelIdMismatch.selector, 0, provenLevelId, keccak256(levels[1]))
        );
        zkReferee.verifyRun(levels, runJournals(), runWeights(), proof);
    }

    function test_VerifyRun_RevertsOnALevelProof() public {
        bytes memory proof = proofOf(".level", provenPublicValues(".level"));
        vm.expectRevert(abi.encodeWithSelector(ZkReferee.PublicValuesLengthMismatch.selector, 384, 2_304));
        zkReferee.verifyRun(runLevels(), runJournals(), runWeights(), proof);
    }

    // verify.

    function test_Verify_ReturnsTheLevelProofsOutcome() public view {
        string memory vector = vm.readFile(
            string.concat(vm.projectRoot(), "/../", vm.parseJsonStringArray(zkFixtures(), ".level.vectors")[0])
        );
        Outcome memory outcome = zkReferee.verify(
            vm.parseJsonBytes(vector, ".level"),
            vm.parseJsonBytes(vector, ".journal"),
            uint16(vm.parseJsonUint(vector, ".weightBp")),
            proofOf(".level", provenPublicValues(".level"))
        );
        assertEq(abi.encode(outcome), abi.encode(outcomeOf(vector)));
    }

    function test_Verify_RevertsOnARunProof() public {
        bytes[6] memory levels = runLevels();
        bytes[6] memory journals = runJournals();
        uint16 weightBp = runWeights()[0];
        bytes memory proof = runProof();
        vm.expectRevert(abi.encodeWithSelector(ZkReferee.PublicValuesLengthMismatch.selector, 2_304, 384));
        zkReferee.verify(levels[0], journals[0], weightBp, proof);
    }

    // Construction.

    function test_RulesVersion_IsTheProgramsVersion() public view {
        assertEq(zkReferee.rulesVersion(), calibrationRulesVersion);
    }

    function test_Constructor_RevertsOnNoVerifier() public {
        vm.expectRevert(ZkReferee.ZeroAddress.selector);
        new ZkReferee(IRiscZeroVerifier(address(0)), imageIdOf(RUN), calibrationRulesVersion);
    }

    function test_Constructor_RevertsOnNoImageId() public {
        vm.expectRevert(ZkReferee.ZeroImageId.selector);
        new ZkReferee(verifier, bytes32(0), calibrationRulesVersion);
    }
}
