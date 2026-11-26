// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Challenge, SettlementStatus} from "../src/Challenge.sol";
import {ProofBounty} from "../src/ProofBounty.sol";
import {BountyFixture} from "./ProofBounty.t.sol";
import {PlayedLevel, journalBytesOf} from "./Settlement.t.sol";

contract RedTeamOrderingTest is BountyFixture {
    uint256 constant BAIT = 100_000_000_000_000;

    /// Run Y commits run X's journals: post accepts, a real proof of X can never claim Y on either
    /// branch, and the deposit returns only after the settlement end.
    function test_ForeignJournalsBaitIsPostableButNeverClaimable() public {
        (uint256 runX, PlayedLevel[6] memory played) = committedRun();
        uint256 runY = startAndRevealAs(alice, number);
        commitAs(alice, runY, journalBytesOf(played));
        postAs(carol, runY, BAIT);
        bytes memory proof = runProof(played, prover);
        expectClaimRevert(runY, played, proof,
            abi.encodeWithSelector(Challenge.OutcomeRunNonceMismatch.selector, 0, played[0].outcome.runNonce));
        settleDirectly(runX, played, proof);
        expectClaimRevert(runY, played, proof,
            abi.encodeWithSelector(Challenge.OutcomeRunNonceMismatch.selector, 0, played[0].outcome.runNonce));
        vm.warp(settlementEnd() + 1);
        assertEq(bounty.refund(runY, carol), BAIT);
    }

    /// The poster proves its own run and claims first: the honest prover's later claim reverts
    /// cheaply with NoBounty, after its proving time is spent.
    function test_SelfClaimBaitLeavesTheHonestProverNothing() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BAIT);
        claim(runId, played, runProof(played, alice));
        expectClaimRevert(runId, played, runProof(played, prover),
            abi.encodeWithSelector(ProofBounty.NoBounty.selector, runId));
        assertEq(bounty.owed(alice), BAIT);
    }
}
