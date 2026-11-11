# zk referee

The zk path of `IReferee` (README §7.3): the core replays journals as the guest of RISC Zero's zkVM, and a proof of that replay is verified onchain by RISC Zero's verifier contract. RISC Zero 3.0.6 (`risc0-zkvm` and `risc0-build` pinned to `=3.0.6`), guest target `riscv32im-risc0-zkvm-elf`, toolchain `r0.1.97.0` (`bash scripts/bootstrap.sh zk`). Measurements and costs are in [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md).

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

RISC Zero's own route, risc0-build's Docker build (`use_docker`, which builds at `/src` in `risczero/risc0-guest-builder`, with its tag set to `r0.1.97.0`, since 3.0.6 defaults to `r0.1.88.0`, older than the core's `rust-version`), was not used: in the agent's container, its `cargo fetch` step would run in a build container, which cannot reach the container's network proxy at `127.0.0.1` ([`docs/TOOLING.md`](../../docs/TOOLING.md), Docker), and Docker Hub answered the builder image's manifest with `429 Too Many Requests`; on Actions it would add the builder image's pull and a guest build from scratch to every zk-exec run ([`docs/VERIFICATION.md`](../../docs/VERIFICATION.md#reproducible-image-ids)).

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

The segment proofs and their recursion into one succinct receipt run in the process, on the CPU. The Groth16 step runs `risczero/risc0-groth16-prover:v2025-04-03.1` through `docker run`, on x86 only; the image is on Docker Hub only. Memory follows the segment size: about 9.2 GiB with RISC Zero's default 2^20 cycles, 4.6 GiB with 2^19, so a 7.9 GB runner proves with `--segment-po2 19`. The output, between `=== BEGIN zk-prove ===` and `=== END zk-prove ===`, gives the image id, the cycles, each step's time, the peak memory and the seal's size, and between `=== BEGIN zk-fixture ===` and `=== END zk-fixture ===` the proof as JSON: `mode`, `vectors` (or `runFile` and `season`), `imageId`, `seal` (the router's encoding: the verifier selector, then the 256-byte Groth16 seal) and `publicValues`. `.github/workflows/zk-prove.yml` runs it; `contracts/test/fixtures/zk-proofs.json` holds a level proof and a run proof from its log, the container's proof of `worst-case`, and the container's proof of the run file `contracts/test/fixtures/zk-run.json` (`challengeRun`, plan M4.10).

## Proving on a GPU

The `cuda` feature (plan M5.9) builds `zk-host` with RISC Zero's GPU prover: the segment proofs, their recursion and the Groth16 step run on an NVIDIA card, without Docker. The guest does not change, so neither does the image id. The operator proves testnet-1's runs this way, on a GPU rented by the hour (owner, 2026-11-11), and settles them from its own machine ([`docs/SEASON_RUNBOOK.md`](../../docs/SEASON_RUNBOOK.md)).

**The machine.** x86-64 Linux, an NVIDIA card with at least 16 GB, which fits RISC Zero's default segments (third-party), its driver, and the CUDA toolkit with `nvcc`, plus `git`, `curl` and `g++`. On RunPod, a community RTX 4090 pod with a CUDA "devel" image fits; keep its disk between sessions, so that the build is done once. It holds no key: a proof is public data, and settlement is sent from the operator's machine.

**Set up.** Clone at the fixed path, which needs no bind mount on a fresh machine, then build and measure with one script. It installs rustup when it is missing and the zk tier of `scripts/bootstrap.sh`, builds with `--features cuda`, prints the card and the image id, and proves M5.9's two runs under `peak-memory.sh`:

```bash
git clone https://github.com/detychey/jiro-ikusu /home/runner/work/jiro-ikusu/jiro-ikusu
cd /home/runner/work/jiro-ikusu/jiro-ikusu
bash referee/zk/gpu-measure.sh            # or: bash referee/zk/gpu-measure.sh --segment-po2 19
```

- **The image id** it prints must be the deployed `ZkReferee`'s, which `scripts/contracts/verify-proof.mjs` prints first.
- **The two runs:** testnet-0's settled run 1, 13 segments, which took 75 min on 4 CPUs ([`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md)), and the heaviest six-level run of the gate set, 131 segments ([`docs/VERIFICATION.md`](../../docs/VERIFICATION.md#proving)).
- **Their logs** go to `gpu-run-1.log` and `gpu-heaviest.log`. Each holds the `zk-prove` block (cycles, segments and each step's time), the proof between the `zk-fixture` markers, and the `peak-memory` block, the card's memory included.
- **Out of memory:** run it again with `--segment-po2 19`, then 18, and keep the size that fits. `web/scripts/settle.mjs` and `prove-runs.sh` take the same option.

**Check** each proof through the deployed `ZkReferee`, from any machine with Node 22 and `npm --prefix scripts/contracts ci`, with an `eth_call` of `verifyRun`, which reverts on a proof that does not verify:

```bash
node scripts/contracts/verify-proof.mjs --network arbitrum-sepolia --proof gpu-run-1.log \
  --run seasons/testnet-0/runs/run-1.json --season seasons/testnet-0.json
node scripts/contracts/verify-proof.mjs --network arbitrum-sepolia --proof gpu-heaviest.log --vectors \
  vectors/levels/10-worst.json vectors/levels/16-worst.json vectors/levels/04-worst.json \
  vectors/levels/08-worst.json vectors/levels/03-worst.json vectors/levels/14-synthetic.json
```

Run 1's proof must give the run score it settled with, 20310.

**Settle a season's runs** in three steps, so that no key reaches the rented machine:

1. On the operator's machine, which reads the chain: `node web/scripts/settle.mjs --network arbitrum-sepolia --season <label> --export` writes the run file of each run to settle under `seasons/<label>/runs/`.
2. On the GPU machine, with those run files: `bash referee/zk/prove-runs.sh seasons/<label>/runs seasons/<label>.json` proves each run file that has no proof yet, into `run-<id>.proof.json`.
3. Back on the operator's machine, with the proofs beside the run files: `DEPLOYER_KEY=… node web/scripts/settle.mjs --network arbitrum-sepolia --season <label>` settles each run with its proof. It needs no `zk-host` for a run whose proof is there.
