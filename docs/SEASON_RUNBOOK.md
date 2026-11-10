# Season runbook

How a testnet season runs on Arbitrum Sepolia, from its open to its claims, and how the commit slack and settlement grace of [`seasons/testnet-1.json`](../seasons/testnet-1.json) were derived (plan M5.5, M5.6). The season file owns the parameters; this page owns none. The testers' side is in [`TESTNET.md`](TESTNET.md).

## 1. Schedule

T0 is the block timestamp of the season's `open`. `node scripts/contracts/season.mjs status --network arbitrum-sepolia --season testnet-1` prints the exact dates: the start, the end (`Season.endOf`) and the end of settlement (`Season.settlementEndOf`).

| When | What happens | Who, and how |
|---|---|---|
| Before T0 | The parameters are approved, and the tester key holds at least 0.005 ETH (§6) | owner |
| T0 | `season.mjs open --network arbitrum-sepolia --season seasons/testnet-1.json` checks the season file and the 16 levels, opens the season, and writes its number into `deployments/arbitrum-sepolia.json` and its referee into the season file. A PR commits both and merges the same day: from then on, `season-ops.yml` plays the bot run (§6) | operator, with `DEPLOYER_KEY` |
| T0 to T0 + 14 days | Testers buy, play and commit runs. Every day at 07:17 UTC, `season-ops.yml` checks the status and solvency and plays one bot run from `TESTER_KEY` | testers; `season-ops.yml` |
| T0 + 7 days | Mid-season status, M5.6's checkpoint. The operator settles the best runs so far (§3) | operator |
| T0 + 14 days, the end | No run can be bought. A run bought before the end still reveals, plays and commits, at most 256 blocks + 1,080 s + `commitSlack` later | none |
| T0 + 14 to T0 + 21 days | The operator settles every player's best run, until the dry run lists none (§3). Settlement ends at end + grace, inclusive | operator |
| After T0 + 21 days | The next daily `season-ops.yml` run closes the season and withdraws the rake to the treasury; anyone may do both earlier. Qualified players claim on the season page, or with `season.mjs claim` | `season-ops.yml`; players |

## 2. Freeze rule

From a season's open until its close, no PR that changes `core/` or `levels/` merges. The season's runs settle through the referee it opened with, whose program pins the core, and the operator replays the runs with the core of its checkout. A change that moves no vector could otherwise slip a rule change into an open season, or make the operator's replay disagree with the referee. A change that cannot wait opens a new season after the close: a new rules version or backend is a new season (README §8.4).

## 3. Settlement

On zk, the operator settles each player's best run from chain data, and players do nothing after committing (README §7.5). A player may still prove and settle their own run from the season page's run file, until end + grace.

```bash
node web/scripts/settle.mjs --network arbitrum-sepolia --season testnet-1 --dry-run   # lists the runs, sends nothing
TESTER_KEY=… node web/scripts/settle.mjs --network arbitrum-sepolia --season testnet-1
```

- **What it does.** It rebuilds every committed run of the season from its commit transaction, replays it with the core and the season's weights, and keeps each player's best on-time run in D10's order (qualification, then score, then fewer ticks) that `Season` does not already hold or beat. It proves each with `zk-host` and settles it with one `settleRun`, signed by the tester key: anyone may settle, and the credit goes to the run's player (README §7.2).
- **Failures.** A run the core rejects is reported: the referee would reject it too, so it never settles. A run that cannot be read, proven or settled is reported, the others still settle, and the command exits 1. Each run file and its proof stay under `seasons/testnet-1/runs/`, so a settlement cut short resumes without proving again.
- **The machine.** x86-64 Linux with Docker, for the Groth16 step, 4 CPUs and 16 GB of memory: the proof peaks at 9.2 GiB in `zk-host`, then 7.0 GiB in Docker ([`DEPLOYMENT.md`](DEPLOYMENT.md#6-proving-the-bot-run)). It needs `bash scripts/bootstrap.sh zk`, `cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host`, `bash web/wasm/build-wasm.sh` and `npm --prefix web ci`. Before it proves, the command checks that `zk-host image-id` equals the image id that the season's referee pins.
- **The route.** The operator proves on a CPU, on its own machine (owner, round G2: pending). The prover network the plan priced is gone: Boundless, at about 0.0000184 ETH per proof in M4.8, stopped taking proof requests on 2026-11-05 ([Boundless Foundation](https://boundlessfdn.org/blog/zkc-introducing-tokenized-ai-inference/)), and RISC Zero's hosted prover, Bonsai, closed in December 2025 ([`VERIFICATION.md`](VERIFICATION.md)). A GPU is estimated at minutes per proof from third-party figures, and is not measured on this guest yet.
- **When.** During the season, on any day, to shorten the queue at the end; on a CPU, one machine settles one or two runs a day (§5). From the end, back to back, until the dry run lists no run, well before end + grace. `season.mjs status --season testnet-1` then shows each player's best run settled.

## 4. Commit slack: 120 s

`commitSlack` covers what a run spends outside its ticks between the reveal and the commit: the level transitions, a reload, and the transaction latency (README §7.2, §8.4). The plan sets it at 2 × the worst observed overhead or more.

Two runs of the Challenge page on the local chain, headless as M5.7 runs it, with a wallet that signs at once and X pressed 5 s into each level:

| Run | revealedAt to committedAt | Ticks used | Play at 15 Hz | Overhead | Margin at commit |
|---|---:|---:|---:|---:|---:|
| Six levels, no reload | 46 s | 469 | 31.3 s | 14.7 s | 106 s |
| A reload in level 2 | 41 s | 424 | 28.3 s | 12.7 s | 108 s |

On Arbitrum Sepolia, M4.14 adds the transaction latency ([`DEPLOYMENT.md`](DEPLOYMENT.md#timing)): the full six-journal `commitRun` reached a block 0.5 s after its submission, and its receipt arrived 2.3 s after that. Between `revealedAt` and `committedAt`, a page waits for one receipt, the reveal's, before level 1, and for one inclusion, the commit's. The worst overhead is therefore about 14.7 + 2.3 + 0.5 = 17.5 s, and 2 × 17.5 = 35 s. 120 s, README §8.4's proposal, is 3.4 times the observed overhead. The 85 s above 35 s cover what the headless run leaves out: the player confirming `commitRun` in their wallet, and a slower reload. So testnet-1 keeps 120 s.

## 5. Settlement grace: 7 days

The grace must let the operator prove and settle every player's best run after the end. On a CPU that is the binding constraint, since one proof takes hours.

- **Proving time per run,** on 4 CPUs: a 2^20-cycle segment takes about 467 s with its recursion, plus 170 s of Groth16 ([`DEPLOYMENT.md`](DEPLOYMENT.md#6-proving-the-bot-run)). The bots' whole runs take 67 to 81 segments, 8.7 to 10.6 h. The heaviest six-level run executed, the gate set's, takes 131 segments: about 17 h at that rate ([`VERIFICATION.md`](VERIFICATION.md#proving)). M4.14's proof of record took 75 min for 13 segments.
- **Runs left at the end.** The operator settles during the season, so the queue at the end holds the best runs committed or improved on the last days. At worst, every player's best run arrives on the last day: N runs, one per player, the bot included.
- **The grace:** at least N × 17 h on one machine. 7 days, 168 h, covers 9 players at the heaviest proving time, or 15 at a bot run's, with the season's own 14 days to settle earlier bests. For more players, a second machine proves in parallel, or the grace of the next season grows; README §8.4 allows up to 30 days.
- **On a GPU,** at the estimated minutes per run, 7 days would cover several hundred runs: the grace only bounds how late a proof may come, so a faster route needs no change.
- **Cost of a long grace:** the close, and so the claims, wait 7 days after the end. On testnet, that is the price of proving on a CPU.

## 6. Bot runs

From the day `deployments/arbitrum-sepolia.json` records the season's open to its end, `season-ops.yml` plays one bot run a day from `TESTER_KEY`: `season.mjs bots --network arbitrum-sepolia --season testnet-1 --runs 1`. It pays, reveals, plays the six drawn levels with the playtest bots and commits; it stops at the end. The bot's address is a player like any other: its best run settles with the others, and its share of the pot returns to the tester key.

Each run costs the 0.00005 ETH fee plus about 430,000 gas for `startRun`, `revealRun` and a bot run's `commitRun`, and each `settleRun` the operator sends up to about 1,000,000 gas, verification included ([`DEPLOYMENT.md`](DEPLOYMENT.md#funding)). At Arbitrum Sepolia's 0.02 gwei, 14 bot runs and 16 settlements come to about 0.0012 ETH. The tester key held 0.0299 ETH on 2026-11-10.
