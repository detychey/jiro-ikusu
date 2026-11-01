// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {Challenge, Run, Settlement, SettlementStatus} from "../src/Challenge.sol";
import {Outcome} from "../src/interfaces/IReferee.sol";
import {MockReferee} from "../src/mocks/MockReferee.sol";
import {Season, SeasonParams, BestRun} from "../src/Season.sol";
import {ChallengeFixture, calldataGasOf, journalOf, runOf} from "./Challenge.t.sol";
import {RULES_VERSION, COMMIT_SLACK, defaultParams, bestRunOf, settlementEndOf} from "./Season.t.sol";

uint8 constant MODE_TRAINING = 0;
uint8 constant MODE_CHALLENGE = 1;
uint8 constant END_REASON_CLEARED = 2;
uint8 constant END_REASON_OUT_OF_LIVES = 3;
uint256 constant TICKS_PER_SECOND = 15;

/// What a run's settlement submits for one level, with the Outcome the referee returns for it.
struct PlayedLevel {
    bytes level;
    bytes journal;
    uint16 weightBp;
    Outcome outcome;
}

function settlementOf(Challenge challenge, uint256 runId) view returns (Settlement memory settlement) {
    (settlement.status, settlement.settledLevels, settlement.clears, settlement.score, settlement.ticks) =
        challenge.settlements(runId);
}

/// The level bytes whose id `defaultParams` puts in `slot`.
function defaultLevelOf(uint256 slot) pure returns (bytes memory) {
    return abi.encodePacked("level", slot);
}

/// Level `slot` of a `defaultParams` season, played at `levelIndex` of a run, with the Outcome of
/// the given result, scored at the slot's weight (README §8.4).
function defaultPlayedLevelOf(
    bytes32 runNonce,
    uint8 levelIndex,
    uint8 slot,
    uint8 endReason,
    uint16 claimBp,
    uint16 ticksUsed
) pure returns (PlayedLevel memory played) {
    played.level = defaultLevelOf(slot);
    played.journal = journalOf(runNonce, levelIndex, 3, 30);
    played.weightBp = uint16(10_000 + slot);
    played.outcome = Outcome({
        journalHash: keccak256(played.journal),
        levelId: keccak256(played.level),
        runNonce: runNonce,
        levelIndex: levelIndex,
        drawSlot: slot,
        mode: MODE_CHALLENGE,
        rulesVersion: RULES_VERSION,
        endReason: endReason,
        claimBp: claimBp,
        ticksUsed: ticksUsed,
        levelScore: endReason == END_REASON_OUT_OF_LIVES ? 0 : uint32(uint256(claimBp) * played.weightBp / 10_000)
    });
}

function levelBytesOf(PlayedLevel[6] memory played) pure returns (bytes[6] memory levels) {
    for (uint256 i; i < 6; ++i) {
        levels[i] = played[i].level;
    }
}

function journalBytesOf(PlayedLevel[6] memory played) pure returns (bytes[6] memory journals) {
    for (uint256 i; i < 6; ++i) {
        journals[i] = played[i].journal;
    }
}

function journalHashesOf(PlayedLevel[6] memory played) pure returns (bytes32[6] memory journalHashes) {
    for (uint256 i; i < 6; ++i) {
        journalHashes[i] = keccak256(played[i].journal);
    }
}

function setOutcomes(MockReferee referee, PlayedLevel[6] memory played) {
    for (uint256 i; i < 6; ++i) {
        referee.setOutcome(played[i].level, played[i].journal, played[i].weightBp, played[i].outcome);
    }
}

/// README §7.2: ceil(Σ ticksUsed / 15) seconds of play.
function playSecondsOf(PlayedLevel[6] memory played) pure returns (uint256) {
    uint256 ticks;
    for (uint256 i; i < 6; ++i) {
        ticks += played[i].outcome.ticksUsed;
    }
    return (ticks + TICKS_PER_SECOND - 1) / TICKS_PER_SECOND;
}

/// The journal bytes v1 (README §6.3) of a training journal, played again in a Challenge run: the
/// header's mode, runNonce and levelIndex are the run's, and the events are unchanged.
function challengeJournalOf(bytes memory journal, bytes32 runNonce, uint8 levelIndex) pure returns (bytes memory) {
    journal[3] = bytes1(MODE_CHALLENGE);
    for (uint256 k; k < 32; ++k) {
        journal[4 + k] = runNonce[k];
    }
    journal[68] = bytes1(levelIndex);
    return journal;
}

/// A run of the calibration season (seasons/calibration-1.json) whose six levels replay six
/// gate-set vectors (vectors/levels/): MockReferee returns each vector's Outcome, its level id,
/// rules version, end reason, claim, ticks used and score at the season's weight, bound to the
/// run: the vectors are training journals of other run nonces, so the journal hash, run nonce,
/// level index, mode and draw slot are the run's.
abstract contract SettlementFixture is ChallengeFixture {
    uint256 internal number;
    bytes32[] internal calibrationLevelIds;
    uint256[] internal calibrationWeightsBp;
    uint16 internal calibrationRulesVersion;

    function setUp() public virtual override {
        super.setUp();
        string memory calibration = vm.readFile(string.concat(vm.projectRoot(), "/../seasons/calibration-1.json"));
        calibrationLevelIds = vm.parseJsonBytes32Array(calibration, ".levelIds");
        calibrationWeightsBp = vm.parseJsonUintArray(calibration, ".weightsBp");
        calibrationRulesVersion = uint16(vm.parseJsonUint(calibration, ".rulesVersion"));
        number = openSeason(calibrationParams(referee));
    }

    function calibrationParams(MockReferee referee_) internal view returns (SeasonParams memory params) {
        params = defaultParams(referee_);
        params.rulesVersion = calibrationRulesVersion;
        for (uint256 slot; slot < 16; ++slot) {
            params.levelIds[slot] = calibrationLevelIds[slot];
            params.weightsBp[slot] = uint16(calibrationWeightsBp[slot]);
        }
    }

    /// Five levels that end Cleared, out of lives or at the time limit, and a sixth of each kind.
    function runVectorName(uint256 levelIndex) internal pure returns (string memory) {
        string[6] memory names = ["05-synthetic", "13-worst", "10-synthetic", "08-worst", "01-synthetic", "16-worst"];
        return names[levelIndex];
    }

    function calibrationSlotOf(bytes32 levelId) internal view returns (uint8) {
        for (uint8 slot; slot < 16; ++slot) {
            if (calibrationLevelIds[slot] == levelId) return slot;
        }
        revert("level not in the calibration season");
    }

    function playedLevelOf(string memory vectorName, bytes32 runNonce, uint8 levelIndex)
        internal
        view
        returns (PlayedLevel memory played)
    {
        string memory vector = vm.readFile(string.concat(vm.projectRoot(), "/../vectors/levels/", vectorName, ".json"));
        played.level = vm.parseJsonBytes(vector, ".level");
        played.journal = challengeJournalOf(vm.parseJsonBytes(vector, ".journal"), runNonce, levelIndex);
        played.weightBp = uint16(vm.parseJsonUint(vector, ".weightBp"));
        played.outcome = vectorOutcomeOf(vector);
        uint8 slot = calibrationSlotOf(played.outcome.levelId);
        assertEq(played.weightBp, calibrationWeightsBp[slot], "the vector is scored at its season weight");
        played.outcome.journalHash = keccak256(played.journal);
        played.outcome.runNonce = runNonce;
        played.outcome.levelIndex = levelIndex;
        played.outcome.drawSlot = slot;
        played.outcome.mode = MODE_CHALLENGE;
    }

    function vectorOutcomeOf(string memory vector) private pure returns (Outcome memory outcome) {
        outcome.levelId = vm.parseJsonBytes32(vector, ".outcome.levelId");
        outcome.rulesVersion = uint16(vm.parseJsonUint(vector, ".outcome.rulesVersion"));
        outcome.endReason = uint8(vm.parseJsonUint(vector, ".outcome.endReason"));
        outcome.claimBp = uint16(vm.parseJsonUint(vector, ".outcome.claimBp"));
        outcome.ticksUsed = uint16(vm.parseJsonUint(vector, ".outcome.ticksUsed"));
        outcome.levelScore = uint32(vm.parseJsonUint(vector, ".outcome.levelScore"));
    }

    function playedLevelsOf(uint256 runId) internal view returns (PlayedLevel[6] memory played) {
        bytes32 runNonce = runOf(challenge, runId).runNonce;
        for (uint8 i; i < 6; ++i) {
            played[i] = playedLevelOf(runVectorName(i), runNonce, i);
        }
    }

    function commitPlayed(address player, uint256 runId, PlayedLevel[6] memory played) internal {
        setOutcomes(referee, played);
        commitAs(player, runId, journalBytesOf(played));
    }

    /// Alice's run, revealed and committed at once, so it is on time.
    function committedRun() internal returns (uint256 runId, PlayedLevel[6] memory played) {
        runId = startAndRevealAs(alice, number);
        played = playedLevelsOf(runId);
        commitPlayed(alice, runId, played);
    }

    /// Alice's run, committed one second after its deadline.
    function lateRun() internal returns (uint256 runId, PlayedLevel[6] memory played) {
        runId = startAndRevealAs(alice, number);
        played = playedLevelsOf(runId);
        vm.warp(block.timestamp + playSecondsOf(played) + COMMIT_SLACK + 1);
        commitPlayed(alice, runId, played);
    }

    function settleRun(uint256 runId, PlayedLevel[6] memory played) internal {
        challenge.settleRun(runId, levelBytesOf(played), journalBytesOf(played), "");
        assertSolvent();
    }

    function settleLevel(uint256 runId, PlayedLevel[6] memory played, uint8 i) internal {
        challenge.settleLevel(runId, i, journalHashesOf(played), played[i].level, played[i].journal, "");
        assertSolvent();
    }

    function settleLevels(uint256 runId, PlayedLevel[6] memory played, uint8 count) internal {
        for (uint8 i; i < count; ++i) {
            settleLevel(runId, played, i);
        }
    }

    function expectSettleRunRevert(uint256 runId, PlayedLevel[6] memory played, bytes memory revertData) internal {
        bytes[6] memory levels = levelBytesOf(played);
        bytes[6] memory journals = journalBytesOf(played);
        vm.expectRevert(revertData);
        challenge.settleRun(runId, levels, journals, "");
    }

    function expectSettleLevelRevert(uint256 runId, PlayedLevel[6] memory played, uint8 i, bytes memory revertData)
        internal
    {
        bytes32[6] memory journalHashes = journalHashesOf(played);
        vm.expectRevert(revertData);
        challenge.settleLevel(runId, i, journalHashes, played[i].level, played[i].journal, "");
    }

    /// The run's score, ticks and clears, summed here from the Outcomes the referee returns.
    function totalsOf(PlayedLevel[6] memory played) internal pure returns (uint32 score, uint32 ticks, uint8 clears) {
        for (uint256 i; i < 6; ++i) {
            score += played[i].outcome.levelScore;
            ticks += played[i].outcome.ticksUsed;
            if (played[i].outcome.endReason == END_REASON_CLEARED) ++clears;
        }
    }

    function expectedRecordRun(uint256 runId, PlayedLevel[6] memory played) internal view returns (bytes memory) {
        (uint32 score, uint32 ticks, uint8 clears) = totalsOf(played);
        return abi.encodeCall(Season.recordRun, (number, runOf(challenge, runId).player, runId, score, ticks, clears));
    }

    function assertRecorded(uint256 runId, PlayedLevel[6] memory played) internal view {
        (uint32 score, uint32 ticks, uint8 clears) = totalsOf(played);
        BestRun memory best = bestRunOf(season, number, runOf(challenge, runId).player);
        assertEq(uint8(settlementOf(challenge, runId).status), uint8(SettlementStatus.Settled), "status");
        assertEq(best.runId, runId, "best run");
        assertEq(best.score, score, "score");
        assertEq(best.ticks, ticks, "ticks");
        assertEq(best.qualified, clears >= season.paramsOf(number).minClears, "qualified");
    }
}

contract SettlementTest is SettlementFixture {
    function bytes32Of(string memory tag) private pure returns (bytes32) {
        return keccak256(bytes(tag));
    }

    function openFieldLevel() private view returns (bytes memory) {
        string memory fixture = vm.readFile(string.concat(vm.projectRoot(), "/../vectors/derivations.json"));
        return vm.parseJsonBytes(fixture, ".levelIds[0].level");
    }

    function expectNoRecordRun() private {
        vm.expectCall(address(season), abi.encodeWithSelector(Season.recordRun.selector), 0);
    }

    // Happy paths, with the vectors' Outcomes.

    function test_SettleRun_SettlesARun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleRun(runId, played);
        assertRecorded(runId, played);
    }

    function test_SettleLevel_SettlesARunInSixCalls() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleLevels(runId, played, 6);
        assertRecorded(runId, played);
    }

    function test_SettleRun_SettlesARunAfterTwoSettleLevelCalls() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleLevels(runId, played, 2);
        settleRun(runId, played);
        assertRecorded(runId, played);
    }

    function test_SettleRun_PassesTheRunsScoreTicksAndClearsToRecordRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        vm.expectCall(address(season), expectedRecordRun(runId, played), 1);
        settleRun(runId, played);
    }

    function test_SettleLevel_PassesTheRunsScoreTicksAndClearsToRecordRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        vm.expectCall(address(season), expectedRecordRun(runId, played), 1);
        settleLevels(runId, played, 6);
    }

    function test_SettleLevel_DoesNotRecordTheRunBeforeItsSixthLevel() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        expectNoRecordRun();
        settleLevels(runId, played, 5);
    }

    function test_SettleLevel_KeepsTheRunUnsettledBeforeItsSixthLevel() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleLevels(runId, played, 5);
        assertEq(uint8(settlementOf(challenge, runId).status), uint8(SettlementStatus.Unsettled));
    }

    function test_SettleRun_CreditsTheRunsPlayerWhenAnotherAddressSubmits() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        vm.prank(bob);
        challenge.settleRun(runId, levelBytesOf(played), journalBytesOf(played), "");
        assertEq(bestRunOf(season, number, alice).runId, runId, "alice is credited");
        assertEq(bestRunOf(season, number, bob).runId, 0, "bob is not");
    }

    function test_SettleRun_EmitsRunSettled() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        (uint32 score, uint32 ticks, uint8 clears) = totalsOf(played);
        vm.expectEmit(address(challenge));
        emit Challenge.RunSettled(runId, alice, score, ticks, clears);
        settleRun(runId, played);
    }

    function test_SettleLevel_EmitsLevelSettled() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        vm.expectEmit(address(challenge));
        emit Challenge.LevelSettled(runId, 0);
        settleLevel(runId, played, 0);
    }

    function test_SettleRun_SettlesAtTheEndOfTheGracePeriod() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        vm.warp(settlementEndOf(season, number));
        settleRun(runId, played);
        assertRecorded(runId, played);
    }

    function test_SettleRun_SettlesThroughItsSeasonsRefereeAfterTheNextSeasonOpens() public {
        vm.warp(season.endOf(number) - 1);
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        vm.warp(season.endOf(number));
        MockReferee nextReferee = new MockReferee(calibrationRulesVersion + 1);
        SeasonParams memory params = calibrationParams(nextReferee);
        params.rulesVersion = calibrationRulesVersion + 1;
        openSeason(params);
        settleRun(runId, played);
        assertRecorded(runId, played);
    }

    function test_SettleRun_CanBeSubmittedAgainAfterARejection() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        bytes memory level = played[2].level;
        played[2].level = openFieldLevel();
        expectSettleRunRevert(
            runId, played, abi.encodeWithSelector(Season.LevelNotInSeason.selector, number, keccak256(played[2].level))
        );
        played[2].level = level;
        settleRun(runId, played);
        assertRecorded(runId, played);
    }

    // settleRun rejections, in the order of README §7.2.

    function test_SettleRun_RevertsBeforeTheCommit() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        setOutcomes(referee, played);
        expectSettleRunRevert(runId, played, abi.encodeWithSelector(Challenge.NotCommitted.selector, runId));
    }

    function test_SettleRun_RevertsOnASettledRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleRun(runId, played);
        expectSettleRunRevert(runId, played, abi.encodeWithSelector(Challenge.AlreadySettled.selector, runId));
    }

    function test_SettleRun_RevertsAfterSixSettleLevelCalls() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleLevels(runId, played, 6);
        expectSettleRunRevert(runId, played, abi.encodeWithSelector(Challenge.AlreadySettled.selector, runId));
    }

    function test_SettleRun_RevertsAfterTheGracePeriod() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        uint256 settlementEnd = settlementEndOf(season, number);
        vm.warp(settlementEnd + 1);
        expectSettleRunRevert(
            runId, played, abi.encodeWithSelector(Challenge.SettlementClosed.selector, runId, settlementEnd)
        );
    }

    function test_SettleRun_RevertsWithTheJournalsOfAnotherRun() public {
        (uint256 runId,) = committedRun();
        (, PlayedLevel[6] memory otherRun) = committedRun();
        expectSettleRunRevert(runId, otherRun, abi.encodeWithSelector(Challenge.WrongCommitment.selector, runId));
    }

    function test_SettleRun_RevertsWithAJournalNotMatchingTheCommitment() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        bytes memory journal = played[3].journal;
        journal[journal.length - 1] ^= 0x01;
        referee.setOutcome(played[3].level, journal, played[3].weightBp, played[3].outcome);
        expectSettleRunRevert(runId, played, abi.encodeWithSelector(Challenge.WrongCommitment.selector, runId));
    }

    function test_SettleRun_RevertsWithALevelNotInTheSeason() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        played[2].level = openFieldLevel();
        expectSettleRunRevert(
            runId, played, abi.encodeWithSelector(Season.LevelNotInSeason.selector, number, keccak256(played[2].level))
        );
    }

    function test_SettleRun_RevertsWhenTheRefereeRejectsALevel() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        commitAs(alice, runId, journalBytesOf(played));
        expectSettleRunRevert(
            runId,
            played,
            abi.encodeWithSelector(
                MockReferee.NoOutcome.selector,
                keccak256(played[0].level),
                keccak256(played[0].journal),
                played[0].weightBp
            )
        );
    }

    function test_SettleRun_RevertsOnAnOutcomeOfAnotherJournal() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        played[1].outcome.journalHash = bytes32Of("another journal");
        commitPlayed(alice, runId, played);
        expectSettleRunRevert(
            runId,
            played,
            abi.encodeWithSelector(Challenge.OutcomeJournalHashMismatch.selector, 1, played[1].outcome.journalHash)
        );
    }

    function test_SettleRun_RevertsOnAnOutcomeOfAnotherLevel() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        played[1].outcome.levelId = calibrationLevelIds[2];
        commitPlayed(alice, runId, played);
        expectSettleRunRevert(
            runId, played, abi.encodeWithSelector(Challenge.OutcomeLevelIdMismatch.selector, 1, calibrationLevelIds[2])
        );
    }

    function test_SettleRun_RevertsOnAForeignRunNonce() public {
        uint256 runId = startAndRevealAs(alice, number);
        bytes32 foreignNonce = runOf(challenge, startAndRevealAs(bob, number)).runNonce;
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        played[2] = playedLevelOf(runVectorName(2), foreignNonce, 2);
        commitPlayed(alice, runId, played);
        expectSettleRunRevert(
            runId, played, abi.encodeWithSelector(Challenge.OutcomeRunNonceMismatch.selector, 2, foreignNonce)
        );
    }

    function test_SettleRun_RevertsOnAWrongLevelIndex() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        (played[1], played[4]) = (played[4], played[1]);
        commitPlayed(alice, runId, played);
        expectSettleRunRevert(runId, played, abi.encodeWithSelector(Challenge.OutcomeLevelIndexMismatch.selector, 1, 4));
    }

    /// An easier season level played in place of the drawn one: the referee's draw slot still
    /// names the drawn level.
    function test_SettleRun_RevertsOnADrawSlotNamingAnotherLevel() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        uint8 drawnSlot = played[3].outcome.drawSlot;
        played[3] = playedLevelOf("02-synthetic", runOf(challenge, runId).runNonce, 3);
        uint8 playedSlot = played[3].outcome.drawSlot;
        played[3].outcome.drawSlot = drawnSlot;
        commitPlayed(alice, runId, played);
        expectSettleRunRevert(
            runId, played, abi.encodeWithSelector(Challenge.OutcomeDrawSlotMismatch.selector, 3, drawnSlot, playedSlot)
        );
    }

    function test_SettleRun_RevertsOnAnotherRulesVersion() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        uint16 otherRulesVersion = calibrationRulesVersion + 1;
        played[0].journal[1] = bytes1(uint8(otherRulesVersion >> 8));
        played[0].journal[2] = bytes1(uint8(otherRulesVersion));
        played[0].outcome.journalHash = keccak256(played[0].journal);
        played[0].outcome.rulesVersion = otherRulesVersion;
        commitPlayed(alice, runId, played);
        expectSettleRunRevert(
            runId, played, abi.encodeWithSelector(Challenge.OutcomeRulesVersionMismatch.selector, 0, otherRulesVersion)
        );
    }

    function test_SettleRun_RevertsOnATrainingModeJournal() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        played[5].journal[3] = bytes1(MODE_TRAINING);
        played[5].outcome.journalHash = keccak256(played[5].journal);
        played[5].outcome.mode = MODE_TRAINING;
        commitPlayed(alice, runId, played);
        expectSettleRunRevert(
            runId, played, abi.encodeWithSelector(Challenge.OutcomeModeMismatch.selector, 5, MODE_TRAINING)
        );
    }

    // settleLevel rejections.

    function test_SettleLevel_RevertsWithALevelIndexAboveFive() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        bytes32[6] memory journalHashes = journalHashesOf(played);
        vm.expectRevert(abi.encodeWithSelector(Challenge.LevelIndexOutOfRange.selector, 6));
        challenge.settleLevel(runId, 6, journalHashes, played[5].level, played[5].journal, "");
    }

    function test_SettleLevel_RevertsBeforeTheCommit() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        setOutcomes(referee, played);
        expectSettleLevelRevert(runId, played, 0, abi.encodeWithSelector(Challenge.NotCommitted.selector, runId));
    }

    function test_SettleLevel_RevertsOnASettledLevel() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleLevel(runId, played, 2);
        expectSettleLevelRevert(
            runId, played, 2, abi.encodeWithSelector(Challenge.LevelAlreadySettled.selector, runId, 2)
        );
    }

    function test_SettleLevel_RevertsAfterSettleRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleRun(runId, played);
        expectSettleLevelRevert(runId, played, 0, abi.encodeWithSelector(Challenge.AlreadySettled.selector, runId));
    }

    function test_SettleLevel_RevertsAfterTheGracePeriod() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        uint256 settlementEnd = settlementEndOf(season, number);
        vm.warp(settlementEnd + 1);
        expectSettleLevelRevert(
            runId, played, 0, abi.encodeWithSelector(Challenge.SettlementClosed.selector, runId, settlementEnd)
        );
    }

    function test_SettleLevel_RevertsWithJournalHashesNotMatchingTheCommitment() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        bytes32[6] memory journalHashes = journalHashesOf(played);
        journalHashes[4] = bytes32Of("another journal");
        vm.expectRevert(abi.encodeWithSelector(Challenge.WrongCommitment.selector, runId));
        challenge.settleLevel(runId, 0, journalHashes, played[0].level, played[0].journal, "");
    }

    function test_SettleLevel_RevertsWithAJournalNotMatchingItsHash() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        bytes32[6] memory journalHashes = journalHashesOf(played);
        vm.expectRevert(abi.encodeWithSelector(Challenge.JournalNotInCommitment.selector, runId, 2));
        challenge.settleLevel(runId, 2, journalHashes, played[1].level, played[1].journal, "");
    }

    function test_SettleLevel_RevertsWithALevelNotInTheSeason() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        played[0].level = openFieldLevel();
        expectSettleLevelRevert(
            runId,
            played,
            0,
            abi.encodeWithSelector(Season.LevelNotInSeason.selector, number, keccak256(played[0].level))
        );
    }

    function test_SettleLevel_RevertsOnAForeignRunNonce() public {
        uint256 runId = startAndRevealAs(alice, number);
        bytes32 foreignNonce = runOf(challenge, startAndRevealAs(bob, number)).runNonce;
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        played[2] = playedLevelOf(runVectorName(2), foreignNonce, 2);
        commitPlayed(alice, runId, played);
        expectSettleLevelRevert(
            runId, played, 2, abi.encodeWithSelector(Challenge.OutcomeRunNonceMismatch.selector, 2, foreignNonce)
        );
    }

    // The deadline (README §7.2).

    function test_SettleRun_KeepsARunCommittedAtItsDeadlineOnTime() public {
        uint256 runId = startAndRevealAs(alice, number);
        PlayedLevel[6] memory played = playedLevelsOf(runId);
        vm.warp(block.timestamp + playSecondsOf(played) + COMMIT_SLACK);
        commitPlayed(alice, runId, played);
        settleRun(runId, played);
        assertRecorded(runId, played);
    }

    function test_SettleRun_MarksALateRunLateWithoutReverting() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        settleRun(runId, played);
        assertEq(uint8(settlementOf(challenge, runId).status), uint8(SettlementStatus.Late));
    }

    function test_SettleRun_ALateRunEarnsNothing() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        expectNoRecordRun();
        settleRun(runId, played);
    }

    function test_SettleRun_ALateRunCannotBeSettledAgain() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        settleRun(runId, played);
        expectSettleRunRevert(runId, played, abi.encodeWithSelector(Challenge.AlreadySettled.selector, runId));
    }

    function test_SettleLevel_MarksALateRunLateOnItsSixthLevel() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        settleLevels(runId, played, 6);
        assertEq(uint8(settlementOf(challenge, runId).status), uint8(SettlementStatus.Late));
    }

    function test_SettleLevel_ALateRunEarnsNothing() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        expectNoRecordRun();
        settleLevels(runId, played, 6);
    }

    function test_SettleLevel_ALateRunCannotBeSettledAgain() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        settleLevels(runId, played, 6);
        expectSettleLevelRevert(runId, played, 0, abi.encodeWithSelector(Challenge.AlreadySettled.selector, runId));
    }

    function test_SettleRun_EmitsRunLate() public {
        (uint256 runId, PlayedLevel[6] memory played) = lateRun();
        Run memory run = runOf(challenge, runId);
        vm.expectEmit(address(challenge));
        emit Challenge.RunLate(runId, run.committedAt - 1, run.committedAt);
        settleRun(runId, played);
    }
}

/// Every deadline fixture of vectors/derivations.json, computed by ethers (tools/xcheck), settled
/// through `settleRun` with Outcomes of its ticks used.
contract SettlementDeadlineTest is ChallengeFixture {
    function fixtureKey(uint256 i) private pure returns (string memory) {
        return string.concat(".deadlines[", vm.toString(i), "]");
    }

    /// Six different default-season levels, all cleared, with the fixture's ticks used.
    function playedLevelsOf(uint256 runId, uint256[] memory ticksUsed)
        private
        view
        returns (PlayedLevel[6] memory played)
    {
        assertEq(ticksUsed.length, 6, "a run has six levels");
        bytes32 runNonce = runOf(challenge, runId).runNonce;
        for (uint8 i; i < 6; ++i) {
            played[i] = defaultPlayedLevelOf(runNonce, i, 2 * i, END_REASON_CLEARED, 7_500, uint16(ticksUsed[i]));
        }
    }

    function settledStatusOf(string memory fixture, string memory key) private returns (SettlementStatus) {
        SeasonParams memory params = defaultParams(referee);
        params.commitSlack = uint64(vm.parseJsonUint(fixture, string.concat(key, ".commitSlack")));
        vm.warp(vm.parseJsonUint(fixture, string.concat(key, ".revealedAt")));
        uint256 runId = startAndRevealAs(alice, openSeason(params));
        PlayedLevel[6] memory played =
            playedLevelsOf(runId, vm.parseJsonUintArray(fixture, string.concat(key, ".ticksUsed")));
        vm.warp(vm.parseJsonUint(fixture, string.concat(key, ".committedAt")));
        setOutcomes(referee, played);
        commitAs(alice, runId, journalBytesOf(played));
        challenge.settleRun(runId, levelBytesOf(played), journalBytesOf(played), "");
        assertSolvent();
        return settlementOf(challenge, runId).status;
    }

    function test_SettleRun_GivesEveryDeadlineFixtureItsExpectedResult() public {
        string memory fixture = vm.readFile(string.concat(vm.projectRoot(), "/../vectors/derivations.json"));
        uint256 snapshot = vm.snapshotState();
        uint256 count;
        for (; vm.keyExistsJson(fixture, fixtureKey(count)); ++count) {
            string memory key = fixtureKey(count);
            SettlementStatus expected = vm.parseJsonBool(fixture, string.concat(key, ".onTime"))
                ? SettlementStatus.Settled
                : SettlementStatus.Late;
            assertEq(uint8(settledStatusOf(fixture, key)), uint8(expected), key);
            vm.revertToState(snapshot);
        }
        assertGt(count, 0, "deadlines is empty");
    }
}

/// Settlement gas, for docs/VERIFICATION.md, measured as ChallengeGasTest measures the other
/// steps. The gas of MockReferee's frame is read from the trace and subtracted there:
/// `forge test --match-contract SettlementGas -vvvv`.
contract SettlementGasTest is SettlementFixture {
    function logLastCallGas(string memory label, bytes memory data) private {
        Vm.Gas memory gas = vm.lastCallGas();
        emit log_named_uint(string.concat(label, " gas"), gas.gasTotalUsed);
        emit log_named_uint(string.concat(label, " calldata bytes"), data.length);
        emit log_named_uint(string.concat(label, " calldata gas"), calldataGasOf(data));
    }

    function test_Gas_SettleRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        bytes[6] memory levels = levelBytesOf(played);
        bytes[6] memory journals = journalBytesOf(played);
        challenge.settleRun(runId, levels, journals, "");
        logLastCallGas("settleRun", abi.encodeCall(Challenge.settleRun, (runId, levels, journals, "")));
        assertRecorded(runId, played);
    }

    function test_Gas_SettleLevelOfAnUnfinishedRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        bytes32[6] memory journalHashes = journalHashesOf(played);
        challenge.settleLevel(runId, 0, journalHashes, played[0].level, played[0].journal, "");
        logLastCallGas(
            "settleLevel, first level",
            abi.encodeCall(Challenge.settleLevel, (runId, 0, journalHashes, played[0].level, played[0].journal, ""))
        );
        assertEq(settlementOf(challenge, runId).settledLevels, 1);
    }

    function test_Gas_SettleLevelRecordingTheRun() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        settleLevels(runId, played, 5);
        bytes32[6] memory journalHashes = journalHashesOf(played);
        challenge.settleLevel(runId, 5, journalHashes, played[5].level, played[5].journal, "");
        logLastCallGas(
            "settleLevel, sixth level",
            abi.encodeCall(Challenge.settleLevel, (runId, 5, journalHashes, played[5].level, played[5].journal, ""))
        );
        assertRecorded(runId, played);
    }
}
