# Optimistic settlement with fraud proofs for a deterministic replay

Research date: 2026-11-10. Every web page below was opened on that date unless a publication date is given. Each fact is marked **[P]** primary source, **[S]** secondary source, or **[I]** inference of mine. Sources older than twelve months are marked *old*. Nothing here was compiled or run against the contracts: `forge` is not installed in this container, so every gas figure for a proposed contract is an estimate.

## 1. The answer, with the facts that decide it

**Yes: settlement can be optimistic, and the smallest version needs no change to the core, the zk guest, `Challenge.sol`, `Season.sol` or `ZkReferee.sol`.** It is one new contract, an `IReferee` that wraps `ZkReferee`. The browser never proves anything. It posts a claim and a bond; every other browser and the operator check it by replaying the public journals in wasm, in milliseconds; the zk proof is made only when a claim is challenged.

The facts that decide it:

1. **Production systems have converged on one single-round shape.** A claim with a bond; one challenge with a bond inside a window; then anyone may post a validity proof inside a second window; if no proof comes, the challenger wins. This is OP Succinct Lite and the OP Stack's own `ZKDisputeGame` (spec version 2.1.0). Celo has run it on mainnet since 2025-12-10 with a 3 d 12 h challenge window, a 1 d proving window and 0.01 ETH bonds on each side. [P][S] (S1, S2, S6, S7)
2. **That shape handles a journal that replay rejects without touching the guest.** No proof exists for such a journal, so a challenged claim on it simply times out and loses. The OP spec calls this outcome intended. The other shape, where the challenger must prove the fault, would need a guest that can prove a rejection. [P] (S1, S8)
3. **The challenge window is bounded below by Arbitrum's force-inclusion delay, which is 24 hours today.** Read on Ethereum at block 26,384,828: `maxTimeVariation()` gives `delayBlocks` 7,200 and `delaySeconds` 86,400; the delay buffer is enabled, full at 14,400 blocks, with a 150-block (30 min) threshold. [P] (S18) So a challenge window must be longer than 24 h plus the time to notice and to get an L1 transaction in; I use 36 to 48 h.
4. **The defence window is bounded below by proving time.** A run takes 9 to 17 hours to prove on 4 CPU cores (repo, `docs/VERIFICATION.md`), and the defence transaction can itself be delayed 24 h. About 48 h is the honest figure. Together the two windows push the season's grace from the proposed 48 h to about 4 days. [I]
5. **The saving is real but small in money, larger in operations.** Measured today: a zk-verified run costs 804,194 gas plus a 0.0000184 ETH proof, 0.0000345 ETH, 69 % of the 0.00005 ETH fee. Estimated optimistic path through the wrapper: about 0.72 million gas and no proof, about 0.0000145 ETH, 29 % of the fee. A path inside `Challenge` that does not republish the journals: about 0.235 million gas, 9 % of the fee. [P for the measured figures, I for the estimates] (S43) The larger gain: today the operator must obtain one proof per player per season; 200 best runs are 1,800 to 3,400 hours of a 4-core machine, which a 48 h grace cannot hold without the two-prover Boundless market. Optimistically the number of proofs is the number of disputes.
6. **It does not reduce dependencies.** The whole zk stack stays, as the dispute backend that almost never runs. Only a Stylus dispute backend would remove it, and new Stylus activations are still paused; the proposal to reopen them (temperature check ended 2026-11-05) would require an audit and an Arbitrum Foundation signature per contract. [P] (S24)
7. **Soundness changes in kind.** Today a paid result is backed by a proof. Optimistically it is backed by "at least one honest watcher gets a transaction included within the window", plus bonds. That is not a trusted signer, but it is a liveness assumption the README chose against in §7.3 ("it is proven rather than disputed").
8. **The dispute machinery that never runs is where bugs live.** OP Mainnet fell back to permissioned proofs two months after launch (reported 2024-08-17) after audits found two high-severity issues; Boundless has made the Kailua repository read-only, and it "will receive no further updates, including security fixes"; BOB stopped using Kailua on 2026-09-16; Celo's challengers are a whitelist of six. [S][P] (S26, S9, S11, S7)

Bisection to a single tick, Cartesi PRT, BoLD, Cannon, UMA and Truebit are not worth their weight at this scale; section 6 says why with numbers.

## 2. Baseline from the repository

All from `docs/VERIFICATION.md`, `docs/ECONOMY.md`, `README.md` and `contracts/src` [P]:

| Quantity | Value |
|---|---|
| Run fee | 0.00005 ETH |
| zk verification, one run proof | 227,591 gas |
| `settleRun` without the referee | 576,603 gas, of which 353,908 is calldata (25,636 bytes of levels and journals) |
| Proof price on Boundless, p50 | 0.0000184 ETH (p10 to p90: 0.0000138 to 0.0000233; `DigestMatch` requests near our size: p50 0.000055) |
| One verified run | 0.0000345 ETH at a 0.020036 gwei base fee, 69 % of the fee |
| CPU proving, one run | 97 to 137 million proving cycles; about 9 to 17 h on 4 CPUs, 4.6 to 9.2 GiB, then a 7 GiB Groth16 step in an x86 Docker image |
| CPU proving, one level | 15.2 to 30.9 million proving cycles; `worst-case` took 13,177 s (3.66 h) on 4 CPUs |
| Stylus `verify`, one level | 5.1 to 11.6 million gas; activations paused |
| State-hash preimage | 948 bytes; `core/src/hash.rs` says it is "for traces and diagnosis. Stepping never computes it", and the core has no function that rebuilds a `Game` from it |
| Season grace | proposed 48 h; `testnet-0` uses 24 h; `MAX_GRACE` is 30 days |

Arbitrum One's base fee at block 522,990,309 (2026-11-10, about 13:30 UTC) was 0.028046 gwei [P] (S18), against 0.020036 gwei in the repo's 2026-11-02 reading. At today's fee the zk path is 0.0000410 ETH (82 % of the fee) and the wrapper path about 0.0000202 ETH (40 %). [I]

## 3. How production systems do it

### 3.1 Single round, settled by a validity proof

| System | Mechanism | Numbers | Status |
|---|---|---|---|
| **OP Stack `ZKDisputeGame`** (game type 10) | Propose with `initBond`; one `challenge()` with `challengerBond` before `createdAt + maxChallengeDuration`; `prove()` by any address before `challengedAt + maxProveDuration`; `resolve()` is permissionless. Unchallenged: proposer wins. Valid proof in time: proposer wins. No proof in time: challenger wins. | Version 2.1.0. No defaults in the spec; durations and bonds are per deployment. First backend: SP1 PLONK. | Spec; the page does not say where it is deployed. [P] (S1) |
| **OP Succinct Lite** | Same shape. The challenger posts a bond, not a proof; the design lets "anyone to prove a proposal even the prover is not the proposer"; the prover receives the challenger bond. | Deploy guide examples: bonds 0.001 ETH each, challenge 7 d, proving 1 d. Blog (2025-02-20, *old*): worst-case bonds fall from hundreds of ETH to 5 to 15 ETH; proofs are generated only in a dispute, so the ongoing proving cost is zero. | Live on Celo mainnet since 2025-12-10. [P] (S2, S3, S5, S6) |
| **Celo, as deployed** | OP Succinct Lite. | Challenge period 3 d 12 h, proving window 1 d, proposer bond 0.01 ETH, challenger bond 0.01 ETH. 2 whitelisted proposers; 6 whitelisted challengers (5 outside the team). Stage 0. | Production, permissioned. [S] (S7); [P] for the challenger set (S6) |
| **Kailua** (RISC Zero) | No challenge transaction: a contradictory proposal is the dispute. A proof from anyone, with **no time limit**, shows which of two proposals is right at their first divergence; "neither [proposal] can be finalized until the proof is submitted". Slashed bond splits in thirds: prover, tournament winner, burn. Extra "null" and "trail" fault proofs make every contradiction decidable. | Gas: `proveValidity` about 375 k, `proveOutputFault` 415 k to 470 k. Uses RISC Zero 3.0.6 in its Base example. | The Boundless repository says: "This repository is read-only and will receive no further updates, including security fixes"; a former maintainer keeps a fork. [P] (S8, S9) |
| **BOB, as deployed** | Kailua hybrid. | Docs: 0.5 ETH stake to propose or challenge, 4 days to finalize, about $3 per proof, 250 k gas to verify. | Per L2BEAT, the fault proof system is deployed but not functional: since 2026-09-16 the respected game is the permissioned one and Kailua proposals have stopped. [P] docs, possibly stale (S10); [S] (S11) |
| **Brevis coChain** | Results posted optimistically; a bonded challenge makes the proposer produce the full ZK proof. | No numbers found. | [S], from a third-party guide only (S38) |

Two findings from these systems matter for a small design:

- **Sizing rule, from Succinct's own guide:** "defense cost = range proof cost + aggregation proof cost + L1 proof submission cost + operating buffer; challenger bond ≈ 10 × conservative defense cost". The defender pays first and is repaid from the challenger's bond. The guide adds, in substance: each game accepts one challenge and opens one proof window; several games can be challenged at once, so the defender must fund concurrent proofs; and a bond set too high shrinks the set of parties able to challenge an invalid proposal. It calls ten times "a starting point". [P] (S4)
- **Liveness of every state.** An April 2026 report in Base's audit competition describes a challenge-then-nullify sequence in a ZK dispute game that leaves a proposer's bond locked for good, because removing one proof left the game below its resolution threshold. The report is an unverified submission, but the lesson is general: after every transition there must be a path to resolution or refund, and a global verifier switch needs a defined bond outcome. [S] (S12) The OP spec states the dual risk as an assumption: an honest claim that cannot be proven within the limits loses if challenged (aZKG-010). [P] (S1)

### 3.2 Bisection down to one step

| System | Mechanism | Numbers | Status |
|---|---|---|---|
| **Arbitrum BoLD** | Assertions carry history commitments (Merkle trees of asserted states). Rivals bisect through three levels, blocks, then ranges of 2^23 WASM steps, then single steps; a `OneStepProof` contract executes the last one. | Assertion bond 3,600 ETH; challenge bonds 555 and 79 ETH; challenge period 6.4 days (L2BEAT: 6 d 8 h); disputes end within two challenge periods plus a 2-day Security Council grace; "for every $6.46 spent by malicious parties attacking, only $1 is needed to defend it successfully in BoLD"; honest gas "100% refundable by the Arbitrum Foundation"; confiscated bonds go to the DAO, defenders get a 1 % bounty. | Live on Arbitrum One since 2025-02-12. [P] (S15, S16); [S] for the date (S42) and period (S17) |
| **OP Stack Cannon** | Bisection over output roots, then over the execution trace of a MIPS VM; `step()` runs one instruction onchain. | Max depth 73. Bond per move = 400,000 gas × 1.09493^depth × 200 gwei: 0.08 ETH at depth 0, up to 300 million gas (60 ETH). "Roughly 14 ETH (including gas costs)" to keep proposing through a 7-day window. `DelayedWETH` delay 7 days. | Live on OP Mainnet since 2024-06-10; reverted to permissioned in August 2024 (reported 2024-08-17), with the Granite fix scheduled for 2024-09-10. [P] (S25); [S], *old* (S26) |
| **Asterisc** | The RISC-V counterpart of Cannon: a Solidity/Yul step (`rvsol`) mirroring a Go one. RV32I/RV64I with M and A; a minimal set of Linux syscalls. | README: "Deploy/run this at your own risk, this is highly experimental software". No releases listed. | Experimental. [P] (S27) |
| **Cartesi PRT, then Dave** | Claims are "computation hashes", Merkle trees with a leaf per state transition; sparse hashes first, denser ones on the disputed part; three tournament levels; the bottom one runs one RISC-V machine step in Solidity. | Honeypot v2: bond 0.23219805 ETH, challenge period 7 d 1 h, TVS $1.24 K, deployed 2025-11-08 on Ethereum. Dave paper: disputes finish in 2 to 5 challenge periods; delay grows with the logarithm of what the adversary spends. | PRT is live on Ethereum mainnet for the Honeypot. Cartesi Rollups contracts are listed for Arbitrum (chain 42161); I found no PRT or Dave deployment there. [P] (S28, S30 *old*); [S] (S29) |
| **opML** (ORA) | Interactive fraud proof for ML inference. | Paper of 2024-01-31. | *Old*; current status not found. [P] (S33) |
| **tickproof** | The closest precedent for this project: a real-time game in `no_std` Rust, compiled to native and to Solana's bytecode. A claim is a state root plus a rolling hash of the input log. Challenge, bisect to one tick, re-execute that tick onchain with the same program. If the disputed tick cannot execute at all, the challenger wins by timeout. | Honest match: 6 transactions, about 31 s. Adversarial: 20 transactions, about 47 s, a lie at tick 21. One-step proof about 19 k compute units. It rejected zk for cost: an SP1 Groth16 verification is about 280 k compute units. | June 2026, Solana devnet prototype, by its own words an early work in progress. Stated gaps: input authenticity, one challenger per session, a player who never watches the chain can be cheated by an unchallenged false finalization. [P], self-published (S34) |

### 3.3 Oracles and generic verification games

- **UMA Optimistic Oracle v3 is on Arbitrum One** at `0xa6147867264374F324524E30C02C331cF28aa879` [P] (S31, networks file). Read from that contract on 2026-11-10: `getMinimumBond(WETH)` = 0.11 WETH, `getMinimumBond(USDC)` = 500 USDC, `defaultLiveness()` = 7,200 s, `burnedBondPercentage()` = 50 %. [P] (S18) The minimum bond is 2,200 run fees. A dispute goes to UMA's DVM on Ethereum, where "UMA stakers resolve disputes" in a 24 h commit and a 24 h reveal round, needing "a minimum 65% majority of staked UMA"; a winning disputer gets half the proposer's bond and the rest goes to UMA's Store. UMA lists Arbitrum as "unmonitored". [P] (S31) A token vote on a question that a proof can settle is the wrong tool, and the bond floor alone rules it out.
- **Truebit.** On 2026-01-08 an old Truebit contract was exploited for about 8,535 ETH ($26.6 million) and TRU fell 99.9 %. [S] (S32) I found nothing on the state of its verification game since.
- **The verifier's dilemma.** If fraud never happens, watching earns nothing, so watchers stop. The literature treats it as unsolved in general ("Incentive Non-Compatibility of Optimistic Rollups", arXiv 2312.01549, *old*). [S] (S39) It bites less here than in a rollup: watching one run costs milliseconds of CPU.

## 4. Arbitrum facts that set the windows

| Fact | Value | Source |
|---|---|---|
| Force-inclusion delay | `delayBlocks` 7,200 L1 blocks, `delaySeconds` 86,400: 24 h. `futureBlocks` 64, `futureSeconds` 768. | [P] onchain, S18; docs: "`delayBlocks` is a constant currently set to 7200 blocks (24 hours)", S13 |
| Delay buffer ("Censorship Timeout") | Enabled on Arbitrum One: `isDelayBufferable()` true; buffer 14,400 blocks (full), max 14,400, threshold 150 blocks, replenish 500 bp. The force-inclusion window is the lesser of the buffer and `delayBlocks`, so it is 24 h now and falls toward 30 min only after sustained delays drain the buffer. | [P] onchain, S18; docs, S13, S14; L2BEAT "1 day (150–7,200 L1 blocks)", S17 |
| Sequencer | "The system has a centralized sequencer"; it "provides no real-time censorship resistance". | [S] S17 |
| Timestamp skew | The sequencer can run at most 768 s ahead of L1, so it cannot shorten a 36 h window by more than 13 minutes. | [I] from `futureSeconds`, S18 |
| Ordering | Timeboost since April 2025; a constitutional proposal of 2026-06-03 replaces it with priority gas auctions in 125 ms rounds. In both, "the mempool remains private"; Offchain Labs: "sandwich attacks and frontrunning were not and are not possible on Arbitrum One". Activation date of PGA not confirmed. | [P] S22, S23 |
| Outages | 2023-12-15: sequencer and feed stalled from 10:29 to 11:57 ET during an inscriptions surge; the incident record runs 4 h 07 min. 2022-01-09: about 7 h after a hardware failure (press report). Status history for September to November 2026 shows one 2-minute Arbiscan outage and 100 % for the ARB1 sequencer. L2BEAT's only recent anomaly: no batch for 17 min 24 s on 2026-10-29. I found no ARB1 sequencer incident dated 2024 to 2026. | [P] S19 (*old*), S20; [S] S21 (*old*), S17 |
| Stylus | New activations paused since 2026-10-02. "Constitutional AIP: Stylus Activation Contract", temperature check ending 2026-11-05: each new contract would need a limited security audit from an Arbitrum Security Program auditor, then an activation signature from the Arbitrum Foundation. Result not found. | [P] S24 |

**Consequences.** [I]

- A watcher whose challenge is censored falls back to the delayed inbox on L1 and is included after at most 24 h plus L1 inclusion. The challenge window must exceed that with margin: **36 to 48 h**. This covers the L2 sequencer, not censorship of Ethereum itself, which is what the 7-day rollup convention is for (BoLD's docs: seven days is "the maximum period of time an adversary could delay Ethereum before social intervention", S15). For pots of tens to hundreds of dollars, 36 to 48 h is a defensible cut, and it should be written down as one.
- The longest Arbitrum One outage on record that I could find is about 7 h. A 36 h window is five times that.
- A defence can be censored too, so the defence window needs 24 h on top of proving time: **about 48 h** for a whole-run proof on a CPU, or 36 h if only single levels are ever proven.
- Nobody can see a pending challenge, so a cheater cannot react to one. This matters for bond design (section 5.4).

## 5. The smallest change set

### 5.1 Shape: a referee that wraps the zk referee

`Season.open` takes any `IReferee` and `Challenge.settleRun` passes it an opaque `proof` (README §7.3, point 3: "The money contracts don't change when the backend does"). So the optimistic path can live entirely in a new referee, `OptimisticReferee`, opened as the referee of a new season in the existing generation:

- with a **zk proof**, `verifyRun` and `verify` forward to the wrapped `ZkReferee`, exactly as today;
- with an **optimistic proof**, `abi.encode(uint256 runId, Outcome[6] outcomes)`, `verifyRun` returns those Outcomes if the run has a claim whose challenge window has passed unchallenged.

`Challenge.settleRun` then runs the code it runs today: the commitment check, the level-in-season lookup, the seven per-Outcome checks of `checkOutcome`, the sums, the deadline and late marking in `finishRun`, and `Season.recordRun`. **`Challenge.sol`, `Season.sol`, `ZkReferee.sol`, `IReferee.sol`, the core, the guest and its image id do not change.**

One thing does change in meaning, and it must not be oversold. With a zk proof, the Outcomes come from the proven replay, so `checkOutcome` is a real check of the journals' headers and of the draw. In the optimistic branch the Outcomes are whatever the settler supplies. `checkOutcome` then only makes the supplied Outcomes consistent with the run: a liar can write mode 1, the season's rules version and the draw slot of any six season levels. What stays real onchain is that the journals are the committed ones and the level bytes are season levels. Whether the Outcomes are true, header fields and draw included, rests entirely on the watchers.

### 5.2 State and functions

Untested sketch, not compiled:

```solidity
contract OptimisticReferee is IReferee {
    enum Status { None, Claimed, Challenged, Final, Voided }

    struct Claim {            // two storage slots
        address claimer;      // the run's player
        uint40 claimedAt;
        uint32 score;         // Σ levelScore
        uint16 ticks;         // Σ ticksUsed, at most 16,200
        uint8 clears;
        address challenger;
        uint40 challengedAt;
        Status status;
    }

    IReferee public immutable zk;          // dispute backend and direct path
    Challenge public immutable challenge;
    Season public immutable seasons;
    IPausable public immutable zkStop;     // RISC Zero's emergency stop
    uint256 public immutable claimBond;
    uint256 public immutable challengeBond;
    uint40 public immutable challengeWindow;
    uint40 public immutable defenceWindow;

    mapping(uint256 runId => Claim) public claims;
    mapping(address => uint256) public credit;      // pull payments

    function claim(uint256 runId, uint32 score, uint16 ticks, uint8 clears) external payable;
    function challengeClaim(uint256 runId) external payable;
    function defend(uint256 runId, bytes[6] calldata levels, bytes[6] calldata journals,
        bytes calldata zkProof) external;
    function resolve(uint256 runId) external;
    function timeout(uint256 runId) external;
    function release(uint256 runId) external;
    function withdraw() external;

    function verifyRun(bytes[6] calldata levels, bytes[6] calldata journals,
        uint16[6] calldata weightsBp, bytes calldata proof) external view returns (Outcome[6] memory);
    function verify(bytes calldata level, bytes calldata journal, uint16 weightBp,
        bytes calldata proof) external view returns (Outcome memory);   // zk only
    function rulesVersion() external view returns (uint16);             // zk.rulesVersion()
}
```

| Function | Who | Rule |
|---|---|---|
| `claim` | the run's player only | `msg.value == claimBond`; the run is committed and unsettled; no live claim; `block.timestamp + challengeWindow + defenceWindow ≤ seasons.settlementEndOf(season)`. Stores the three sums. |
| `challengeClaim` | anyone | `msg.value == challengeBond`; status `Claimed`; inside the challenge window. One challenge per claim, as in the OP spec, so that the deadline cannot be reset. |
| `defend` | anyone | Status `Challenged`, inside the defence window. Calls `challenge.settleRun(runId, levels, journals, zkProof)`, then reads `challenge.settlements(runId)`. Sums equal the claim's: the claimer gets the claim bond back and the caller gets the challenge bond. Sums differ: the claim is void and the challenger wins. |
| `resolve` | anyone | The same comparison for a run that somebody settled directly with a zk proof. Here the challenge bond goes to the claimer. It also voids an unchallenged claim that a zk settlement contradicts, while its bond is still held. |
| `timeout` | anyone | Challenged and still unsettled after the defence window: the claim is void, and the challenger gets the challenge bond back plus the challenger's share of the claim bond. If `zkStop.paused()`, both bonds are refunded instead. |
| `release` | anyone | Unchallenged after the challenge window: status `Final`, claim bond credited back. |
| `verifyRun`, optimistic branch | `Challenge`, by staticcall | Claim is `Claimed` and past its window, or `Final`; every Outcome's `runNonce` is the nonce of `runId`; Σ `levelScore`, Σ `ticksUsed` and the count of Cleared equal the claim's. |

Three binding rules carry the weight, and each closes an attack I found while sketching:

1. **Claims are per run and only the player may claim.** With third-party claims, anyone could settle a rival's run with a false low score or false ticks that mark it late, and a settled or late run "cannot be settled again" (README §7.2). Today third-party settlement is harmless only because a proof forces true values.
2. **The optimistic `verifyRun` checks that the Outcomes carry the nonce of the claimed run.** Without it, the matured claim of one run could settle another run, another player's included, with the first run's score: `Challenge` checks the Outcomes against the run being settled, but the wrapper would have vouched for the sums of a different run.
3. **A defence goes through `Challenge.settleRun`, never through a separate proof check in the wrapper.** If the wrapper verified proofs itself, it would have to repeat `checkOutcome` and the level-in-season lookup. Without that repetition, a "bait" claim over wrong weights or wrong levels could be proven "valid" for its own inputs and take an honest challenger's bond. Routed through `settleRun`, the defence is exactly "this run settles with a proof and records the claimed sums", which is what a watcher checks.

The watcher's rule follows: rebuild the run from chain data as the operator already does (README §7.5), take the levels its nonce draws, replay them with the core, and apply the checks that `zk-host prove --run` applies before it proves (level id, run nonce, level index, draw slot, mode, rules version). **A claim is good only if a zk `settleRun` of that run would succeed and record exactly the claimed score, ticks and clears. Challenge every other claim.** Under that rule a correct watcher can never lose a challenge, provided the wasm, native and RISC-V builds agree, because losing means somebody settled the run with a proof and the claimed sums.

One optional guard conflicts with a project rule. Without a cap, a single unchallenged false claim can state a score of up to 2^32 − 1 and take nearly the whole pot. A cap such as `levelScore ≤ weightBp` and `ticksUsed ≤ 2,700` limits one false claim to the sum of the six heaviest weights: 219,788 points with `testnet-0`'s weights, 3.3 times the reference mix's mean run score of 65,683 (`docs/ECONOMY.md` §5). But it writes a bound from the core's rules into Solidity, which P17 avoids for the draw. The owner should decide; I would add the cap and document it as a bound, not as a rule.

### 5.3 Timing against the season end plus grace

- `settleRun` still must land by `end + grace` (unchanged). A claim is usable from `claimedAt + challengeWindow`.
- The `claim` guard, `claimedAt + challengeWindow + defenceWindow ≤ end + grace`, removes the last-minute delay attack: a challenge at the final second of the window still leaves a full defence window before settlement closes. A player who is too late to claim uses the zk path, as today.
- The last on-time run is committed about 21 minutes after the season ends (reveal window, 1,080 s of play, `commitSlack`). So **`grace ≥ challengeWindow + defenceWindow + about 1 h of margin for the claim`**: with 36 h and 48 h, 3.5 days plus margin, so **4 days**; with 48 h and 48 h, 4.5 days. `MAX_GRACE` is 30 days, so no range changes. Payouts move 2 to 2.5 days later than with a 48 h grace.
- For comparison: Celo 3.5 d + 1 d, on L1; BOB 4 d, later 1 d. [S] (S7, S11)
- Somebody has to send `settleRun` after the window. The player, or the operator's job as a keeper: about 0.6 million gas each.

### 5.4 Bonds

Costs, at the repo's 0.020036 gwei [I from measured figures]:

- A defence through the market: `settleRun` with a proof (804,194 gas) plus the wrapper's bookkeeping (about 60 k) plus the proof (0.0000184 ETH): about **0.000036 ETH**; 0.000072 ETH at the `DigestMatch` price.
- Succinct's rule of ten times the defence cost gives a **challenge bond of 0.0004 to 0.0008 ETH at least**. A defender without market access spends 9 to 17 hours of a 4-core, 16 GB machine instead.
- With the score cap, a false claim gains at most about 3.3 times an average qualified player's payout in a season of mix-like players: with r runs per player and a 10 % rake, 3.3 × 0.00005 × r × 0.9 ETH, so about 0.0015 ETH at r = 10 and 0.003 ETH at r = 20. Without the cap, the gain is the players' pot.

Proposed defaults, to be tuned on testnet:

| Parameter | Value | Reason |
|---|---|---|
| `claimBond` | 0.002 ETH (40 run fees) | Of the order of the gain of one capped false claim. With bond B, gain G and challenge probability q, a false claim loses money when q > G / (G + B): 43 % for G = 0.0015 and B = 0.002. A season parameter in spirit: it should follow the expected payout per player. |
| `challengeBond` | 0.002 ETH (40 run fees) | 55 times the market defence cost, and at least the claim bond. A blind challenge of an honest claim loses money when the probability of a defence exceeds (B/2) / (B/2 + challengeBond): 33 % with B = 0.002, 11 % with B = 0.0005. |
| Slashed claim bond | half to the challenger, half burned or to the treasury | UMA sends half to its Store; Kailua burns a third; BoLD confiscates to the DAO and pays a 1 % bounty. Paying the whole bond to the counterparty makes a self-challenge free. (S31, S8, S15) |
| `challengeWindow` | 36 to 48 h | Section 4. |
| `defenceWindow` | 48 h | Section 4. |

A bond of 40 run fees, locked for the challenge window, is the main cost to players: someone who pays $0.11 a run must hold about $4.60 for a day and a half to two days, once per claimed run. A smaller bond is possible if the owner trusts the watchers to catch nearly every false claim. Only a player's best run needs a claim.

### 5.5 Best-run ranking, late runs and `settleLevel`

- **Ranking.** Unchanged. `Season.recordRun` is still called only by `Challenge.finishRun`, with the sums of the six Outcomes. "Anyone may settle" still holds after the window; credit still goes to the run's player. The tie rule, first settled stays, is unchanged.
- **Late runs.** Unchanged in code. `finishRun` computes the deadline from the settled ticks. A claim that overstates ticks to turn a late run into an on-time one is a false claim like any other, and the watcher's comparison of the three sums catches it.
- **`settleLevel`.** Stays zk only: the wrapper's `verify` forwards to `ZkReferee.verify`. An optimistic run never needs it, because it carries no proof and a full `settleRun` fits in one transaction (README §7.3, P16). `settleRun` stays available after a partial `settleLevel`, as now.
- **Verify by exception.** Still applies: a claim per best run, not per run. The zk path stays open for every run at all times, so a season can mix both.

### 5.6 What else changes

- **Season file:** `referee` is the wrapper; `grace` of at least 4 days.
- **Web:** a claim transaction once a run is the player's best, the bond and its release, a settle button after the window, and a check of other players' claims in the wasm core with a challenge button.
- **Operator job:** watch every claim, challenge false ones, defend challenged honest ones, settle matured ones. It already rebuilds and replays every committed run.
- **A fire drill:** prove and settle one real run per season through the zk path, so the dispute backend is known to work when it is needed.
- **Documents, under the CLAUDE.md sync table for `contracts/src/**`:** README §7.1 (what verification proves), §7.2 step 4, §7.3 ("Rejections revert" no longer holds for an unchallenged claim; a third `proof` encoding), §7.5, §8.4 (grace); `contracts/abi/`; the threat table of `docs/ECONOMY.md`. No `RULES_VERSION` bump: no core behavior changes.

### 5.7 The larger variant: a claim path inside `Challenge`

`claimRun(runId, score, ticks, clears)`, `challengeClaim`, and `finalizeClaim(runId)`, which calls `finishRun` from the claimed sums with no level or journal calldata. Estimated about 235 k gas for claim, finalize and bond withdrawal, 0.0000047 ETH at 0.020036 gwei, **9 % of the fee**, against 29 % for the wrapper. [I]

Its costs: a new `Challenge` and therefore a new `Season`, since a `Season` binds one `Challenge` for good; a change to the reviewed money contract; and `Challenge` holds ETH, which today it does not. It loses nothing in security against the wrapper: in the wrapper's optimistic branch the republished levels and journals are only hashed against the commitment and the season, and the Outcomes are unverified either way (5.1). So the wrapper pays about 0.5 million gas per settled run for the sake of leaving `Challenge` untouched. I would start with the wrapper, because it opens as a season of the deployed generation and can be abandoned by opening the next season with `ZkReferee`, and move to this variant if the optimistic path is kept.

### 5.8 Other dispute backends for the same game

- **One level instead of the run, with the existing level-mode proof.** A challenger names the level; the defence is `settleLevel` with a level proof: 15 to 31 million cycles, about 1.9 to 3.8 hours on 4 CPUs instead of 9 to 17. [I from S43] It needs per-level claims and one challenge slot per level: with a single slot, a cheater could challenge a correct level of their own false claim and have it upheld. A refinement, not a first version.
- **Stylus re-execution of the disputed level.** 5.1 to 11.6 million gas, inside the 32 million cap: 0.00014 to 0.00033 ETH at today's base fee, about $0.33 to $0.75. [I from S43, S18] The challenge transaction itself would settle the dispute: no prover, no defence window, no proving-capacity attack. The wrapper would have to tell replay's error codes from an out-of-gas revert. Blocked by the activation pause, and under the proposed reopening by an audit and a Foundation signature per contract.
- **Bisection over per-tick state hashes to one tick.** See 6.3.

## 6. The alternatives, judged

### 6.1 Challenger proves the fault, either side may prove, no deadline (Kailua's shape)

It removes the blind-challenge problem, since a challenge is a proof. But a claim over a journal that replay rejects has no proof at all, so it would stand. Kailua closes that hole with extra proof kinds for malformed proposals; here the guest would have to commit a rejection verdict with enough of the header to bind it to the run, which is a new guest, a new image id and a new public-values format. It also inverts the failure under load: if proving capacity runs out, false claims mature, where in the challenge-then-prove shape honest claims lapse. Losing a bond is the cheaper failure than paying a forged score. And Boundless no longer maintains the reference implementation. **Weak.**

### 6.2 A rollup dispute stack as a dependency

BoLD and Cannon are built to secure billions: bonds of hundreds to thousands of ETH, 6 to 7 day windows, one-step provers for WAVM and MIPS. Neither is an application library. Asterisc is the RISC-V one and calls itself highly experimental. **No.**

### 6.3 Bisection to a single tick

What it would need here:

- a trace root per level in the claim (a Merkle root over at most 2,700 state hashes), which the browser can compute during its replay;
- an interactive game of about 12 rounds per level (log2 of 2,700), each side with a clock;
- a single-tick referee: a new zk guest, or a Stylus entry point, that takes the 948-byte preimage, the level bytes and the journal, steps one tick and returns the next state hash;
- **a new consensus function in the core**, rebuilding a `Game` from the preimage, with its own vectors. Today the state hash is diagnostic and nothing reads a state back;
- a link from the final state to the Outcome, and a Solidity bisection contract of a few hundred lines with Merkle proofs.

What it would buy: a one-tick proof would be one to a few million cycles (a capture is about 0.5 million; the rest is hashing the two states and binding the journal), so tens of minutes on a CPU, against 1.9 to 3.8 hours for a level. The nearest measured point is the repo's smallest proof, a level that ends at tick 0: 1.3 million proving cycles, 2,128 s on a 2-vCPU runner, 460 s of it the Groth16 step. [I]; the one-tick guest was not built or measured. That gain does not pay for twelve interactive rounds, a second guest and a promoted state hash, when the level-mode proof already exists. Bisection earns its place only with a referee that needs no prover: tickproof's choice on Solana, and here Stylus. But with Stylus, re-executing a whole level in one transaction is simpler than bisecting. **Weak.**

### 6.4 Cartesi PRT or Dave

The model matches (a RISC-V machine, a replay, a permissionless tournament), and RIV, a Cartesi project, verifies recorded single-player game replays exactly this way. But the game would run inside the Cartesi Machine, a Linux RISC-V system: a third execution target for the core, on a framework whose fraud proofs I could confirm only on Ethereum mainnet, with a 0.232 ETH bond and week-long tournaments. **No.**

### 6.5 UMA, Truebit

UMA's floor bond is 0.11 WETH and its judge is a token vote. Truebit was drained in January 2026. **No.**

## 7. New attack surface

1. **An unchallenged false claim.** If no watcher lands a challenge in the window, a false score is recorded for good and takes pot share; without the score cap, almost all of it. This is the new trust assumption. Who watches: the operator's job; every qualified player, whose share a false claim dilutes; anyone, for half the claim bond. Watching costs milliseconds per run; challenging needs the challenge bond for up to the defence window.
2. **Honest players can now lose money, not just a settlement.** A challenged honest claim that nobody proves in time is voided and its bond goes to the challenger. Today the worst case is an unsettled run. A challenger who expects no defence profits from blind challenges. Mitigations: anyone may defend and is paid 55 times the market cost; a 48 h window so that a 4-core, 16 GB x86 machine can prove; a challenge bond at least as large as the claim bond.
3. **Proving-capacity exhaustion.** Each simultaneous challenge needs its own proof inside the window. One 4-core machine proves 3 to 5 runs in 48 h. Fifty challenges put 0.1 ETH at risk and overwhelm a CPU-only defender; the market is the burst capacity, and it has two provers. A voided run can still settle by the zk path until `end + grace`.
4. **The dispute backend can be switched off.** RISC Zero's emergency stop "can never be restarted" once stopped. [P] (S40) Without the `zkStop.paused()` refund, every challenge would then win by timeout. With it, challenged claims are refunded and void, and the season falls back to today's behavior under a stopped verifier: nothing settles and the pot rolls over. On 2026-11-10 the stop on Arbitrum One read `paused() = false`. [P] (S18)
5. **Divergence between targets now slashes.** If the browser's wasm and the RISC-V guest ever disagree on a run, an honest claim is unprovable and loses its bond. The vectors and differential fuzzing are the defence; the stake on them rises.
6. **A new contract that holds ETH.** Bonds, credits and pull payments need their own solvency invariant, reentrancy review and audit. `Challenge` still holds none.
7. **Cross-run and third-party claims,** closed by binding rules 1 and 2 of section 5.2, and **bait claims,** closed by rule 3. Each needs a test.
8. **Stuck states.** Every status needs a transition that returns or assigns both bonds: the lesson of the Base report. `timeout`, `resolve` and `release` must cover a run settled directly, a stopped verifier and a closed season.
9. **Censorship and outages** across a whole window. Covered up to the 24 h force-inclusion delay by a 36 to 48 h window, with an L1 transaction as the fallback, which costs L1 gas that only the operator is likely to pay.
10. **Self-challenge.** A cheater who challenges their own claim gains nothing: the claim then needs a proof that cannot exist. Burning half the slashed bond makes it cost something. Nobody can see a pending challenge on Arbitrum, so a cheater cannot take the single challenge slot in reaction to an honest one.
11. **Journals committed through a smart-account wallet** are in a trace, not in transaction input. Watchers need the same trace access the operator's rebuild already needs (README P5).
12. **A dispute path that never runs.** See the fire drill in 5.6.
13. **A referee whose answer depends on time.** `verifyRun` reverts before the window and returns after it. `Season.open` records the wrapper's codehash, which commits to its immutables: the inner referee, both bonds and both windows.

## 8. Precedents for games and applications

- **tickproof** (June 2026): optimistic settlement of real-time game results with bisection and native re-execution, on Solana devnet. A prototype. [P] (S34)
- **RIV / RIVES** (Cartesi): single-player games whose recorded inputs are replayed in a Cartesi Machine by a rollup node; the README says it is "under development". The Doom Olympics of September 2024 ran on it with a $15,000 pool. Whether fraud proofs or a single validator backed those results, I could not find. [P] (S35); [S], *old*
- **Godot Onchain** (2023, hackathon proof of concept): a gameplay log replayed on a Cartesi-hosted server to validate a high score. [P], *old* (S36)
- **Atari's Asteroids on Base** (August 2024): Stackr Labs put a score on the leaderboard without playing, because scores reached it through an API call. The counter-example: a prize leaderboard with no replay check. [S], *old* (S37)
- **Elympics "verifiable replays":** input-based replays of deterministic games used in dispute resolution; I found marketing pages only, no dispute procedure. [S] (S41)
- **Across and others on UMA:** applications that accept bonded offchain claims after a 2 h liveness; UMA says its optimistic oracle resolves 99.8 % of requests without escalation. [P] (S31)

I found no production game that settles replays optimistically with permissionless challenges and bonds.

## 9. Options, most promising first

| # | Option | Fit | One line |
|---|---|---|---|
| 1 | `OptimisticReferee` wrapper: claim, one challenge, defence by the existing zk `settleRun` | strong | Deployable today in Solidity alone; 29 % of the fee instead of 69 %; adds bonds, a 4-day grace and the watcher assumption. |
| 2 | Stylus re-execution of the disputed level as the dispute backend | possible | The only variant that removes the prover; blocked by the activation pause and the proposed audit gate. |
| 3 | Claim path inside `Challenge` | possible | 9 % of the fee; needs a new `Challenge` and `Season`, and `Challenge` would hold the bonds. |
| 4 | Per-level challenges with the level-mode proof | possible | Cuts a defence from 9–17 h to 2–4 h; more state; a refinement of 1. |
| 5 | Fault proof from either side, no deadline (Kailua's shape) | weak | Needs a guest that proves rejection; fails unsafe under load; reference implementation unmaintained. |
| 6 | Bisection to one tick | weak | Twelve rounds, a second guest and a consensus-grade state restore, to save hours that option 4 already saves. |
| 7 | Cartesi PRT or Dave | no | A third target and a framework; fraud proofs confirmed on Ethereum only. |
| 8 | BoLD, Cannon or Asterisc as a dependency | no | Rollup-scale bonds and code; Asterisc experimental. |
| 9 | UMA OOv3 | no | 0.11 WETH minimum bond; token vote. |
| 10 | Truebit or opML-style games | no | Truebit exploited in January 2026; no usable Arbitrum deployment found. |

## 10. What I could not verify

- Whether the OP Stack `ZKDisputeGame` (type 10) is deployed on any mainnet chain; the spec gives no deployment.
- Celo's bond and window values from Celo's own documents; they come from L2BEAT.
- When and why Boundless made the Kailua repository read-only, and whether MegaETH or SOON run Kailua's hybrid mode.
- BOB's return to the permissioned game on 2026-09-16 from a BOB source; it comes from L2BEAT, and BOB's docs page still describes Kailua.
- How long a raw Groth16 request takes to be fulfilled on Boundless; the repo says "in minutes" and I found no measurement.
- A complete Arbitrum One sequencer incident history for 2024 to mid-2026; the June 2023 incident's duration; the January 2022 outage from Offchain Labs' own post-mortem. I read search summaries, not the Cointelegraph and Decrypt articles themselves.
- The activation date of priority gas auctions on Arbitrum One.
- The result of the Stylus Activation Contract temperature check, and whether Arbitrum Sepolia is covered.
- Whether Cartesi's PRT or Dave consensus is deployed on Arbitrum One; RIVES's consensus model and current status.
- The gas of the proposed wrapper: estimated from the repo's measurements and the EVM gas schedule, not measured.
- The cycle count and proving time of a one-tick guest: it was not built.
- The current state of Truebit's verification game and of ORA's opML.
- A cloud price for 9 to 17 hours of 4-core proving; I used none.

## 11. Sources

| Id | Source | Date | Kind |
|---|---|---|---|
| S1 | https://specs.optimism.io/fault-proof/stage-one/zk/zk-dispute-game.html | undated; `ZKDisputeGame` 2.1.0 | P |
| S2 | https://succinctlabs.github.io/op-succinct/fault_proofs/fault_proof_architecture.html | undated | P |
| S3 | https://succinctlabs.github.io/op-succinct/fault_proofs/deploy.html | undated | P |
| S4 | https://succinctlabs.github.io/op-succinct/fault_proofs/bond_economics.html | undated | P |
| S5 | https://blog.succinct.xyz/op-succinct-lite/ | 2025-02-20, old | P |
| S6 | https://forum.celo.org/t/jello-hardfork-successfully-activates-on-mainnet-introducing-op-succinct-lite/12754 | 2025-12-10 | P |
| S7 | https://ethbeat.org/scaling/projects/celo (where l2beat.com redirects) | data to 2026-11 | S |
| S8 | https://boundless-xyz.github.io/kailua/print.html | undated; RISC Zero 3.0.6 in examples | P |
| S9 | https://github.com/boundless-xyz/kailua and https://raw.githubusercontent.com/boundless-xyz/kailua/main/README.md | read 2026-11-10 | P |
| S10 | https://docs.gobob.xyz/docs/bob-chain/hybrid-chain | undated, © 2026, possibly stale | P |
| S11 | https://ethbeat.org/scaling/projects/bob | events to 2026-11-06 | S |
| S12 | https://reports.immunefi.com/base/75108-sc-low-permanent-freezing-of-proposer-bond-when-proof-threshold-2-and-a-challenged-tee-proof-s | 2026-04-27 | S |
| S13 | https://docs.arbitrum.io/sequencer | © 2026 | P |
| S14 | https://docs.arbitrum.io/launch-orbit-chain/configure-your-chain/advanced-configurations/bold | undated | P |
| S15 | https://docs.arbitrum.io/how-arbitrum-works/bold/bold-economics-of-disputes | undated | P |
| S16 | https://docs.arbitrum.io/how-arbitrum-works/bold/gentle-introduction | undated | P |
| S17 | https://ethbeat.org/scaling/projects/arbitrum | liveness data to 2026-11-10 | S |
| S18 | Onchain reads: Ethereum block 26,384,828 through https://ethereum-rpc.publicnode.com (SequencerInbox `0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6`, the address listed at https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses : `maxTimeVariation()`, `isDelayBufferable()`, `buffer()`); Arbitrum One block 522,990,309 through https://arb1.arbitrum.io/rpc (base fee; UMA OOv3 `getMinimumBond`, `defaultLiveness`, `burnedBondPercentage`; RISC Zero emergency stop `paused()`) | 2026-11-10 | P |
| S19 | https://status.arbitrum.io/clq6te1l142387b8n5bmllk9es | 2023-12-15, old | P |
| S20 | https://status.arbitrum.io/ and https://status.arbitrum.io/history/1 | Sep to Nov 2026 | P |
| S21 | https://cointelegraph.com/news/arbitrum-network-suffers-minor-outage-due-to-hardware-failure (search summary only) | January 2022, old | S |
| S22 | https://docs.arbitrum.io/how-arbitrum-works/timeboost/gentle-introduction and https://docs.arbitrum.io/how-arbitrum-works/timeboost/how-to-use-timeboost | 2026 | P |
| S23 | https://forum.arbitrum.foundation/t/constitutional-aip-transition-arbitrum-one-ordering-policy-to-priority-gas-auctions-pga/30942 | 2026-06-03, updates to 2026-08-17 | P |
| S24 | https://forum.arbitrum.foundation/t/2-november-2026-roundup-of-active-upcoming-votes/31631 ; https://cryip.co/?p=21895 | 2026-11-02 ; 2026-11-04 | P ; S |
| S25 | https://docs.optimism.io/stack/fault-proofs/explainer ; https://specs.optimism.io/fault-proof/stage-one/bond-incentives.html ; https://specs.optimism.io/fault-proof/stage-one/fault-dispute-game.html | undated | P |
| S26 | https://www.theblock.co/post/311702/optimism-foundation-disables-permissionless-fraud-proofs-plans-hard-fork-following-security-audits | 2024-08-17, old | S |
| S27 | https://github.com/ethereum-optimism/asterisc | read 2026-11-10 | P |
| S28 | https://docs.cartesi.io/fraud-proofs/ (2025-09-26) ; https://docs.cartesi.io/fraud-proofs/prt/prt-introduction/ ; https://docs.cartesi.io/fraud-proofs/honeypot/introduction/ (2025-12-17) ; https://docs.cartesi.io/cartesi-rollups/2.0/deployment/introduction/ (2026-08-21) | as given | P |
| S29 | https://ethbeat.org/scaling/projects/cartesi-prt-honeypot-v2 | events to 2026-10-01 | S |
| S30 | https://arxiv.org/abs/2411.05463 | 2024-11-08, old | P |
| S31 | https://docs.uma.xyz/resources/network-addresses ; https://docs.uma.xyz/developers/setting-custom-bond-and-liveness-parameters ; https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work ; https://raw.githubusercontent.com/UMAprotocol/protocol/master/packages/core/networks/42161.json | undated | P |
| S32 | https://www.theblock.co/post/384861/truebit-26-million-exploit | 2026-01-08 | S |
| S33 | https://arxiv.org/abs/2401.17555 | 2024-01-31, old | P |
| S34 | https://tickproof.vercel.app/paper | June 2026 | P, self-published prototype |
| S35 | https://github.com/rives-io/riv ; https://decrypt.co/249402/doom-olympics-game-competition-ethereum-base-cartesi (search summary only) | read 2026-11-10 ; September 2024, old | P ; S |
| S36 | https://rolluplab.cartesi.io/godot-onchain/ | 2023-10-20, old | P |
| S37 | https://www.theblock.co/post/309665/stackr-hacks-atari-game-to-disprove-onchain-claim | 2024-08-06, old | S |
| S38 | https://www.coinbase.com/developer-platform/discover/protocol-guides/guide-to-brevis (search summary only) | unknown | S |
| S39 | https://arxiv.org/abs/2312.01549 (search summary only) | December 2023, old | S |
| S40 | https://raw.githubusercontent.com/risc0/risc0-ethereum/v3.0.1/contracts/src/RiscZeroVerifierEmergencyStop.sol | tag v3.0.1 | P |
| S41 | https://www.elympics.ai/products/verifiable-replays (search summary only) | unknown | S |
| S42 | https://www.theblock.co/post/340278/offchain-labs-releases-arbitrum-bold-on-mainnet-for-permissionless-validation (search summary only) | 2025-02-12, old | S |
| S43 | Repository: `README.md` §7.2, §7.3, §7.5, §8.4; `docs/VERIFICATION.md`; `docs/ECONOMY.md`; `contracts/src/Challenge.sol`, `Season.sol`, `ZkReferee.sol`, `interfaces/IReferee.sol`, `RunDerivations.sol`; `core/src/hash.rs`, `core/src/game.rs`; `referee/zk/README.md`; `seasons/testnet-0.json` | measurements of 2026-11-02 | P |
