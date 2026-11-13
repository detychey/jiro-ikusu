// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Challenge, SettlementStatus} from "./Challenge.sol";
import {IReferee} from "./interfaces/IReferee.sol";
import {RunDerivations} from "./RunDerivations.sol";
import {Season} from "./Season.sol";
import {ZkReferee} from "./ZkReferee.sol";

/// @notice Bounties for the run proofs of `referee` (README §7.5): anyone posts ETH on a committed
/// run, and whoever presents a proof of that run that `referee` accepts is credited the run's whole
/// bounty, at the payee the proof itself names, never at the caller. A bounty is paid once per run
/// and returns to its depositors only once no proof can settle the run any more, or once nobody has
/// claimed a settled run's bounty `CLAIM_GRACE` after its season's settlement closed. Only `refund`
/// and `withdraw` send ETH, after their state changes, and only to the depositor or the payee.
contract ProofBounty {
    uint64 public constant CLAIM_GRACE = 7 days;
    uint256 private constant LEVELS_PER_RUN = 6;

    Challenge public immutable challenge;
    Season public immutable seasons;
    ZkReferee public immutable referee;

    mapping(uint256 runId => uint256) public bountyOf;
    mapping(uint256 runId => mapping(address depositor => uint256)) public depositOf;
    mapping(address payee => uint256) public owed;

    event BountyPosted(uint256 indexed runId, address indexed depositor, uint256 amount, uint256 bounty);
    event BountyPaid(uint256 indexed runId, address indexed payee, uint256 amount);
    event BountyRefunded(uint256 indexed runId, address indexed depositor, uint256 amount);
    event Withdrawn(address indexed payee, uint256 amount);

    error ZeroAddress();
    error ZeroDeposit();
    error WrongReferee(uint256 runId, IReferee seasonReferee);
    error NoBounty(uint256 runId);
    error ZeroPayee(uint256 runId);
    error NoDeposit(uint256 runId, address depositor);
    error SettlementOpen(uint256 runId, uint256 settlementEnd);
    error ClaimOpen(uint256 runId, uint256 claimEnd);
    error TransferFailed(address to, uint256 amount);

    constructor(Challenge challenge_, ZkReferee referee_) {
        if (address(challenge_) == address(0) || address(referee_) == address(0)) revert ZeroAddress();
        challenge = challenge_;
        seasons = challenge_.seasons();
        referee = referee_;
    }

    /// @notice Adds `msg.value` to the bounty of a committed, unsettled run whose season settles
    /// through `referee` and is still open for settlement: any other deposit could never be paid.
    function post(uint256 runId) external payable {
        if (msg.value == 0) revert ZeroDeposit();
        // forge-lint: disable-next-line(unused-return)
        (,, uint64 committedAt, uint256 season,,) = challenge.runs(runId);
        if (committedAt == 0) revert Challenge.NotCommitted(runId);
        // forge-lint: disable-next-line(unused-return)
        (IReferee seasonReferee,) = seasons.refereeOf(season);
        if (address(seasonReferee) != address(referee)) revert WrongReferee(runId, seasonReferee);
        if (statusOf(runId) != SettlementStatus.Unsettled) revert Challenge.AlreadySettled(runId);
        uint256 settlementEnd = seasons.settlementEndOf(season);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > settlementEnd) revert Challenge.SettlementClosed(runId, settlementEnd);

        uint256 bounty = bountyOf[runId] + msg.value;
        bountyOf[runId] = bounty;
        depositOf[runId][msg.sender] += msg.value;
        emit BountyPosted(runId, msg.sender, msg.value, bounty);
    }

    /// @notice Credits the run's bounty to the payee that `proof` names. An unsettled run is settled
    /// by this call, through `Challenge.settleRun`; for a run that someone already settled, `proof`
    /// is verified here against the run's committed journals. Anyone may submit: the caller earns
    /// nothing, so a copied proof still pays its prover.
    function claim(uint256 runId, bytes[6] calldata levels, bytes[6] calldata journals, bytes calldata proof) external {
        uint256 amount = bountyOf[runId];
        if (amount == 0) revert NoBounty(runId);
        address payee = referee.payeeOf(proof);
        if (payee == address(0)) revert ZeroPayee(runId);

        bountyOf[runId] = 0;
        owed[payee] += amount;
        emit BountyPaid(runId, payee, amount);

        if (statusOf(runId) == SettlementStatus.Unsettled) {
            challenge.settleRun(runId, levels, journals, proof);
        } else {
            verifySettledRun(runId, levels, journals, proof);
        }
    }

    /// @notice Returns `depositor` its deposit on a run that no proof can settle any more, or on a
    /// settled run whose bounty nobody claimed within `CLAIM_GRACE` of the settlement end. Anyone
    /// may call it: the deposit only ever goes back to its depositor.
    function refund(uint256 runId, address depositor) external returns (uint256 amount) {
        amount = depositOf[runId][depositor];
        if (amount == 0) revert NoDeposit(runId, depositor);
        if (bountyOf[runId] == 0) revert NoBounty(runId);
        // forge-lint: disable-next-line(unused-return)
        (,,, uint256 season,,) = challenge.runs(runId);
        uint256 settlementEnd = seasons.settlementEndOf(season);
        // forge-lint: disable-start(block-timestamp)
        if (statusOf(runId) == SettlementStatus.Unsettled) {
            if (block.timestamp <= settlementEnd) revert SettlementOpen(runId, settlementEnd);
        } else if (block.timestamp <= settlementEnd + CLAIM_GRACE) {
            revert ClaimOpen(runId, settlementEnd + CLAIM_GRACE);
        }
        // forge-lint: disable-end(block-timestamp)

        depositOf[runId][depositor] = 0;
        bountyOf[runId] -= amount;
        emit BountyRefunded(runId, depositor, amount);
        send(depositor, amount);
    }

    /// @notice Sends `payee` what its proofs earned. Anyone may call it, as `Season.withdrawRake`.
    function withdraw(address payee) external returns (uint256 amount) {
        amount = owed[payee];
        if (amount == 0) return 0;
        owed[payee] = 0;
        emit Withdrawn(payee, amount);
        send(payee, amount);
    }

    function statusOf(uint256 runId) private view returns (SettlementStatus status) {
        // forge-lint: disable-next-line(unused-return)
        (status,,,,) = challenge.settlements(runId);
    }

    /// @notice What `Challenge.settleRun` checked when the run settled still holds for its committed
    /// journals, so the commitment, the season's weights and `verifyRun` bind `proof` to the run.
    function verifySettledRun(uint256 runId, bytes[6] calldata levels, bytes[6] calldata journals, bytes calldata proof)
        private
        view
    {
        // forge-lint: disable-next-line(unused-return)
        (,,, uint256 season,, bytes32 commitment) = challenge.runs(runId);
        if (RunDerivations.runCommitment(journals) != commitment) revert Challenge.WrongCommitment(runId);
        uint16[6] memory weightsBp;
        for (uint256 i; i < LEVELS_PER_RUN; ++i) {
            // forge-lint: disable-next-line(calls-loop)
            weightsBp[i] = seasons.weightOf(season, keccak256(levels[i]));
        }
        // forge-lint: disable-next-line(unused-return)
        referee.verifyRun(levels, journals, weightsBp, proof);
    }

    function send(address to, uint256 amount) private {
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool sent,) = to.call{value: amount}("");
        if (!sent) revert TransferFailed(to, amount);
    }
}
