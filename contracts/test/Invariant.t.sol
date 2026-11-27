// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArbBlockhashEntropy} from "../src/ArbBlockhashEntropy.sol";
import {Challenge, Run, Settlement, SettlementStatus} from "../src/Challenge.sol";
import {MockArbSys} from "../src/mocks/MockArbSys.sol";
import {MockReferee} from "../src/mocks/MockReferee.sol";
import {Season, PlayerTally} from "../src/Season.sol";
import {ChallengeFixture, ChallengeHandler, MAX_PLAY_SECONDS, runOf, sixJournalsOf} from "./Challenge.t.sol";
import {settlementEndOf, stateOf, tallyOf} from "./Season.t.sol";
import {
    PlayedLevel,
    TICKS_PER_SECOND,
    defaultPlayedLevelOf,
    journalHashesOf,
    journalBytesOf,
    levelBytesOf,
    setOutcomes,
    settlementOf
} from "./Settlement.t.sol";

/// ChallengeHandler's start, reveal and commit, plus settlement on both paths, the close, claims
/// and rake withdrawals, every input bounded to a valid one so that no call reverts. A run's six
/// Outcomes follow from its run nonce, as replay follows from the journals, so a run settles the
/// same on either path, on time or late depending on when it was committed.
contract SettlementHandler is ChallengeHandler {
    address private immutable treasury;
    mapping(uint256 season => uint256) public claimedOf;
    /// Claims that paid a player more than their run fees, which no claim may (README §8.4).
    uint256 public overpaidClaims;
    uint256 public paidOut;

    constructor(
        Challenge challenge_,
        Season season_,
        MockArbSys arbSys_,
        ArbBlockhashEntropy entropy_,
        MockReferee referee_,
        address operator_
    ) ChallengeHandler(challenge_, season_, arbSys_, entropy_, referee_, operator_) {
        treasury = season_.treasury();
    }

    function playersOf() external view returns (address[] memory) {
        return players;
    }

    /// Six consecutive slots from the run nonce, and for each level a result in the full range of
    /// the Outcome: any end reason, claim and ticks used.
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

    /// The first settleable run among the eight most recent, from a seeded one: committed,
    /// unsettled and within its settlement period. Run id 0 if there is none.
    function settleableRun(uint256 runSeed) private view returns (uint256 runId, Run memory run) {
        uint256 runCount = challenge.runCount();
        uint256 recent = runCount < 8 ? runCount : 8;
        for (uint256 k; k < recent; ++k) {
            runId = runCount - (runSeed % recent + k) % recent;
            run = runOf(challenge, runId);
            if (
                run.committedAt != 0 && settlementOf(challenge, runId).status == SettlementStatus.Unsettled
                    && block.timestamp <= season.settlementEndOf(run.season)
            ) return (runId, run);
        }
        return (0, run);
    }

    /// Commits one of the eight most recent runs that is revealed and not committed, at a seeded
    /// time within its commit window, so that runs land on both sides of their deadline.
    function commitRunAt(uint256 runSeed, uint256 delaySeed) external {
        uint256 runCount = challenge.runCount();
        uint256 recent = runCount < 8 ? runCount : 8;
        for (uint256 k; k < recent; ++k) {
            uint256 runId = runCount - (runSeed % recent + k) % recent;
            Run memory run = runOf(challenge, runId);
            uint256 commitWindow = MAX_PLAY_SECONDS + season.commitSlackOf(run.season);
            if (run.revealedAt == 0 || run.committedAt != 0 || block.timestamp > run.revealedAt + commitWindow) {
                continue;
            }
            uint256 commitAt = run.revealedAt + bound(delaySeed, 0, commitWindow);
            if (commitAt > block.timestamp) vm.warp(commitAt);
            vm.prank(run.player);
            challenge.commitRun(runId, sixJournalsOf(run.runNonce, 3, 30));
            return;
        }
    }

    function settleRun(uint256 runSeed, uint256 submitterSeed) external {
        (uint256 runId, Run memory run) = settleableRun(runSeed);
        if (runId == 0) return;
        PlayedLevel[6] memory played = playedLevelsOf(run.runNonce);
        setOutcomes(referee, played);
        vm.prank(players[bound(submitterSeed, 0, players.length - 1)]);
        challenge.settleRun(runId, levelBytesOf(played), journalBytesOf(played), "");
    }

    function settleLevel(uint256 runSeed, uint256 levelSeed) external {
        (uint256 runId, Run memory run) = settleableRun(runSeed);
        if (runId == 0) return;
        uint8 settledLevels = settlementOf(challenge, runId).settledLevels;
        uint8 i = uint8(bound(levelSeed, 0, 5));
        while (settledLevels & (1 << i) != 0) {
            i = (i + 1) % 6;
        }
        PlayedLevel[6] memory played = playedLevelsOf(run.runNonce);
        setOutcomes(referee, played);
        challenge.settleLevel(runId, i, journalHashesOf(played), played[i].level, played[i].journal, "");
    }

    /// Jumps to the end of the next season to close's settlement period, or one second past it.
    function warpToSettlementEnd(uint256 offsetSeed) external {
        uint256 number = season.lastClosedSeason() + 1;
        if (number > season.currentSeason()) return;
        uint256 target = settlementEndOf(season, number) + bound(offsetSeed, 0, 1);
        if (target > block.timestamp) vm.warp(target);
    }

    function closeSeason() external {
        uint256 number = season.lastClosedSeason() + 1;
        if (number > season.currentSeason() || block.timestamp <= settlementEndOf(season, number)) return;
        season.closeSeason();
    }

    /// Claims the first unclaimed prize among the closed seasons and the players, from seeded ones.
    function claim(uint256 playerSeed, uint256 seasonSeed) external {
        uint256 lastClosed = season.lastClosedSeason();
        for (uint256 s; s < lastClosed; ++s) {
            uint256 number = 1 + (seasonSeed % lastClosed + s) % lastClosed;
            for (uint256 p; p < players.length; ++p) {
                address player = players[(playerSeed % players.length + p) % players.length];
                PlayerTally memory tally = tallyOf(season, number, player);
                if (tally.games != 0 && !tally.claimed) {
                    claimAs(player, number);
                    return;
                }
            }
        }
    }

    function claimAs(address player, uint256 number) private {
        uint256 balanceBefore = player.balance;
        vm.prank(player);
        season.claim(number);
        uint256 paid = player.balance - balanceBefore;
        claimedOf[number] += paid;
        if (paid > tallyOf(season, number, player).games / 6 * season.paramsOf(number).runFee) ++overpaidClaims;
        paidOut += paid;
    }

    function withdrawRake() external {
        uint256 balanceBefore = treasury.balance;
        season.withdrawRake();
        paidOut += treasury.balance - balanceBefore;
    }
}

/// README §8.4's solvency invariant and Σ claims ≤ the players' pot, under random start, reveal,
/// commit, settle, close, claim and rake-withdrawal sequences.
/// forge-config: default.invariant.runs = 256
/// forge-config: default.invariant.depth = 200
/// forge-config: default.invariant.fail-on-revert = true
/// forge-config: default.invariant.show-metrics = true
contract InvariantTest is ChallengeFixture {
    SettlementHandler private handler;

    function setUp() public override {
        super.setUp();
        handler = new SettlementHandler(challenge, season, arbSys, entropy, referee, operator);
        targetContract(address(handler));
    }

    function invariant_SeasonIsSolvent() public view {
        assertTrue(season.isSolvent());
    }

    function invariant_ClaimsNeverExceedThePlayersPot() public view {
        for (uint256 number = 1; number <= season.lastClosedSeason(); ++number) {
            assertLe(handler.claimedOf(number), stateOf(season, number).playersPot);
        }
    }

    function invariant_SeasonHoldsEveryFeeNotPaidOut() public view {
        assertEq(address(season).balance, handler.feesPaid() - handler.paidOut());
    }

    function invariant_ChallengeHoldsNoEth() public view {
        assertEq(address(challenge).balance, 0);
    }

    /// README §8.4: each player's games are 6 per run they bought in the season, and their
    /// tickets the sum of their on-time settled runs' tickets; a late run adds none. A closed
    /// season's never change.
    function invariant_TalliesCountRunsBoughtAndOnTimeTickets() public view {
        address[] memory players = handler.playersOf();
        for (uint256 number = season.lastClosedSeason() + 1; number <= season.currentSeason(); ++number) {
            (uint256[] memory games, uint256[] memory tickets) = runSumsOf(number, players);
            for (uint256 p; p < players.length; ++p) {
                PlayerTally memory tally = tallyOf(season, number, players[p]);
                assertEq(tally.games, games[p], "games");
                assertEq(tally.tickets, tickets[p], "tickets");
            }
        }
    }

    /// README §8.4: no game earns more than its fee, so no player claims more than their run fees.
    function invariant_NoPlayerClaimsMoreThanTheirFees() public view {
        assertEq(handler.overpaidClaims(), 0);
    }

    /// Each player's games of their runs in season `number`, and tickets of those settled on time.
    function runSumsOf(uint256 number, address[] memory players)
        private
        view
        returns (uint256[] memory games, uint256[] memory tickets)
    {
        games = new uint256[](players.length);
        tickets = new uint256[](players.length);
        uint256 commitSlack = season.commitSlackOf(number);
        for (uint256 runId = 1; runId <= challenge.runCount(); ++runId) {
            Run memory run = runOf(challenge, runId);
            if (run.season != number) continue;
            uint256 p = indexOf(players, run.player);
            games[p] += 6;
            Settlement memory settlement = settlementOf(challenge, runId);
            if (settlement.status != SettlementStatus.Settled) continue;
            assertLe(
                run.committedAt,
                run.revealedAt + (settlement.ticks + TICKS_PER_SECOND - 1) / TICKS_PER_SECOND + commitSlack,
                "on time"
            );
            tickets[p] += settlement.tickets;
        }
    }

    function indexOf(address[] memory players, address player) private pure returns (uint256 p) {
        while (players[p] != player) ++p;
    }
}
