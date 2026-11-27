// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Season, SeasonParams} from "../src/Season.sol";
import {MockReferee} from "../src/mocks/MockReferee.sol";
import {MAX_RUN_TICKETS, RULES_VERSION, defaultParams, settlementEndOf, stateOf} from "./Season.t.sol";

/// The bot-neutral pot of README §8.4 (D10), driven through Season as its Challenge: each player
/// buys runs of 6 games, and each run settled on time adds its six tickets, in basis points.
contract PayoutTest is Test {
    uint256 private constant MAX_PLAYERS = 6;
    uint256 private constant MAX_RUNS_PER_PLAYER = 3;
    // README §8.4's worked examples: f = 9,000 wei a game, so 54,000 wei a run, at r = 20 %.
    uint256 private constant EXAMPLE_RUN_FEE = 54_000;
    uint16 private constant EXAMPLE_RAKE_BP = 2_000;

    Season private season;
    MockReferee private referee;
    address private operator = makeAddr("operator");
    address private challenge = makeAddr("challenge");
    uint256 private number;
    uint256 private nextRunId = 1;

    function setUp() public {
        referee = new MockReferee(RULES_VERSION);
        season = new Season(makeAddr("treasury"), operator);
        vm.prank(operator);
        season.bindChallenge(challenge);
    }

    function openSeason(uint256 runFee, uint16 rakeBp) private {
        SeasonParams memory params = defaultParams(referee);
        params.runFee = runFee;
        params.rakeBp = rakeBp;
        vm.prank(operator);
        number = season.open(params);
    }

    function playerOf(uint256 index) private pure returns (address) {
        return address(uint160(0x1000 + index));
    }

    function buyRun(address player) private {
        uint256 runFee = season.paramsOf(number).runFee;
        vm.deal(challenge, runFee);
        vm.prank(challenge);
        season.payFee{value: runFee}(number, player);
    }

    function settleRun(address player, uint32 tickets) private {
        vm.prank(challenge);
        season.addTickets(number, player, nextRunId++, tickets);
    }

    /// One run for each player, settled with the given tickets.
    function playOneRunEach(uint32[] memory tickets) private {
        for (uint256 i; i < tickets.length; ++i) {
            buyRun(playerOf(i));
            settleRun(playerOf(i), tickets[i]);
        }
    }

    function close() private {
        vm.warp(settlementEndOf(season, number) + 1);
        season.closeSeason();
    }

    function claimOf(address player) private returns (uint256) {
        vm.prank(player);
        return season.claim(number);
    }

    function ticketsOf(uint32 a, uint32 b, uint32 c, uint32 d, uint32 e) private pure returns (uint32[] memory t) {
        t = new uint32[](5);
        (t[0], t[1], t[2], t[3], t[4]) = (a, b, c, d, e);
    }

    // README §8.4's worked examples, a run of six equal games standing for each game of the table.

    function test_WorkedExample_AnAverageTicketOf0_9SharesThePlainPotByTickets() public {
        openSeason(EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        playOneRunEach(ticketsOf(60_000, 60_000, 60_000, 60_000, 30_000));
        close();
        // 0.889 f and 0.444 f a game.
        assertEq(claimOf(playerOf(0)), 6 * 8_000, "a ticket of 1");
        assertEq(claimOf(playerOf(4)), 6 * 4_000, "a ticket of 0.5");
    }

    function test_WorkedExample_AnAverageTicketOf0_4PaysAPerfectGameItsFee() public {
        openSeason(EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        playOneRunEach(ticketsOf(60_000, 60_000, 0, 0, 0));
        close();
        // f and 0.667 f a game.
        assertEq(claimOf(playerOf(0)), 6 * 9_000, "a ticket of 1");
        assertEq(claimOf(playerOf(2)), 6 * 6_000, "a ticket of 0");
    }

    function test_WorkedExample_AnAverageTicketOf0_1PaysALostGame0_778Fees() public {
        openSeason(EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        uint32[] memory tickets = new uint32[](10);
        tickets[0] = 60_000;
        playOneRunEach(tickets);
        close();
        // f, then 0.778 f a game.
        assertEq(claimOf(playerOf(0)), 6 * 9_000, "a ticket of 1");
        assertEq(claimOf(playerOf(9)), 6 * 7_000, "a ticket of 0");
    }

    function test_WorkedExample_ASeasonWithNoTicketPaysEveryGame0_8Fees() public {
        openSeason(EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        playOneRunEach(ticketsOf(0, 0, 0, 0, 0));
        close();
        assertEq(claimOf(playerOf(3)), 6 * 7_200);
    }

    function test_PrizeOf_IsWhatTheClaimPays() public {
        openSeason(EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        playOneRunEach(ticketsOf(60_000, 41_234, 0, 59_999, 7));
        close();
        uint256 prize = season.prizeOf(number, playerOf(1));
        assertEq(claimOf(playerOf(1)), prize);
    }

    function test_PrizeOf_IsZeroForAPlayerWithNoGame() public {
        openSeason(EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        playOneRunEach(ticketsOf(60_000, 60_000, 0, 0, 0));
        assertEq(season.prizeOf(number, playerOf(5)), 0);
    }

    // Fuzzing over tickets and games: each player buys 1 to 3 runs, and each run is settled with
    // 0 to 60,000 tickets, or left unsettled.

    /// A season of `players` players, with their runs and tickets drawn from `seed`.
    function playSeason(uint256 seed, uint256 players, uint256 runFee, uint16 rakeBp) private {
        openSeason(runFee, rakeBp);
        for (uint256 i; i < players; ++i) {
            uint256 runs = 1 + uint256(keccak256(abi.encode(seed, i))) % MAX_RUNS_PER_PLAYER;
            for (uint256 k; k < runs; ++k) {
                buyRun(playerOf(i));
                uint256 draw = uint256(keccak256(abi.encode(seed, i, k)));
                if (draw % 4 != 0) settleRun(playerOf(i), uint32(draw % (MAX_RUN_TICKETS + 1)));
            }
        }
    }

    function boundedSeason(uint256 seed, uint256 players, uint256 runFee, uint16 rakeBp) private returns (uint256) {
        players = bound(players, 1, MAX_PLAYERS);
        playSeason(seed, players, bound(runFee, 1, 1 ether), uint16(bound(rakeBp, 0, 2_000)));
        close();
        return players;
    }

    function claimAll(uint256 players) private returns (uint256 claimed) {
        for (uint256 i; i < players; ++i) {
            claimed += claimOf(playerOf(i));
        }
    }

    function testFuzz_Claim_ClaimsNeverExceedThePlayersPot(uint256 seed, uint256 players, uint256 runFee, uint16 rakeBp)
        public
    {
        players = boundedSeason(seed, players, runFee, rakeBp);
        assertLe(claimAll(players), stateOf(season, number).playersPot);
    }

    function testFuzz_Claim_TheDustIsAtMostOneWeiPerClaimant(
        uint256 seed,
        uint256 players,
        uint256 runFee,
        uint16 rakeBp
    ) public {
        players = boundedSeason(seed, players, runFee, rakeBp);
        assertLe(stateOf(season, number).playersPot - claimAll(players), players);
    }

    function testFuzz_Claim_NoGameIsPaidMoreThanItsFee(uint256 seed, uint256 players, uint256 runFee, uint16 rakeBp)
        public
    {
        players = boundedSeason(seed, players, runFee, rakeBp);
        for (uint256 i; i < players; ++i) {
            (uint64 games,,) = season.tallyOf(number, playerOf(i));
            assertLe(claimOf(playerOf(i)), games / 6 * season.paramsOf(number).runFee);
        }
    }

    /// `mulDiv` keeps the product of the fees and the share in 512 bits, far above any fees the
    /// rake can be taken from: fees × 10,000 must fit in 256 bits, about 1.2e73 wei.
    function testFuzz_Claim_PaysAtAnyRunFeeWithoutOverflow(uint256 seed, uint256 players, uint256 runFee) public {
        players = bound(players, 1, MAX_PLAYERS);
        uint256 maxRuns = MAX_PLAYERS * MAX_RUNS_PER_PLAYER;
        playSeason(seed, players, bound(runFee, 1, type(uint256).max / 10_000 / maxRuns), 2_000);
        close();
        assertLe(claimAll(players), stateOf(season, number).playersPot);
    }

    function testFuzz_PrizeOf_SplittingRunsOverWalletsEarnsNothingMore(uint32 first, uint32 second, uint256 seed)
        public
    {
        first = uint32(bound(first, 0, MAX_RUN_TICKETS));
        second = uint32(bound(second, 0, MAX_RUN_TICKETS));
        playSeason(seed, MAX_PLAYERS - 2, EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        address oneWallet = playerOf(MAX_PLAYERS - 2);
        address otherWallet = playerOf(MAX_PLAYERS - 1);
        uint256 snapshot = vm.snapshotState();
        buyRun(oneWallet);
        settleRun(oneWallet, first);
        buyRun(otherWallet);
        settleRun(otherWallet, second);
        uint256 split = season.prizeOf(number, oneWallet) + season.prizeOf(number, otherWallet);

        vm.revertToState(snapshot);
        buyRun(oneWallet);
        settleRun(oneWallet, first);
        buyRun(oneWallet);
        settleRun(oneWallet, second);
        assertLe(split, season.prizeOf(number, oneWallet));
    }

    function testFuzz_PrizeOf_AHigherTicketEarnsAtLeastAsMuch(uint32 lower, uint32 higher, uint256 seed) public {
        higher = uint32(bound(higher, 0, MAX_RUN_TICKETS));
        lower = uint32(bound(lower, 0, higher));
        playSeason(seed, MAX_PLAYERS - 2, EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        buyRun(playerOf(MAX_PLAYERS - 2));
        settleRun(playerOf(MAX_PLAYERS - 2), lower);
        buyRun(playerOf(MAX_PLAYERS - 1));
        settleRun(playerOf(MAX_PLAYERS - 1), higher);
        assertGe(season.prizeOf(number, playerOf(MAX_PLAYERS - 1)), season.prizeOf(number, playerOf(MAX_PLAYERS - 2)));
    }

    function testFuzz_AddTickets_NeverLowersThePlayersPrize(uint32 tickets, uint256 seed) public {
        tickets = uint32(bound(tickets, 0, MAX_RUN_TICKETS));
        playSeason(seed, MAX_PLAYERS, EXAMPLE_RUN_FEE, EXAMPLE_RAKE_BP);
        address player = playerOf(0);
        buyRun(player);
        uint256 before = season.prizeOf(number, player);
        settleRun(player, tickets);
        assertGe(season.prizeOf(number, player), before);
    }
}
