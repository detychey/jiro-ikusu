# Deployment

The Arbitrum Sepolia deployment of plan M4.14 and its first settled run: the runbook of the round F2 session, what it records, how a redeploy works, and the fork rehearsal that tested the runbook first. The backend is zk (D2): `ZkReferee` over RISC Zero's emergency stop for its 3.0 Groth16 verifier, `0x724d375B5b622e15f0E64e9Deb76a4cB17877797`, pinned in `scripts/contracts/deploy.mjs` by chain id (`docs/ECONOMY.md`, zk prover trust).

**Status: deployed on 2026-11-09; a run settled.** Round F2 ran §2 end to end on Arbitrum Sepolia. It deployed generation 1 from `ca76f8f` and opened `testnet-0` as season 1. All four sources verified on Sourcify. Run 1, a bot run proven with a real Groth16 proof, settled with 1 clear; run 2 committed six full journals; `isSolvent()` is true ([§3](#3-results)). The whole flow first passed on a fork of Arbitrum Sepolia ([§5](#5-fork-rehearsal)).

## 1. Prerequisites

### Keys

Round F2 creates two testnet-only keys and sets them as cloud-environment variables, which reach only sessions started afterwards (plan §1.3):

| Variable | Account | Role |
|---|---|---|
| `DEPLOYER_KEY` | the deployer | deploys every contract; `Season`'s operator, the only address that may `open` a season (README §8.4); `Season`'s treasury on testnet (plan M4.14 step 4); and the settler, which proves and settles runs (README §7.5) |
| `TESTER_KEY` | the tester, a separate account | the player of the bot runs: `startRun`, `revealRun`, `commitRun`; later its claim, and the permissionless close and rake withdrawal of `season.mjs` and `season-ops.yml` (plan M5.8) |

- **Never printed.** The scripts read both from the environment, check their shape (64 hex digits, with or without `0x`) without quoting them, and delete them from the environment before running any child process; the preflight prints addresses only. Never pass a key on a command line: argv is visible in `ps`.
- **Separate.** The preflight fails if the two are the same account.
- **Privileged.** The deployer stays the operator of this `Season` for good, and its treasury is immutable: keep the key for M5.5 and M5.6, which settle runs and open the next season.

### Funding

Measured on the fork ([§5](#5-fork-rehearsal)), priced at Arbitrum Sepolia's base fee of 0.02 gwei (`cast base-fee`, block 325,487,918, 2026-11-03). Sepolia's `ArbGasInfo.getPricesInWei()` prices L1 calldata at 0 wei per byte today, and `NodeInterface.gasEstimateL1Component` returns 0 L1 gas for the full six-journal commit's 49,604 calldata bytes, so the L2 gas is the whole cost:

| Account | What it pays | Gas | ETH at 0.02 gwei | Fund with |
|---|---|---:|---:|---:|
| deployer | the four deployments, `bindChallenge` and `Season.open` (5,937,947 gas on the fork), one `settleRun` of a bot run (530,143 on the fork for the fixture run; a whole bot run's longer journals add calldata, up to about 1,000,000) | about 7.0 million | 0.00014 | **0.01 ETH** |
| tester | up to 4 runs: up to 3 happy-path runs until one clears (step 7) and the full commit (step 8), each 0.00005 ETH of fee; per run about 230,000 gas for `startRun` and `revealRun`, a bot run's `commitRun` up to about 200,000, and the full commit's 1,940,060 | about 3.5 million | 0.00007 gas + 0.0002 fees | **0.01 ETH** |

0.01 ETH each is about 70 times the deployer's cost and 37 times the tester's at today's price: it covers a base fee up to about 1.4 gwei, a second generation (§4), M5.8's testnet-0 rehearsal, and the bot runs `season-ops.yml` makes from `TESTER_KEY` later. Fund both from an Arbitrum Sepolia faucet, or bridge Sepolia ETH through Arbitrum's bridge. The preflight fails on an empty account; check the balances it prints against this table.

### Tools

The F2 session runs everything from the repository at the fixed path `/home/runner/work/jiro-ikusu/jiro-ikusu`, so that the verify program's image id, which `ZkReferee` pins at deployment and every proof must match, is the reproducible one ([`referee/zk/README.md`](../referee/zk/README.md#reproducible-image-ids)):

```bash
mkdir -p /home/runner/work/jiro-ikusu/jiro-ikusu
mount --bind "$PWD" /home/runner/work/jiro-ikusu/jiro-ikusu
cd /home/runner/work/jiro-ikusu/jiro-ikusu
bash scripts/bootstrap.sh contracts && bash scripts/bootstrap.sh zk
git submodule update --init
npm --prefix scripts/contracts ci
cargo build --release --locked -p jiro-tools
cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host
referee/zk/target/release/zk-host image-id
```

- `zk-host image-id` printed `0xa3013dc48ccd9e8e28c6625a8362a1fde513e1c51ae1e50286445c0eae3702b1` for M4.8's and M4.10's guests. Another value means the verify program changed since; that is fine, since the deployment pins whatever the build prints, but the fixture proofs then no longer verify under the deployed `ZkReferee`.
- Proving wraps the proof into Groth16 in Docker: start `dockerd` as [`docs/TOOLING.md`](TOOLING.md#docker-started-by-hand) shows. The image `risczero/risc0-groth16-prover:v2025-04-03.1` (5.2 GB) comes through the registry mirror.
- Optional, one minute, no key: `node scripts/contracts/fork-rehearsal.mjs` repeats §5 on a fresh fork.

## 2. Steps

The plan's nine steps, as seven, each one or two commands, run in order in one session; steps 7 and 8 may overlap, as said there. Every transaction prints `label: gas N, tx 0x…`; the end-to-end steps print the gas table and the measurements between `=== BEGIN e2e-gas ===` and `=== END e2e-measurements ===`. Keep the session's whole log: §3 is filled from it.

1. **Preflight** (plan step 1). It sends nothing.

   ```bash
   node scripts/contracts/preflight.mjs --network arbitrum-sepolia --backend zk
   ```

   It must end with `ready: yes`: chain 421614; the zk backend (the mock backend fails here); both accounts funded and different; the Stylus rows skipped; and the `RISC Zero verifier` row, which reads the pinned emergency stop: code present, not paused, over the 3.0 Groth16 verifier `0x2a098988600d87650Fb061FfAff08B97149Fa84D` with selector `0x73c457ba`. Copy the deployer's address from the `accounts` row: it is the treasury of step 2.

2. **Deploy** (plan steps 2, 3 and 5) `ArbBlockhashEntropy` over ArbSys `0x64`, `ZkReferee` over the emergency stop, `Season` with the deployer as operator and treasury, then `Challenge`, bound to `Season` (`Challenge` comes before the season opens, which changes nothing, since `open` does not read it):

   ```bash
   node scripts/contracts/deploy.mjs --network arbitrum-sepolia --backend zk --treasury <deployer address> \
     --rules-version "$(jq .rulesVersion seasons/testnet-0.json)" --image-id "$(referee/zk/target/release/zk-host image-id)"
   ```

   It writes `deployments/arbitrum-sepolia.json`, a record of one generation (`deployments/README.md`). `deploy.mjs` refuses the mock backend on Arbitrum Sepolia, and its zk branch deploys no mock verifier there.

3. **Open `testnet-0`** (plan step 4):

   ```bash
   node scripts/contracts/season.mjs open --network arbitrum-sepolia --season seasons/testnet-0.json
   ```

   It checks the season file against `seasons/calibration-1.json`, validates the 16 levels with the level tool (`jiro-tools level validate` and `level id` on `levels/*.bin`), opens the season, then writes the season number `open` assigned into `deployments/arbitrum-sepolia.json` under `seasons.testnet-0`, and the deployed `ZkReferee` into `seasons/testnet-0.json`'s `referee`, null until then. The season accepts runs for 1 day from here, and settles until 24 h after that: steps 7 and 8 run within the day.

4. **Verify the sources on Sourcify** (plan step 6). No key:

   ```bash
   bash scripts/contracts/sourcify.sh
   ```

   It runs `forge verify-contract --verifier sourcify --guess-constructor-args` for the four contracts of the newest generation, from `contracts/` as of its `sourceCommit`, and prints each Sourcify link. No Stylus referee is deployed, so plan M4.14's `cargo stylus verify` step does not apply.

5. **The happy path** (plan step 7): a bot run, committed, proven for real and settled.

   ```bash
   nohup node scripts/contracts/e2e.mjs --network arbitrum-sepolia --cases happy-path --short > happy-path.log 2>&1 &
   ```

   - The tester pays, waits for its entropy block (40 Arbitrum blocks) and reveals; the bots play the six drawn levels (`jiro-tools playtest`, the policies of `levels/targets.json`'s mix, the first that clears each level); the tester commits; the run file is written to `seasons/testnet-0/runs/run-<id>.json`. A run that clears no level is followed by another, up to 3, so that M5.5 can rehearse a claim.
   - `--short` keeps the first level the bots clear whole and closes the other five at tick 30, as a client closes a level early (README §7.2), so the proof takes about 2 to 3 hours instead of 9 to 11 ([§6](#6-proving-the-bot-run)). Without `--short`, the plan's own command, the whole bot run is proven.
   - It checks that `zk-host image-id` equals the deployed `ZkReferee`'s `imageId()`, then runs `zk-host prove --run <run file> --season seasons/testnet-0.json`, and keeps the proof as `run-<id>.proof.json`. The deployer then calls `settleRun`, and the script checks `RunSettled` against the native replay and estimates `ZkReferee`'s verification gas for this run proof and for M4.8's level proof.
   - If the session or the proof stops, resume without buying another run: `node scripts/contracts/e2e.mjs --network arbitrum-sepolia --cases happy-path --resume seasons/testnet-0/runs/run-<id>.json`. A proof file already there is reused.

6. **The largest commit** (plan step 8): a second run, committed with six copies of `vectors/game/full-journal`'s 8,171-byte journal, timed, never settled.

   ```bash
   node scripts/contracts/e2e.mjs --network arbitrum-sepolia --cases full-commit
   ```

   It may run while step 5 proves, once `happy-path.log` shows `committed, its run file`: the tester sends nothing more in step 5.

7. **Solvency and the record** (plan step 9):

   ```bash
   cast call "$(jq -r '.generations[0].Season' deployments/arbitrum-sepolia.json)" 'isSolvent()(bool)' --rpc-url https://sepolia-rollup.arbitrum.io/rpc
   node scripts/contracts/preflight.mjs --network arbitrum-sepolia --check-solvent
   ```

   Both must say true (the second, `solvency PASS` and `ready: yes`). Then fill §3 from the logs, and commit `deployments/arbitrum-sepolia.json`, `seasons/testnet-0.json` with its referee, `seasons/testnet-0/runs/`, and this file.

## 3. Results

Round F2 ran §2 on 2026-11-09, its transactions from 12:14 to 13:32 UTC, from the repository at `/home/runner/work/jiro-ikusu/jiro-ikusu`, at this PR's `ca76f8f` (forge 1.8.6, Node 22.23.4, ethers 6.17.0). Arbiscan is `https://sepolia.arbiscan.io/address/<address>` and `https://sepolia.arbiscan.io/tx/<hash>`. Every transaction succeeded, and every receipt reports `gasUsedForL1` 0: Arbitrum Sepolia still prices L1 calldata at 0 (§1). Gas was priced at 0.0200 to 0.0202 gwei (20,000,000 to 20,188,000 wei). Block numbers and times below are read from the transactions' receipts. The deployer spent 0.000130 ETH and the tester 0.000127 ETH, of which 0.0001 ETH was the two run fees.

### Generation

From `deployments/arbitrum-sepolia.json`: `deployedAt` 2026-11-09T12:14:37.563Z, `sourceCommit` `ca76f8f58c3b0bbecf82ac5a13b93726f341d6d4`, backend zk, operator and treasury the deployer [`0xEfEA…d1B3`](https://sepolia.arbiscan.io/address/0xEfEA68dbE0740982789735D007B14D0D8358d1B3).

| Contract | Address | Sourcify |
|---|---|---|
| ArbBlockhashEntropy, over ArbSys `0x64` | [`0xB350552550ff09474692CA688e89873DF336C470`](https://sepolia.arbiscan.io/address/0xB350552550ff09474692CA688e89873DF336C470) | [exact match](https://repo.sourcify.dev/421614/0xB350552550ff09474692CA688e89873DF336C470) |
| ZkReferee, over the emergency stop `0x724d…7797` | [`0x1097BDED737146D4A83Cf969a357e504FA028c5a`](https://sepolia.arbiscan.io/address/0x1097BDED737146D4A83Cf969a357e504FA028c5a) | [exact match](https://repo.sourcify.dev/421614/0x1097BDED737146D4A83Cf969a357e504FA028c5a) |
| Season | [`0x0e9BcC5A9DBD9CAD05C531fC12E925164cfaDf6d`](https://sepolia.arbiscan.io/address/0x0e9BcC5A9DBD9CAD05C531fC12E925164cfaDf6d) | [exact match](https://repo.sourcify.dev/421614/0x0e9BcC5A9DBD9CAD05C531fC12E925164cfaDf6d) |
| Challenge | [`0x585b38c5dEfb601E52613F5FB80F9e3289fF4fAB`](https://sepolia.arbiscan.io/address/0x585b38c5dEfb601E52613F5FB80F9e3289fF4fAB) | [exact match](https://repo.sourcify.dev/421614/0x585b38c5dEfb601E52613F5FB80F9e3289fF4fAB) |

- **Image id:** `ZkReferee.imageId()` reads `0xa3013dc48ccd9e8e28c6625a8362a1fde513e1c51ae1e50286445c0eae3702b1`, which `zk-host image-id` printed in the session, the value of M4.8's and M4.10's guests. The happy path checked it again before proving.
- **`testnet-0`** is season 1 of `Season`, opened at block 327,552,759, 12:14:45 UTC. It accepts runs until 2026-11-10 12:14:45 UTC and settles until 24 h later. `seasons/testnet-0.json`'s `referee` is the ZkReferee above.
- **Preflight** (step 1): `ready: yes`, the `RISC Zero verifier` row passing: the stop is not paused, over `0x2a09…a84D`, selector `0x73c457ba`. The optional fork rehearsal, run before step 2, passed. Every transaction matched §5's gas except `ArbBlockhashEntropy`'s deployment, 496,217 against §5's 496,229.

### Gas per transaction

| §2 step | Transaction | Calldata bytes | Gas | Of which L1 | Fork (§5) |
|---|---|---:|---:|---:|---:|
| 2 | [deploy `ArbBlockhashEntropy`](https://sepolia.arbiscan.io/tx/0x276603e4db0d53ac17522dde9234b1719c82911d1e7d1b752d8fef90e390b912) | | 496,001 | 0 | 496,229 |
| 2 | [deploy `ZkReferee`](https://sepolia.arbiscan.io/tx/0x03ce2a20fdc4bff6e13dc1359b17312394648243b061c9c9d80ace68ffd34be6) | | 762,710 | 0 | 762,710 |
| 2 | [deploy `Season`](https://sepolia.arbiscan.io/tx/0x5701da211287ae1754f7d79bdd9d4f8a19cf558966ff6109cbf28bcef9e97a41) | | 1,736,804 | 0 | 1,736,804 |
| 2 | [deploy `Challenge`](https://sepolia.arbiscan.io/tx/0x58e0b6b47e6462bc7363955590a96b0b01f602e167543e1ee54767e15c2573b5) | | 1,971,257 | 0 | 1,971,257 |
| 2 | [`Season.bindChallenge`](https://sepolia.arbiscan.io/tx/0xd31c7388ea63b4c56ac7f773620f309a20033b86802eab70629a5a21be761915) | | 45,310 | 0 | 45,310 |
| 3 | [`Season.open`, testnet-0](https://sepolia.arbiscan.io/tx/0xbc24eedf5bafd52ba3130d5d8404630a40e8e1f26810ae1259c0a5b87421e933) | | 925,637 | 0 | 925,637 |
| 5 | [`Challenge.startRun`, run 1](https://sepolia.arbiscan.io/tx/0x916e1b4cb04c961601bb08dc74197563b428099bc738f6bbdc708e58fba350b9) | 36 | 162,179 | 0 | 166,176 |
| 5 | [`Challenge.revealRun`](https://sepolia.arbiscan.io/tx/0x2de173acac528c3b5e6c7890a0badb18feb5148daa437339bfb84429f1d93395) | 36 | 59,396 | 0 | 63,294 |
| 5 | [`Challenge.commitRun`, run 1's six journals (723 bytes)](https://sepolia.arbiscan.io/tx/0x666fe3c01e76964bae67764cc0109d59cee565289c91e0794ea31c9b32c76177) | 1,220 | 94,289 | 0 | 96,523, other journals |
| 5 | [`Challenge.settleRun`, run 1, through ZkReferee and the emergency stop](https://sepolia.arbiscan.io/tx/0x3d329fb05184dad4aba4564801334065bd740f365126224411d1989a01db3e6b) | 7,300 | 530,256 | 0 | 530,143, other run |
| 6 | [`Challenge.startRun`, run 2](https://sepolia.arbiscan.io/tx/0xeb23fd0db7bcd5f92c81a5b553c36e3f7cf2bbc553cf464435a69b3f89168a90) | 36 | 127,979 | 0 | 131,976 |
| 6 | [`Challenge.revealRun`](https://sepolia.arbiscan.io/tx/0xc0f172967b6356f3dbf85df4008bad90f4df62f2dac09b6622c820f00fadeb9f) | 36 | 59,396 | 0 | 63,294 |
| 6 | [`Challenge.commitRun`, six full journals (49,026 bytes)](https://sepolia.arbiscan.io/tx/0x2e3953b9a7e30874dc67c7a223574ce4ea7407e0d9769dd888abde7c35739108) | 49,604 | 864,001 | 0 | 1,940,060 |

- **The full commit cost 864,001 gas**, under half the fork's 1,940,060. That figure was the EIP-7623 calldata floor anvil applied; Arbitrum Sepolia charged less than that floor, so ArbOS does not apply it, and §1's funding table overstates the tester's cost. Both are far below the 32,000,000 cap.
- **`startRun` and `revealRun`** cost about 4,000 gas less than on the fork. There `ArbBlockhashEntropy` called MockArbSys, a contract, where here it calls the ArbSys precompile. `ArbBlockhashEntropy`'s deployment cost 496,001 gas: 216 less than in this session's rehearsal and 228 less than §5's. Its constructor argument, ArbSys's address, is `0x64` here, and its calldata has more zero bytes than the fork's MockArbSys address.

### Verify gas per level

`eth_estimateGas` against the deployed `ZkReferee`, the transaction's 21,000 and calldata included:

- **A run proof:** `verifyRun` of run 1's proof, 344,156 gas, which verifies its six levels at once: 57,359 gas per level.
- **A level proof:** `verify` of M4.8's level proof of `commit-at-tick-0`, 283,896 gas.

### Timing

- **Reveal timing:** run 1 revealed 13 s after its `startRun` block (block 327,553,309 at 12:17:19, revealed at 12:17:32), and run 2 12 s after its own. Both waited for the entropy block, 40 Arbitrum blocks on.
- **Inclusion latency of the full six-journal commit:** run 2's `commitRun` is in a block of timestamp 1794226690 (block 327,553,492), 0.5 s after its submission; its receipt arrived 2.3 s after that.
- **Margin at commit of the settled bot run:** 141 s. Its deadline 1794226795, `revealedAt` 1794226652 + ⌈338 / 15⌉ + 120, minus `committedAt` 1794226654. The bots play much faster than real time, so the margin is nearly the whole of the 23 s of play plus the 120 s slack. Run 2's margin to its latest commit was 1,197 s of the 1,080 + 120.

### The settled run

- **Run 1**, settled by [`settleRun`](https://sepolia.arbiscan.io/tx/0x3d329fb05184dad4aba4564801334065bd740f365126224411d1989a01db3e6b) at block 327,569,544, 13:32:09 UTC. Its `RunSettled`: score 20,310, 338 ticks, 1 clear, equal to the native replay. The happy path's first run cleared a level, so no second happy-path run was bought.
- **Run file and proof:** [`seasons/testnet-0/runs/run-1.json`](../seasons/testnet-0/runs/run-1.json), draw slots 1, 11, 4, 0, 2, 13. With `--short`, the bots' clear is kept whole and the other five levels close at tick 30. Its Groth16 proof is [`run-1.proof.json`](../seasons/testnet-0/runs/run-1.proof.json).
- **Proving:** the proof of record took about 74.5 min from commit to settlement, from the run file to the proof file (modified at 12:17:36 and 13:32:09). That covers the executor's check, the segment proofs, the recursion and the Groth16 wrapping, and is well under §6's estimate of 2 to 3 hours. `e2e.mjs` kept `zk-host prove`'s output to read the seal and did not print it, so the session's log lacks its figures; this PR now prints them. They come from a second, offline proof of the same run file with the same `zk-host`, from 13:33 to 14:48 UTC on the same 4 CPUs, which verified (`verified: yes`, selector `0x73c457ba`):
  - 13 segments of 2^20 cycles; 13,631,488 proving cycles, of which 12,592,566 user cycles and 430,022 paging cycles;
  - segment proofs 3,831.8 s, recursion to one succinct receipt 561.0 s, Groth16 wrapping 122.5 s: 4,515.3 s in all, 1 h 15 min, with a peak of 9.2 GiB resident in `zk-host`;
  - §6's formula, segments × 467 s + 170 s, gives 6,241 s for 13 segments. This proof's 295 s per segment and 43 s of recursion per segment were faster than M4.10's 410 s and 57 s.

### `isSolvent()`

`true` at block 327,569,660 (13:32:42 UTC), after the settlement; `preflight.mjs --check-solvent` printed `solvency PASS` and `ready: yes`.

### Deviations from §2

- **The keys** are set without the `0x` prefix that the scripts then checked for. The session ran every script with `DEPLOYER_KEY="0x${DEPLOYER_KEY#0x}"` (and the same for `TESTER_KEY`) in that command's environment, so neither key went on a command line. The scripts now accept a key with or without `0x`.
- **`e2e.mjs` recompiled the `zk-host` crate** for 1 min 28 s at the start of step 5, with the same `cargo build` as §1. The image id was unchanged, and `ZkReferee.imageId()` still matched.

## 4. Redeploy and generations

Modeled on ethblockdigger's [`DEPLOYMENT.md`](https://github.com/detychey/ethblockdigger/blob/main/docs/DEPLOYMENT.md) B5. The contracts are immutable: `entropy` and `seasons` in `Challenge`, `treasury` and `operator` in `Season`, the verifier, image id and rules version in `ZkReferee`, and `bindChallenge` runs once. No contract is swapped alone, and nothing is upgraded: a redeploy is a new generation of all four.

- **A new generation** is step 2 again: `deploy.mjs` writes it at the front of `deployments/arbitrum-sepolia.json`'s `generations`, newest first, and keeps every earlier generation as it was, so an earlier address is never overwritten and tester reports can be matched to the generation they ran on (`deployments/README.md`). Then steps 3 to 7 with the new season file. The web app reads `generations[0]`.
- **A new season on the same generation** needs no redeploy: `season.mjs open` with the next season file once the current season has ended (README §8.4). Its referee is still the generation's `ZkReferee`.
- **What forces a new generation:** a change to `contracts/src/` (a new ABI or behavior); a new verify program, whose image id `ZkReferee` pins, which follows any behavior change of the core (`RULES_VERSION`); a stopped emergency stop (RISC Zero's owner paused the 3.0 verifier: the preflight's `RISC Zero verifier` row fails, and the next generation pins the stop of the next verifier version, after the same checks); a lost or leaked deployer key, since it is `Season`'s operator.
- **The old generation keeps working** for its open seasons: runs settle through their own season's referee until its end plus grace, and close, claims and `withdrawRake` stay permissionless. A stopped emergency stop halts settlement and forges nothing: the season's pot rolls over.
- **Testnet only:** the deployer is the treasury. A mainnet generation needs a separate treasury, a separate operator policy and an audit (`docs/ECONOMY.md` §4).

## 5. Fork rehearsal

**Rehearsal numbers, not testnet results.** `node scripts/contracts/fork-rehearsal.mjs` on 2026-11-03, against anvil 1.8.6 forking Arbitrum Sepolia (`anvil --fork-url https://sepolia-rollup.arbitrum.io/rpc --chain-id 421614`), forge 1.8.6, solc 0.8.28, Node 22.22.0, ethers 6.17.0: at block 325,491,130 from this PR's scripts over `main` at `7023fee`, and again at block 325,493,637 from this PR's first commit `de57be5`, with the same gas for every transaction. It ran the steps of §2 through the same functions as the scripts, then stopped anvil; nothing was sent to Arbitrum Sepolia, and its records went to a temporary directory. It took about one minute.

### What it used

- **The real verifier.** `ZkReferee` was wired to the forked emergency stop `0x724d…7797`: its code is there (2,384 bytes), `paused()` is false, and `verifier()` is the 3.0 Groth16 verifier `0x2a09…a84D`, selector `0x73c457ba`, as the preflight's new row read. Every verification below ran RISC Zero's deployed contracts.
- **A real Groth16 proof.** M4.10's run proof (`challengeRun` in `contracts/test/fixtures/zk-proofs.json`, proving `zk-run.json`) settles only run 1 of a `Challenge` at `0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9` whose entropy block hash is MockArbSys's `keccak256(1040)`: its run nonce `0xaab42536…68a9` binds both. The rehearsal reproduced that state: the deployer was forge's test contract `0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496`, impersonated, at nonce 1, so that `deployContracts`' four creations put `Challenge` at that address with nonce 4; and `ArbBlockhashEntropy` read a MockArbSys starting at block 1,000. Run 1 then revealed the fixture's nonce, committed the fixture's journals, and settled with the real proof through the forked verifier. The run file the happy path wrote equals `zk-run.json` but for its chain id. So no fresh proof was needed.
- **Anvil's ArbSys.** Anvil 1.8.6 forking Arbitrum Sepolia serves its own ArbSys at `0x64`: `arbBlockNumber()` returns the block number, `arbBlockHash()` reverts with `PrecompileError`, and code set at `0x64` with `anvil_setCode` is shadowed by it. So MockArbSys could not be etched at `0x64`, and a reveal through anvil's ArbSys cannot work; the rehearsal deployed MockArbSys from anvil's account 0 and passed it to `deployContracts` as `arbSys`, which only the rehearsal does. The real deployment reads the real precompile at `0x64`. `e2e.mjs --network arbitrum-sepolia --cases full-commit` run against a fork stops at `revealRun` for that reason.
- **Stand-ins for the keys.** The tester was anvil's account 1, and the treasury the deployer, as step 2 says. The CLIs ran too, on a second fork with anvil's accounts 0 and 1 as `DEPLOYER_KEY` and `TESTER_KEY`: `preflight.mjs` (ready, and a `backend FAIL` with `--backend mock`), `deploy.mjs` (the mock backend refused; the zk backend deployed and wrote a record that matches the schema), `season.mjs open` (season 1, the record's `seasons.testnet-0` and the season file's referee written) and `preflight.mjs --check-solvent` (solvent). Their files were removed afterwards.

### Results

The preflight passed (`ready: yes`, the Stylus rows skipped, the `RISC Zero verifier` row passing), the level tool passed the 16 levels, `testnet-0` opened as season 1, run 1 settled with score 21,112, 567 ticks and 1 clear, as the native replay, run 2 committed six full journals, and the closing preflight's `solvency` row and `isSolvent()` were true.

| §2 step | Transaction | Calldata bytes | Gas |
|---|---|---:|---:|
| 2 | deploy `ArbBlockhashEntropy` | 2,309 | 496,229 |
| 2 | deploy `ZkReferee` | 3,640 | 762,710 |
| 2 | deploy `Season` | 8,095 | 1,736,804 |
| 2 | deploy `Challenge` | 9,248 | 1,971,257 |
| 2 | `Season.bindChallenge` | 36 | 45,310 |
| 3 | `Season.open`, testnet-0 | 1,284 | 925,637 |
| 5 | `Challenge.startRun`, run 1 | 36 | 166,176 |
| 5 | `Challenge.revealRun` | 36 | 63,294 |
| 5 | `Challenge.commitRun`, the fixture's six journals (879 bytes) | 1,444 | 96,523 |
| 5 | `Challenge.settleRun`, through `ZkReferee` and the forked emergency stop | 7,524 | 530,143 |
| 6 | `Challenge.startRun`, run 2 | 36 | 131,976 |
| 6 | `Challenge.revealRun` | 36 | 63,294 |
| 6 | `Challenge.commitRun`, six full journals (49,026 bytes) | 49,604 | 1,940,060 |

- **Not counted:** the rehearsal's own `MockArbSys.setBlockNumber` calls (26,506 gas each) and MockArbSys's deployment. Anvil reports no L1 gas, and its fee column priced gas at anvil's base fee, not Sepolia's, so the rehearsal's fees are not costs; §1 prices the gas at Sepolia's.
- **The full commit** costs exactly its EIP-7623 calldata floor, 1,940,060 gas: 21,000 plus 10 per token of its 49,604 calldata bytes. The floor, not the execution, sets its price, far below Arbitrum's 32,000,000 cap and within the sequencer's 95,000-byte limit.
- **`settleRun`** took 530,143 gas for the whole transaction. M4.10 put the same run at 598,811 with the Groth16 verifier called directly, adding the calldata's 51,828 and the base 21,000 to the 525,983 of a test's call frame (`docs/VERIFICATION.md`, Tests and gas); a test frame's accounting is not a transaction's, so the two do not compare closely.
- **Verification gas** (`eth_estimateGas`, the transaction's 21,000 and calldata included): `ZkReferee.verifyRun` of the run proof 340,011; `ZkReferee.verify` of M4.8's level proof of `commit-at-tick-0` 283,158.
- **The emergency stop's extra gas:** `verify` of the run proof's seal and digest takes 265,391 gas through the stop and 256,164 on the Groth16 verifier directly, 9,227 more (estimates with the transaction's base and calldata, both cold). M4.12 traced 5,785 for the stop's own frame in a warm test.
- **Timing:** meaningless on a fork, which seals a block per transaction: the reveal came 0 s after the `startRun` block, and the commits landed in the next second. The margin at commit of run 1 was 157 s in one run and 158 s in the other: its deadline, `revealedAt` + ⌈567 / 15⌉ + 120, minus `committedAt`; run 2's margin to its latest commit was 1,199 to 1,200 s, nearly the whole 1,080 + 120. The F2 session measures both on Sepolia.

## 6. Proving the bot run

Step 5's proof runs `zk-host prove --run <run file> --season seasons/testnet-0.json` in the session's container: the segment proofs and their recursion on the CPU, then the Groth16 wrapping in Docker, at about 410 s per 2^20-cycle segment, 57 s of recursion per segment and 170 s of Groth16 on 4 CPUs, with 9.2 GiB of host memory and 7.0 GiB in Docker at the peak (`docs/VERIFICATION.md`, The fixture set).

Executed (not proven) with `zk-host execute-run` on 2026-11-03, verify image id `0xa3013dc4…02b1`, three bot runs of the happy path's policies, at three arbitrary nonces:

| Run | Ticks used | Clears | Journal bytes | Proving cycles | Segments | Estimated proof on 4 CPUs |
|---|---:|---:|---:|---:|---:|---:|
| 1, whole | 3,181 | 6 | 3,810 | 72,351,744 | 69 | about 9.0 h |
| 1, `--short` | 451 | 1 | 906 | 15,990,784 | 16 | about 2.1 h |
| 2, whole | 4,710 | 6 | 4,866 | 84,934,656 | 81 | about 10.6 h |
| 2, `--short` | 892 | 1 | 1,272 | 24,117,248 | 23 | about 3.0 h |
| 3, whole | 3,747 | 6 | 3,822 | 69,468,160 | 67 | about 8.7 h |
| 3, `--short` | 1,077 | 1 | 1,218 | 22,020,096 | 21 | about 2.8 h |

- **The estimate** is segments × 467 s + 170 s. M4.10's run of 16 segments took 7,638.5 s, 2 h 7 min, which the formula gives within 1.5 %.
- **`--short` is the runbook's choice:** it settles a run that clears a level, which the done-when asks for, in about 2 to 3 hours. The whole bot run, the plan's command, takes 9 to 11 hours in the container: possible in one session, but long.
- **Alternatives:** a 4-vCPU GitHub runner proves at about the container's rate, but private-repository runners have 2 vCPUs, about 2.2 times slower, and a 6-hour job limit, and this month's Actions minutes are nearly used up, so no workflow proves here. Boundless, RISC Zero's proof market, sells raw Groth16 proofs at about 0.000018 ETH on Base (`docs/VERIFICATION.md`, Prover network price), in minutes, but needs round F0's prover credential, which was never set. The settlement grace (24 h after the 1-day season) bounds how late the proof may come.

## 7. testnet-0's close, claim and rake withdrawal

testnet-0's settlement ended on 2026-11-11 at 12:14:45 UTC. Ten minutes later, plan M5.8's rehearsal sent its three permissionless calls with `season.mjs`, from the tester key. That key is also the bot player that settled run 1.

| Step | Command | Transaction | Block | Gas | Fee |
|---|---|---|---:|---:|---:|
| Close | `season.mjs close --network arbitrum-sepolia` | [0x4ac67ae7…f5b2](https://sepolia.arbiscan.io/tx/0x4ac67ae7b5401bf07dfe91f8749ffe8c97e9333c4bea03edfca9e8e5307df5b2) | 328,186,309 | 126,080 | 0.0000025 ETH |
| Claim | `season.mjs claim --network arbitrum-sepolia --season testnet-0` | [0x685cee15…eacf](https://sepolia.arbiscan.io/tx/0x685cee15fc3e0055f0c5246d8fba2d3e8732d8317e6b99e22f76a98bc315eacf) | 328,186,316 | 84,198 | 0.0000017 ETH |
| Rake | `season.mjs withdraw --network arbitrum-sepolia` | [0x813aff8f…fcd6](https://sepolia.arbiscan.io/tx/0x813aff8f13bf7777ff3b474e8d0cf24481c22ffc46da446aff0a6f53e876fcd6) | 328,186,323 | 32,109 | 0.0000006 ETH |

- **The close** took the season's two run fees, 0.0001 ETH. It credited 0.00001 ETH of rake, at 1,000 bp, and left a players' pot of 0.00009 ETH. One player qualified, the bot, with run 1 and a score of 20,310.
- **The claim** paid the bot the whole pot, 20,310 × 0.00009 ETH / 20,310 = 0.00009 ETH, with 0 wei of rounding dust.
- **The rake** went to the treasury, the deployer's address `0xEfEA68dbE0740982789735D007B14D0D8358d1B3`.
- **After,** at block 328,186,365, `season.mjs status` shows:
  - testnet-0 closed and claimed;
  - the `Season`'s balance at 0 wei;
  - no rollover and no rake owed;
  - `isSolvent()` true.
- **Gas** was priced at about 0.020 gwei, with no L1 gas (`gasUsedForL1` 0).
- **`season-ops.yml`'s daily schedule** had not run by then. Its first scheduled run was due at 07:17 UTC that day, and none appeared. It could not have closed anything before 12:14:45 anyway.
