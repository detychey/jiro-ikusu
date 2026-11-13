# Minimal optimistic settlement: a proposed result, and a proof only on dispute

Designer priority: the smallest change that works. Written 2026-11-10 against `main` at `f52a60a`. The repository is unchanged; the design was prototyped in a copy (§12).

Provenance tags used for numbers: **[R]** measured in the repository's documents, **[P]** measured on this design's prototype, **[L]** measured by the lead (task context), **[E]** my estimate.

## 0. Verdict

An optimistic path is a good idea under this priority, on one condition the owner must accept: the result of an undisputed run is no longer checked by anything onchain. It is checked by whoever watches, and at least one watcher must act within the dispute window.

- **Change:** 3 functions and 1 mapping in `Challenge`, 2 season parameters and 1 view in `Season`. 123 added lines of Solidity, no line removed or changed **[P]**. Nothing changes in the guest, the core, `ZkReferee`, `IReferee` or the Stylus referee. The image id stays.
- **Normal case:** no proof at all. 232,241 gas for the two new transactions **[P]**, 0.0000047 ETH at 0.020036 gwei, 9.3 % of the run fee, against 0.0000345 ETH and 69 % today **[R]**. Zero hours of proving against 9 to 17 hours on 4 CPUs **[R]**.
- **Dispute:** exactly today's settlement. The unchanged `settleRun` or `settleLevel`, with today's proof, decides.
- **Price:** finality after 48 h instead of at once, a grace of 5 days instead of 48 h, a refundable bond of 10 run fees, a new watcher assumption, and an honest proposer who is disputed still needs someone to prove, as every player does today.
- **The owner's question.** The browser cannot prove the replay, and here it does not have to: it proposes what it already computed. RISC Zero stays, as the judge of disputes and as the immediate path; nothing is added to the stack and nothing is removed from it.

## 1. The idea, and why the proposal carries the burden of proof

After the commit, the player's browser already knows what settlement would record: the wasm core replays the six journals and gives the six Outcomes (`web/src/pages/settle.ts`, `rankedRun`). Settlement records only three numbers of them: the run's score, ticks and clears (`Challenge.finishRun`, `Season.recordRun`).

So the player **proposes** these three numbers with a bond. Anyone may **dispute** the proposal with the same bond during a window. An undisputed proposal is **finalized**: recorded by the same `finishRun` that `settleRun` uses. A disputed proposal is never recorded: the run then settles only as it settles today, with a proof.

**The task's sketch was a fraud proof:** final unless someone proves the claim wrong, with a level proof of the true Outcome. With the existing guest that cannot work alone. A journal or level that replay rejects makes the guest panic (`referee/zk/guest/src/bin/verify.rs`), so no proof exists for it. A player could commit such a journal, for example one with an event after the level's end (code 14), propose any score for it, and nobody could ever prove the proposal wrong. Closing that hole with fraud proofs needs a guest that commits the rejection instead of panicking: a new image id, a new `ZkReferee`, and a change to `IReferee`'s "rejections revert" rule.

**This design flips the burden instead:** a disputed proposal stands only if someone proves it *right*. Every case is then covered by the existing guest:

| What the committed journals really give | Proposal | After a dispute |
|---|---|---|
| Six Outcomes | equal to them | A proof exists. `settleRun` records the same numbers: the proposer wins. |
| Six Outcomes | different | No proof of the proposal can exist. If someone proves the truth, it is recorded and the disputer wins; if nobody does, the disputer wins when settlement ends. |
| Replay rejects a journal, or a binding check of `checkOutcome` fails | anything | No proof of anything can exist. The disputer wins when settlement ends. |

Two consequences matter more than the mechanics:

1. **Stopping a fraud needs no prover.** A watcher replays the run (2.3 ms natively for the heaviest level, 120 ms in the browser for the heaviest six-level run **[L]**), posts a bond, and is done. With fraud proofs, each fraud would need 2 to 4 hours of proving within the window.
2. **A proof is needed only when an honest proposal is disputed,** which costs the disputer the bond. Proofs become the exception's exception.

A dispute names no level and is resolved on the whole run. A dispute per level would need six dispute slots per run: with one slot, a proposer could dispute a true level of their own false proposal, prove it, and shield the false level.

## 2. What changes and what does not

| Part | Change |
|---|---|
| `core/` | None. No behavior change, `RULES_VERSION` stays 2, no vector moves. The state hash and its missing decoder are not used. |
| `referee/zk/guest`, `referee/zk/host` | None. Same programs, same image id `0xa3013dc4…02b1`, same proofs. |
| `referee/stylus` | None. |
| `contracts/src/ZkReferee.sol`, `interfaces/IReferee.sol`, `RunDerivations.sol`, `ArbBlockhashEntropy.sol`, the other interfaces, the mocks | None. |
| `contracts/src/Challenge.sol` | Additions only: 1 struct, 1 mapping, 3 external functions, 1 private helper, 3 events, 9 errors. `startRun`, `revealRun`, `commitRun`, `settleRun`, `settleLevel`, `entropyIdOf` and every private function keep their text. |
| `contracts/src/Season.sol` | Additions only: 2 fields in `SeasonParams`, 2 range checks, 2 errors, 1 view. |
| Deployment | A new generation: `Season` and `Challenge` are immutable, and `bindChallenge` binds once. `deploy.mjs` deploys it as before; the constructors do not change. |
| Season parameters | 2 new (`disputeWindow`, `bond`); `grace` gets a new lower bound and a new proposed value. |
| `web/` | The settlement section proposes and finalizes; the season page checks open proposals and offers the dispute. The run flow, the journal, the wasm module, the run file and the calldata loader do not change. |
| `scripts/contracts/season.mjs` | Two new season keys; M5.5's `settle` becomes watch, finalize, and prove only what is disputed. |

## 3. Contracts

### 3.1 `Challenge.sol`: state

```solidity
/// @notice A player's proposal of what settlement would record for a run (README §7.2), and who
/// disputes it. `proposedAt` is 0 when the run has no open proposal.
struct Proposal {
    uint64 proposedAt;
    uint32 score;
    uint32 ticks;
    uint8 clears;
    address disputer;
}

mapping(uint256 runId => Proposal) public proposals;
```

Two storage slots: the first holds `proposedAt`, `score`, `ticks` and `clears` (17 bytes); the second holds `disputer` and is written only by a dispute. The bond's amount is not stored: it is the run's season's, fixed at `open`.

`Challenge` now holds ETH, which it did not: one bond per open proposal, one more per open dispute. New invariant: `address(challenge).balance` equals the sum, over open proposals, of the season's bond, twice for a disputed one.

### 3.2 `Challenge.sol`: functions

```solidity
function proposeRun(uint256 runId, uint32 score, uint32 ticks, uint8 clears) external payable onlyPlayer(runId);
function disputeRun(uint256 runId) external payable;
function finalizeRun(uint256 runId) external;
```

**`proposeRun`**, the player only, as `revealRun` and `commitRun`:

```solidity
function proposeRun(uint256 runId, uint32 score, uint32 ticks, uint8 clears) external payable onlyPlayer(runId) {
    Run storage run = runs[runId];
    checkSettlementOpen(runId, run);
    if (proposals[runId].proposedAt != 0) revert AlreadyProposed(runId);
    (uint64 disputeWindow, uint256 bond) = seasons.proposalTermsOf(run.season);
    uint256 latestProposal = seasons.settlementEndOf(run.season) - 2 * disputeWindow;
    if (block.timestamp > latestProposal) revert ProposalTooLate(runId, latestProposal);
    if (msg.value != bond) revert WrongBond(msg.value, bond);
    uint64 proposedAt = uint64(block.timestamp);
    proposals[runId] = Proposal(proposedAt, score, ticks, clears, address(0));
    emit RunProposed(runId, msg.sender, score, ticks, clears, proposedAt + disputeWindow);
}
```

- `checkSettlementOpen` is the existing private check: committed, not settled, settlement open.
- **Two windows must remain,** one to dispute and one to prove a disputed proposal: a dispute on the window's last second still leaves a full window before settlement ends.
- **One proposal per run.** A proposal closes only when the run is settled or settlement has ended, and both make `checkSettlementOpen` revert, so a closed proposal can never be followed by another.
- **Why only the player.** If anyone could propose, anyone could propose a rival's true result and dispute it from a second address. That costs nothing, since the bond moves between the attacker's own addresses, and it pushes the rival's run onto the proof path for good. With the player as the only proposer, blocking a run always costs a bond that is lost when the proof comes. It also keeps the state smaller: the proposer is `run.player`, and a recipient that rejects ETH can only block its own proposal.

**`disputeRun`**, anyone:

```solidity
function disputeRun(uint256 runId) external payable {
    Proposal storage proposal = proposals[runId];
    if (proposal.proposedAt == 0) revert NotProposed(runId);
    if (proposal.disputer != address(0)) revert AlreadyDisputed(runId);
    if (settlements[runId].status != SettlementStatus.Unsettled) revert AlreadySettled(runId);
    (uint64 disputeWindow, uint256 bond) = seasons.proposalTermsOf(runs[runId].season);
    uint256 disputeEnd = proposal.proposedAt + disputeWindow;
    if (block.timestamp > disputeEnd) revert DisputeWindowClosed(runId, disputeEnd);
    if (msg.value != bond) revert WrongBond(msg.value, bond);
    proposal.disputer = msg.sender;
    emit RunDisputed(runId, msg.sender);
}
```

It states nothing about what is wrong. From then on the proposal can never be recorded.

**`finalizeRun`**, anyone, closes a proposal and pays its bonds:

```solidity
function finalizeRun(uint256 runId) external {
    Proposal memory proposal = proposals[runId];
    if (proposal.proposedAt == 0) revert NotProposed(runId);
    Run storage run = runs[runId];
    (uint64 disputeWindow, uint256 bond) = seasons.proposalTermsOf(run.season);
    uint256 settlementEnd = seasons.settlementEndOf(run.season);
    Settlement memory settlement = settlements[runId];
    bool proven = settlement.status != SettlementStatus.Unsettled;
    bool open = !proven && block.timestamp <= settlementEnd;
    delete proposals[runId];
    if (proposal.disputer == address(0)) {
        if (open) {
            uint256 disputeEnd = proposal.proposedAt + disputeWindow;
            if (block.timestamp <= disputeEnd) revert DisputeWindowOpen(runId, disputeEnd);
            finishRun(runId, run, Settlement(SettlementStatus.Unsettled, ALL_LEVELS_SETTLED,
                proposal.clears, proposal.score, proposal.ticks));
        }
        pay(runId, run.player, bond);
        return;
    }
    if (open) revert DisputeOpen(runId, settlementEnd);
    bool asProposed = proven && settlement.score == proposal.score && settlement.ticks == proposal.ticks
        && settlement.clears == proposal.clears;
    pay(runId, asProposed ? run.player : proposal.disputer, 2 * bond);
}

function pay(uint256 runId, address to, uint256 amount) private {
    emit ProposalClosed(runId, to, amount);
    (bool sent,) = to.call{value: amount}("");
    if (!sent) revert TransferFailed(to, amount);
}
```

| Proposal | Run, when `finalizeRun` is called | Effect | Bonds |
|---|---|---|---|
| Undisputed | unsettled, window open | reverts `DisputeWindowOpen` | held |
| Undisputed | unsettled, window over, settlement open | **recorded** through `finishRun`: `Settled`, or `Late` if `committedAt` is past the deadline of the proposed ticks; `Season.recordRun` ranks it | player gets the bond back |
| Undisputed | settled or late by a proof | nothing recorded: the proof stands | player gets the bond back |
| Undisputed | unsettled, settlement ended | nothing recorded | player gets the bond back |
| Disputed | unsettled, settlement open | reverts `DisputeOpen` | held |
| Disputed | settled or late by a proof, same score, ticks and clears | nothing more: the proof already settled the run | both to the player |
| Disputed | settled or late by a proof, other numbers | the proven result stands | both to the disputer |
| Disputed | unsettled, settlement ended | the run stays unsettled | both to the disputer |

- **`finishRun` is reused as it is,** so a finalized proposal is recorded exactly as a proven run: the same deadline check from the ticks, the same `RunSettled` or `RunLate` event, the same `Season.recordRun`. The leaderboard, built from `Season`'s `BestRunRecorded`, needs no change.
- **State before money.** The proposal is deleted and the settlement written before `pay`, which sends last and reverts on failure. A recipient that rejects ETH blocks only its own payment: the player, the recording of the player's own proposal; a disputer, their own winnings. Tested in the prototype.
- **The proof path ignores proposals.** `settleRun` and `settleLevel` settle a run at any time before settlement ends, whether it has a proposal, a dispute or neither. Levels already settled one by one do not block a finalization, which writes the proposal's totals over the partial sums.

**Events and errors** added to `Challenge`:

```solidity
event RunProposed(uint256 indexed runId, address indexed player, uint32 score, uint32 ticks, uint8 clears, uint256 disputeEnd);
event RunDisputed(uint256 indexed runId, address indexed disputer);
event ProposalClosed(uint256 indexed runId, address indexed paid, uint256 amount);

error AlreadyProposed(uint256 runId);
error ProposalTooLate(uint256 runId, uint256 latestProposal);
error WrongBond(uint256 sent, uint256 bond);
error NotProposed(uint256 runId);
error AlreadyDisputed(uint256 runId);
error DisputeWindowClosed(uint256 runId, uint256 disputeEnd);
error DisputeWindowOpen(uint256 runId, uint256 disputeEnd);
error DisputeOpen(uint256 runId, uint256 settlementEnd);
error TransferFailed(address to, uint256 amount);
```

### 3.3 `Season.sol`

```solidity
struct SeasonParams {
    // … the ten existing fields, unchanged …
    uint64 disputeWindow;
    uint256 bond;
}

error DisputeWindowOutOfRange(uint64 disputeWindow);
error ZeroBond();

// in checkRanges:
if (params.disputeWindow == 0 || 2 * params.disputeWindow > params.grace) {
    revert DisputeWindowOutOfRange(params.disputeWindow);
}
if (params.bond == 0) revert ZeroBond();

function proposalTermsOf(uint256 season) external view returns (uint64 disputeWindow, uint256 bond);
```

`proposalTermsOf` exists for the reason `commitSlackOf` does: `paramsOf` copies the whole struct, which cost 54,522 gas more in `commitRun` **[R]**. `payFee`, `recordRun`, `closeSeason`, `claim`, `withdrawRake` and `isSolvent` are untouched. `Season` never holds a bond.

### 3.4 Size

`Challenge.sol` gains 108 lines and `Season.sol` 15; `diff` shows no line removed or changed. Runtime bytecode: `Challenge` 8,867 → 12,206 bytes, `Season` 7,773 → 8,264, both far below 24,576 **[P]**.

## 4. Season parameters

| Parameter | Type | Rule | Proposed for testnet-1 | Derivation |
|---|---|---|---|---|
| `disputeWindow` (new) | `uint64`, seconds | from 1 s; `2 × disputeWindow ≤ grace` | 172,800 (48 h) | 24 h, the sequencer's force-inclusion delay on Arbitrum One **[L]**, so that a censored dispute can still be forced in; plus 12 h, the watcher's cadence; plus 12 h of margin. It is also the least time left to prove a disputed run: the heaviest run of the gate set proves in 16 to 17 h on 4 CPUs **[R]**, found at the next watcher run at most 12 h after the dispute. |
| `bond` (new) | `uint256`, wei | above 0; no upper bound, as for `runFee`: the exact-bond rule shows a wrong value before anyone pays | 500,000,000,000,000 (0.0005 ETH, 10 run fees) | At least the defense it can force: 0.0000345 ETH on the market route **[R]**, 14 times covered; still 2.3 times covered at the price the market paid for programs of our size, 0.000055 ETH **[R]**, with gas at ten times the base fee. At least a watcher's gas for a dispute, 109,678 gas **[P]**, 2.3 times covered even at 2 gwei. Not covered: rented CPUs for a 9 to 17 h proof, about 0.0007 to 0.0015 ETH **[E]** (4 vCPUs and 16 GB at $0.17 to $0.20 per hour). If that is the proving route the owner chooses in round G2, set 0.002 ETH. |
| `grace` (existing) | `uint64` | unchanged range; now also at least two dispute windows | 432,000 (5 days), not 48 h | 2 × 48 h, plus 24 h in which the runs bought in the season's last minutes are played (at most 1,080 s plus slack) and proposed. Proposals are accepted until end + 24 h, disputes until end + 72 h at the latest, proofs and finalizations until end + 120 h. |
| `commitSlack`, `length`, `runFee`, `rakeBp`, `minClears`, `referee`, `rulesVersion`, `levelIds`, `weightsBp` | | unchanged | unchanged | |

The season files own the values (`seasons/*.json`); README §8.4 owns the ranges. With a Stylus referee, should activations reopen, the same contracts work and the dispute needs no prover, only gas: 33 to 51 million gas for a gate-set run **[R]**, 0.0007 to 0.0010 ETH at 0.020036 gwei. Such a season would set its bond to about 0.002 ETH.

## 5. Lifecycle

`T` is the season's end, `W` the dispute window (48 h), `p` the time of the proposal.

1. **Pay, reveal, play, commit.** Unchanged. The commit publishes the six journals.
2. **Propose.** The page replays the six journals with the wasm core, applies settlement's binding checks (§7), and sums score, ticks and clears. For a run that ranks above the player's best, it calls `proposeRun(runId, score, ticks, clears)` with the bond. Latest: `T + grace − 2W`, which is `T + 24 h`.
3. **Watch,** from `p` to `p + W`. Any watcher (the operator's job, any player's page, anyone with the repository) rebuilds the run from chain data, replays it, and compares. A true proposal needs no action.
4. **No dispute: finalize.** After `p + W`, anyone calls `finalizeRun(runId)`. The run is recorded and ranked; the bond returns. This must happen before `T + grace`; the page offers it, and the operator's job does it for proposals left open.
5. **Dispute.** A watcher who finds the proposal false calls `disputeRun(runId)` with the bond, by `p + W`. The proposal is dead as a shortcut; the run now settles only with a proof.
   - **5a. The proposal was true.** Someone proves the run with the existing guest: one run proof for `settleRun`, or six level proofs for `settleLevel`, which six machines can prove in parallel. The proof settles the run at once, as today. `finalizeRun` then pays both bonds to the player. At least `W` remains for this after any dispute; for a proposal made early in the season, weeks.
   - **5b. The proposal was false, the journals valid.** Nobody can prove the proposal. If someone proves the true result, it is recorded, and `finalizeRun` pays both bonds to the disputer. Otherwise 5c.
   - **5c. No proof by `T + grace`.** This covers a journal that replay rejects, a run that fails a binding check, a false proposal nobody bothered to prove the truth of, and a true proposal nobody proved. The run stays unsettled and earns nothing. `finalizeRun` pays both bonds to the disputer.
6. **Proof at any time.** With or without a proposal, `settleRun` and `settleLevel` settle a run immediately, unchanged. An undisputed proposal overtaken by a proof gets its bond back.
7. **Close and claim.** Unchanged: `closeSeason` after `T + grace`, then `claim`.

Bonds, in one table (`B` is the bond):

| Case | Player | Disputer |
|---|---:|---:|
| Undisputed | 0 | |
| Disputed, a proof records what was proposed | +B | −B |
| Disputed, a proof records something else | −B | +B |
| Disputed, no proof before settlement ends | −B | +B |

## 6. The guest, the core and the referees

Nothing changes.

- The dispute backend is the existing proof path. A defender uses `zk-host prove --run <run file> --season <season file>` and `settleRun`, as M4.14 did, or six `zk-host prove --level` proofs and six `settleLevel` calls, each through `IReferee.verify`.
- "Rejections revert" stays true, and is what makes a false proposal on a rejected journal indefensible.
- No state-hash decoder, no per-tick program, no second implementation of any rule.

A fraud-proof variant would need this guest change, which this design avoids: `verify` commits `(code, zeros)` for a rejected level instead of panicking, as the test guest `trace` already does; `ZkReferee` must then revert on a non-zero code in `verify` and `verifyRun`, and expose the rejection to `Challenge`; the Stylus referee and `IReferee` follow.

## 7. Web app and scripts

**One new pure function, shared by the proposer and every watcher,** in `web/src/run/` (for example `verdict.ts`). It returns what `settleRun` would record for a committed run, or why the run can never settle. It is settlement's README §7.2 steps 2 to 5 run offchain:

1. the six journals hash to the run's commitment (`committedJournals` in `web/src/chain/calldata.ts` already keeps only such journals);
2. the season is the page's: `checkSeason` (rules version, the 16 level ids);
3. `slots = core.draw(run.runNonce)`; level `i` is the season's level in `slots[i]`, at weight `weightsBp[slots[i]]` (`committedRun` already builds this run file);
4. `core.replay(level, journal, weight)` for each level: a rejection code means the run can never settle;
5. each Outcome has the run's `runNonce`, `levelIndex` `i` and mode 1: otherwise `checkOutcome` would revert, and the run can never settle. The level id, journal hash, rules version and draw slot then hold by construction;
6. the result is Σ `levelScore`, Σ `ticksUsed` and the number of levels whose `endReason` is Cleared.

`replayRunFile` and `rankedRun` do steps 4 and 6 today; step 5's three comparisons are new. The page proposes only what this function returns, and a watcher disputes any open proposal that differs from it or whose run cannot settle. The wasm module needs no new export: `replay` already returns the whole Outcome.

| File | Change |
|---|---|
| `web/src/run/verdict.ts` (new) | The function above. |
| `web/src/chain/contracts.ts` | `proposeRun`, `disputeRun`, `finalizeRun`, written as `commitRun` is, with `confirmed` and `eventOf`. |
| `web/src/pages/settle.ts` | For every backend, the player's best run follows the proposal's state, read from `proposals(runId)` and `settlements(runId)`: propose, with the bond and the window's end shown; wait; finalize; or, when disputed, say that the run needs a proof before settlement ends, and export the run file as today. `operatorHandoff` remains only for a disputed run and for a player who prefers the proof path. On zk, read `paused()` of the referee's verifier before proposing, and warn when it is stopped: a dispute could not be answered. |
| `web/src/pages/season.ts`, `web/src/chain/leaderboard.ts` | Open proposals from `RunProposed`, `RunDisputed` and `ProposalClosed` logs (`eventLogs`), shown as provisional rows. Each is checked in the browser with the function above, about 120 ms for the heaviest run **[L]**. A false one gets a dispute button. |
| `web/src/run/season.ts` | `SeasonFacts` and `seasonEntries` show the dispute window and the bond. |
| `web/src/chain/bindings/Challenge.ts`, `Season.ts` | Regenerated from `contracts/abi/`. |
| `web/test/`, `web/scripts/challenge-e2e.mjs` | The verdict on the settlement suite's rejections (a copied journal, a training journal, a wrong level index, a journal that replay rejects); a proposed and finalized run; a false proposal disputed. |
| Run flow (`web/src/run/flow.ts`, `play.ts`, `store.ts`), `runfile.ts`, `calldata.ts`, `web/wasm` | None. |
| `scripts/contracts/season.mjs` | `disputeWindow` and `bond` in `SEASON_KEYS` and `seasonParamsOf`. M5.5's `settle` becomes three commands: `watch`, which checks every open proposal and disputes the false ones from a funded watcher key; `finalize`, which closes proposals whose window has ended; `settle`, which proves and settles only a disputed proposal the watcher finds true, and, if the owner keeps that service, the best runs nobody proposed. `watch` must fail loudly when it cannot read a run's journals. |
| `.github/workflows/season-ops.yml` (M5.5) | `watch` at least three times per dispute window: every 12 h for 48 h. A new secret, the watcher key, funded with a few bonds. |
| `scripts/contracts/e2e.mjs` | Three cases: proposed and finalized; a false proposal disputed and left unproven; a true proposal disputed, settled by proof, bonds to the player. |
| `seasons/testnet-1.json` (M5.5) | The two new keys, and `grace` 432,000. `testnet-0.json` belongs to the first generation and keeps its shape. |
| `contracts/abi/`, `contracts/test/` | ABIs regenerated. A `Proposal.t.sol` from the prototype's 44 behavior tests; `defaultParams` gains the two fields; `Invariant.t.sol` gains the bond invariant of §3.1 and handler calls for the three functions; gas tests. |
| README | §7.2 step 4 gains the proposal; §7.3's "verify by exception" and its last sentence ("proven rather than disputed"); §7.5; §8.4's parameter table, the grace row and the custody paragraph. |
| `docs/ECONOMY.md` | §2 gains the three gas rows and the bond; §3 gains the rows of §10 below and rewrites "Forged score" and "the operator is in practice the only prover". |
| `docs/VERIFICATION.md`, `docs/DEPLOYMENT.md`, `IMPLEMENTATION_PLAN.md` | The measured gas; the new generation; M5.3, M5.5 and M5.6 reworded. |

## 8. Costs

Gas in the new functions was measured on the prototype with forge 1.8.6, solc 0.8.28, optimizer 200, shanghai, by `vm.lastCallGas()` as the repository's gas tests do, and with real transactions on anvil 1.8.6. The two agree to the unit on calls with no refund; a receipt is the forge figure less the refund. Calibration: the prototype's `startRun` costs 131,954 gas against the repository's 131,976. ETH is at 0.020036 gwei, Arbitrum One's base fee of 2026-11-02 **[R]**, before the L1 data fee, which the repository has not measured.

| Step | Gas | ETH | Of the 0.00005 ETH fee |
|---|---:|---:|---:|
| `proposeRun` **[P]** | 74,933 | 0.0000015 | 3.0 % |
| `finalizeRun`, undisputed, the player's first settled run **[P]** | 157,308 | 0.0000032 | 6.3 % |
| `finalizeRun`, undisputed, a run that does not rank above the player's best **[P]** | 92,233 | 0.0000018 | 3.7 % |
| **Normal case: propose and finalize** **[P]** | **232,241** | **0.0000047** | **9.3 %** |
| `disputeRun` **[P]** | 59,918 | 0.0000012 | 2.4 % |
| `finalizeRun`, disputed, no proof **[P]** | 49,760 | 0.0000010 | 2.0 % |
| `finalizeRun`, disputed, proven as proposed **[P]** | 51,969 | 0.0000010 | 2.1 % |
| Today: `settleRun` with a run proof **[R]** | 530,256 on Sepolia with short journals; 804,194 estimated for gate-set journals | 0.0000161, plus 0.0000184 for the proof | 69 % |

- **Normal case against today:** 7.4 times cheaper in ETH, and no proving. Today a whole run takes 9 to 11 h to prove on 4 CPUs for a bot's run and 16 to 17 h for the heaviest **[R]**, or a market order the project has never placed. The two new calls carry 132 and 36 bytes of calldata against `settleRun`'s 7 to 26 KB, so the unmeasured L1 data fee shrinks too.
- **A season of 100 best runs:** 0.00047 ETH and no CPU time, against 0.00345 ETH with market proofs, or 900 to 1,700 hours of a 4-CPU machine with its own.
- **A false proposal, disputed:** 109,678 gas for the disputer (0.0000022 ETH), who receives both bonds. No proof.
- **A true proposal, disputed:** today's cost of a verified run for whoever defends it (0.0000345 ETH on the market route, or 9 to 17 h on 4 CPUs), plus 51,969 gas. Six level proofs instead take up to about 3.8 h each on six machines (the `worst-case` level took 13,177 s **[R]**; `10-worst`, 30 segments, about 13,800 s at the same rate **[E]**) and about 2.4 million gas, 0.000048 ETH **[E]**, summed from the repository's `settleLevel` and `ZkReferee.verify` figures.
- **Time to finality:** 48 h after the proposal, against at once after the proof. Payouts move from end + 48 h to end + 5 days.
- **`Season.open`:** about 40,000 gas more, for the two new parameters **[P]** (965,403 on anvil, with other level ids than the 925,637 of Sepolia **[R]**).
- **Capital:** the player locks 0.0005 ETH for 48 h per proposed run. A disputer locks 0.0005 ETH until the run is proven or settlement ends. A watcher that wants to stop `k` simultaneous false proposals holds `k` bonds.
- **Deployment:** `Season` 1,842,716 gas and `Challenge` 2,692,023 **[P]**, against 1,736,804 and 1,971,257 today **[R]**: 826,678 more per generation, 0.000017 ETH. The prototype's build of the unmodified contracts deploys at exactly the repository's Sepolia figures, which checks its compiler settings.

## 9. Security assumption

**Today.** No wrong payout unless RISC Zero's proof system, its pinned verifier, or the pinned image fails. An honest player is paid if someone proves and settles their run before end + grace; in practice the operator.

**With this design.** No wrong payout if both hold:

1. today's condition, which still decides every proof;
2. for each false proposal, during its window, at least one party replays the run, holds one bond, and gets `disputeRun` included.

Condition 2 is new and weaker than a proof. It names no key and no oracle: a proposal is only a player's claim about their own run, and anyone can veto it. But it is an assumption about people and machines being present. What a watcher needs:

- the run's journals: the commit transaction's calldata, or its trace when a contract made the commit and its calldata does not embed the call (`calldata.ts` handles both; the trace needs an RPC that serves it);
- the season's levels and weights, and a core at the season's rules version;
- one bond of free ETH per false proposal open at once;
- inclusion within the window, by force through L1 if the sequencer censors.

An honest player is paid if one of these holds:

- they propose by end + grace − 2 windows, nobody disputes, and anyone finalizes before end + grace: **no prover is involved**;
- they are disputed, and someone proves the run before end + grace, with at least one window to do it: today's requirement, and they receive the disputer's bond;
- they do not propose, and someone proves the run: today, unchanged.

So nothing an honest player can do today is taken away, and one route needs no prover. What is new for them is a bond at risk: disputed and unproven, they lose it.

## 10. Weaknesses, most serious first

1. **An undisputed false proposal is paid, and cannot be undone.** `Season` has no way to remove a recorded run. Nothing onchain checks a proposal; the prototype pins this with a test that records a score of 393,210 for a run that earned 48,010. The bond does not make fraud unprofitable by itself: a false run that would take a share worth `g` is worth trying whenever the chance that no watcher acts in the window exceeds `bond / (g + bond)`, which is 2.4 % for a 0.02 ETH share. Safety is the watcher's presence, not the bond.
2. **A disputed honest proposal dies if nobody proves it,** and its player loses the bond as well as the run. Whenever proving is unavailable (the operator absent, RISC Zero's emergency stop paused, more disputes than proving capacity), disputing honest proposals pays: one bond each, and a rival's share of the pot. One 4-CPU machine defends at most two heavy runs in the minimum window. Under a stopped verifier, today nothing settles; here undisputed proposals still settle, but every open one can be killed for a profit.
3. **The disputer's bond goes to the player, not to whoever proves.** The contract gives a third party no reason to defend a stranger's proposal, so in practice the operator defends at its own cost, as it proves at its own cost today. Paying the prover needs the settler's address in `Settlement`, where it fits in the same slot, and one line in `finishRun`. I left it out because it touches the proof path's storage.
4. **Watchers re-implement settlement's binding checks.** In this path the contract checks no level, draw, nonce, index or mode: §7's function does. A mistake there either lets a false proposal pass or costs a watcher a bond. The checks are three comparisons and a replay, but they now carry weight. One function, tested on the settlement suite's rejections, shared by the page and the script.
5. **The operator is likely the only reliable watcher,** and the page that players watch with is the operator's build. A watcher that runs once a day with a 48 h window survives one failed run and not two. An independent watcher needs the repository and an RPC, which the tester guide should explain.
6. **Slower.** 48 h to finality, a 5-day grace, payouts 3 days later than with a 48 h grace.
7. **More for the player to do.** One more transaction with a bond worth 10 runs, and a finalization that someone must send. Only the player can propose (§3.2), so the operator cannot do it for them, which departs from the owner's "players do nothing after committing" of 2026-11-08. A player who does not propose depends on the operator's proof, as today.
8. **A dispute costs a whole-run proof,** 9 to 17 h on 4 CPUs, or six level proofs; never one level proof.
9. **`Challenge` now holds ETH,** and both contracts are redeployed: a new invariant, new tests, new ABIs, and the first generation's `Season` is left behind with whatever rollover it holds.
10. **A watcher's capital can be outspent.** Each false proposal needs its own bond from a watcher until settlement ends. An attacker who posts more false proposals at once than the watchers have bonds gets one through; each costs the attacker a run fee and a bond at risk, so watchers need about as much capital as the attacker is ready to lose.
11. **Sequencer.** A window measured in `block.timestamp` trusts the sequencer's clock within its bounds, and a dispute censored for longer than the window minus the watcher's reaction is lost. This is why the window exceeds the 24 h force-inclusion delay.

## 11. Variants considered

- **The same idea behind `IReferee` (not chosen, worth the lead's attention).** A new referee contract wraps the season's `ZkReferee`. Statements "this level and journal, at this weight, give this Outcome" are proposed with a bond; a disputed statement is defended with one level proof through `inner.verify`; `verify` and `verifyRun` return matured, undisputed Outcomes when the proof names a proposer instead of a seal. `Challenge` and `Season` would not change at all and would not even be redeployed: the next season names the new referee, and the one after can name the plain `ZkReferee` again. Settlement's binding checks stay onchain, a dispute costs one level proof, anyone may propose, and the prover is paid. I did not choose it because it is more, not less: four functions; statements keyed by proposer, or proposing a rival's statement and disputing it blocks them for free; a response window of its own, since a referee knows no season; the journal bytes in the proposal or a lookup of the commit, or a statement can mature before its journal is public during a sequencer outage; and the settlement transaction keeps its 7 to 26 KB of levels and journals, for about 0.5 to 0.8 million gas in the normal case **[E]**, 2 to 3.4 times this design. Not prototyped.
- **Terms as `Challenge` immutables instead of season parameters.** `Season.sol` would stay byte-identical. Rejected: the bond follows the proving route and the ETH price, and the window follows the grace; a new value would mean a new generation, which strands the old `Season`'s rollover.
- **A response window after the dispute, instead of "until settlement ends".** It frees the disputer's bond earlier. It costs a third parameter and a stored timestamp, and gives the defender less time.
- **Fraud proofs per level with `IReferee.verify`.** Needs the six level results in the proposal, six dispute slots, and the guest change of §6 for rejected journals. It adds no safety here, since a disputed false proposal already dies without any proof; it would only pay a disputer sooner.
- **Anyone may propose.** Rejected in §3.2.

## 12. Prototype

`scratchpad/design/minimal-proto/`

- `src/Challenge.sol` and `src/Season.sol`: the repository's files with §3's additions; `orig/` holds the unmodified copies, so `diff orig/Challenge.sol src/Challenge.sol` shows the whole change.
- `test/Optimistic.t.sol`, `test/Edge.t.sol`: 44 tests, one scenario each, over every row of §3.2's table, every revert, the two-window bound, the new `open` ranges, six level proofs settling a disputed run, levels settled one by one before a finalization, a player that rejects ETH, and the bonds held. `test/Gas.t.sol`: the 8 measurements of §8.
- All 52 pass with the forge 1.8.6 binary already in the session's scratchpad and the solc 0.8.28 already on the machine, offline. Six seeded bugs were tried: five made a test fail at once; the sixth, dropping the ticks comparison, passed, so two tests were added (a proposal that differs from the proof only in ticks, or only in clears).
- **Not verified:** the repository's own suites against the new `SeasonParams`, because they import forge-std, whose submodule is not checked out here; the proof path with a real proof, because the prototype settles through `MockReferee`, as `Settlement.t.sol` does; any web or script change, which this document only specifies; the L1 data fee.

Reproduce, from the prototype directory, with `HOME` set to its `home/` so that forge writes nothing elsewhere:

```bash
HOME=$PWD/home <scratchpad>/research/measure/foundry/forge test
HOME=$PWD/home <scratchpad>/research/measure/foundry/forge test --match-contract GasTest -vv
```
