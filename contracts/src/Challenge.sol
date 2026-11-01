// Adapted from ethblockdigger's Vault at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/Vault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntropySource} from "./interfaces/IEntropySource.sol";
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

/// @notice Challenge runs (README §7.2): the keyless pay, reveal and commit flow of ethblockdigger's
/// `Vault`. The fee goes to `Season` at once, so this contract holds no ETH. The run's season names
/// the referee that settles it.
contract Challenge {
    /// @notice Six levels of at most 2,700 ticks at 15 Hz (README §7.2).
    uint64 public constant MAX_PLAY_SECONDS = 1_080;

    IEntropySource public immutable entropy;
    Season public immutable seasons;

    uint256 public runCount;
    mapping(uint256 runId => Run) public runs;

    event RunStarted(uint256 indexed runId, address indexed player, uint256 indexed season, bytes32 entropyId);
    event RunRevealed(uint256 indexed runId, bytes32 runNonce, uint64 revealedAt);
    event RunCommitted(uint256 indexed runId, bytes32 commitment, uint64 committedAt);

    error ZeroAddress();
    error NotPlayer(uint256 runId, address caller);
    error AlreadyRevealed(uint256 runId);
    error NotRevealed(uint256 runId);
    error AlreadyCommitted(uint256 runId);
    error CommitTooLate(uint256 runId, uint256 latestCommit);

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

    /// @notice The run's entropy id, namespaced as `Vault` namespaces its runs. Clients poll
    /// `entropy.isRevealable(address(this), entropyIdOf(runId))`.
    function entropyIdOf(uint256 runId) public view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), runId));
    }
}
