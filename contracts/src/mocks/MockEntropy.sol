// Ported verbatim from ethblockdigger at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/mocks/MockEntropy.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntropySource} from "../interfaces/IEntropySource.sol";

/// @notice Test entropy source with a settable reveal value, so tests control
/// randomness deterministically. Production uses a future-blockhash impl
/// (TOKENOMICS.md §6.1); the commit/reveal shape is identical.
contract MockEntropy is IEntropySource {
    mapping(address => mapping(bytes32 => bool)) public committed;
    mapping(bytes32 => bool) private _revealable;
    mapping(bytes32 => bytes32) private _value;

    function commit(bytes32 id) external {
        require(!committed[msg.sender][id], "already committed");
        committed[msg.sender][id] = true;
    }

    /// @dev Test helper: mark a commitment revealable with a chosen value.
    function setRevealable(bytes32 id, bytes32 value) external {
        _revealable[id] = true;
        _value[id] = value;
    }

    function isRevealable(address owner, bytes32 id) external view returns (bool) {
        return committed[owner][id] && _revealable[id];
    }

    function reveal(bytes32 id) external view returns (bytes32) {
        require(committed[msg.sender][id], "not committed");
        require(_revealable[id], "not revealable");
        return _value[id];
    }

    /// @dev The fresh target lies ahead, so the id stops being revealable
    /// until a test marks it again.
    function reanchor(bytes32 id) external {
        require(committed[msg.sender][id], "not committed");
        _revealable[id] = false;
    }
}
