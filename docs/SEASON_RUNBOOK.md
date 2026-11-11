# Season runbook

How a testnet season runs on Arbitrum Sepolia, from its open to its claims, and how the commit slack and settlement grace of [`seasons/testnet-1.json`](../seasons/testnet-1.json) were derived (plan M5.5, M5.6). The season file owns the parameters; this page owns none. The testers' side is in [`TESTNET.md`](TESTNET.md).

## 1. Schedule

T0 is the block timestamp of the season's `open`. `node scripts/contracts/season.mjs status --network arbitrum-sepolia --season testnet-1` prints the exact dates: the start, the end (`Season.endOf`) and the end of settlement (`Season.settlementEndOf`).

| When | What happens | Who, and how |
|---|---|---|
| Before T0 | The parameters are approved (owner, 2026-11-11). M5.9 has proven a whole run on a rented GPU and checked the grace against its time (§5). The tester key holds at least 0.005 ETH (§6) | owner |
| T0 | `season.mjs open --network arbitrum-sepolia --season seasons/testnet-1.json` checks the season file and the 16 levels, opens the season, and writes its number into `deployments/arbitrum-sepolia.json` and its referee into the season file. A PR commits both and merges the same day: from then on, `season-ops.yml` plays the bot run (§6) | operator, with `DEPLOYER_KEY` |
| T0 to T0 + 14 days | Testers buy, play and commit runs. Every day at 07:17 UTC, `season-ops.yml` checks the status and solvency and plays one bot run from `TESTER_KEY` | testers; `season-ops.yml` |
| T0 + 7 days | Mid-season status, M5.6's checkpoint. The operator settles the best runs so far, in one session on a rented GPU (§3) | operator |
| T0 + 14 days, the end | No run can be bought. A run bought before the end can still reveal within 296 blocks of its purchase, 40 to its entropy block then 256 to read its hash, and commit within 1,080 s + `commitSlack` of its reveal | none |
| T0 + 14 to T0 + 16 days | The operator settles every player's best run in one session on a rented GPU, until the dry run lists none (§3). Settlement ends at end + grace, inclusive | operator |
| After T0 + 16 days | The next daily `season-ops.yml` run closes the season and withdraws the rake to the treasury; anyone may do both earlier. Qualified players claim on the season page, or with `season.mjs claim` | `season-ops.yml`; players |

## 2. Freeze rule

From a season's open until its close, no PR that changes `core/` or `levels/` merges. The season's runs settle through the referee it opened with, whose program pins the core, and the operator replays the runs with the core of its checkout. A change that moves no vector could otherwise slip a rule change into an open season, or make the operator's replay disagree with the referee. A change that cannot wait opens a new season after the close: a new rules version or backend is a new season (README §8.4).

## 3. Settlement

On zk, the operator settles each player's best run from chain data, and players do nothing after committing (README §7.5). A player may still prove and settle their own run from the season page's run file, until end + grace.

```bash
node web/scripts/settle.mjs --network arbitrum-sepolia --season testnet-1 --dry-run   # lists the runs, sends nothing
node web/scripts/settle.mjs --network arbitrum-sepolia --season testnet-1 --export    # writes their run files
bash referee/zk/prove-runs.sh seasons/testnet-1/runs seasons/testnet-1.json           # on the rented GPU
DEPLOYER_KEY=… node web/scripts/settle.mjs --network arbitrum-sepolia --season testnet-1
```

- **What it does.** It rebuilds every committed run of the season from its commit transaction, replays it with the core and the season's weights, and keeps each player's best on-time run in D10's order (qualification, then score, then fewer ticks) that `Season` does not already hold or beat. It settles each with one `settleRun` and its proof, signed by the operator's key, `DEPLOYER_KEY` (`DEPLOYMENT.md`): anyone may settle, and the credit goes to the run's player (README §7.2). The operator's key never shares a nonce with the tester key, which `season-ops.yml` signs with. Before each run, it checks that settlement is still open and that the run is still unsettled and above the best run `Season` holds, since a proof on the CPU fallback takes hours.
- **Failures.** A run that never settles is reported with the reason: the core rejects its journals, as the referee would, or `Challenge` refuses their Outcomes, such as a journal of another mode or another run's nonce. The player's best run that settles is chosen instead. A run that cannot be read, proven or settled is reported, the others still settle, and the command exits 1. Each run file and its proof stay under `seasons/testnet-1/runs/`, so a settlement cut short resumes without proving again.
- **The route.** The operator proves on an NVIDIA GPU rented by the hour, with a CPU as the fallback (owner, 2026-11-11: round G2's "GPU first, 48 h grace", then "we will rent GPU online a priori as a starter"). No prover network is left: Boundless, which M4.8 priced at about 0.0000184 ETH per proof, stopped taking proof requests on 2026-11-05 ([Boundless Foundation](https://boundlessfdn.org/blog/zkc-introducing-tokenized-ai-inference/)), and RISC Zero's hosted prover, Bonsai, closed in December 2025 ([`VERIFICATION.md`](VERIFICATION.md)).
- **The rented GPU.** x86-64 Linux, an NVIDIA card with at least 16 GB and the CUDA toolkit: a RunPod community RTX 4090 pod, about 0.34 USD an hour (the owner's verification review, 2026-11-10). It holds no key, since a proof is public data: `settle.mjs --export` writes the run files to prove, `referee/zk/prove-runs.sh` proves them there with zk-host's `cuda` build (M5.9), and `settle.mjs` settles with the proofs from the operator's machine, with no `zk-host` there. [`referee/zk/README.md`](../referee/zk/README.md#proving-on-a-gpu) gives the steps and an image that has the tools. Each session builds zk-host again at the fixed path, in the set-up and build time that M5.9 measures.
- **The CPU fallback.** x86-64 Linux with Docker, for the Groth16 step, 4 CPUs and 16 GB of memory: the proof peaks at 9.2 GiB in `zk-host`, then 7.0 GiB in Docker ([`DEPLOYMENT.md`](DEPLOYMENT.md#6-proving-the-bot-run)).
- **The prover** on either machine is `zk-host`, built at the fixed path of [Reproducible image ids](../referee/zk/README.md#reproducible-image-ids) after `bash scripts/bootstrap.sh zk`, with `--features cuda` on the GPU. Before it proves, `settle.mjs` checks that `zk-host image-id` equals the image id that the season's referee pins.
- **The operator's machine** reads the chain and settles: Node 22, `bash web/wasm/build-wasm.sh`, `npm --prefix web ci` and `npm --prefix scripts/contracts ci`.
- **When.** In one session at mid-season, and in one after the end, until the dry run lists no run, well before end + grace; more sessions if many players join. `season.mjs status --season testnet-1` then shows each player's best run settled.

## 4. Commit slack: 120 s

`commitSlack` covers what a run spends outside its ticks between the reveal and the commit: the level transitions, a reload, and the transaction latency (README §7.2, §8.4). The plan sets it at 2 × the worst observed overhead or more.

Two runs of the Challenge page on the local chain, headless as M5.7 runs it, with a wallet that signs at once and X pressed 5 s into each level:

| Run | revealedAt to committedAt | Ticks used | Play at 15 Hz | Overhead | Margin at commit |
|---|---:|---:|---:|---:|---:|
| Six levels, no reload | 46 s | 469 | 31.3 s | 14.7 s | 106 s |
| A reload in level 2 | 41 s | 424 | 28.3 s | 12.7 s | 108 s |

On Arbitrum Sepolia, M4.14 adds the transaction latency ([`DEPLOYMENT.md`](DEPLOYMENT.md#timing)): the full six-journal `commitRun` reached a block 0.5 s after its submission, and its receipt arrived 2.3 s after that. Between `revealedAt` and `committedAt`, a page waits for one receipt, the reveal's, before level 1, and for one inclusion, the commit's. The worst overhead is therefore about 14.7 + 2.3 + 0.5 = 17.5 s, and the plan's floor, twice that, is 35 s. 120 s, README §8.4's proposal, is 6.9 times the observed overhead and 3.4 times the floor. The 85 s above the floor cover what the headless run leaves out: the player confirming `commitRun` in their wallet, and a slower reload. So testnet-1 keeps 120 s.

## 5. Settlement grace: 48 h

The grace must let the operator prove and settle every player's best run after the end. It is README §8.4's proposal, kept because a rented GPU proves a run in minutes.

- **Proving time per run on the GPU:** not measured yet. Estimated at 2.2 to 2.8 min for a bot's whole run on an RTX 4090, from third-party logs (the owner's verification review, 2026-11-10). M5.9 measures it before testnet-1 opens.
- **Runs left at the end.** The operator settles at mid-season, so the queue at the end holds the best runs committed or improved since: at most one per player, the bot included.
- **The grace:** 48 h proves about 1,000 runs at 2.8 min each, 500 with a margin of 2: far more players than testnet-1 expects. One session after the end proves 30 runs in about 1.4 h, about 0.5 USD at 0.34 USD an hour, plus its set-up and build. M5.9 checks that 48 h still covers twice the measured time for one run per expected player; if it does not, the grace in `testnet-1.json` changes before the open, since nothing can change it after.
- **If no GPU can be rented at the end,** a CPU proves a whole run in 8.7 to 10.6 h for a bot's run and about 17 h for the heaviest run executed, the gate set's, of 131 segments ([`DEPLOYMENT.md`](DEPLOYMENT.md#6-proving-the-bot-run), [`VERIFICATION.md`](VERIFICATION.md#proving)): 2 to 5 runs in 48 h. Another provider's card is the first fallback, since the build is the same.
- **Cost:** the close, and so the claims, wait 2 days after the end.

## 6. Bot runs

From the day `deployments/arbitrum-sepolia.json` records the season's open, `season-ops.yml` plays one bot run a day from `TESTER_KEY`: `season.mjs bots --network arbitrum-sepolia --season testnet-1 --runs 1`. It pays, reveals, plays the six drawn levels with the playtest bots and commits; after the end it plays nothing, and the close's PR (M5.6) moves the workflow's `BOT_SEASON` on. The bot's address is a player like any other: its best run settles with the others, and its share of the pot returns to the tester key.

Each run costs the tester key the 0.00005 ETH fee plus about 430,000 gas for `startRun`, `revealRun` and a bot run's `commitRun`, and each `settleRun` costs the operator up to about 1,000,000 gas, verification included ([`DEPLOYMENT.md`](DEPLOYMENT.md#funding)). At Arbitrum Sepolia's 0.02 gwei, 14 bot runs come to about 0.0008 ETH, and 16 settlements to about 0.0003 ETH. On 2026-11-10 the tester key held 0.0299 ETH and the deployer 0.0699 ETH.
