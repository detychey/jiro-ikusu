# Economy

The money flow, costs and threats of Challenge runs. This file owns no numbers. Rules and defaults are in README §7 and §8. Season values are in `seasons/*.json`. Measurements go to `docs/VERIFICATION.md`, and the cost table below quotes them. M0.7 wrote this skeleton, and M4.12 completes and reviews it.

## 1. Money flow

All amounts are native ETH, held by `Season` in wei (README §8.4).

1. **Pay.** `startRun` takes the season's run fee, exactly, and forwards it to `Season`. The fee joins the pot of the season accepting runs, whatever happens to the run afterwards.
2. **Close.** After the season's end plus grace, anyone may call `closeSeason`. Seasons close in order.
   - The rake is the season's own fees × `rakeBp` / 10,000, rounded down. It is credited to the treasury.
   - The players' pot is the fees, minus the rake, plus the rollover from earlier seasons that had no qualified points.
   - If the season has no qualified points, its players' pot becomes the rollover for the next season to close. A rollover is never raked twice.
3. **Claim.** Each qualified player claims best-run score × players' pot / total qualified points, rounded down, once. The rounding dust stays in `Season`.
4. **Rake.** Anyone may call `withdrawRake`, which sends the credited rake to the immutable treasury.

Only `claim` and `withdrawRake` send ETH, and neither `closeSeason` nor any settlement does.

**Solvency invariant.** `Season`'s balance must always cover the sum of:

- the fees of every season not yet closed;
- the pending rollover;
- the rake not yet withdrawn;
- the unclaimed players' pots of closed seasons, dust included.

## 2. Costs

Gas is the unit; an ETH cost is gas × the Arbitrum base fee at the time.

| Cost | Value | Filled by |
|---|---|---|
| `startRun` and `revealRun` gas | TBD (M4.6) | M4.6 |
| `commitRun` gas, with a typical six-journal blob and a full one (6 × 8,171 bytes) | TBD (M4.6) | M4.6 |
| Stylus `verify` gas per level, provisional | TBD (M4.2) | M4.2 |
| Stylus gas gate over the gate set, and gas per six-level run | TBD (M4.9) | M4.9 |
| Settlement gas, excluding `verifyRun` | TBD (M4.7) | M4.7 |
| zk proof verification gas, per run proof and per level proof | TBD (M4.8) | M4.8 |
| zk proving cost per run: CPU time and peak RAM, and the prover-network price | TBD (M4.8) | M4.8 |
| Season aggregation against one proof per run | TBD (M4.8, decided in M4.9) | M4.8, M4.9 |
| Cost of one verified run, against its run fee | TBD (M4.9) | M4.9 |

## 3. Threats

Each row names its mitigation and the item that builds or measures it. M4.12 adds the covering test of each row, or marks it as an accepted residual.

| Threat | Mitigation | Item |
|---|---|---|
| Forged score | The referee replays the level bytes and the journals, and computes the score from the season's weights. No client score is read. | M4.7 |
| Copied journals, from another run or another player | Each Outcome's run nonce, journal hash and level index must match the run being settled (README §7.2). | M4.7 |
| An easier level substituted, or the levels reordered | Each level id must be one of the season's levels, and each Outcome's draw slot must be that level's slot (P17). | M4.7 |
| A Training-mode journal, or one played under other rules | Outcome mode = 1, and its rules version equals the season's. | M4.7 |
| Previewing the draw before paying | Pay-then-reveal: the entropy block does not exist when the fee is paid. | M4.3, M4.6 |
| Re-rolling by letting the reveal lapse | No re-anchor: the run is forfeited and its fee stays in the pot. | M4.6 |
| Nonce preview: the run nonce can be computed from the entropy block, up to 256 blocks (one to two minutes) before `revealRun` starts the clock | Accepted residual, inherited from ethblockdigger. Two options remain for M4.12: refuse reveals made more than a few blocks after the entropy block, or start the deadline at `startRun`. | M4.12 |
| Real-time bots | The fee per run, the qualification threshold, and public journals. Fresh entropy per level is the designed upgrade (README §7.4). | M4.13 (optional), M5.6 |
| Parallel attempts: a team or a bot farm plays each revealed level several times at once and commits the best attempt | Accepted residual: the deadline bounds the wall time, not the number of attempts. Fresh entropy per level is the upgrade. | M4.12 |
| Buying several runs and playing only the best draw | Accepted: each attempt is paid, and only the best run counts (README §8.2). | M4.12 |
| Sybil wallets | A fee per run; payout pro-rata by best-run score, not by run count. | M4.5 |
| Deadline gaming | The deadline follows the journals' ticks used; `commitRun` refuses commits that can no longer be on time. | M4.6, M4.7 |
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
| The operator opens a season whose referee lies | `open` checks the referee's rules version and records its codehash, which players and the dApp compare with the reproducible build (M4.1, `cargo stylus verify`, the zk image id). Custody of the operator key is a pre-mainnet prerequisite. | M4.5, M5.2 |
| The operator never opens another season | Accepted residual: a pending rollover stays in `Season` until a season opens. Claims, close and rake withdrawal stay permissionless. | M4.12 |
| A season's referee and its rules version | The referee is bound to the season, and `open` requires `referee.rulesVersion()` to equal the season's rules version. | M4.5 |
| A consensus bug in a live season's referee | Accepted residual on testnet: the referee is immutable and has no pause. The vectors and differential fuzzing reduce the risk. A procedure is a pre-mainnet prerequisite. | M1.13, M4.1, M4.12 |
| The Stylus referee expires or needs reactivation mid-season | Keep it alive, and check its remaining activation time against the season's length plus grace before opening. Reactivation goes through Arbitrum's activation process. | M5.5 |
| Journal publication (P5) | The journals are in the `commitRun` calldata, and the contract computes the commitment from them, so every committed run's journals are public and authentic. | M4.6, M5.3 |
| zk prover trust, if D2 = zk | `ZkReferee` pins its image id or program key immutably. The prover-network credential lives in its own capped account. | M4.10 |
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
