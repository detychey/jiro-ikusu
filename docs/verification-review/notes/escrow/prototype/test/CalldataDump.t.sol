// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Challenge} from "../src/Challenge.sol";
import {ProofBounty} from "../src/ProofBounty.sol";
import {BOUNTY, BountyFixture} from "./ProofBounty.t.sol";
import {PlayedLevel, journalBytesOf, levelBytesOf} from "./Settlement.t.sol";
import {ZkFixtures} from "./ZkVerify.t.sol";

/// Logs the calldata of two settlements, to estimate what Arbitrum's batch poster pays for them.
contract CalldataDumpTest is BountyFixture, ZkFixtures {
    function test_Dump_TheFixtureRunsSettleRunCalldata() public {
        string memory fixtures = zkFixtures();
        string memory runFile = vm.readFile(string.concat(vm.projectRoot(), "/../contracts/test/fixtures/zk-run.json"));
        bytes[] memory parsedLevels = vm.parseJsonBytesArray(runFile, ".levels");
        bytes[] memory parsedJournals = vm.parseJsonBytesArray(runFile, ".journals");
        bytes[6] memory levels;
        bytes[6] memory journals;
        for (uint256 i; i < 6; ++i) {
            levels[i] = parsedLevels[i];
            journals[i] = parsedJournals[i];
        }
        bytes memory proof = abi.encode(
            vm.parseJsonBytes(fixtures, ".challengeRun.seal"),
            bytes.concat(vm.parseJsonBytes(fixtures, ".challengeRun.publicValues"), abi.encode(prover))
        );
        emit log_named_bytes("DUMP fixture-run", abi.encodeCall(ProofBounty.claim, (1, levels, journals, proof)));
    }

    function test_Dump_TheGateSetRunsClaimCalldata() public {
        (uint256 runId, PlayedLevel[6] memory played) = committedRun();
        emit log_named_bytes(
            "DUMP gate-set",
            abi.encodeCall(
                ProofBounty.claim, (runId, levelBytesOf(played), journalBytesOf(played), runProof(played, prover))
            )
        );
    }
}
