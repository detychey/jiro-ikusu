# ProofBounty: final specification after three red-team reviews

Date: 2026-11-10. Base: `spec.md` (lead specification, prototype and measurements in this folder) and the three reports `redteam-ordering.md`, `redteam-liveness.md`, `redteam-implementation.md`. Read-only on the repository; nothing was committed.

Sources of numbers: **[repo]** recorded in the repository; **[proto]** measured in this scratch folder on copies of the real contracts (forge 1.8.6, anvil); **[est]** estimate, not measured. No proof was made, no GPU was used, referee/zk was not built.

## 0. Verdict in one paragraph

Build the escrow, for testnet, as a second path beside the operator's own settlement, not instead of it. No theft path survived three reviews: the payee sits inside sha256(publicValues), payment is keyed on run id, and a copier who settles directly still leaves the bounty to the prover's later claim. What did survive is a liveness problem: any poster who can prove its own run can cancel its bounty at will by claiming with its own payee, and can use large decoy bounties to keep the one home GPU busy while rivals' runs go unsettled. A lock with a stake fixes that and is deferred; until then the fix is that the owner's prover settles qualified best runs first, from its own queue, and treats bounties as extra work under per-depositor and per-run caps. Three things should make the owner pause before building: (1) on Arbitrum One a human-style verification costs about 25-27 % of the run fee [est] while Season caps the rake at 20 % [repo, Season.sol:44], so neither the rake nor a rational low-scoring player pays for settlement at today's fee; the escrow moves that cost, it does not lower it; (2) nobody has measured this guest on any GPU, and the RTX 3060 is the only card owned; (3) with one prover, the escrow mostly pays the owner money players post. The first work item is therefore a GPU measurement that needs no format change.

## 1. Changes from the lead sketch and the specification

Accepted (worth their cost):

| # | Change | Source | Why |
|---|---|---|---|
| C1 | README §7.5's promise stays: the operator settles every qualified best run without a bounty (through `claim` with its own payee when a bounty exists, else directly). Bounties are an optional extra path. M5.5 does not depend on the bounty items. | liveness #2, implementation #4 | Owner decision of 2026-11-08 ("players do nothing after committing", README:671); paying to settle makes low scorers drop out; testnet-1 must not wait on hardware. Changing §7.5 is an explicit owner decision (O1). |
| C2 | `refund` of an unsettled run also opens once the emergency stop behind `referee.verifier()` reports `paused()` (read with try/catch; a verifier without `paused()` counts as not stopped). | liveness #4 | The stop is permanent (RiscZeroVerifierEmergencyStop: `estop`, no unpause [repo lib]); waiting up to 120 days buys nothing. About 5 lines, no role. |
| C3 | Cap: `bountyOf[runId] <= BOUNTY_CAP_FEES * paramsOf(season).runFee`, `BOUNTY_CAP_FEES = 4`; `post` reverts `BountyCap`. | liveness #8 | Bounds what an unaudited immutable contract can strand per run, and bounds decoy size. 4, not 2: a heavy legal run on a 3060 may cost more than 2 fees of power [est]. Owner may change k (O5). |
| C4 | Prover scheduling: owner's obligations first (qualified best runs, earliest deadline), then bounties by value per GPU-second; queue-aware deadline test (sum of queued proving time + this job, x2, + 600 s, + a sequencer slack of 6 h for jobs over 1 h); per-depositor share cap of GPU time; per-run cycle cap in the last 25 % of grace; gas-floor pre-filter before executing; poll `bountyOf`/`BountyPaid` between segment batches and kill zk-host when paid; speculative proving of cheap runs on `RunCommitted`. | ordering #1, #2, #4, #7; liveness #1, #5 | Turns the decoy and buy-out attacks from "starve the season" into "waste spare capacity". |
| C5 | `execute-run` checks the run file with `check_levels` and RUN_FIELDS against chain data: runNonce from `Challenge.runs`, draw computed locally, season file checked against `Season.paramsOf`. Settlement-invalid journals (foreign, Training, reordered) are marked unprovable. | ordering #5 | A proof exists for them but `checkOutcome` rejects them forever. |
| C6 | Host requires an EIP-55 checksummed `--payee`, checked with `jiro_core::keccak::keccak256` (core/src/lib.rs:24 exports `keccak`); host adds jiro-core as a path dependency; guest and image id unaffected. All-lower/upper refused. | implementation #8 | Spec wrongly said the host has no keccak; removes W9's typo case. |
| C7 | Re-prove only `challengeRun` and `level` fixtures; `ZkVerify.publicValuesOf` appends the payee word only when a fixture has a `payee` key. `run` and `worstCase` stay as old-image records. | implementation #2 | Only ZkReferee.t.sol (:23, :188, :197-203) reads the new layout; about 2.4 h on 4 CPUs instead of 7 h [repo times], minutes on a GPU [est]. |
| C8 | Score-tamper tests (ZkReferee.t.sol:131, ZkVerify.t.sol:78-82) flip byte `length - 33`, the last score byte, and keep their names (cited by docs/ECONOMY.md:52); separate payee-tamper tests are added. | implementation #3 | Otherwise they silently become payee tests. |
| C9 | M5.8 (format) and M5.9 (escrow) are stacked and approved together; M5.8 merges only when M5.9 is ready. | implementation #5 | A payee word nobody reads is pure cost. |
| C10 | M5.9 resized to L; tooling, deployments schema, localnet, e2e cases and bindings move to new M5.13 (M). | implementation #1 | Prototype alone is 1,358 Solidity lines [proto]; plan §1.1 caps M at 1,000. |
| C11 | README §7.3 line 645 changes in M5.8 itself; its done-when checks README, referee/zk/README.md:19-49 and VERIFICATION.md:706, :745, :963 agree. | implementation #10 | Normative text, CLAUDE.md rule. |
| C12 | e2e proof files store `imageId` and `payee`; reuse refused unless both match. | implementation #9 | Old cached proofs revert on the live chain. |
| C13 | A test that a proof accepted on branch B also settles the same run through `settleRun` on a pre-settlement snapshot; NatSpec on `verifySettledRun` names the invariant (every field `checkOutcome` checks derives from the journal, the image or `Season.open`). | implementation #11 | Pins the coupling a future Challenge could break. |
| C14 | Generation wording: the new generation is policy (docs/DEPLOYMENT.md:195, one Referee key per generation), not forced by Season, which takes a referee per season. Keep the policy. | implementation #7 | Accuracy. |
| C15 | One zk-host binary per image id; the prover, refund sweep and dApp refund view cover every generation that has a ProofBounty. | liveness #7 | Seasons overlap during grace. |
| C16 | dApp (M5.11): replay locally, then refuse or warn before posting on Late, unqualified (clears < minClears) or non-improving (not ranking above `bestRunOf`) runs; "untaken after N minutes" with top-up hint; a "claim with my own payee" button for players who hold a proof, so self-settling returns their own bounty; refundable amounts shown only when `bountyOf > 0`. | ordering #3, #6, #9; liveness #6, #11, #12 | All UI; no contract cost. |
| C17 | Documented residuals: sequencer delay near the end (forced inclusion about 24 h, not checked here), depositor contracts that reject ETH, forced-in ETH (balance invariant is `>=`), CPU fallback limits, cold payee recommended. | ordering #8; liveness #9-#11; implementation #12 | Cheap to state. |

Rejected:

| Proposal | Why not |
|---|---|
| Lock with a stake now (liveness #1 calls it a requirement) | It is the real fix for the decoy attack, but it is a second state machine (lock, expiry, slash, who gets the stake) on unaudited code, for a market with one prover today. C1 + C4 make the attack waste spare capacity instead of starving settlement. Required before mainnet or before any third-party prover is relied on (must-have M10). |
| Refund to a chosen recipient, or refund via `owed` (liveness #10, implementation #12) | Amounts are dust; Safes and 7702 accounts accept ETH; crediting `owed` still ends in a send to the same address. Document instead. |
| A `refundableOf` view | One line in the dApp (`bountyOf > 0 ? depositOf : 0`) does it. |
| Discounting posters "linked" to payees (ordering #2) | Unenforceable heuristics; the per-depositor cap in C4 does the useful part. |
| Re-proving all four fixtures | C7. |
| Making the escrow refuse branch B to stop "harvesting" bounties on runs settled outside it (ordering #3) | Branch B is what makes copying-and-settling-directly harmless. Route funded runs through `claim` in every tool instead (C16, must-have). |
| Grace of at least 7 days enforced in code | Season parameters are owned by `seasons/*.json` and Season's ranges already allow it (MAX_GRACE 30 d). It is an owner decision per season (O4), recommended for any season with bounties. |

## 2. Final design

**Proof format (M5.8).** Public values per level: the 12 words of `abi.encode(uint16 weightBp, Outcome)`, then one word `abi.encode(address payee)`, in both modes: 416 bytes per level (was 384), 2,336 per run (was 2,304). The guest reads the payee's 20 bytes after the levels and commits it last; the trace guest is unchanged. `ZkReferee` checks length `levelCount * 384 + 32`, decodes `(ScoredOutcome[6], address)` / `(ScoredOutcome, address)` and gains `payeeOf(bytes proof) external pure returns (address)` outside `IReferee`. The image id identifies the layout; no version number moves; core, RULES_VERSION, vectors, Challenge, Season, IReferee, the mocks and Stylus are unchanged. The host takes a required checksummed `--payee` (C6) and checks the payee word before printing. Fixtures: C7, C8.

**ProofBounty (M5.9).** Ownerless, three immutables (`challenge`, `seasons`, `referee`), no receive, no fallback, no fee, no pause. Rules B1-B18 of `spec.md` §4.2 stand, with:
- `post`: adds C3's cap check (`BountyCap(runId, cap)`), after the existing ordered checks (ZeroDeposit, NotCommitted, WrongReferee, AlreadySettled, SettlementClosed).
- `claim`: unchanged. Credits the whole bounty to `referee.payeeOf(proof)` (never `msg.sender`), refuses a zero payee, branch A settles through `Challenge.settleRun`, branch B (Settled or Late) checks commitment, `Season.weightOf` and `referee.verifyRun`. Credit first; a failure reverts it. One payout per run id.
- `refund(runId, depositor)`: unsettled and (`block.timestamp > settlementEnd` or the verifier is stopped, C2); or settled and unclaimed after `settlementEnd + CLAIM_GRACE` (7 days). Sends only to the depositor.
- `withdraw(payee)`: pull payment, anyone may call.

Prototype: `proto/contracts/src/ProofBounty.sol` (152 lines, 5,805 bytes runtime) [proto]; C2 and C3 add about 15 lines, not yet prototyped.

**Prover protocol (M5.10).** As `spec.md` §5 steps 1-10, with C4 scheduling, C5 chain-derived RUN_FIELDS checks, C15 one binary per image id, and the operator's obligations of C1 before any bounty. The owner's prover always sends `ProofBounty.claim`, never `settleRun`, for a funded run.

**Costs.** Gas [proto, mock verifier behind the real emergency stop]: post 97,436 / 63,236; claim unsettled 364,880 (human), 707,956 (gate set), 1,174,601 (full); claim settled 230,323; refund 67,481; withdraw 37,949; deploy 1,314,624. With the real Groth16 verifier, about +223,800 [est]: about 588,700 gas per human-style claim, about 0.0000123-0.0000136 ETH on Arbitrum One at the 2026-11-10 reads, 25-27 % of the 0.00005 ETH fee [est]. Arbitrum Sepolia prices L1 data at 0, so testnet costs are near nothing.

## 3. Must-haves (do not ship without)

1. The payee is inside the sha256-bound public values and `claim` credits only `payeeOf(proof)`; never `msg.sender`.
2. One payout per run id; never keyed on proof bytes (re-randomized seals verified [proto]).
3. Branch B pays when the run was settled outside the escrow, with commitment, season weights and `verifyRun` checks, plus C13's test.
4. Claim and unsettled-refund windows are disjoint (`<= settlementEnd` vs `>`), and nothing reduces a bounty before its refund date.
5. C2: refund opens on the permanent emergency stop.
6. C3: per-run cap.
7. Pull payments, checks-effects-interactions, reentrancy tests from a payee and a depositor; the five invariants (bountyOf equals the sum of live deposits before payout; balance >= sum of bounties and owed; at most one payout per run; no refund overlaps a possible claim; credit only to the proof's payee).
8. README §7.5's promise (C1): the operator settles qualified best runs whether or not a bounty exists; M5.5 and testnet-1 do not wait on bounty items.
9. Measured GPU rate on the owner's card at the fixed build path, with matching image id, before any price, grace or deadline rule is set.
10. Testnet only; before mainnet: the lock with a stake, a review at least as deep as M4.12's, and an economics answer to "verification costs more than the rake".
11. Every tool (operator, dApp, e2e) settles a funded run through `claim` with a payee.
12. Checksummed payee in the host (C6); payee should be a cold address or a Safe.

## 4. Accepted residuals

| Residual | Why acceptable (or not) |
|---|---|
| Decoy / self-claim bait: a poster who can prove cancels by claiming with its own payee and wastes the prover's GPU time | Testnet: acceptable with C1 + C4 (only spare capacity is lost). Mainnet: not acceptable without the lock. |
| Racing provers lose their work; first claim wins | Inherent without a lock; speculative proving and abort-on-paid limit it. |
| One home GPU and one sequencer are single points of failure near the settlement end | Mitigated by C1 (settle at commit, not at the end), a long grace (O4), health alerting. Not removable. |
| Economics: verification is about a quarter of the fee on Arbitrum One [est]; rake capped at 20 % | Acceptable on testnet (L1 data price 0). Not acceptable for mainnet until the fee, the rake or batching changes. |
| GPU timings are third-party, for other cards, on another guest | Acceptable only because item 1 of the build order measures them first. |
| Bounty on a run settled outside the escrow pays for a useless proof | Tools route through claim; 7-day refund for the unclaimed case. |
| `settleLevel` is never paid | Six level proofs are a rare path; documented. |
| Deposits locked until the settlement end when no proof can exist | Mitigated by the dApp's local replay before posting; no cancellation by design (B4). |
| Depositor contracts that reject ETH; forced-in ETH | Dust; documented. |
| Sequencer can delay or drop a claim, not redirect it | Documented; slack in C4. |
| Unaudited immutable code holding users' ETH | Testnet, capped per run (C3). |
| No external market for these proofs since Boundless paused (2026-11-05, web research, not rechecked) | This is the reason for the design. |

## 5. Owner decisions, each with a recommendation

- **O1 Keep README §7.5's promise** (operator settles every qualified best run; bounties optional). Recommend: keep. The alternative (settlement as a purchase) reverses the 2026-11-08 decision and pushes low scorers out.
- **O2 Build the escrow now or after the GPU measurement.** Recommend: measure first (item 1); build M5.8/M5.9 only if the 3060 or 5060 Ti proves a human-style run in minutes, not hours.
- **O3 Lock with a stake.** Recommend: defer for testnet; require before mainnet or before relying on any third-party prover.
- **O4 Grace for seasons with bounties.** Recommend: at least 7 days (testnet-0 has 24 h; README proposes 48 h).
- **O5 Per-run cap.** Recommend: 4 x runFee.
- **O6 CLAIM_GRACE refund of a settled run's unclaimed bounty.** Recommend: yes, 7 days (else ETH locks forever after a stop or a direct settlement).
- **O7 Refund on the emergency stop.** Recommend: yes.
- **O8 Credit-and-withdraw rather than sending in claim.** Recommend: yes (pull payments, project rule).
- **O9 Payee in level proofs too.** Recommend: yes, one layout for both modes; `settleLevel` stays unpaid.
- **O10 Name** ProofBounty (D13). Recommend: yes.
- **O11 Deposits only after commit, no cancellation, one escrow per referee, offchain price discovery, anyone may trigger a refund for a named depositor.** Recommend: all as specified.
- **O12 Who re-proves the two fixtures.** Recommend: the owner's GPU from item 1 (minutes), else the CPU container (about 2.4 h [repo times]).
- **O13 New generation on Arbitrum Sepolia for the new image id.** Recommend: yes (policy of docs/DEPLOYMENT.md, simpler schema), not a technical necessity.
- **O14 Mainnet economics.** Recommend: do not open a paid mainnet season with this design until verification per settled run is below the rake (raise the fee, raise the rake within its 20 % cap, or settle fewer runs).

## 6. Build order (one item, one pull request)

Ids are the next free ones in M5 (M5.4 deferred; M5.8 next). Plan §1.1 sizes.

1. **M5.8 GPU proving measurement** (S, depends on M4.14; needs the owner's GPU machine). `risc0-zkvm/cuda` feature in `referee/zk/host/Cargo.toml`; build at the fixed path; check `zk-host image-id` equals the deployed one; prove `contracts/test/fixtures/zk-run.json` on the RTX 3060; record seconds per segment, Groth16 time, peak GPU memory, po2, whether Docker ran, OS; add `execute-run` that prints a run file's cycles. Lockfile change in a PR without `ci:heavy`. Done when docs/VERIFICATION.md has the measured table. Gate for O2.
2. **M5.5 Season operations** (existing, M; unchanged dependency, not on bounty items). Operator settles best runs with the measured route, directly (no bounties yet).
3. **M5.9 Payee in the zk public values** (M, depends on M5.8 and M4.10/M4.14; stacked with M5.10, merged only with it). Guest, ZkReferee + `payeeOf`, host `--payee` with checksum (C6), two fixtures re-proven (C7), tamper tests (C8), README §7.3:645 and the zk README and VERIFICATION lines (C11), zk-prove.yml, ABI. Verified by forge test (all ZkReferee.t.sol tests green with the new fixtures) and the host tests.
4. **M5.10 ProofBounty contract** (L, stacked on M5.9). Contract with C2 and C3, unit, invariant and gas tests, C13 test, README §7.5 (bounty path beside the kept promise) and §8.4 custody, ECONOMY threat rows and slither review, ABI. Merging approves O5-O11.
5. **M5.13 ProofBounty tooling** (M, depends on M5.10). deploy.mjs, localnet `--backend zk`, optional deployments key, e2e bounty cases with dev-mode proofs and C12, bindings.
6. **M5.11 Prover loop** (M, depends on M5.10, M5.8; needs GPU, funded hot key, payee). C4, C5, C15, docs/PROVER.md with CPU fallback limits; operator obligations first.
7. **M5.12 Bounties in the dApp** (M, depends on M5.13). C16.
8. **M5.14 Second generation on Arbitrum Sepolia** (S, depends on M5.13, M5.11; needs keys and funding): one bounty proven on the GPU and claimed, one copied-proof direct settlement and branch-B claim, one refund.

M5.6 (testnet season 1) depends on M5.5 only, as today; bounty items join it if they are ready.
