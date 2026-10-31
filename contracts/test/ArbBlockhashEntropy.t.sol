// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ArbBlockhashEntropy} from "../src/ArbBlockhashEntropy.sol";
import {MockArbSys} from "../src/mocks/MockArbSys.sol";

/// Ported from ethblockdigger's contracts/test/entropy.test.ts, block "ArbBlockhashEntropy".
contract ArbBlockhashEntropyTest is Test {
    uint256 private constant REVEAL_DELAY = 40;
    uint256 private constant READ_WINDOW = 256;
    uint256 private constant LAPSE = REVEAL_DELAY + READ_WINDOW + 1;
    bytes32 private constant ID = bytes32(uint256(1));

    MockArbSys private arbSys;
    ArbBlockhashEntropy private entropy;
    address private committer = makeAddr("committer");
    address private other = makeAddr("other");

    function setUp() public {
        arbSys = new MockArbSys();
        entropy = new ArbBlockhashEntropy(arbSys);
    }

    function commitAs(address account) private {
        vm.prank(account);
        entropy.commit(ID);
    }

    function advanceArbBlocks(uint256 count) private {
        arbSys.setBlockNumber(arbSys.arbBlockNumber() + count);
    }

    function revealAs(address account) private returns (bytes32) {
        vm.prank(account);
        return entropy.reveal(ID);
    }

    function isRevealable() private returns (bool) {
        vm.prank(other);
        return entropy.isRevealable(committer, ID);
    }

    function expectedEntropy(uint256 target, address owner) private pure returns (bytes32) {
        bytes32 blockHash = keccak256(abi.encodePacked(target));
        return keccak256(abi.encodePacked(blockHash, owner, ID));
    }

    function test_CommitTargetsABlockRevealDelayAhead() public {
        uint256 before = arbSys.arbBlockNumber();
        commitAs(committer);
        assertEq(entropy.targetBlock(committer, ID), before + REVEAL_DELAY);
    }

    function test_RevertWhen_DuplicateCommitInTheSameNamespace() public {
        commitAs(committer);
        vm.expectRevert(bytes("already committed"));
        commitAs(committer);
    }

    function test_CommitIsNamespacedBySender() public {
        commitAs(committer);
        commitAs(other);
        assertEq(entropy.targetBlock(other, ID), entropy.targetBlock(committer, ID));
    }

    function test_NotRevealableBeforeTheTargetBlockHasPassed() public {
        commitAs(committer);
        advanceArbBlocks(REVEAL_DELAY);
        assertFalse(isRevealable());
    }

    function test_RevealableOneBlockAfterTheTargetForAnyCaller() public {
        commitAs(committer);
        advanceArbBlocks(REVEAL_DELAY + 1);
        assertTrue(isRevealable());
    }

    function test_NotRevealableAfterTheReadWindowLapses() public {
        commitAs(committer);
        advanceArbBlocks(LAPSE);
        assertFalse(isRevealable());
    }

    function test_RevertWhen_RevealBeforeTheTargetBlockHasPassed() public {
        commitAs(committer);
        advanceArbBlocks(REVEAL_DELAY);
        vm.expectRevert(bytes("not ready"));
        revealAs(committer);
    }

    function test_RevealDerivesEntropyFromTheTargetBlockHashCallerAndId() public {
        commitAs(committer);
        uint256 target = entropy.targetBlock(committer, ID);
        advanceArbBlocks(REVEAL_DELAY + 1);
        assertEq(revealAs(committer), expectedEntropy(target, committer));
    }

    function test_RevealOnTheLastBlockOfTheReadWindow() public {
        commitAs(committer);
        uint256 target = entropy.targetBlock(committer, ID);
        advanceArbBlocks(REVEAL_DELAY + READ_WINDOW);
        assertEq(revealAs(committer), expectedEntropy(target, committer));
    }

    function test_RevertWhen_RevealByACallerWhoNeverCommittedTheId() public {
        commitAs(committer);
        advanceArbBlocks(REVEAL_DELAY + 1);
        vm.expectRevert(bytes("not committed"));
        revealAs(other);
    }

    function test_RevertWhen_RevealAfterTheReadWindowLapsed() public {
        commitAs(committer);
        advanceArbBlocks(LAPSE);
        vm.expectRevert(bytes("window lapsed"));
        revealAs(committer);
    }

    function test_RevertWhen_ReanchorWhileTheRevealWindowIsOpen() public {
        commitAs(committer);
        advanceArbBlocks(REVEAL_DELAY + READ_WINDOW);
        vm.expectRevert(bytes("window open"));
        vm.prank(committer);
        entropy.reanchor(ID);
    }

    function test_ReanchorRetargetsTheCallersOwnLapsedCommitment() public {
        commitAs(committer);
        advanceArbBlocks(LAPSE);
        vm.prank(committer);
        entropy.reanchor(ID);
        assertEq(entropy.targetBlock(committer, ID), arbSys.arbBlockNumber() + REVEAL_DELAY);
    }

    function test_ReanchoredCommitmentRevealsFromItsFreshTargetBlock() public {
        commitAs(committer);
        advanceArbBlocks(LAPSE);
        vm.prank(committer);
        entropy.reanchor(ID);
        uint256 freshTarget = entropy.targetBlock(committer, ID);
        advanceArbBlocks(REVEAL_DELAY + 1);
        assertEq(revealAs(committer), expectedEntropy(freshTarget, committer));
    }

    function test_RevertWhen_ReanchorOfAnIdTheCallerNeverCommitted() public {
        commitAs(committer);
        advanceArbBlocks(LAPSE);
        vm.expectRevert(bytes("not committed"));
        vm.prank(other);
        entropy.reanchor(ID);
    }

    function test_ReanchorLeavesAnotherNamespacesSameIdUntouched() public {
        commitAs(committer);
        commitAs(other);
        uint256 committerTarget = entropy.targetBlock(committer, ID);
        advanceArbBlocks(LAPSE);
        vm.prank(other);
        entropy.reanchor(ID);
        assertEq(entropy.targetBlock(committer, ID), committerTarget);
    }
}
