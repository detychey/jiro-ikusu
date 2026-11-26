# Optimistic settlement, safest form: accuse, then prove

Design study of 2026-11-10 on the repository at `f52a60a`. Priority: the safest optimistic design, with the fewest assumptions and every party treated as adversarial. Nothing here is implemented, and no Solidity was compiled (the session has no forge): gas figures for new functions are estimates, and they say so.

Tags on numbers: **(R)** measured in the repository's documents, **(L)** measured by the lead today, **(M)** measured by me today with the native core and the wasm build, **(E)** my estimate.

Words: a *claim* is the six Outcomes a player posts for a committed run. The contract functions say `post…Outcomes`, because `Season.claim` already names the payout and `claim_bp` the captured share.

## 0. Verdict

1. **The form in the brief is a bad idea under this priority.** In that form a claim with a bond becomes final unless a challenger proves it wrong with a level proof. Safety then rests on a prover being available for every wrong claim inside the window, and the claimant chooses how heavy that proof is. I built a journal that the core accepts and that is 12 times slower to replay natively than the heaviest gate-set journal (M), with an estimated 451 million zkVM cycles against 29.6 million (E): 42 to 60 hours of proving on 4 CPUs for one level, where the brief counts 2 to 4. The same journal would need about 162 million gas on Stylus (E), five times the 32 million a transaction may use, so on Stylus it could not be disputed at all. Section 2 has the details.
2. **The safest optimistic form puts the proof on the claim's side.** Anyone who replays the public journals may *accuse* a level with a small refundable deposit and no proof. The claim stops counting at once. It counts again only if someone proves that level with the level proof that exists today. A wrong claim can never be proven, whatever its journal costs to prove, so stopping it needs a watcher and a transaction, never a prover.
3. **What it costs in trust.** One new assumption: for every wrong claim, some party other than the cheater replays it and lands one cheap transaction within the accusation window. Today nothing of the kind is assumed. A wrong claim costs about one run fee to try, so assume every lapse of the watchers gets found. If that assumption is not acceptable, no optimistic design is, and the present design should stay.
4. **What it does not cost.** An honest player can never lose money to it, the operator cannot take or burn anything, a paused verifier cannot cause a wrong payout, and whatever attack voids a claim leaves exactly today's path open: `settleRun` with a run proof.
5. **The prover does not go away.** It moves from every paid run to accused runs only, and it stays the fallback.

The brief's questions, in its order:

| Question | Answer | Section |
|---|---|---|
| Who may claim | Only the run's player, normally inside the commit transaction. | 3.1 |
| A journal that replay rejects | Nothing new is needed. It is accused like any wrong claim and can never be defended, because the guest has no proof for it. | 3.2 |
| What a fraud proof must show | There is none: an accusation is a level index. The proof in a dispute is a defense, today's level proof returning exactly the claimed Outcome under `settleLevel`'s checks. | 3.3 |
| Bonds and rewards against proving costs | No claim bond. The accuser's deposit, one run fee, pays for the defense it may force, 1.76 times a market proof plus gas, and goes to the defender. | 3.5 |
| The window against 24 h of censorship and hours of proving | Two periods. Accusation, 96 h: watching and forced inclusion, no proving. Defense, 72 h: noticing, two proving attempts, forced inclusion. | 3.5 |
| Pending claims at end + grace | None can exist: a claim is accepted only if both periods fit before it. | 3.2 |
| The verifier is paused | Wrong claims still die. Defenses stop, so accusations become vetoes. Claims nobody accuses are still paid. | 3.2 |
| The assumption that remains | One independent watcher per window, on top of today's. | 3.10 |

## 1. Facts the design rests on

| Fact | Value | Source |
|---|---|---|
| Groth16 verification | 227,591 gas; 5,785 more through the emergency stop | R, `docs/VERIFICATION.md` |
| `ZkReferee.verify` (one level), own frame | 235,730 gas | R |
| `settleLevel` without the referee, 4,996 B of calldata | 154,050 gas | R |
| `settleRun` without the referee, 25,636 B of calldata | 576,603 gas | R |
| `commitRun`, typical and full blob | 99,049 and 864,069 gas | R |
| `startRun`, `revealRun` | 131,898 and 63,284 gas | R |
| One verified run today | 804,194 gas + 0.0000184 ETH of proving = 0.0000345 ETH, 69% of the fee | R |
| Base fee, Arbitrum One on 2026-11-02 | 0.020036 gwei: 1M gas is 0.00002 ETH | R |
| CPU proving on 4 CPUs | 295 to 410 s per 2^20-cycle segment, 43 to 57 s of recursion per segment, 122 to 172 s of Groth16, 9.2 GiB | R, `docs/VERIFICATION.md`, `docs/DEPLOYMENT.md` |
| Heaviest gate-set level, `10-worst` | 29,588,717 user cycles, 30,932,992 proving cycles | R |
| Proof price on Boundless | 0.0000184 ETH median, 0.0000138 to 0.0000233 p10 to p90, whatever the cycles; thin market, never used here | R |
| Stylus `verify` per heavy level | 5.1M to 11.6M gas | R |
| Forced inclusion on Arbitrum One | about 24 h | L, not rechecked |
| Browser replay of the heaviest gate-set run, with a state hash per tick | 120 ms | L |
| `10-worst` replay: native, and the wasm build in Node 22 with a state hash per tick | 2.32 ms and 22.3 ms | M |
| `10-worst`: capture ticks, cells flood-filled by its captures | 113 and 142,387, the most of the 71 accepted vectors | M |
| Two human journals of `reports/playtest-human-1/` | 4 and 5 captures, 6,653 and 9,907 flood-filled cells | M |
| Crafted journal on `levels/01-open.bin` (section 2) | 928 captures, 2,689,218 flood-filled cells, native 27.2 ms, wasm 60.3 ms, accepted by `jiro-tools replay` | M |
| Cycle model over the 71 accepted vectors | user cycles = 1,097,892 + 13,217 per capture + 161.9 per flood-filled cell + 343.6 per tick + 470.7 per event + 28.2 per boss edge cell + 259.2 per minion move; R² 0.9996 | M for the drivers, R for the cycles |

The model agrees with the lead's figures: 1.1 million cycles of setup, about 330 per idle tick, and about 0.5 million for a capture on an open field (13,217 + 161.9 × 3,329 = 552,000). Fitted only on the 40 vectors with at most 20,000 flood-filled cells, it predicts the 31 heavier ones within −1.4% to +6.3%, so it extrapolates.

## 2. Why the challenger must not be the one who proves

### 2.1 The claimant chooses the cost of the fraud proof

A capture runs a flood fill from the boss and one pass over the 3,600 cells (`core/src/capture.rs`). Its cost follows the open area, not the cells captured. A cut of one cell, closed by stepping back onto the cell it left, is a full capture. The gate-set journals are the bots' longest runs and a scripted policy of small captures: 113 capture ticks at most.

`measure attack` (appendix) plays such cuts with a 60-line greedy policy: walk to the left wall, cut into an `EMPTY` neighbor, step back, move on, and wait a tick whenever the core says a move would cost a life.

| Journal | Level | Capture ticks | Flood-filled cells | Native replay | wasm, a state hash per tick | User cycles | Stylus gas |
|---|---|---:|---:|---:|---:|---:|---:|
| `10-worst`, heaviest of the gate set | `10-maze` | 113 | 142,387 | 2.32 ms (M) | 22.3 ms (M) | 29,588,717 (R) | 11,599,408 (R) |
| `worst-case` | synthetic | 63 | 128,992 | 3.43 ms (M) | 21.1 ms (M) | 27,762,031 (R) | 10,632,722 (R) |
| crafted | `01-open` | 928 | 2,689,218 | 27.2 ms (M) | 60.3 ms (M) | about 451 million (E) | about 162 million (E) |
| crafted | `03-heavy` | 924 | 2,679,476 | 28.2 ms (M) | 58.5 ms (M) | about 450 million (E) | about 162 million (E) |
| crafted | `10-maze` | 1,006 | 1,726,279 | 19.7 ms (M) | 48.4 ms (M) | about 298 million (E) | about 114 million (E) |

- The crafted journal on `01-open` ends on the time limit with 2,764 bp claimed and all 5 lives: it never clears, so the level never ends early. `jiro-tools replay` accepts it.
- 451 million user cycles are 471 to 483 million proving cycles, 449 to 461 segments: **42 to 60 hours on 4 CPUs for that one level** at the repository's measured rates (E), then the Groth16 step. On a 2-vCPU runner, more than twice that.
- The policy writes that journal in under a second on one core, well inside the commit deadline, which only bounds wall time by the level's time limit. The result is the same for the three run nonces tried: on `01-open` the boss never reaches the left wall in time to matter.
- The policy is not tuned. Its pattern is three captures in seven ticks, about 1,150 in 2,700 ticks if nothing interrupted it (E). It does not dodge minions: on `02-sentry`, `07-rush` and `13-trio` it runs out of lives after 806, 441 and 199 captures, which still flood-fill 2.4 million, 1.4 million and 0.65 million cells (M), 4.6 to 17 times `10-worst`. Running out of lives does not matter to a claimant who lies about the Outcome anyway.

**Today this hurts only its author:** the operator may skip a run that costs days to prove. **In the brief's optimistic form it hurts everyone:** the challenger must prove that level or the wrong claim is paid. Several such claims from several wallets multiply the work.

### 2.2 What the brief's form would need, and still assume

| Need | Why |
|---|---|
| A new guest program that proves rejections | Today a rejected journal has no proof at all |
| A work budget inside that program | To bound the fraud proof. With 160,000 flood-filled cells per level, just above `10-worst`'s 142,387, the worst proof is about 35 million user cycles, 3.3 to 4.6 h on 4 CPUs (E) |
| A bond near 0.003 ETH, 60 run fees (E) | Twice the cost of a rented 4-CPU machine for the proof, about 0.00065 ETH at cloud prices I assume, plus 350,000 gas at a fifty-fold fee spike, plus a part that is not paid to the challenger, so that a cheater who races his own challenger still pays |
| A window of 96 h or more that contains the proving | Detection, two proving attempts, 24 h of forced inclusion |
| Voiding the season if the verifier is paused at its close | A paused verifier leaves pending wrong claims without any possible fraud proof |

And it would still assume a prover-capable challenger for every wrong claim, which in practice is the operator alone: an absent or dishonest operator then means theft, where today it means no payout. It would also put honest bonds at risk: if the browser build and the guest ever disagree, the honest claimant is the one slashed.

### 2.3 Interactive bisection

Not considered further: it ends in one tick that must be executed onchain (Solidity is a second implementation, Stylus is paused) or proven, it needs a state decoder that does not exist (only the 948-byte encoder does), each of its dozen rounds needs more than the 24 h censorship bound, and an honest claimant would have to stay online to answer.

## 3. The design

### 3.1 Roles

| Role | Who | What they need |
|---|---|---|
| Claimant | Only the run's player | The browser: it already holds the journals and replays them in milliseconds |
| Watcher, accuser | Anyone | The public journals, the core (browser or CLI), the deposit, gas for one transaction |
| Defender | Anyone | A prover: the operator's machine, a proof market, or re-execution on Stylus |
| Settler by proof | Anyone, as today | A prover |

**Only the player claims.** A third party who could claim for a rival would post a wrong claim on the rival's best run; any watcher would accuse it, and the run would lose the optimistic path. `commitRun` is already the player's alone, and the claim normally rides in the same transaction.

### 3.2 Lifecycle

```text
commit + claim ──────────────── accusation window, 96 h ────────────────▶ final, with no transaction
       │
       └─ accuseLevel(i), any time in the window: the claim stops counting in that block
              │
              ├─ defendLevel(i) within 72 h, with a level proof equal to the claim:
              │      the accuser's deposit goes to the defender; the claim counts again
              │      once no accusation is open; level i cannot be accused again
              │
              └─ no defense within 72 h: the claim is void for good; the accuser takes
                     the deposit back; settleRun with a run proof stays open until end + grace
```

1. **Pay and reveal**, as today.
2. **Commit and claim.** `commitRunWithOutcomes(runId, journals, outcomes)` commits as `commitRun` does, emits the journals in an event, and posts the six Outcomes the browser computed. The contract checks what it can without the rules: each Outcome's `journalHash` is the committed one, its run nonce, level index, mode and rules version are the run's, its level id is the season's level in its draw slot, and the run is on time by the claimed ticks. The run counts at once as the player's pending result. `postOutcomes(runId, outcomes)` does the same later for a run that was only committed.
3. **Watch.** For 96 h anyone may replay the journals on the levels the run's nonce draws and compare. The first level whose Outcome differs, or whose journal replay rejects, is accused with `accuseLevel(runId, i)` and the deposit.
4. **Final.** With no accusation, the claim is final when the window ends. Nothing more is sent: the payout after the close uses it.
5. **Defend.** `defendLevel` takes the level proof of today's verify program (or nothing on Stylus, which re-executes). The proven Outcome must equal the claimed one, under the checks `settleLevel` applies today.
6. **Void.** An accusation with no defense within 72 h voids the claim. Nobody is slashed. The run keeps today's path.

Every branch:

| Case | What happens |
|---|---|
| Wrong score, claim, ticks or end reason | The watcher's replay differs: accused. No proof of the claimed Outcome exists: void. |
| A journal that replay rejects, garbage included | Accused. The guest panics on it, so no proof exists: void. No new proof type is needed. |
| A wrong draw: an easier level claimed | The contract cannot check the draw. The watcher replays on the drawn level: replay rejects the journal's level id (code 12). A defense would need an Outcome whose draw slot is the submitted level's, which the core never returns for another level: void. |
| A late run claimed with fewer ticks | A wrong Outcome: accused, void. Claimed with its true ticks: `postOutcomes` reverts, nothing is posted. |
| A correct claim accused | Defended by anyone with a prover; the accuser loses the deposit to the defender. With no defender in 72 h: void, and the run needs a run proof, as every paid run does today. |
| Several levels accused | One deposit and one deadline each. Every one must be answered. Accusations stay open on the other levels until the window ends, even while the claim is accused. |
| An accomplice accuses a correct level of a wrong claim, and the cheater defends it | The wrong level stays accusable until the window ends, and a watcher accuses a wrong level whether or not another level is accused. An accusation of a wrong level is fatal whoever sends it: it cannot be withdrawn, and it cannot be answered. |
| The player posts a better run while his claim is in its window | The earlier claim is withdrawn and its run can be claimed again later. The new claim gets a full window. |
| The player's earlier claim is final | It is kept as his best. The new claim is pending beside it. |
| The player's claim is accused | It cannot be withdrawn, so a defender's proof is never wasted. He may post another run meanwhile. If the accused claim is later defended and ranks above the newer one, it replaces it. |
| A claim posted too late | `postOutcomes` reverts unless a full accusation window and a full defense period fit before end + grace. The run still settles by proof. |
| End + grace | Nothing can be pending: see the row above. `closeSeason` and the payout run as today, on what counts then. |
| The verifier is paused | Accusations need no verifier: wrong claims still die. Defenses and `settleRun` stop, so every accusation becomes a veto. Claims nobody accuses are still final and paid. |
| The sequencer censors an accusation | The watcher forces it through the L1 inbox: about 24 h, inside the 96 h. |
| The accuser never comes back | The deposit stays in `Challenge`. |
| `settleRun` or `settleLevel` on a run with a standing claim | Reverts. On a void or withdrawn claim: as today. |

### 3.3 What a dispute proof must show

There is no fraud proof. An accusation is a level index.

A **defense** of level `i` of run `r` is a call that passes, in this order:

1. the six Outcomes passed hash to the stored claim;
2. `keccak256(journal)` is `outcomes[i].journalHash`, which the claim bound to the run commitment;
3. `keccak256(level)` is one of the season's 16 level ids, which gives its slot and weight;
4. `referee.verify(level, journal, weight, proof)` returns an Outcome `P`; on zk, the Groth16 seal verifies under the pinned image id, and `P.journalHash` and `P.levelId` are the two hashes;
5. `P` has the run's nonce, level index `i`, mode 1, the season's rules version, and the draw slot of the submitted level;
6. `P` equals `outcomes[i]` in all eleven fields.

Steps 2 to 5 are `settleLevel`'s today (`verifyLevel` and `checkOutcome` in `contracts/src/Challenge.sol`). So a defense shows: the core, replaying the committed journal on the season level that the run's nonce draws at this index, with the season's weight, accepts it and returns exactly the claimed Outcome.

**Why a wrong claim has no defense.** `P.runNonce` and `P.levelIndex` are the run's, so `P.drawSlot` is the true draw. Step 5 then forces the submitted level to be the drawn level. Step 2 forces the journal. Replay is deterministic, so `P` is the one true Outcome, and step 6 fails. If replay rejects, the guest panics and step 4 has no proof (README §7.3, "Rejections revert").

### 3.4 Contracts

`IReferee`, `ZkReferee`, `RunDerivations` and `ArbBlockhashEntropy` do not change. A new generation deploys `Season` and `Challenge`.

#### `contracts/src/Season.sol`

```solidity
struct SeasonParams {
    // … the ten fields of today …
    uint64 accusationWindow;    // seconds a claim stays open to accusations
    uint64 defensePeriod;       // seconds an accused level may be proven
    uint256 accusationDeposit;  // wei an accuser locks per accused level
}

uint64 public constant MIN_ACCUSATION_WINDOW = 48 hours;
uint64 public constant MIN_DEFENSE_PERIOD = 24 hours;
uint256 public constant MAX_DEPOSIT_IN_RUN_FEES = 4;

// The player's claim that counts while it is open to accusations or after it became final.
mapping(uint256 season => mapping(address player => BestRun)) public pendingRunOf;

function recordRun(uint256 season, address player, uint256 runId, uint32 score, uint32 ticks, uint8 clears)
    external; // onlyChallenge, as today: a result proven by the referee
function offerPending(uint256 season, address player, uint256 runId, uint32 score, uint32 ticks, uint8 clears)
    external returns (bool taken); // onlyChallenge: takes the slot if it is empty or the run ranks above it
function finalizePending(uint256 season, address player) external; // onlyChallenge: a final claim joins bestRunOf
function clearPending(uint256 season, address player, uint256 runId) external; // onlyChallenge: an accusation
function effectiveRunOf(uint256 season, address player) public view returns (BestRun memory);
function claimPeriodOf(uint256 season)
    external view returns (uint64 accusationWindow, uint64 defensePeriod, uint256 accusationDeposit);
```

- `effectiveRunOf` is the pending run if it exists and ranks above `bestRunOf` in D10's order, otherwise `bestRunOf`.
- `totalQualifiedPoints` is the sum of the qualified players' effective scores. Each of the four mutating functions reads the player's effective run before and after its change and moves the total by the difference: one private helper, so the invariant holds by construction.
- `claim(season)`, the payout, pays on `effectiveRunOf`. `closeSeason` does not change.
- `open` adds four range checks: `accusationWindow` from 48 h to 30 days, `defensePeriod` from 24 h to 30 days, `accusationDeposit` above 0 and at most 4 run fees, and `grace ≥ accusationWindow + defensePeriod`.

**Why hard floors and a cap.** The operator opens seasons and is adversarial here. A window of one second, or a deposit no watcher can afford, would let the operator's own wrong claims through. The window floor and the deposit cap are safety limits and must be constants. The defense floor only protects liveness.

#### `contracts/src/Challenge.sol`

```solidity
enum PostStatus { None, Open, Accused, Withdrawn }

struct PostedOutcomes {
    bytes32 outcomesHash;   // keccak256(abi.encode(outcomes)), the six claimed Outcomes
    uint64 postedAt;
    uint32 score;
    uint32 ticks;
    uint8 clears;
    uint8 accusedLevels;    // bit i: an accusation of level i is unanswered
    uint8 provenLevels;     // bit i: level i was proven equal to the claim
    PostStatus status;
}

struct Accusation { address accuser; uint64 deadline; }

mapping(uint256 runId => PostedOutcomes) public posted;
mapping(uint256 runId => Accusation[6]) private accusations;
mapping(uint256 season => mapping(address player => uint256 runId)) public countedRunOf;
uint256 public depositsHeld;

function commitRun(uint256 runId, bytes[6] calldata journals) external;
function commitRunWithOutcomes(uint256 runId, bytes[6] calldata journals, Outcome[6] calldata outcomes) external;
function postOutcomes(uint256 runId, Outcome[6] calldata outcomes) external;
function withdrawOutcomes(uint256 runId) external;
function accuseLevel(uint256 runId, uint8 i) external payable;
function defendLevel(uint256 runId, uint8 i, Outcome[6] calldata outcomes,
    bytes calldata level, bytes calldata journal, bytes calldata proof) external;
function reclaimDeposit(uint256 runId, uint8 i) external;
function postStateOf(uint256 runId) external view returns (PostState); // None, Open, Final, Accused, Void, Withdrawn
function accusationOf(uint256 runId, uint8 i) external view returns (address accuser, uint64 deadline);
function isSolvent() external view returns (bool); // balance ≥ depositsHeld

event RunJournals(uint256 indexed runId, bytes[6] journals);
event OutcomesPosted(uint256 indexed runId, address indexed player, uint256 indexed season,
    Outcome[6] outcomes, uint64 finalAt);
event OutcomesWithdrawn(uint256 indexed runId);
event LevelAccused(uint256 indexed runId, uint8 levelIndex, address indexed accuser, uint64 deadline);
event LevelDefended(uint256 indexed runId, uint8 levelIndex, address indexed defender);
event OutcomesCounted(uint256 indexed runId);
event DepositReclaimed(uint256 indexed runId, uint8 levelIndex, address indexed accuser);
```

Derived states: **Final** is `Open` with `block.timestamp > postedAt + accusationWindow`. **Void** is `Accused` with an unanswered accusation past its deadline; an accused bit whose record was deleted by `reclaimDeposit` reads as past its deadline. Neither state needs a transaction, and a void claim was already taken out of the count when it was accused.

**`commitRun`** is today's, and also emits `RunJournals`. A watcher then reads journals with `eth_getLogs` on any RPC, however the commit was sent. Today a commit from a smart-account wallet may need a trace RPC to read (`web/src/chain/calldata.ts`); under an optimistic design, unreadable journals would be a hole, not an inconvenience.

**`postOutcomes`**, only the player, reverts on the first failure:

1. the run is committed, its settlement is `Unsettled`, and its post status is `None` or `Withdrawn`;
2. `block.timestamp + accusationWindow + defensePeriod ≤ settlementEndOf(season)`;
3. `keccak256(outcomes[0].journalHash ‖ … ‖ outcomes[5].journalHash)` is the run commitment;
4. each Outcome passes today's `checkOutcome` against the run, the season's rules version, and the season level whose id it names;
5. the run is on time by the sum of the claimed `ticksUsed`, with today's `deadlineOf`;
6. if the player's counted run is final, `finalizePending`; then `offerPending` must take the run, else `NotAnImprovement`; a counted run still in its window becomes `Withdrawn`;
7. store the claim as `Open`, set `countedRunOf`, emit `OutcomesPosted`.

`commitRunWithOutcomes` is `commitRun` followed by the same steps, with the journal hashes it has just computed.

**`accuseLevel`**, anyone:

1. the claim is `Open` or `Accused`, `block.timestamp ≤ postedAt + accusationWindow`, and no accused level is past its deadline;
2. level `i` is neither accused nor proven;
3. `msg.value` is the season's `accusationDeposit`;
4. set the bit, store the accuser and `deadline = block.timestamp + defensePeriod`, add to `depositsHeld`;
5. if the claim was `Open`: `clearPending`, zero `countedRunOf`, status `Accused`.

**`defendLevel`**, anyone:

1. the claim is `Accused`, level `i` is accused, and no accused level is past its deadline;
2. the six steps of section 3.3;
3. clear the accused bit, set the proven bit, delete the accusation, subtract from `depositsHeld`;
4. if no accusation is left: if the player's counted run is final, `finalizePending`; then `offerPending`. If it takes the run, a counted run still in its window becomes `Withdrawn`, the claim is `Open` and counted. If not, the claim becomes `Withdrawn`: a better run of the player counts already;
5. send the deposit to `msg.sender`, last.

**`reclaimDeposit`**, the accuser, once `block.timestamp > deadline`: deletes the accusation but keeps the accused bit, so the claim stays void; subtracts from `depositsHeld`; sends the deposit.

**`withdrawOutcomes`**, the player, only while `Open` and inside the window: `clearPending`, zero `countedRunOf`, status `Withdrawn`. The run can then settle by proof or be claimed again.

**`settleRun` and `settleLevel`** are today's. They revert with `OutcomesStand(runId)` while the run's claim is `Open` or `Accused` and not void.

`Challenge` holds ETH for the first time: the open deposits, and nothing else. `accuseLevel` is its only payable function besides `startRun`, which still forwards the fee.

### 3.5 Parameters

| Parameter | Value | Derivation |
|---|---|---|
| Claim bond | none | A bond can only be taken when a claim is known to be wrong. Without a proof of fraud, "accused and not defended" is all the contract knows, and that is also true of an honest claim nobody proved. Taking a bond then would let whoever controls the provers, the operator first, accuse honest claims and collect. |
| Reward to a right accuser | none | Same reason: it would pay for accusing honest claims when no prover is awake. A watcher's motive is his own share of the pot, and the accusation costs him about 80,000 gas. |
| `accusationDeposit` | 1 run fee, 0.00005 ETH | Pays one defense: a market proof at 0.0000184 ETH (R) plus about 0.5M gas, 0.00001 ETH (E), is 0.0000284 ETH, covered 1.76 times. Kept small because watchers must fund one per wrong claim (see liquidity). Hard cap: 4 run fees. |
| Reward to a defender | the accuser's deposit | So that a wrong accusation pays for the proof it forced. |
| `accusationWindow` | 96 h; hard floor 48 h | No proving happens inside it. Watchers run every 12 h. 96 h leaves room for two missed days and an honest sequencer, or one missed day and the 24 h of forced inclusion. The floor is one day of watching plus forced inclusion. |
| `defensePeriod` | 72 h; hard floor 24 h | Up to 12 h to notice, two attempts at a heavy gate-set level at 2 to 4 h each (R), 24 h of forced inclusion: 44 h, and room for a queue of defenses on one machine. A typical human level is about 2.4 to 2.9 million cycles, 3 segments, 20 to 26 minutes (E). |
| `grace` | 240 h, 10 days | 24 h for late claims, 96 h, 72 h, and 48 h for the proof fallback after a void (a heavy run proof takes 9 to 17 h on 4 CPUs, R). Today's proposal is 48 h. |
| Claim cutoff | end + grace − 168 h | Enforced by `postOutcomes`. With the values above: 72 h after the season's end. A claim posted in the last 48 h before the cutoff may be voided too late for the proof fallback, so the dApp warns from end + 24 h. |
| Watch frequency | every 12 h, plus every browser that opens the season page | Operations, not a contract value. |
| Watchers' liquid ETH | 2 to 3 times the season's honest run fees | Below. |

**Liquidity.** An attacker who posts K wrong claims at once forces watchers to lock K deposits. Each wrong claim costs him a run fee and about 520,000 gas, 0.0000104 ETH at 0.02 gwei (E), and his fees enter the pot he is trying to take. With rake r, fee f, gas g per attempt, honest fees P and deposit A, the attack pays only if the watchers hold less than A × (1 − r) × P / (r × f + g). With A = f: 2.9 P at a 10% rake and 2.0 P at 20%. A season of 1,000 honest runs holds 0.05 ETH of fees, so watchers need 0.10 to 0.15 ETH between them. The deposits come back.

**Testnet.** The 48 h floor is a constant, so end-to-end tests of the optimistic path run on anvil with time travel, not on nitro-devnode in real time.

### 3.6 Stylus as the referee

The same contracts work with the Stylus referee if activations return: `proof` is empty and a defense re-executes the level, 5.1M to 11.6M gas for a heavy level (R), 0.0001 to 0.00023 ETH at 0.02 gwei. The deposit should then sit at its cap, 0.0002 ETH, which raises the watchers' liquidity need fourfold, or stay at one fee with defenders under-paid. `defensePeriod` can drop to 48 h: nothing is proven. A level that needs more than 32M gas cannot be defended, which only hurts the player who wrote it. A program that expires or needs reactivation stops defenses, not accusations.

### 3.7 Offchain changes

| Where | Change |
|---|---|
| `core/` | None. `RULES_VERSION` stays; no vector moves. |
| `referee/zk/guest/` | None. The image id stays, so an existing `ZkReferee` can serve the new generation. |
| `referee/zk/host/src/prove.rs`, `main.rs` | Convenience only: `prove --run <run file> --season <file> --level-index <i>` proves one level of a run file in level mode, with the checks `--run` makes today. `prove --level` on a game vector already does the proving. |
| `web/src/run/flow.ts` | At commit, replay the six journals (`replayRunFile`), compare the run with `effectiveRunOf`, and send `commitRunWithOutcomes` when it improves the player's result, else `commitRun`. Simulate first: if the bundled call would revert, send the plain commit, so that a claim never costs a deadline. |
| `web/src/chain/watch.ts` (new) | For every claim in its window, `Open` or `Accused`: read `OutcomesPosted` and `RunJournals`, replay each level the nonce draws with the wasm core, and report the first level that differs and is not yet accused. Runs in the background of the season and Challenge pages. |
| `web/src/pages/settle.ts`, `season.ts` | Claim state per run (open, final, accused, void), the countdowns, `postOutcomes` for a run committed without a claim, the Accuse button with the deposit, `reclaimDeposit`. The zk text "the operator settles" goes. |
| `web/src/chain/leaderboard.ts` | Ranks on effective runs, and marks the pending ones. |
| `web/src/chain/calldata.ts` | Journals from `RunJournals`; the calldata and trace paths stay for the earlier generation. |
| `scripts/contracts/season.mjs` | `watch`: the same check from the CLI; accuses, and fails loudly if a wrong claim is left unaccused or its wallet is short. It keeps no state: every run checks every claim still in its window against the chain, so an accusation that never landed, or that the sequencer dropped before its batch reached L1, is sent again. `defend`: for each accused claim whose replay matches, prove the level and call `defendLevel`. `settle` stays as the fallback for void claims. `status` adds the claims by state and the watch wallet's balance against the pot. `open` reads the three new parameters. |
| `scripts/contracts/e2e.mjs`, `localnet.mjs`, `deploy.mjs` | The optimistic cases on anvil with time travel: final unaccused, accused and void, accused and defended, a rejected journal claimed, a wrong draw claimed, a replacement claim, the cutoff. |
| `.github/workflows/season-ops.yml` (plan M5.5) | `watch` twice a day and `status`; it never proves, as today. |
| `contracts/test/` | `Season.t.sol`, `Settlement.t.sol`, `Invariant.t.sol`: section 3.11. |
| `contracts/abi/`, `web/src/chain/bindings/` | Regenerated. |
| `seasons/*.json` | `accusationWindow`, `defensePeriod`, `accusationDeposit`; `grace` 864,000. |
| `README.md` | §7.2 step 4 and §7.3 "Verify by exception" (rules frozen in M0.7: an owner decision), §7.5, §8.4's parameter table and best-run rule, §13 with a new decision. |
| `docs/ECONOMY.md` | New threat rows (section 3.9), the cost rows, the prerequisites. |
| `docs/VERIFICATION.md`, `docs/DEPLOYMENT.md`, `deployments/README.md` | Measured gas of the new functions; the new generation; what the `zk` backend means. |
| `docs/SEASON_RUNBOOK.md` (plan M5.5) | The watch schedule, the watch wallet's balance rule, forced inclusion by hand through the L1 inbox, alerts on every `LevelAccused`, and a canary: a deliberately wrong claim on a throwaway run, which an independent watcher should accuse within hours and the operator accuses himself before its window ends. |

### 3.8 Costs

| | Today | This design |
|---|---|---|
| Per paid run, normal case | `settleRun` with a proof: 804,194 gas, 0.0000161 ETH, plus 0.0000184 ETH of proving: 0.0000345 ETH, 69% of the fee (R) | The claim rides in the commit: about 200,000 gas for the claim and about 13,000 for the journals event on a typical blob, 0.0000043 ETH, 8.5% of the fee (E). No proof, nothing locked. |
| Commit, typical | 99,049 gas (R) | About 312,000 gas with the claim (E) |
| Commit, full blob of 49 KB | 864,069 gas (R) | About 397,000 more for the event (E) |
| Accusation | none | About 80,000 gas, 0.0000016 ETH, and 0.00005 ETH locked for at most 72 h (E) |
| Defense | none | About 0.45 to 0.5M gas, 0.00001 ETH (E, from `settleLevel`'s 154,050 and `ZkReferee.verify`'s 235,730 plus the stop's 5,785, R), and one level proof: 20 minutes to 4 h on 4 CPUs, or 0.0000184 ETH on the market (R). Paid 0.00005 ETH. |
| Worst case, every claim accused | — | Today's cost, with each proof paid by an accuser's deposit |
| A wrong claim, for its author | cannot settle | About 0.00006 ETH: a run fee and about 520,000 gas (E) |

Not measured anywhere: Arbitrum One's L1 data fee. The claim adds 2,112 bytes of calldata, mostly zeros.

### 3.9 Adversaries

| Adversary | What they can try | What stops it, or what is left |
|---|---|---|
| Claimant | A wrong claim | Any watcher's accusation; no defense exists. **Left: no watcher for 96 h.** |
| Claimant | Many wrong claims to exhaust watchers' deposits | Each costs him more than it costs them, and his fees feed the pot. **Left: watchers holding less than 2 to 3 times the honest fees.** |
| Claimant | A journal that is heavy to prove | Irrelevant: nobody has to prove a wrong claim. |
| Claimant | Journals nobody can read | `RunJournals` is emitted by the contract. |
| Accuser | Accusing correct claims | Loses the deposit when anyone defends. **Left: with no prover awake, an accusation is a free veto, and the player needs today's path.** |
| Accuser and claimant together | Accusing a correct level to be defended, to make the claim look checked | The wrong level stays accusable; watchers accuse it regardless. |
| Third party | Claiming for a rival | Only the player claims. |
| Third party | Settling a rival's other runs | As today: it never lowers the rival's result (D10). |
| Operator | Taking the pot with wrong claims of its own | Any other watcher. **Left: the operator as the only watcher.** |
| Operator | Accusing everyone and defending nobody | Players lose nothing but the optimistic path; any prover can still defend or settle. Today the operator can already settle only its own runs. |
| Operator | A season with a short window or a deposit nobody can pay | Hard floor and cap in `Season`. |
| Operator | A referee that lies | As today: the codehash recorded at `open`, checked against the build. |
| Sequencer | Censoring accusations | Forced inclusion within about 24 h, by a watcher who can use L1. **Left: watchers who cannot, and an outage longer than the window minus the watch interval.** |
| Sequencer | Taking a defender's reward by sending the proof first | 0.00005 ETH at stake. Left as is. |
| Sequencer | Skewing `block.timestamp` | Arbitrum's inbox rules bound it to about an hour ahead, as far as I know (not rechecked), against windows of days. Already an accepted residual in `docs/ECONOMY.md`. |
| Whoever can pause the verifier | Stopping defenses and proof settlement | No wrong payout follows. Accused players go unpaid, as every player does today under a pause. |

### 3.10 The security assumption, against today

**No wrong payout.**

- *Today:* RISC Zero's Groth16 verification is sound for the pinned image, the guest is the core, the contracts are right, Arbitrum executes them. Nothing about anyone's liveness.
- *This design:* all of that, since a forged proof could defend a wrong claim as it could settle a wrong run today. **And:** for every claim that differs from the replay of its journals, within 96 h at least one party other than the cheater reads the journals from the logs, replays them (20 to 60 ms a level with the wasm build, M), holds one run fee and gas, and gets one transaction included, by forced inclusion if the sequencer censors.
- *Not assumed:* a prover, a proving speed, a bound on a journal's cost, an honest or present operator when another watcher exists, a live verifier.

**An honest player is paid.**

- *Today:* someone proves and settles his best run by end + grace, in practice the operator, with 9 to 17 h of CPU or a thin market, and the verifier is not paused.
- *This design:* he sends his claim by the cutoff, in the commit itself. Then either nobody accuses it, or someone proves the accused level within 72 h, or someone proves the run by end + grace, which is today's condition. He locks nothing and can lose nothing.

### 3.11 Tests and invariants

- **Invariants:** `Season`'s `totalQualifiedPoints` equals the sum of the qualified effective scores; `Challenge`'s balance is at least `depositsHeld`, and equal to it when nothing was forced in; a claim with an unanswered accusation never counts; no call makes a void claim count; `countedRunOf` equals the pending run's id.
- **One scenario per test:** each row of the branch table of section 3.2; each numbered check of `postOutcomes`, `accuseLevel` and `defendLevel`; the four new `open` range checks; a defense with a proof of another journal, another level, another weight; the payout of a pending final claim; a rollover when every claim was accused.
- **Gas:** measure the new functions as `ChallengeGas` and `SettlementGas` do, and replace this document's estimates.
- **Checked so far:** a Python model of section 3.4's rules (`model.py`, appendix) ran 20,000 random sequences of posts, wrong posts, accusations, defenses, reclaims, withdrawals, proof settlements and waits. The invariants above held in every one. With a watcher that accuses each wrong claim in its window, no wrong claim ever counted, out of 40,310 posted; with no watcher, wrong claims counted in 298 of 300 sequences, so the property is not empty. A model is not the contract: it says the rules are consistent, not that an implementation is right.

## 4. Weaknesses

1. **Safety now depends on someone watching.** Today it depends on nobody. A wrong claim costs about one run fee to try and carries no penalty, so a bot can try in every window: assume any 96 h without a working, funded, independent watcher is found. A watcher that runs on public CI also shows its failures to everyone.
2. **If the operator is the only watcher, the operator is trusted.** An absent operator means theft by anyone, and a dishonest one can take the pot. Today both only mean no payout. The answer is the watcher in every player's browser, which nothing can enforce.
3. **Watchers need funds in proportion to the pot,** 2 to 3 times the honest fees at a deposit of one fee, and their balances are public.
4. **The prover stays.** Any accusation is a veto until someone proves, so a rival can force today's cost on chosen claims for a deposit he loses only when a prover answers. Without any prover, players accusing each other end in a rollover.
5. **Browsers cannot force inclusion.** Against a censoring sequencer, or after a long outage, only a watcher with L1 tooling counts.
6. **Payouts come 10 days after the season's end,** against the 48 h proposed today.
7. **More money logic to audit.** `Season` gains the pending result and four functions; `Challenge` holds deposits, where today it holds nothing. None of it was compiled or tested here, and its gas is estimated.
8. **A defender's reward is not bound to the prover,** so the sequencer can take it by sending the proof first.
9. **An unaccused claim settles on the browser build's word.** If the wasm build and the guest ever diverged, the result would depend on whether someone accuses.
10. **The 451 million cycles are a model's extrapolation,** checked against native time (12 times `10-worst`) but not run in the executor, which this study was told not to build.
11. **The L1 data fee is unmeasured,** and the journals event adds up to 397,000 gas to a full commit.

## 5. Hardening left out on purpose

- **A slashable claim bond with proofs of fraud.** A second guest program would commit, for one level, the run nonce, the level index, the draw slot it computes, the hashes of the level and the journal, the weight, a beneficiary, replay's code (0, or the rejection code, or 16 for a work budget of 160,000 flood-filled cells exceeded) and the Outcome. Fraud is shown when a verified commitment carries the run's nonce and index, the claimed journal hash, the season's level and weight for its draw slot, and a non-zero code or an Outcome other than the claimed one. A bond of about 0.003 ETH would go mostly to the beneficiary. This raises the price of a failed attempt from one run fee to the bond, but only while a prover is awake; it does not change what stops a wrong claim. It needs a new image, a core hook to stop a replay early, and it puts honest bonds at the mercy of any divergence between builds. Worth revisiting if attempts are seen or the pot grows.
- **A deposit on claims, lost when a claim ends void.** Honest claimants accused with no prover awake would lose it, and a rival could cause that for gas.
- **A reward for accusers,** for the reason in section 3.5.
- **A breaker that closes the optimistic path after a few void claims.** It would cap the attempts per season, and hand anyone a switch back to today's costs for a few run fees.
- **A bound on claimed scores in Solidity.** A copy of a core formula; an attacker posts several claims at the ceiling instead.
- **A work budget as a game rule.** Not needed here, since nobody proves a wrong claim. It would still bound what a player can make his own run cost to prove, and it would be a behavior change with a `RULES_VERSION` bump.
- **Counting a claim only after a finalize transaction.** `Season` would barely change, but every honest claim would need a second transaction before end + grace, from the player or from someone else. Here a claim counts when posted and stops counting when accused, so doing nothing is always the safe default: an accused claim that nobody touches again is simply not counted.
- **A run proof that answers all of a claim's accusations at once.** Cheaper than up to six level proofs, and one more code path.
- **Binding a defender's reward to the prover.** It needs a beneficiary in the guest's public values, so a new image, or a commit and a reveal for a reward of one run fee.

## 6. Decisions for the owner

1. Accept one live, independent watcher per window as a safety assumption, or keep today's design.
2. The window, the defense period and the grace: 96 h, 72 h and 10 days proposed.
3. The deposit: one run fee proposed.
4. The proving route kept for defenses and the fallback: the operator's machine or a market account (plan M5.5's open choice).
5. The edits to README §7.2, §7.3 and §8.4, frozen since M0.7.

## Appendix: how the numbers of section 2 were made

Everything is under `scratchpad/design/measure/`; the repository was only read.

- `src/main.rs`, a scratch crate with `jiro-core` as a path dependency, built offline in release mode into its own target directory.
  - `measure stats <vector.json>…` replays a vector with `replay_observed` and counts ticks, capture ticks, the `EMPTY` cells left after each capture (the cells its flood fill marked), events, boss and minion moves, and the median native time of 201 replays. Output: `out/stats.jsonl`.
  - `measure attack <level.bin> <nonce> <level index> <out.json>` plays the policy of section 2.1 through the core's `Recorder`, with one or two ticks of lookahead on a copy. Outputs: `out/attack-<level>.json`, a game vector without its outcome, and `out/attack-<level>.report.json`.
- `fit.py` fits the user cycles and the Stylus gas of `docs/VERIFICATION.md`'s tables to those drivers by least squares and predicts the crafted journals. `holdout.py` fits on the light vectors and predicts the heavy ones.
- `wasm-time.mjs` times `replay` of `target/wasm32-unknown-unknown/release/jiro_wasm.wasm` in Node 22 through `web/test/wasm.mjs`.
- `target/release/jiro-tools replay --level levels/01-open.bin --journal out/attack-01-open.jrn` accepted the crafted journal: end reason 4, 2,764 bp, 2,700 ticks.
- `model.py` is the lifecycle model of section 3.11: `python3 model.py 20000`, and `--no-watcher` for the invariants alone.
- To confirm the cycles, run `zk-host execute` on `out/attack-01-open.json` once its `outcome`, `trace` and `traceKeccak` are added.
