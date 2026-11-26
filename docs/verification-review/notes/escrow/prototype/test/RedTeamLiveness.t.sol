// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Challenge} from "../src/Challenge.sol";
import {ProofBounty} from "../src/ProofBounty.sol";
import {PlayedLevel} from "./Settlement.t.sol";
import {BountyFixture, BOUNTY} from "./ProofBounty.t.sol";

contract RedTeamLivenessTest is BountyFixture {
    // A decoy: the player posts a large bounty on its own run while already holding a proof that
    // names itself, lets the honest prover work, then claims first and gets its money back.
    function test_DecoyBountyReturnsToTheDepositorAndStrandsTheHonestProver() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        uint256 decoy = 10 * BOUNTY;
        vm.deal(alice, decoy);
        postAs(alice, runId, decoy);
        claim(runId, played, runProof(played, alice));
        assertEq(bounty.owed(alice), decoy, "the decoy's money is back with the depositor");
        bytes memory honest = runProof(played, prover);
        expectClaimRevert(runId, played, honest, abi.encodeWithSelector(ProofBounty.NoBounty.selector, runId));
    }

    // After the emergency stop no claim can ever succeed, yet deposits stay locked until the end.
    function test_DepositsStayLockedUntilTheSettlementEndAfterTheStop() public {
        (uint256 runId,) = committedRun();
        postAs(alice, runId, BOUNTY);
        vm.prank(guardian);
        emergencyStop.estop();
        uint256 end = settlementEnd();
        emit log_named_uint("seconds locked after the stop", end - block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(ProofBounty.SettlementOpen.selector, runId, end));
        bounty.refund(runId, alice);
    }

    // A player who funds a bounty and then settles its own run directly hands the deposit to
    // whoever proves the run afterwards, for a proof that settles nothing.
    function test_SelfSettlingAfterPostingPaysAStrangerForNothing() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        postAs(alice, runId, BOUNTY);
        settleDirectly(runId, played, runProof(played, address(0)));
        claim(runId, played, runProof(played, otherProver));
        assertEq(bounty.owed(otherProver), BOUNTY, "a stranger is paid after the run settled");
    }
}
