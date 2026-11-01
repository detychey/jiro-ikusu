// Adapted from ethblockdigger at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/Season.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IReferee} from "./interfaces/IReferee.sol";

/// @notice The season parameters of README §8.4, committed by `open` and never changed afterwards.
struct SeasonParams {
    IReferee referee;
    uint16 rulesVersion;
    bytes32[16] levelIds;
    uint16[16] weightsBp;
    uint256 runFee;
    uint16 rakeBp;
    uint64 length;
    uint64 grace;
    uint64 commitSlack;
    uint8 minClears;
}

struct SeasonState {
    uint256 start;
    bool closed;
    bytes32 refereeCodehash;
    uint256 fees;
    uint256 playersPot;
    uint256 totalClaimed;
    uint256 totalQualifiedPoints;
}

struct BestRun {
    uint256 runId;
    uint32 score;
    uint32 ticks;
    bool qualified;
}

/// @notice Challenge seasons (README §8.4): holds every run fee, keeps each player's best settled
/// run per season, rakes at most 20 % at close, rolls the players' pot of a season with no
/// qualified points over to the next season to close, and pays pro-rata claims. Only `claim` and
/// `withdrawRake` send ETH, after their state changes.
contract Season {
    uint16 public constant MAX_RAKE_BP = 2_000;
    uint64 public constant MAX_LENGTH = 90 days;
    uint64 public constant MAX_GRACE = 30 days;
    uint64 public constant MAX_COMMIT_SLACK = 3_600;
    uint8 public constant MAX_MIN_CLEARS = 6;

    address public immutable treasury;
    address public immutable operator;
    address public challenge;

    uint256 public currentSeason;
    uint256 public lastClosedSeason;
    uint256 public pendingRollover;
    uint256 public rakeOwed;

    mapping(uint256 season => SeasonParams) private paramsBySeason;
    mapping(uint256 season => SeasonState) public seasons;
    mapping(uint256 season => mapping(bytes32 levelId => uint8)) private slotPlusOneOf;
    mapping(uint256 season => mapping(address player => BestRun)) public bestRunOf;
    mapping(uint256 season => mapping(address player => bool)) public claimed;

    event ChallengeBound(address indexed challenge);
    event SeasonOpened(uint256 indexed season, IReferee referee, bytes32 refereeCodehash, uint256 start, uint256 end);
    event BestRunRecorded(
        uint256 indexed season,
        address indexed player,
        uint256 indexed runId,
        uint32 score,
        uint32 ticks,
        bool qualified
    );
    event SeasonClosed(uint256 indexed season, uint256 rake, uint256 playersPot, bool rolledOver);
    event Claimed(uint256 indexed season, address indexed player, uint256 amount);
    event RakeWithdrawn(uint256 amount);

    error ZeroAddress();
    error NotOperator(address caller);
    error NotChallenge(address caller);
    error ChallengeAlreadyBound(address challenge);
    error PreviousSeasonNotEnded(uint256 season, uint256 end);
    error RulesVersionMismatch(uint16 refereeRulesVersion, uint16 rulesVersion);
    error ZeroLevelId(uint8 slot);
    error DuplicateLevelId(uint8 slot);
    error ZeroWeight(uint8 slot);
    error ZeroRunFee();
    error RakeAboveCap(uint16 rakeBp);
    error LengthOutOfRange(uint64 length);
    error GraceOutOfRange(uint64 grace);
    error CommitSlackOutOfRange(uint64 commitSlack);
    error MinClearsOutOfRange(uint8 minClears);
    error NotAcceptingRuns(uint256 season);
    error WrongFee(uint256 sent, uint256 runFee);
    error LevelNotInSeason(uint256 season, bytes32 levelId);
    error SeasonAlreadyClosed(uint256 season);
    error NoSeasonToClose();
    error SettlementOpen(uint256 season, uint256 settlementEnd);
    error SeasonNotClosed(uint256 season);
    error SeasonRolledOver(uint256 season);
    error NotQualified(uint256 season, address player);
    error AlreadyClaimed(uint256 season, address player);
    error TransferFailed(address to, uint256 amount);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator(msg.sender);
        _;
    }

    modifier onlyChallenge() {
        if (msg.sender != challenge) revert NotChallenge(msg.sender);
        _;
    }

    constructor(address treasury_, address operator_) {
        if (treasury_ == address(0) || operator_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        operator = operator_;
    }

    function bindChallenge(address challenge_) external onlyOperator {
        if (challenge != address(0)) revert ChallengeAlreadyBound(challenge);
        if (challenge_ == address(0)) revert ZeroAddress();
        challenge = challenge_;
        emit ChallengeBound(challenge_);
    }

    function open(SeasonParams calldata params) external onlyOperator returns (uint256 season) {
        uint256 previous = currentSeason;
        // forge-lint: disable-next-line(block-timestamp)
        if (previous != 0 && block.timestamp < endOf(previous)) {
            revert PreviousSeasonNotEnded(previous, endOf(previous));
        }
        uint16 refereeRulesVersion = params.referee.rulesVersion();
        if (refereeRulesVersion != params.rulesVersion) {
            revert RulesVersionMismatch(refereeRulesVersion, params.rulesVersion);
        }
        checkRanges(params);

        season = previous + 1;
        currentSeason = season;
        // forge-lint: disable-start(require-revert-in-loop)
        for (uint8 slot; slot < 16; ++slot) {
            bytes32 levelId = params.levelIds[slot];
            if (levelId == bytes32(0)) revert ZeroLevelId(slot);
            if (slotPlusOneOf[season][levelId] != 0) revert DuplicateLevelId(slot);
            if (params.weightsBp[slot] == 0) revert ZeroWeight(slot);
            slotPlusOneOf[season][levelId] = slot + 1;
        }
        // forge-lint: disable-end(require-revert-in-loop)
        paramsBySeason[season] = params;
        SeasonState storage state = seasons[season];
        state.start = block.timestamp;
        state.refereeCodehash = address(params.referee).codehash;
        emit SeasonOpened(season, params.referee, state.refereeCodehash, state.start, endOf(season));
    }

    function payFee(uint256 season) external payable onlyChallenge {
        // forge-lint: disable-next-line(block-timestamp)
        if (season == 0 || season != currentSeason || block.timestamp >= endOf(season)) {
            revert NotAcceptingRuns(season);
        }
        uint256 runFee = paramsBySeason[season].runFee;
        if (msg.value != runFee) revert WrongFee(msg.value, runFee);
        seasons[season].fees += msg.value;
    }

    function recordRun(uint256 season, address player, uint256 runId, uint32 score, uint32 ticks, uint8 clears)
        external
        onlyChallenge
    {
        SeasonState storage state = seasons[season];
        if (state.closed) revert SeasonAlreadyClosed(season);
        BestRun memory run =
            BestRun({runId: runId, score: score, ticks: ticks, qualified: clears >= paramsBySeason[season].minClears});
        BestRun storage best = bestRunOf[season][player];
        if (!ranksAbove(run, best)) return;

        if (best.qualified) state.totalQualifiedPoints -= best.score;
        if (run.qualified) state.totalQualifiedPoints += run.score;
        bestRunOf[season][player] = run;
        emit BestRunRecorded(season, player, runId, score, ticks, run.qualified);
    }

    function closeSeason() external returns (uint256 season) {
        season = lastClosedSeason + 1;
        if (season > currentSeason) revert NoSeasonToClose();
        uint256 settlementEnd = endOf(season) + paramsBySeason[season].grace;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= settlementEnd) revert SettlementOpen(season, settlementEnd);

        SeasonState storage state = seasons[season];
        uint256 rake = state.fees * paramsBySeason[season].rakeBp / 10_000;
        uint256 playersPot = state.fees - rake + pendingRollover;
        bool rolledOver = state.totalQualifiedPoints == 0;

        lastClosedSeason = season;
        state.closed = true;
        rakeOwed += rake;
        if (rolledOver) {
            pendingRollover = playersPot;
        } else {
            pendingRollover = 0;
            state.playersPot = playersPot;
        }
        emit SeasonClosed(season, rake, playersPot, rolledOver);
    }

    function claim(uint256 season) external returns (uint256 amount) {
        SeasonState storage state = seasons[season];
        if (!state.closed) revert SeasonNotClosed(season);
        if (state.totalQualifiedPoints == 0) revert SeasonRolledOver(season);
        BestRun storage best = bestRunOf[season][msg.sender];
        if (!best.qualified) revert NotQualified(season, msg.sender);
        if (claimed[season][msg.sender]) revert AlreadyClaimed(season, msg.sender);

        amount = best.score * state.playersPot / state.totalQualifiedPoints;
        claimed[season][msg.sender] = true;
        state.totalClaimed += amount;
        emit Claimed(season, msg.sender, amount);
        send(msg.sender, amount);
    }

    function withdrawRake() external returns (uint256 amount) {
        amount = rakeOwed;
        if (amount == 0) return 0;
        rakeOwed = 0;
        emit RakeWithdrawn(amount);
        send(treasury, amount);
    }

    function paramsOf(uint256 season) external view returns (SeasonParams memory) {
        return paramsBySeason[season];
    }

    function endOf(uint256 season) public view returns (uint256) {
        return seasons[season].start + paramsBySeason[season].length;
    }

    function commitSlackOf(uint256 season) external view returns (uint64) {
        return paramsBySeason[season].commitSlack;
    }

    function slotOf(uint256 season, bytes32 levelId) public view returns (uint8) {
        uint8 slotPlusOne = slotPlusOneOf[season][levelId];
        if (slotPlusOne == 0) revert LevelNotInSeason(season, levelId);
        return slotPlusOne - 1;
    }

    function weightOf(uint256 season, bytes32 levelId) external view returns (uint16) {
        return paramsBySeason[season].weightsBp[slotOf(season, levelId)];
    }

    /// @notice README §8.4: the balance covers the fees of the seasons not yet closed, the
    /// rollover, the rake not yet withdrawn, and the unclaimed players' pots of closed seasons.
    function isSolvent() external view returns (bool) {
        uint256 owed = pendingRollover + rakeOwed;
        for (uint256 season = 1; season <= currentSeason; ++season) {
            SeasonState storage state = seasons[season];
            owed += state.closed ? state.playersPot - state.totalClaimed : state.fees;
        }
        return address(this).balance >= owed;
    }

    function checkRanges(SeasonParams calldata params) private pure {
        if (params.runFee == 0) revert ZeroRunFee();
        if (params.rakeBp > MAX_RAKE_BP) revert RakeAboveCap(params.rakeBp);
        if (params.length == 0 || params.length > MAX_LENGTH) revert LengthOutOfRange(params.length);
        if (params.grace == 0 || params.grace > MAX_GRACE) revert GraceOutOfRange(params.grace);
        if (params.commitSlack == 0 || params.commitSlack > MAX_COMMIT_SLACK) {
            revert CommitSlackOutOfRange(params.commitSlack);
        }
        if (params.minClears == 0 || params.minClears > MAX_MIN_CLEARS) revert MinClearsOutOfRange(params.minClears);
    }

    /// @dev D10: a qualifying run ranks above one that doesn't, then the higher score, then fewer
    /// ticks. On a full tie the run recorded first stays, so settling another of a player's runs
    /// can never lower their payout.
    function ranksAbove(BestRun memory run, BestRun storage best) private view returns (bool) {
        if (best.runId == 0) return true;
        if (run.qualified != best.qualified) return run.qualified;
        if (run.score != best.score) return run.score > best.score;
        return run.ticks < best.ticks;
    }

    function send(address to, uint256 amount) private {
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool sent,) = to.call{value: amount}("");
        if (!sent) revert TransferFailed(to, amount);
    }
}
