# zk referee

The zk path of `IReferee` (README §7.3): the core replays journals as the guest of RISC Zero's zkVM, and a proof of that replay is verified onchain by RISC Zero's verifier contract. RISC Zero 3.1.0 (`risc0-zkvm` pinned to `=3.1.0`, `risc0-build` to `=3.0.7`, since plan M5.10; no `risc0-build` 3.1.0 exists), guest target `riscv32im-risc0-zkvm-elf`, toolchain `r0.1.97.0` (`bash scripts/bootstrap.sh zk`). Measurements and costs are in [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md).

- `guest/`, its own workspace, built by risc0-build from the host's build script:
  - `verify`, the proving program. It replays each level and commits the public values below. A rejected level or journal makes it panic with replay's code, so no receipt, and no proof of an Outcome, exists for it (README §7.3, "Rejections revert").
  - `trace`, test only: per level, replay's error code, the keccak256 of the state-hash trace (`traceKeccak`, [`vectors/README.md`](../../vectors/README.md)) and the encoded Outcome.
- `host/`, the `zk-host` binary:
  - `execute <files or directories>` runs vectors through both programs in the executor and checks them against the native core's records, with a cycle table;
  - `execute-run <six files>` executes one run-mode input;
  - `difffuzz <directory>` runs the random cases that `jiro-tools difffuzz` wrote there through both programs, as `execute` runs a game vector, and copies each case that disagrees with the native core to `<directory>/mismatch/` (plan M1.13);
  - `image-id` prints the verify program's image id, which `ZkReferee` pins;
  - `prove --level <file>`, `prove --run <six files>` and `prove --run <run file> --season <season file>`, each with an optional `--segment-po2 <n>`, prove the verify program on the CPU and wrap the proof into a Groth16 seal (Docker), or a dev-mode seal with `RISC0_DEV_MODE=1`. Built with the `cuda` feature, they prove on an NVIDIA card instead ([Proving on a GPU](#proving-on-a-gpu));
  - `tests/mock_round_trip.rs`, a dev-mode receipt round trip.
- `peak-memory.sh <command>` prints a command's wall time and peak memory, its process tree's and Docker's, and the NVIDIA cards' where `nvidia-smi` answers.
- `gpu-measure.sh` builds the GPU prover and runs M5.9's measurement, and `prove-runs.sh` proves a directory of run files for settlement ([Proving on a GPU](#proving-on-a-gpu)).

## Inputs and modes

The guest reads raw little-endian u32 words: a count, then for each level the length and bytes of the level, the length and bytes of the journal, and `weightBp`. The count is the mode:

| Mode | Levels | For | Public values |
|---|---:|---|---:|
| level | 1 | `verify` | 384 bytes |
| run | 6 | `verifyRun` (P16 a) | 2,304 bytes |

Any other count panics. Replays are independent, as `verifyRun` requires: the six need not come from one run, and binding them to one is the settlement contract's job (README §7.2).

## Public values

The journal of a receipt, which RISC Zero calls the journal and this repository calls the public values to keep "journal" for the game's, is, for each level in input order, the 12 ABI words of `abi.encode(uint16 weightBp, Outcome)` (README §7.3), concatenated with nothing between them:

| Word | Field | Value |
|---:|---|---|
| 0 | `weightBp` | the weight the level was scored with |
| 1 | `journalHash` | keccak256 of the journal bytes |
| 2 | `levelId` | keccak256 of the level bytes: replay rejects a journal whose header names another id |
| 3 | `runNonce` | from the journal header |
| 4 | `levelIndex` | from the header |
| 5 | `drawSlot` | `draw(runNonce)[levelIndex]` (README §8.2) |
| 6 | `mode` | from the header |
| 7 | `rulesVersion` | from the header |
| 8 | `endReason` | README §4.10 |
| 9 | `claimBp` | claim when the level ended |
| 10 | `ticksUsed` | README §4.10 |
| 11 | `levelScore` | `claimBp × weightBp / 10_000`, or 0 when out of lives |

Each word is 32 bytes, big-endian, a number left-padded with zeros. So the public values bind keccak256 of each level and of each journal, each weight and each Outcome, with each value once: the Outcome's `journalHash` and `levelId` are the two hashes.

**Onchain.** The verifier contract checks `verify(seal, imageId, sha256(publicValues))`. [`contracts/src/ZkReferee.sol`](../../contracts/src/ZkReferee.sol) (plan M4.10) takes `proof = abi.encode(bytes seal, bytes publicValues)`. It requires 384 bytes of public values in `verify` and 2,304 in `verifyRun`, so a run's public values cannot pass as a level's, or the reverse. It checks the seal against its pinned image id, decodes the public values as `(uint16 weightBp, Outcome)` per level, and requires, for level `i`, the submitted weight, `journalHash = keccak256(journals[i])` and `levelId = keccak256(levels[i])`. The Outcomes it returns are the decoded ones, which settlement then binds to the run (README §7.2). [`contracts/test/ZkVerify.t.sol`](../../contracts/test/ZkVerify.t.sol) rebuilds the public values from the game vectors the same way.

## Reproducible image ids

A contract pins the verify program's image id, so every build must give the same one. Two things make a build depend on its machine, and both are handled:

1. **Source paths in panic locations.** The guests build with `-Zlocation-detail=none` (`[package.metadata.risc0] rustc-flags` in `guest/Cargo.toml`).
2. **Cargo's `-C metadata` hash of `jiro-core`,** which lies outside the guest's workspace, so Cargo hashes its absolute path. Function order, and so the ELF, follow the symbol names derived from that hash.

The fix for the second is **one fixed absolute path: the repository root is `/home/runner/work/jiro-ikusu/jiro-ikusu`**, where `actions/checkout` puts this repository on GitHub's runners. CI builds there with no extra step. A machine with another checkout path builds from a bind mount at that path (root needed):

```bash
sudo mkdir -p /home/runner/work/jiro-ikusu/jiro-ikusu
sudo mount --bind "$PWD" /home/runner/work/jiro-ikusu/jiro-ikusu
cd /home/runner/work/jiro-ikusu/jiro-ikusu
cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host
```

`CARGO_TARGET_DIR`, `CARGO_HOME` and the RISC Zero toolchain's directory may differ: none of them enters the ELF. `zk-host execute` prints both image ids first. With the same commit and toolchain, a build at any other path gives another verify image id, and a proof from it verifies only under that id.

RISC Zero's own route, risc0-build's Docker build (`use_docker`, which builds at `/src` in `risczero/risc0-guest-builder`, with its tag `r0.1.97.0`, which `risc0-build` 3.0.7 also defaults to; 3.0.6 defaulted to `r0.1.88.0`, older than the core's `rust-version`), was not used: in the agent's container, its `cargo fetch` step would run in a build container, which cannot reach the container's network proxy at `127.0.0.1` ([`docs/TOOLING.md`](../../docs/TOOLING.md), Docker), and Docker Hub answered the builder image's manifest with `429 Too Many Requests`; on Actions it would add the builder image's pull and a guest build from scratch to every zk-exec run ([`docs/VERIFICATION.md`](../../docs/VERIFICATION.md#reproducible-image-ids)).

## Proving a run for settlement

A committed Challenge run settles with one run proof (README §7.3, D2), made from its run file ([`docs/VERIFICATION.md`](../../docs/VERIFICATION.md#run-file-v1)) and the file of its season, whose `weightsBp` give each level's weight by its draw slot:

```bash
referee/zk/target/release/zk-host prove --run <run file> --season seasons/<season>.json [--segment-po2 19]
```

1. Build the host at the fixed path below, so that its image id is the one the season's `ZkReferee` pins: `zk-host image-id` prints it, and `cast call <ZkReferee> 'imageId()(bytes32)'` reads the pinned one.
2. The host first executes the run, in seconds, and requires each level's public values to carry the season's weight, the season's level id and rules version for its draw slot, the run nonce, the level index, the draw slot and mode 1. It stops on a journal that replay rejects, with replay's code: no proof of that run can exist. Then it proves, which took about two hours on 4 CPUs for the six short levels of `contracts/test/fixtures/zk-run.json`, and would take 16 to 17 hours for the heaviest run ([`docs/VERIFICATION.md`](../../docs/VERIFICATION.md#proving)).
3. Settle with the seal and the public values between the `zk-fixture` markers: `settleRun(runId, levels, journals, proof)` with `proof = $(cast abi-encode 'f(bytes,bytes)' <seal> <publicValues>)`, from any account.

With `RISC0_DEV_MODE=1`, the receipt is fake and its seal is `0xffffffff` followed by the claim's digest, which only RISC Zero's mock verifier, `RiscZeroMockVerifier`, deployed with that selector, accepts: the zk mode of `scripts/contracts/e2e.mjs` settles with such proofs on a local chain.

## Proving

```bash
cargo run --release --manifest-path referee/zk/Cargo.toml -p zk-host -- prove --level vectors/game/worst-case.json
bash referee/zk/peak-memory.sh referee/zk/target/release/zk-host prove --run <six game vector files> --segment-po2 19
```

The segment proofs and their recursion into one succinct receipt run in the process, on the CPU. The Groth16 step runs `risczero/risc0-groth16-prover:v2026-10-20.1`, the tag `risc0-groth16` 3.0.6 runs, through `docker run`, on x86 only; the image is on Docker Hub, and `mirror.gcr.io` serves the same index digest (plan M5.10). Memory follows the segment size: about 9.2 GiB with RISC Zero's default 2^20 cycles, 4.6 GiB with 2^19, so a 7.9 GB runner proves with `--segment-po2 19`. The output, between `=== BEGIN zk-prove ===` and `=== END zk-prove ===`, gives the image id, the cycles, each step's time, the peak memory and the seal's size, and between `=== BEGIN zk-fixture ===` and `=== END zk-fixture ===` the proof as JSON: `mode`, `vectors` (or `runFile` and `season`), `imageId`, `seal` (the router's encoding: the verifier selector, then the 256-byte Groth16 seal) and `publicValues`. `.github/workflows/zk-prove.yml` runs it; `contracts/test/fixtures/zk-proofs.json` holds a level proof and a run proof from its log, the container's proof of `worst-case`, and the container's proof of the run file `contracts/test/fixtures/zk-run.json` (`challengeRun`, plan M4.10).

## Proving on a GPU

The `cuda` feature (plan M5.9) builds `zk-host` with RISC Zero's GPU prover: the segment proofs, their recursion and the Groth16 step run on an NVIDIA card, without Docker. The guest does not change, so neither does the image id: the cuda build gives the same image id as the CPU build. The operator proves testnet-1's runs this way, on a GPU rented by the hour (owner, 2026-11-11), and settles them from its own machine ([`docs/SEASON_RUNBOOK.md`](../../docs/SEASON_RUNBOOK.md)).

**The machine.** x86-64 Linux, an NVIDIA card with at least 16 GB, which fits RISC Zero's default segments (third-party), its driver, and the CUDA toolkit with `nvcc`, plus `git`, `curl`, `g++`, `protoc`, `libclang` and Python 3.11 or newer, with which `scripts/bootstrap.sh` reads `rust-toolchain.toml`. It holds no key: a proof is public data, and settlement is sent from the operator's machine.

On RunPod, a community RTX 4090 pod started from RunPod's PyTorch image for CUDA 12.8.1 on Ubuntu 24.04, such as `runpod/pytorch:2.1.0-cu1281-torch280-ubuntu2404`, has all of them but `protoc` and `libclang`, which the cuda build needs and `apt-get` installs (measured on RunPod, 2026-11-26: the build stops in `circom-witnesscalc`, then in `bindgen`, without them). Its image configuration shows NVIDIA's CUDA 12.8.1 devel image, `build-essential`, `git`, `curl` and Python 3.12 (2026-11-11). Pick a host whose driver supports CUDA 12.8.

**The Groth16 setup files.** With the `cuda` feature, `risc0-groth16` 3.0.6 wraps the proof on the card, without Docker, and reads four setup files from rzup's component `risc0-groth16` 0.2.0, the 3.1.0 trusted setup (plan M5.10), in `~/.risc0/extensions/v0.2.0-risc0-groth16/`: `stark_verify_final.zkey`, `stark_verify_graph.bin`, `preprocessed_coeffs.bin` and `fuzzed_msm_results.bin`. Neither `scripts/bootstrap.sh` nor the build installs them, and without them every proof fails at its last step with "Missing required `risc0-groth16` rzup component". Install that component alone, before the benchmark: a bare `rzup install` also installs a newer guest toolchain. RISC Zero's installer only puts `rzup` 0.6.0 in `~/.risc0/bin`; the component comes from `artifacts.risczero.net` and is about 2.4 GB.

**The GPU libraries' versions.** `referee/zk/Cargo.lock` pins `sppark` 0.1.12 and `blst` 0.3.15, the versions of RISC Zero 3.1.0's own lockfile. With `sppark` 0.1.16, which Cargo resolved first, every proof aborted in the Groth16 step on an RTX 4090 with `cudaStreamSynchronize ... "an illegal memory access was encountered"` (2026-11-26; RISC Zero's issue 3785 reports the same abort on 3.0.x). With the pin, the 24 proofs of the benchmark of 2026-11-26 all passed on an RTX 4090 ([`reports/gpu-bench-2026-11-26/`](../../reports/gpu-bench-2026-11-26/summary.md)). Neither crate is in the guest, so the image id does not change.

**Set up and measure.** Clone at the fixed path, which needs no bind mount on a fresh machine, then build and measure with one script. It installs rustup when it is missing and the zk tier of `scripts/bootstrap.sh`, builds with `--features cuda`, and runs the benchmark below. Each session clones and builds again: the build gives the deployed image id only at the fixed path itself, and a symbolic link to a disk kept between sessions builds from another path. The build is long, mostly RISC Zero's CUDA kernels: 42 min on 4 CPUs without the guest (2026-11-11), less on a machine with more CPUs. Run again after `git pull`, the script reuses the build.

```bash
apt-get update && apt-get install -y protobuf-compiler libclang-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none
source ~/.cargo/env
git clone https://github.com/detychey/jiro-ikusu /home/runner/work/jiro-ikusu/jiro-ikusu
cd /home/runner/work/jiro-ikusu/jiro-ikusu
bash scripts/bootstrap.sh zk                     # rustc first: rzup's installer refuses to run without it
curl -L https://risczero.com/install | bash      # rzup, into ~/.risc0/bin
~/.risc0/bin/rzup install risc0-groth16 0.2.0    # the four setup files, nothing else
bash referee/zk/gpu-measure.sh --out /workspace/gpu-bench --price-usd-per-hour 0.34
```

Run it in JupyterLab's terminal, which outlives a closed browser tab, or detached, so that a dropped SSH session does not stop it: `nohup bash referee/zk/gpu-measure.sh … > /workspace/gpu-measure.out 2>&1 &`, then `tail -f /workspace/gpu-measure.out`.

`--out` keeps the benchmark where a RunPod pod keeps files across a restart, `/workspace`; it defaults to `gpu-bench/` in the checkout. `--price-usd-per-hour` is the pod's price, 0.34 by default. Before the build the script checks the machine, the setup files, the options and that the card is idle; before any proof it checks that `zk-host image-id` is `gpu_bench.py`'s `IMAGE_ID`, risc0-zkvm 3.1.0's (plan M5.10), and stops otherwise.

**The benchmark** proves six committed inputs in run mode, a ladder of sizes, each through `peak-memory.sh` and a one-hour limit, with the container's CPU counters before and after (cgroup v2's `cpu.stat` and `cpu.pressure`) and the card's telemetry sampled every second (`nvidia-smi -lms 1000`: SM clock, temperature, power, utilization, memory and clock event reasons). Its model, wall time = a + b × segments, prices any run from its proving cycles: the time to prove a segment depends on the segment size, not on what the guest computed. Segment counts are at 2^20 cycles; those marked ~ are estimates, and each proof records the exact ones.

| Input | Files | Segments |
|---|---|---:|
| `small` | the six smallest game vectors, M4.8's run-mode proof | 7 |
| `run1` | testnet-0's settled run 1, with its season: compares with the CPU and with its proof of record | 13 |
| `mid` | `vectors/levels/{05,06,09,11,12,13}-worst.json` | ~45 |
| `high` | `vectors/levels/{01,02,07,09,12,15}-synthetic.json` | ~96 |
| `heaviest` | the heaviest six-level run of the gate set ([`docs/VERIFICATION.md`](../../docs/VERIFICATION.md#proving)) | 131 |
| `overcap` | `vectors/levels/10-worst.json` six times, above the proposed cap of 150 million proving cycles, so that the cap lies inside the measured range | ~177 |

1. **A cold proof** of `small`, first in every session, apart from the statistics: it shows the start-up cost.
2. **Three rounds of the six**, ascending, descending, then mixed, so that a drift of the card is not tied to the size (`--rounds` sets their number).
3. **The segment-size sweep:** `run1` and `heaviest` at 2^19, then at 2^21, the largest size RISC Zero's 97-bit security target allows. An out-of-memory error there is a result, not a failure.
4. **A sentinel** proof of `small`, last, against the first ones.

That is 24 proofs. At wall ≈ 15 s + 2 s per segment, an estimate from third-party logs, they take about 67 min on an RTX 4090 after the build, about 0.38 USD at 0.34 USD an hour; about 96 min at 3 s per segment. After each proof the script prints the time left, estimated from the proofs made.

**A proof that fails** is recorded with its status and the other proofs go on: `oom-gpu` (out of the card's memory), `oom-host` (killed, exit status 137), `timeout` (stopped at the one-hour limit), `verify-fail` or `error`. A `verify-fail`, a proof whose image id, seal or selector differs from the proof of record's, whose receipt or public values do not check, or that printed no `zk-fixture` block, fails criterion A2, loudly, and the script exits 1 at the end; `--redo` does not erase it, since A1 and A2 read every record. So does any other failed criterion.

**Its files**, in `--out`:

- `proofs/<id>.log`: `zk-host`'s output, one proof that `verify-proof.mjs` reads, then the `peak-memory` block; `proofs/<id>.err`, its standard error; `proofs/<id>.gpu.csv`, its telemetry; `proofs/<id>.cpu`, the CPU counters. A proof's id is `<input>-p<segment po2>-<tag>`, the tag being `r1` to `r3`, `sweep`, `cold<session>` or `sentinel<session>`.
- `results.jsonl`: one line per proof, written by `gpu_bench.py record`: its status, cycles, segments, each phase's time, wall time, peak host and card memory, and the telemetry's summary. The newest line of an id counts.
- `machine-s<session>.txt`: the machine of each session: the commit, the image ids, `zk-host`'s sha256, the toolchains, the card (model, memory, driver, power limits, clocks, PCIe link), the CPUs, the memory and its cgroup limit, the free disk for the segment files RISC Zero writes in `/tmp`, the set-up and build time. `previous/` keeps a copy of the `gpu-run-1.log` and `gpu-heaviest.log` found at the start, whose build time counts when a later build has nothing to do.
- `summary.md` and `onchain.txt`, below.
- `gpu-run-1.log` and `gpu-heaviest.log`, at the repository's root, as before: the machine, then the first proof of `run1` and of `heaviest`.

**Download** the archive the script names at the end, `gpu-bench-<UTC time>-<commit>.tar.gz`, beside `--out`, with SSH or JupyterLab, and attach it to the M5.9 pull request: it holds all of `--out`, about 1 to 2 MB (estimate).

**Resume** by running the same command again, after a stop, a pod restart (which rebuilds) or `git pull`: it skips each proof recorded in `results.jsonl`, failed ones included, and makes a cold proof and a sentinel only when proofs are left. `--redo <input>` proves an input again, such as one whose spread failed A4: its three rounds then run back to back in a new session, which the table's Sessions column shows, so their spread says less than interleaved rounds; say so in the PR. It refuses an `--out` that holds another card's proofs. Ctrl-C leaves the `zk-host` proving at that moment running (`nvidia-smi` in a container usually lists no process): the next run refuses to start while a `zk-host prove` runs, and names its pid to `kill`.

**The summary,** `python3 referee/zk/gpu_bench.py summary <out> [--price-usd-per-hour <p>] [--eth-usd 1700] [--gas-gwei 0.02] [--l1-gas-gwei 0.05]`, ends the script and runs again anywhere on the downloaded directory. It prints, and writes to `summary.md`:

- the warm proofs per input and segment size: median, minimum and maximum wall time, each phase's median, seconds per segment, peak card memory, `VmHWM`, clock, the card's busy share, temperature, the container's CPU seconds and its seconds waiting for a CPU (pressure: a shared host shows here), and the sessions the proofs come from; this table goes into [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md), with each failed proof below it;
- the model at the ladder's size, fitted on each input's median: a, b, R², each input's fit, then the same fit per phase;
- the segment size to use: 2^21 only if `heaviest` there was ok, used at most 90% of the card's memory and 70% of the host's, and was at least 10% faster than at 2^20, undecided when no container memory limit could be read; once `gpu-onchain.sh` accepts it, a ladder at 2^21 (`--segment-po2 21 --rounds 1`) gives its model. `web/scripts/settle.mjs` and `prove-runs.sh` take the same `--segment-po2`;
- the cost of a run, for each input measured and for the scripted players' runs, from 16 to 102 million proving cycles, the proposed cap of 150 million and a cost-maximising legal run of about 2.9 billion (an estimate, not measured: about 16 times beyond the ladder, priced only if A6 passes): wall time, runs per hour, the pod's USD, the same with the session's set-up, build and cold start shared by the 30 runs of a session (docs/SEASON_RUNBOOK.md §5), how many runs' testnet-1 rake at 80% pays for proving and settling, and how many such runs the grace proves with a margin of 2, after the session's set-up, build and cold start. Settling is a range, the same for every row: `settleRun`'s 530,256 gas for run 1, measured, to about 1,000,000 for longer journals (docs/DEPLOYMENT.md, Funding), at 0.02 gwei. Arbitrum's L1 data fee comes on top, stated beside the table: 0 on Arbitrum Sepolia today, and on Arbitrum One at most 16 gas × 0.05 gwei per calldata byte before compression, 1.5 runs' rake at 80% for run 1;
- `small` and `run1` against 4 CPUs, phase by phase;
- the acceptance criteria, PASS, FAIL or PENDING, with their numbers.

| # | Criterion | When it fails |
|---|---|---|
| A1 | every proof has the deployed image id | stops before proving; no number counts |
| A2 | every proof verified locally with a 260-byte seal and the proof of record's selector (C2); the same public values for every proof of an input (C3); `run1`'s equal to its CPU proof of record (C4) | loud: the GPU route settles nothing until it is explained |
| A3 | every ok proof accepted onchain, `run1` with run score 20310 (C5) | PENDING on the pod, then `gpu-onchain.sh`: not settlement-grade, M5.9 is not done |
| A4 | each input's wall times within 5% of their median, or 3 s | `--redo` it while the pod is up; else explain it in the PR: the cost uses each input's median |
| A5 | no sample slowed by hardware, heat or power brake, each proof's clock within 5% of its input's median (inputs may run at different clocks under the power limit), under 1 GiB in use on the card before each proof | redo; if it persists, measure on another pod; a power limit below default is reported |
| A6 | R² ≥ 0.99, every input within 5% or 3 s of the fit, and the fit without `overcap` predicts it within 5% | the cost holds only within the measured range |
| A7 | 3 warm proofs of each input, and `heaviest` tried at the next size | resume; if 2^20 runs out of the card's memory, `--segment-po2 19` |
| A8 | the sentinel within 5% or 3 s of `small`'s median, each round's times within 5% of the medians | flag it; redo round 1 if it is the outlier |

**Check onchain** from any machine with Node 22 and `npm --prefix scripts/contracts ci`, on the unpacked archive:

```bash
bash referee/zk/gpu-onchain.sh gpu-bench
```

It runs `scripts/contracts/verify-proof.mjs` on each proof in `onchain.txt`, an `eth_call` of `verifyRun` on the deployed `ZkReferee` that costs nothing and reverts on a proof that does not verify, and checks the run score: `run1`'s must be 20310, the score it settled with. It first checks run 1's CPU proof of record, as a control: a `ZkReferee` that refuses it refuses every proof, and the script stops there. Then it checks `run1` first, then each input's first round and the sweep, so that a rate-limited RPC still checks those. **On 2026-11-26 the control failed:** RISC Zero's emergency stop under the deployed `ZkReferee`, `0x724d…7797`, was paused (`paused()` true), and `verifyRun` reverted on the CPU proof of record with `EnforcedPause()` (`0xd93c0665`). No proof passes A3 until a new generation pins a verifier that is not stopped ([`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md), What forces a new generation). `verify-proof.mjs` also reads `gpu-run-1.log` and `gpu-heaviest.log` alone:

```bash
node scripts/contracts/verify-proof.mjs --network arbitrum-sepolia --proof gpu-run-1.log \
  --run seasons/testnet-0/runs/run-1.json --season seasons/testnet-0.json
```

**What it does not measure:** another host or card model (run `--rounds 1` there, about 30 min plus the build, and give it its own `--out`), the noise of a shared community host over many proofs (keep the settlement sessions' `prove-runs.sh` logs), a run of billions of cycles (its time and memory are extrapolated), sessions of hours, and two proofs at once on one card. On a pod, `peak-memory.sh`'s Docker lines may count every process of the pod's own container: read `VmHWM` and the command tree. **The card it builds for:** RISC Zero compiles its CUDA kernels for the card of the machine that builds them (`nvcc -arch=native`), so build again on another card model. Setting `NVCC_APPEND_FLAGS` to a card's architecture, such as `-arch=sm_89` for an RTX 4090, builds for that card instead, even on a machine without one.

**Settle a season's runs** in three steps, so that no key reaches the rented machine:

1. On the operator's machine, which reads the chain: `node web/scripts/settle.mjs --network arbitrum-sepolia --season <label> --export` writes the run file of each run to settle under `seasons/<label>/runs/`.
2. On the GPU machine, with those run files: `bash referee/zk/prove-runs.sh seasons/<label>/runs seasons/<label>.json` proves each run file that has no proof yet, into `run-<id>.proof.json`.
3. Back on the operator's machine, with the proofs beside the run files: `DEPLOYER_KEY=… node web/scripts/settle.mjs --network arbitrum-sepolia --season <label>` settles each run with its proof. It needs no `zk-host` for a run whose proof is there.
