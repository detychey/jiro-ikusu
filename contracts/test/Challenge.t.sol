// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {Vm} from "forge-std/Vm.sol";
import {ArbBlockhashEntropy} from "../src/ArbBlockhashEntropy.sol";
import {Challenge, Run} from "../src/Challenge.sol";
import {IEntropySource} from "../src/interfaces/IEntropySource.sol";
import {MockArbSys} from "../src/mocks/MockArbSys.sol";
import {MockReferee} from "../src/mocks/MockReferee.sol";
import {Season, SeasonParams} from "../src/Season.sol";
import {RULES_VERSION, RUN_FEE, COMMIT_SLACK, defaultParams, stateOf} from "./Season.t.sol";

uint256 constant REVEAL_DELAY = 40;
uint256 constant READ_WINDOW = 256;
uint64 constant MAX_PLAY_SECONDS = 1_080;
uint16 constant MAX_EVENTS = 2_700;

function runOf(Challenge challenge, uint256 runId) view returns (Run memory run) {
    (run.player, run.revealedAt, run.committedAt, run.season, run.runNonce, run.commitment) = challenge.runs(runId);
}

function runCommitmentOf(bytes[6] memory journals) pure returns (bytes32) {
    bytes memory hashes;
    for (uint256 i; i < 6; ++i) {
        hashes = abi.encodePacked(hashes, keccak256(journals[i]));
    }
    return keccak256(hashes);
}

/// A journal v1 (README §6.3) with `eventCount` events, `tickStep` ticks apart, masks alternating
/// between up and down. Challenge never parses it; its size and bytes set the commit's gas.
function journalOf(bytes32 runNonce, uint8 levelIndex, uint16 eventCount, uint16 tickStep)
    pure
    returns (bytes memory journal)
{
    journal = abi.encodePacked(
        uint8(1), RULES_VERSION, uint8(1), runNonce, keccak256(abi.encodePacked("level", levelIndex)), levelIndex
    );
    journal = bytes.concat(journal, abi.encodePacked(eventCount), new bytes(3 * uint256(eventCount)));
    for (uint256 i; i < eventCount; ++i) {
        uint256 at = 71 + 3 * i;
        uint256 tick = i * tickStep;
        journal[at] = bytes1(uint8(tick >> 8));
        journal[at + 1] = bytes1(uint8(tick));
        journal[at + 2] = bytes1(uint8(i % 2 == 0 ? 0x01 : 0x02));
    }
}

function sixJournalsOf(bytes32 runNonce, uint16 eventCount, uint16 tickStep) pure returns (bytes[6] memory journals) {
    for (uint256 i; i < 6; ++i) {
        journals[i] = journalOf(runNonce, uint8(i), eventCount, tickStep);
    }
}

/// The deployment of README §7.2: Challenge forwards fees to Season and draws entropy from
/// ArbBlockhashEntropy, here over MockArbSys, so the reveal window is the real one.
abstract contract ChallengeFixture is Test {
    MockArbSys internal arbSys;
    ArbBlockhashEntropy internal entropy;
    Season internal season;
    Challenge internal challenge;
    MockReferee internal referee;
    address internal operator = makeAddr("operator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public virtual {
        arbSys = new MockArbSys();
        entropy = new ArbBlockhashEntropy(arbSys);
        season = new Season(makeAddr("treasury"), operator);
        challenge = new Challenge(entropy, season);
        referee = new MockReferee(RULES_VERSION);
        vm.prank(operator);
        season.bindChallenge(address(challenge));
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
        vm.warp(1_000_000);
    }

    function openSeason(SeasonParams memory params) internal returns (uint256) {
        vm.prank(operator);
        return season.open(params);
    }

    function openDefaultSeason() internal returns (uint256) {
        return openSeason(defaultParams(referee));
    }

    function startRunAs(address player, uint256 number) internal returns (uint256 runId) {
        vm.prank(player);
        runId = challenge.startRun{value: RUN_FEE}(number);
        assertSolvent();
    }

    function advanceArbBlocks(uint256 count) internal {
        arbSys.setBlockNumber(arbSys.arbBlockNumber() + count);
    }

    function revealAs(address player, uint256 runId) internal {
        vm.prank(player);
        challenge.revealRun(runId);
        assertSolvent();
    }

    function startAndRevealAs(address player, uint256 number) internal returns (uint256 runId) {
        runId = startRunAs(player, number);
        advanceArbBlocks(REVEAL_DELAY + 1);
        revealAs(player, runId);
    }

    function commitAs(address player, uint256 runId, bytes[6] memory journals) internal {
        vm.prank(player);
        challenge.commitRun(runId, journals);
        assertSolvent();
    }

    function journalsOf(uint256 runId) internal view returns (bytes[6] memory) {
        return sixJournalsOf(runOf(challenge, runId).runNonce, 3, 30);
    }

    function assertSolvent() internal view {
        assertTrue(season.isSolvent(), "Season is solvent");
        assertEq(address(challenge).balance, 0, "Challenge holds no ETH");
    }
}

contract ChallengeTest is ChallengeFixture {
    string private fixture;

    function setUp() public override {
        super.setUp();
        fixture = vm.readFile(string.concat(vm.projectRoot(), "/../vectors/derivations.json"));
    }

    function expectStartRevert(address player, uint256 number, uint256 value, bytes memory revertData) private {
        vm.prank(player);
        vm.expectRevert(revertData);
        challenge.startRun{value: value}(number);
    }

    function expectRevealRevert(address caller, uint256 runId, bytes memory revertData) private {
        vm.prank(caller);
        vm.expectRevert(revertData);
        challenge.revealRun(runId);
    }

    function expectCommitRevert(address caller, uint256 runId, bytes memory revertData) private {
        bytes[6] memory journals = journalsOf(runId);
        vm.prank(caller);
        vm.expectRevert(revertData);
        challenge.commitRun(runId, journals);
    }

    function expectedEntropyId(uint256 runId) private view returns (bytes32) {
        return keccak256(abi.encodePacked(address(challenge), runId));
    }

    // Constructor.

    function test_Constructor_RevertsWithAZeroEntropySource() public {
        vm.expectRevert(Challenge.ZeroAddress.selector);
        new Challenge(IEntropySource(address(0)), season);
    }

    function test_Constructor_RevertsWithAZeroSeason() public {
        vm.expectRevert(Challenge.ZeroAddress.selector);
        new Challenge(entropy, Season(address(0)));
    }

    // Pay.

    function test_StartRun_RevertsWithNoOpenSeason() public {
        expectStartRevert(alice, 1, RUN_FEE, abi.encodeWithSelector(Season.NotAcceptingRuns.selector, 1));
    }

    function test_StartRun_RevertsOnceTheSeasonHasEnded() public {
        uint256 number = openDefaultSeason();
        vm.warp(season.endOf(number));
        expectStartRevert(alice, number, RUN_FEE, abi.encodeWithSelector(Season.NotAcceptingRuns.selector, number));
    }

    function test_StartRun_RevertsForASeasonOtherThanTheOneAcceptingRuns() public {
        uint256 first = openDefaultSeason();
        vm.warp(season.endOf(first));
        openDefaultSeason();
        expectStartRevert(alice, first, RUN_FEE, abi.encodeWithSelector(Season.NotAcceptingRuns.selector, first));
    }

    function test_StartRun_RevertsWithAValueBelowTheFee() public {
        uint256 number = openDefaultSeason();
        expectStartRevert(
            alice, number, RUN_FEE - 1, abi.encodeWithSelector(Season.WrongFee.selector, RUN_FEE - 1, RUN_FEE)
        );
    }

    function test_StartRun_RevertsWithAValueAboveTheFee() public {
        uint256 number = openDefaultSeason();
        expectStartRevert(
            alice, number, RUN_FEE + 1, abi.encodeWithSelector(Season.WrongFee.selector, RUN_FEE + 1, RUN_FEE)
        );
    }

    function testFuzz_StartRun_RevertsWithAnyValueButTheFee(uint256 runFee, uint256 value) public {
        runFee = bound(runFee, 1, 1 ether);
        value = bound(value, 0, 2 ether);
        vm.assume(value != runFee);
        SeasonParams memory params = defaultParams(referee);
        params.runFee = runFee;
        uint256 number = openSeason(params);
        vm.deal(alice, value);
        expectStartRevert(alice, number, value, abi.encodeWithSelector(Season.WrongFee.selector, value, runFee));
    }

    function test_StartRun_PutsTheFeeInTheSeasonsPot() public {
        uint256 number = openDefaultSeason();
        startRunAs(alice, number);
        assertEq(stateOf(season, number).fees, RUN_FEE);
    }

    function test_StartRun_MovesTheFeeToSeason() public {
        uint256 number = openDefaultSeason();
        startRunAs(alice, number);
        assertEq(address(season).balance, RUN_FEE);
    }

    function test_StartRun_NumbersRunsFromOne() public {
        uint256 number = openDefaultSeason();
        assertEq(startRunAs(alice, number), 1);
    }

    function test_StartRun_NumbersRunsAcrossSeasons() public {
        uint256 first = openDefaultSeason();
        startRunAs(alice, first);
        vm.warp(season.endOf(first));
        uint256 second = openDefaultSeason();
        assertEq(startRunAs(alice, second), 2);
    }

    function test_StartRun_RecordsThePlayer() public {
        uint256 number = openDefaultSeason();
        uint256 runId = startRunAs(alice, number);
        assertEq(runOf(challenge, runId).player, alice);
    }

    function test_StartRun_RecordsTheSeason() public {
        uint256 first = openDefaultSeason();
        vm.warp(season.endOf(first));
        uint256 second = openDefaultSeason();
        uint256 runId = startRunAs(alice, second);
        assertEq(runOf(challenge, runId).season, second);
    }

    function test_StartRun_CommitsEntropyRevealDelayBlocksAheadInChallengesNamespace() public {
        uint256 number = openDefaultSeason();
        uint256 paidAt = arbSys.arbBlockNumber();
        uint256 runId = startRunAs(alice, number);
        assertEq(entropy.targetBlock(address(challenge), expectedEntropyId(runId)), paidAt + REVEAL_DELAY);
    }

    function test_StartRun_EmitsRunStarted() public {
        uint256 number = openDefaultSeason();
        vm.expectEmit(address(challenge));
        emit Challenge.RunStarted(1, alice, number, expectedEntropyId(1));
        startRunAs(alice, number);
    }

    // Reveal.

    function test_RevealRun_RevertsForAnotherAddress() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        advanceArbBlocks(REVEAL_DELAY + 1);
        expectRevealRevert(bob, runId, abi.encodeWithSelector(Challenge.NotPlayer.selector, runId, bob));
    }

    function test_RevealRun_RevertsBeforeTheEntropyBlockIsReadable() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        advanceArbBlocks(REVEAL_DELAY);
        expectRevealRevert(alice, runId, bytes("not ready"));
    }

    function test_RevealRun_RevertsOnASecondReveal() public {
        uint256 runId = startAndRevealAs(alice, openDefaultSeason());
        expectRevealRevert(alice, runId, abi.encodeWithSelector(Challenge.AlreadyRevealed.selector, runId));
    }

    function test_RevealRun_SucceedsOnTheLastBlockOfTheWindow() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        advanceArbBlocks(REVEAL_DELAY + READ_WINDOW);
        revealAs(alice, runId);
        assertEq(runOf(challenge, runId).revealedAt, block.timestamp);
    }

    function test_RevealRun_RevertsOnceTheWindowHasLapsed() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        advanceArbBlocks(REVEAL_DELAY + READ_WINDOW + 1);
        expectRevealRevert(alice, runId, bytes("window lapsed"));
    }

    function test_RevealRun_ALapsedRunIsNeverReAnchored() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        advanceArbBlocks(100_000);
        expectRevealRevert(alice, runId, bytes("window lapsed"));
    }

    function test_RevealRun_ALapsedRunKeepsItsFeeInThePot() public {
        uint256 number = openDefaultSeason();
        uint256 runId = startRunAs(alice, number);
        advanceArbBlocks(REVEAL_DELAY + READ_WINDOW + 1);
        expectRevealRevert(alice, runId, bytes("window lapsed"));
        assertEq(stateOf(season, number).fees, RUN_FEE);
    }

    function test_RevealRun_DerivesTheRunNonceFromTheEntropyBlock() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        uint256 target = arbSys.arbBlockNumber() + REVEAL_DELAY;
        advanceArbBlocks(REVEAL_DELAY + 1);
        revealAs(alice, runId);

        bytes32 blockHash = keccak256(abi.encodePacked(target));
        bytes32 runEntropy = keccak256(abi.encodePacked(blockHash, address(challenge), expectedEntropyId(runId)));
        assertEq(runOf(challenge, runId).runNonce, keccak256(abi.encodePacked("jiro.run", runEntropy, runId)));
    }

    function test_RevealRun_GivesEachOfAPlayersRunsItsOwnNonce() public {
        uint256 number = openDefaultSeason();
        uint256 first = startRunAs(alice, number);
        uint256 second = startRunAs(alice, number);
        advanceArbBlocks(REVEAL_DELAY + 1);
        revealAs(alice, first);
        revealAs(alice, second);
        assertNotEq(runOf(challenge, first).runNonce, runOf(challenge, second).runNonce);
    }

    function test_RevealRun_RecordsRevealedAt() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        advanceArbBlocks(REVEAL_DELAY + 1);
        vm.warp(1_000_015);
        revealAs(alice, runId);
        assertEq(runOf(challenge, runId).revealedAt, 1_000_015);
    }

    function test_RevealRun_EmitsRunRevealedWithTheRunNonce() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        uint256 target = arbSys.arbBlockNumber() + REVEAL_DELAY;
        advanceArbBlocks(REVEAL_DELAY + 1);
        bytes32 runEntropy = keccak256(
            abi.encodePacked(keccak256(abi.encodePacked(target)), address(challenge), expectedEntropyId(runId))
        );
        vm.expectEmit(address(challenge));
        emit Challenge.RunRevealed(
            runId, keccak256(abi.encodePacked("jiro.run", runEntropy, runId)), uint64(block.timestamp)
        );
        revealAs(alice, runId);
    }

    // Commit.

    function test_CommitRun_RevertsForAnotherAddress() public {
        uint256 runId = startAndRevealAs(alice, openDefaultSeason());
        expectCommitRevert(bob, runId, abi.encodeWithSelector(Challenge.NotPlayer.selector, runId, bob));
    }

    function test_CommitRun_RevertsBeforeTheReveal() public {
        uint256 runId = startRunAs(alice, openDefaultSeason());
        advanceArbBlocks(REVEAL_DELAY + 1);
        expectCommitRevert(alice, runId, abi.encodeWithSelector(Challenge.NotRevealed.selector, runId));
    }

    function test_CommitRun_RevertsOnASecondCommit() public {
        uint256 runId = startAndRevealAs(alice, openDefaultSeason());
        commitAs(alice, runId, journalsOf(runId));
        expectCommitRevert(alice, runId, abi.encodeWithSelector(Challenge.AlreadyCommitted.selector, runId));
    }

    function test_CommitRun_SucceedsAtTheLatestCommitTime() public {
        uint256 runId = startAndRevealAs(alice, openDefaultSeason());
        vm.warp(block.timestamp + MAX_PLAY_SECONDS + COMMIT_SLACK);
        commitAs(alice, runId, journalsOf(runId));
        assertEq(runOf(challenge, runId).committedAt, block.timestamp);
    }

    function test_CommitRun_RevertsAfterRevealedAtPlus1080PlusCommitSlack() public {
        uint256 runId = startAndRevealAs(alice, openDefaultSeason());
        uint256 latestCommit = block.timestamp + MAX_PLAY_SECONDS + COMMIT_SLACK;
        vm.warp(latestCommit + 1);
        expectCommitRevert(alice, runId, abi.encodeWithSelector(Challenge.CommitTooLate.selector, runId, latestCommit));
    }

    function testFuzz_CommitRun_IsAcceptedUntilRevealedAtPlus1080PlusCommitSlackOnly(uint64 commitSlack, uint256 delay)
        public
    {
        SeasonParams memory params = defaultParams(referee);
        params.commitSlack = uint64(bound(commitSlack, 1, 3_600));
        uint256 runId = startAndRevealAs(alice, openSeason(params));
        uint256 latestCommit = block.timestamp + MAX_PLAY_SECONDS + params.commitSlack;
        vm.warp(block.timestamp + bound(delay, 0, MAX_PLAY_SECONDS + 3_601));

        if (block.timestamp <= latestCommit) {
            commitAs(alice, runId, journalsOf(runId));
            assertEq(runOf(challenge, runId).committedAt, block.timestamp);
        } else {
            expectCommitRevert(
                alice, runId, abi.encodeWithSelector(Challenge.CommitTooLate.selector, runId, latestCommit)
            );
        }
    }

    function test_CommitRun_TakesTheCommitSlackOfTheRunsSeason() public {
        uint256 first = openDefaultSeason();
        vm.warp(season.endOf(first) - 1);
        uint256 runId = startAndRevealAs(alice, first);
        uint256 latestCommit = block.timestamp + MAX_PLAY_SECONDS + COMMIT_SLACK;
        vm.warp(season.endOf(first));
        SeasonParams memory params = defaultParams(referee);
        params.commitSlack = 3_600;
        openSeason(params);
        vm.warp(latestCommit + 1);
        expectCommitRevert(alice, runId, abi.encodeWithSelector(Challenge.CommitTooLate.selector, runId, latestCommit));
    }

    function test_CommitRun_StoresTheRunCommitmentOfEveryFixture() public {
        uint256 number = openDefaultSeason();
        uint256 count;
        for (; vm.keyExistsJson(fixture, entryKey(count)); ++count) {
            string memory key = entryKey(count);
            bytes[] memory journals = vm.parseJsonBytesArray(fixture, string.concat(key, ".journals"));
            bytes32 runCommitment = vm.parseJsonBytes32(fixture, string.concat(key, ".runCommitment"));
            uint256 runId = startAndRevealAs(alice, number);
            commitAs(alice, runId, sixJournals(journals));
            assertEq(runOf(challenge, runId).commitment, runCommitment, key);
        }
        assertGt(count, 0, "runCommitments is empty");
    }

    function test_CommitRun_RecordsCommittedAt() public {
        uint256 runId = startAndRevealAs(alice, openDefaultSeason());
        vm.warp(block.timestamp + 400);
        commitAs(alice, runId, journalsOf(runId));
        assertEq(runOf(challenge, runId).committedAt, 1_000_400);
    }

    function test_CommitRun_EmitsRunCommitted() public {
        uint256 runId = startAndRevealAs(alice, openDefaultSeason());
        bytes[6] memory journals = journalsOf(runId);
        vm.expectEmit(address(challenge));
        emit Challenge.RunCommitted(runId, runCommitmentOf(journals), uint64(block.timestamp));
        commitAs(alice, runId, journals);
    }

    function entryKey(uint256 i) private pure returns (string memory) {
        return string.concat(".runCommitments[", vm.toString(i), "]");
    }

    function sixJournals(bytes[] memory journals) private pure returns (bytes[6] memory run) {
        assertEq(journals.length, 6, "a run has six journals");
        for (uint256 i; i < 6; ++i) {
            run[i] = journals[i];
        }
    }
}

/// The gas of each step, for docs/VERIFICATION.md. Each test logs the gas Foundry meters for one
/// call from the test, which is the transaction's gas, intrinsic and calldata gas included, without
/// EIP-7623's calldata floor. The commit tests also log the calldata size and its EIP-2028 gas, from
/// which the floor follows. Run with `forge test --match-contract ChallengeGas -vv`.
contract ChallengeGasTest is ChallengeFixture {
    /// Bot medians of 439 ticks per level on average (reports/playtest-449f231636aa.json), at the
    /// 0.073 events per tick of the user's play-test journals (reports/playtest-human-1.md).
    uint16 private constant TYPICAL_EVENTS = 32;
    uint16 private constant TYPICAL_TICK_STEP = 14;

    uint256 private number;

    function setUp() public override {
        super.setUp();
        number = openDefaultSeason();
        startRunAs(bob, number);
    }

    function logLastCallGas(string memory label) private {
        Vm.Gas memory gas = vm.lastCallGas();
        emit log_named_uint(label, gas.gasTotalUsed);
    }

    function calldataGasOf(bytes memory data) private pure returns (uint256 gas) {
        for (uint256 i; i < data.length; ++i) {
            gas += data[i] == 0 ? 4 : 16;
        }
    }

    function measureCommit(string memory label, uint16 eventCount, uint16 tickStep) private {
        uint256 runId = startAndRevealAs(alice, number);
        bytes[6] memory journals = sixJournalsOf(runOf(challenge, runId).runNonce, eventCount, tickStep);
        bytes memory data = abi.encodeCall(Challenge.commitRun, (runId, journals));
        vm.prank(alice);
        challenge.commitRun(runId, journals);
        logLastCallGas(string.concat(label, " gas"));
        emit log_named_uint(string.concat(label, " calldata bytes"), data.length);
        emit log_named_uint(string.concat(label, " calldata gas"), calldataGasOf(data));
        assertEq(runOf(challenge, runId).commitment, runCommitmentOf(journals));
    }

    function test_Gas_StartRun() public {
        vm.prank(alice);
        uint256 runId = challenge.startRun{value: RUN_FEE}(number);
        logLastCallGas("startRun gas");
        assertEq(runOf(challenge, runId).player, alice);
    }

    function test_Gas_RevealRun() public {
        uint256 runId = startRunAs(alice, number);
        advanceArbBlocks(REVEAL_DELAY + 1);
        vm.prank(alice);
        challenge.revealRun(runId);
        logLastCallGas("revealRun gas");
        assertEq(runOf(challenge, runId).revealedAt, block.timestamp);
    }

    function test_Gas_CommitRunWithATypicalBlob() public {
        measureCommit("commitRun, typical blob", TYPICAL_EVENTS, TYPICAL_TICK_STEP);
    }

    function test_Gas_CommitRunWithAFullBlob() public {
        measureCommit("commitRun, full blob", MAX_EVENTS, 1);
    }
}

/// Drives Challenge as players and Season as its operator, with every input bounded to a valid
/// one, so that each call changes state or returns early instead of reverting.
contract ChallengeHandler is CommonBase, StdCheats, StdUtils {
    Challenge private immutable challenge;
    Season private immutable season;
    MockArbSys private immutable arbSys;
    ArbBlockhashEntropy private immutable entropy;
    MockReferee private immutable referee;
    address private immutable operator;
    address[] private players;
    uint256 public feesPaid;

    constructor(
        Challenge challenge_,
        Season season_,
        MockArbSys arbSys_,
        ArbBlockhashEntropy entropy_,
        MockReferee referee_,
        address operator_
    ) {
        challenge = challenge_;
        season = season_;
        arbSys = arbSys_;
        entropy = entropy_;
        referee = referee_;
        operator = operator_;
        for (uint256 i; i < 3; ++i) {
            players.push(address(uint160(0x2000 + i)));
        }
    }

    function openSeason(uint256 runFee, uint64 length, uint64 commitSlack) external {
        uint256 current = season.currentSeason();
        if (current != 0 && block.timestamp < season.endOf(current)) return;
        SeasonParams memory params = defaultParams(referee);
        params.runFee = bound(runFee, 1, 1 ether);
        params.length = uint64(bound(length, 1, 1 days));
        params.commitSlack = uint64(bound(commitSlack, 1, 3_600));
        vm.prank(operator);
        season.open(params);
    }

    function startRun(uint256 playerSeed) external {
        uint256 current = season.currentSeason();
        if (current == 0 || block.timestamp >= season.endOf(current)) return;
        address player = players[bound(playerSeed, 0, players.length - 1)];
        uint256 runFee = season.paramsOf(current).runFee;
        vm.deal(player, runFee);
        vm.prank(player);
        challenge.startRun{value: runFee}(current);
        feesPaid += runFee;
    }

    function advance(uint256 blocks, uint256 seconds_) external {
        arbSys.setBlockNumber(arbSys.arbBlockNumber() + bound(blocks, 1, 60));
        vm.warp(block.timestamp + bound(seconds_, 0, 600));
    }

    /// One of the last eight runs, which are the ones still likely to be in their reveal window
    /// or before their commit bound.
    function recentRun(uint256 runSeed, uint256 runCount) private pure returns (uint256) {
        return runCount - bound(runSeed, 0, runCount < 8 ? runCount - 1 : 7);
    }

    function revealRun(uint256 runSeed) external {
        uint256 runCount = challenge.runCount();
        if (runCount == 0) return;
        uint256 runId = recentRun(runSeed, runCount);
        Run memory run = runOf(challenge, runId);
        if (run.revealedAt != 0 || !entropy.isRevealable(address(challenge), challenge.entropyIdOf(runId))) return;
        vm.prank(run.player);
        challenge.revealRun(runId);
    }

    function commitRun(uint256 runSeed) external {
        uint256 runCount = challenge.runCount();
        if (runCount == 0) return;
        uint256 runId = recentRun(runSeed, runCount);
        Run memory run = runOf(challenge, runId);
        if (run.revealedAt == 0 || run.committedAt != 0) return;
        if (block.timestamp > run.revealedAt + MAX_PLAY_SECONDS + season.commitSlackOf(run.season)) return;
        vm.prank(run.player);
        challenge.commitRun(runId, sixJournalsOf(run.runNonce, 3, 30));
    }
}

contract ChallengeInvariantTest is ChallengeFixture {
    ChallengeHandler private handler;

    function setUp() public override {
        super.setUp();
        handler = new ChallengeHandler(challenge, season, arbSys, entropy, referee, operator);
        targetContract(address(handler));
    }

    function invariant_SeasonIsSolvent() public view {
        assertTrue(season.isSolvent());
    }

    function invariant_ChallengeHoldsNoEth() public view {
        assertEq(address(challenge).balance, 0);
    }

    function invariant_SeasonHoldsEveryFeePaid() public view {
        uint256 fees;
        for (uint256 number = 1; number <= season.currentSeason(); ++number) {
            fees += stateOf(season, number).fees;
        }
        assertEq(fees, handler.feesPaid());
        assertEq(address(season).balance, fees);
    }
}
