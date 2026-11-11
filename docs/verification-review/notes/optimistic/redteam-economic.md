# Red team, economic and griefing lens: the three optimistic settlement designs

Reviewer notes of 2026-11-10 on `minimal.md`, `trust.md` and `browser.md` in this directory, against the repository at `f52a60a` (read only; `git status --short` is empty) and against the lead's addendum.

Tags on numbers:

- **[R]** read or computed from the repository's files;
- **[P]** from a designer's document or prototype;
- **[T]** from a test I added to a copy of a designer's prototype and ran today ([§12](#12-how-to-reproduce));
- **[A]** from the lead's addendum or another reviewer's note;
- **[E]** my arithmetic or estimate (`redteam-economic-work/ev.py`).

## 0. Verdict

Under this lens an optimistic path is **worse** than the owner's direction of addendum item 8, a GPU validity proof for every paid-out run.

- **What it saves.** 0.000015 to 0.000025 ETH per player per season, which is 4% to 8% of the players' pot in a 200-player season [E]. Most of that is `settleRun`'s calldata gas, not the proof.
- **What it costs.**
  - One watcher lapse can cost the whole pot. In `minimal` and `trust` one false claim is enough, because nothing bounds the claimed score [T].
  - `minimal` and `browser` take bonds from honest players without any proof of fraud, whenever a proof cannot arrive in time. The bonds held can exceed the pot [E].
  - The operator's scheduled job is the only watcher that counts. An operator who stays silent takes up to the pot, nine times a 10% rake.
  - Watchers need 0.8 to 3.3 pots of capital in a hot key [E].
  - The prover does not go away. It must now answer within 36 to 72 hours, with players' money at stake, where item 8 lets it answer at any time before the season's end plus grace.
- **Best of the three under this lens: `trust`.** It is the only one in which no honest player or watcher can lose money, and in which nobody profits from a stopped verifier, a prover outage or terms the operator chose. Its holes are an unbounded score and attempts that cost one run fee; both have cheap partial fixes ([§9](#9-cheapest-fixes)).

## 1. What I read and ran

- **Repository:** `contracts/src/Challenge.sol`, `Season.sol`, `ZkReferee.sol`, `interfaces/IReferee.sol`, `RunDerivations.sol`, `mocks/MockReferee.sol`, `mocks/MockForwarder.sol`; `referee/zk/guest/src`; `core/src/replay.rs`, `game.rs`; README §6.3, §7 and §8; `docs/ECONOMY.md`; `seasons/*.json`; `web/src/chain/calldata.ts`.
- **Designs:** the three specifications in full, the `minimal` prototype (`minimal-proto/`), the `browser` prototype (`proto/contracts/`), and the `trust` lifecycle model (`measure/model.py`). `trust` has no Solidity.
- **Other reviewers:** `audit/cost.md` §6, `audit/trust.md` (the emergency stop), `research/risc0-gpu.md`, `research/proof-services.md`, `research/optimistic.md` §4, §5 and §7.
- **Tests added on copies of the prototypes** [T]: 5 on `minimal`, 4 on `browser`. All pass, with the designers' own suites (57 and 246 tests in all).
- **Not done:** no test against `ZkReferee` or a real proof, no GPU, nothing on a live chain, no web query.

## 2. Numbers used

| Quantity | Value | Tag |
|---|---|---|
| Run fee | 0.00005 ETH | R, README §8.2 |
| Rake | 10% in `testnet-0`, cap 20% | R |
| Base fee | 0.020036 gwei: 1M gas is 0.00002 ETH | R, `docs/ECONOMY.md` §2 |
| ETH price | $2,060 | A, read on 2026-11-10; the designs used $2,290 |
| Season weights | largest 64,620; six largest 219,788 | R, `seasons/calibration-1.json` |
| Honest run scores | reference mix 65,683; search bot 133,475; ceiling 135,488 | R, `docs/ECONOMY.md` §5 |
| Score types | `Outcome.levelScore`, `Settlement.score`, `BestRun.score`: `uint32` | R |
| Example season | 200 players, 1,500 runs: fees 0.075 ETH, pot 0.0675 ETH ($139) | E, the illustration of `browser.md` §8 |
| Owner's direction, per player per season | 0.00002 to 0.00003 ETH | A, item 8 |
| RTX 5090 proving | 0.57 s + 0.33 s per 2^20-cycle segment, 2 s wrap; $0.83 per hour rented | A, not measured on this guest |

Gas of the new functions: `minimal` and `browser` from their prototypes [P]; `trust` is estimated by its designer [P].

## 3. Expected value of a false claim

Cost of one attempt, fee and gas, bond apart [E from R and P]: 0.0000574 ETH (`minimal`), 0.0000602 ETH (`trust`), 0.0000592 ETH (`browser`).

Share of the pot one false claim takes, in the example season of reference-mix players [E]:

| Claimed score | Who allows it | Share of the pot | In average players |
|---|---|---:|---:|
| 2^32 − 1 | `minimal` (the proposal is a free `uint32`), `trust` (each claimed `levelScore` is a `uint32`, unchecked) | 99.70% | 65,389 |
| 6 × 65,535 = 393,210 | `browser` (six `uint16` level scores) | 2.91% | 6.0 |
| 219,788 | nobody today: a cap at the season's six largest weights | 1.65% | 3.3 |

- **Checked on the `minimal` prototype** [T]: a proposal of score 2^32 − 1, ticks 2^32 − 1 and clears 255 is recorded after 48 h. Its player is paid 89,998,993,973,317 wei of a 90,000,000,000,000 wei pot, against an honest player whose proven score is 48,010. A second test: overstated ticks put a late run back on time.
- **`trust`** has no code. Its specification checks the bindings of each claimed Outcome and the deadline, and lists "a bound on claimed scores" under hardening left out on purpose.
- **Larger season** (10,000 players, 100,000 runs, pot 4.5 ETH): one `uint32` claim still takes 87% [E].

Break-even probability q\* that no watcher acts during the window, above which an attempt pays [E]:

| Design and tactic | Gain | Loss if caught | q\* |
|---|---:|---:|---:|
| `minimal`, bond left at risk | 0.0673 ETH | 0.00056 ETH | 0.82% |
| `minimal`, the forger disputes its own proposal once it sees the watcher alive | 0.0673 ETH | 0.00006 ETH | 0.09% |
| `trust` (no bond) | 0.0673 ETH | 0.00006 ETH | 0.09% |
| `browser`, bond left at risk | 0.00196 ETH | 0.00036 ETH | 15.5% |
| `browser`, shielded ([§6](#6-browser)) | 0.00196 ETH | 0.00006 ETH | 3.1% |

Readings:

- **Bonds deter less than their size says.** A forger can always take its own claim down before a watcher does, and get the bond back.
  - `minimal`: the single dispute slot goes to the forger's second address, and both bonds return to it when settlement ends [T]. The proposal is dead, so this is a bail-out, not a route to success.
  - `browser`: the shield of [§6](#6-browser) is stronger: it keeps the forgery alive.
  - `trust`: `withdrawOutcomes`, and there is no bond anyway.
- **Arbitrum has no public mempool** [A], so a forger cannot react to a pending dispute. It can read the watcher's schedule, its past transactions and its balance. `minimal`'s 0.09% therefore holds only if the forger can see a watcher run start before its dispute lands, for example a public scheduled job; otherwise 0.82% applies. `browser`'s shield needs no such signal.
- **A cap changes the attempt, not the lapse.** With scores capped at 219,788, taking 90% of the pot needs 538 false claims (0.032 ETH of fees and gas in `trust`) instead of one [E]. A prepared attacker still takes most of the pot when the watchers are away for a whole window.

## 4. Findings common to the three designs

### 4.1 Who watches

Pro-rata payouts do not make every player a working watcher.

- **Stake.** The average player's share is pot / players = 0.00034 ETH ($0.70) [E].
- **With bounded scores** (`browser`), one false claim costs that player 2.9% of it: 0.0000098 ETH. A challenge, its resolution and the withdrawal cost 0.0000041 ETH of gas and lock 0.0003 ETH for 36 h or more [P]. Without the bounty the player has no reason to act; with it, the operator's hourly job gets there first.
- **With unbounded scores** (`minimal`, `trust`), the loss is the player's whole share, so the motive exists. What is missing is presence and means:
  - claims are accepted after the season ends, until T + 4 h (`browser`), T + 24 h (`minimal`) or T + 72 h (`trust`), and their windows run to T + 40 h, T + 72 h and T + 168 h, when nobody is playing and no tab is open;
  - a dispute needs 6 to 10 run fees liquid (`browser`, `minimal`) and a wallet confirmation to send them against a stranger, on the word of the page;
  - the page is the operator's build.
- **`trust` pays a right accuser nothing**, by design. Its watchers are the operator and whoever cares.
- **No income in the honest case.** A watcher that works earns nothing, because nobody forges. Nobody but the operator will keep a funded key and a job running for a $139 pot.

### 4.2 Operator and claimant together

- **Silence.** The operator's job is the only watcher that is sure to run. An operator that lets an accomplice's false claim pass, or forges from a fresh wallet, takes up to the pot: 0.0675 ETH against a rake of 0.0075 ETH. A failed job is a credible excuse. Under item 8 the operator cannot forge at all, and cannot omit a player once anyone with a 16 GB NVIDIA card can prove.
- **Terms.** `minimal` and `browser` let the operator open a season in which nobody can challenge ([§5](#5-minimal), [§6](#6-browser)) [T]. `trust` has floors and a cap as constants.
- **The page.** In the bonded designs a page that states a wrong result, by a bug or on purpose, costs each player a bond: any watcher, the operator's first, collects 0.0003 or 0.0005 ETH per player. Today a bad page costs a run fee at most.
- **The prover.** At launch the owner's card is the only prover. In the bonded designs whoever controls the prover can challenge honest claims and not defend them ([§4.4](#44-the-prover-goes-on-call)).

### 4.3 Many false claims at the cutoff

The attacker commits K runs during the season, which look like ordinary runs that are nobody's best, then claims them all in the last minute before the cutoff. Fees are paid before the season ends; claims are not.

Watcher capital below which the attack pays, in the example season [E]:

| Design | Capital needed | Locked for | Time to react |
|---|---:|---|---|
| `minimal` | 0.066 ETH, 0.97 pots | until end + grace: up to 19 days [T] | 48 h |
| `trust` | 0.223 ETH, 2.97 times the season's fees | up to 72 h | 96 h |
| `browser` | 0.052 ETH, 0.77 pots, against 301 surviving claims | 36 h | 36 h |

- **Why `trust` needs most.** A wrong claim that is caught costs its author a fee and gas only, and a winner recovers the fees through the pot.
- **`minimal`, as specified.** The watcher key is "funded with a few bonds". With 5 bonds, 6 false proposals cost the attacker 0.0033 ETH if all fail and win 0.065 ETH if the operator does not add 0.0005 ETH within 48 h [E]. The attacker's bet pays above a 5% chance of that.
- **A failed attempt feeds the pot.** In `trust` every caught claim leaves its fee to the honest players. In the bonded designs the watcher keeps the bonds.
- **Rollover.** The pot includes rollover from earlier seasons, so capital sized to the season's fees can be too small.
- **Public.** The watcher's balance is onchain. Reserves held elsewhere are not, so the attacker bets on the operator's attention.

### 4.4 The prover goes on call

- **Item 8:** one proof per paid-out player, at any time before end + grace. A two-day outage of the home card delays settlement and costs nobody.
- **Optimistic:** a proof within 36 h (`browser`), 72 h (`trust`) or before end + grace with at least 48 h left (`minimal`) of any challenge. In `browser` and `minimal` a miss moves the honest player's bond to the challenger. So an attacker profits from the prover being down, and has a reason to cause it.
- **Capacity is no longer the issue** with a GPU [E from A]:

| Work | Segments | RTX 5090 | 16 GB mid-range card | 4 CPUs |
|---|---:|---:|---:|---:|
| A level in the owner's style, 3M cycles | 3 | 5 s | under 1 min | 0.3 to 0.4 h |
| Heaviest gate-set level, 31M | 30 | 29 s | 3 to 5 min | 2.8 to 3.9 h |
| Worst legal level, 0.76 billion | 725 | 10.8 min, $0.15 | 1 to 1.8 h | 68 to 94 h |
| Run of 1e8 cycles | 96 | 1.5 min, $0.02 | 8 to 15 min | 9 to 12.5 h |
| Worst legal run, 2.9 billion | 2,766 | 41 min, $0.57 | 3.8 to 6.9 h | 260 to 359 h |

  - The designers' prover-exhaustion weaknesses (one machine defends 2 heavy runs, or 9 to 22 levels, per window) disappear with one GPU.
  - Availability stays: one home card, an RTX 3060 with 12 GB today, on which the default segment size is unverified [A].
  - On 4 CPUs the worst legal level misses both the 36 h and the 72 h defense periods.
- **No market.** Buying a proof now means renting a GPU: about $0.14 of start-up before the first second of proving [A].

### 4.5 The saving against item 8

| | Per player per season | For 200 players | Share of the pot |
|---|---:|---:|---:|
| Item 8 [A] | 0.00002 to 0.00003 ETH | 0.004 to 0.006 ETH | 5.9% to 8.9% |
| `minimal` [P] | 0.0000047 ETH, and 0.0005 ETH locked 48 h | 0.0009 ETH | 1.4% |
| `trust` [P, estimated] | 0.0000043 ETH | 0.0009 ETH | 1.3% |
| `browser` [P] | 0.0000033 ETH, and 0.00000033 ETH on each of the player's commits; 0.0003 ETH locked 36 h | 0.0012 ETH | 1.7% |
| **Saved** [E] | 0.000014 to 0.000026 ETH | 0.0028 to 0.0052 ETH | 4.2% to 7.6% |

- **Break-even.** A lapse that costs the pot outweighs the saving when it happens more often than about one season in 13 to 24. Bond losses, later payouts, watcher capital and operations are not counted.
- **Where the saving comes from.** Item 8's cost is mostly `settleRun`: 530,256 to 804,194 gas, 0.0000106 to 0.0000161 ETH [R], of which up to 44% is calldata that the contracts only hash [A, `audit/cost.md`]. The GPU time is about $0.004 for a run in the owner's style and $0.02 for a bot's run [E from A].
  - A settlement function that takes hashes would cost about 0.4M gas [E: 227,591 + 5,785 for the verification, R; about 75,000 for `recordRun`, A; the rest estimated]. Item 8 would then cost 0.00001 to 0.000015 ETH, and the optimistic saving would fall to about 0.000005 to 0.00001 ETH per player per season.
  - It needs a new `Challenge`, as all three designs do.
- **Referee-only shape (addendum item 5).** An optimistic referee that leaves `Challenge` unchanged still pays `settleRun`'s gas in the normal case. It then saves only the GPU time, a cent or two per player per season, for the same watcher assumption.
- **Slower.** Item 8 settles in minutes. Optimistic claims are final after 36 to 96 h, and payouts move by 28 h (`browser`), 3 days (`minimal`) or 8 days (`trust`).
- **Sybil wallets.** A proof per wallet is a friction on the one-wallet-per-run play that README §8.2 accepts. A wallet's run pays off above 1.67 times the season's points per paid run under item 8, and above 1.22 times with a 9%-of-fee claim (1.11 with no settlement cost, at a 10% rake) [E].

## 5. `minimal`

1. **Unbounded proposal** ([§3](#3-expected-value-of-a-false-claim)) [T]. Fatal as specified, cheap to fix.
2. **An honest proposer loses 0.0005 ETH with no proof of fraud.** A dispute left unproven until end + grace pays both bonds to the disputer (the designer's own test `test_FinalizeRun_PaysBothBondsToTheDisputerWhenNoProofCameBeforeSettlementEnded`). It happens when:
   - RISC Zero's emergency stop is paused. Its owner is one externally owned account outside the project, and a stop is permanent [A, `audit/trust.md`]. Nobody found who holds it since Boundless stopped [A];
   - the only prover is down for the last 48 h of settlement;
   - on Stylus, one of the run's levels needs more than 32M gas. I estimate about 175 small captures on an open level [E from A: 0.29M gas of setup and about 0.18M per capture]. Such a run can never be proven, so the disputer wins for certain.
3. **Bonds exceed the pot.** With every player holding an open proposal, `Challenge` holds 0.1 ETH against a 0.0675 ETH pot [E]. With 25% to 50% of the players inside their window when the verifier stops, 0.025 to 0.05 ETH is there for whoever disputes first.
4. **Watcher money is locked until settlement ends.** A dispute of a proposal on journals that replay rejects cannot be closed earlier: 19 days in the test [T]. The watcher's capital need therefore adds up over the season, and an attacker can drain it slowly, at 0.00056 ETH lost per 0.0005 ETH locked.
5. **Journals are not in a log.** `commitRun` is unchanged, so a commit built by a contract leaves its journals only in a trace: `web/src/chain/calldata.ts` then needs `debug_traceTransaction` [R]. A watcher without traces skips such proposals, and a false one passes, or disputes blind. Against a blind disputer the attacker proposes the truth through a contract, is disputed, proves on a GPU, and collects 0.0005 ETH each time.
6. **The operator sets the terms.** `open` accepts a dispute window of 1 s with a grace of 2 s, and any bond [T].
7. **The contract pays the prover nothing.** The disputer's bond goes to the player, who must pay a prover. Item 8's escrow would do that. So `minimal` needs item 8 to exist.
8. **A finalization must be sent** before end + grace, 157,308 gas [P], or an honest undisputed run earns nothing.
9. **A dispute costs a whole-run proof.** With a GPU this is 1.5 to 15 minutes, and up to 41 minutes on an RTX 5090 for the worst legal run. It is no longer the weakness the designer listed.
10. **Low: `pay` forwards all gas.** A proposer contract whose `receive` burns gas makes whoever finalizes pay for it. The operator's job should cap gas.

## 6. `browser`

1. **Shielded forgery** [T]. The first challenge to lapse wins the claim bond: `resolveChallenge` calls `reject(runId, run, dispute.challenger)`, which credits that challenger and only returns the other challengers' bonds.
   - **Bond capture.** The forger's second address challenges a *right* level in the claim's block. An honest watcher challenges the wrong level an hour later. At 36 h the second address resolves its own challenge and takes the claim bond; the watcher gets its own bond back and nothing else.
   - **Success kept.** If no watcher comes, the forger waits for the challenge window to close, then settles the right level with a proof. That refutes its own challenge, pays itself the challenge bond, and puts the forged claim back on the ranking, where nobody can challenge it any more. With a wrong level whose journal replay rejects, no proof can remove it. In the test the forger is then paid the whole players' pot.
   - **Cost.** Fee and gas, 0.000063 ETH, and 0.0006 ETH locked for 36 h. The 0.0003 ETH bond is never at risk from a watcher that has no prover.
   - **What breaks it.** A prover that refutes the shield within 36 h and takes its 0.0003 ETH. So the design's promise, a season that needs no prover unless an honest claim is challenged, is the case in which the bond deters nothing.
   - **Timing.** If the second address challenges one second after the claim, its own challenge cannot be resolved by anyone in the first second after the window closes, so the forger's refutation cannot be raced.
   - The designer considered a self-challenge only as "recovers the forger's own bond, from a claim that fails anyway".
2. **An honest claimant loses 0.0003 ETH with no proof of fraud** (B3, B11): the same three causes as `minimal` item 2, with a 36 h deadline instead of the end of settlement. One level above 32M gas on Stylus is enough. With 25% to 50% of 200 players inside their window: 0.015 to 0.03 ETH.
3. **One undefended challenge removes a player's whole standing** [T]. A better claim deletes the player's earlier claim. A challenge of a right level of the new claim, undefended for 36 h, takes the bond and leaves nothing ranked. The earlier run is then too late to claim (`ClaimTooLate` after T + 4 h) and needs a full proof. `trust` keeps a final claim as the player's best; `minimal` keeps finalized proposals.
4. **A rival can close the claim path** with one level proof. `claimRun` reverts with `SettlementStarted` once any level of the run is settled. A player who committed without a claim, for example because the wallet lacked the 0.0003 ETH bond, can be forced onto the proof path for about 0.00001 ETH of gas and seconds of GPU.
5. **The operator sets the terms.** `open` accepts a challenge window of 1 s, and a challenge bond of 1 ETH against a claim bond of 1 wei [T]. Only the page's check refuses it, and the page checks the window, not the bonds.
6. **Bonds held:** 0.06 ETH for 200 players if they leave them in place, 0.89 pots [E], in a contract that grew from 288 to 585 lines [P].
7. **A proof can still reject a forged claim until end + grace** (B4). This is a real safety net that the other two lack, but only for journals that replay accepts, and it pays nothing once the bond is released.
8. **Bounded score.** Six `uint16` level scores cap a claim at 393,210, 1.8 times the six largest weights. This is why `browser`'s q\* is 19 to 35 times higher than the others'.

## 7. `trust`

1. **Unbounded score, and attempts at one fee** ([§3](#3-expected-value-of-a-false-claim)). A wrong claim costs 0.00006 ETH and loses nothing more. Fatal as specified; the cap is cheap, and a deposit that is forfeited without a proof of fraud can be made safe for honest players ([§9](#9-cheapest-fixes)).
2. **A final claim cannot be corrected.** `settleRun` and `settleLevel` revert with `OutcomesStand` while a claim is open, and a final claim keeps that status. After 96 h not even a proof removes a wrong claim. `browser` allows it until end + grace.
3. **An accusation is a cheap veto.**
   - It costs 0.0000024 ETH of gas when nobody defends, and the deposit returns [P, estimated].
   - The 0.00005 ETH deposit pays a defender whose card is already running. It does not cover `defendLevel`'s 0.5M gas above 0.1 gwei, a rented GPU's start-up (0.000067 ETH), or the worst legal level (0.000073 ETH on an RTX 5090) [E].
   - Undefended, the player falls back to a run proof, which is item 8's cost. A claim posted in the last 48 h before the cutoff may be voided too late for that fallback, as the designer says.
4. **With the verifier stopped,** every accusation is a free veto. The pot goes to whichever claim is not vetoed, or rolls over. Nobody loses a deposit or a bond.
5. **Most watcher capital,** 2.97 times the season's fees ([§4.3](#43-many-false-claims-at-the-cutoff)), and no bounty.
6. **Implementation hazard.** A claim posted again after a withdrawal must reset its proven levels, as `model.py` does. If it did not, a player could have a right level proven, withdraw, and post a wrong Outcome for that level which nobody could accuse.
7. **What holds.** No honest player or accuser can lose money except by being wrong. Window floor and deposit cap are constants. A stopped verifier, a prover outage and a level too heavy for Stylus cost nobody a bond.

## 8. The lens, point by point

| Question | `minimal` | `trust` | `browser` |
|---|---|---|---|
| EV of a false claim | Pays above a 0.09% to 0.8% chance of a 48 h lapse; takes 99.7% of the pot [T] | Pays above 0.09% for 96 h; takes 99.7% | Pays above 3% to 15% for 36 h; 2.9% of the pot per claim |
| Is challenging rational? No design asks the challenger for a proof | +0.0005 ETH for 0.0000022 ETH of gas; bond locked up to 19 days | No reward; 0.0000024 ETH of gas | +0.0003 ETH for 0.0000041 ETH of gas; nothing if the forger shields [T] |
| Is defending rational for someone who must compute a proof? | The contract pays the prover nothing; the player receives 0.0005 ETH and pays | 0.00005 ETH: enough only for a card already running at the fee floor | 0.0003 ETH: 2 to 4 times the cost on a GPU rented for the purpose |
| Self-challenge | Kills the proposal and returns both bonds: a free bail-out [T] | Nothing to gain | Captures the bond and keeps the forgery alive [T] |
| Claim, then withdraw | No withdrawal exists | Allowed while unaccused; gains nothing | No withdrawal; a better claim replaces one's own |
| A third party claims a rival's run with a low score | Closed: `onlyPlayer` [R of the prototype] | Closed in the specification | Closed: `onlyPlayer` [R of the prototype] |
| Forcing proofs on honest players or the operator | 0.0005 ETH at risk to force a $0.02 to $0.57 proof: irrational while a prover lives | A cent of gas if nobody defends | 0.0003 ETH at risk; pays the prover |
| Capital against a 0.00005 ETH fee | 0.0005 ETH for 48 h; first claimed run needs 0.00055 ETH | None for players | 0.0003 ETH for 36 h, carried over; first claimed run needs 0.00035 ETH |
| Operator and claimant | Silence; a 1 s window [T]; the page | Silence only | Silence; a 1 s window and a 1 ETH challenge bond [T]; the page |
| Many false claims at the cutoff | 0.97 pots until end + grace | 2.97 times the fees for 72 h | 0.77 pots for 36 h |
| Pro-rata players as watchers | No ([§4.1](#41-who-watches)) | No, and unpaid | No; the bounty goes to the fastest job |

**A challenger who proves.** None of the three asks for it, and with a GPU it is no longer out of reach.

- **Cost.** The worst legal level is 10.8 minutes on an RTX 5090. Rented for the purpose, that is about 0.00015 ETH with the start-up and `settleLevel`'s gas [E], so a bond that pays the prover must exceed that.
- **Already possible without a bond.** On journals that replay accepts, a watcher with a GPU can settle the true result: in `minimal` the proof overtakes the proposal, and in `browser` it rejects the claim and earns the bond while it is locked (B4).
- **Not possible where it matters.** A forger commits a journal that replay rejects, for which the guest has no proof. Only the bonded challenge or the accusation stops that claim.
- **Fewer watchers.** A watcher that must prove needs an NVIDIA card or a rental account.

**Third-party low-score claims.** Closed in all three because only the run's player may claim, and because finalizing or settling a rival's run records the player's own claim or the truth. The referee-only shape of addendum item 5 must keep that rule: `settleRun` is open to anyone, so a matured false low statement about a rival's journals would settle the rival's run for good. The referee would have to read the run's player from `Challenge.runs(runId)`.

## 9. Cheapest fixes

| Problem | Fix | Cost | What stays |
|---|---|---|---|
| Unbounded score (`minimal`, `trust`) | Cap each claimed level score at the season weight of its claimed level (`trust` has the level ids), or the run score at the season's six largest weights, with ticks at most 16,200 and clears at most 6 (`minimal`) | A few lines; a bound, not a copy of the scoring rule | A capped claim is still worth 3.3 average players |
| Attempts at one fee (`trust`) | A claim deposit returned when the claim becomes final or when a proof records the claimed result, and added to the pot otherwise | One more mapping | An honest claim vetoed while no proof can be made loses the deposit |
| Bonds taken without proof (`minimal`, `browser`) | A lapse voids the claim and returns its bond; the bond moves only when a proof records another result. Or refund both bonds when the verifier reports paused | Small | The challenger of a rejected journal earns nothing, as in `trust` |
| Shield (`browser`) | On rejection send at least half the claim bond to the pot, split the rest among all open challengers, and reject only once every open challenge has lapsed | `Season` must accept forfeits | Second addresses still dilute the honest challenger |
| Operator's terms (`minimal`, `browser`) | Constants: a window floor on mainnet, challenge bond at most the claim bond, both at most a few fees | A few lines | Tests on a local node need another build or time travel |
| Unreadable journals (`minimal`) | Emit the journals at commit | 16,473 gas per typical commit [P] | |
| Lost standing (`browser`) | Keep the replaced claim until the new one has stood its window; allow a claim on a run with settled levels | More state | |
| Thin defender pay (`trust`) | Deposit at its cap of 4 fees; one run proof answers every accusation; pay the payee named in the proof once item 8 adds that value | Raises watcher capital fourfold | |
| Watcher capital | Challenge bond well below the claim bond, with no forfeit on a lapse | | A person must still react within the window |
| The operator as only watcher | None that is cheap: a funded watcher run by someone else, a canary false claim each season | Operations | The assumption |

After these fixes the designs converge on `trust` with a cap and a small forfeitable deposit. The watcher assumption, the hot capital and the delay remain.

## 10. The addendum, design by design

| Item | Effect |
|---|---|
| 1, GPU proving in minutes | Removes the prover-exhaustion weaknesses of all three. Defense windows cannot shrink below the 24 h force-inclusion delay, so the optimistic path stays 36 to 96 h slower than a proof. `trust`'s main objection to a challenger who proves, 42 to 60 h on 4 CPUs, becomes 11 minutes on an RTX 5090 and 1 to 2 h on a mid-range card. |
| 2, no proof market | The bond sizes derived from the Boundless price no longer mean anything. Only GPU owners defend. `minimal`'s 0.0005 ETH and `browser`'s 0.0003 ETH cover a rented GPU; `trust`'s 0.00005 ETH does not. The holder of the emergency-stop key is unknown, which weighs on every design that forfeits bonds on a lapse. |
| 3, unbounded replay cost | Harmless for stopping fraud, since nobody proves a false claim. It sets the price of a defense: the worst level costs more to prove on a rented card than `trust`'s deposit. On Stylus, a level above 32M gas cannot be defended at all: in `minimal` and `browser` its challenger takes the bond for certain. |
| 4, human play is light | Item 8's proof of an ordinary run is about 18 segments: 18 s on an RTX 5090. Its cost is then almost all `settleRun` gas, which narrows the optimistic saving further. |
| 5, referee-only | None of the three uses it; each needs a new `Season` and `Challenge`. In that shape the normal case still pays `settleRun`, so the saving against item 8 is the GPU time alone. |
| 6, state hash is test-only | No effect: none of the three bisects. |
| 7, a stop mid-season | The optimistic designs do better here on one point: claims older than their window are still paid under a stopped verifier. Against that, every younger claim can be vetoed (`trust`) or looted (`minimal`, `browser`). |
| 8, the owner's direction | [§4.5](#45-the-saving-against-item-8) and [§11](#11-against-the-owners-direction). The dispute backend of all three is item 8's prover, and `minimal` also needs its escrow. |

## 11. Against the owner's direction

Item 8 under the same lens:

- **No theft path.** A proof attests what the journals produce. There is no watcher, no bond, no window.
- **Liveness only.** At least one prover must work at some time before end + grace. A bounty is refunded if the run is still unsettled then. A stopped verifier halts settlement, as today.
- **Races.** Two provers may prove the same run; the loser wastes seconds to minutes of GPU. A copied proof pays its original payee.
- **Heavy runs.** A player who plays 0.76 billion cycles per level pays for it: about $0.57 of GPU for the run. Nobody else is exposed.
- **The operator** cannot forge, and cannot omit a player once others can prove. It needs no hot capital beyond gas.

The optimistic designs add to that list: a whole-pot loss on a watcher lapse, bond loss for honest players, a judge by silence, capital in a hot key, and days of delay. They remove 4% to 8% of the pot in costs. They also remove one liveness risk in part (addendum item 7).

## 12. How to reproduce

Everything is under `scratchpad/design/redteam-economic-work/`; the repository and the designers' directories were only read.

```bash
D=scratchpad/design
W=$D/redteam-economic-work

# minimal: 5 tests in minimal-poc/test/RedTeam.t.sol
cd $W/minimal-poc && HOME=$W/home $D/tools/forge test --match-contract RedTeamTest -vv

# browser: 4 tests in browser-poc/contracts/test/RedTeam.t.sol
cd $W/browser-poc/contracts && HOME=$W/home FOUNDRY_SOLC=/root/.local/share/svm/0.8.28/solc-0.8.28 \
  $D/tools/forge test --offline --match-contract RedTeamTest -vv

# the arithmetic of sections 3 and 4
python3 -I $W/ev.py
```

| Test | Shows |
|---|---|
| `minimal`: `test_ProposeRun_AScoreOfUint32MaxIsRecordedAndTakesThePot` | 99.9989% of the pot to one false proposal |
| `minimal`: `test_ProposeRun_OverstatedTicksPutALateRunOnTime` | The deadline follows the proposed ticks |
| `minimal`: `test_Open_AcceptsADisputeWindowOfOneSecond` | No floor on the window, no cap on the bond |
| `minimal`: `test_DisputeRun_LocksTheWatchersBondUntilSettlementEnds` | 19 days |
| `minimal`: `test_DisputeRun_TheForgersOwnDisputeLeavesTheWatcherNothing` | The bail-out |
| `browser`: `test_Shield_TheForgersOwnChallengeOfARightLevelTakesTheClaimBond` | The second address takes the bond; the watcher gets nothing |
| `browser`: `test_Shield_RefutedByTheForgerAfterTheWindowTheForgedClaimStandsAndIsPaid` | The shielded forgery is paid the pot |
| `browser`: `test_Open_AcceptsAOneSecondWindowAndAOneEtherChallengeBondAgainstAOneWeiClaimBond` | No floor on the terms |
| `browser`: `test_Drop_AnUndefendedFalseChallengeLeavesAnHonestPlayerWithNoStandingAtAll` | Bond lost, nothing ranked, earlier run too late to claim |

## 13. Limits

- The prototypes settle through `MockReferee`. Nothing here ran against `ZkReferee`, a real proof or a chain.
- `trust` was checked against its text and its Python model only.
- GPU times are the addendum's third-party figures scaled by segments; nothing was measured on this guest. The 16 GB mid-range figures scale the addendum's "8 to 15 minutes per 1e8 cycles".
- The watcher-capital thresholds assume one coordinated attacker, reference-mix players, a 10% rake, and no reserve that the attacker cannot see.
- The share of players inside a window when a verifier stops, 25% to 50%, is my assumption.
- The L1 data fee is unmeasured everywhere and is left out.
- The hash-only settlement of §4.5 is an estimate, not a design.
