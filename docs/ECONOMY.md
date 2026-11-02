# Economy

The money flow, costs and threats of Challenge runs. This file owns no numbers. Rules and defaults are in README §7 and §8. Season values are in `seasons/*.json`. Measurements go to `docs/VERIFICATION.md`, and the cost table below quotes them. M0.7 wrote this skeleton, and M4.12 completes and reviews it.

## 1. Money flow

All amounts are native ETH, held by `Season` in wei (README §8.4).

1. **Pay.** `startRun(season)` takes the run fee of the season it names, which must be the one accepting runs, exactly, and forwards it to `Season`. The fee joins the pot of the season accepting runs, whatever happens to the run afterwards.
2. **Close.** After the season's end plus grace, anyone may call `closeSeason`. Seasons close in order.
   - The rake is the season's own fees × `rakeBp` / 10,000, rounded down. It is credited to the treasury.
   - The players' pot is the fees, minus the rake, plus the rollover from earlier seasons that had no qualified points.
   - If the season has no qualified points, its players' pot becomes the rollover for the next season to close. A rollover is never raked twice.
3. **Claim.** Each qualified player claims best-run score × players' pot / total qualified points, rounded down, once. The rounding dust stays in `Season`.
4. **Rake.** Anyone may call `withdrawRake`, which sends the credited rake to the immutable treasury.

Only `claim` and `withdrawRake` send ETH out of `Season`, and neither `closeSeason` nor any settlement does.

**Solvency invariant.** `Season`'s balance must always cover the sum of:

- the fees of every season not yet closed;
- the pending rollover;
- the rake not yet withdrawn;
- the unclaimed players' pots of closed seasons, dust included.

**Scores.** A run's score, the sum of its six level scores, sets its share of the players' pot. Testnet seasons take their weights from `seasons/calibration-1.json` (README §8.4): there, a median run of the reference mix scores `medianPoints`, or one point less by rounding, on every level, so the draw of six levels does not decide the ranking.

## 2. Costs

Gas is the unit; an ETH cost is gas × the Arbitrum base fee at the time.

| Cost | Value | Filled by |
|---|---|---|
| `startRun` and `revealRun` gas | `startRun` 131,898 (166,098 for the contract's first run), `revealRun` 63,284, before the L1 data fee ([`VERIFICATION.md`](VERIFICATION.md#challenge-gas)) | M4.6 |
| `commitRun` gas, with a typical six-journal blob and a full one (6 × 8,171 bytes) | typical (1,604 bytes of calldata): 99,049; full (49,604 bytes): 864,069, or 1,940,390 under EIP-7623's calldata floor; before the L1 data fee ([`VERIFICATION.md`](VERIFICATION.md#challenge-gas)) | M4.6 |
| Stylus `verify` gas per level, provisional | TBD (M4.2) | M4.2 |
| Stylus gas gate over the gate set, and gas per six-level run | TBD (M4.9) | M4.9 |
| Settlement gas, excluding `verifyRun` | `settleRun` of a six-level run with 25,636 bytes of calldata: 576,603, of which 353,908 calldata gas; `settleLevel`: 154,050 for a level, 172,905 for the one that records the run; before the L1 data fee ([`VERIFICATION.md`](VERIFICATION.md#settlement-gas)) | M4.7 |
| zk proof verification gas, per run proof and per level proof | TBD (M4.8) | M4.8 |
| zk proving cost per run: CPU time and peak RAM, and the prover-network price | TBD (M4.8) | M4.8 |
| Season aggregation against one proof per run | TBD (M4.8, decided in M4.9) | M4.8, M4.9 |
| Cost of one verified run, against its run fee | TBD (M4.9) | M4.9 |

## 3. Threats

Each row names its mitigation and the item that builds or measures it. M4.12 adds the covering test of each row, or marks it as an accepted residual.

| Threat | Mitigation | Item |
|---|---|---|
| Forged score | The referee replays the level bytes and the journals, and computes the score from the season's weights. No client score is read. | M4.7 |
| Copied journal bytes, from another run or another player | Each Outcome's run nonce, journal hash and level index must match the run being settled (README §7.2). This stops the reuse of the bytes, not of the events: see the next row. | M4.7 |
| Copied or precomputed inputs: if the seed only chose the boss's start and direction, a level would be one of at most 4 × 3,249 games, so public journals and offline search would cover them | D14: the level seed keeps driving the boss through the level, so no two runs share a game (README §7.4). | M1.18, M1.5 |
| An easier level substituted, or the levels reordered | Each level id must be one of the season's levels, and each Outcome's draw slot must be that level's slot (P17). | M4.7 |
| A Training-mode journal, or one played under other rules | Outcome mode = 1, and its rules version equals the season's. | M4.7 |
| Previewing the draw before paying | Pay-then-reveal: the entropy block does not exist when the fee is paid. | M4.3, M4.6 |
| Re-rolling by letting the reveal lapse | No re-anchor: the run is forfeited and its fee stays in the pot. | M4.6 |
| Nonce preview: the run nonce can be computed from the entropy block, up to 256 blocks (about a minute) before `revealRun` starts the clock | Accepted residual, inherited from ethblockdigger. Closing it would change README §7.2: refusing reveals made more than a few blocks after the entropy block shrinks the reveal window, and starting the deadline at `startRun` changes the deadline formula. M4.12 may propose either, as a split item that amends §7.2. | M4.12 |
| Real-time bots | The fee per run, the qualification threshold, and public journals. Fresh entropy per level is the designed upgrade (README §7.4). Measured in §5: a nonce-aware search bot scores 2.03 times the reference mix's run score, 98.5 % of the ceiling, and fresh entropy per level would remove at most 1.5 % of it. | M4.13 (optional), M5.6 |
| Parallel attempts: a team or a bot farm plays each revealed level several times at once and commits the best attempt | Accepted residual: the deadline bounds the wall time, not the number of attempts. Fresh entropy per level is the upgrade. | M4.12 |
| Buying several runs and playing only the best draw | Accepted: each attempt is paid, and only the best run counts (README §8.2). | M4.12 |
| Sybil wallets | A fee per run only. Best runs are kept per wallet, so a player who uses one wallet per run counts every run, as cumulative scoring would (README §8.2). Accepted residual, decided by the owner on 2026-10-29. | M4.12 |
| Deadline gaming | The deadline follows the journals' ticks used; `commitRun` refuses commits that can no longer be on time. Accepted residual: idle ticks count as play, so a player can pad a level, idling instead of ending it or writing the X late, and spend the time on practice or retries. The deadline therefore bounds a run's wall time by the drawn levels' time limits plus `commitSlack`, and padding costs only the fewer-ticks tiebreak (README §7.2). Fresh entropy per level removes practice on later levels. | M4.6, M4.7, M4.12 |
| Censorship or latency near the deadline. The commit carries up to 6 × 8,171 bytes of journals. | `commitSlack`, sized from measured transitions and commit latency. | M4.6, M5.4, M5.5 |
| The sequencer grinds or censors entropy, or skews `block.timestamp` | Accepted residual at testnet stakes, as in ethblockdigger. | M4.12 |
| Settlement griefing: failing calls, partial `settleLevel` progress, front-running | Referee rejections revert with no state change; the credit always goes to the run's player; `settleRun` stays available after a partial `settleLevel`. | M4.7 |
| Disqualification griefing: settling a rival's higher-scoring run that clears too few levels | Qualifying runs rank first, so settling any run of a player never lowers that player's payout (D10). | M4.5 |
| Double settlement, or settlement after the close | Run and level status guards. Settlement ends at end + grace, and the close starts after it; `recordRun` refuses a closed season. | M4.5, M4.7 |
| Abandoned runs | The fee stays in the season's pot, and nothing else is owed. | M4.6 |
| Rake, treasury and rollover | Rake capped at 2,000 bp and immutable for the season; credited to the treasury and withdrawn by anyone; seasons close in order, and a rollover is never raked twice. | M4.5 |
| Draining the pot through claims | One claim per player per season, rounded down; checks-effects-interactions; the solvency invariant and Σ claims ≤ the players' pot, checked by the invariant suite. | M4.5, M4.7 |
| A season that never closes | `closeSeason` is permissionless, and the season job calls it. | M4.5, M5.5 |
| Unclaimed shares and rounding dust | Accepted residual: shares never expire in v1, so unclaimed ETH stays in `Season`. | M4.12 |
| A claimant that rejects ETH | Accepted residual: its share stays unclaimed. | M4.12 |
| The operator opens a season whose referee lies | `open` checks the referee's rules version and records its codehash, which players can compare with the reproducible build (M4.1; `cargo stylus verify` in M4.14; the zk image id). Custody of the operator key is a pre-mainnet prerequisite. | M4.5, M4.14 |
| A season lists an invalid level, so runs that draw it can never settle | The operator checks the 16 levels with the level tool before opening (README §8.4). | M5.5 |
| The operator never opens another season | Accepted residual: a pending rollover stays in `Season` until a season opens. Claims, close and rake withdrawal stay permissionless. | M4.12 |
| A season's referee and its rules version | The referee is bound to the season, and `open` requires `referee.rulesVersion()` to equal the season's rules version. | M4.5 |
| A consensus bug in a live season's referee | Accepted residual on testnet: the referee is immutable and has no pause. The vectors and differential fuzzing reduce the risk. A procedure is a pre-mainnet prerequisite. | M1.13, M4.1, M4.12 |
| The Stylus referee expires or needs reactivation mid-season | `season.mjs open` refuses a Stylus referee whose remaining activation time is below the season's length plus grace; keepalive extends it. Reactivation goes through Arbitrum's activation process. | M5.5 |
| Journal publication (P5) | The journals are in the `commitRun` calldata, and the contract computes the commitment from them, so every committed run's journals are public and authentic. | M4.6, M5.3 |
| zk prover trust, if D2 = zk | `ZkReferee` pins its image id or program key, and the address of the framework's version-specific verifier, immutably. It never calls an upgradeable router or gateway, whose owner could add a route that accepts forged proofs. The prover-network credential lives in its own capped account. | M4.10 |
| On zk, the operator is in practice the only prover: it omits or delays handed-off runs, or a flood of run files from many wallets uses up its capped prover account or the grace before honest runs are proven | Accepted residual on testnet. Settlement stays open to any submitter, so a player can prove and settle their own run. The operator replays each run file offline, for free, and proves only each player's best run, and the grace is sized from the expected settled runs. The later proving service removes the handoff (README §7.5). | M5.5, M4.12 |
| Unaudited contracts | Testnet with test ETH only; an audit is a pre-mainnet prerequisite. | M4.12 |

## 4. Pre-mainnet prerequisites (not scheduled)

- a professional audit of the contracts;
- a legal read of the paid prize pool, with geo-gating as the fallback if the read requires it;
- custody of the operator key behind `Season.open` and of the treasury address, for example a multisig;
- a procedure for a consensus bug found in a live season's referee, which is immutable and has no pause;
- an Arbitrum One deployment in native ETH, with seasons of likely 14 days, whose first season takes its weights from bot data;
- weights for later seasons from the previous season's public journals plus bot data (README §8.4), through a `calibrate --from-season <season>` mode;
- fresh entropy per level (README §7.4);
- journal signing with a device key on the RP2350 (README §7.1);
- season proof aggregation, if M4.9 did not adopt it for testnet and zk becomes the mainnet path;
- a reactivation policy for the Stylus referee.

## 5. Bot advantage (M4.13)

**Status: done.** The rules below were committed before any run of the study was played (commit 0a743ab, before shard 1). The 8 shards of `reports/bot-advantage/` are committed and merged into [`reports/bot-advantage.md`](../reports/bot-advantage.md), which owns every number quoted here. Intervals are 95 % percentile-bootstrap intervals over the 200 paired runs.

### What is measured

- **The bot.** `search` (`tools/src/bots/search.rs`) reads the game it plays, which holds the boss's state and deflection key from the level seed (README §6.4), so the core, stepped on a copy, predicts every mask exactly. Each decision pads half the ticks the level can spare beyond a reserve, dodging the minions, then searches two captures deep, a setup and a finisher, for the clear that leaves the boss the smallest region.
- **Its budget.** Compute is counted in deterministic work units, so a shard replays byte for byte on any machine. The bot spends at most `UNITS_PER_TICK` units per tick played, at most 0.75 s of compute per game second at the worst level's measured cost on one idle container core. A search spends only the units accrued since the state it searches from became known, on the level it plays. It uses no `commitSlack`, no nonce preview and no second core, so a real bot can buy more compute than this one: the score ceiling below bounds what more compute could add.
- **Padding.** README §7.2 lets a run pad every level up to its time limit, since padding costs only the fewer-ticks tiebreak. At 1 s of compute per game second, that buys up to 180 s of compute per level, and pooled over the six levels that one run nonce reveals at once, up to 1,080 s plus `commitSlack` per run, on any number of cores. The measured bot pads only half of each level's spare ticks, on one core, one level at a time.
- **The runs.** 200 six-level Challenge runs of seed 7: run k has the run nonce `nonce(7, k)`, plays the levels its draw names under Challenge headers, and scores them at the weights of `seasons/calibration-1.json`. The five scripted bots play the same 1,200 games, so every comparison is paired over the runs.
- **The ceiling.** No play claims more than (claimable − B²) × 10,000 / claimable bp on a level: the boss's B × B body covers only open cells, which no capture claims. The ceiling run score bounds the uplift of any bot, at any budget.

### Pre-registered endpoints and rules

- **Primary endpoint:** the mean paired run-score uplift of `search` over the reference mix (`levels/targets.json`), with its 95 % percentile-bootstrap interval. **Key secondary endpoint:** the same over the scripted portfolio, the best scripted policy on each level, which a nonce-aware bot gets with no search at all. Every other figure of the report is descriptive.
- **Rule D (D10's `minClears`).** A(m) is the payout ratio per run of `search` over a mix player under pro-rata payout with `minClears` m. Among the m from 1 to 6 at which the reference mix qualifies at least 50 % of its runs, let m\* be the one with the smallest A(m), the smaller m on a tie. Recommend `minClears` = m\* if m\* is 1, or if the upper bound of A(m\*)'s interval is below the lower bound of A(1)'s; otherwise recommend 1, the D10 default. Rule D is also applied with greedy as the human proxy (A(m) over greedy); if it names another m, the recommendation says so. M5.5 applies or declines the recommendation for `testnet-1`.
- **Rule F (fresh entropy per level).** Let H be the ceiling's mean run score over the mean run score of `search`, minus 1: the most that any bot could add to the measured one, through more compute, pooling across the levels, or anything else. If the upper bound of H's interval is below 5 %, fresh entropy per level is not a bot mitigation: it can remove at most H, so recommend keeping it, if at all, for the parallel-attempt and deadline-gaming rows of §3. Otherwise keep it on the list of bot mitigations, with H as the most it can remove. Rewording README §7.4, which calls fresh entropy the designed upgrade, is the owner's decision, in a follow-up PR.
- **Pot share.** README §8.2 puts the break-even of a run at about the season's qualified points per paid run over 1 − rake, 1.25 times at the 20 % rake cap. If the lower bound of the interval of the ratio of mean run scores, `search` over the reference mix, is above 1.25, the fee alone does not make a bot run unprofitable in a season of mix-like players; if its upper bound is below 1.25, it does; otherwise the study does not decide.

### Results

- **Primary endpoint.** `search` scores 133,474.6 points per run on average against the reference mix's 65,682.7: a mean paired uplift of 67,791.9 [64,495.1, 71,175.0] points, a median of 67,116 [62,731, 73,150], and a ratio of means of 2.032 [1.966, 2.102]. It wins all 200 runs.
- **Key secondary endpoint.** Over the scripted portfolio (108,794.3 points), the mean uplift is 24,680.2 [23,460.8, 25,981.6], a ratio of 1.226 [1.216, 1.238]; it wins all 200 runs. A nonce-aware bot with no search at all would already score 1.65 times the mix (108,794.3 / 65,682.7).
- **Against the ceiling.** `search` clears every drawn level of every run and reaches 0.985 [0.984, 0.985] of the ceiling run score (135,487.7 points); the ceiling is 1.015 [1.014, 1.015] times its score. Its lowest per-level mean claim is 9,580 bp, on `16 doom`, whose ceiling is 9,809 bp.
- **Rule D.** The reference mix qualifies at least 50 % of its runs at m = 1, 2 and 3 (99.2 %, 90.7 %, 70.0 %; 39.2 % at m = 4). A(m) over the mix is 2.048 [1.977, 2.126], 2.238 [2.123, 2.369] and 2.880 [2.647, 3.161]: it is smallest at m = 1, so m\* = 1. With greedy as the human proxy, greedy qualifies at least 50 % at every m (82.0 % at m = 6), and A(m) over greedy is 1.287 [1.266, 1.310] for m = 1 to 4, 1.295 at m = 5 and 1.516 at m = 6: the smallest, tied from 1 to 4, gives m = 1 by the tie rule. Raising `minClears` only widens the bot's advantage over the mix.
- **Rule F.** H = 1.015 − 1 = 1.5 % [1.4 %, 1.5 %]. Its upper bound is below 5 %.
- **Pot share.** The ratio of mean run scores, `search` over the mix, is 2.032 [1.966, 2.102]. Its lower bound is above 1.25, the break-even at the 20 % rake cap.

### Recommendations

- **D10 `minClears`: 1**, the D10 default, by rule D; the greedy proxy names the same m. M5.5 applies or declines it for `testnet-1`.
- **Fresh entropy per level: not a bot mitigation**, by rule F. A bot that sees one level at a time can lose at most 1.5 % of the score this bot reaches while it sees all six, so fresh entropy per level would leave the bot's advantage over the mix almost whole. Keep it, if at all, for the parallel-attempt and deadline-gaming rows of §3, where it removes practice on later levels. README §7.4 still calls it the designed upgrade; rewording that is the owner's decision, in a follow-up PR.
- **What this means for the economy.** By the pot-share rule, the fee alone does not make a bot run unprofitable in a season of mix-like players: a bot's run takes about twice a mix player's share of the pot. Of the other levers README §7.4 lists, a higher qualification threshold only widens the bot's advantage (rule D) and fresh entropy per level removes at most 1.5 % (rule F), which leaves public journals, which let anyone see machine-perfect play. The pot-share result also holds only for a season of mix-like players: a season with stronger players shrinks the bot's share. This is input for M4.12's threat table and the owner's acceptance of residual risks for testnet.

### Limits

- `search` is a lower bound on what a bot can do; the ceiling is the upper bound.
- The reference mix and greedy are scripted proxies for players, not humans. The two Training journals of `reports/playtest-human-1.md` are too few for an interval; a few more of the owner's journals would give a human baseline (plan M4.13, "Needs user").
- One machine calibrated the unit; the study's bytes do not depend on it, but its compute claim does.
