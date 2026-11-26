// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ControlID} from "risc0/groth16/ControlID.sol";
import {RiscZeroGroth16Verifier} from "risc0/groth16/RiscZeroGroth16Verifier.sol";
import {VerificationFailed} from "risc0/IRiscZeroVerifier.sol";

/// A Groth16 seal re-randomized by someone who holds only the seal (rerandomize/rerandomize.py):
/// other bytes, the same statement. RISC Zero's 3.0 Groth16 verifier accepts it for the same public
/// values and for no others, so a contract can key nothing on a seal's bytes.
contract RerandomizedTest is Test {
    RiscZeroGroth16Verifier private verifier;

    function setUp() public {
        verifier = new RiscZeroGroth16Verifier(ControlID.CONTROL_ROOT, ControlID.BN254_CONTROL_ID);
    }

    function fixture(string memory name) private view returns (string memory) {
        return vm.readFile(string.concat(vm.projectRoot(), "/test/fixtures/", name, ".json"));
    }

    function verifyRerandomized(string memory name) private view {
        string memory json = fixture(name);
        bytes memory seal = vm.parseJsonBytes(json, ".seal");
        bytes memory rerandomized = vm.parseJsonBytes(json, ".rerandomizedSeal");
        bytes32 imageId = vm.parseJsonBytes32(json, ".imageId");
        bytes32 digest = sha256(vm.parseJsonBytes(json, ".publicValues"));
        assertNotEq(keccak256(seal), keccak256(rerandomized), "other bytes");
        verifier.verify(seal, imageId, digest);
        verifier.verify(rerandomized, imageId, digest);
    }

    function test_ASealRerandomizedWithTheSmallestShiftVerifies() public view {
        verifyRerandomized("rerandomized-1");
    }

    function test_ASealRerandomizedWithALargeShiftVerifies() public view {
        verifyRerandomized("rerandomized-2");
    }

    function test_ARerandomizedSealDoesNotVerifyOtherPublicValues() public {
        string memory json = fixture("rerandomized-2");
        bytes memory rerandomized = vm.parseJsonBytes(json, ".rerandomizedSeal");
        bytes32 imageId = vm.parseJsonBytes32(json, ".imageId");
        bytes memory publicValues = vm.parseJsonBytes(json, ".publicValues");
        publicValues[publicValues.length - 1] ^= 0x01;
        bytes32 digest = sha256(publicValues);
        vm.expectRevert(VerificationFailed.selector);
        verifier.verify(rerandomized, imageId, digest);
    }
}
