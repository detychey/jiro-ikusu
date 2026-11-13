# Claim at commit: an optimistic settlement path for the browser

Design "browser", 2026-11-10. Priority: the lightest day-to-day operation and the best player experience. The player does everything from the browser with no installed software, and a season runs with no prover in the normal case.

Every number is marked with its source:

- **(repo)** measured in the repository's documents;
- **(lead)** measured by the lead today, or given in the task;
- **(prototype)** measured on a prototype of the two contracts that I built and tested in the scratchpad ([§13](#13-prototype-evidence));
- **(estimate)** mine, not measured.

ETH costs take a base fee of 0.02 gwei (repo: 0.020036 gwei on Arbitrum One on 2026-11-02) and ETH at $2,290, before the L1 data fee. Two outside facts could not be checked today, because the web search budget of this session was used up: the sequencer's force-inclusion delay, which I take from the lead as about 24 h, and the number of jobs GitHub runs in parallel.

## 1. Verdict

**The optimistic path is a good idea under this priority, in its simplest form. Its heavy variants are not.**

- **Adopt.** The browser posts its six level results with the commit, under a bond, and the run counts at once. For 36 hours anyone may challenge one level with an equal bond. A challenged level is decided by the season's referee, unchanged, and by nothing else. No proof is made unless a level is challenged.
- **A challenger needs no fraud proof.** A challenge shifts the burden: the claim stands only if someone settles the challenged level through the referee, as claimed. A false claim has a level that can never be settled as claimed, so it dies when the defense window ends. That answers "how does a challenger without proving hardware obtain a fraud proof": it never needs one.
- **No new code in the core, the guest or the referees.** `core/`, `referee/zk/guest` and its image id, `referee/stylus`, `ZkReferee.sol` and `RULES_VERSION` stay as they are, so the one-implementation constraint is untouched. `Challenge.sol`, `Season.sol`, the web app and the scripts change.
- **Reject** the Merkle root of per-tick state hashes and the single-tick referee. From a root alone, a challenger cannot open the claimant's leaves, so narrowing a dispute to one tick needs 12 interactive rounds, or about 86 KB of hashes published per level. It would also bring the first consensus code that play never runs into the core (restoring a `Game` from the 948-byte preimage), a new guest and a bisection contract, all to save CPU time in a dispute that should be rare ([§11](#11-what-i-considered-and-rejected)).
- **The price.** Validity stops being purely cryptographic. A false claim is stopped only if a funded watcher challenges it within 36 hours, or someone proves the run before the season's end plus grace. An honest player who is falsely challenged needs somebody's prover within 36 hours, and loses a 0.0003 ETH bond otherwise. [§9](#9-security-assumption) and [§10](#10-weaknesses) say exactly what holds.

**The player cannot make the zk proof in the browser.** One heavy level is 15 to 30 segments of 2^20 cycles (repo). Proving them takes 9.2 GiB of memory and 7 to 8 minutes per segment on 4 native CPUs (repo), and the Groth16 wrapping runs only in an x86 Docker image or on CUDA (repo). What the browser can do is compute the Outcomes with the same core, which it already does, and let every other browser check them in 120 ms (lead).

## 2. What changes for each actor

| Actor | Today | With claims |
|---|---|---|
| Player | `startRun`, `revealRun`, `commitRun`, then waits for the operator to prove and settle the best run before end plus grace | `startRun`, `revealRun`, `commitAndClaim` with a 0.0003 ETH bond. The run is on the leaderboard in that transaction. The bond unlocks after 36 h, or carries over to the player's next better claim. |
| Other players | Nothing | Their open tabs replay each new claim and show an alert with a one-click challenge when a level differs |
| Operator | Rebuilds every run from chain data, proves each player's best run (about 9 to 17 h on 4 CPUs each, repo) and settles it: about 0.0000345 ETH per verified run (repo) | An hourly job replays new claims and challenges wrong ones from a hot wallet. It proves one level only when an honest claim is falsely challenged, and the challenger's bond pays for it. |
| Prover | Needed for every best run | Needed only when an honest claim is falsely challenged, on zk; never on Stylus |

## 3. Design decisions

| Question | Decision | Why |
|---|---|---|
| Fold the claim into the commit? | Yes: `commitAndClaim`. `claimRun` claims a run committed earlier. | One transaction, as today. The deadline check moves from settlement to the claim, on the claimed ticks. |
| What does a claim contain? | Six level results: `endReason`, `ticksUsed` and `levelScore` per level. No hash, no trace root. | A dispute is about one level, the smallest unit the existing referee decides. The three fields are exactly what `Challenge.addLevel` sums. They are 30 bytes and fill one storage slot. |
| When does a claimed run count? | At once, in `Season`. A challenge takes it off the ranking in the challenge's own transaction. | No finalize transaction exists, so nobody has to send one, and the operator sends nothing. |
| Who checks? | Every open tab of the dApp, and the operator's hourly job | A replay costs 120 ms per run in wasm (lead). A forged score dilutes every player's pro-rata share, and a successful challenge pays the claim's bond. |
| How does a watcher without a prover win? | It challenges one level with a bond, then waits 36 h | Nobody can settle a forged level as claimed |
| How is a false challenge answered? | `settleLevel` on that level, by anyone: one level proof on zk, a re-execution on Stylus | The function exists today. A level proof takes 2.0 to 3.9 h on 4 CPUs for the gate set's levels (repo), inside GitHub's 6-hour job limit, where a whole run, at 9 to 17 h, does not fit (repo). |
| Merkle root of per-tick state hashes? | No | It cannot be used without interaction or without publishing the trace ([§11](#11-what-i-considered-and-rejected)) |
| Single-tick referee? | No, on zk and on Stylus | [§11](#11-what-i-considered-and-rejected) |
| Can every browser read the journals? | Every commit also emits them in a log, `RunJournals` | A watcher on a public RPC cannot read a commit made through a contract that builds the call: today's loader then needs `debug_traceTransaction` (`web/src/chain/calldata.ts`). A claim that nobody can check would be a hole. Cost: 16,473 gas on a typical commit (prototype). |

## 4. Contract specification

Two contracts change: `contracts/src/Challenge.sol` and `contracts/src/Season.sol`. They are immutable, so this is a new generation and a new season. `IReferee`, `ZkReferee`, `RunDerivations` and `ArbBlockhashEntropy` do not change.

**Naming.** The repository already uses "claim" twice: `claimBp`, the share of the field captured, and `Season.claim`, the payout. This document keeps the lead's word for the bonded statement of results. In code I would consider `post` (`commitAndPost`, `postRun`, `postBond`) to keep the three apart; the owner decides.

### 4.1 Types and state (`Challenge.sol`)

```solidity
enum ClaimStatus { None, Standing, Rejected }

/// What a claim says of one level: the three Outcome fields that a run's score, ticks and clears sum.
struct LevelResult {
    uint8 endReason;    // Outcome.endReason
    uint16 ticksUsed;   // Outcome.ticksUsed
    uint16 levelScore;  // Outcome.levelScore: at most 65,535, the largest weight at a claim of 10,000 bp
}

struct Claim {
    ClaimStatus status;
    uint8 challengedLevels;  // bit i is set while a challenge of level i is open
    uint64 claimedAt;
    uint96 bond;             // locked for this claim; 0 once released, returned or forfeited
    uint40[6] results;       // per level: endReason << 32 | ticksUsed << 16 | levelScore; one slot
}

struct Dispute {
    address challenger;
    uint64 challengedAt;
}

uint256 public bondsHeld;                                 // the locked bonds and the credits not yet withdrawn
mapping(uint256 runId => Claim) private claims;           // read through claimOf
mapping(uint256 runId => Dispute[6]) public disputes;
mapping(address account => uint256) public credit;        // pull payments: released bonds and rewards
```

A claim takes two storage slots, and a dispute one. `Run`, `Settlement`, `runs` and `settlements` are unchanged.

### 4.2 Season parameters and functions (`Season.sol`)

Four parameters join `SeasonParams`. `open` commits them with the others, and nothing changes them afterwards.

| Parameter | Type | Rule checked by `open` |
|---|---|---|
| `challengeWindow` | `uint64` | Seconds. 0 switches claims off for the season, and the three others must then be 0: the season settles exactly as today. Otherwise at most 7 days. |
| `defenseWindow` | `uint64` | Seconds, from 1 to 7 days |
| `claimBond` | `uint96` | Wei, above 0, at most 1 ether |
| `challengeBond` | `uint96` | Wei, above 0, at most 1 ether |

`open` also requires `grace ≥ challengeWindow + defenseWindow`. The upper bounds catch a typo, as the existing ones do. The contract sets no floor on the windows, because test seasons on a local node need short ones. The page refuses a season whose challenge window is under its network's floor ([§6](#6-changes-outside-the-contracts)).

```solidity
/// Records `runId` if it ranks above the player's best run, and returns the run it replaced, 0 if none.
function recordRun(uint256 season, address player, uint256 runId, uint32 score, uint32 ticks, uint8 clears)
    external onlyChallenge returns (bool recorded, uint256 replacedRunId);

/// Takes `runId` off the ranking if it is the player's best run. Reverts once the season is closed.
function voidRun(uint256 season, address player, uint256 runId) external onlyChallenge;

function claimTermsOf(uint256 season) external view
    returns (uint64 challengeWindow, uint64 defenseWindow, uint96 claimBond, uint96 challengeBond);
```

- `recordRun` keeps its logic and gains its two return values.
- `voidRun` subtracts the run's score from `totalQualifiedPoints` if the run qualified, deletes `bestRunOf[season][player]` and emits `BestRunVoided(season, player, runId)`.
- `Season`'s money logic does not change: fees, rake, pot, rollover, `claim`, `withdrawRake` and `isSolvent` are as they are. Bonds never enter `Season`.

### 4.3 Functions (`Challenge.sol`)

`startRun` and `revealRun` are unchanged. Each function below checks in the order given and reverts on the first failure.

```solidity
function commitRun(uint256 runId, bytes[6] calldata journals) external;                       // onlyPlayer
```

Unchanged, except that it also emits `RunJournals(runId, journals)`. A run committed this way counts only once proven, as today. The page uses it for a run that does not improve the player's best.

```solidity
function commitAndClaim(uint256 runId, bytes[6] calldata journals, LevelResult[6] calldata results)
    external payable;                                                                          // onlyPlayer
function claimRun(uint256 runId, LevelResult[6] calldata results) external payable;           // onlyPlayer
```

`commitAndClaim` is `commitRun` followed by `claimRun`. A claim says: *settling this run through the season's referee would record these six results, on time.* `claimRun` checks:

1. the run is committed and unsettled, and none of its levels is settled yet;
2. it has no claim. A rejected claim is never claimed again;
3. the season has claims on: `challengeWindow > 0`;
4. `block.timestamp + challengeWindow + defenseWindow ≤ end + grace`. A challenge made in the claim's last second then still leaves a whole defense window before settlement closes. Otherwise `ClaimTooLate`: the run can still be proven, as today;
5. the run is on time by the claimed ticks: `committedAt ≤ revealedAt + ceil(Σ ticksUsed / 15) + commitSlack`. Otherwise `ClaimLate`;
6. `Season.recordRun` records it: the claim must rank above the player's best run, in D10's order. Otherwise `ClaimDoesNotImprove`;
7. `credit[msg.sender] + msg.value ≥ claimBond`. The bond is locked, and the rest stays as credit.

Effects:

- The claim is `Standing`, with `claimedAt = block.timestamp`.
- `RunClaimed` carries the six results, the totals and the end of the challenge window.
- If the run it replaced in `Season` is the player's own standing claim, that claim is **dropped**: deleted, with its bond credited to the player before check 7. A better run therefore needs no new ETH. Only a player's best run needs a bond.

```solidity
function challenge(uint256 runId, uint8 i) external payable;
```

Anyone may call it. Checks: `i < 6`; the claim is `Standing`; `block.timestamp ≤ claimedAt + challengeWindow`; level i is not settled; level i has no open challenge; `msg.value == challengeBond`, exactly. Effects: it records `Dispute(msg.sender, block.timestamp)` for level i and sets its bit. If this is the claim's first open challenge, it calls `Season.voidRun`: the run is off the ranking until every open challenge is refuted. No function withdraws a challenge.

```solidity
function settleLevel(uint256 runId, uint8 i, bytes32[6] calldata journalHashes, bytes calldata level,
    bytes calldata journal, bytes calldata proof) external;                                   // signature unchanged
function settleRun(uint256 runId, bytes[6] calldata levels, bytes[6] calldata journals,
    bytes calldata proof) external;                                                           // signature unchanged
```

Both verify and bind Outcomes exactly as today (`verify`, `verifyRun`, `checkOutcome`), until end plus grace. Then each verified level i meets the claim, if one is `Standing` (internal `judge`):

- **The Outcome differs** from `results[i]` in `endReason`, `ticksUsed` or `levelScore`: the claim is **rejected** (below). Its bond goes to level i's challenger if level i has an open challenge, otherwise to `msg.sender`, who brought the proof.
- **It matches, and level i has an open challenge:** the challenge is **refuted**. `credit[msg.sender] += challengeBond`, and the dispute is deleted. If no challenge stays open, the run is recorded again at the claimed totals; if the player has a better best run by then, the claim is dropped instead.
- **It matches, and level i has no challenge:** nothing more happens. Level i is settled, so nobody can challenge it any more.

When the sixth level is settled (`finishRun`), a claim that is still `Standing` matched on every level: it is confirmed and deleted, and its bond is credited to the player. The run is then `Settled` or `Late`, and recorded from its proven Outcomes, as today.

```solidity
function resolveChallenge(uint256 runId, uint8 i) external;
```

Anyone may call it. Checks: the claim is `Standing` and level i has an open challenge; `block.timestamp > challengedAt + defenseWindow`. Effect: the claim is rejected in favor of level i's challenger. A proof that arrives before this call still wins, even after the window.

**Rejection** (internal `reject(runId, winner)`):

- `credit[winner] += claim.bond`;
- every open challenge gets its bond back as credit;
- the status becomes `Rejected`;
- `Season.voidRun`, if the run was still on the ranking.

The run stays unsettled. Anyone can still prove it until end plus grace, and it then counts at its proven result. No bond moves again.

```solidity
function releaseBond(uint256 runId) public;
function withdraw(uint256[] calldata releasable) external returns (uint256 amount);
```

- `releaseBond`, by anyone: the claim is `Standing` with no open challenge, and `block.timestamp > claimedAt + challengeWindow`. Its bond becomes the player's credit. The claim stays `Standing` and recorded.
- `withdraw` releases the listed bonds, then pays the caller's whole credit: state first, then a checked `call`.

```solidity
function reinstate(uint256 runId) external;
```

Anyone may call it. It records a `Settled` run again from its stored settlement. One case needs it: a claim replaced a player's proven run as their best, then was voided, and the proven run must count again.

```solidity
function claimOf(uint256 runId) external view
    returns (ClaimStatus status, uint8 challengedLevels, uint64 claimedAt, uint96 bond, LevelResult[6] memory results);
function isSolvent() external view returns (bool);   // address(this).balance >= bondsHeld
```

### 4.4 Events and errors

```solidity
event RunJournals(uint256 indexed runId, bytes[6] journals);
event RunClaimed(uint256 indexed runId, address indexed player, uint256 indexed season, LevelResult[6] results,
    uint32 score, uint32 ticks, uint8 clears, uint256 challengeEnd);
event ClaimDropped(uint256 indexed runId);
event LevelChallenged(uint256 indexed runId, uint8 levelIndex, address indexed challenger, uint256 defenseEnd);
event ChallengeRefuted(uint256 indexed runId, uint8 levelIndex, address indexed settler);
event ClaimConfirmed(uint256 indexed runId);
event ClaimRejected(uint256 indexed runId, address indexed winner);
event BondReleased(uint256 indexed runId, uint96 bond);
event Withdrawn(address indexed account, uint256 amount);
// Season
event BestRunVoided(uint256 indexed season, address indexed player, uint256 indexed runId);
```

New errors, each with the values a caller needs:

- `Challenge`: `ClaimsDisabled`, `AlreadyClaimed`, `SettlementStarted`, `ClaimTooLate`, `ClaimLate`, `ClaimDoesNotImprove`, `BondShort`, `WrongBond`, `NoStandingClaim`, `ChallengeWindowClosed`, `ChallengeWindowOpen`, `LevelAlreadyChallenged`, `NoOpenChallenge`, `DefenseWindowOpen`, `BondLocked`, `NothingToReinstate`, `TransferFailed`.
- `Season`: `ClaimTermsWithoutWindow`, `ChallengeWindowOutOfRange`, `DefenseWindowOutOfRange`, `ClaimBondOutOfRange`, `ChallengeBondOutOfRange`, `GraceShorterThanDispute`.

### 4.5 Invariants

The prototype's invariant suite checks these under random sequences ([§13](#13-prototype-evidence)):

1. `Challenge`'s balance equals `bondsHeld`, which equals the credits, plus the bonds locked in claims, plus one challenge bond per open challenge.
2. A standing claim with no open challenge is its player's recorded best run. A challenged or rejected claim is not on the ranking, unless its run was proven.
3. Every best run in `Season` is a settled run at its proven totals, or a standing unchallenged claim at its claimed totals, of that player and season, and on time.
4. `totalQualifiedPoints` is the sum of the qualified best scores, and `Season.isSolvent()` holds.

## 5. Lifecycle

### 5.1 The normal case: three transactions and no proof

1. **Pay and reveal**, as today: `startRun(season)`, then `revealRun(runId)`.
2. **Play.** When the sixth level ends, the page replays its own six journals with the wasm core, as it does today to show the Outcomes, and keeps `endReason`, `ticksUsed` and `levelScore` of each.
3. **Commit and claim.** If the run ranks above the player's recorded best, the page sends `commitAndClaim(runId, journals, results)` with the bond, less the player's credit. The run is in `Season` when the transaction confirms. Otherwise the page sends plain `commitRun`: no bond, and nothing to watch.
4. **Watch.** For 36 h, every open tab and the operator's hourly job read `RunClaimed` and `RunJournals` from the logs, replay the six levels and compare.
5. **Unlock.** After 36 h without a challenge, the bond can be released. The page offers `withdraw`, or the player leaves it: their next better claim drops this one and takes over its bond.
6. **Close and pay**, as today: after end plus grace, anyone calls `closeSeason`, and each qualified player calls `Season.claim`.

### 5.2 Every dispute branch

| # | Situation | What happens | Who is paid |
|---|---|---|---|
| B1 | **A forged claim is challenged.** A watcher finds level i wrong and calls `challenge(runId, i)`. | The run leaves the ranking at once. Nobody can settle level i as claimed: on zk no proof of a false Outcome exists, and Stylus returns the true one. After 36 h the challenger calls `resolveChallenge`, and the claim is `Rejected`. | The challenger takes both bonds: 0.0003 + 0.0003 ETH. The forger loses the bond and the run fee. |
| B2 | **An honest claim is falsely challenged, and defended.** Anyone settles level i with `settleLevel`: a level proof on zk, an empty proof on Stylus. | The challenge is refuted. With no other challenge open, the run is back on the ranking. | The settler takes the challenge bond. The claim keeps its bond. |
| B3 | **An honest claim is falsely challenged, and nobody defends it in 36 h.** The challenger calls `resolveChallenge`. | `Rejected`. The run is unsettled, as if committed without a claim: `settleRun` or six `settleLevel` calls still record it until end plus grace. | The false challenger takes the claim bond. The player keeps the prize only if someone proves the run in time. |
| B4 | **A forged claim is proven wrong directly.** Someone with a proof of level i's true Outcome calls `settleLevel`. It takes no bond. | `Rejected` in that transaction: challenged or not, inside or outside the challenge window, until end plus grace. | Level i's challenger if there is one, otherwise the prover. Nothing, if the bond was already released. |
| B5 | **A right level of a forged claim is challenged** by an accomplice or by mistake, and refuted with a proof of that level. | Only that level is cleared. The wrong level stays open to challenge for the rest of the claim's window, and challenges of different levels run side by side, so a refutation launders nothing. | The settler takes that challenge's bond. |
| B6 | **Several levels are challenged.** | Each challenge has its own bond and its own 36 h. The run counts again only once all are refuted. The first lapse or mismatch rejects the claim. | The winning level's challenger takes the claim bond. The other open challengers get their bonds back. |
| B7 | **A forged claim is never challenged.** | After 36 h its bond can be released. A proof (B4) can still void it until end plus grace. After that it is paid. This is the failure the design must prevent ([§9](#9-security-assumption)). | The forger. |
| B8 | **A player's better claim drops their earlier claim, then is voided.** | The earlier run has no claim any more. The player claims it again with `claimRun`, with a new window, if `ClaimTooLate` allows and none of its levels was settled meanwhile. Otherwise it needs a proof. | |
| B9 | **A claim replaced the player's proven run, then is voided.** | Anyone calls `reinstate` on the proven run. The page and the operator's job offer it, since the run does not count until someone does. | |
| B10 | **A challenge comes at the very end of the season.** | Check 4 of `claimRun` guarantees that every challenge is made at least one defense window before end plus grace. | |
| B11 | **The referee cannot answer:** RISC Zero's emergency stop is paused, or a Stylus referee has expired. | No challenge can be refuted. Claims older than 36 h stand. Any challenger can knock out a younger one and take its bond. The page must stop claiming while `paused()` is true. Today a pause halts all settlement, and the pot rolls over. | The challengers. |
| B12 | **A whole-run proof arrives** (`settleRun`), at any time. | Every level is judged in order. A claim that matches is confirmed, and its open challenges are refuted in favor of the submitter. A claim that differs is rejected. The run is `Settled` or `Late` for good. | As B2 or B4. |

### 5.3 States of a committed run

| Claim | On the ranking | It leaves this state by |
|---|---|---|
| `None` | only once proven | `claimRun`; `settleRun` or `settleLevel` |
| `Standing`, no open challenge | yes, at the claimed totals | `challenge`; a proof (confirmed or rejected); a better run of the same player (dropped to `None`) |
| `Standing`, challenged | no | every challenge refuted (back on the ranking); a differing proof or a lapsed challenge (`Rejected`) |
| `Rejected` | no | a whole proof: `Settled` or `Late` |
| none, and the run is `Settled` | yes, at the proven totals, if it is the player's best | final |

## 6. Changes outside the contracts

**Core: none.** No file under `core/` changes. `RULES_VERSION` stays 2, no vector moves, and no byte format is added. The design uses only `replay`, `draw` and the hashes that `jiro-wasm` already exports.

**Guest: none.** `referee/zk/guest` is untouched, so the verify program's image id stays `0xa3013dc4…02b1` (repo), and existing proofs and fixtures stay valid. A challenged level is defended with the level mode that the verify program already has.

**zk host** (`referee/zk/host/src/main.rs`, `prove.rs`): `prove --run <run file> --season <season file> --level-index <i>` proves one level of a run file in level mode. Today `--level` takes a vector file, and `--run` proves all six levels. This is tooling, not consensus.

### 6.1 The watcher's verdict

One pure function decides whether a claim is right. It mirrors what `settleLevel` would accept, level by level:

1. `slots = draw(runNonce)`, from the core.
2. For each level i: take the shipped level whose id is the season's `levelIds[slots[i]]`, and replay `journals[i]` on it with `weightsBp[slots[i]]`.
   - If replay rejects, level i can never settle: the verdict is level i.
   - If the Outcome's `runNonce` is not the run's, its `levelIndex` is not i, its `mode` is not 1, or its `rulesVersion` is not the season's, level i can never settle: the verdict is level i. These are the checks of `Challenge.checkOutcome`. The level id and the draw slot hold by construction: replay rejects a journal that names another level, with code 12.
   - Otherwise compare `endReason`, `ticksUsed` and `levelScore` with the claimed `results[i]`.
3. The verdict is the first level that differs and has no open challenge, or "right".

A claim is true exactly when each level can be settled at its claimed result. No separate check of the totals or of the deadline is needed: the contract derives both from the six results when the claim is made.

### 6.2 Web app

| File | Change |
|---|---|
| `web/src/run/flow.ts` | `commit` sends `commitAndClaim` with the six results when the run ranks above the player's best, with `msg.value = max(0, claimBond − credit)`; otherwise `commitRun`. It simulates the call first, and falls back to `commitRun` at once on a claim error, so that a refused claim never costs the commit its deadline. |
| `web/src/run/verdict.ts` (new) | The function of [§6.1](#61-the-watchers-verdict). It reuses `replayRunFile` (`runfile.ts`), `checkSeason` and the core's draw. |
| `web/src/chain/watch.ts` (new) | Reads `RunClaimed`, `RunJournals`, `ClaimDropped` and `LevelChallenged` through `eventLogs` (`logs.ts`), from `now − challengeWindow`. It runs the verdict on each standing claim and keeps the verdicts in IndexedDB. One `eth_getLogs` per minute while a chain page is open, and 120 ms of wasm per claim (lead). |
| `web/src/chain/calldata.ts` | Journals come from the `RunJournals` log. The selector scan of calldata and the `debug_traceTransaction` fallback go away for generations that emit the log. |
| `web/src/pages/season.ts`, `season.html` | Each leaderboard row shows its state: open to challenge until a time, standing, challenged on level i, or proven. An alert names a wrong level and offers `challenge`; the wallet asks for the bond. A "Withdraw bonds" button. For the player's own challenged claim: the defense deadline and the run file. |
| `web/src/chain/leaderboard.ts` | `BestRunVoided` removes a player's row until their next `BestRunRecorded` |
| `web/src/pages/settle.ts` | On zk, the operator hand-off text goes: the page claims. It keeps the run-file export, for a defense. |
| `web/src/run/season.ts`, `web/src/chain/networks.ts` | The season view shows the two bonds and the two windows. `checkSeason` refuses to buy a run in a season whose `challengeWindow` is under the network's floor: 30 h on Arbitrum One, the 24 h force-inclusion delay plus 6 h. The page also refuses to claim while the referee's emergency stop is paused. |
| `web/src/chain/contracts.ts`, `web/src/chain/bindings/` | Wrappers, and bindings regenerated from `contracts/abi/` |
| `web/test/verdict.test.ts`, `web/test/watch.test.ts` (new) | The verdict against the settlement and deadline fixtures; a forged level is found; a journal that replay rejects is found |

Training still imports nothing from `web/src/chain`.

### 6.3 Scripts, workflows and tests

| File | Change |
|---|---|
| `scripts/contracts/season.mjs` | Four season keys. `open` checks `grace ≥ challengeWindow + defenseWindow + 1,080 + commitSlack` and the network's floor. `watch` replays each standing claim natively (`jiro-tools replay`) and sends `challenge` from `WATCHER_KEY`; for a forged claim found after its window, it reports the level to prove (B4). `defend` proves the challenged level of each open challenge whose level replays to the claimed result, and sends `settleLevel`. `resolve` collects the watcher's lapsed challenges. `status` adds claims, open challenges, `bondsHeld` and `Challenge.isSolvent`. The `settle` command of plan M5.5, which would prove every best run, is not built. |
| `.github/workflows/season-ops.yml` (plan M5.5, not built yet) | Hourly `watch` and `resolve`. `defend` dispatches `zk-prove.yml` for one level. Daily `status`, `close` and `withdraw`. |
| `.github/workflows/zk-prove.yml` | Takes a run file and a level index |
| `scripts/contracts/e2e.mjs` | New cases: a claim stands with no proof; a forged claim is challenged and rejected; a false challenge is refuted with a dev-mode level proof; bonds are withdrawn |
| `contracts/abi/` | Regenerated for `Challenge` and `Season` |
| `contracts/test/Claim.t.sol` (new), `Invariant.t.sol`, `Season.t.sol`, `Challenge.t.sol` | The branches of [§5.2](#52-every-dispute-branch); claim actions and the invariants of [§4.5](#45-invariants); `voidRun` and the terms' ranges; `RunJournals` |

A defense on GitHub's runners assumes the repository is public, with 4-vCPU runners (repo). The private plan's runners have 2 vCPUs and 7.9 GB and prove about 2.2 times slower (repo), so a heavy level would pass the 6-hour limit. Until the repository is public, a defense runs on the owner's machine.

### 6.4 Documents

| File | Change |
|---|---|
| `README.md` §7.2 | Step 3 becomes commit and claim. A new step describes the challenge and the defense. Settlement becomes the dispute path, and the path of runs without a claim. |
| `README.md` §7.3, §8.4 | "Verify by exception" becomes "claim, and verify on dispute". "Computed, never claimed" becomes: a client's results are a bonded claim, and the core, through the referee, decides every dispute. P5 gains the log. |
| `README.md` §7.5, §8.4, §13 | The proving service shrinks to defenses. Four parameters, the grace derivation, and "best run" as the best settled run or standing claim. A new decision records the owner's choice. |
| `docs/ECONOMY.md` | Money flow: bonds, held by `Challenge`. Costs. New threat rows: forged claim, false challenge, mass false challenges, watcher capital, short challenge window, paused verifier. The rows "forged score" and "the operator is the only prover" are rewritten. |
| `docs/VERIFICATION.md`, `docs/DEPLOYMENT.md`, `deployments/README.md` | Claim gas; generation 2 |
| `IMPLEMENTATION_PLAN.md` | New items for the two contracts, the watcher and the e2e. M5.5 loses `settle` and gains `watch`, `defend` and `resolve`. M5.3's zk branch changes. |
| `seasons/testnet-1.json` | The four keys |
| `.claude/skills/onchain-referee/SKILL.md` | "Never accept a score from the client" becomes: a client's result is only a bonded claim, which the referee can overturn until the season's settlement ends |

## 7. Parameters

| Parameter | Proposal | Derivation |
|---|---|---|
| `claimBond` | 0.0003 ETH: 6 run fees, $0.69 | It pays the winner of a dispute, so it covers two costs. (a) A watcher's whole cost: `challenge` 94,851 gas, `resolveChallenge` 70,373 and `withdraw` 40,488 (prototype), 205,712 gas in all. That is 0.0000041 ETH at 0.02 gwei, and 0.00021 ETH at a base fee 50 times higher. (b) On Stylus, re-executing the heaviest level: 11,599,408 gas (repo), 0.000232 ETH. |
| `challengeBond` | 0.0003 ETH | It pays the defender. A level proof on Boundless costs 0.0000184 ETH at the median, and 0.000055 ETH for the dearer request type (repo). `settleLevel` adds about 530,000 gas ([§8](#8-costs)). Together 0.00003 to 0.00007 ETH, covered 4 to 10 times. On a rented machine with 4 vCPUs and 16 GB at about $0.19 per hour (estimate), a typical level of about 12 segments takes 1.6 h and costs 0.00013 ETH; the heaviest, 3.9 h, costs 0.00032 ETH. It must not exceed `claimBond`: see watcher capital in [§10](#10-weaknesses). |
| `challengeWindow` | 36 h (129,600 s) | The sequencer's force-inclusion delay, about 24 h (lead), plus 12 h for a watcher to notice and submit. Under 24 h, a censoring sequencer could keep every challenge out. |
| `defenseWindow` | 36 h (129,600 s) | 24 h of force-inclusion delay, plus the heaviest level's proof on 4 CPUs, 3.9 h (30 segments × 467 s + 170 s, repo), plus 8 h to notice, queue and build |
| `grace` | 76 h (273,600 s), against the 48 h proposed today | `challengeWindow + defenseWindow` is 72 h. The season's last run commits up to 1,274 s after the end: 74 s of reveal window at 0.25 s per block, 1,080 s of play and 120 s of slack. About 3.6 h of margin remain. A claim made later than end + grace − 72 h reverts with `ClaimTooLate`. |
| `commitSlack`, `minClears`, fee, rake, length | unchanged | |
| The watcher's wallet (operations, not a contract parameter) | at least the players' pot expected at the season's end | Watcher capital, in [§10](#10-weaknesses) |

## 8. Costs

Gas is the whole transaction's, metered as the repository's `ChallengeGas` and `SettlementGas` tests meter theirs. My run of the unmodified suite reproduced the repository's figures to the unit: 666,564 for `settleRun` and 99,113 for `commitRun`.

| Step | Gas | ETH at 0.02 gwei | Source |
|---|---:|---:|---|
| `commitRun`, typical journals (1,604 B of calldata), today | 99,113 | 0.0000020 | repo |
| `commitRun` with the `RunJournals` log: typical journals; six full journals | 115,586; 1,277,515, against 864,133 today | 0.0000023; 0.0000256 | prototype |
| `commitAndClaim`, typical journals, a player's first claim of the season | 265,187 | 0.0000053 | prototype |
| `commitAndClaim`, typical journals, replacing the player's own standing claim, with no ETH sent | 261,261 | 0.0000052 | prototype |
| `commitAndClaim`, six full journals (49 KB) | 1,461,316 | 0.0000292 | prototype |
| `challenge` | 94,851 | 0.0000019 | prototype |
| `resolveChallenge` | 70,373 | 0.0000014 | prototype |
| `withdraw`: of a credit; releasing one bond | 40,488; 77,863 | 0.0000008; 0.0000016 | prototype |
| `settleLevel` refuting a challenge, with `MockReferee` | 300,761 | | prototype |
| The same through `ZkReferee` and the emergency stop | about 530,000 | 0.0000106 | estimate: 300,761, less about 15,000 for the mock's frame, plus 235,730 and 5,785 (repo) |
| The same on Stylus | 5.4 to 11.9 million | 0.00011 to 0.00024 | estimate: the prototype's figure without the mock, plus 5.1 to 11.6 million (repo) |
| `settleRun` with a run proof, today | 530,256 to about 804,000 | 0.0000106 to 0.0000161 | repo |

The very first claim of a `Challenge` contract takes 299,387 gas (prototype), since it writes `bondsHeld` and the season's points from zero. A run with no claim settles as today, for about 5,000 gas more: `settleRun` takes 671,619 gas in the prototype against 666,564.

### Per run, in the normal case

| | Today | With claims |
|---|---|---|
| Player | 294,383 gas for the three transactions (repo): 0.0000059 ETH, 12% of the fee | 460,530 gas (prototype): 0.0000092 ETH, 18% of the fee; and 0.0003 ETH locked for 36 h, then returned |
| Operator, per best run | 804,194 gas and one proof: 0.0000345 ETH, 69% of the fee (repo); 9 to 17 h on 4 CPUs if it proves on its own machine (repo) | nothing |
| Proofs per season | one per player | none |

A claim costs the player 166,074 gas more than today's commit: 0.0000033 ETH, under a cent.

**An illustration.** Take a season of 200 players and 1,500 runs. Today the operator makes 200 proofs: 0.0069 ETH, against a 10% rake of 0.0075 ETH; proving on one 4-CPU machine would take about 2,000 hours. A machine that starts when the season ends settles about five best runs in the 48 h of grace, at 9 to 11 h per bot run (repo), which is why plan M5.5 leaves the proving route open. With claims there is no proof, and the players' 200 to 600 claims cost them 0.0007 to 0.002 ETH in all.

### In a dispute

| Branch | Onchain | Proving | Paid by |
|---|---|---|---|
| B1, a forged claim | 165,224 gas for `challenge` and `resolveChallenge`: 0.0000033 ETH | none | the forger's bond |
| B2, a false challenge, on zk | about 530,000 gas: 0.0000106 ETH | One level: 15 to 30 segments for the gate set's journals, 2.0 to 3.9 h on 4 CPUs with 9.2 GiB and x86 Docker (repo); or about 0.0000184 ETH on Boundless (repo), a thin market that the project has never used | the challenger's bond |
| B2, a false challenge, on Stylus | 5.4 to 11.9 million gas: 0.00011 to 0.00024 ETH | none | the challenger's bond |
| B4, a direct proof | as B2 | as B2 | the forger's bond, while it is locked |

## 9. Security assumption

**No wrong payout** holds if both of these do:

1. For every false claim, at least one of:
   - **A watcher lands `challenge` on a wrong level within `challengeWindow`.** A watcher is any browser tab or script that has the journals, which are in the logs, the 16 levels, the core, 0.0003 ETH, and an RPC that tells the truth. If the sequencer halts or censors, the watcher must go through the L1 delayed inbox within `challengeWindow` − 24 h = 12 h of the claim.
   - **Someone proves a level of the run at its true Outcome before end plus grace** (B4). This cannot work for a journal that replay rejects, which has no proof: for those, only the challenge works.
2. As today: RISC Zero's Groth16 verifier and the pinned image are sound, so no false claim can be defended; the season's levels are valid; and the season's parameters, which now include the challenge window, are those the player checked before paying.

**An honest player is paid** if their claim is true and one of these holds:

- nobody challenges it; or
- somebody, anybody, settles each challenged level through the referee before its challenger resolves, which is at least `defenseWindow` after the challenge; or
- failing that, somebody proves the whole run before end plus grace. The prize is kept, and the 0.0003 ETH bond is lost.

**Compared with today.** Today no wrong payout is possible while the proof system is sound: no watcher, no window. And a player is paid only if somebody proves their best run before end plus grace, which in practice means the operator, for every player. With claims, safety gains a liveness assumption: one honest, funded watcher per false claim. Payment loses one: no prover unless challenged. Neither path trusts a signer or an oracle: watching, challenging, defending and resolving are open to anyone.

## 10. Weaknesses

Most serious first.

1. **A forged claim that nobody challenges in 36 h is paid,** unless someone proves a level of it wrong before end plus grace, which costs a level proof and earns nothing once the bond is released; for a journal that replay rejects, no such proof exists. Today this cannot happen. The watchers are thin: the players' tabs are open only while they play, and can only alert, since a challenge needs a wallet confirmation; the operator's hourly job is a schedule on somebody's infrastructure. A watcher also believes its RPC: a lying RPC can hide a claim, or make an honest one look forged.
2. **A false challenge costs an honest player a prover's time, or the bond.** On zk the player cannot defend from the browser. The defense is one level proof, 2.0 to 3.9 h on 4 CPUs (repo), paid 0.0003 ETH by the challenger. If nobody defends within 36 h, the player loses 0.0003 ETH, and the run too unless somebody proves it before end plus grace.
3. **Mass false challenges pay when most go undefended.** The challenger gains one claim bond for each undefended challenge and loses one challenge bond for each defended one, so with equal bonds the attack profits when fewer than half are defended. One 4-CPU machine defends 9 to 22 levels in 36 h (repo's rates). Twenty parallel jobs on public runners would defend about 180 (estimate; GitHub's limit was not checked). Beyond that the defense needs rented machines or the proof market, which the forfeited bonds pay for, but which somebody must operate. Raising `challengeBond` alone moves the break-even, and opens the next weakness.
4. **Watcher capital can be exhausted.** Each challenge locks 0.0003 ETH for up to 36 h. An attacker who posts N forged claims burns N × 0.00035 ETH, the bond and the fee, and forces watchers to lock N × 0.0003 ETH. Once the watchers' wallets are empty, later forged claims pass. The attack burns more than the capital it exhausts, and the watchers keep the forfeited bonds, so it pays only if the pot is larger than the watchers' total capital. Hence the operator's watcher should hold about the pot, and `challengeBond` must not exceed `claimBond`.
5. **The bond and the wait.** A first run needs 0.00035 ETH instead of 0.00005. The bond is locked for 36 h, though it carries over to the player's next better claim. Grace grows from 48 h to 76 h, so payouts come 28 h later.
6. **With the verifier paused, challenges cannot be answered** (B11). Claims younger than 36 h can be knocked out for their bonds. Today a pause loses the whole season's settlement, which is worse for everyone, but takes nobody's bond.
7. **The operator chooses the windows.** A season opened with a challenge window of one second makes forged claims unchallengeable. The parameters are public and fixed at `open`, and the page refuses a window under 30 h, but a player who uses another client must look. Today the operator's lever is the referee; this adds one.
8. **A sequencer halt or censorship of more than 12 h** right after a forged claim defeats ordinary challenges: the watcher must go through L1 in time. A longer `challengeWindow` buys margin, at the cost of weakness 5.
9. **More contract, and a second contract that holds ETH.** `Challenge.sol` grows from 288 lines to 585 in the prototype, and holds bonds where today it holds nothing. `Season` gains `voidRun`, which removes points. Both need the audit that is already a pre-mainnet prerequisite, and the prototype is not reviewed code.
10. **The watcher's verdict repeats `Challenge.checkOutcome` outside the contract,** in the page and in the operator's script. These are bindings, not game rules, but a watcher that disagrees with the contract either misses a forgery or loses its bond. Shared fixtures must pin the three.
11. **A defense still needs real proving hardware:** 9.2 GiB, x86 Docker, and hours. At the size of a level it fits a CI runner. It does not fit a browser.
12. **Whoever submits the defense proof first takes the challenge bond.** A proof copied from a public mempool could be front-run. Arbitrum's sequencer has no public mempool, as far as I know, so this is theoretical there.
13. **Every commit pays 16,473 gas more** for the journals in the log, claimed or not.

## 11. What I considered and rejected

### A whole-run challenge instead of a per-level one

It is simpler: the claim is three numbers (score, ticks, clears), with one challenge slot, and a defense is `settleRun`. I designed it first. It fails on the defender's cost:

- A whole run is 67 to 131 segments, 8.7 to 17 h on 4 CPUs (repo). It does not fit GitHub's 6-hour job (repo), so every false challenge would need the owner's machine or the market.
- On Stylus a defense would be six transactions, 33 to 51 million gas (repo).

Per-level claims cost one more storage slot (22,100 gas) and about 100 more lines. They make the defense 4 to 6 times lighter, the size of a CI job, and the same on both backends.

### A Merkle root of per-tick state hashes in the claim

Committing it is cheap. The wasm replay already computes the 15,240 state hashes of the heaviest run in 120 ms (lead), a tree adds a few milliseconds (estimate), and the root adds 32 bytes. Using it is the problem.

- **A root does not let a challenger open anything.** To show "your leaf t−1 is this state, and your leaf t is not its successor", the challenger needs Merkle paths in the claimant's tree. When the trees differ, the challenger knows only its own. So one of two things is needed:
  - **The trace onchain.** 2,700 hashes are 86,400 bytes per level. A bot run of 3,200 to 4,700 ticks (repo) would publish 102 to 150 KB of incompressible data: above the sequencer's 95,000-byte transaction limit (repo), and 1.6 to 2.4 million gas of calldata, 65% to 96% of the run fee before the L1 data fee.
  - **An interactive bisection.** 12 rounds for 4,096 leaves, two transactions per round with a timeout each, then the one-tick step. That is days per dispute, about 1.3 million gas (estimate), and a responder that is always on: an honest claimant who sleeps loses on a timeout, unless anyone may answer for them.
- **Proving the right root instead** means hashing the state on every tick inside the zkVM: about 165,000 cycles per tick. The test-only trace guest takes 448 million cycles for 2,700 idle ticks, where the verify guest takes 2 million (repo). On the gate set's heavier journals that is 15 to 30 times a level's proof.

### A single-tick referee

**On zk.** One tick is about one segment, as the lead says, when the mask is given: restoring the state (0.05 to 0.1 million cycles, estimate), the tick (0.5 million for a capture and 330 for an idle tick, lead), and two state hashes (0.33 million, repo). Binding the mask to the committed journal adds up to 1.2 million cycles for a full journal's keccak (estimate). So 1 to 3 segments: 10 to 29 minutes on 4 CPUs, against 2.0 to 3.9 h for a level. But:

- it still needs 9.2 GiB, or 4.6 GiB with 2^19-cycle segments, and the Docker wrapping, so it does not bring proving to the browser;
- on the proof market it changes nothing: the price barely depends on cycles (repo: R² 0.19);
- it needs the bisection above to find the tick;
- it needs new consensus code, below.

**On Stylus.** One tick would cost roughly 0.1 to 0.6 million gas (estimate: the measured one-tick replay takes 313,515 gas with the level setup, and a capture adds about 180,000), against 5.1 to 11.6 million for a level (repo). That saves at most 0.00022 ETH, $0.50, per dispute, and still needs the bisection. A whole level already fits one Stylus transaction, with no interaction and no new code: `settleLevel` as it is.

**What it would add to the core.** Only an encoder of the preimage exists (`core/src/hash.rs`). `tools/src/preimage.rs` prints the fields for diagnosis and builds no `Game`. Restoring one is more than decoding 948 bytes:

- The preimage leaves out what a tick needs: the boss's deflection key, which comes from the level seed, so the run nonce and the level index become inputs; each minion's spawn cell and the respawn delay, the target and the time limit, which come from the level bytes; and `end`.
- Its tick field is `ticks_used − 1`, saturating, so the state before tick 0 has no preimage. Tick 0 must start from `Game::new`, the 1.1 million-cycle setup (repo).
- The boss's size and period, the minions' period and the claimable count are in both the preimage and the level, and must be cross-checked.
- A restored state must be validated field by field: a cell value of 3, a direction above 4, a velocity other than ±1, a destroyed minion with a cell. In a bisection the claimant chooses the leaf, and the referee needs a defined answer for a state that no game reaches.
- The last tick's end reason is the return value of `step`, not a field. The one-tick statement must output it, and the claim must be checked against it.

This code would live in the one core, so it respects the one-implementation rule to the letter. But it is consensus code that play never runs, a new byte format for the trace tree with its vectors, a new guest with a new image id, a bisection contract of a few hundred lines, and a responder. A bug in the restore would be a provable "fraud" by an honest player, or a forgery that nobody can prove. Disputes should be rare, and the loser's bond pays for them, so this buys little for a small team.

### A guest that proves rejections

A verify program that commits replay's error code, instead of panicking, would let a prover disprove a claim on a journal that replay rejects (B4 does not cover those). It is a small guest change, but a new image id and a new `ZkReferee` path. The bonded challenge already covers the case with no proof at all, so I left the guest alone.

### Proving in the browser

Not with RISC Zero 3.0.6: see [§1](#1-verdict). A circuit written for a browser prover would be a second implementation of the rules, which the owner rules out.

### Sending part of a forfeited bond to the pot

It would make a forger's self-challenge cost something. It needs money logic in `Season`: a forfeits account, and a rule for forfeits that arrive after the close. A self-challenge only recovers the forger's own bond, from a claim that fails anyway, so I left `Season`'s money untouched.

## 12. When Stylus activations return

Nothing in `Challenge` or `Season` changes. A season opens with the Stylus referee, and `ZkReferee` seasons keep settling through their own.

- **A forged claim is rejected in one transaction, from a browser, with no bond and no wait.** Anyone calls `settleLevel` on the wrong level with an empty proof. The referee replays it for 5.1 to 11.6 million gas (repo) and returns the true Outcome, and the claim is rejected (B4). The claim bond repays the gas.
- **A false challenge is refuted the same way,** by the player's own browser.
- **The bonded challenge stays for one case:** a journal that replay rejects makes the referee revert, so `settleLevel` reverts and proves nothing. The challenge then lapses, as on zk.
- **Nobody needs a prover, in any branch.** Weaknesses 2, 3 and 11 go away. Weaknesses 1 and 4 remain.

A Stylus season should set both bonds nearer 0.0005 ETH: at 0.0003 ETH they cover the heaviest level only 1.3 times at 0.02 gwei. The pause, the constitutional vote and the audit per contract are outside the project's control, so nothing in this design depends on them.

## 13. Prototype evidence

I built the two contracts and their tests in the scratchpad, outside the repository, with Foundry 1.8.6 and solc 0.8.28, the repository's pins:

`scratchpad/design/proto/contracts`

It is the repository's `contracts/` without `ZkReferee`, which does not change, with `src/Challenge.sol` and `src/Season.sol` modified as specified here, and two new test files. To run it: `PATH=<design>/tools:$PATH forge test` from that directory.

- **Baseline.** The unmodified copy passes its 196 tests, and reproduces the documented gas to the unit.
- **Regression.** With the changes, and claims off in the tests' default season, the same 196 tests pass. One assertion of the shared fixture changed: `Challenge` holds its bonds, where it held no ETH.
- **`test/Claim.t.sol`.** 32 tests, one scenario each, over the calibration season and the gate-set vectors' Outcomes: branches B1 to B9 and B12 of [§5.2](#52-every-dispute-branch), the refusals of each function, and 12 gas measurements.
- **`test/ClaimInvariant.t.sol`.** The invariants of [§4.5](#45-invariants) under random sequences of 20 actions: 192 sequences of 250 calls, 48,000 calls, with no revert and no violation. One further sequence of 2,500 calls logged what it reached: 70 claims, 27 of them forged, 28 challenges, 9 lapsed resolutions, 11 settlements of a challenged level, 39 other settlements, 70 bond releases, 24 season closes and 21 payouts. It reached no `claimRun` and no reinstatement that changed the ranking; unit tests cover those two.

It is a prototype: not reviewed, not linted to the repository's rules, and never run against `ZkReferee` or a Stylus node. B10 rests on check 4 of `claimRun`, which one test covers. B11 was not tested.

## 14. Questions for the owner

1. Is a refundable bond of 0.0003 ETH, six times the fee, acceptable for players? Halving it halves what a challenge bond can pay a defender.
2. Are 36 h and 36 h acceptable, with payouts 28 h later than the 48 h proposal?
3. The operator's watcher needs a hot key that holds about the pot's value. Who holds it?
4. Is the journals log, 16,473 gas per commit, acceptable as a change to P5?
5. The name: "claim" already means two other things in the repository.
