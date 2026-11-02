// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Test stand-in for a smart-account wallet (plan M5.3): its owner's calls reach the target
/// from this contract, so a run it starts is this contract's, and its commitRun call is embedded
/// in the owner's transaction instead of being the transaction's own input. A reverted call's
/// error data is passed through unchanged, so callers decode it as the target's.
contract MockForwarder {
    address public immutable owner;

    error NotOwner(address caller);

    // forge-lint: disable-next-line(missing-zero-check)
    constructor(address owner_) {
        owner = owner_;
    }

    // forge-lint: disable-next-line(missing-zero-check)
    function execute(address target, uint256 value, bytes calldata data)
        external
        payable
        returns (bytes memory result)
    {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        bool succeeded;
        (succeeded, result) = target.call{value: value}(data);
        if (!succeeded) {
            assembly ("memory-safe") {
                revert(add(result, 32), mload(result))
            }
        }
    }
}
