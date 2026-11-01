// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RunDerivations} from "../src/RunDerivations.sol";

/// The run nonce and run commitment against vectors/derivations.json, which
/// tools/xcheck/derivations.mjs computes with ethers (README §6.4).
contract RunNonceAndCommitmentTest is Test {
    string private fixture;

    function setUp() public {
        fixture = vm.readFile(string.concat(vm.projectRoot(), "/../vectors/derivations.json"));
    }

    function runCommitmentOf(bytes[6] calldata journals) external pure returns (bytes32) {
        return RunDerivations.runCommitment(journals);
    }

    function test_RunNonceMatchesEveryFixture() public view {
        uint256 count;
        for (; vm.keyExistsJson(fixture, entryKey("runNonces", count)); ++count) {
            string memory key = entryKey("runNonces", count);
            bytes32 entropy = vm.parseJsonBytes32(fixture, string.concat(key, ".entropy"));
            uint256 runId = vm.parseJsonUint(fixture, string.concat(key, ".runId"));
            bytes32 runNonce = vm.parseJsonBytes32(fixture, string.concat(key, ".runNonce"));
            assertEq(RunDerivations.runNonce(entropy, runId), runNonce, key);
        }
        assertGt(count, 0, "runNonces is empty");
    }

    function test_RunCommitmentMatchesEveryFixture() public view {
        uint256 count;
        for (; vm.keyExistsJson(fixture, entryKey("runCommitments", count)); ++count) {
            string memory key = entryKey("runCommitments", count);
            bytes[] memory journals = vm.parseJsonBytesArray(fixture, string.concat(key, ".journals"));
            bytes32 runCommitment = vm.parseJsonBytes32(fixture, string.concat(key, ".runCommitment"));
            assertEq(this.runCommitmentOf(sixJournals(journals)), runCommitment, key);
        }
        assertGt(count, 0, "runCommitments is empty");
    }

    function entryKey(string memory list, uint256 i) private pure returns (string memory) {
        return string.concat(".", list, "[", vm.toString(i), "]");
    }

    function sixJournals(bytes[] memory journals) private pure returns (bytes[6] memory run) {
        assertEq(journals.length, 6, "a run has six journals");
        for (uint256 i; i < 6; ++i) {
            run[i] = journals[i];
        }
    }
}
