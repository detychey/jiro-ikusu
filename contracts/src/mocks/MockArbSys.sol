// Ported verbatim from ethblockdigger at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// https://github.com/detychey/ethblockdigger/blob/15f9d73405a8c9940870a6375b950c6c7bd5f4ce/contracts/src/mocks/MockArbSys.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IArbSys} from "../interfaces/IArbSys.sol";

/// @notice Test ArbSys with a settable block number and deterministic hashes,
/// mirroring the real precompile's 256-block lookback (reverts outside it).
contract MockArbSys is IArbSys {
    uint256 public blockNumber = 1_000;

    function setBlockNumber(uint256 n) external {
        require(n >= blockNumber, "cannot rewind");
        blockNumber = n;
    }

    function arbBlockNumber() external view returns (uint256) {
        return blockNumber;
    }

    function arbBlockHash(uint256 arbBlockNum) external view returns (bytes32) {
        require(
            arbBlockNum < blockNumber && arbBlockNum + 256 >= blockNumber,
            "invalid block number"
        );
        return keccak256(abi.encodePacked(arbBlockNum));
    }
}
