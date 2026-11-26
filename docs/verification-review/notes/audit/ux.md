# Verification of level completion: player and operator experience

Read-only audit of `the repository root` at `f52a60a` (main, 2026-11-10). Lens: what a player and the
operator live through between the last level of a Challenge run and the payout, on the backend that
is deployed (zk, decision D2). Every figure is quoted from a file of the repository, with its line,
or comes from one of the two timing scripts of section 11, which only read the repository.

State of the work: M5.1, M5.2, M5.3 and M5.7 are merged; M5.5 (season operations, the proving route,
`season.mjs settle`) and M5.6 (testnet season 1) are not started. `scripts/contracts/season.mjs` has
one command, `open` (lines 139-141). There is no `season-ops.yml`, `docs/SEASON_RUNBOOK.md` or
`docs/TESTNET.md` yet. So this review comes before the operator pipeline is built.

## 1. From the last level to the payout (zk, as deployed)

| Step | Who | What happens | Time | Source |
|---|---|---|---|---|
| Commit | player's browser | one `commitRun` with the six journals; the contract stores the keccak of the six journal hashes | 0.5 s to inclusion, receipt after 2.3 s | `web/src/run/flow.ts:139-163`; `docs/DEPLOYMENT.md:168` |
| Outcomes shown | player's browser | the wasm core replays the six journals with the season's weights and shows end reason, claim, ticks and score per level, and offers the run file | milliseconds (section 3) | `web/src/pages/challenge.ts:251-269` |
| Wait | nobody | nothing onchain; the run is not on the leaderboard | until the operator settles: the plan says "the best runs settled, after the end" | `IMPLEMENTATION_PLAN.md:2035`; `web/src/chain/leaderboard.ts:33-48` |
| Rebuild and replay | operator | rebuilds every committed run from chain data and replays it offline, picks each player's best on-time run | free, but the tool does not exist yet | `README.md:671`; `IMPLEMENTATION_PLAN.md:1996`; `scripts/contracts/season.mjs:139-141` |
| Prove | operator | `zk-host prove --run <run file> --season <season file>`: segment proofs, recursion, Groth16 in Docker | 75 min for the shortened testnet run; 9 to 11 h estimated for a real six-clear bot run; 16 to 17 h for the heaviest | `docs/DEPLOYMENT.md:175-178, 245-252`; `docs/VERIFICATION.md:708` |
| Settle | operator (anyone may) | `settleRun(runId, levels, journals, proof)`; `Season` records the best run | one transaction, 530,256 gas for the short run, 804,194 estimated for a typical one | `contracts/src/Challenge.sol:148-171`; `docs/DEPLOYMENT.md:150`; `docs/ECONOMY.md:44` |
| Cutoff | contract | after `end + grace` every settlement reverts with `SettlementClosed`, for good | grace: 24 h on testnet-0, 48 h proposed, 30 days at most | `contracts/src/Challenge.sol:210-216`; `seasons/testnet-0.json`; `README.md:740`; `contracts/src/Season.sol:46` |
| Close | anyone | `closeSeason()` once `block.timestamp > end + grace` | 126,080 gas | `contracts/src/Season.sol:186-208`; `docs/VERIFICATION.md:869` |
| Claim | player | `claim(season)` pays `bestScore x playersPot / totalQualifiedPoints` | 84,198 gas; shares never expire | `contracts/src/Season.sol:210-223`; `README.md:755` |

So a run played on day 1 of a 14-day season is confirmed and paid 14 to 16 days later (longer with a
longer grace), and a run played in the last minutes after the grace. The actual checking work, the
replay, takes about 20 ms per level in the browser (section 3).

What the player must do after committing: nothing until the season has closed, then one `claim`
transaction. That part of the design is good. What the player cannot do is make the settlement
happen themselves (section 4, finding ux-1).

## 2. Whom the player must trust

Nobody can forge a score: the proof binds journal hashes, level ids, weights and Outcomes, and
`ZkReferee` pins the image id and a fixed verifier (`contracts/src/ZkReferee.sol:69-94`). All the
trust below is about liveness, and liveness decides the payout, because of the hard cutoff.

1. **The operator, for everything after the commit.** It must run a tool that does not exist yet,
   own a working prover, pick the right run, and finish before `end + grace`. `docs/ECONOMY.md:84`
   says it plainly: "On zk, the operator is in practice the only prover", and lists omission or
   delay as "an accepted residual on testnet". A run that is not settled earns nothing and its fee
   stays in the pot, shared pro-rata by the players who were settled (`contracts/src/Season.sol:194-206`).
   If nothing is settled, the whole pot rolls over to the next season's players.
   On testnet the operator is also a player: bots play from the tester key in the same season
   (`IMPLEMENTATION_PLAN.md:2038`), and the deployer key is at once `Season`'s operator, the
   treasury and the settler (`docs/DEPLOYMENT.md:15`). Each omitted run raises the share of every
   settled run, the operator's bots included. Test ETH only, but the structure is the one README
   §7.5 wants to avoid.
2. **RISC Zero.** The verifier's soundness, and its emergency stop: "its owner can only pause it,
   for good, and anyone can pause it with a proof of the all-zero claim" (`docs/ECONOMY.md:83`).
   "A stopped emergency stop halts settlement and forges nothing: the season's pot rolls over"
   (`docs/DEPLOYMENT.md:196`). The players of that season lose their payout.
3. **The proving route.** Either the owner's machine (one person, one box), or Boundless: ETH on
   Base mainnet, a public program URL, and a market where "Two requesters and two provers account
   for all the raw Groth16 requests" (`docs/VERIFICATION.md:531, 754`). Bonsai, the centralized
   API, "is no longer available" (`docs/VERIFICATION.md:529`).
4. **Docker Hub**, for `risczero/risc0-groth16-prover:v2025-04-03.1`, 5.2 GB, x86 only, "on Docker
   Hub only" (`referee/zk/README.md:92`; `docs/DEPLOYMENT.md:50`). The repository records two
   rate-limit refusals from Docker Hub (`docs/TOOLING.md:10, 92`).
5. **The site and the public RPC**, to see the season and to claim (section 4, finding ux-9); the contracts
   themselves can be called with `cast`.

README §7.5 says of a prover "The worst it can do is refuse or delay" (`README.md:675`). With a
cutoff after which the run can never settle, and a pro-rata pot, refusing or delaying is the same as
taking the player's share and giving it to the others.

## 3. What the browser does at settlement today, and how long it takes

`web/src/pages/settle.ts`, called once the wallet connects on `season.html`
(`web/src/pages/season.ts:185-215`):

1. reads the runs this browser holds in IndexedDB for the account (`settle.ts:194`);
2. replays each committed run with the wasm core and ranks them in D10's order, keeping the on-time
   ones by the contract's deadline formula (`settle.ts:43-70`; `web/src/run/deadline.ts`);
3. reads `Challenge.settlements(runId)` for the best one (`settle.ts:200`);
4. on a backend other than zk it shows "Settle this run", and `settleOnchain` sends one `settleRun`
   or six `settleLevel` with an empty proof, with a gas estimate, three tries on network failures and
   decoded reverts (`settle.ts:88-148`);
5. **on zk it sends nothing.** It reads `Season.settlementEndOf` and shows: "On Arbitrum Sepolia,
   the operator proves and settles runs: proving needs credentials that cannot live in a browser.
   Send the operator the run file; the season's settlement closes at <time>", with a "Download the
   run file" button (`settle.ts:175-178, 205-210`). No Settle button, no status of the proof, and
   the proof argument of `settleOnchain` is the literal `"0x"` (`settle.ts:92, 116, 127`), so a
   player who had a proof could not submit it from the page.

Time. The browser's part is replay, measured here on the built `jiro_wasm.wasm` (28,250 bytes) in
Node 22.23.4 (V8, the engine of Chrome) on a 4-vCPU Xeon at 2.1 GHz:

| What | Time |
|---|---|
| `replay` of one gate-set level (`vectors/levels/`, 1,233 to 2,700 ticks), Outcome and per-tick state-hash trace | 10 to 22 ms typical, median 19.6 ms over the 32 vectors |
| the six slowest gate-set vectors together, an upper bound for a run | 0.19 s |
| the ticks alone, through `load_level`, `start`, `tick`, with no state hash | 0.4 to 3.0 ms per level |
| testnet-0 run 1 (`seasons/testnet-0/runs/run-1.json`), six levels | 3.4 ms, giving score 20,310 and 338 ticks, the values of `RunSettled` (`docs/DEPLOYMENT.md:173`) |

The same run took 4,515.3 s to prove (`docs/DEPLOYMENT.md:177`): 1.3 million times its replay. The
heaviest run, at 16 to 17 h against 0.19 s, is about 300,000 times. The state-hash trace is what
costs in the browser: about 7 times the game itself, since each tick hashes a 948-byte preimage,
which stepping alone never does (`core/src/hash.rs:1-2`).

## 4. Failure modes a player can hit after finishing a run

1. **The operator does not settle the run before `end + grace`.** No payout, no refund, no later
   path: `SettlementClosed` (`contracts/src/Challenge.sol:213-215`). The page gives no warning
   beyond the cutoff time.
2. **The player cannot do it themselves.** It needs: an x86-64 machine with Docker; the repository
   bind-mounted at `/home/runner/work/jiro-ikusu/jiro-ikusu`, as root, or the image id differs and
   the proof fails (`referee/zk/README.md:58-67`); the RISC Zero toolchain and a host build of about
   an hour ("the host build 62 min 58 s", `docs/TOOLING.md:159`); 9.2 GiB of RAM, or 4.6 GiB with
   `--segment-po2 19`, then about 7 GiB for the Groth16 container (`docs/VERIFICATION.md:707`);
   9 to 17 hours on 4 CPUs; then `cast send` with an ABI-encoded proof. For a run whose fee is
   0.00005 ETH, about $0.11.
3. **The operator settles a worse run than the player's best,** or none because it ran out of
   capacity (section 6). The contract keeps the best settled run, so a wrong pick lowers the share.
4. **RISC Zero's emergency stop is paused during the season or its grace.** No run settles; the pot
   rolls over (`docs/DEPLOYMENT.md:196`).
5. **The operator's build no longer reproduces the pinned image id** (toolchain drift, another
   path). Same effect as 4. `ZkReferee` is immutable; a new one means a new season.
6. **The run is marked late at settlement.** "A missed deadline is a result, not a revert"
   (`contracts/src/Challenge.sol:268-277`): final, and known onchain only when the operator settles.
   The page does compute it locally (`settle.ts:66`) and shows the margin at commit
   (`web/src/run/flow.ts:161`).
7. **The page tells the player to send a file to nobody.** "Send the operator the run file"
   (`settle.ts:177`) names no recipient and no channel, and contradicts README §7.5, "Players do
   nothing after committing" (`README.md:671`). No page reads a run file back: `parseRunFile` is
   used by tests only (`web/src/run/runfile.ts:49`).
8. **Another browser, another device, or cleared site data.** The settlement section says "This
   browser holds no on-time committed run of yours in season N" (`settle.ts:197`): it reads
   IndexedDB only, although `committedRun` can rebuild any run from the chain
   (`web/src/chain/calldata.ts:112-135`). The payout is not affected if the operator rebuilds from
   the chain, but the player sees nothing about their run.
9. **A contract wallet committed the run.** If the transaction's input does not carry the
   `commitRun` call, rebuilding needs `debug_traceTransaction`, which the page asks for with "load
   the run through an RPC that serves traces" (`calldata.ts:87-95`). The operator needs such an RPC
   too, or the run file from the player.
10. **No standing until settlement.** The leaderboard is built from `BestRunRecorded` alone
    (`leaderboard.ts:33-48, 71-75`): a player with no settled run is not on it, and the "Claim (if it
    closed now)" column ignores every unsettled run.
11. **The season page fails to read its logs.** The claim, close and settlement sections all need
    the full log scan to succeed (`season.ts:157-161, 163-183, 197-200`); the scan runs from the
    season's first block to the head, "about 484 calls per event" for 14 days
    (`web/README.md:148-150`), and more for every day after.
12. **Nobody qualified and settled.** The season's pot goes to the next season's players
    (`contracts/src/Season.sol:196-203`).
13. **The claim needs `closeSeason` first**, by anyone, and the claimant's own transaction; a
    claimant that rejects ETH cannot claim (`docs/ECONOMY.md:75`).

Before the commit, for completeness: a lapsed reveal forfeits the run after about a minute
(`README.md:538`), and a hidden tab or a reload eats the commit slack (`web/README.md:104-106`).
Those are not about verification.

## 5. What the operator must run every season (zk)

From `IMPLEMENTATION_PLAN.md:1987-2030`, `docs/DEPLOYMENT.md` §1 and §6, `referee/zk/README.md`:

- **Keys.** `DEPLOYER_KEY`: `Season`'s operator, the treasury and, so far, the settler
  (`docs/DEPLOYMENT.md:15`; `scripts/contracts/e2e.mjs:810`). Settlement is permissionless, so the
  settler does not need to be the operator key; it was in M4.14. `TESTER_KEY` for the bot runs. A
  funded Base wallet if a prover network proves.
- **Open.** `season.mjs open`, after the level tool validates the 16 levels.
- **Daily.** `season-ops.yml`: status, solvency, bot runs (not built).
- **After the end.** `season.mjs settle` (not built): rebuild every committed run of the season from
  chain data, replay all of them, pick each player's best on-time run, prove it, send `settleRun`.
  Rebuilding as `committedRun` does costs about 60 RPC calls per run (two binary searches on block
  timestamps, one log read, one transaction read; `web/src/chain/calldata.ts:66-99`,
  `web/src/chain/logs.ts:13-24`), and a trace RPC for contract-wallet commits.
- **After end + grace.** `closeSeason`, `withdrawRake`.
- **The proving machine.** x86-64, 4 CPUs, 16 GB: 9.2 GiB peak in `zk-host`, then 7.0 GiB in the
  Groth16 container, inside a 13.36 GiB cgroup in the measurements (`docs/VERIFICATION.md:674, 699`).
  Docker daemon started by hand through a registry mirror (`docs/TOOLING.md:81-92`). The repository
  at the fixed path, bind-mounted as root (`docs/DEPLOYMENT.md:35-47`). The RISC Zero toolchain
  `r0.1.97.0`. An hour of build on a cold cache.
- **One proof at a time, all or nothing.** `prove.rs` calls `prove_with_opts` once for all segments,
  then `compress` twice (`referee/zk/host/src/prove.rs:61-75`); `e2e.mjs` writes the proof file only
  when all of it is done (`scripts/contracts/e2e.mjs:707-719`). `--resume` reuses a finished proof,
  not a partial one (`docs/DEPLOYMENT.md:99`). A crash at hour 8 of a 9-hour proof starts again.
- **It cannot run on GitHub Actions.** "Actions cannot prove whole runs": jobs stop at 6 h
  (`IMPLEMENTATION_PLAN.md:2008`). So it is a person at a machine: "If your machine is the proving
  route (G2), run `season.mjs settle` on it after the season's end" (`IMPLEMENTATION_PLAN.md:2260`).
- **Money per verified run.** 804,194 gas, 0.0000161 ETH at 0.020036 gwei, plus 0.0000184 ETH on
  Boundless: 0.0000345 ETH, "69% of the 0.00005 ETH fee, before the L1 data fee"
  (`docs/ECONOMY.md:44`), and the L1 data fee is one "which neither M4.7 nor M4.16 measured"
  (`docs/VERIFICATION.md:933`). Arbitrum Sepolia prices L1 calldata at 0 today
  (`docs/DEPLOYMENT.md:24`), so the testnet cannot measure it either.

What has actually been proven so far (`docs/VERIFICATION.md:699-702, 988`; `docs/DEPLOYMENT.md:176-177`):

| Proof | Segments | Time |
|---|---:|---:|
| six smallest game vectors, run mode, container | 7 | 3,297 s |
| `worst-case`, one level, container | 28 | 13,177 s |
| `commit-at-tick-0`, one level, 2-vCPU runner, 2^19 segments | 3 | 2,128 s |
| six smallest game vectors, runner, 2^19 segments | 15 | 10,168 s |
| `zk-run.json`, five levels closed at tick 30 to 90 | 16 | 7,638 s |
| testnet-0 run 1, `--short`, five levels closed at tick 30 | 13 | 4,515 s |

No complete six-level run of a bot or a person has been proven. Such runs need 67 to 81 segments
(bots, `docs/DEPLOYMENT.md:245-249`, "Executed (not proven)") or up to 131 (the gate set's heaviest,
`docs/VERIFICATION.md:708`). The 9 to 17 hours are segments x 467 s + 170 s, a formula checked
against a 16-segment proof. Boundless: "No request was made" (`docs/VERIFICATION.md:771`).

## 6. Scaling: 100, 1,000 and 10,000 best runs per season

Arithmetic on the recorded figures (`scaling.mjs`): 9 to 17 hours per run on one 4-CPU, 16 GB
machine; 0.0000184 ETH per Boundless proof; 0.0000161 ETH of gas per settlement; ETH at $2,295.05
(`docs/VERIFICATION.md:763`). One machine proves 1 to 2 runs in a 24 h grace, 2 to 5 in 48 h, 42 to
80 in the 30-day maximum.

| Best runs | Machine-hours on 4 CPUs | Machines to finish in a 48 h grace | In a 30-day grace | Boundless proofs | Proofs plus settlement gas | Proofs per day in a 48 h grace, against the market's 197 per day |
|---:|---:|---:|---:|---:|---:|---:|
| 20 | 180 to 340 (7.5 to 14 days) | 4 to 8 | 1 | 0.00037 ETH ($0.84) | 0.00069 ETH ($1.58) | 10 (0.1 times) |
| 100 | 900 to 1,700 (38 to 71 days) | 19 to 36 | 2 to 3 | 0.00184 ETH ($4.22) | 0.00345 ETH ($7.92) | 50 (0.3 times) |
| 1,000 | 9,000 to 17,000 (1.0 to 1.9 years) | 188 to 355 | 13 to 24 | 0.0184 ETH ($42) | 0.0345 ETH ($79) | 500 (2.5 times) |
| 10,000 | 90,000 to 170,000 (10 to 19 years) | 1,875 to 3,542 | 125 to 237 | 0.184 ETH ($422) | 0.345 ETH ($792) | 5,000 (25 times) |

- The market's 197 per day is the week read on 2026-11-02: "1,376 fulfilled" in 7 days, from two
  provers (`docs/VERIFICATION.md:753-754`). At 1,000 best runs the project alone would be 2.5 times
  the whole market's volume during the grace. Nothing in the repository says the provers could
  absorb it or at what price.
- Proving during the season instead of after it spreads the load over 384 h (14 days plus 48 h):
  3 to 5 machines for 100 runs, 24 to 45 for 1,000. It wastes a proof each time a player improves.
- CPU proving is 36 to 68 vCPU-hours per run. At any cloud price that is dollars per proof, for a
  run fee of $0.11; the repository records no GPU measurement (`docs/VERIFICATION.md:674`, "no GPU").
- Money in against money out. The rake is 0.000005 ETH per run at testnet-0's 1,000 bp
  (`seasons/testnet-0.json`), 0.00001 ETH at the 2,000 bp cap (`contracts/src/Season.sol:44`). One
  verified run costs 0.0000345 ETH, so it eats the rake of 6.9 runs, or 3.45 at the cap. Each wallet
  needs its own proof, and README §8.2 says a player with a wallet per run "out-earns a one-wallet
  player of the same skill and spend" (`README.md:713`). With one run per wallet the operator pays
  3.45 to 6.9 times what it earns.
- Flooding. A committed qualifying run from a fresh wallet costs its owner the fee, which comes
  back pro-rata if the run is settled, and about 0.3 million gas (`startRun` 127,979 to 162,179,
  `revealRun` 59,396, `commitRun` 94,289 for run 1's journals; `docs/DEPLOYMENT.md:147-151`). It
  costs the operator a proof.
  `docs/ECONOMY.md:84` names it: "many committed runs from many wallets use up its capped prover
  account or the grace before honest runs are proven", an "accepted residual on testnet". With a
  capacity of 2 to 5 proofs per machine per 48 h, the capacity is the attack surface: whoever is not
  proven in time is not paid, and their fee goes to those who were.

## 7. What would have to be true for a player to settle from the browser, with nothing installed

**(a) The browser makes today's proof.** All of these, and none holds:

- a RISC Zero prover that runs in a browser. The host uses `default_prover()` natively and Docker
  for Groth16 (`referee/zk/host/src/prove.rs:59-75`). "Its `cuda` feature replaces Docker with a
  native GPU prover; there is no native CPU route" (`docs/VERIFICATION.md:508`);
- memory within a browser tab: 9.2 GiB with 2^20-cycle segments, 4.6 GiB with 2^19
  (`docs/VERIFICATION.md:707`), more than a wasm32 module can address (4 GiB), then about 7 GiB for
  the Groth16 step;
- time: 69 to 137 million proving cycles at the measured 2,600 cycles per second on 4 native CPUs
  (2^20 cycles in about 400 s) is 7 to 15 hours of segment proofs. A five-minute wait needs 88 to
  174 times that rate, in wasm;
- a wrap without Docker: an unwrapped receipt is 536,784 bytes for two segments
  (`docs/VERIFICATION.md:500`), "not onchain-verifiable", and above the sequencer's 95,000-byte
  limit (`README.md:649`).

README §7.5 is right for this stack: "The browser never proves anything" (`README.md:671`). The
proven computation would have to shrink by about three orders of magnitude, or the proof system
change, before a browser could prove it.

**(b) The browser orders the proof.** Possible in principle: the page asks a prover for the proof
and then calls `settleRun`. It needs a prover API a browser can call. Boundless needs the player to
hold ETH on Base mainnet, a second network in the wallet, a deposit or a paid request, and the
program at a public URL; the player would pay about 37% of the run fee for the proof and 32% for the
gas, to claim a pro-rata share. An operator-run proving service is README §7.5's later version, and
a server again. `settleOnchain` would need a proof argument: today it passes `"0x"`.

**(c) Stylus reopens.** Then the page settles by itself today, with no new web code:
`settlesInBrowser` is true for every backend but zk (`settle.ts:151-153`). At the measured gas a run
needs six `settleLevel` transactions of 5.1 to 11.6 million gas, 33 to 51 million in all
(`docs/VERIFICATION.md:919-928`): 0.00067 to 0.00102 ETH at 0.02 gwei, 13 to 20 times the fee. It
needs the pause lifted ("no reopening date announced", `README.md:589`) and M4.15's gas work.

**(d) The happy path carries no proof.** The one thing the browser does in milliseconds is replay.
For the browser to settle alone, the chain must accept the replay's result without redoing it:
the player posts the six Outcomes (which `replayRunFile` already computes), they become final after
a challenge window unless someone submits a proof of other Outcomes, and today's `ZkReferee` stays
as the judge of disputes. What must then be true:

- the owner accepts that a claim anyone can refute with a proof is not an oracle. README §7.3 says
  the opposite today: "then it is proven rather than disputed" (`README.md:611`), and §7.5: "An
  oracle's answer is believed; a proof is checked by the contract" (`README.md:673`). It is a
  specification decision, not a detail;
- at least one honest party replays every claim during the window. That costs 20 ms per level, the
  journals are public (P5), the operator's season job already replays every run for free, and every
  rival loses money to a false score;
- a wrong claim costs its author more than a proof costs the challenger: a bond above 0.0000345 ETH,
  or above the CPU-hours;
- the window and the grace cover the time to prove a dispute: 17 hours and a margin if the dispute
  is a whole-run proof, minutes if it is narrowed to one tick first;
- a rejected journal can be refuted. Today a journal that replay rejects has no proof at all, since
  the guest panics (`referee/zk/guest/src/bin/verify.rs:17-18`); the test-only guest already
  commits the error code (`referee/zk/guest/src/bin/trace.rs:22-26`);
- new `Challenge` and `Season` contracts, so a new generation, with their tests and invariants
  (`docs/DEPLOYMENT.md:191-195`), and README §7 amended.

Under (d) the operator's work changes from one proof per best run to one replay per claim, and a
proof only when someone lies.

## 8. What the web app already has for a lighter scheme

| Piece | Where | Use |
|---|---|---|
| Replay of any level and journal to its Outcome and the state hash of every tick, in a 28,250-byte wasm | `web/wasm/src/lib.rs:728-758`; `web/src/core.ts:278-291` | the claim, and the check of someone else's claim |
| The 948-byte state preimage at any tick of a replay | `replay_preimage`, `web/wasm/src/lib.rs:777-805`; used by `web/test/vectors.mjs` only, not declared in `web/src/core.ts:19-68` | the two states around a disputed tick |
| The first tick at which two traces differ | `firstMismatch`, `web/src/pages/replay.ts:108-119` | the search for the disputed tick; the viewer seeks to it |
| Any committed run rebuilt from chain data, with a public RPC and no wallet, checked against the commitment | `committedRun`, `web/src/chain/calldata.ts:66-135` | watching other players' claims |
| A player's runs ranked in D10's order, on time by the contract's formula | `bestRun`, `web/src/pages/settle.ts:43-70`; `web/src/run/deadline.ts` | what to claim |
| A settlement path from the browser: gas estimate, `settleRun` or six `settleLevel`, retries, decoded reverts, progress | `settleOnchain`, `web/src/pages/settle.ts:88-148` | sending the claim; only the proof argument is fixed to `"0x"` |
| The run store and the run file | `web/src/run/store.ts`; `web/src/run/runfile.ts` | keeping the journals for the claim |
| An end-to-end run that settles two players' best runs through `settle.ts` on a local chain | `web/scripts/challenge-e2e.mjs:372-409` | a test bed for a browser settlement |

What is missing for a scheme that narrows a dispute to one tick:

- the core cannot start from a preimage. `preimage` only serializes (`core/src/hash.rs:14`), and
  `Game::new` is the only constructor (`core/src/game.rs:53`). The preimage leaves out what is
  constant in a level: the target and the time limit (`core/src/game.rs:43-44`), the minions' spawn
  cells and respawn delay (`core/src/minion.rs:26, 41`) and the deflection key
  (`core/src/boss.rs:20`; `README.md:471`). They come from the level bytes and the level seed. A
  one-tick step needs a new entry point of the same core: (level, run nonce, level index, preimage,
  mask) to the next preimage;
- no trace is committed anywhere. `commitRun` stores one hash of the six journal hashes
  (`contracts/src/Challenge.sol:137-141`); the proving guest commits Outcomes only
  (`referee/zk/guest/src/bin/verify.rs:12-22`);
- one tick is small. In this review's wasm timing the heaviest tick of a gate-set level, a capture,
  takes 39 to 83 microseconds against a mean of 0.2 to 1.1, that is 1.5 to 10% of the level's play.
  In the guest, a level's setup alone is about 1.1 million user cycles (`commit-at-tick-0`,
  `docs/VERIFICATION.md:496`), so a one-tick proof is of the order of one or two segments, minutes
  natively, where a run is 67 to 131. Not measured in the zkVM: the host was not built here.

A saving inside the current design, whatever the prover: on zk, `ZkReferee` only hashes the levels
and journals it is given, to compare them with the proof's public values
(`contracts/src/ZkReferee.sol:78-94`). `settleRun` still carries all of them: 25,636 bytes and
353,908 of the 576,603 gas in M4.7's measurement (`docs/VERIFICATION.md:815`), 44% of a verified
run's 804,194 gas. `settleLevel` already takes the six journal hashes instead
(`contracts/src/Challenge.sol:176-190`).

## 9. What the design gets right

1. The journals are in the commit's calldata and bound by the stored commitment, so anyone rebuilds
   and replays any run for free (`README.md:539`; `web/src/chain/calldata.ts:76-77`).
2. One core: the player sees right after the commit the Outcomes the referee will compute
   (`web/src/pages/challenge.ts:251-269`), and this review's wasm replay of testnet-0 run 1 gives the
   settled score and ticks.
3. Settlement is safe in anyone's hands: the credit goes to the run's player, a worse run never
   replaces a better one, a rejection reverts and can be sent again
   (`contracts/src/Challenge.sol:145-171`; `contracts/src/Season.sol:287-295`).
4. No key can pay out: `ZkReferee` pins the image id and a fixed verifier, never the upgradeable
   router (`contracts/src/ZkReferee.sol:15-20, 69-75`; `docs/ECONOMY.md:83`).
5. Verify by exception behind one interface: only runs that money depends on are verified, and the
   page already settles proof-less backends by itself (`README.md:607-608`;
   `web/src/pages/settle.ts:150-153`).
6. Also worth keeping: players do nothing after the commit (`README.md:671`); close is
   permissionless and shares never expire (`README.md:754-755`); the run flow to the commit survives
   reloads and refuses a season the page cannot settle in (`web/src/run/flow.ts:76-83`;
   `web/src/run/season.ts:13-25`); every cost is measured and recorded.

## 10. Findings

| # | Severity | Finding |
|---|---|---|
| ux-1 | high | On zk a player cannot settle their own run in practice, so one operator decides who is paid; the cutoff makes a delay final |
| ux-2 | high | Proving throughput is 2 to 5 runs per machine per 48 h grace; 100 best runs need 19 to 36 machines |
| ux-3 | high | No full-length run has ever been proven or settled; the hours are estimates and the prover market was never called |
| ux-4 | medium | A verified run costs more than the rake it brings in, and a wallet per run is the paying strategy |
| ux-5 | medium | Scores are invisible until the operator settles, although the browser replays a level in 20 ms |
| ux-6 | medium | The season page, which is in the production build, tells players to send the operator a run file, with no way to do it, and the operator's tool is not built |
| ux-7 | medium | The proving setup is heavy, all-or-nothing and cannot run on CI |
| ux-8 | medium | Settlement also depends on RISC Zero's emergency stop and, on the hosted route, on a two-prover market on Base |
| ux-9 | low | Close, claim and settle buttons depend on a full log scan in the browser |

Details are in sections 2 to 6; the structured result carries the evidence lines.

## 11. Measurements made in this review

Both scripts are in this directory, read the repository only, and load the wasm that was already
built at `target/wasm32-unknown-unknown/release/jiro_wasm.wasm` (28,250 bytes, rules version 2).
Node 22.23.4, 4 vCPUs, Intel Xeon at 2.10 GHz.

- `replay-timing.mjs the repository root`: the `replay` export, warmed once, 15 runs per vector,
  median. Per level over the 32 vectors of `vectors/levels/`: minimum 10.0 ms, median 19.6 ms,
  maximum 44.2 ms (one noisy vector; its fastest run was 19.6 ms). All 32 together: 613 ms for 71,490
  ticks, 8.6 microseconds per tick with its hash. The six slowest: 185 ms. testnet-0 run 1: 3.4 ms,
  score 20,310, 338 ticks, 723 journal bytes.
- `tick-timing.mjs the repository root`: each journal played tick by tick through `load_level`,
  `start` and `tick`, seven passes, each tick's fastest time. Per level: 0.44 to 2.99 ms in all;
  mean tick 0.16 to 1.13 microseconds; heaviest tick 38.9 to 83.3 microseconds, 1.47 to 9.72% of the
  level.
- `scaling.mjs`: the arithmetic of section 6.

## 12. Not verified

- Nothing was read from a chain or a web page: the live state of testnet-0, whether anyone but the
  bot committed a run in it, and whether the public RPC rate-limits the season page's log scan.
- The zk host was not built and Docker was not run, as instructed. The proving times are the
  documents'.
- The wasm timings are Node's, not a browser's on a player's laptop or phone.
- The price of cloud CPUs, GPU proving and the capacity of Boundless's provers are not in the
  repository; no figure for them is asserted here.
