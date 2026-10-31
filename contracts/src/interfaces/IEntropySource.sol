// Ported verbatim from ethblockdigger at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/interfaces/IEntropySource.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Pay-then-reveal randomness (TOKENOMICS.md §6.1). Entropy for a
/// commitment must not exist when the commitment (and its payment) is made.
interface IEntropySource {
    /// @dev Record a commitment at the current block. Entropy is drawn from a
    /// later block, so it cannot be known when this is called. Commitments
    /// are namespaced by msg.sender: a third party can never occupy or
    /// front-run another contract's id, so ids may be fully predictable.
    /// MUST revert on a duplicate id within the caller's own namespace.
    function commit(bytes32 id) external;

    /// @return ready True once the reveal block for `owner`'s commitment `id`
    /// exists and entropy is available. Callable by anyone (keepers, clients).
    function isRevealable(address owner, bytes32 id) external view returns (bool ready);

    /// @dev Finalize and return the entropy for an id committed by
    /// msg.sender. Reverts if the reveal block has not arrived, or
    /// (production impl) if the reveal window has lapsed; the commitment must
    /// then be re-anchored before it can reveal.
    function reveal(bytes32 id) external returns (bytes32 entropy);

    /// @dev Re-target msg.sender's lapsed commitment `id` to a fresh future
    /// block. Only the committer can re-anchor its own ids. Reverts if `id`
    /// was never committed by msg.sender or (production impl) if its reveal
    /// window is still open.
    function reanchor(bytes32 id) external;
}
