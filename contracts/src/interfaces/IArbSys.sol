// Ported verbatim from ethblockdigger at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/interfaces/IArbSys.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The two ArbSys precompile functions the entropy source needs
/// (live at address(100) on every Arbitrum chain). Solidity's block.number
/// and blockhash() track L1 numbers on Arbitrum; the ~0.25 s L2 block
/// cadence TOKENOMICS §6.1 relies on is only reachable through this
/// precompile.
interface IArbSys {
    function arbBlockNumber() external view returns (uint256);

    /// @dev Reverts outside the last 256 Arbitrum blocks.
    function arbBlockHash(uint256 arbBlockNum) external view returns (bytes32);
}
