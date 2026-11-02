// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IReferee, Outcome} from "../src/interfaces/IReferee.sol";

/// IReferee against the Stylus referee's ABI (referee/stylus/src/lib.rs): its selectors, and
/// its Outcome tuple of (bytes32, bytes32, bytes32, uint8, uint8, uint8, uint16, uint8, uint16,
/// uint16, uint32), so that a call to the Stylus contract decodes through this interface.
contract IRefereeTest is Test {
    function test_VerifySelectorIsTheStylusReferees() public pure {
        assertEq(IReferee.verify.selector, bytes4(0x62d9599e));
    }

    function test_VerifyRunSelectorIsTheStylusReferees() public pure {
        assertEq(IReferee.verifyRun.selector, bytes4(0xbdac0056));
    }

    function test_RulesVersionSelectorIsTheStylusReferees() public pure {
        assertEq(IReferee.rulesVersion.selector, bytes4(0x15b038ea));
    }

    function test_OutcomeEncodesAsTheStylusOutcomeTuple() public pure {
        Outcome memory outcome = Outcome({
            journalHash: bytes32(uint256(1)),
            levelId: bytes32(uint256(2)),
            runNonce: bytes32(uint256(3)),
            levelIndex: 4,
            drawSlot: 5,
            mode: 6,
            rulesVersion: 7,
            endReason: 8,
            claimBp: 9,
            ticksUsed: 10,
            levelScore: 11
        });
        bytes memory stylusTuple = abi.encode(
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            uint8(4),
            uint8(5),
            uint8(6),
            uint16(7),
            uint8(8),
            uint16(9),
            uint16(10),
            uint32(11)
        );
        assertEq(abi.encode(outcome), stylusTuple);
    }
}
