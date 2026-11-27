// Adapted from ethblockdigger at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/Season.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
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
}

/// @notice A season's sums (README §8.4): `games` counts 6 per run bought, and `tickets` sums the
/// tickets of its on-time settled runs, in basis points.
struct SeasonState {
    uint256 start;
    bool closed;
    bytes32 refereeCodehash;
    uint256 fees;
    uint256 games;
    uint256 tickets;
    uint256 playersPot;
    uint256 totalClaimed;
}

/// @notice A player's paid games and tickets in one season, and whether they claimed its prize.
struct PlayerTally {
    uint64 games;
    uint128 tickets;
    bool claimed;
}

/// @notice Challenge seasons (README §8.4): holds every run fee, counts each player's paid games
/// and on-time tickets per season, rakes at most 20 % at close, and pays each player the prize of
/// their games from the bot-neutral pot (D10), with no rollover. Only `claim` and `withdrawRake`
/// send ETH, after their state changes.
contract Season {
    uint16 public constant MAX_RAKE_BP = 2_000;
    uint64 public constant MAX_LENGTH = 90 days;
    uint64 public constant MAX_GRACE = 30 days;
    uint64 public constant MAX_COMMIT_SLACK = 3_600;
    uint8 public constant GAMES_PER_RUN = 6;

    address public immutable treasury;
    address public immutable operator;
    address public challenge;

    uint256 public currentSeason;
    uint256 public lastClosedSeason;
    uint256 public rakeOwed;

    mapping(uint256 season => SeasonParams) private paramsBySeason;
    mapping(uint256 season => SeasonState) public seasons;
    mapping(uint256 season => mapping(bytes32 levelId => uint8)) private slotPlusOneOf;
    mapping(uint256 season => mapping(address player => PlayerTally)) public tallyOf;

    event ChallengeBound(address indexed challenge);
    event SeasonOpened(uint256 indexed season, IReferee referee, bytes32 refereeCodehash, uint256 start, uint256 end);
    event TicketsAdded(uint256 indexed season, address indexed player, uint256 indexed runId, uint32 tickets);
    event SeasonClosed(uint256 indexed season, uint256 rake, uint256 playersPot);
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
    error NotAcceptingRuns(uint256 season);
    error WrongFee(uint256 sent, uint256 runFee);
    error LevelNotInSeason(uint256 season, bytes32 levelId);
    error SeasonAlreadyClosed(uint256 season);
    error NoSeasonToClose();
    error SettlementOpen(uint256 season, uint256 settlementEnd);
    error SeasonNotClosed(uint256 season);
    error NoGames(uint256 season, address player);
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

    /// @notice A run's fee, and its 6 games for its player and its season (README §8.4).
    function payFee(uint256 season, address player) external payable onlyChallenge {
        // forge-lint: disable-next-line(block-timestamp)
        if (season == 0 || season != currentSeason || block.timestamp >= endOf(season)) {
            revert NotAcceptingRuns(season);
        }
        uint256 runFee = paramsBySeason[season].runFee;
        if (msg.value != runFee) revert WrongFee(msg.value, runFee);
        SeasonState storage state = seasons[season];
        state.fees += msg.value;
        state.games += GAMES_PER_RUN;
        tallyOf[season][player].games += GAMES_PER_RUN;
    }

    /// @notice An on-time settled run's tickets, for its player and its season (README §8.4).
    function addTickets(uint256 season, address player, uint256 runId, uint32 tickets) external onlyChallenge {
        SeasonState storage state = seasons[season];
        if (state.closed) revert SeasonAlreadyClosed(season);
        state.tickets += tickets;
        tallyOf[season][player].tickets += tickets;
        emit TicketsAdded(season, player, runId, tickets);
    }

    function closeSeason() external returns (uint256 season) {
        season = lastClosedSeason + 1;
        if (season > currentSeason) revert NoSeasonToClose();
        uint256 settlementEnd = settlementEndOf(season);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= settlementEnd) revert SettlementOpen(season, settlementEnd);

        SeasonState storage state = seasons[season];
        uint256 rake = rakeOf(season);
        uint256 playersPot = state.fees - rake;

        lastClosedSeason = season;
        state.closed = true;
        state.playersPot = playersPot;
        rakeOwed += rake;
        emit SeasonClosed(season, rake, playersPot);
    }

    function claim(uint256 season) external returns (uint256 amount) {
        SeasonState storage state = seasons[season];
        if (!state.closed) revert SeasonNotClosed(season);
        PlayerTally storage tally = tallyOf[season][msg.sender];
        if (tally.games == 0) revert NoGames(season, msg.sender);
        if (tally.claimed) revert AlreadyClaimed(season, msg.sender);

        amount = prizeOf(season, msg.sender);
        tally.claimed = true;
        state.totalClaimed += amount;
        // forge-lint: disable-next-line(reentrancy-events)
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

    /// @notice The prize of `player`'s games, README §8.4's integer form, from the season's sums as
    /// they stand: what `claim` pays once the season has closed, and before, what it would pay if
    /// the season closed now. With W the season's tickets, G its games, R its rake, `fees` its run
    /// fees, and g and W_p the player's games and tickets: when W ≥ (10,000 − R) × G, the players'
    /// pot shared by tickets; otherwise fees × [10,000 × g × ((10,000 − R) × G − W) + R × G × W_p]
    /// / (10,000 × G × (10,000 × G − W)). Each is rounded down once, by `mulDiv`, whose 512-bit
    /// product cannot overflow.
    function prizeOf(uint256 season, address player) public view returns (uint256) {
        PlayerTally storage tally = tallyOf[season][player];
        uint256 playerGames = tally.games;
        if (playerGames == 0) return 0;
        uint256 playerTickets = tally.tickets;
        SeasonState storage state = seasons[season];
        uint256 rakeBp = paramsBySeason[season].rakeBp;
        uint256 games = state.games;
        uint256 tickets = state.tickets;
        if (tickets >= (10_000 - rakeBp) * games) {
            return Math.mulDiv(state.fees - rakeOf(season), playerTickets, tickets);
        }
        uint256 share = 10_000 * playerGames * ((10_000 - rakeBp) * games - tickets) + rakeBp * games * playerTickets;
        return Math.mulDiv(state.fees, share, 10_000 * games * (10_000 * games - tickets));
    }

    function paramsOf(uint256 season) external view returns (SeasonParams memory) {
        return paramsBySeason[season];
    }

    function endOf(uint256 season) public view returns (uint256) {
        return seasons[season].start + paramsBySeason[season].length;
    }

    /// @notice The last second at which the season's runs settle (README §7.2): end + grace, inclusive.
    function settlementEndOf(uint256 season) public view returns (uint256) {
        return endOf(season) + paramsBySeason[season].grace;
    }

    function refereeOf(uint256 season) external view returns (IReferee referee, uint16 rulesVersion) {
        SeasonParams storage params = paramsBySeason[season];
        return (params.referee, params.rulesVersion);
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

    /// @notice README §8.4: the balance covers the fees of the seasons not yet closed, the rake
    /// not yet withdrawn, and the unclaimed players' pots of closed seasons.
    function isSolvent() external view returns (bool) {
        uint256 owed = rakeOwed;
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
    }

    /// @notice README §8.4: the season's run fees times its rake, rounded down.
    function rakeOf(uint256 season) private view returns (uint256) {
        return seasons[season].fees * paramsBySeason[season].rakeBp / 10_000;
    }

    function send(address to, uint256 amount) private {
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool sent,) = to.call{value: amount}("");
        if (!sent) revert TransferFailed(to, amount);
    }
}
