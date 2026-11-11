# Red-team notes: liveness, censorship and timing

Review of the three optimistic-settlement designs (`minimal.md`, `trust.md`, `browser.md` in this directory), written 2026-11-10 against the repository at `f52a60a`. The repository was only read. Everything I wrote is under `design/redteam-liveness-work/` and this file.

Tags on numbers and claims:

- **[R]** measured or stated in the repository;
- **[L]** given by the lead (task context and addendum), not rechecked;
- **[D]** stated or measured by a designer (document or prototype);
- **[T]** tested by me today on a copy of a designer's prototype or model (section 9);
- **[X]** read today in an external document;
- **[E]** my estimate or inference.

## 0. Result

1. **Under this lens an optimistic path is worse than the owner's direction** (a validity proof for every paid-out run, made in minutes on a GPU by an open paid service). The owner's direction has no window, no watcher, no bond and no keeper transaction; a censoring sequencer, a paused verifier or an absent prover can only delay or withhold a payout. Each optimistic design adds a party that must land a transaction inside every window for the pot to be safe, and still needs the prover for disputes.
2. **Best of the three under this lens: `trust`.** It is the only one in which an honest claim can never be slashed, its window is the only one that survives a 24 h censorship with days to spare, its window floors are contract constants, and a voided claim restores the player's earlier result without anyone sending a transaction. Its costs: payouts 8 days later than today's proposal, wrong claims that cost nothing to try, a claimed score with no cap, and no Solidity (only a Python model).
3. **`browser` and `minimal` fail the task's check "an honest claim can never be slashed"**, by design: a challenged honest claim loses its bond whenever no proof lands in time, and the challenger is paid for it.
4. **Two findings were not in the designers' lists and are confirmed on the `browser` prototype [T]:** a better claim puts a player's already-safe or already-proven result at risk, and a claim made at the cutoff has no proof fallback at all.

The twelve issues, most severe first (details in section 4):

| # | Issue | Designs | Severity |
|---|---|---|---|
| 1 | Safety is one watcher transaction per window; a single lapse pays a forger for good | all | fatal |
| 2 | An honest claim is slashed whenever no proof lands in time, and the challenger is paid for it | browser, minimal | fatal |
| 3 | A paused verifier turns every claim still in its window into a sure win for its challenger | all | high |
| 4 | A better claim puts a player's safe or proven result at risk [T] | browser | high |
| 5 | With the operator gone, the silence that pays an honest claim pays a forged one first | all | high |
| 6 | A 24 h censorship leaves 12 h or 24 h to reach L1 by hand; clock lag can take 24 h more | browser, minimal | medium |
| 7 | Keeper transactions, bonds locked to the season's end, journals that watchers cannot read | minimal | medium |
| 8 | Claims near the cutoff have no proof fallback, and those hours are the forger's best [T] | all | medium |
| 9 | A defense fits the window only on a GPU; on CPU or Stylus some honest claims cannot be defended | all | medium |
| 10 | A missed wrong claim cannot be undone by a proof, although proofs now take minutes | all | medium |
| 11 | The contract accepts a one-second window; the floor is left to the page | browser, minimal | low |
| 12 | A run can be claimed twice with other results; a self-challenge hides a forged claim during its window [T] | browser, trust | low |

## 1. What I read and ran

- **Read:** `contracts/src/Challenge.sol`, `Season.sol`, `ZkReferee.sol`, `interfaces/IReferee.sol`, `RunDerivations.sol`, `ArbBlockhashEntropy.sol`; `referee/zk/guest/src/lib.rs` and `bin/verify.rs`; `core/src/replay.rs`, `journal.rs`, `hash.rs`, `game.rs`; README §6.3, §6.4, §7, §8.2, §8.4; `docs/ECONOMY.md` §1 to §3; `docs/VERIFICATION.md` (proving, verification gas, prover network); `web/src/chain/calldata.ts`; `seasons/testnet-0.json`. The three specifications in full; the two Solidity prototypes (`minimal-proto/`, `proto/contracts/`) and the Python model of `trust` (`measure/model.py`). The lead's research notes `research/optimistic.md` §4 (Arbitrum's inbox parameters), `research/risc0-gpu.md` §0, `research/proof-services.md` (the stop's owner) and `audit/cost.md` §6.
- **Ran:** 8 scenario tests on copies of the two prototypes and 3 scenarios on the model; all behave as this document says (section 9). No change to the designers' files. `referee/zk` was not built and Docker was not run.
- **External fact checked [X]:** Arbitrum's documentation page "Block numbers and time" (docs.arbitrum.io), for the bounds on L2 timestamps and the timestamp of a force-included message.
- **`trust` has no contract code.** My checks of it are checks of its specification and of its model. An implementation can still get a boundary wrong.

## 2. Facts this review rests on

| Fact | Value | Tag |
|---|---|---|
| Force-inclusion delay on Arbitrum One | `delayBlocks` 7,200, `delaySeconds` 86,400: 24 h. A delay buffer exists and is full, so 24 h is today's figure and can only shrink after sustained delays | L (`research/optimistic.md` §4, read onchain by its author) |
| L2 timestamps the sequencer may assign | at most 24 h earlier than L1 time and at most 768 s later (the public documentation says one hour); never below the previous L2 block's | L for 768 s, X for the rest |
| Timestamp of a force-included transaction | the larger of the L1 time at which it entered the delayed inbox and the previous L2 block's timestamp | X |
| `block.timestamp` in the contracts | the L2 timestamp: every window, `settlementEndOf` and the commit deadline are measured in it | R (`Challenge.sol`, `Season.sol`) |
| RISC Zero's emergency stop | `estop()` by its owner, or by anyone with a proof of the all-zero claim; "Once stopped, this contract can never be restarted" | R (`docs/ECONOMY.md` §3); the quoted sentence is from the wrapper's source, read in the copy of `risc0-ethereum` under the lead's `escrow/proto` |
| Who controls the stop's owner key since the vendor's pivot | not found | L (addendum 2) |
| Proof market | closed since 2026-11-05; no other seller of a RISC Zero 3.0 Groth16 proof found | L (addendum 2) |
| CPU proving, 4 CPUs | 338 to 467 s per 2^20-cycle segment with recursion, then 150 to 172 s of Groth16 in Docker, 9.2 GiB | R, L |
| GPU proving | about 0.9 s per segment and 2 s of Groth16 on an RTX 5090; needs x86-64 Linux, an NVIDIA card of 16 GB or more at default settings; nothing measured on this guest | L (addendum 1) |
| Cycles per level | owner's play 2.4M to 3.0M; gate-set journals 14M to 31M; a cautious level of 150 small captures about 50M; scripted one-cell captures 149M to 510M; true bound about 0.76 billion | R, L (`audit/cost.md` §6) |
| A journal or level that replay rejects | the guest panics: no proof of anything exists for it | R (`referee/zk/guest/src/bin/verify.rs`) |
| `commitRun` never parses journals | six empty byte strings commit | R (`Challenge.sol`), T |
| Journals of a commit made by a contract | readable only through `debug_traceTransaction` when the outer calldata does not embed the call | R (`web/src/chain/calldata.ts`) |
| Mean run score of the reference mix | 65,682.7 points; the largest score six `uint16` level scores can sum to is 393,210 | R (`docs/ECONOMY.md` §5, README §7.2) |
| A first-time prover | builds `zk-host` in about an hour (62 min 35 s on a 2-vCPU runner), must reproduce the pinned image id (it depends on the build path), and on CPU must pull a 5.2 GB image that only Docker Hub serves (it answered 429 twice in the repository's own trials) | R (`docs/VERIFICATION.md`) |

Proving times I derive from the two rates [E]:

| Proof | Segments | 4 CPUs | RTX 5090 |
|---|---:|---|---|
| A level in the owner's style (2.4M to 3.0M cycles) | 3 | 19 to 26 min | seconds |
| A heavy gate-set level | 15 to 31 | 1.5 to 4.1 h | under 1 min |
| A cautious level, 50M cycles | 48 | 4.5 to 6.2 h | under 1 min |
| A legal worst-case level, 0.76 billion cycles | 725 | 68 to 94 h | about 11 min; 1 to 2 h on a 16 GB card of the RTX 4060 Ti class |
| A run in the owner's style (15M to 18M) | 15 to 18 | 1.5 to 2.4 h | seconds |
| The heaviest gate-set run (137M) | 131 | 12 to 17 h | about 2 min |
| A legal worst-case run (2.9 billion) | 2,766 | 11 to 15 days | about 42 min |

## 3. The timelines

T is the season's end. Values are the ones each designer proposes.

| | minimal | trust | browser | Owner's direction |
|---|---|---|---|---|
| Claim accepted until | T + 24 h | T + 72 h | T + 4 h | no claim |
| Window for a challenge | 48 h | 96 h | 36 h | none |
| Proof of a challenged honest claim due | T + 120 h (end + grace), at least 48 h after the dispute | 72 h after the accusation | 36 h after the challenge, or later if the challenger has not resolved | any time until end + grace |
| What the proof is | the whole run, or six levels | the accused level | the challenged level | the whole run |
| Honest claimant's bond | 0.0005 ETH | none | 0.0003 ETH | none; a bounty of 0.00002 to 0.00003 ETH, refunded if unsettled |
| Lost when | no proof by end + grace | never | no proof before the challenger resolves | never |
| Challenger's stake, locked for | 0.0005 ETH, until end + grace: up to 19 days [T] | 0.00005 ETH, 72 h | 0.0003 ETH, 36 h | none |
| Keeper transaction on the honest path | `finalizeRun`, between the window's end and end + grace | none | none (`reinstate` after a void) | `settleRun` with the proof |
| Grace | 5 days | 10 days | 76 h | 48 h proposed [R] |
| Finality of an honest result | 48 h, then a transaction | 96 h | 36 h | minutes |
| Floors on the windows | none (1 s) | constants: 48 h and 24 h | none in the contract; the page checks the challenge window only | not applicable |

## 4. The issues

### 1. Safety is one watcher transaction per window; a single lapse pays a forger for good (all, fatal)

**What the designs say themselves:** an unchallenged wrong claim is paid. What this lens adds is how easy the lapse is to find and how complete the loss is.

- **The attacker chooses the moment.** The cutoffs for claims fall after the season's end (T + 4 h, T + 24 h, T + 72 h), and the windows run through the grace period, when nobody is playing and few tabs are open. The watcher that remains is the operator's scheduled job: its schedule is a workflow file, its results are public on a public repository, and its wallet balance is public onchain. Scheduled workflows on the hosting service can also be delayed, dropped under load, or switched off after 60 days without repository activity (from the service's documentation, not rechecked today).
- **The forged claim has no proof against it.** `commitRun` stores a hash and parses nothing [R], so the forger commits six empty journals [T]. Replay rejects them, the guest panics, and no proof of any Outcome exists [R]. After the window nothing can touch the claim (issue 10).
- **The loss is the pot.**
  - `minimal`: `proposeRun(runId, uint32 score, uint32 ticks, uint8 clears)` has no bound. A proposal of 4,294,967,295 points on empty journals, finalized after 48 h, took more than 99.998 % of the players' pot against an honest run of about 48,000 points [T].
  - `trust`: the claimed `levelScore` values are `uint32` and only their sum is bounded by `uint32`; the specification has no cap. Same result [E].
  - `browser`: a level score is a `uint16`, so one claim is at most 393,210 points, six times the reference mix's mean run [R]. That bounds one claim, not the loss: wallets are free. In the designer's own illustration (200 players, 1,500 runs, players' pot 0.0675 ETH), 1,000 forged claims during one 36 h outage hold 393 million points against the honest 13 million: 97 % of a pot that now includes the forger's 0.05 ETH of fees, a net gain of about 0.05 ETH. The 0.3 ETH of bonds comes back [E].
- **A failed try is cheap.** `trust`: about 0.00006 ETH, a run fee and gas [D], with no bond. A forger can keep one wrong claim in flight for a whole 17-day claim period for about 0.001 ETH [E] and wins the first time the watcher misses 96 consecutive hours. `browser`: 0.00035 ETH per try. `minimal`: 0.00055 ETH per try.
- **The watcher's wallet can be emptied first** (designers' own weakness): each challenge locks a stake for 36 h, 72 h, or until end + grace.

**Comparison.** Today, and under the owner's direction, no absence of anybody causes a wrong payout.

**Fix.** None inside an optimistic design. Mitigations: a window of 96 h or more; a cap on the claimed score (393,210 per run is a type bound already written in README §7.2, not a rule of the core); two independent, funded watchers with an L1 fallback; canary claims (`trust` §3.7). Only a proof per paid run removes the issue.

### 2. An honest claim is slashed whenever no proof lands in time, and the challenger is paid for it (browser, minimal, fatal)

The task asks to check that an honest claim can never be slashed. Result:

| Design | Can an honest claimant lose money? | When |
|---|---|---|
| trust | No. There is no claimant bond; an unanswered accusation only voids the claim, and the accuser takes back the deposit. | never |
| browser | Yes: 0.0003 ETH, six run fees, to the challenger | `resolveChallenge` after 36 h with the challenged level not settled (`Challenge.sol` of the prototype, `resolveChallenge` and `reject`) |
| minimal | Yes: 0.0005 ETH, ten run fees, to the disputer | `finalizeRun` after end + grace with the run unsettled |

Ways to reach it, none of which needs the claim to be wrong:

- **No prover for 36 h (browser).** The proof market is closed [L]. The prover of last resort is one home GPU or a 4-CPU machine. A weekend power cut is enough.
- **More challenges than proving capacity.** On 4 CPUs one machine defends 9 to 24 heavy levels in 36 h [E, D]. Past that, each further challenge is a gain of 0.0003 ETH for 165,224 gas (0.0000033 ETH) [D].
- **The verifier is paused** (issue 3).
- **The defense transaction is censored** (issue 6): 12 h of margin in `browser`.
- **A heavy honest journal** (issue 9).
- **`minimal`, one proof short.** A disputed true proposal with five of its six level proofs landed at end + grace pays both bonds to the disputer [T].
- **A reorg between reveal and commit.** The run nonce comes from an L2 block hash [R]. If the reveal is re-executed after a reorg, the nonce changes, the journals carry the old one, and the claim, sent by the same signed transaction, is now false. `trust` loses nothing; `browser` and `minimal` lose the bond. Very unlikely on Arbitrum; noted for completeness [E].

**It pays, and it scales.** 200 standing claims are 0.06 ETH in `browser` and 0.1 ETH in `minimal`, against a rake of 0.0075 ETH for the same illustration season [D for the season, E for the product]. Equal bonds make the attack profitable when fewer than half the challenges are defended (designer's own figure).

**Whoever runs the only prover can farm it.** With the market closed, a dishonest or compromised operator challenges honest claims and does not defend them. Today the operator can only withhold proofs, which earns nothing. The `trust` designer names this as the reason for having no bond.

**Fix.** Never forfeit a claimant's bond on a timeout: void the claim and refund both sides, and forfeit only against a referee proof of another Outcome. The bond then deters very little, which is `trust`'s design.

### 3. A paused verifier turns every claim still in its window into a sure win for its challenger (all, high)

- The stop is permanent [R] and who controls its key is not known [L]. Anyone who can produce a proof of the all-zero claim can also trigger it [R].
- From the pause on, no challenge can be answered, for the rest of the season.
  - `browser`: every claim younger than 36 h can be challenged; 36 h later the challenger takes its 0.0003 ETH. Certain profit.
  - `minimal`: every proposal younger than 48 h can be disputed; at end + grace the disputer takes 0.0005 ETH. Certain profit.
  - `trust`: every claim younger than 96 h can be accused for about 80,000 gas [D]; the deposit comes back after 72 h. Nobody is slashed, but the veto is free.
- The pot is then shared among the claims that were already past their window (as the lead's addendum 7 says of settled runs today). So every player with a final claim gains by knocking out the others, and in two designs is paid to.
- The pages only warn or refuse new claims; claims already in their window are exposed.
- Under the owner's direction a pause stops new settlements and takes nothing from anybody; bounties are refunded.

**Fix.** In `resolveChallenge` and `finalizeRun`, read the stop's `paused()` and refund both bonds while it is true; refuse new claims onchain when paused. This makes a pause a free veto, as in `trust`, instead of a transfer. `research/proof-services.md` also suggests settling through the project's own copy of the verifier, with no stop; that removes the pause and the protection it gives.

### 4. A better claim puts a player's safe or proven result at risk (browser, high) [T]

Not in the designer's list. Two tests on a copy of the prototype:

1. **A safe claim is lost.**
   - Alice's claim A stands, long past its window. Bob has an honest claim.
   - At T − 1 h Alice claims a better run B with `commitAndClaim`. `record` sees that B replaced A in `Season` and `drop` deletes claim A.
   - Carol challenges a true level of B at the last second of its window (T + 35 h). `voidRun` deletes `bestRunOf[season][alice]`.
   - Alice calls `claimRun(A)`: it reverts `ClaimTooLate`, because the cutoff is T + 4 h.
   - Nobody proves the level within 36 h. Carol calls `resolveChallenge` at T + 71 h and takes Alice's 0.0003 ETH.
   - After the close Alice's `Season.claim` reverts `NotQualified`. She had a final, counted claim two days earlier.
2. **A proven run is lost.**
   - Alice's run P is settled by proof and recorded. She claims a better run B; Carol challenges it; `voidRun` deletes her best run.
   - P counts again only if someone calls `reinstate(P)` before `closeSeason`. Rivals have no reason to. After the close `reinstate` reverts `SeasonAlreadyClosed` and Alice is unpaid.

Today a settled run can never be lost by playing again. `trust` keeps the earlier result (`bestRunOf`) beside the pending one, so an accusation only removes the pending claim.

**Fix.** Keep the final or proven best run beside a pending claim, so that a void restores it with no transaction; do not delete a matured claim when a better one arrives.

### 5. With the operator gone, the silence that pays an honest claim pays a forged one first (all, high)

The task asks whether an honest player can always get paid if the operator disappears. No, in any design.

- The operator is the watcher, the defender of last resort, and the sender of `finalizeRun`, `reinstate`, `resolveChallenge` and `closeSeason`.
- **If nobody acts,** honest claims pass without a prover. So do forged ones, and they are larger (issue 1). The condition that pays the honest player is the condition that pays the forger.
- **If rivals act,** challenging an honest claim raises their own pro-rata share. In `browser` and `minimal` it also pays them the bond; in `trust` it costs gas only.
- **`minimal` needs one more thing:** somebody's `finalizeRun` between the end of the window and end + grace, or the undisputed run is not recorded (issue 7).
- **Owner's direction, same absence:** a run is paid if any GPU owner takes its bounty; if none does, nobody is paid, nothing is stolen, and bounties are refunded. A pot with no settled run rolls over to a season that is never opened, which is today's accepted residual [R].

**Fix.** None removes it. Reduce it: a one-command watcher and defender that anyone can run from the repository, the proof path open for every run so that an outside GPU prover can replace the operator, and no keeper transaction on the honest path.

### 6. A 24 h censorship leaves 12 h or 24 h to reach L1 by hand; clock lag can take 24 h more (browser, minimal, medium)

**What a sequencer that censors for the force-inclusion delay can do:**

| Target | minimal | trust | browser |
|---|---|---|---|
| A watcher's challenge: it must be in the L1 delayed inbox within | 24 h of the proposal | 72 h of the claim | 12 h of the claim |
| A defender's proof: it must be in the L1 delayed inbox within | 24 h of the dispute at worst (the deadline is end + grace) | 48 h of the accusation | 12 h of the challenge |
| What a missed deadline costs | a forged run recorded; or the honest bond and run | a forged claim final; or the honest claim void, no money lost | a forged claim standing; or the honest bond |
| A claim or proposal sent near the cutoff | pushed past T + 24 h: proof path only | pushed past T + 72 h: proof path only | pushed past T + 4 h: proof path only |
| `finalizeRun` or `reinstate` near the close | the run is not recorded | not applicable | the proven run is not counted |

- A force-included transaction executes at the L2 clock of the moment it is included [X], so the window check sees 24 h more than when the watcher sent it.
- **No design ships the tool.** `trust` lists "forced inclusion by hand" in its runbook; the other two list the need as an assumption. A browser tab cannot do it. The watcher key needs ETH on L1, and the two L1 transactions cost about 0.2 million L1 gas [E]: 0.0002 ETH per gwei of L1 base fee, which is four times `trust`'s deposit and most of `browser`'s reward.
- By hand, at night or on a weekend, 12 h is not a credible margin.
- **Clock lag.** L2 timestamps may lag L1 time by up to 24 h [X]. A sequencer that stalls the chain's clock, includes a forged claim at the lagging timestamp, lets the clock jump, then censors for 24 h, has compressed the window by 48 h [E]. A window is safe against that only above 48 h plus the watcher's reaction: `trust`'s 96 h is; `minimal`'s 48 h has no margin; `browser`'s 36 h is not. This needs a chain-wide fault lasting a day, so it is a bound, not an expected attack.
- **Clock ahead.** At most 768 s [L] (one hour by the documentation [X]): it shortens a window by minutes. Its effect on the commit deadline exists today and is an accepted residual [R].
- **Outages.** The longest found on Arbitrum One is about 7 h [L]; every window survives that.
- Under the owner's direction, censorship delays a settlement by 24 h and nothing else.

**Fix.** Windows of 72 h or more, as contract constants; an automatic L1 delayed-inbox fallback in the watch and defend scripts after an hour without inclusion; L1 ETH on the watcher key.

### 7. Keeper transactions, bonds locked to the season's end, journals that watchers cannot read (minimal, medium)

- **Finalization is a transaction somebody must send.** `finalizeRun` records an undisputed proposal only while settlement is open; after end + grace it only returns the bond (prototype, `finalizeRun`, `open` branch; the designer's own test covers it). Rivals gain by not sending it. With the operator's job absent, a player who does not come back at least 48 h after proposing and before end + grace loses the run without any notice.
- **A disputer's bond is locked until end + grace when the journals have no proof:** `finalizeRun` reverts `DisputeOpen` until then. For a dispute on the season's first day that is 19 days [T]. 100 empty-journal proposals freeze 0.05 ETH of watcher money for the season, at 0.00055 ETH each for the attacker. The watcher is paid in the end, if it had the capital.
- **No journals log.** `commitRun` is unchanged, so a commit made through a contract that builds the call internally can be read only with `debug_traceTransaction` [R], which public RPCs do not serve. A watcher without a tracing RPC then has two bad choices: skip the proposal, and a forged one passes; or dispute blindly, and a prover-equipped proposer of a true result collects its 0.0005 ETH, again and again. Tabs on a public RPC cannot check such a run at all.
- **The 48 h window is exactly 24 h of censorship plus 24 h** (issue 6), and the operator may set it to 1 s (issue 11).

**Fix.** Record the run at proposal time and remove it on dispute, or pay the finalizer from the bond; free the disputer after a fixed response period; emit the journals in an event at commit, as the two other designs do.

### 8. Claims near the cutoff have no proof fallback, and those hours are the forger's best (all, medium)

- **No pending claim survives the close in any design.** I checked each boundary: every window and defense period ends at or before `settlementEndOf`, and `closeSeason` needs a later timestamp. In the `browser` prototype, `resolveChallenge` still works after the close and no bond is stuck [T]. That part holds.
- **What does not hold is the advertised fallback.** `browser` says a rejected honest claim can still be recorded by a whole-run proof before end + grace. For a claim made at the cutoff (T + 4 h) and challenged at its last second, the defense window ends exactly at end + grace: `resolveChallenge` succeeds one second later and `settleRun` reverts `SettlementClosed` [T]. The fallback time is end + grace minus the challenge time minus 36 h, which is zero for the claims of the last four hours and small for those of the last day.
- **`trust`:** the grace is built as 24 h of late claims, 96 h, 72 h and 48 h of fallback, but `postOutcomes` only enforces that the two periods fit, so the cutoff is T + 72 h and claims posted after T + 24 h lose part or all of the fallback (the designer says so). During the 72 h defense period `settleRun` and `settleLevel` revert `OutcomesStand` [T on the model], so a run proof is useless until the claim is void.
- **`minimal`:** proposals stop at T + 24 h; a dispute always leaves 48 h for the proof.
- **The same hours favor the forger** (issue 1): the season is over, nobody is playing, and the windows of the last claims run entirely inside the grace period.
- **Payout delay.** Grace grows from the 48 h proposed today to 76 h, 5 days or 10 days. With GPU proofs in minutes, `trust`'s 72 h defense period could drop to its 24 h floor plus the forced-inclusion day, about 48 h, which still leaves a grace of about 8 days.

**Fix.** Have `open` enforce grace ≥ challenge + defense + fallback, and put the claim cutoff one fallback period earlier; the page must say that a late run settles by proof only.

### 9. A defense fits the window only on a GPU; on CPU or Stylus some honest claims cannot be defended (all, medium)

No design needs a fraud proof: all three put the proof on the claim's side, and that part of the brief's question is answered (a fraud proof of a rejected journal does not exist at all, and one of a worst-case legal journal would take days on a CPU). The question becomes whether the defense of an honest claim always fits its window.

- **On 4 CPUs:** a legal worst-case level takes 68 to 94 h [E]: beyond `browser`'s 36 h and at the edge of `trust`'s 72 h. Such a journal is the claimant's own, so nobody can impose it on an honest player; but small captures along the edge are the classic safe style of this genre (`audit/cost.md` §6), and a cautious level of about 50M cycles takes 4.5 to 6.2 h, so one machine defends 6 to 8 of them in 36 h.
- **On Stylus, if it returns:** the scripted heavy levels need 51M to 175M gas by the lead's fit, above the 32M cap. Such a level cannot be re-executed at all, so any challenge of it wins by default; `browser`'s plan for Stylus (reject or refute "in one transaction, from a browser") does not hold for them. A Stylus referee that has expired has the effect of a paused verifier until it is reactivated.
- **On a GPU:** minutes, and at most one to two hours for a worst-case level on a 16 GB card [L, E]. The owner's present card has 12 GB, below the default requirement [L]; nothing was measured.
- **A defender is not improvised:** an hour to build the host, a reproducible build at a fixed path to get the pinned image id, and on CPU a 5.2 GB image from a registry that rate-limited the repository's own trials [R].
- **Bond sizes rest on the closed market.** `trust`'s deposit of one run fee and `browser`'s challenge bond are derived from a market proof at 0.0000184 ETH. At the owner's GPU bounty of 0.00002 to 0.00003 ETH plus about 0.00001 ETH of gas, `trust`'s 0.00005 ETH still covers a defense 1.25 to 1.67 times [E]. `browser`'s Stylus sizing (11.6M gas for the heaviest level) is 4.8 to 16.5 times too low for legal journals [L].

**Fix.** Make a CUDA prover a stated requirement of any optimistic season, publish the guest ELF, size bonds from GPU bounty prices, and bound capture work in the core before any Stylus season.

### 10. A missed wrong claim cannot be undone by a proof, although proofs now take minutes (all, medium)

With GPU proving, a second line of defense is available in principle: anyone with a GPU proves the true Outcome of a wrong claim that the watchers missed, any time before end + grace.

- `browser` has it (branch B4) for journals that replay accepts.
- `trust` forbids it: `settleRun` and `settleLevel` revert `OutcomesStand` while a claim is open or final [T on the model]. A final wrong claim is immune for the rest of the season.
- `minimal`: a finalized proposal is `Settled`, and a settled run cannot be settled again [R]. A proof helps only before the forger's `finalizeRun`, which he sends one second after the window.
- **In all three, a claim on a journal that replay rejects has no proof at all** [R]. A competent forger always commits one; empty journals are enough [T]. So the second line does not exist where it matters.

**Fix.** Let a referee proof overturn a counted claim until end + grace, and have the guest commit the rejection code instead of panicking (the `trace` guest already does). The guest changes anyway under the owner's direction, for the payee word, so the new image id costs nothing more. With a worst-case legal journal the fraud proof is about 11 minutes on an RTX 5090 [E], and its deadline is end + grace, not a window.

### 11. The contract accepts a one-second window; the floor is left to the page (browser, minimal, low)

- `browser`: `Season.open` accepts a `defenseWindow` from 1 s (prototype, `checkClaimTerms`), and the page's season check covers the challenge window only (30 h). An operator, or a stolen operator key, opens a season with a 36 h challenge window and a 1 s defense window, challenges every claim and resolves two seconds later: 0.0003 ETH from each claimant, before any defense is possible.
- `minimal`: `disputeWindow` from 1 s. A proposal of 2^32 − 1 points is finalized two seconds later.
- The operator can already open a season whose referee lies, which players are expected to check against the build [R]. The new thing is that the parameter to check is a duration, and that in `browser` a wrong one takes a bond from each honest claimant.
- `trust` has constants: 48 h, 24 h, and a deposit cap of 4 run fees.

**Fix.** Put the floors in `Season` as constants and run test seasons on anvil with time travel, as `trust` proposes.

### 12. A run can be claimed twice with other results; a self-challenge hides a forged claim during its window (browser, trust, low) [T]

- **Second claim.** In `browser`, after a better claim drops run A, `claimRun(A)` accepts different results and starts a new 36 h window [T]. In `trust`, a claim withdrawn at hour 90 can be posted again with a wrong level, with a new window [T on the model]. A watcher that keeps one verdict per run id, for example in the page's IndexedDB cache, misses the second claim. `minimal` allows one proposal per run, ever.
- **Hidden claim.** In `browser`, a forger's accomplice challenges a true level: `voidRun` takes the claim off `Season` for the whole window. After the window he settles that level with a real proof; the claim is recorded again at the forged score, and `challenge` on the wrong level reverts `ChallengeWindowClosed` [T]. In `trust`, two staggered accusations of true levels (hours 0 and 71), defended at hours 72 and 143, keep a wrong claim uncounted through its 96 h window and final afterwards [T on the model]. A leaderboard built from `Season`'s events never shows the claim while it can be challenged. Watchers that read the claim events and keep checking challenged claims, as both specifications ask, are not fooled.

**Fix.** Key verdicts on the claim event, never on the run id; keep checking and showing challenged claims; when a refutation re-records a claim after its window, reopen a short challenge window for its unproven levels.

### Smaller points

- **`browser`: a rival with one level proof can block a claim.** `claimRun` reverts `SettlementStarted` once any level of the run is settled, and `settleLevel` is open to anyone. It costs the rival a level proof and about 0.00001 ETH of gas, and forces the run onto the full proof path. It applies to runs committed with plain `commitRun` and to runs whose claim was dropped.
- **Watcher incentives against window length.** `trust` has the longest window and the weakest reason for anyone but the operator to watch: a right accuser gets only the deposit back. `browser` pays the challenger but has the shortest window, and its bond of six run fees is more than a casual player's wallet holds.
- **The watcher's rhythm is public.** Its past challenges are onchain with their timestamps, so a forger can see how fast it reacts and whether it has reacted lately, without spending anything.

## 5. The lens questions, answered per design

| Question | minimal | trust | browser |
|---|---|---|---|
| A sequencer that censors for 24 h | 24 h left to force a dispute; 24 h at worst for a proof; `finalizeRun` can be pushed past the close | 72 h left to force an accusation; 48 h for a defense; nothing is slashed | 12 h left to force a challenge or a defense; a lost defense is a lost bond |
| A proof inside the window, CPU only, no market | whole run by end + grace: 1.5 to 17 h for ordinary and gate-set runs, 11 to 15 days for a worst-case one | one level in 72 h: yes up to about 50M cycles per level, not for a worst case | one level in 36 h: yes for ordinary levels, 6 to 24 levels per machine per window, not for a worst case |
| The same on a GPU | minutes; 42 min for a worst case | minutes; 11 min to 2 h for a worst case | the same |
| Verifier paused in a window | proposals under 48 h old lose 0.0005 ETH each to disputers | claims under 96 h old are vetoed for gas; no loss of money | claims under 36 h old lose 0.0003 ETH each to challengers |
| Windows across the close | none by construction; finalization must land before the close | none by construction; nothing to send | none by construction [T]; `reinstate` must land before the close [T] |
| Last-minute claims | until T + 24 h; 48 h of proof time always left | until T + 72 h; fallback shrinks to zero after T + 24 h | until T + 4 h; fallback zero at the cutoff [T] |
| Reorg | a changed nonce makes an honest proposal false: bond at risk | nothing at risk | a changed nonce makes an honest claim false: bond at risk |
| Timestamp skew | ahead: minutes. Lag plus censorship can eat the whole 48 h | ahead: minutes. Lag plus censorship leaves 48 h | ahead: minutes. Lag plus censorship exceeds the 36 h |
| Watchers offline for one window | whole pot (2^32 − 1 points) [T] | whole pot (no cap in the specification) | 393,210 points per wallet, and wallets are free |
| Operator disappears | players must finalize themselves; a disputed player needs an outside prover or loses 0.0005 ETH | a vetoed player needs an outside prover, loses nothing | a challenged player needs an outside prover within 36 h or loses 0.0003 ETH |
| Honest claim slashed? | yes | no | yes |

## 6. The designs under the corrected premises

| Premise (addendum) | Effect |
|---|---|
| 1. GPU proving in minutes | The defense periods (36 h, 72 h, "by end + grace") are no longer sized by proving; what remains in them is noticing, the forced-inclusion day and the prover being switched on. `minimal`'s main stated weakness, a whole-run proof per dispute, disappears. `trust`'s reason for rejecting fraud proofs (42 to 60 CPU-hours for a crafted level) weakens to minutes on a GPU, but a fraud-proof design would make safety depend on a GPU being online in every window, which is worse than a watcher. The saving an optimistic path offers shrinks to 0.00002 to 0.00003 ETH per player and season. |
| 2. Proof market closed | Every bond and deposit sized from "0.0000184 ETH per proof" has lost its basis. The defender of last resort is one machine. `browser` and `minimal` then let whoever runs that machine collect honest bonds (issue 2). |
| 3. Unbounded replay cost | Confirms that the challenger must not be the one who proves. It also means some legal honest claims cannot be defended in time on a CPU, and not at all on Stylus (issue 9). |
| 4. Ordinary play is light | On a CPU, a level in the owner's style defends in 19 to 26 minutes, so single disputes of ordinary play fit every window; mass disputes do not. |
| 5. A referee-only variant | `trust` and `browser` cannot be built that way: both need `Season` to count a claim at once and to stop counting it on a challenge. Only a `minimal`-like scheme fits behind `IReferee` (claim, window, then `settleRun` returns the matured Outcomes). It keeps the deployed generation and its rollover, but it inherits `minimal`'s timing problems: a settlement transaction that somebody must land between the window's end and end + grace, with 7 to 26 KB of calldata, and no `Season.open` check that the windows fit the grace. |
| 6. State hash is test-only | No effect: none of the three uses checkpoints or bisection. |
| 7. A stop shares the pot among those already settled | The same holds for claims already final, and it gives every such player a reason to knock out the claims still in their window (issue 3). |
| 8. The owner's direction | Section 7. |

## 7. Against the owner's direction

| | Owner's direction | Any of the three |
|---|---|---|
| A wrong payout needs | a broken proof system | one window without a watcher's transaction |
| An honest player is paid if | any GPU prover takes the bounty before end + grace | nobody challenges; or a prover answers inside the defense period; `minimal` also needs a finalization |
| An honest player can lose | nothing; the bounty is refunded if the run is unsettled at the end | 0.0003 ETH (`browser`) or 0.0005 ETH (`minimal`); nothing in `trust` |
| A sequencer censoring 24 h | delays a settlement | can decide a dispute in `browser`, and in `minimal` with clock lag |
| Verifier paused | no new settlement; nothing taken | claims in their window are knocked out, for a profit in two designs |
| Operator gone | paid if an outside prover exists; otherwise nobody is paid and nothing is stolen | the first forger is paid |
| Time to a final result | minutes | 36 h, 48 h plus a transaction, or 96 h |
| Payout after the season's end | 48 h | 76 h, 5 days or 10 days |
| Player's cost | 0.00002 to 0.00003 ETH per season, for the best run [L] | 0.0000033 to 0.0000047 ETH per claim [D], and a bond of 6 or 10 run fees locked 36 or 48 h in two designs |
| Things to operate | a prover | a prover for disputes, a watcher with a funded hot key (about the pot in `browser`, two to three times the season's fees in `trust`), an L1 fallback, and keepers |
| Contracts | `Challenge` and `Season` unchanged; one public word in the guest and `ZkReferee` | a new generation of `Challenge` and `Season`; `Challenge` holds ETH for the first time |

The optimistic path saves each paying player about 0.00002 ETH per season, 40 % to 60 % of one run fee. It does not remove the prover, and it adds the watcher.

## 8. If an optimistic path is built anyway

In order of what this lens asks for:

1. No forfeiture of a claimant's bond on a timeout (issue 2). That is `trust`'s rule.
2. The earlier final or proven result stays beside a pending claim (issue 4). That is `trust`'s `pendingRunOf`.
3. A cap on the claimed score, 393,210 per run (issue 1).
4. Window floors as constants, at least 72 h for the challenge window (issues 6 and 11).
5. A referee proof can overturn a counted claim until end + grace, and the guest commits rejections (issue 10).
6. No keeper transaction on the honest path; journals in a log (issue 7).
7. Refunds instead of forfeits while the verifier is paused (issue 3).
8. The watch and defend scripts fall back to the L1 delayed inbox by themselves (issue 6).
9. A cutoff that leaves the proof fallback (issue 8).

Items 1, 2, 4 and 6 are already in `trust`. It would need items 3, 5, 8 and 9, and its contracts written and tested.

## 9. Tests

Copies of the prototypes and my test files are under `design/redteam-liveness-work/`. forge 1.8.6 from `design/tools/`, solc 0.8.28, offline.

**`browser` prototype,** `browser/contracts/test/RedTeamLiveness.t.sol`, 5 tests, all pass:

| Test | Shows |
|---|---|
| `test_RedTeam_ALateUndefendedChallengeOfABetterClaimLeavesAPlayerWhoHadASafeClaimWithNothing` | issue 4, first case |
| `test_RedTeam_AProvenRunDisplacedByAChallengedClaimEarnsNothingIfNobodyReinstatesItBeforeTheClose` | issue 4, second case |
| `test_RedTeam_AClaimMadeAtTheCutoffAndChallengedAtTheLastSecondHasNoProofFallbackLeft` | issue 8; also that `resolveChallenge` works after `closeSeason` |
| `test_RedTeam_ADroppedRunCanBeClaimedAgainWithOtherResultsUnderANewWindow` | issue 12, second claim |
| `test_RedTeam_AForgedClaimChallengedOnATrueLevelByItsAuthorIsOffTheRankingForItsWindowThenStands` | issue 12, hidden claim |

```bash
cd design/redteam-liveness-work/browser/contracts
HOME=$PWD/../../home FOUNDRY_SOLC=/root/.local/share/svm/0.8.28/solc-0.8.28 FOUNDRY_OFFLINE=true \
  PATH=$PWD/../../../tools:$PATH forge test --match-contract RedTeamLivenessTest
```

**`minimal` prototype,** `minimal/test/RedTeamLiveness.t.sol`, 3 tests, all pass:

| Test | Shows |
|---|---|
| `test_RedTeam_AnUndisputedProposalOfTheLargestScoreOnEmptyJournalsTakesAlmostTheWholePot` | issue 1: empty journals commit, 2^32 − 1 points are recorded, more than 99.998 % of the players' pot is paid |
| `test_RedTeam_ADisputedTrueProposalWithFiveOfSixLevelProofsAtTheSettlementEndPaysTheDisputer` | issue 2 |
| `test_RedTeam_ADisputersBondOnAnEmptyJournalProposalStaysLockedUntilTheSettlementEnd` | issue 7: 19 days |

```bash
cd design/redteam-liveness-work/minimal
HOME=$PWD/home ../../tools/forge test --match-contract RedTeamLivenessTest
```

**`trust` model,** `trust/scenarios.py`, run against the designer's `measure/model.py`:

| Scenario | Output |
|---|---|
| `hidden_then_final` | not counted during the 96 h window; counted at hour 143; final at hour 144; accusing the wrong level then: "window over"; `settle_run` with the truth: "outcomes stand" |
| `free_veto` | `settle_run` during the defense period: "outcomes stand"; the rival's deposit is back after hour 168; the run cannot be claimed again; a run proof records it afterwards |
| `repost_other_results` | a claim withdrawn at hour 90 is posted again with a wrong level, counted, with a window starting at hour 90 |

```bash
python3 -I design/redteam-liveness-work/trust/scenarios.py design/measure/model.py
```

## 10. Not verified

- Nothing was run against `ZkReferee`, a real proof, a paused stop or a Stylus node: the prototypes settle through `MockReferee`. The pause scenarios follow from the code paths (a reverting `verify` is an undefended challenge) and from the stop's source.
- `trust` has no Solidity; only its specification and model were checked.
- The 24 h force-inclusion delay and the 768 s bound are the lead's onchain reads; I checked only the documentation's wording of the timestamp rules.
- The L1 gas of a forced inclusion (about 0.2 million) and every proving time in section 2 are my estimates from the stated rates; no proof was made.
- The hosting service's behavior for scheduled workflows is from memory of its documentation.
- GPU figures are third-party measurements on other guests [L]; the owner's 12 GB card is below the stated default requirement.
