// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {Season, SeasonParams, SeasonState, PlayerTally} from "../src/Season.sol";
import {IReferee} from "../src/interfaces/IReferee.sol";
import {MockReferee} from "../src/mocks/MockReferee.sol";

uint16 constant RULES_VERSION = 2;
uint256 constant RUN_FEE = 50_000_000_000_000;
uint16 constant RAKE_BP = 1_000;
uint64 constant LENGTH = 14 days;
uint64 constant GRACE = 48 hours;
uint64 constant COMMIT_SLACK = 120;
// The six tickets of a run whose games all reach their target (README §8.4).
uint32 constant MAX_RUN_TICKETS = 60_000;
// The target of every `defaultLevelOf` level: D5's default.
uint16 constant DEFAULT_TARGET_BP = 7_500;

/// The level bytes whose id `defaultParams` puts in `slot`: 472 bytes, as level bytes v1 are,
/// with `DEFAULT_TARGET_BP` as the target at offset 470 (README §5). MockReferee validates nothing else.
function defaultLevelOf(uint256 slot) pure returns (bytes memory) {
    return bytes.concat(abi.encodePacked("level", slot), new bytes(433), abi.encodePacked(DEFAULT_TARGET_BP));
}

function defaultParams(IReferee referee) pure returns (SeasonParams memory params) {
    params.referee = referee;
    params.rulesVersion = RULES_VERSION;
    for (uint256 slot; slot < 16; ++slot) {
        params.levelIds[slot] = keccak256(defaultLevelOf(slot));
        params.weightsBp[slot] = uint16(10_000 + slot);
    }
    params.runFee = RUN_FEE;
    params.rakeBp = RAKE_BP;
    params.length = LENGTH;
    params.grace = GRACE;
    params.commitSlack = COMMIT_SLACK;
}

function stateOf(Season season, uint256 number) view returns (SeasonState memory state) {
    (
        state.start,
        state.closed,
        state.refereeCodehash,
        state.fees,
        state.games,
        state.tickets,
        state.playersPot,
        state.totalClaimed
    ) = season.seasons(number);
}

function tallyOf(Season season, uint256 number, address player) view returns (PlayerTally memory tally) {
    (tally.games, tally.tickets, tally.claimed) = season.tallyOf(number, player);
}

function settlementEndOf(Season season, uint256 number) view returns (uint256) {
    return season.endOf(number) + season.paramsOf(number).grace;
}

contract RejectingTreasury {
    receive() external payable {
        revert("rejects ETH");
    }
}

contract ReenteringClaimer {
    Season private immutable season;
    uint256 private seasonToClaim;
    bool public reentered;
    bool public reentryPaid;

    constructor(Season season_) {
        season = season_;
    }

    function claim(uint256 number) external {
        seasonToClaim = number;
        season.claim(number);
    }

    receive() external payable {
        if (reentered) return;
        reentered = true;
        try season.claim(seasonToClaim) {
            reentryPaid = true;
        } catch {}
    }
}

contract SeasonTest is Test {
    MockReferee private referee;
    Season private season;
    address private treasury = makeAddr("treasury");
    address private operator = makeAddr("operator");
    address private challenge = makeAddr("challenge");
    address private alice = makeAddr("alice");
    address private bob = makeAddr("bob");
    address private carol = makeAddr("carol");
    uint256 private nextRunId = 1;

    function setUp() public {
        referee = new MockReferee(RULES_VERSION);
        season = deploySeason(treasury);
    }

    function deploySeason(address treasury_) private returns (Season deployed) {
        deployed = new Season(treasury_, operator);
        vm.prank(operator);
        deployed.bindChallenge(challenge);
    }

    function openSeason(SeasonParams memory params) private returns (uint256) {
        vm.prank(operator);
        return season.open(params);
    }

    function openDefaultSeason() private returns (uint256) {
        return openSeason(defaultParams(referee));
    }

    function expectOpenRevert(SeasonParams memory params, bytes memory revertData) private {
        vm.prank(operator);
        vm.expectRevert(revertData);
        season.open(params);
    }

    /// `count` runs bought by `player`: their fees and their 6 games each.
    function payFees(uint256 number, address player, uint256 count) private {
        uint256 runFee = season.paramsOf(number).runFee;
        vm.deal(challenge, challenge.balance + runFee * count);
        for (uint256 i; i < count; ++i) {
            vm.prank(challenge);
            season.payFee{value: runFee}(number, player);
        }
    }

    /// The tickets of one of `player`'s runs, settled on time.
    function addTickets(uint256 number, address player, uint32 tickets) private returns (uint256 runId) {
        runId = nextRunId++;
        vm.prank(challenge);
        season.addTickets(number, player, runId, tickets);
    }

    function warpPastSettlement(uint256 number) private {
        vm.warp(settlementEndOf(season, number) + 1);
    }

    function closeAfterSettlement(uint256 number) private {
        warpPastSettlement(number);
        season.closeSeason();
    }

    function claimAs(address player, uint256 number) private returns (uint256) {
        vm.prank(player);
        return season.claim(number);
    }

    function rakeOf(uint256 fees, uint16 rakeBp) private pure returns (uint256) {
        return fees * rakeBp / 10_000;
    }

    // Constructor and Challenge binding.

    function test_Constructor_RevertsWithAZeroTreasury() public {
        vm.expectRevert(Season.ZeroAddress.selector);
        new Season(address(0), operator);
    }

    function test_Constructor_RevertsWithAZeroOperator() public {
        vm.expectRevert(Season.ZeroAddress.selector);
        new Season(treasury, address(0));
    }

    function test_BindChallenge_RevertsForAnyoneButTheOperator() public {
        Season unbound = new Season(treasury, operator);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Season.NotOperator.selector, alice));
        unbound.bindChallenge(challenge);
    }

    function test_BindChallenge_RevertsOnceChallengeIsBound() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Season.ChallengeAlreadyBound.selector, challenge));
        season.bindChallenge(alice);
    }

    // Games and tickets.

    function test_PayFee_AddsSixGamesToThePlayer() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 2);
        assertEq(tallyOf(season, number, alice).games, 12);
    }

    function test_PayFee_AddsSixGamesToTheSeason() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 2);
        payFees(number, bob, 1);
        assertEq(stateOf(season, number).games, 18);
    }

    function test_AddTickets_AddsTheTicketsToThePlayer() public {
        uint256 number = openDefaultSeason();
        addTickets(number, alice, 41_000);
        addTickets(number, alice, 9_500);
        assertEq(tallyOf(season, number, alice).tickets, 50_500);
    }

    function test_AddTickets_AddsTheTicketsToTheSeason() public {
        uint256 number = openDefaultSeason();
        addTickets(number, alice, 41_000);
        addTickets(number, bob, 9_500);
        addTickets(number, carol, 0);
        assertEq(stateOf(season, number).tickets, 50_500);
    }

    function test_AddTickets_EmitsTicketsAdded() public {
        uint256 number = openDefaultSeason();
        vm.expectEmit(address(season));
        emit Season.TicketsAdded(number, alice, nextRunId, 41_000);
        addTickets(number, alice, 41_000);
    }

    function test_Claim_RevertsForAPlayerWithNoGame() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 1);
        closeAfterSettlement(number);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Season.NoGames.selector, number, bob));
        season.claim(number);
    }

    // Opening seasons.

    function test_Open_RevertsForAnyoneButTheOperator() public {
        SeasonParams memory params = defaultParams(referee);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Season.NotOperator.selector, alice));
        season.open(params);
    }

    function test_Open_NumbersSeasonsFromOne() public {
        assertEq(openDefaultSeason(), 1);
    }

    function test_Open_EndsTheSeasonItsLengthAfterTheOpeningBlock() public {
        vm.warp(1_000_000);
        uint256 number = openDefaultSeason();
        assertEq(season.endOf(number), 1_000_000 + LENGTH);
    }

    function test_Open_RecordsTheRefereesCodehash() public {
        uint256 number = openDefaultSeason();
        assertEq(stateOf(season, number).refereeCodehash, address(referee).codehash);
    }

    function test_Open_LeavesTheParametersOfEarlierSeasonsUnchanged() public {
        SeasonParams memory first = defaultParams(referee);
        uint256 number = openSeason(first);
        payFees(number, alice, 1);
        addTickets(number, alice, 41_000);
        vm.warp(season.endOf(number));
        SeasonParams memory second = defaultParams(new MockReferee(RULES_VERSION + 1));
        second.rulesVersion = RULES_VERSION + 1;
        second.levelIds[0] = keccak256("another level");
        second.weightsBp[0] = 1;
        second.runFee = 1;
        second.rakeBp = 0;
        second.length = 1;
        second.grace = 1;
        second.commitSlack = 1;
        openSeason(second);
        closeAfterSettlement(number);

        assertEq(abi.encode(season.paramsOf(number)), abi.encode(first));
    }

    function test_Open_RevertsWithARefereeOfAnotherRulesVersion() public {
        SeasonParams memory params = defaultParams(new MockReferee(RULES_VERSION + 1));
        expectOpenRevert(
            params, abi.encodeWithSelector(Season.RulesVersionMismatch.selector, RULES_VERSION + 1, RULES_VERSION)
        );
    }

    function test_Open_RevertsBeforeThePreviousSeasonEnds() public {
        uint256 number = openDefaultSeason();
        uint256 end = season.endOf(number);
        vm.warp(end - 1);
        expectOpenRevert(
            defaultParams(referee), abi.encodeWithSelector(Season.PreviousSeasonNotEnded.selector, number, end)
        );
    }

    function test_Open_SucceedsWhenThePreviousSeasonEnds() public {
        uint256 number = openDefaultSeason();
        vm.warp(season.endOf(number));
        assertEq(openDefaultSeason(), number + 1);
    }

    function test_Open_AcceptsEveryParameterAtItsLowerLimit() public {
        SeasonParams memory params = defaultParams(referee);
        params.weightsBp[0] = 1;
        params.runFee = 1;
        params.rakeBp = 0;
        params.length = 1;
        params.grace = 1;
        params.commitSlack = 1;
        assertEq(abi.encode(season.paramsOf(openSeason(params))), abi.encode(params));
    }

    function test_Open_AcceptsEveryParameterAtItsUpperLimit() public {
        SeasonParams memory params = defaultParams(referee);
        params.weightsBp[0] = type(uint16).max;
        params.runFee = type(uint256).max;
        params.rakeBp = 2_000;
        params.length = 7_776_000;
        params.grace = 2_592_000;
        params.commitSlack = 3_600;
        assertEq(abi.encode(season.paramsOf(openSeason(params))), abi.encode(params));
    }

    function test_Open_RevertsWithAZeroLevelId() public {
        SeasonParams memory params = defaultParams(referee);
        params.levelIds[7] = bytes32(0);
        expectOpenRevert(params, abi.encodeWithSelector(Season.ZeroLevelId.selector, 7));
    }

    function test_Open_RevertsWithADuplicateLevelId() public {
        SeasonParams memory params = defaultParams(referee);
        params.levelIds[11] = params.levelIds[3];
        expectOpenRevert(params, abi.encodeWithSelector(Season.DuplicateLevelId.selector, 11));
    }

    function test_Open_RevertsWithAZeroWeight() public {
        SeasonParams memory params = defaultParams(referee);
        params.weightsBp[15] = 0;
        expectOpenRevert(params, abi.encodeWithSelector(Season.ZeroWeight.selector, 15));
    }

    function test_Open_RevertsWithAZeroRunFee() public {
        SeasonParams memory params = defaultParams(referee);
        params.runFee = 0;
        expectOpenRevert(params, abi.encodeWithSelector(Season.ZeroRunFee.selector));
    }

    function test_Open_RevertsWithARakeAbove2000Bp() public {
        SeasonParams memory params = defaultParams(referee);
        params.rakeBp = 2_001;
        expectOpenRevert(params, abi.encodeWithSelector(Season.RakeAboveCap.selector, 2_001));
    }

    function testFuzz_Open_RevertsWithAnyRakeAboveTheCap(uint16 rakeBp) public {
        rakeBp = uint16(bound(rakeBp, 2_001, type(uint16).max));
        SeasonParams memory params = defaultParams(referee);
        params.rakeBp = rakeBp;
        expectOpenRevert(params, abi.encodeWithSelector(Season.RakeAboveCap.selector, rakeBp));
    }

    function test_Open_RevertsWithAZeroLength() public {
        SeasonParams memory params = defaultParams(referee);
        params.length = 0;
        expectOpenRevert(params, abi.encodeWithSelector(Season.LengthOutOfRange.selector, 0));
    }

    function test_Open_RevertsWithALengthAbove90Days() public {
        SeasonParams memory params = defaultParams(referee);
        params.length = 7_776_001;
        expectOpenRevert(params, abi.encodeWithSelector(Season.LengthOutOfRange.selector, 7_776_001));
    }

    function test_Open_RevertsWithAZeroGrace() public {
        SeasonParams memory params = defaultParams(referee);
        params.grace = 0;
        expectOpenRevert(params, abi.encodeWithSelector(Season.GraceOutOfRange.selector, 0));
    }

    function test_Open_RevertsWithAGraceAbove30Days() public {
        SeasonParams memory params = defaultParams(referee);
        params.grace = 2_592_001;
        expectOpenRevert(params, abi.encodeWithSelector(Season.GraceOutOfRange.selector, 2_592_001));
    }

    function test_Open_RevertsWithAZeroCommitSlack() public {
        SeasonParams memory params = defaultParams(referee);
        params.commitSlack = 0;
        expectOpenRevert(params, abi.encodeWithSelector(Season.CommitSlackOutOfRange.selector, 0));
    }

    function test_Open_RevertsWithACommitSlackAbove3600() public {
        SeasonParams memory params = defaultParams(referee);
        params.commitSlack = 3_601;
        expectOpenRevert(params, abi.encodeWithSelector(Season.CommitSlackOutOfRange.selector, 3_601));
    }

    // Settlement lookups.

    function test_SlotOf_ReturnsTheLevelsDrawSlot() public {
        uint256 number = openDefaultSeason();
        assertEq(season.slotOf(number, keccak256(defaultLevelOf(9))), 9);
    }

    function test_SlotOf_RevertsForALevelNotInTheSeason() public {
        uint256 number = openDefaultSeason();
        bytes32 levelId = keccak256("another level");
        vm.expectRevert(abi.encodeWithSelector(Season.LevelNotInSeason.selector, number, levelId));
        season.slotOf(number, levelId);
    }

    function test_SlotOf_ReadsTheLevelsOfTheGivenSeason() public {
        uint256 first = openDefaultSeason();
        vm.warp(season.endOf(first));
        SeasonParams memory params = defaultParams(referee);
        bytes32 levelId = params.levelIds[4];
        params.levelIds[4] = keccak256("another level");
        openSeason(params);
        assertEq(season.slotOf(first, levelId), 4);
    }

    function test_WeightOf_ReturnsTheWeightOfTheLevelsSlot() public {
        uint256 number = openDefaultSeason();
        assertEq(season.weightOf(number, keccak256(defaultLevelOf(9))), 10_009);
    }

    // Fees.

    function test_PayFee_AddsTheFeeToTheSeasonsFees() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 3);
        assertEq(stateOf(season, number).fees, 3 * RUN_FEE);
    }

    function test_PayFee_RevertsForAnyoneButChallenge() public {
        uint256 number = openDefaultSeason();
        vm.deal(alice, RUN_FEE);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Season.NotChallenge.selector, alice));
        season.payFee{value: RUN_FEE}(number, alice);
    }

    function test_PayFee_RevertsBeforeAnySeasonOpens() public {
        vm.deal(challenge, RUN_FEE);
        vm.prank(challenge);
        vm.expectRevert(abi.encodeWithSelector(Season.NotAcceptingRuns.selector, 1));
        season.payFee{value: RUN_FEE}(1, alice);
    }

    function test_PayFee_RevertsOnceTheSeasonEnds() public {
        uint256 number = openDefaultSeason();
        vm.warp(season.endOf(number));
        vm.deal(challenge, RUN_FEE);
        vm.prank(challenge);
        vm.expectRevert(abi.encodeWithSelector(Season.NotAcceptingRuns.selector, number));
        season.payFee{value: RUN_FEE}(number, alice);
    }

    function test_PayFee_RevertsForASeasonOtherThanTheOneAcceptingRuns() public {
        uint256 first = openDefaultSeason();
        vm.warp(season.endOf(first));
        openDefaultSeason();
        vm.deal(challenge, RUN_FEE);
        vm.prank(challenge);
        vm.expectRevert(abi.encodeWithSelector(Season.NotAcceptingRuns.selector, first));
        season.payFee{value: RUN_FEE}(first, alice);
    }

    function test_PayFee_RevertsBelowTheFee() public {
        uint256 number = openDefaultSeason();
        vm.deal(challenge, RUN_FEE);
        vm.prank(challenge);
        vm.expectRevert(abi.encodeWithSelector(Season.WrongFee.selector, RUN_FEE - 1, RUN_FEE));
        season.payFee{value: RUN_FEE - 1}(number, alice);
    }

    function test_PayFee_RevertsAboveTheFee() public {
        uint256 number = openDefaultSeason();
        vm.deal(challenge, RUN_FEE + 1);
        vm.prank(challenge);
        vm.expectRevert(abi.encodeWithSelector(Season.WrongFee.selector, RUN_FEE + 1, RUN_FEE));
        season.payFee{value: RUN_FEE + 1}(number, alice);
    }

    function test_AddTickets_RevertsForAnyoneButChallenge() public {
        uint256 number = openDefaultSeason();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Season.NotChallenge.selector, alice));
        season.addTickets(number, alice, 1, 41_000);
    }

    function test_AddTickets_RevertsOnceTheSeasonIsClosed() public {
        uint256 number = openDefaultSeason();
        closeAfterSettlement(number);
        vm.prank(challenge);
        vm.expectRevert(abi.encodeWithSelector(Season.SeasonAlreadyClosed.selector, number));
        season.addTickets(number, alice, 1, 41_000);
    }

    // Closing seasons.

    function test_CloseSeason_RevertsWithNoSeasonToClose() public {
        vm.expectRevert(Season.NoSeasonToClose.selector);
        season.closeSeason();
    }

    function test_CloseSeason_RevertsAtEndPlusGrace() public {
        uint256 number = openDefaultSeason();
        uint256 settlementEnd = settlementEndOf(season, number);
        vm.warp(settlementEnd);
        vm.expectRevert(abi.encodeWithSelector(Season.SettlementOpen.selector, number, settlementEnd));
        season.closeSeason();
    }

    function test_CloseSeason_AnyAddressClosesAfterEndPlusGrace() public {
        uint256 number = openDefaultSeason();
        warpPastSettlement(number);
        vm.prank(makeAddr("anyone"));
        season.closeSeason();
        assertTrue(stateOf(season, number).closed);
    }

    function test_CloseSeason_SendsNoEth() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 4);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);
        assertEq(address(season).balance, 4 * RUN_FEE);
    }

    function test_CloseSeason_CreditsTheRakeToTheTreasury() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 4);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);
        assertEq(season.rakeOwed(), rakeOf(4 * RUN_FEE, RAKE_BP));
    }

    function testFuzz_CloseSeason_SplitsTheFeesIntoTheRakeAndThePlayersPot(uint16 rakeBp, uint256 runCount) public {
        SeasonParams memory params = defaultParams(referee);
        params.rakeBp = uint16(bound(rakeBp, 0, 2_000));
        uint256 number = openSeason(params);
        uint256 fees = RUN_FEE * bound(runCount, 1, 50);
        payFees(number, alice, fees / RUN_FEE);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);

        uint256 rake = season.rakeOwed();
        assertEq(rake, rakeOf(fees, params.rakeBp));
        assertLe(rake * 10_000, fees * 2_000);
        assertEq(stateOf(season, number).playersPot, fees - rake);
    }

    function test_WithdrawRake_SendsTheCreditToTheTreasury() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 4);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);
        vm.prank(makeAddr("anyone"));
        season.withdrawRake();
        assertEq(treasury.balance, rakeOf(4 * RUN_FEE, RAKE_BP));
    }

    function test_WithdrawRake_ASecondWithdrawalSendsNothing() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 4);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);
        season.withdrawRake();
        assertEq(season.withdrawRake(), 0);
        assertEq(treasury.balance, rakeOf(4 * RUN_FEE, RAKE_BP));
    }

    function test_WithdrawRake_RevertsAndKeepsTheCreditWhenTheTreasuryRejectsEth() public {
        RejectingTreasury rejecting = new RejectingTreasury();
        season = deploySeason(address(rejecting));
        uint256 number = openDefaultSeason();
        payFees(number, alice, 4);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);
        uint256 rake = rakeOf(4 * RUN_FEE, RAKE_BP);

        vm.expectRevert(abi.encodeWithSelector(Season.TransferFailed.selector, address(rejecting), rake));
        season.withdrawRake();
        assertEq(season.rakeOwed(), rake);
    }

    function test_CloseSeason_WorksWithATreasuryThatRejectsEth() public {
        season = deploySeason(address(new RejectingTreasury()));
        uint256 number = openDefaultSeason();
        payFees(number, alice, 4);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);
        assertTrue(stateOf(season, number).closed);
    }

    function test_Claim_WorksWithATreasuryThatRejectsEth() public {
        season = deploySeason(address(new RejectingTreasury()));
        uint256 number = openDefaultSeason();
        payFees(number, alice, 4);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);
        claimAs(alice, number);
        assertEq(alice.balance, 4 * RUN_FEE - rakeOf(4 * RUN_FEE, RAKE_BP));
    }

    // No rollover.

    function test_CloseSeason_KeepsEachSeasonsPotToItself() public {
        uint256 first = openDefaultSeason();
        payFees(first, alice, 4);
        vm.warp(season.endOf(first));
        uint256 next = openDefaultSeason();
        payFees(next, bob, 2);
        addTickets(next, bob, 41_000);
        closeAfterSettlement(first);
        closeAfterSettlement(next);
        assertEq(stateOf(season, next).playersPot, 2 * RUN_FEE - rakeOf(2 * RUN_FEE, RAKE_BP));
    }

    function test_Claim_ASeasonWithNoTicketPaysItsPlayersPotBack() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 3);
        payFees(number, bob, 1);
        closeAfterSettlement(number);
        uint256 playersPot = 4 * RUN_FEE - rakeOf(4 * RUN_FEE, RAKE_BP);
        assertEq(claimAs(alice, number) + claimAs(bob, number), playersPot);
    }

    function test_CloseSeason_ClosesSeasonsOnlyInOrder() public {
        SeasonParams memory longGrace = defaultParams(referee);
        longGrace.grace = 30 days;
        uint256 first = openSeason(longGrace);
        vm.warp(season.endOf(first));
        SeasonParams memory shortSeason = defaultParams(referee);
        shortSeason.length = 1 days;
        shortSeason.grace = 1;
        uint256 second = openSeason(shortSeason);
        warpPastSettlement(second);
        uint256 firstSettlementEnd = settlementEndOf(season, first);

        vm.expectRevert(abi.encodeWithSelector(Season.SettlementOpen.selector, first, firstSettlementEnd));
        season.closeSeason();
    }

    function test_CloseSeason_ClosesTheNextSeasonOnceTheEarlierOneIsClosed() public {
        uint256 first = openDefaultSeason();
        vm.warp(season.endOf(first));
        uint256 second = openDefaultSeason();
        closeAfterSettlement(first);
        warpPastSettlement(second);
        assertEq(season.closeSeason(), second);
    }

    function test_CloseSeason_EmitsSeasonClosed() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 4);
        warpPastSettlement(number);
        uint256 rake = rakeOf(4 * RUN_FEE, RAKE_BP);
        vm.expectEmit(address(season));
        emit Season.SeasonClosed(number, rake, 4 * RUN_FEE - rake);
        season.closeSeason();
    }

    // Claims.

    function test_Claim_PaysThePrizeOfThePlayersGames() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 1);
        payFees(number, bob, 1);
        addTickets(number, alice, 60_000);
        addTickets(number, bob, 30_000);
        closeAfterSettlement(number);
        uint256 prize = season.prizeOf(number, bob);
        assertEq(claimAs(bob, number), prize);
    }

    function test_Claim_MarksThePlayerClaimed() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 1);
        closeAfterSettlement(number);
        claimAs(alice, number);
        assertTrue(tallyOf(season, number, alice).claimed);
    }

    function test_Claim_RevertsBeforeTheClose() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 1);
        addTickets(number, alice, 41_000);
        warpPastSettlement(number);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Season.SeasonNotClosed.selector, number));
        season.claim(number);
    }

    function test_Claim_ADoubleClaimReverts() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 1);
        addTickets(number, alice, 41_000);
        closeAfterSettlement(number);
        claimAs(alice, number);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Season.AlreadyClaimed.selector, number, alice));
        season.claim(number);
    }

    function test_Claim_RoundsDownAndKeepsTheDust() public {
        SeasonParams memory params = defaultParams(referee);
        params.runFee = 10;
        uint256 number = openSeason(params);
        payFees(number, alice, 1);
        payFees(number, bob, 1);
        payFees(number, carol, 1);
        addTickets(number, alice, 60_000);
        addTickets(number, bob, 60_000);
        addTickets(number, carol, 50_000);
        closeAfterSettlement(number);
        claimAs(alice, number);
        claimAs(bob, number);
        claimAs(carol, number);

        // A players' pot of 27 wei, shared 60 : 60 : 50, is 9.53, 9.53 and 7.94 wei.
        assertEq(carol.balance, 7);
        assertEq(address(season).balance, season.rakeOwed() + 2);
        assertTrue(season.isSolvent());
    }

    function test_Claim_ReenteredFromTheReceiverPaysNothingMore() public {
        ReenteringClaimer claimer = new ReenteringClaimer(season);
        uint256 number = openDefaultSeason();
        payFees(number, address(claimer), 2);
        payFees(number, bob, 2);
        addTickets(number, address(claimer), 41_000);
        addTickets(number, bob, 41_000);
        closeAfterSettlement(number);
        claimer.claim(number);

        assertTrue(claimer.reentered());
        assertFalse(claimer.reentryPaid());
        assertEq(address(claimer).balance, (4 * RUN_FEE - rakeOf(4 * RUN_FEE, RAKE_BP)) / 2);
    }

    function test_Claim_RevertsAndKeepsTheShareWhenTheClaimantRejectsEth() public {
        address rejectingClaimant = address(new RejectingTreasury());
        uint256 number = openDefaultSeason();
        payFees(number, rejectingClaimant, 4);
        addTickets(number, rejectingClaimant, 41_000);
        closeAfterSettlement(number);
        uint256 share = 4 * RUN_FEE - rakeOf(4 * RUN_FEE, RAKE_BP);

        vm.prank(rejectingClaimant);
        vm.expectRevert(abi.encodeWithSelector(Season.TransferFailed.selector, rejectingClaimant, share));
        season.claim(number);
        assertFalse(tallyOf(season, number, rejectingClaimant).claimed, "claimed");
        assertEq(stateOf(season, number).totalClaimed, 0, "total claimed");
        assertEq(address(season).balance, 4 * RUN_FEE, "balance");
    }

    // Solvency.

    function test_IsSolvent_IsFalseWhenTheBalanceDoesNotCoverTheFees() public {
        uint256 number = openDefaultSeason();
        payFees(number, alice, 2);
        vm.deal(address(season), 2 * RUN_FEE - 1);
        assertFalse(season.isSolvent());
    }
}

/// Drives Season as its Challenge and operator, with every input bounded to a valid one, so
/// that each call changes state or returns early instead of reverting. Each run bought adds its
/// tickets at most once, at most 60,000, as Challenge settles it.
contract SeasonHandler is CommonBase, StdCheats, StdUtils {
    Season public immutable season;
    MockReferee private immutable referee;
    address private immutable operator;
    address[] private players;
    uint256 private nextRunId = 1;
    mapping(uint256 season => uint256) public claimedOf;
    /// Claims that paid a player more than their run fees, which no claim may (README §8.4).
    uint256 public overpaidClaims;
    mapping(uint256 season => mapping(address player => uint256)) private settledRuns;

    constructor(Season season_, MockReferee referee_, address operator_) {
        season = season_;
        referee = referee_;
        operator = operator_;
        for (uint256 i; i < 4; ++i) {
            players.push(address(uint160(0x1000 + i)));
        }
    }

    function playersOf() external view returns (address[] memory) {
        return players;
    }

    function openSeason(uint16 rakeBp, uint64 length, uint64 grace, uint256 runFee) external {
        uint256 current = season.currentSeason();
        if (current != 0 && block.timestamp < season.endOf(current)) return;
        SeasonParams memory params = defaultParams(referee);
        params.rakeBp = uint16(bound(rakeBp, 0, 2_000));
        params.length = uint64(bound(length, 1, 3 days));
        params.grace = uint64(bound(grace, 1, 2 days));
        params.runFee = bound(runFee, 1, 1 ether);
        vm.prank(operator);
        season.open(params);
    }

    function payFee(uint256 playerSeed) external {
        uint256 current = season.currentSeason();
        if (current == 0 || block.timestamp >= season.endOf(current)) return;
        uint256 runFee = season.paramsOf(current).runFee;
        vm.deal(address(this), runFee);
        season.payFee{value: runFee}(current, players[bound(playerSeed, 0, players.length - 1)]);
    }

    function addTickets(uint256 playerSeed, uint256 seasonSeed, uint32 tickets) external {
        uint256 firstOpen = season.lastClosedSeason() + 1;
        uint256 current = season.currentSeason();
        if (firstOpen > current) return;
        uint256 number = bound(seasonSeed, firstOpen, current);
        address player = players[bound(playerSeed, 0, players.length - 1)];
        if (settledRuns[number][player] * 6 >= tallyOf(season, number, player).games) return;
        ++settledRuns[number][player];
        season.addTickets(number, player, nextRunId++, uint32(bound(tickets, 0, MAX_RUN_TICKETS)));
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 2 days));
    }

    function closeSeason() external {
        uint256 number = season.lastClosedSeason() + 1;
        if (number > season.currentSeason() || block.timestamp <= settlementEndOf(season, number)) return;
        season.closeSeason();
    }

    function claim(uint256 playerSeed, uint256 seasonSeed) external {
        uint256 lastClosed = season.lastClosedSeason();
        if (lastClosed == 0) return;
        uint256 number = bound(seasonSeed, 1, lastClosed);
        address player = players[bound(playerSeed, 0, players.length - 1)];
        PlayerTally memory tally = tallyOf(season, number, player);
        if (tally.games == 0 || tally.claimed) return;
        vm.prank(player);
        uint256 amount = season.claim(number);
        claimedOf[number] += amount;
        if (amount > tally.games / 6 * season.paramsOf(number).runFee) ++overpaidClaims;
    }

    function withdrawRake() external {
        season.withdrawRake();
    }
}

contract SeasonInvariantTest is Test {
    Season private season;
    SeasonHandler private handler;

    function setUp() public {
        address operator = makeAddr("operator");
        season = new Season(makeAddr("treasury"), operator);
        handler = new SeasonHandler(season, new MockReferee(RULES_VERSION), operator);
        vm.prank(operator);
        season.bindChallenge(address(handler));
        targetContract(address(handler));
    }

    function owedBySeason() private view returns (uint256 owed) {
        owed = season.rakeOwed();
        for (uint256 number = 1; number <= season.currentSeason(); ++number) {
            SeasonState memory state = stateOf(season, number);
            owed += state.closed ? state.playersPot - handler.claimedOf(number) : state.fees;
        }
    }

    function invariant_IsSolvent() public view {
        assertTrue(season.isSolvent());
    }

    function invariant_TheBalanceEqualsWhatSeasonOwes() public view {
        assertEq(address(season).balance, owedBySeason());
    }

    function invariant_ClaimsNeverExceedThePlayersPot() public view {
        for (uint256 number = 1; number <= season.lastClosedSeason(); ++number) {
            assertLe(handler.claimedOf(number), stateOf(season, number).playersPot);
        }
    }

    /// README §8.4: no game earns more than its fee, so no player claims more than their run fees.
    function invariant_NoPlayerClaimsMoreThanTheirFees() public view {
        assertEq(handler.overpaidClaims(), 0);
    }

    /// The season's games and tickets are its players' sums. A closed season's never change.
    function invariant_TheSeasonsSumsAreItsPlayersSums() public view {
        address[] memory players = handler.playersOf();
        for (uint256 number = season.lastClosedSeason() + 1; number <= season.currentSeason(); ++number) {
            uint256 games;
            uint256 tickets;
            for (uint256 p; p < players.length; ++p) {
                PlayerTally memory tally = tallyOf(season, number, players[p]);
                games += tally.games;
                tickets += tally.tickets;
            }
            SeasonState memory state = stateOf(season, number);
            assertEq(state.games, games, "games");
            assertEq(state.tickets, tickets, "tickets");
        }
    }
}
