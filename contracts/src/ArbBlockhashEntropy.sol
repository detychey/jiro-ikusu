// Ported verbatim from ethblockdigger at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/ArbBlockhashEntropy.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IArbSys} from "./interfaces/IArbSys.sol";
import {IEntropySource} from "./interfaces/IEntropySource.sol";

/// @notice Production pay-then-reveal entropy (TOKENOMICS.md §6.1): commit at
/// Arbitrum block N, entropy derives from arbBlockHash(N + REVEAL_DELAY) — a
/// block that does not exist at commit time. The hash is readable for the
/// next READ_WINDOW blocks (~1 minute); a commitment whose window lapsed can
/// be re-anchored to a fresh future block only by its own committer, so each
/// consumer decides its lapse policy (Vault forfeits, MapNFT re-anchors).
contract ArbBlockhashEntropy is IEntropySource {
    uint256 public constant REVEAL_DELAY = 40; // ~10 s of Arbitrum blocks
    uint256 public constant READ_WINDOW = 256; // arbBlockHash lookback limit

    IArbSys public immutable arbSys;

    /// @dev owner => id => Arbitrum block whose hash becomes the entropy.
    mapping(address => mapping(bytes32 => uint256)) public targetBlock;

    event Committed(address indexed owner, bytes32 indexed id, uint256 targetBlock);
    event Reanchored(address indexed owner, bytes32 indexed id, uint256 targetBlock);

    constructor(IArbSys _arbSys) {
        require(address(_arbSys) != address(0), "zero addr");
        arbSys = _arbSys;
    }

    function commit(bytes32 id) external {
        require(targetBlock[msg.sender][id] == 0, "already committed");
        uint256 target = arbSys.arbBlockNumber() + REVEAL_DELAY;
        targetBlock[msg.sender][id] = target;
        emit Committed(msg.sender, id, target);
    }

    function isRevealable(address owner, bytes32 id) external view returns (bool ready) {
        uint256 target = targetBlock[owner][id];
        if (target == 0) return false;
        uint256 current = arbSys.arbBlockNumber();
        return current > target && current <= target + READ_WINDOW;
    }

    /// @dev View: derives entropy without consuming the commitment. Callers
    /// (Vault, MapNFT) enforce single use; a repeat call inside the window
    /// returns the same value.
    function reveal(bytes32 id) external view returns (bytes32 entropy) {
        uint256 target = targetBlock[msg.sender][id];
        require(target != 0, "not committed");
        uint256 current = arbSys.arbBlockNumber();
        require(current > target, "not ready");
        require(current <= target + READ_WINDOW, "window lapsed");
        entropy = keccak256(abi.encodePacked(arbSys.arbBlockHash(target), msg.sender, id));
    }

    /// @dev Once the caller's own commitment lapsed, move it to a fresh
    /// future block (TOKENOMICS §6.1 step 4). Keyed by msg.sender: the lapsed
    /// entropy was public, so a re-anchor is a free re-roll and only the
    /// consumer may decide whether to offer one.
    function reanchor(bytes32 id) external {
        uint256 target = targetBlock[msg.sender][id];
        require(target != 0, "not committed");
        uint256 current = arbSys.arbBlockNumber();
        require(current > target + READ_WINDOW, "window open");
        uint256 fresh = current + REVEAL_DELAY;
        targetBlock[msg.sender][id] = fresh;
        emit Reanchored(msg.sender, id, fresh);
    }
}
