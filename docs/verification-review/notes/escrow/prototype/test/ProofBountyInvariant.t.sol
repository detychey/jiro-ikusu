// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {ReceiptClaimLib} from "risc0/IRiscZeroVerifier.sol";
import {RiscZeroMockVerifier} from "risc0/test/RiscZeroMockVerifier.sol";
import {Challenge, Run, SettlementStatus} from "../src/Challenge.sol";
import {MockArbSys} from "../src/mocks/MockArbSys.sol";
import {ProofBounty} from "../src/ProofBounty.sol";
import {Season} from "../src/Season.sol";
import {ScoredOutcome, ZkReferee} from "../src/ZkReferee.sol";
import {ChallengeFixture, MAX_PLAY_SECONDS, REVEAL_DELAY, runOf} from "./Challenge.t.sol";
import {RULES_VERSION, RUN_FEE, defaultParams} from "./Season.t.sol";
import {PlayedLevel, defaultPlayedLevelOf, journalBytesOf, levelBytesOf, settlementOf} from "./Settlement.t.sol";

bytes4 constant MOCK_SELECTOR = 0xffffffff;
bytes32 constant IMAGE_ID = keccak256("the verify program");

/// Runs committed on either side of their deadline, deposits, claims on unsettled and on settled
/// runs, direct settlements with a proof that names no payee, refunds and withdrawals, every input
/// bounded to a valid one so that no call reverts. A run's id decides its fate, so that every path
/// is reached: nobody proves one run in three, as if replay rejected its journals; one in three
/// settles only directly, and is seldom claimed afterwards; the last third is claimed unsettled.
contract BountyHandler is CommonBase, StdCheats, StdUtils {
    uint256 private constant NEVER_PROVEN = 0;
    uint256 private constant SETTLED_DIRECTLY = 1;

    Challenge private immutable challenge;
    Season private immutable season;
    MockArbSys private immutable arbSys;
    ProofBounty private immutable bounty;
    uint256 private immutable number;

    address[] public actors;
    address[] public payees;
    uint256[] public runIds;
    uint256 public deposited;
    uint256 public refunded;
    uint256 public withdrawn;
    mapping(uint256 runId => uint256) public depositedOn;
    mapping(uint256 runId => uint256) public paidOn;
    mapping(uint256 runId => uint256) public refundedOn;
    /// Successful calls by path: posts, claims on unsettled and settled runs, direct settlements,
    /// refunds of unsettled and settled runs, withdrawals that sent ETH.
    uint256[7] public pathCalls;

    constructor(Challenge challenge_, Season season_, MockArbSys arbSys_, ProofBounty bounty_, uint256 number_) {
        challenge = challenge_;
        season = season_;
        arbSys = arbSys_;
        bounty = bounty_;
        number = number_;
        for (uint256 i; i < 3; ++i) {
            actors.push(makeAddr(string.concat("actor", vm.toString(i))));
            vm.deal(actors[i], 100 ether);
            payees.push(makeAddr(string.concat("payee", vm.toString(i))));
        }
    }

    function runCount() external view returns (uint256) {
        return runIds.length;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function payeeCount() external view returns (uint256) {
        return payees.length;
    }

    function playedLevelsOf(bytes32 runNonce) private pure returns (PlayedLevel[6] memory played) {
        uint8 firstSlot = uint8(runNonce[0]) % 16;
        for (uint8 i; i < 6; ++i) {
            uint256 result = uint256(keccak256(abi.encode(runNonce, i)));
            played[i] = defaultPlayedLevelOf(
                runNonce,
                i,
                (firstSlot + i) % 16,
                uint8(1 + result % 4),
                uint16((result >> 8) % 10_001),
                uint16(1 + (result >> 32) % 2_700)
            );
        }
    }

    function proofOf(PlayedLevel[6] memory played, address payee) private pure returns (bytes memory) {
        ScoredOutcome[6] memory scored;
        for (uint256 i; i < 6; ++i) {
            scored[i] = ScoredOutcome(played[i].weightBp, played[i].outcome);
        }
        bytes memory publicValues = abi.encode(scored, payee);
        bytes32 claimDigest = ReceiptClaimLib.digest(ReceiptClaimLib.ok(IMAGE_ID, sha256(publicValues)));
        return abi.encode(abi.encodePacked(MOCK_SELECTOR, claimDigest), publicValues);
    }

    function commitRun(uint256 actorSeed, uint256 delaySeed) external {
        if (block.timestamp + MAX_PLAY_SECONDS + 120 >= season.endOf(number) || runIds.length == 12) return;
        address player = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.prank(player);
        uint256 runId = challenge.startRun{value: RUN_FEE}(number);
        arbSys.setBlockNumber(arbSys.arbBlockNumber() + REVEAL_DELAY + 1);
        vm.prank(player);
        challenge.revealRun(runId);
        Run memory run = runOf(challenge, runId);
        vm.warp(block.timestamp + bound(delaySeed, 0, MAX_PLAY_SECONDS + season.commitSlackOf(number)));
        vm.prank(player);
        challenge.commitRun(runId, journalBytesOf(playedLevelsOf(run.runNonce)));
        runIds.push(runId);
    }

    function post(uint256 runSeed, uint256 actorSeed, uint256 amount) external {
        if (runIds.length == 0) return;
        uint256 runId = runIds[bound(runSeed, 0, runIds.length - 1)];
        if (
            settlementOf(challenge, runId).status != SettlementStatus.Unsettled
                || block.timestamp > season.settlementEndOf(number)
        ) return;
        amount = bound(amount, 1, 1 ether);
        vm.prank(actors[bound(actorSeed, 0, actors.length - 1)]);
        bounty.post{value: amount}(runId);
        deposited += amount;
        depositedOn[runId] += amount;
        ++pathCalls[0];
    }

    function claim(uint256 runSeed, uint256 payeeSeed, uint256 submitterSeed) external {
        if (runIds.length == 0) return;
        uint256 runId = runIds[bound(runSeed, 0, runIds.length - 1)];
        uint256 amount = bounty.bountyOf(runId);
        bool unsettled = settlementOf(challenge, runId).status == SettlementStatus.Unsettled;
        if (amount == 0 || (unsettled && block.timestamp > season.settlementEndOf(number))) return;
        if (runId % 3 == NEVER_PROVEN || (runId % 3 == SETTLED_DIRECTLY && (unsettled || payeeSeed % 8 != 0))) return;
        PlayedLevel[6] memory played = playedLevelsOf(runOf(challenge, runId).runNonce);
        address payee = payees[bound(payeeSeed, 0, payees.length - 1)];
        vm.prank(actors[bound(submitterSeed, 0, actors.length - 1)]);
        bounty.claim(runId, levelBytesOf(played), journalBytesOf(played), proofOf(played, payee));
        paidOn[runId] += amount;
        ++pathCalls[unsettled ? 1 : 2];
    }

    function settleDirectly(uint256 runSeed) external {
        if (runIds.length == 0) return;
        uint256 runId = runIds[bound(runSeed, 0, runIds.length - 1)];
        if (
            runId % 3 != SETTLED_DIRECTLY || settlementOf(challenge, runId).status != SettlementStatus.Unsettled
                || block.timestamp > season.settlementEndOf(number)
        ) return;
        PlayedLevel[6] memory played = playedLevelsOf(runOf(challenge, runId).runNonce);
        challenge.settleRun(runId, levelBytesOf(played), journalBytesOf(played), proofOf(played, address(0)));
        ++pathCalls[3];
    }

    function refund(uint256 runSeed, uint256 actorSeed) external {
        if (runIds.length == 0) return;
        uint256 runId = runIds[bound(runSeed, 0, runIds.length - 1)];
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        bool unsettled = settlementOf(challenge, runId).status == SettlementStatus.Unsettled;
        uint256 refundableFrom = season.settlementEndOf(number) + (unsettled ? 0 : bounty.CLAIM_GRACE());
        if (bounty.depositOf(runId, actor) == 0 || bounty.bountyOf(runId) == 0 || block.timestamp <= refundableFrom) {
            return;
        }
        uint256 amount = bounty.refund(runId, actor);
        refunded += amount;
        refundedOn[runId] += amount;
        ++pathCalls[unsettled ? 4 : 5];
    }

    function withdraw(uint256 payeeSeed) external {
        uint256 amount = bounty.withdraw(payees[bound(payeeSeed, 0, payees.length - 1)]);
        withdrawn += amount;
        if (amount != 0) ++pathCalls[6];
    }

    function warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + bound(secondsSeed, 0, 16 hours));
    }

    /// Once enough runs hold deposits: jumps to the season's settlement end, or one second past it.
    function warpToSettlementEnd(uint256 offsetSeed) external {
        uint256 target = season.settlementEndOf(number) + bound(offsetSeed, 0, 1);
        if (pathCalls[0] >= 12 && target > block.timestamp) vm.warp(target);
    }

    /// Once the settlement has closed: jumps to the end of the claim grace, or one second past it.
    function warpToClaimEnd(uint256 offsetSeed) external {
        uint256 settlementEnd = season.settlementEndOf(number);
        uint256 target = settlementEnd + bounty.CLAIM_GRACE() + bound(offsetSeed, 0, 1);
        if (block.timestamp > settlementEnd && target > block.timestamp) vm.warp(target);
    }
}

contract ProofBountyInvariantTest is ChallengeFixture {
    ProofBounty private bounty;
    BountyHandler private handler;

    function setUp() public override {
        super.setUp();
        ZkReferee zkReferee = new ZkReferee(new RiscZeroMockVerifier(MOCK_SELECTOR), IMAGE_ID, RULES_VERSION);
        uint256 number = openSeason(defaultParams(zkReferee));
        bounty = new ProofBounty(challenge, zkReferee);
        handler = new BountyHandler(challenge, season, arbSys, bounty, number);
        targetContract(address(handler));
    }

    function afterInvariant() external {
        string[7] memory paths = [
            "posts",
            "claims on unsettled runs",
            "claims on settled runs",
            "direct settlements",
            "refunds of unsettled runs",
            "refunds of settled runs",
            "withdrawals"
        ];
        for (uint256 i; i < 7; ++i) {
            emit log_named_uint(paths[i], handler.pathCalls(i));
        }
        emit log_named_uint("runs", handler.runCount());
    }

    function invariant_TheBalanceIsWhatWasDepositedAndNotYetSentBack() public view {
        assertEq(address(bounty).balance, handler.deposited() - handler.refunded() - handler.withdrawn());
    }

    function invariant_TheBalanceEqualsTheBountiesAndWhatPayeesAreOwed() public view {
        uint256 held;
        for (uint256 r; r < handler.runCount(); ++r) {
            held += bounty.bountyOf(handler.runIds(r));
        }
        for (uint256 p; p < handler.payeeCount(); ++p) {
            held += bounty.owed(handler.payees(p));
        }
        assertEq(address(bounty).balance, held);
    }

    function invariant_AnUnpaidBountyIsTheSumOfItsDeposits() public view {
        for (uint256 r; r < handler.runCount(); ++r) {
            uint256 runId = handler.runIds(r);
            if (handler.paidOn(runId) != 0) continue;
            uint256 deposits;
            for (uint256 a; a < handler.actorCount(); ++a) {
                deposits += bounty.depositOf(runId, handler.actors(a));
            }
            assertEq(bounty.bountyOf(runId), deposits);
        }
    }

    function invariant_ARunsDepositsArePaidOrRefundedAtMostOnce() public view {
        for (uint256 r; r < handler.runCount(); ++r) {
            uint256 runId = handler.runIds(r);
            assertEq(
                handler.paidOn(runId) + handler.refundedOn(runId) + bounty.bountyOf(runId), handler.depositedOn(runId)
            );
        }
    }

    function invariant_OnlySettledRunsArePaid() public view {
        for (uint256 r; r < handler.runCount(); ++r) {
            uint256 runId = handler.runIds(r);
            if (handler.paidOn(runId) == 0) continue;
            assertTrue(settlementOf(challenge, runId).status != SettlementStatus.Unsettled);
        }
    }
}
