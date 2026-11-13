// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReceiptClaimLib, VerificationFailed} from "risc0/IRiscZeroVerifier.sol";
import {RiscZeroVerifierEmergencyStop} from "risc0/RiscZeroVerifierEmergencyStop.sol";
import {RiscZeroMockVerifier} from "risc0/test/RiscZeroMockVerifier.sol";
import {Challenge, SettlementStatus} from "../src/Challenge.sol";
import {IReferee, Outcome} from "../src/interfaces/IReferee.sol";
import {ProofBounty} from "../src/ProofBounty.sol";
import {Season} from "../src/Season.sol";
import {ScoredOutcome, ZkReferee} from "../src/ZkReferee.sol";
import {calldataGasOf, journalOf, runOf} from "./Challenge.t.sol";
import {settlementEndOf} from "./Season.t.sol";
import {
    PlayedLevel,
    SettlementFixture,
    journalBytesOf,
    journalHashesOf,
    levelBytesOf,
    settlementOf,
    MODE_CHALLENGE
} from "./Settlement.t.sol";

uint256 constant BOUNTY = 20_000_000_000_000;

contract RejectingReceiver {
    function post(ProofBounty bounty, uint256 runId) external payable {
        bounty.post{value: msg.value}(runId);
    }

    function refund(ProofBounty bounty, uint256 runId) external {
        bounty.refund(runId, address(this));
    }

    receive() external payable {
        revert("rejects ETH");
    }
}

contract ReenteringDepositor {
    ProofBounty private immutable bounty;
    uint256 private runId;
    bool public reentryReverted;

    constructor(ProofBounty bounty_) {
        bounty = bounty_;
    }

    function post(uint256 runId_) external payable {
        runId = runId_;
        bounty.post{value: msg.value}(runId_);
    }

    function refund() external {
        bounty.refund(runId, address(this));
    }

    receive() external payable {
        try bounty.refund(runId, address(this)) {}
        catch {
            reentryReverted = true;
        }
    }
}

contract ReenteringPayee {
    ProofBounty private immutable bounty;
    uint256 public received;

    constructor(ProofBounty bounty_) {
        bounty = bounty_;
    }

    receive() external payable {
        received += msg.value;
        bounty.withdraw(address(this));
    }
}

/// ProofBounty over the real Challenge, Season and ZkReferee. ZkReferee calls RISC Zero's emergency
/// stop over RISC Zero's mock verifier, whose seal is the selector and the claim digest, so a test
/// makes the proof of any public values. The calibration season of SettlementFixture settles
/// through MockReferee; the next one, opened at its end, through ZkReferee.
abstract contract BountyFixture is SettlementFixture {
    bytes4 internal constant MOCK_SELECTOR = 0xffffffff;
    bytes32 internal constant IMAGE_ID = keccak256("the verify program");

    RiscZeroVerifierEmergencyStop internal emergencyStop;
    ZkReferee internal zkReferee;
    ProofBounty internal bounty;
    uint256 internal mockSeasonRunId;
    address internal guardian = makeAddr("guardian");
    address internal prover = makeAddr("prover");
    address internal otherProver = makeAddr("otherProver");
    address internal carol = makeAddr("carol");

    function setUp() public virtual override {
        super.setUp();
        (mockSeasonRunId,) = committedRun();
        emergencyStop = new RiscZeroVerifierEmergencyStop(new RiscZeroMockVerifier(MOCK_SELECTOR), guardian);
        zkReferee = new ZkReferee(emergencyStop, IMAGE_ID, calibrationRulesVersion);
        vm.warp(season.endOf(number));
        number = openSeason(calibrationParams(zkReferee));
        bounty = new ProofBounty(challenge, zkReferee);
        vm.deal(carol, 1 ether);
    }

    function runPublicValues(PlayedLevel[6] memory played, address payee) internal pure returns (bytes memory) {
        ScoredOutcome[6] memory scored;
        for (uint256 i; i < 6; ++i) {
            scored[i] = ScoredOutcome(played[i].weightBp, played[i].outcome);
        }
        return abi.encode(scored, payee);
    }

    function proofOf(bytes memory publicValues) internal pure returns (bytes memory) {
        bytes32 claimDigest = ReceiptClaimLib.digest(ReceiptClaimLib.ok(IMAGE_ID, sha256(publicValues)));
        return abi.encode(abi.encodePacked(MOCK_SELECTOR, claimDigest), publicValues);
    }

    function runProof(PlayedLevel[6] memory played, address payee) internal pure returns (bytes memory) {
        return proofOf(runPublicValues(played, payee));
    }

    function levelProof(PlayedLevel memory played, address payee) internal pure returns (bytes memory) {
        return proofOf(abi.encode(ScoredOutcome(played.weightBp, played.outcome), payee));
    }

    function postAs(address depositor, uint256 runId, uint256 amount) internal {
        vm.prank(depositor);
        bounty.post{value: amount}(runId);
    }

    function claim(uint256 runId, PlayedLevel[6] memory played, bytes memory proof) internal {
        bounty.claim(runId, levelBytesOf(played), journalBytesOf(played), proof);
    }

    function expectClaimRevert(uint256 runId, PlayedLevel[6] memory played, bytes memory proof, bytes memory revertData)
        internal
    {
        bytes[6] memory levels = levelBytesOf(played);
        bytes[6] memory journals = journalBytesOf(played);
        vm.expectRevert(revertData);
        bounty.claim(runId, levels, journals, proof);
    }

    function settleDirectly(uint256 runId, PlayedLevel[6] memory played, bytes memory proof) internal {
        challenge.settleRun(runId, levelBytesOf(played), journalBytesOf(played), proof);
    }

    function statusOf(uint256 runId) internal view returns (SettlementStatus) {
        return settlementOf(challenge, runId).status;
    }

    function settlementEnd() internal view returns (uint256) {
        return settlementEndOf(season, number);
    }
}

contract ZkRefereePayeeTest is BountyFixture {
    function test_VerifyRun_ReturnsTheOutcomesOfPublicValuesWithAPayee() public {
        (, PlayedLevel[6] memory played) = committedRun();
        uint16[6] memory weightsBp;
        for (uint256 i; i < 6; ++i) {
            weightsBp[i] = played[i].weightBp;
        }
        Outcome[6] memory outcomes =
            zkReferee.verifyRun(levelBytesOf(played), journalBytesOf(played), weightsBp, runProof(played, prover));
        assertEq(abi.encode(outcomes[5]), abi.encode(played[5].outcome));
    }

    function test_VerifyRun_RevertsOnPublicValuesWithoutAPayee() public {
        (, PlayedLevel[6] memory played) = committedRun();
        ScoredOutcome[6] memory scored;
        for (uint256 i; i < 6; ++i) {
            scored[i] = ScoredOutcome(played[i].weightBp, played[i].outcome);
        }
        uint16[6] memory weightsBp;
        bytes memory proof = proofOf(abi.encode(scored));
        vm.expectRevert(abi.encodeWithSelector(ZkReferee.PublicValuesLengthMismatch.selector, 2_304, 2_336));
        zkReferee.verifyRun(levelBytesOf(played), journalBytesOf(played), weightsBp, proof);
    }

    function test_VerifyRun_RevertsOnAnotherPayeeUnderTheSameSeal() public {
        (, PlayedLevel[6] memory played) = committedRun();
        (bytes memory seal,) = abi.decode(runProof(played, prover), (bytes, bytes));
        bytes memory proof = abi.encode(seal, runPublicValues(played, carol));
        uint16[6] memory weightsBp;
        vm.expectRevert(VerificationFailed.selector);
        zkReferee.verifyRun(levelBytesOf(played), journalBytesOf(played), weightsBp, proof);
    }

    function test_Verify_ReturnsTheOutcomeOfPublicValuesWithAPayee() public {
        (, PlayedLevel[6] memory played) = committedRun();
        Outcome memory outcome =
            zkReferee.verify(played[2].level, played[2].journal, played[2].weightBp, levelProof(played[2], prover));
        assertEq(abi.encode(outcome), abi.encode(played[2].outcome));
    }

    function test_PayeeOf_ReturnsTheRunProofsPayee() public {
        (, PlayedLevel[6] memory played) = committedRun();
        assertEq(zkReferee.payeeOf(runProof(played, prover)), prover);
    }

    function test_PayeeOf_RevertsOnALevelProof() public {
        (, PlayedLevel[6] memory played) = committedRun();
        bytes memory proof = levelProof(played[0], prover);
        vm.expectRevert(abi.encodeWithSelector(ZkReferee.PublicValuesLengthMismatch.selector, 416, 2_336));
        zkReferee.payeeOf(proof);
    }

    function test_PayeeOf_RevertsOnAPayeeWordThatIsNotAnAddress() public {
        (, PlayedLevel[6] memory played) = committedRun();
        bytes memory publicValues = runPublicValues(played, prover);
        publicValues[2_304] = 0x01;
        bytes memory proof = proofOf(publicValues);
        vm.expectRevert();
        zkReferee.payeeOf(proof);
    }

    function test_Gas_PayeeOf() public {
        (, PlayedLevel[6] memory played) = committedRun();
        zkReferee.payeeOf(runProof(played, prover));
        emit log_named_uint("payeeOf gas", vm.lastCallGas().gasTotalUsed);
    }
}

contract ProofBountyTest is BountyFixture {
    // Construction.

    function test_Constructor_TakesSeasonFromChallenge() public view {
        assertEq(address(bounty.seasons()), address(season));
    }

    function test_Constructor_RevertsOnNoChallenge() public {
        vm.expectRevert(ProofBounty.ZeroAddress.selector);
        new ProofBounty(Challenge(address(0)), zkReferee);
    }

    function test_Constructor_RevertsOnNoReferee() public {
        vm.expectRevert(ProofBounty.ZeroAddress.selector);
        new ProofBounty(challenge, ZkReferee(address(0)));
    }

    // post.

    function test_Post_AddsTheDepositToTheRunsBounty() public {
        (uint256 runId,) = committedRun();
        vm.expectEmit(address(bounty));
        emit ProofBounty.BountyPosted(runId, alice, BOUNTY, BOUNTY);
        postAs(alice, runId, BOUNTY);
        assertEq(bounty.bountyOf(runId), BOUNTY, "bounty");
        assertEq(bounty.depositOf(runId, alice), BOUNTY, "deposit");
        assertEq(address(bounty).balance, BOUNTY, "balance");
    }

    function test_Post_ATopUpAddsToTheSameDeposit() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.expectEmit(address(bounty));
        emit ProofBounty.BountyPosted(runId, alice, 5, BOUNTY + 5);
        postAs(alice, runId, 5);
        assertEq(bounty.depositOf(runId, alice), BOUNTY + 5);
    }

    function test_Post_ASecondDepositorAddsToTheBountyUnderItsOwnDeposit() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        postAs(carol, runId, 7);
        assertEq(bounty.bountyOf(runId), BOUNTY + 7, "bounty");
        assertEq(bounty.depositOf(runId, carol), 7, "carol's deposit");
        assertEq(bounty.depositOf(runId, alice), BOUNTY, "alice's deposit");
    }

    function test_Post_RevertsWithNoValue() public {
        (uint256 runId,) = committedRun();
        vm.expectRevert(ProofBounty.ZeroDeposit.selector);
        bounty.post(runId);
    }

    function test_Post_RevertsOnARunNotCommitted() public {
        uint256 runId = startAndRevealAs(alice, number);
        vm.expectRevert(abi.encodeWithSelector(Challenge.NotCommitted.selector, runId));
        vm.prank(alice);
        bounty.post{value: BOUNTY}(runId);
    }

    function test_Post_RevertsOnARunThatDoesNotExist() public {
        vm.expectRevert(abi.encodeWithSelector(Challenge.NotCommitted.selector, 999));
        vm.prank(alice);
        bounty.post{value: BOUNTY}(999);
    }

    function test_Post_RevertsOnARunOfASeasonWithAnotherReferee() public {
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.WrongReferee.selector, mockSeasonRunId, referee));
        vm.prank(alice);
        bounty.post{value: BOUNTY}(mockSeasonRunId);
    }

    function test_Post_RevertsOnASettledRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleDirectly(runId, played, runProof(played, prover));
        vm.expectRevert(abi.encodeWithSelector(Challenge.AlreadySettled.selector, runId));
        vm.prank(alice);
        bounty.post{value: BOUNTY}(runId);
    }

    function test_Post_SucceedsAtTheSettlementEnd() public {
        (uint256 runId,) = committedRun();
        vm.warp(settlementEnd());
        postAs(alice, runId, BOUNTY);
        assertEq(bounty.bountyOf(runId), BOUNTY);
    }

    function test_Post_RevertsAfterTheSettlementEnd() public {
        (uint256 runId,) = committedRun();
        vm.warp(settlementEnd() + 1);
        vm.expectRevert(abi.encodeWithSelector(Challenge.SettlementClosed.selector, runId, settlementEnd()));
        vm.prank(alice);
        bounty.post{value: BOUNTY}(runId);
    }

    // claim, on an unsettled run.

    function test_Claim_SettlesTheRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        claim(runId, played, runProof(played, prover));
        assertRecorded(runId, played);
    }

    function test_Claim_CreditsTheBountyToTheProofsPayee() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.expectEmit(address(bounty));
        emit ProofBounty.BountyPaid(runId, prover, BOUNTY);
        vm.prank(prover);
        claim(runId, played, runProof(played, prover));
        assertEq(bounty.owed(prover), BOUNTY, "owed");
        assertEq(bounty.bountyOf(runId), 0, "bounty");
    }

    function test_Claim_CreditsThePayeeWhenAnotherAddressSubmitsTheProof() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.prank(carol);
        claim(runId, played, runProof(played, prover));
        assertEq(bounty.owed(prover), BOUNTY, "the prover is credited");
        assertEq(bounty.owed(carol), 0, "the submitter is not");
    }

    function test_Claim_CreditsTheWholeBountyOfSeveralDepositors() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        postAs(carol, runId, 7);
        claim(runId, played, runProof(played, prover));
        assertEq(bounty.owed(prover), BOUNTY + 7);
    }

    function test_Claim_PaysForALateRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        postAs(alice, runId, BOUNTY);
        claim(runId, played, runProof(played, prover));
        assertEq(uint8(statusOf(runId)), uint8(SettlementStatus.Late), "status");
        assertEq(bounty.owed(prover), BOUNTY, "owed");
    }

    function test_Claim_SettlesARunAfterTwoSettleLevelCalls() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        for (uint8 i; i < 2; ++i) {
            challenge.settleLevel(
                runId, i, journalHashesOf(played), played[i].level, played[i].journal, levelProof(played[i], carol)
            );
        }
        claim(runId, played, runProof(played, prover));
        assertEq(bounty.owed(prover), BOUNTY);
    }

    function test_Claim_RevertsWithNoBounty() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        expectClaimRevert(
            runId, played, runProof(played, prover), abi.encodeWithSelector(ProofBounty.NoBounty.selector, runId)
        );
    }

    function test_Claim_RevertsOnASecondClaim() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        claim(runId, played, runProof(played, prover));
        expectClaimRevert(
            runId, played, runProof(played, otherProver), abi.encodeWithSelector(ProofBounty.NoBounty.selector, runId)
        );
    }

    function test_Claim_RevertsOnAProofThatNamesNoPayee() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        expectClaimRevert(
            runId, played, runProof(played, address(0)), abi.encodeWithSelector(ProofBounty.ZeroPayee.selector, runId)
        );
    }

    function test_Claim_RevertsOnAnotherPayeeUnderTheSameSeal() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        (bytes memory seal,) = abi.decode(runProof(played, prover), (bytes, bytes));
        bytes memory stolen = abi.encode(seal, runPublicValues(played, carol));
        expectClaimRevert(runId, played, stolen, abi.encodeWithSelector(VerificationFailed.selector));
    }

    function test_Claim_RevertsAndKeepsTheBountyOnARejectedSettlement() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        bytes memory proof = runProof(played, prover);
        played[3].journal[played[3].journal.length - 1] ^= 0x01;
        expectClaimRevert(runId, played, proof, abi.encodeWithSelector(Challenge.WrongCommitment.selector, runId));
        assertEq(bounty.bountyOf(runId), BOUNTY);
    }

    function test_Claim_RevertsOnAnUnsettledRunAfterTheSettlementEnd() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.warp(settlementEnd() + 1);
        expectClaimRevert(
            runId,
            played,
            runProof(played, prover),
            abi.encodeWithSelector(Challenge.SettlementClosed.selector, runId, settlementEnd())
        );
    }

    function test_Claim_RevertsOnceTheVerifierIsStopped() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.prank(guardian);
        emergencyStop.estop();
        expectClaimRevert(
            runId, played, runProof(played, prover), abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
    }

    // claim, on a run that someone already settled.

    function test_Claim_PaysTheProverWhoseCopiedProofSettledTheRunDirectly() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        bytes memory proof = runProof(played, prover);
        vm.prank(carol);
        settleDirectly(runId, played, proof);
        vm.prank(prover);
        claim(runId, played, proof);
        assertEq(bounty.owed(prover), BOUNTY);
    }

    function test_Claim_PaysTheFirstProofPresentedForASettledRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        settleDirectly(runId, played, runProof(played, address(0)));
        claim(runId, played, runProof(played, otherProver));
        assertEq(bounty.owed(otherProver), BOUNTY);
    }

    function test_Claim_PaysForARunSettledLateDirectly() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        postAs(alice, runId, BOUNTY);
        bytes memory proof = runProof(played, prover);
        settleDirectly(runId, played, proof);
        claim(runId, played, proof);
        assertEq(bounty.owed(prover), BOUNTY);
    }

    function test_Claim_PaysForARunSettledLevelByLevel() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        for (uint8 i; i < 6; ++i) {
            challenge.settleLevel(
                runId, i, journalHashesOf(played), played[i].level, played[i].journal, levelProof(played[i], carol)
            );
        }
        claim(runId, played, runProof(played, prover));
        assertEq(bounty.owed(prover), BOUNTY);
    }

    function test_Claim_PaysForASettledRunAfterTheSettlementEnd() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        bytes memory proof = runProof(played, prover);
        settleDirectly(runId, played, proof);
        vm.warp(settlementEnd() + 1);
        claim(runId, played, proof);
        assertEq(bounty.owed(prover), BOUNTY);
    }

    function test_Claim_OnASettledRunRevertsOnAnotherPayeeUnderTheSameSeal() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        bytes memory proof = runProof(played, prover);
        settleDirectly(runId, played, proof);
        (bytes memory seal,) = abi.decode(proof, (bytes, bytes));
        bytes memory stolen = abi.encode(seal, runPublicValues(played, carol));
        expectClaimRevert(runId, played, stolen, abi.encodeWithSelector(VerificationFailed.selector));
    }

    function test_Claim_OnASettledRunRevertsWithJournalsNotInItsCommitment() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        bytes memory proof = runProof(played, prover);
        settleDirectly(runId, played, proof);
        played[3].journal[played[3].journal.length - 1] ^= 0x01;
        expectClaimRevert(runId, played, proof, abi.encodeWithSelector(Challenge.WrongCommitment.selector, runId));
    }

    function test_Claim_OnASettledRunRevertsWithTheProofOfAnotherRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        settleDirectly(runId, played, runProof(played, address(0)));
        (, PlayedLevel[6] memory others) = committedRun();
        expectClaimRevert(
            runId,
            played,
            runProof(others, prover),
            abi.encodeWithSelector(
                ZkReferee.JournalHashMismatch.selector, 0, keccak256(others[0].journal), keccak256(played[0].journal)
            )
        );
    }

    function test_Claim_OnASettledRunRevertsWithALevelNotInTheSeason() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        bytes memory proof = runProof(played, prover);
        settleDirectly(runId, played, proof);
        played[1].level = "not a level";
        expectClaimRevert(
            runId,
            played,
            proof,
            abi.encodeWithSelector(Season.LevelNotInSeason.selector, number, keccak256(played[1].level))
        );
    }

    // refund.

    function test_Refund_ReturnsTheDepositOfARunLeftUnsettled() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.warp(settlementEnd() + 1);
        uint256 balance = alice.balance;
        vm.expectEmit(address(bounty));
        emit ProofBounty.BountyRefunded(runId, alice, BOUNTY);
        vm.prank(alice);
        bounty.refund(runId, alice);
        assertEq(alice.balance, balance + BOUNTY, "alice's balance");
        assertEq(bounty.bountyOf(runId), 0, "bounty");
        assertEq(bounty.depositOf(runId, alice), 0, "deposit");
    }

    function test_Refund_PaysTheDepositorWhenAnotherAddressCalls() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.warp(settlementEnd() + 1);
        uint256 balance = alice.balance;
        uint256 callerBalance = carol.balance;
        vm.prank(carol);
        bounty.refund(runId, alice);
        assertEq(alice.balance, balance + BOUNTY, "the depositor is paid");
        assertEq(carol.balance, callerBalance, "the caller is not");
    }

    function test_Refund_RevertsAtTheSettlementEnd() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.warp(settlementEnd());
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.SettlementOpen.selector, runId, settlementEnd()));
        vm.prank(alice);
        bounty.refund(runId, alice);
    }

    function test_Refund_RevertsForAnAddressWithNoDeposit() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.warp(settlementEnd() + 1);
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.NoDeposit.selector, runId, carol));
        vm.prank(carol);
        bounty.refund(runId, carol);
    }

    function test_Refund_RevertsOnASecondRefund() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.warp(settlementEnd() + 1);
        vm.prank(alice);
        bounty.refund(runId, alice);
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.NoDeposit.selector, runId, alice));
        vm.prank(alice);
        bounty.refund(runId, alice);
    }

    function test_Refund_ReturnsEachDepositorItsOwnDeposit() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        postAs(carol, runId, 7);
        vm.warp(settlementEnd() + 1);
        uint256 balance = carol.balance;
        vm.prank(carol);
        bounty.refund(runId, carol);
        assertEq(carol.balance, balance + 7, "carol's balance");
        assertEq(bounty.bountyOf(runId), BOUNTY, "alice's deposit stays");
    }

    function test_Refund_RevertsOnAPaidBounty() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        claim(runId, played, runProof(played, prover));
        vm.warp(settlementEnd() + bounty.CLAIM_GRACE() + 1);
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.NoBounty.selector, runId));
        vm.prank(alice);
        bounty.refund(runId, alice);
    }

    function test_Refund_RevertsOnASettledRunUntilTheClaimGraceHasPassed() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        settleDirectly(runId, played, runProof(played, address(0)));
        uint256 claimEnd = settlementEnd() + bounty.CLAIM_GRACE();
        vm.warp(claimEnd);
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.ClaimOpen.selector, runId, claimEnd));
        vm.prank(alice);
        bounty.refund(runId, alice);
    }

    function test_Refund_ReturnsTheUnclaimedDepositOfASettledRunAfterTheClaimGrace() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        settleDirectly(runId, played, runProof(played, address(0)));
        vm.warp(settlementEnd() + bounty.CLAIM_GRACE() + 1);
        uint256 balance = alice.balance;
        vm.prank(alice);
        bounty.refund(runId, alice);
        assertEq(alice.balance, balance + BOUNTY);
    }

    function test_Refund_LeavesTheOtherDepositsOfASettledRunClaimable() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        postAs(carol, runId, 7);
        settleDirectly(runId, played, runProof(played, address(0)));
        vm.warp(settlementEnd() + bounty.CLAIM_GRACE() + 1);
        vm.prank(carol);
        bounty.refund(runId, carol);
        claim(runId, played, runProof(played, prover));
        assertEq(bounty.owed(prover), BOUNTY);
    }

    function test_Refund_RevertsAndKeepsTheDepositWhenTheDepositorRejectsEth() public {
        (uint256 runId,) = committedRun();
        RejectingReceiver depositor = new RejectingReceiver();
        depositor.post{value: BOUNTY}(bounty, runId);
        vm.warp(settlementEnd() + 1);
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.TransferFailed.selector, depositor, BOUNTY));
        depositor.refund(bounty, runId);
        assertEq(bounty.depositOf(runId, address(depositor)), BOUNTY);
    }

    function test_Refund_ReenteredFromTheDepositorPaysNothingMore() public {
        (uint256 runId,) = committedRun();
        ReenteringDepositor depositor = new ReenteringDepositor(bounty);
        depositor.post{value: BOUNTY}(runId);
        postAs(alice, runId, BOUNTY);
        vm.warp(settlementEnd() + 1);
        depositor.refund();
        assertTrue(depositor.reentryReverted(), "the second refund reverts");
        assertEq(address(depositor).balance, BOUNTY, "the depositor's balance");
        assertEq(bounty.bountyOf(runId), BOUNTY, "alice's deposit stays");
    }

    // withdraw.

    function test_Withdraw_SendsThePayeeWhatItIsOwedWhoeverCalls() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        claim(runId, played, runProof(played, prover));
        vm.expectEmit(address(bounty));
        emit ProofBounty.Withdrawn(prover, BOUNTY);
        vm.prank(carol);
        uint256 amount = bounty.withdraw(prover);
        assertEq(amount, BOUNTY, "amount");
        assertEq(prover.balance, BOUNTY, "the prover's balance");
        assertEq(bounty.owed(prover), 0, "owed");
    }

    function test_Withdraw_ReturnsZeroWhenNothingIsOwed() public {
        assertEq(bounty.withdraw(prover), 0);
    }

    function test_Withdraw_ReenteredFromThePayeePaysNothingMore() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        (uint256 otherRunId,) = committedRun();
        ReenteringPayee payee = new ReenteringPayee(bounty);
        postAs(alice, runId, BOUNTY);
        postAs(alice, otherRunId, BOUNTY);
        claim(runId, played, runProof(played, address(payee)));
        bounty.withdraw(address(payee));
        assertEq(payee.received(), BOUNTY, "the payee's balance");
        assertEq(address(bounty).balance, BOUNTY, "the other run's bounty stays");
    }

    function test_Withdraw_RevertsAndKeepsTheCreditWhenThePayeeRejectsEth() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        RejectingReceiver payee = new RejectingReceiver();
        postAs(alice, runId, BOUNTY);
        claim(runId, played, runProof(played, address(payee)));
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.TransferFailed.selector, payee, BOUNTY));
        bounty.withdraw(address(payee));
        assertEq(bounty.owed(address(payee)), BOUNTY);
    }

    function test_ReceiveRejectsPlainEth() public {
        vm.prank(alice);
        (bool sent,) = address(bounty).call{value: 1}("");
        assertFalse(sent);
    }
}
