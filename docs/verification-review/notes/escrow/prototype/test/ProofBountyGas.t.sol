// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {ControlID} from "risc0/groth16/ControlID.sol";
import {RiscZeroGroth16Verifier} from "risc0/groth16/RiscZeroGroth16Verifier.sol";
import {ReceiptClaimLib} from "risc0/IRiscZeroVerifier.sol";
import {RiscZeroVerifierEmergencyStop} from "risc0/RiscZeroVerifierEmergencyStop.sol";
import {RiscZeroMockVerifier} from "risc0/test/RiscZeroMockVerifier.sol";
import {Challenge} from "../src/Challenge.sol";
import {ProofBounty} from "../src/ProofBounty.sol";
import {calldataGasOf, journalOf, runOf} from "./Challenge.t.sol";
import {BOUNTY, BountyFixture} from "./ProofBounty.t.sol";
import {PlayedLevel, journalBytesOf, levelBytesOf} from "./Settlement.t.sol";
import {ZkFixtures} from "./ZkVerify.t.sol";

/// Gas of the bounty's calls, measured as ChallengeGas and SettlementGas measure theirs
/// (docs/VERIFICATION.md), with the journals of three run sizes. The Groth16 verification is
/// RISC Zero's mock here; `test_Gas_TheVerifiersThroughTheEmergencyStop` measures what the real
/// verifier adds. Run with `forge test --match-contract ProofBountyGas -vv`.
contract ProofBountyGasTest is BountyFixture, ZkFixtures {
    uint16 private constant TYPICAL_EVENTS = 32;
    uint16 private constant FULL_EVENTS = 2_700;

    function logLastCallGas(string memory label, bytes memory data) private {
        Vm.Gas memory gas = vm.lastCallGas();
        emit log_named_uint(string.concat(label, " gas"), gas.gasTotalUsed);
        emit log_named_uint(string.concat(label, " calldata bytes"), data.length);
        emit log_named_uint(string.concat(label, " calldata gas"), calldataGasOf(data));
    }

    /// Alice's committed run whose six journals each hold `eventCount` events, with the gate-set
    /// vectors' levels and Outcomes: the contracts never parse a journal, and the mock verifier
    /// accepts the proof of any public values.
    function committedRunOf(uint16 eventCount) private returns (uint256 runId, PlayedLevel[6] memory played) {
        runId = startAndRevealAs(alice, number);
        played = playedLevelsOf(runId);
        bytes32 runNonce = runOf(challenge, runId).runNonce;
        for (uint8 i; i < 6; ++i) {
            played[i].journal = journalOf(runNonce, i, eventCount, 1);
            played[i].outcome.journalHash = keccak256(played[i].journal);
        }
        commitAs(alice, runId, journalBytesOf(played));
    }

    function runOfSize(uint16 eventCount) private returns (uint256 runId, PlayedLevel[6] memory played) {
        return eventCount == 0 ? committedRun() : committedRunOf(eventCount);
    }

    function measureSettleRun(string memory label, uint16 eventCount) private {
        (uint256 runId, PlayedLevel[6] memory played) = runOfSize(eventCount);
        bytes[6] memory levels = levelBytesOf(played);
        bytes[6] memory journals = journalBytesOf(played);
        bytes memory proof = runProof(played, prover);
        challenge.settleRun(runId, levels, journals, proof);
        logLastCallGas(
            string.concat("Challenge.settleRun, ", label),
            abi.encodeCall(Challenge.settleRun, (runId, levels, journals, proof))
        );
    }

    function measureClaim(string memory label, uint16 eventCount, bool settledBefore) private {
        (uint256 runId, PlayedLevel[6] memory played) = runOfSize(eventCount);
        bytes[6] memory levels = levelBytesOf(played);
        bytes[6] memory journals = journalBytesOf(played);
        bytes memory proof = runProof(played, prover);
        postAs(alice, runId, BOUNTY);
        if (settledBefore) challenge.settleRun(runId, levels, journals, proof);
        bounty.claim(runId, levels, journals, proof);
        logLastCallGas(
            string.concat("ProofBounty.claim, ", label),
            abi.encodeCall(ProofBounty.claim, (runId, levels, journals, proof))
        );
        assertEq(bounty.owed(prover), BOUNTY);
    }

    function test_Gas_SettleRunTypicalJournals() public {
        measureSettleRun("typical journals", TYPICAL_EVENTS);
    }

    function test_Gas_SettleRunGateSetJournals() public {
        measureSettleRun("gate-set journals", 0);
    }

    function test_Gas_SettleRunFullJournals() public {
        measureSettleRun("full journals", FULL_EVENTS);
    }

    function test_Gas_ClaimUnsettledTypicalJournals() public {
        measureClaim("unsettled run, typical journals", TYPICAL_EVENTS, false);
    }

    function test_Gas_ClaimUnsettledGateSetJournals() public {
        measureClaim("unsettled run, gate-set journals", 0, false);
    }

    function test_Gas_ClaimUnsettledFullJournals() public {
        measureClaim("unsettled run, full journals", FULL_EVENTS, false);
    }

    function test_Gas_ClaimSettledTypicalJournals() public {
        measureClaim("settled run, typical journals", TYPICAL_EVENTS, true);
    }

    function test_Gas_ClaimSettledGateSetJournals() public {
        measureClaim("settled run, gate-set journals", 0, true);
    }

    function test_Gas_ClaimSettledFullJournals() public {
        measureClaim("settled run, full journals", FULL_EVENTS, true);
    }

    function test_Gas_ClaimUnsettledSecondBountyOfThePayee() public {
        (uint256 firstRunId, PlayedLevel[6] memory first) = committedRunOf(TYPICAL_EVENTS);
        postAs(alice, firstRunId, BOUNTY);
        claim(firstRunId, first, runProof(first, prover));
        vm.prank(bob);
        uint256 runId = challenge.startRun{value: 50_000_000_000_000}(number);
        advanceArbBlocks(41);
        vm.prank(bob);
        challenge.revealRun(runId);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        bytes32 runNonce = runOf(challenge, runId).runNonce;
        for (uint8 i; i < 6; ++i) {
            played[i].journal = journalOf(runNonce, i, TYPICAL_EVENTS, 1);
            played[i].outcome.journalHash = keccak256(played[i].journal);
        }
        commitAs(bob, runId, journalBytesOf(played));
        postAs(bob, runId, BOUNTY);
        bytes[6] memory levels = levelBytesOf(played);
        bytes[6] memory journals = journalBytesOf(played);
        bytes memory proof = runProof(played, prover);
        bounty.claim(runId, levels, journals, proof);
        logLastCallGas(
            "ProofBounty.claim, unsettled run, typical journals, a payee already owed, a player's first settled run",
            abi.encodeCall(ProofBounty.claim, (runId, levels, journals, proof))
        );
    }

    function test_Gas_PostFirstDeposit() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        logLastCallGas("ProofBounty.post, a run's first deposit", abi.encodeCall(ProofBounty.post, (runId)));
    }

    function test_Gas_PostTopUp() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        postAs(alice, runId, BOUNTY);
        logLastCallGas("ProofBounty.post, a top-up", abi.encodeCall(ProofBounty.post, (runId)));
    }

    function test_Gas_PostSecondDepositor() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        postAs(carol, runId, BOUNTY);
        logLastCallGas("ProofBounty.post, a second depositor", abi.encodeCall(ProofBounty.post, (runId)));
    }

    function test_Gas_Refund() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.warp(settlementEnd() + 1);
        vm.prank(alice);
        bounty.refund(runId, alice);
        logLastCallGas("ProofBounty.refund", abi.encodeCall(ProofBounty.refund, (runId, alice)));
    }

    function test_Gas_Withdraw() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        claim(runId, played, runProof(played, prover));
        vm.deal(prover, 1);
        bounty.withdraw(prover);
        logLastCallGas("ProofBounty.withdraw, to a funded account", abi.encodeCall(ProofBounty.withdraw, (prover)));
    }

    function test_Gas_Deployment() public {
        uint256 before = gasleft();
        new ProofBounty(challenge, zkReferee);
        emit log_named_uint("ProofBounty deployment gas, as a create frame", before - gasleft());
        emit log_named_uint("ProofBounty runtime bytes", address(bounty).code.length);
    }

    /// What the real Groth16 verifier costs more than the mock, for the same call through the stop.
    function test_Gas_TheVerifiersThroughTheEmergencyStop() public {
        string memory fixtures = zkFixtures();
        bytes memory seal = vm.parseJsonBytes(fixtures, ".challengeRun.seal");
        bytes32 imageId = vm.parseJsonBytes32(fixtures, ".challengeRun.imageId");
        bytes32 digest = sha256(vm.parseJsonBytes(fixtures, ".challengeRun.publicValues"));
        RiscZeroVerifierEmergencyStop realStop = new RiscZeroVerifierEmergencyStop(
            new RiscZeroGroth16Verifier(ControlID.CONTROL_ROOT, ControlID.BN254_CONTROL_ID), guardian
        );
        realStop.verify(seal, imageId, digest);
        logLastCallGas(
            "emergency stop over the Groth16 verifier, verify", abi.encodeCall(realStop.verify, (seal, imageId, digest))
        );

        bytes memory mockSeal =
            abi.encodePacked(MOCK_SELECTOR, ReceiptClaimLib.digest(ReceiptClaimLib.ok(imageId, digest)));
        emergencyStop.verify(mockSeal, imageId, digest);
        logLastCallGas(
            "emergency stop over the mock verifier, verify",
            abi.encodeCall(emergencyStop.verify, (mockSeal, imageId, digest))
        );
    }

    /// docs/DEPLOYMENT.md §5 records 26,506 gas for this call in anvil's receipts.
    function test_Gas_MeteringMatchesAnvilsReceiptOfSetBlockNumber() public {
        arbSys.setBlockNumber(arbSys.blockNumber() + 41);
        emit log_named_uint("MockArbSys.setBlockNumber gas", vm.lastCallGas().gasTotalUsed);
    }
}
