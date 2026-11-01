// Adapted from ethblockdigger's Vault at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/Vault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntropySource} from "./interfaces/IEntropySource.sol";
import {IReferee, Outcome} from "./interfaces/IReferee.sol";
import {RunDerivations} from "./RunDerivations.sol";
import {Season} from "./Season.sol";

struct Run {
    address player;
    uint64 revealedAt;
    uint64 committedAt;
    uint256 season;
    bytes32 runNonce;
    bytes32 commitment;
}

enum SettlementStatus {
    Unsettled,
    Settled,
    Late
}

/// @notice A run's settlement (README §7.2). `settledLevels` has bit i set once level i is
/// settled; score, ticks and clears sum the settled levels' Outcomes.
struct Settlement {
    SettlementStatus status;
    uint8 settledLevels;
    uint8 clears;
    uint32 score;
    uint32 ticks;
}

/// @notice A submitted level's id, and its slot and weight in the run's season.
struct SeasonLevel {
    bytes32 levelId;
    uint8 slot;
    uint16 weightBp;
}

/// @notice Challenge runs (README §7.2): the keyless pay, reveal and commit flow of ethblockdigger's
/// `Vault`. The fee goes to `Season` at once, so this contract holds no ETH. The run's season names
/// the referee that settles it, through `settleRun` or level by level through `settleLevel`.
contract Challenge {
    /// @notice Six levels of at most 2,700 ticks at 15 Hz (README §7.2).
    uint64 public constant MAX_PLAY_SECONDS = 1_080;
    uint256 private constant TICKS_PER_SECOND = 15;
    uint8 private constant LEVELS_PER_RUN = 6;
    uint8 private constant MODE_CHALLENGE = 1;
    uint8 private constant END_REASON_CLEARED = 2;
    uint8 private constant ALL_LEVELS_SETTLED = 0x3f;

    IEntropySource public immutable entropy;
    Season public immutable seasons;

    uint256 public runCount;
    mapping(uint256 runId => Run) public runs;
    mapping(uint256 runId => Settlement) public settlements;

    event RunStarted(uint256 indexed runId, address indexed player, uint256 indexed season, bytes32 entropyId);
    event RunRevealed(uint256 indexed runId, bytes32 runNonce, uint64 revealedAt);
    event RunCommitted(uint256 indexed runId, bytes32 commitment, uint64 committedAt);
    event LevelSettled(uint256 indexed runId, uint8 levelIndex);
    event RunSettled(uint256 indexed runId, address indexed player, uint32 score, uint32 ticks, uint8 clears);
    event RunLate(uint256 indexed runId, uint256 deadline, uint64 committedAt);

    error ZeroAddress();
    error NotPlayer(uint256 runId, address caller);
    error AlreadyRevealed(uint256 runId);
    error NotRevealed(uint256 runId);
    error AlreadyCommitted(uint256 runId);
    error CommitTooLate(uint256 runId, uint256 latestCommit);
    error NotCommitted(uint256 runId);
    error AlreadySettled(uint256 runId);
    error SettlementClosed(uint256 runId, uint256 settlementEnd);
    error WrongCommitment(uint256 runId);
    error JournalNotInCommitment(uint256 runId, uint8 levelIndex);
    error LevelIndexOutOfRange(uint8 levelIndex);
    error LevelAlreadySettled(uint256 runId, uint8 levelIndex);
    error OutcomeJournalHashMismatch(uint8 levelIndex, bytes32 journalHash);
    error OutcomeLevelIdMismatch(uint8 levelIndex, bytes32 levelId);
    error OutcomeRunNonceMismatch(uint8 levelIndex, bytes32 runNonce);
    error OutcomeLevelIndexMismatch(uint8 levelIndex, uint8 outcomeLevelIndex);
    error OutcomeModeMismatch(uint8 levelIndex, uint8 mode);
    error OutcomeRulesVersionMismatch(uint8 levelIndex, uint16 rulesVersion);
    error OutcomeDrawSlotMismatch(uint8 levelIndex, uint8 drawSlot, uint8 slot);

    modifier onlyPlayer(uint256 runId) {
        if (msg.sender != runs[runId].player) revert NotPlayer(runId, msg.sender);
        _;
    }

    constructor(IEntropySource entropy_, Season seasons_) {
        if (address(entropy_) == address(0) || address(seasons_) == address(0)) revert ZeroAddress();
        entropy = entropy_;
        seasons = seasons_;
    }

    /// @notice `Season.payFee` reverts unless `season` is accepting runs and `msg.value` is its fee.
    function startRun(uint256 season) external payable returns (uint256 runId) {
        runId = ++runCount;
        Run storage run = runs[runId];
        run.player = msg.sender;
        run.season = season;
        bytes32 entropyId = entropyIdOf(runId);
        emit RunStarted(runId, msg.sender, season, entropyId);
        seasons.payFee{value: msg.value}(season);
        entropy.commit(entropyId);
    }

    /// @notice Reverts while the entropy block is not readable. Once its window lapses the run is
    /// forfeited: there is no re-anchor, which would re-roll the levels, and the fee stays in the pot.
    function revealRun(uint256 runId) external onlyPlayer(runId) {
        Run storage run = runs[runId];
        if (run.revealedAt != 0) revert AlreadyRevealed(runId);
        bytes32 runNonce = RunDerivations.runNonce(entropy.reveal(entropyIdOf(runId)), runId);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 revealedAt = uint64(block.timestamp);
        run.runNonce = runNonce;
        run.revealedAt = revealedAt;
        // forge-lint: disable-next-line(reentrancy-events)
        emit RunRevealed(runId, runNonce, revealedAt);
    }

    /// @notice The journals are never parsed: they are in the calldata to publish them (P5). The
    /// on-time deadline needs their ticks used, so settlement checks it; this is only the bound
    /// past which no run can be on time.
    function commitRun(uint256 runId, bytes[6] calldata journals) external onlyPlayer(runId) {
        Run storage run = runs[runId];
        if (run.revealedAt == 0) revert NotRevealed(runId);
        if (run.committedAt != 0) revert AlreadyCommitted(runId);
        uint256 latestCommit = run.revealedAt + MAX_PLAY_SECONDS + seasons.commitSlackOf(run.season);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > latestCommit) revert CommitTooLate(runId, latestCommit);
        bytes32 commitment = RunDerivations.runCommitment(journals);
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 committedAt = uint64(block.timestamp);
        run.commitment = commitment;
        run.committedAt = committedAt;
        emit RunCommitted(runId, commitment, committedAt);
    }

    /// @notice Settles a whole run through one `verifyRun` (README §7.2, P16). Anyone may submit;
    /// the credit goes to the run's player. Each check reverts, so a failed submission records
    /// nothing and can be submitted again.
    function settleRun(uint256 runId, bytes[6] calldata levels, bytes[6] calldata journals, bytes calldata proof)
        external
    {
        Run storage run = runs[runId];
        checkSettlementOpen(runId, run);
        bytes32[6] memory journalHashes = RunDerivations.journalHashesOf(journals);
        if (RunDerivations.commitmentOf(journalHashes) != run.commitment) revert WrongCommitment(runId);

        SeasonLevel[6] memory seasonLevels;
        uint16[6] memory weightsBp;
        for (uint8 i; i < LEVELS_PER_RUN; ++i) {
            seasonLevels[i] = levelInSeason(run.season, levels[i]);
            weightsBp[i] = seasonLevels[i].weightBp;
        }
        (IReferee referee, uint16 rulesVersion) = seasons.refereeOf(run.season);
        Outcome[6] memory outcomes = referee.verifyRun(levels, journals, weightsBp, proof);

        Settlement memory settlement = Settlement(SettlementStatus.Unsettled, ALL_LEVELS_SETTLED, 0, 0, 0);
        for (uint8 i; i < LEVELS_PER_RUN; ++i) {
            checkOutcome(run, rulesVersion, i, journalHashes[i], seasonLevels[i], outcomes[i]);
            addLevel(settlement, outcomes[i]);
        }
        finishRun(runId, run, settlement);
    }

    /// @notice Settles level i alone through `verify`, for a run that does not fit in one
    /// transaction. `settleRun` stays available until all six levels are settled, and then
    /// settles the run from its own six Outcomes.
    function settleLevel(
        uint256 runId,
        uint8 i,
        bytes32[6] calldata journalHashes,
        bytes calldata level,
        bytes calldata journal,
        bytes calldata proof
    ) external {
        if (i >= LEVELS_PER_RUN) revert LevelIndexOutOfRange(i);
        Run storage run = runs[runId];
        checkSettlementOpen(runId, run);
        Settlement memory settlement = settlements[runId];
        if (settlement.settledLevels & (1 << i) != 0) revert LevelAlreadySettled(runId, i);
        if (RunDerivations.commitmentOf(journalHashes) != run.commitment) revert WrongCommitment(runId);
        if (keccak256(journal) != journalHashes[i]) revert JournalNotInCommitment(runId, i);

        Outcome memory outcome = verifyLevel(run, i, journalHashes[i], level, journal, proof);

        settlement.settledLevels |= uint8(1 << i);
        addLevel(settlement, outcome);
        emit LevelSettled(runId, i);
        if (settlement.settledLevels == ALL_LEVELS_SETTLED) {
            finishRun(runId, run, settlement);
        } else {
            settlements[runId] = settlement;
        }
    }

    /// @notice The run's entropy id, namespaced as `Vault` namespaces its runs. Clients poll
    /// `entropy.isRevealable(address(this), entropyIdOf(runId))`.
    function entropyIdOf(uint256 runId) public view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), runId));
    }

    function checkSettlementOpen(uint256 runId, Run storage run) private view {
        if (run.committedAt == 0) revert NotCommitted(runId);
        if (settlements[runId].status != SettlementStatus.Unsettled) revert AlreadySettled(runId);
        uint256 settlementEnd = seasons.settlementEndOf(run.season);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > settlementEnd) revert SettlementClosed(runId, settlementEnd);
    }

    /// @notice Reverts through `Season.slotOf` if the level is not one of the season's 16.
    function levelInSeason(uint256 season, bytes calldata level) private view returns (SeasonLevel memory) {
        bytes32 levelId = keccak256(level);
        // forge-lint: disable-next-line(calls-loop)
        return SeasonLevel(levelId, seasons.slotOf(season, levelId), seasons.weightOf(season, levelId));
    }

    function verifyLevel(
        Run storage run,
        uint8 i,
        bytes32 journalHash,
        bytes calldata level,
        bytes calldata journal,
        bytes calldata proof
    ) private view returns (Outcome memory outcome) {
        SeasonLevel memory seasonLevel = levelInSeason(run.season, level);
        (IReferee referee, uint16 rulesVersion) = seasons.refereeOf(run.season);
        outcome = referee.verify(level, journal, seasonLevel.weightBp, proof);
        checkOutcome(run, rulesVersion, i, journalHash, seasonLevel, outcome);
    }

    /// @notice Binds Outcome i to the run, its season and the submitted level and journal. The
    /// draw slot check is the draw check (P17): the contracts never compute the draw.
    function checkOutcome(
        Run storage run,
        uint16 rulesVersion,
        uint8 i,
        bytes32 journalHash,
        SeasonLevel memory seasonLevel,
        Outcome memory outcome
    ) private view {
        // forge-lint: disable-start(require-revert-in-loop)
        if (outcome.journalHash != journalHash) revert OutcomeJournalHashMismatch(i, outcome.journalHash);
        if (outcome.levelId != seasonLevel.levelId) revert OutcomeLevelIdMismatch(i, outcome.levelId);
        if (outcome.runNonce != run.runNonce) revert OutcomeRunNonceMismatch(i, outcome.runNonce);
        if (outcome.levelIndex != i) revert OutcomeLevelIndexMismatch(i, outcome.levelIndex);
        if (outcome.mode != MODE_CHALLENGE) revert OutcomeModeMismatch(i, outcome.mode);
        if (outcome.rulesVersion != rulesVersion) revert OutcomeRulesVersionMismatch(i, outcome.rulesVersion);
        if (outcome.drawSlot != seasonLevel.slot) {
            revert OutcomeDrawSlotMismatch(i, outcome.drawSlot, seasonLevel.slot);
        }
        // forge-lint: disable-end(require-revert-in-loop)
    }

    function addLevel(Settlement memory settlement, Outcome memory outcome) private pure {
        settlement.score += outcome.levelScore;
        settlement.ticks += outcome.ticksUsed;
        if (outcome.endReason == END_REASON_CLEARED) ++settlement.clears;
    }

    /// @notice A missed deadline is a result, not a revert: the run is marked late for good and
    /// earns nothing. Otherwise `Season` ranks it.
    function finishRun(uint256 runId, Run storage run, Settlement memory settlement) private {
        uint256 deadline = deadlineOf(run, settlement.ticks);
        if (run.committedAt > deadline) {
            settlement.status = SettlementStatus.Late;
            settlements[runId] = settlement;
            emit RunLate(runId, deadline, run.committedAt);
            return;
        }
        settlement.status = SettlementStatus.Settled;
        settlements[runId] = settlement;
        emit RunSettled(runId, run.player, settlement.score, settlement.ticks, settlement.clears);
        seasons.recordRun(run.season, run.player, runId, settlement.score, settlement.ticks, settlement.clears);
    }

    /// @notice On time if committedAt ≤ revealedAt + ceil(ticks / 15) + commitSlack (README §7.2).
    function deadlineOf(Run storage run, uint32 ticks) private view returns (uint256) {
        return run.revealedAt + (ticks + TICKS_PER_SECOND - 1) / TICKS_PER_SECOND + seasons.commitSlackOf(run.season);
    }
}
