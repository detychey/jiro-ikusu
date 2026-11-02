// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Outcome} from "../src/interfaces/IReferee.sol";
import {MockReferee} from "../src/mocks/MockReferee.sol";

contract MockRefereeTest is Test {
    uint16 private constant RULES_VERSION = 2;
    uint16 private constant WEIGHT_BP = 10_000;
    bytes32 private constant RUN_NONCE = keccak256("jiro.example.9");

    MockReferee private referee;

    function setUp() public {
        referee = new MockReferee(RULES_VERSION);
    }

    function levelOf(uint8 levelIndex) private pure returns (bytes memory) {
        return abi.encodePacked("level", levelIndex);
    }

    function journalOf(uint8 levelIndex) private pure returns (bytes memory) {
        return abi.encodePacked("journal", levelIndex);
    }

    function outcomeOf(uint8 levelIndex) private pure returns (Outcome memory) {
        return Outcome({
            journalHash: keccak256(journalOf(levelIndex)),
            levelId: keccak256(levelOf(levelIndex)),
            runNonce: RUN_NONCE,
            levelIndex: levelIndex,
            drawSlot: 15 - levelIndex,
            mode: 1,
            rulesVersion: RULES_VERSION,
            endReason: 2,
            claimBp: 7_500 + levelIndex,
            ticksUsed: 900 + levelIndex,
            levelScore: 7_500 + levelIndex
        });
    }

    function setOutcomeOf(uint8 levelIndex) private {
        referee.setOutcome(levelOf(levelIndex), journalOf(levelIndex), WEIGHT_BP, outcomeOf(levelIndex));
    }

    function setOutcomesOfLevelsBelow(uint8 count) private {
        for (uint8 levelIndex; levelIndex < count; ++levelIndex) {
            setOutcomeOf(levelIndex);
        }
    }

    function runInputs()
        private
        pure
        returns (bytes[6] memory levels, bytes[6] memory journals, uint16[6] memory weightsBp)
    {
        for (uint8 levelIndex; levelIndex < 6; ++levelIndex) {
            levels[levelIndex] = levelOf(levelIndex);
            journals[levelIndex] = journalOf(levelIndex);
            weightsBp[levelIndex] = WEIGHT_BP;
        }
    }

    function expectNoOutcome(bytes memory level, bytes memory journal, uint16 weightBp) private {
        vm.expectRevert(
            abi.encodeWithSelector(MockReferee.NoOutcome.selector, keccak256(level), keccak256(journal), weightBp)
        );
    }

    function test_VerifyReturnsTheOutcomeSetForItsInputsAmongOthers() public {
        setOutcomesOfLevelsBelow(2);
        Outcome memory outcome = referee.verify(levelOf(0), journalOf(0), WEIGHT_BP, "");
        assertEq(abi.encode(outcome), abi.encode(outcomeOf(0)));
    }

    function test_VerifyIgnoresTheProof() public {
        setOutcomeOf(0);
        Outcome memory outcome = referee.verify(levelOf(0), journalOf(0), WEIGHT_BP, "any proof");
        assertEq(abi.encode(outcome), abi.encode(outcomeOf(0)));
    }

    function test_VerifyRunReturnsEachLevelsOutcomeInOrder() public {
        setOutcomesOfLevelsBelow(6);
        (bytes[6] memory levels, bytes[6] memory journals, uint16[6] memory weightsBp) = runInputs();
        Outcome[6] memory outcomes = referee.verifyRun(levels, journals, weightsBp, "");
        for (uint8 levelIndex; levelIndex < 6; ++levelIndex) {
            assertEq(abi.encode(outcomes[levelIndex]), abi.encode(outcomeOf(levelIndex)));
        }
    }

    function test_RevertWhen_VerifyGetsALevelWithNoOutcome() public {
        setOutcomeOf(0);
        expectNoOutcome(levelOf(1), journalOf(0), WEIGHT_BP);
        referee.verify(levelOf(1), journalOf(0), WEIGHT_BP, "");
    }

    function test_RevertWhen_VerifyGetsAJournalWithNoOutcome() public {
        setOutcomeOf(0);
        expectNoOutcome(levelOf(0), journalOf(1), WEIGHT_BP);
        referee.verify(levelOf(0), journalOf(1), WEIGHT_BP, "");
    }

    function test_RevertWhen_VerifyGetsAWeightWithNoOutcome() public {
        setOutcomeOf(0);
        expectNoOutcome(levelOf(0), journalOf(0), WEIGHT_BP - 1);
        referee.verify(levelOf(0), journalOf(0), WEIGHT_BP - 1, "");
    }

    function test_RevertWhen_VerifyRunGetsALevelWithNoOutcome() public {
        setOutcomesOfLevelsBelow(5);
        (bytes[6] memory levels, bytes[6] memory journals, uint16[6] memory weightsBp) = runInputs();
        expectNoOutcome(levelOf(5), journalOf(5), WEIGHT_BP);
        referee.verifyRun(levels, journals, weightsBp, "");
    }
}
