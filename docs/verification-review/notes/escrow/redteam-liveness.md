# Red team: liveness, custody and timing of ProofBounty

Read: spec.md; proto ProofBounty.sol and ZkReferee.sol; repository Challenge.sol, Season.sol; seasons/testnet-0.json; README 7.5 and 8.4 (lines 671-683, 740-750); docs/ECONOMY.md 1-3; deployments/README.md; referee/zk/README.md (Groth16 in Docker); RISC Zero RiscZeroVerifierEmergencyStop.estop ("can never be restarted").

Tags: [repo] recorded in repository, [here] measured by me, [est] estimate.

## Measured here

New file proto/contracts/test/RedTeamLiveness.t.sol (scratch only), `forge test --match-contract RedTeamLiveness`: 3 pass.

1. `test_DecoyBountyReturnsToTheDepositorAndStrandsTheHonestProver`: a depositor that already holds a proof naming itself posts 10x the bounty, claims first, gets `owed[self] == deposit`; the honest prover's claim reverts `NoBounty`. A prover-depositor can cancel at will, so B4's "a prover finds at least its quote at delivery" holds only against depositors who cannot prove.
2. `test_DepositsStayLockedUntilTheSettlementEndAfterTheStop`: after `estop()`, `refund` reverts `SettlementOpen`; 1,382,400 s (16 days) of lock in the fixture's 14 d + 48 h season, though no claim can ever succeed again. By Season's ranges (MAX_LENGTH 90 d + MAX_GRACE 30 d) up to 120 days.
3. `test_SelfSettlingAfterPostingPaysAStrangerForNothing`: depositor posts, then settles its own run directly (README 7.5 keeps that path); any later run proof takes the deposit through branch B.

## Findings (most severe first)

H1. Decoy bounties starve the single prover, and that is profitable against the pot. A player with any GPU proves its own 2.9e9-cycle legal run offline (journals are public at commit), posts a large bounty, waits while the owner's RTX 3060 works, then claims with its own payee and recovers the deposit. [est] 3060 at ~5-7 s per 2^20 segment (5090 0.9 s incl. recursion, ~6-8x throughput gap) -> ~2,800 segments = 4-5.5 h per decoy; five decoys cover testnet's 24 h grace [repo seasons/testnet-0.json grace 86,400]. Cost per decoy: one run fee (0.00005 ETH, which goes into the same pot) + post+claim gas (~0.000015 ETH [est]). Gain: honest players' runs stay unsettled, their fees enlarge the attacker's pro-rata share. The lock-with-stake deferred in sketch point 8 is a liveness requirement, not only an anti-racing nicety. Interim: prover schedules by bounty per proving-second with a per-depositor capacity cap, re-reads `bountyOf` between segments' batches (not only before Groth16), and prefers runs whose depositor is not the run's player.

H2. Settlement becomes a purchase, and the v1 promise is dropped. README:671 says the operator "proves and settles each player's best run ... Players do nothing after committing". Spec §7 rewrites M5.5 so docs "describe bounties, not the operator's settlement". With rake 10 % [repo], a single-run player's expected share is 0.9 F x s/avg; a bounty of 0.3-0.4 F [spec est] is irrational below s/avg ~ 0.33-0.44, so low scorers stop settling and their fees go to payers. The payer must also decide before knowing the final pot. The prover (the operator) now chooses which bounties to take, i.e. whose run counts. Fix: keep the v1 promise: the operator funds (B1) or freely claims every qualified best run, from the rake, and bounties are an additional path for players who want speed or third-party provers.

H3. Demand concentrates in the grace window, exactly where one home prover is the single point of failure. Only the best run counts and each settlement costs a bounty, so a rational player posts once, after the season ends. testnet-0 has 24 h of grace, README proposes 48 h. A home outage (power, ISP, a weekend away, a dead card) longer than the grace leaves every late-posted run unsettled; deposits refund but the pot goes to those settled earlier. An Arbitrum sequencer outage near the end has no remedy within 24 h (force inclusion via the delayed inbox takes ~24 h [external, not checked here]). Fix: grace >= 7 days for bounty seasons (MAX_GRACE allows 30 d); dApp posts at commit when a run beats the player's settled best; prover health alerting; document that the deadline is by sequencer `block.timestamp`.

M4. Estop locks deposits for nothing (measured above). Fix: in `refund`, treat an unsettled run as refundable when the emergency stop behind `referee.verifier()` reports `paused()`; ~5 lines, no new role.

M5. The take rule ignores the queue: `settlementEnd - now >= 2 x provingSeconds + 600` per run. With 10 accepted runs of 30 min each, the 10th finishes after 5 h even if its own check passed with 61 min left. Fix: sum the queue ahead (single GPU) in the time test; refuse or reorder.

M6. Self-settling after posting gives the deposit away (measured above). README 7.5 keeps "any player can still prove and settle their own run". Spec W6 covers tools, not players. Fix: dApp and docs: a player who self-proves settles through `claim` with its own payee (recovers its own bounty); or `claim` on branch B pays only if the run was settled within the escrow's own claim... (rejected: breaks B8). Documentation fix is enough.

M7. Generations overlap. A next season opens at `end(prev)`, during prev's grace (Season.open). If the new season has a new ZkReferee (new image id, any core change), the prover needs two zk-host builds at once, but the protocol builds one at "the fixed path" per generation. web reads only `generations[0]` (deployments/README.md), so depositors of the previous generation lose the refund button. Fix: prover keeps one build directory per image id (build at the fixed path, then copy the binary); the season job's refund sweep and the dApp's refund view iterate all generations with a ProofBounty.

M8. An immutable escrow bug has no bound. No cap on `post`. Fix: cap `bountyOf[runId] <= k x paramsOf(season).runFee` (k = 2, one view call), state testnet-only, and one escrow per generation so exposure is bounded by the season's fees.

L9. Prover failures. Payee key lost: credits and every unclaimed proof naming it are lost (re-prove for open bounties). Card dead: the CPU fallback is 338-467 s per segment [repo] plus the Groth16 step in Docker, x86 only, image on Docker Hub only (429 seen) [repo referee/zk/README.md:69,92]; ~1.5-2.3 h for a human run, 11-15 days for 2.9e9 cycles. Hot key lost: harmless, proofs on disk can be sent by any key. Fix: payee = cold address or Safe; keep the Groth16 image mirrored; document the CPU fallback.

L10. A depositor contract that rejects ETH keeps its deposit forever (refund reverts TransferFailed). Owned, not reachable. Fix: `refund` takes a recipient when msg.sender == depositor.

L11. `depositOf` stays non-zero after a payout (by design) and reads as money a UI may show; forced ETH (selfdestruct) has no owner. Fix: views/docs; balance invariant >=, not ==.

L12. The service-free path exists in the contracts (Challenge.settleRun, unchanged) but not in tooling: the settle page only exports a run file. Human runs (15-18 segments) prove on 4 CPUs in ~1.5-2.3 h [est from repo rates]; bot-like 70-137 M in 6-17 h; 2.9e9 never within a grace. Fix: ship the self-prove instructions and a `claim`-with-own-payee button.

## Tried and could not break

- Unsettled refund vs claim never overlap: refund needs `> settlementEnd`, settleRun needs `<=` (Challenge.checkSettlementOpen); post also `<=`.
- Bounty accounting: before payout `bountyOf == sum(depositOf)`; payout zeroes it for good because post then reverts AlreadySettled; partial refunds then claim take the remainder; later refunds revert NoBounty; no underflow path.
- Reentrancy: claim calls only Challenge, Season, ZkReferee, RISC Zero (trusted, no ETH); refund/withdraw are CEI; re-entering post from a refund fails (settled or past end).
- Copying, simulation leak, reverted calldata, re-randomized seal: payee is inside sha256(publicValues); one payout per run id.
- Copier settling directly: branch B still pays the prover, with no deadline until B15.
- Late runs: finishRun does not revert; both branches pay.
- Post minutes before the end: only the poster's gas is at risk; refund right after the end.
- Estop: claims revert; every deposit eventually returns (B14/B15); nothing stuck, only delayed (M4).
- New image id inside a season: impossible (Season params immutable); old seasons keep their escrow.
- Operator disappearance: post/claim/refund/withdraw need no one.
