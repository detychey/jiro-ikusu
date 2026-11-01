# Verification

## Stylus activation

[`scripts/contracts/activation.mjs`](../scripts/contracts/activation.mjs) reads `ArbWasm.activationGas()` from the precompile at `0x0000000000000000000000000000000000000071`, at the chain's latest block. New Stylus activations count as open at or below 30,000,000, cargo-stylus 0.10.10's threshold, as ethblockdigger's `scripts/contracts/checks.ts` checks: the chain owner pauses them by raising `activationGas` above it (README §7.3). M4.9, M4.10 and M4.16 reuse it.

| Network | chainId | Block | Date (UTC) | `activationGas` | Activations |
|---|---|---|---|---|---|
| Arbitrum Sepolia | 421614 | 324,664,851 | 2026-10-31 12:23:24 | 18,446,744,073,709,551,615 (2^64 − 1) | paused |
| Arbitrum One | 42161 | 519,986,698 | 2026-10-31 12:23:25 | 18,446,744,073,709,551,615 (2^64 − 1) | paused |

- **First readings,** M4.3, with `activation.mjs` at commit e3623c2856a206366ef942e53b60fa3c7d849a8e, Node v22.22.0 and ethers 6.17.0:

  ```bash
  npm ci --prefix scripts/contracts
  node scripts/contracts/activation.mjs --rpc https://sepolia-rollup.arbitrum.io/rpc
  node scripts/contracts/activation.mjs --rpc https://arb1.arbitrum.io/rpc
  ```

  ```text
  chainId 421614, block 324664851 (2026-10-31T12:23:24.000Z): activationGas 18446744073709551615, above 30000000: activations paused
  chainId 42161, block 519986698 (2026-10-31T12:23:25.000Z): activationGas 18446744073709551615, above 30000000: activations paused
  ```

- **Reading.** Both chains hold `activationGas` at the uint64 maximum, so the pause of README §7.3 still holds on both.

## Stylus gas

**Provisional** (plan M4.2): the first gas figures of the Stylus referee, measured on its deployed wasm on a local Nitro dev node, while new activations on the public chains are paused ([Stylus activation](#stylus-activation)). This is a report, not the gate: M4.9 runs the gate on the gate set, and a figure above 1,000,000 here is a warning that marks nothing, M4.15 included.

- **How.** [`stylus-gas.yml`](../.github/workflows/stylus-gas.yml) starts nitro-devnode with the vendored [`run-dev-node.sh`](../scripts/contracts/nitro/run-dev-node.sh), builds the referee with [`referee/build-wasm.sh`](../referee/build-wasm.sh), deploys and activates it with `cargo stylus deploy --no-verify` and nitro-devnode's public development key, generates M1.10's 200 fixed difffuzz cases, and runs [`scripts/contracts/stylus-gas.mjs`](../scripts/contracts/stylus-gas.mjs). For every game vector and gate-set vector, the script's `eth_call` of `verify` must return the vector's Outcome, or revert with its `replay error <code>`, and its `eth_estimateGas` of `verify` gives the figure below. For each difffuzz case, `eth_call` must return native's Outcome. Any mismatch fails the run.
- **What a figure counts.** `eth_estimateGas` of the whole `verify` transaction: the 21,000 base, the calldata and the replay. `run-dev-node.sh` sets the L1 price per unit to 0, so no L1 data component is included. The program is not cached in ArbOS; locally, a cache bid of 0 left every figure unchanged.
- **Measured** on 2026-11-01 by the secondary route, in the agents' container (4 CPUs) with `dockerd` started as in [`TOOLING.md`](TOOLING.md): the scripts at commit `2090029105c05d78b4285229c67d223b539e28d2`, and `core/`, `referee/` and `vectors/` of `main` at `001c758710e26813fc19d3bdcc117538d2dd8de5` (`RULES_VERSION` 2). Tools: `offchainlabs/nitro-node:v3.12.2-5f02f3f` (digest `sha256:87548501c3ee41cff84e6764cc86f65eb7f0a14e2e50a0d3219d462e5793680d`), nitro-devnode at `ebb523d4ed9c04d4183743af844a038e9843f352`, cargo-stylus 0.10.10, Foundry 1.8.6, Node v22.22.0 and ethers 6.17.0. The module: 44,500 bytes raw and 19,000 bytes brotli, sha256 `afb5755f2cd3b24d586ded67d3c9e77c37a4aef00a03e6bcea2a2965339f58db`. A second deployment on a fresh node gave the same table.

  ```bash
  (cd scripts/contracts/nitro && bash run-dev-node.sh)   # in its own shell, until "press Ctrl-C to stop"
  bash referee/build-wasm.sh
  cargo stylus deploy --wasm-file target/jiro_referee_stylus.opt.wasm --endpoint http://127.0.0.1:8547 \
    --private-key "$(sed -n 's/^PRIVATE_KEY=//p' scripts/contracts/nitro/run-dev-node.sh)" --no-verify
  cargo run -p jiro-tools --release --locked -- difffuzz --seed 1 --cases 200 --out target/difffuzz
  npm ci --prefix scripts/contracts
  node scripts/contracts/stylus-gas.mjs --rpc http://127.0.0.1:8547 --referee <deployed address> vectors/ target/difffuzz
  ```

- **CI run:** [41335622698](https://github.com/detychey/jiro-ikusu/actions/runs/41335622698), on PR #45 at 7d91876 (the `ci:heavy` label). Its table equals the one below: the same gas on every vector, maximum 11,599,408 on `levels/10-worst`, and 75 vectors and 200 difffuzz cases with 0 mismatches.

### Reading

- **Outcomes:** all 75 vectors and all 200 fixed difffuzz cases equal native: 71 Outcomes, and the 4 rejected game vectors revert with their recorded codes.
- **Above 1M (a warning):** 41 of the 71 measured vectors, the 32 of the gate set among them. The maximum is 11,599,408 gas (`levels/10-worst`); `worst-case` takes 10,632,722 and `full-journal` 1,301,508. The gate set runs from 1,599,425 (`05-worst`) to 11,599,408.
- **For M4.9 and M4.15.** The smallest figure is 271,192 (`boss-corridor-b2`, 400 ticks), and `commit-at-tick-0`, one tick, takes 313,515: most of a short replay's cost comes before its ticks. Ticks alone do not set the cost: `open-field-empty`, 2,700 ticks without an event, takes 511,206, and `open-field-capture`, 162 ticks with captures, 1,246,460.

### Table

| Vector | Ticks used | Journal bytes | Gas (eth_estimateGas) |
|---|---:|---:|---:|
| game/boss-bumps-trail | 57 | 77 | 335,900 |
| game/boss-corridor-b2 | 400 | 71 | 271,192 |
| game/boss-corridor-b8 | 400 | 71 | 316,887 |
| game/capture-around-obstacle | 17 | 83 | 497,083 |
| game/capture-edge-rectangle | 17 | 83 | 497,251 |
| game/capture-l-shape | 36 | 80 | 496,421 |
| game/capture-split-boss-left | 60 | 77 | 432,675 |
| game/capture-split-boss-right | 60 | 77 | 428,151 |
| game/clear-and-last-life | 9 | 80 | 491,142 |
| game/clear-the-level | 61 | 233 | 499,030 |
| game/commit-at-tick-0 | 1 | 74 | 313,515 |
| game/commit-during-cut | 6 | 77 | 313,808 |
| game/event-at-last-tick | 20 | 74 | 308,255 |
| game/fast-cut-close-first-sub-step | 10 | 80 | 496,712 |
| game/fast-cut | 7 | 80 | 315,073 |
| game/full-journal | 2700 | 8171 | 1,301,508 |
| game/last-life-on-last-tick | 10 | 71 | 313,506 |
| game/minion-stranded-respawns | 58 | 83 | 500,763 |
| game/open-field-capture | 162 | 383 | 1,246,460 |
| game/open-field-empty | 2700 | 71 | 511,206 |
| game/random-all-1 | 617 | 347 | 846,119 |
| game/random-all-2 | 651 | 416 | 1,263,295 |
| game/random-all-3 | 1425 | 731 | 1,927,992 |
| game/random-all-4 | 907 | 491 | 1,103,931 |
| game/random-dirs-1 | 572 | 332 | 752,241 |
| game/random-dirs-2 | 717 | 374 | 1,266,957 |
| game/random-dirs-3 | 1430 | 755 | 1,294,176 |
| game/random-dirs-4 | 1166 | 704 | 2,458,749 |
| game/rejected-event-after-end | - | 77 | reverts: replay error 14 |
| game/rejected-event-at-time-limit | - | 74 | reverts: replay error 13 |
| game/rejected-level-before-its-id | - | 71 | reverts: replay error 33 |
| game/rejected-level-id | - | 71 | reverts: replay error 12 |
| game/respawn-after-bottom-captured | 166 | 89 | 711,250 |
| game/several-hits-one-life | 11 | 77 | 318,886 |
| game/several-hits-while-invulnerable | 11 | 83 | 319,109 |
| game/several-hits-with-shield | 11 | 77 | 313,560 |
| game/shield-absorbs-a-hit | 13 | 77 | 313,775 |
| game/slow-shield | 11 | 77 | 313,987 |
| game/step-onto-boss-from-below | 19 | 80 | 322,240 |
| game/step-onto-boss-from-right | 19 | 80 | 322,150 |
| game/stranded-off-rail | 109 | 92 | 523,515 |
| game/swap-collision | 11 | 77 | 319,173 |
| game/worst-case | 2700 | 8171 | 10,632,722 |
| levels/01-synthetic | 2458 | 7445 | 6,283,665 |
| levels/01-worst | 2700 | 5558 | 6,308,876 |
| levels/02-synthetic | 2458 | 7445 | 6,402,435 |
| levels/02-worst | 2700 | 5558 | 6,424,170 |
| levels/03-synthetic | 2520 | 7631 | 7,186,359 |
| levels/03-worst | 2700 | 5576 | 7,283,863 |
| levels/04-synthetic | 2415 | 7316 | 6,044,284 |
| levels/04-worst | 2700 | 5882 | 7,655,029 |
| levels/05-synthetic | 1328 | 4055 | 5,109,935 |
| levels/05-worst | 2700 | 1028 | 1,599,425 |
| levels/06-synthetic | 1335 | 4076 | 6,006,621 |
| levels/06-worst | 2700 | 1082 | 1,948,272 |
| levels/07-synthetic | 2080 | 6311 | 5,459,181 |
| levels/07-worst | 2700 | 4007 | 5,883,429 |
| levels/08-synthetic | 2204 | 6683 | 5,517,927 |
| levels/08-worst | 2700 | 1250 | 7,868,570 |
| levels/09-synthetic | 1238 | 3785 | 5,660,938 |
| levels/09-worst | 2700 | 1031 | 2,190,902 |
| levels/10-synthetic | 1456 | 4439 | 6,275,699 |
| levels/10-worst | 2700 | 1874 | 11,599,408 |
| levels/11-synthetic | 1233 | 3770 | 5,697,751 |
| levels/11-worst | 2700 | 1070 | 3,063,991 |
| levels/12-synthetic | 1597 | 4862 | 5,676,793 |
| levels/12-worst | 2700 | 1073 | 2,727,967 |
| levels/13-synthetic | 1604 | 4883 | 5,128,489 |
| levels/13-worst | 2221 | 3296 | 5,298,297 |
| levels/14-synthetic | 1740 | 5291 | 7,057,238 |
| levels/14-worst | 2700 | 4019 | 6,773,301 |
| levels/15-synthetic | 1496 | 4559 | 5,566,942 |
| levels/15-worst | 2700 | 4016 | 6,722,971 |
| levels/16-synthetic | 1607 | 4892 | 5,653,844 |
| levels/16-worst | 2700 | 1262 | 9,447,196 |

## zkVM trials

Trial records of the zkVM frameworks for the zk path of `IReferee` (README §7.3). Each framework gets one row in the summary and one section below, with the same fields in the same order. M1.16 measured SP1; M1.17 adds RISC Zero in the same shape. M1.12 then compares the frameworks that pass the four tooling checks, on cycles and price, and records the choice in README §13 D2.

The four tooling checks of README §7.3:

1. **Install:** it installs and runs in the agent's cloud environment.
2. **Execute:** it executes guests locally, with cycle counts and without a GPU.
3. **Mock:** it has a fast mock or dev mode for tests.
4. **Verifier:** it has a verifier contract on Arbitrum, with Foundry test support.

### Summary

| Framework | Version | Install | Execute | Mock | Verifier | Vectors reproduced | Cycles, heaviest level | CPU proof of a small level | Onchain-verifiable wrapping | Prover network, Groth16 proof of a six-level run | Kept branch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SP1 | v6.10.0 (circuits v6.1.0) | PASS | PASS | PASS | PASS | 75 of 75 | 31,227,278 (`10-worst`) | core: 92 s, 11.6 GiB; compressed: out of memory at 13.4 GiB | FAIL: out of memory in the container and on Actions | 0.433 PROVE (about 0.00004 ETH) | `zk-trial-sp1` |

### SP1

Measured on 2026-10-31 in the agents' container: 4 CPUs, 15.7 GiB of RAM, no swap, no GPU. The session's processes run in a memory cgroup capped at 14,341,885,952 bytes (13.36 GiB); Docker containers run outside it. The code is the kept branch `zk-trial-sp1` at commit `7573082`, and its workflow at `9d129ad`. The core is that of `main` at `cd3121d` (`RULES_VERSION` 2), whose `core/` and `vectors/` are unchanged at `4e3d1f8`.

#### Version and install

- **Version:** `~/.sp1/bin/cargo-prove prove --version` prints `cargo-prove sp1 (d83ed91 2026-10-23T15:23:03.526885682Z)`, the v6.10.0 release asset. The SDK crates are pinned to `=6.10.0` from crates.io: `sp1-sdk` (feature `blocking`), `sp1-build` and `sp1-zkvm`. Their circuit version, `SP1_CIRCUIT_VERSION`, is `v6.1.0`: it names the circuit artifacts, the gnark Docker image and the onchain verifiers below.
- **Toolchain:** `rustc +succinct --version` prints `rustc 1.96.0-dev` (LLVM 22.1.2), the value that M0.2 recorded in [`TOOLING.md`](TOOLING.md). sp1-build compiles the guest for `riscv64im-succinct-zkvm-elf`, which is RV64IM, with `panic=abort`.
- **Install command:** the direct route of [`TOOLING.md`](TOOLING.md) (zkVM toolchains, SP1), since M0.2 found that `sp1up` and `cargo prove install-toolchain` query `api.github.com`, which is refused:
  1. `https://github.com/succinctlabs/sp1/releases/download/v6.10.0/cargo_prove_v6.10.0_linux_amd64.tar.gz`, sha256 `10394a834a0ab325b3736a74d0b7087274f2c6a66e2b38f96ecf3e9ecdf9e7b5`, unpacked into `~/.sp1/bin`. The trial downloaded it again: the hash matches, and its `cargo-prove` (sha256 `b015a9bfc0114814f9a12735d6c4b13b78f2cad59e5e804160734156a3207759`) is the installed binary.
  2. `https://github.com/succinctlabs/rust/releases/download/succinct-1.96.0-64bit-v3/rust-toolchain-x86_64-unknown-linux-gnu.tar.gz`, sha256 `23905647c8ba007bed72e9207ceada06d08023f4dca73c87a122acbe7468ce07`, unpacked into `~/.sp1/toolchains/succinct-1.96.0-64bit-v3`, then `rustup toolchain link succinct ~/.sp1/toolchains/succinct-1.96.0-64bit-v3`.
  3. **New for the full SDK:** `apt-get install -y protobuf-compiler` (`libprotoc 3.21.12`). The first host build stopped in the build script of `sp1-prover-types` with ``Could not find `protoc` ``.
  4. **For the wrapping step only:** the Groth16 circuit artifacts, `https://sp1-circuits.s3-us-east-2.amazonaws.com/v6.1.0-groth16.tar.gz`: 6,211,807,514 bytes, Last-Modified 2026-04-15, sha256 of the download `18beebb6cd0cc9b4d4a240ee4f49511da6c2a7e51724bad4232de538a9147810` (SP1 publishes no hash, and the SDK checks none). Extracted, 7.9 GB, of which `groth16_pk.bin` is 5.9 GB. The SDK would keep the archive and its extraction side by side; the trial streams it into `~/.sp1/circuits/groth16/v6.1.0` and writes the `.complete` marker that the SDK looks for. The PLONK archive, `v6.1.0-plonk.tar.gz`, is 2,305,113,029 bytes and was not fetched.
  5. **For the wrapping step only:** the image `ghcr.io/succinctlabs/sp1-gnark:v6.1.0` (digest `sha256:fd3e39f4995735567932b145580c70f87552dec0181f14a6898451a7ec5fa409`, 161 MB), pulled by `dockerd` started as in [`TOOLING.md`](TOOLING.md). The pull from `ghcr.io` worked on 2026-10-31.
- **Other URLs fetched:** `index.crates.io` and `static.crates.io` (the SDK, 2.3 GB of registry sources with the other crates), `archive.ubuntu.com` (protoc), `git clone` of `github.com/succinctlabs/sp1-contracts` and `github.com/succinctlabs/sp1-project-template` with their submodules, `binaries.soliditylang.org` (solc 0.8.20 for sp1-contracts), `docs.succinct.xyz`, `explorer.succinct.xyz`, the network RPC `rpc.mainnet.succinct.xyz`, the public RPCs `arb1.arbitrum.io/rpc`, `sepolia-rollup.arbitrum.io/rpc` and `ethereum-rpc.publicnode.com`, and `api.coingecko.com`.
- **Build:** `cargo build --release --manifest-path referee/zk/Cargo.toml -p zk-host` builds the guest through `sp1-build` and then the host. The guest alone builds in 1 min 16 s (`cargo prove build` in `referee/zk/guest`). The host took 11 min in the container once the dependencies of the failed first build were compiled, and 15 min 51 s from scratch on a 2-vCPU runner. Every change to the host relinks it with the plan §3.3 release profile (fat LTO, one codegen unit): 4 min 23 s in the container. The guest ELFs are 68,696 bytes (`verify`) and 70,656 bytes (`trace`).

#### The four checks

| Check | Result | Shown by |
|---|---|---|
| Install | PASS, through direct assets and with protoc from apt | `~/.sp1/bin/cargo-prove prove --version`, `rustc +succinct --version`, then `cargo build --release --manifest-path referee/zk/Cargo.toml -p zk-host` |
| Execute | PASS: 75 of 75 vectors, with cycle counts and prover gas, on the CPU | `referee/zk/target/release/zk-host execute vectors/game vectors/levels`, run as two calls (43 and 32 vectors, 59 s and 3 min 54 s), each ending `0 failed` |
| Mock | PASS: a mock Groth16 proof round-trips in 7.84 s | `cargo test --release --manifest-path referee/zk/Cargo.toml -p zk-host` (test `a_mock_proof_round_trips_to_the_vector_outcome`) |
| Verifier | PASS: gateways and v6.1.0 verifiers on Arbitrum One and Arbitrum Sepolia, routed and not frozen; SP1's Foundry tests pass | `cast call` and `forge test`, in [Onchain verifier](#onchain-verifier) |

#### Trial code

On the kept branch `zk-trial-sp1`, which is pushed and never merged. `referee/zk/` is its own workspace, already excluded from the root one, so the main workspace and CI are untouched. Its root manifest and the guest's manifest carry the plan §3.3 profiles, and `bash scripts/check-profiles.sh` passes on that branch.

- **`guest/`**, built by sp1-build as its own workspace, with the core as a path dependency. It reads a count, then for each level the level bytes, the journal bytes and `weightBp`. Two programs:
  - `verify` replays each level with `jiro_core::replay`, and commits each Outcome as the ABI words of `(uint16 weightBp, Outcome)`: 384 bytes per level. It commits only once every level has replayed. A rejected journal makes it panic with replay's code, so it halts with a non-zero exit code and no public values (the executor checked both on the 4 rejected vectors). The v6.1.0 verifier contract reverts on a non-zero exit code (`InvalidExitCode`), so no proof of a rejected journal can verify onchain (README §7.3, "Rejections revert").
  - `trace`, test only, replays with `replay_observed` and commits, per level, replay's error code (0 when it accepts), the keccak256 of the trace of state hashes (`traceKeccak`, [`vectors/README.md`](../vectors/README.md)) and the encoded Outcome, or zeros.
- **`host/`**, the `zk-host` binary:
  - `execute <files or directories>` runs every game vector through both programs. The trace program must reproduce the vector's error code, `traceKeccak` and all eleven Outcome fields, and `weightBp`. The verify program must reproduce the Outcome, or halt with no public values on a rejected journal. It prints the cycle table between `=== BEGIN zk-exec ===` and `=== END zk-exec ===`.
  - `execute-run <six files>` executes one six-level `verifyRun` input.
  - `prove <core|compressed|plonk|groth16> <file>` proves one level with the verify program on the CPU, verifies the proof, and prints the timings and its own peak RSS.
  - `tests/mock_round_trip.rs` is the dev-mode round trip.
- **`peak-memory.sh`** samples resident memory every 0.5 s, since `/usr/bin/time` is not installed: the command's process tree and the processes of Docker containers.
- **`.github/workflows/zk-trial-sp1.yml`** runs on pushes to the branch: build, one execution, the Groth16 artifacts, then the Groth16 proof of a small vector, with a memory sampler.

#### Executor: cycles per vector

`zk-host execute` reproduced the Outcome, or the error code, and `traceKeccak` of all 75 game vectors: 43 in `vectors/game/` and 32 in `vectors/levels/`. Cycles are the verify program's executed instructions (`ExecutionReport::total_instruction_count`). Prover gas is the executor's `ExecutionReport::gas()`, in prover gas units (PGU), the unit the prover network bills. Trace-guest cycles include a state hash per tick and are test-only.

- **Fixed cost:** about 0.83 million cycles before the first tick (a journal rejected for its level id: 829,034), and 57,193 when the level bytes are rejected first.
- **Per level:** the heaviest gate-set level is `10-worst`, at 31,227,278 cycles and 27,203,307 PGU. `worst-case` takes 28,816,801 cycles and 25,218,367 PGU. The 32 gate-set vectors average 16,148,337 cycles and 14,180,936 PGU.
- **Six-level run:** `zk-host execute-run` on the heaviest vector of each of the six heaviest levels (`10-worst`, `16-worst`, `04-worst`, `08-worst`, `03-worst`, `14-synthetic`) took 136,915,482 cycles and 119,502,086 PGU, and reproduced the six Outcomes.
- **Keccak:** the guest uses the core's software keccak (tiny-keccak 2.0.2). SP1's patched tiny-keccak, which uses its keccak precompile, was not tried.

##### `vectors/game/`

| Vector | Ticks used or error | Cycles | Prover gas (PGU) | Trace-guest cycles |
|---|---:|---:|---:|---:|
| `boss-bumps-trail` | 57 | 1,019,747 | 990,757 | 6,605,279 |
| `boss-corridor-b2` | 400 | 905,707 | 876,349 | 38,416,312 |
| `boss-corridor-b8` | 400 | 1,014,682 | 973,054 | 38,552,377 |
| `capture-around-obstacle` | 17 | 1,548,758 | 1,453,175 | 3,431,276 |
| `capture-edge-rectangle` | 17 | 1,549,316 | 1,453,688 | 3,432,036 |
| `capture-l-shape` | 36 | 1,537,979 | 1,443,673 | 5,190,297 |
| `capture-split-boss-left` | 60 | 1,310,448 | 1,242,696 | 7,190,976 |
| `capture-split-boss-right` | 60 | 1,288,742 | 1,222,954 | 7,166,948 |
| `clear-and-last-life` | 9 | 1,538,583 | 1,444,579 | 2,666,583 |
| `clear-the-level` | 61 | 1,539,718 | 1,446,750 | 7,518,739 |
| `commit-at-tick-0` | 1 | 977,049 | 953,696 | 1,326,653 |
| `commit-during-cut` | 6 | 976,113 | 952,872 | 1,791,510 |
| `event-at-last-tick` | 20 | 964,849 | 943,268 | 3,078,609 |
| `fast-cut-close-first-sub-step` | 10 | 1,550,602 | 1,454,782 | 2,777,285 |
| `fast-cut` | 7 | 977,007 | 953,735 | 1,884,186 |
| `full-journal` | 2,700 | 3,021,987 | 2,799,772 | 255,314,514 |
| `last-life-on-last-tick` | 10 | 978,761 | 954,986 | 2,168,522 |
| `minion-stranded-respawns` | 58 | 1,558,113 | 1,461,110 | 7,263,448 |
| `open-field-capture` | 162 | 3,838,894 | 3,455,767 | 19,408,379 |
| `open-field-empty` | 2,700 | 1,881,954 | 1,724,201 | 254,120,486 |
| `random-all-1` | 617 | 2,387,313 | 2,180,031 | 60,328,079 |
| `random-all-2` | 651 | 3,851,557 | 3,453,301 | 65,087,200 |
| `random-all-3` | 1,425 | 5,431,905 | 4,836,786 | 138,948,409 |
| `random-all-4` | 907 | 3,597,776 | 3,219,096 | 88,751,535 |
| `random-dirs-1` | 572 | 2,077,458 | 1,910,855 | 55,787,824 |
| `random-dirs-2` | 717 | 3,847,752 | 3,445,548 | 71,238,939 |
| `random-dirs-3` | 1,430 | 3,663,524 | 3,299,995 | 137,531,305 |
| `random-dirs-4` | 1,166 | 7,674,958 | 6,764,053 | 117,285,801 |
| `rejected-event-after-end` | error 14 | 846,844 | 842,627 | 1,272,758 |
| `rejected-event-at-time-limit` | error 13 | 829,299 | 827,643 | 1,154,394 |
| `rejected-level-before-its-id` | error 33 | 57,193 | 59,925 | 163,738 |
| `rejected-level-id` | error 12 | 829,034 | 827,427 | 1,154,140 |
| `respawn-after-bottom-captured` | 166 | 2,157,697 | 1,984,525 | 17,987,628 |
| `several-hits-one-life` | 11 | 985,949 | 960,543 | 2,272,930 |
| `several-hits-while-invulnerable` | 11 | 986,079 | 960,709 | 2,273,085 |
| `several-hits-with-shield` | 11 | 971,539 | 948,358 | 2,251,321 |
| `shield-absorbs-a-hit` | 13 | 979,936 | 956,019 | 2,451,643 |
| `slow-shield` | 11 | 977,358 | 953,927 | 2,258,737 |
| `step-onto-boss-from-below` | 19 | 990,659 | 965,017 | 3,026,011 |
| `step-onto-boss-from-right` | 19 | 990,584 | 964,960 | 3,025,951 |
| `stranded-off-rail` | 109 | 1,591,775 | 1,490,424 | 12,054,858 |
| `swap-collision` | 11 | 993,598 | 967,582 | 2,282,362 |
| `worst-case` | 2,700 | 28,816,801 | 25,218,367 | 283,122,799 |

##### `vectors/levels/`

| Vector | Ticks used or error | Cycles | Prover gas (PGU) | Trace-guest cycles |
|---|---:|---:|---:|---:|
| `01-synthetic` | 2,458 | 17,675,433 | 15,575,321 | 248,408,143 |
| `01-worst` | 2,700 | 18,133,585 | 15,971,675 | 271,465,466 |
| `02-synthetic` | 2,458 | 18,101,762 | 15,931,927 | 248,890,401 |
| `02-worst` | 2,700 | 18,553,542 | 16,324,693 | 271,944,193 |
| `03-synthetic` | 2,520 | 18,559,767 | 16,354,203 | 255,161,741 |
| `03-worst` | 2,700 | 19,076,933 | 16,795,111 | 272,509,271 |
| `04-synthetic` | 2,415 | 17,606,997 | 15,472,325 | 244,406,313 |
| `04-worst` | 2,700 | 21,771,424 | 19,077,850 | 275,380,062 |
| `05-synthetic` | 1,328 | 14,824,480 | 13,041,708 | 139,975,792 |
| `05-worst` | 2,700 | 4,316,286 | 3,858,368 | 256,824,941 |
| `06-synthetic` | 1,335 | 17,323,343 | 15,225,766 | 143,294,693 |
| `06-worst` | 2,700 | 4,856,157 | 4,333,318 | 257,407,933 |
| `07-synthetic` | 2,080 | 15,613,059 | 13,735,382 | 211,027,805 |
| `07-worst` | 2,700 | 16,939,851 | 14,871,562 | 270,288,015 |
| `08-synthetic` | 2,204 | 15,009,511 | 13,194,163 | 221,929,650 |
| `08-worst` | 2,700 | 21,158,507 | 18,504,637 | 274,775,058 |
| `09-synthetic` | 1,238 | 16,096,488 | 14,149,337 | 132,919,218 |
| `09-worst` | 2,700 | 5,606,048 | 4,991,971 | 258,217,660 |
| `10-synthetic` | 1,456 | 17,036,984 | 14,918,214 | 154,245,494 |
| `10-worst` | 2,700 | 31,227,278 | 27,203,307 | 285,607,795 |
| `11-synthetic` | 1,233 | 15,981,921 | 14,028,029 | 132,357,199 |
| `11-worst` | 2,700 | 8,053,881 | 7,080,816 | 260,841,415 |
| `12-synthetic` | 1,597 | 15,617,766 | 13,704,075 | 165,932,636 |
| `12-worst` | 2,700 | 6,766,223 | 5,957,447 | 259,461,902 |
| `13-synthetic` | 1,604 | 14,877,173 | 13,073,352 | 165,804,084 |
| `13-worst` | 2,221 | 15,506,077 | 13,601,632 | 224,086,301 |
| `14-synthetic` | 1,740 | 19,029,340 | 16,708,692 | 182,910,119 |
| `14-worst` | 2,700 | 17,713,112 | 15,547,316 | 271,084,216 |
| `15-synthetic` | 1,496 | 15,645,433 | 13,739,870 | 156,531,503 |
| `15-worst` | 2,700 | 18,302,896 | 16,016,321 | 271,734,464 |
| `16-synthetic` | 1,607 | 15,085,304 | 13,249,789 | 166,274,727 |
| `16-worst` | 2,700 | 24,680,236 | 21,551,784 | 278,566,155 |

#### Proving on the CPU

`bash referee/zk/peak-memory.sh referee/zk/target/release/zk-host prove <mode> vectors/game/commit-at-tick-0.json`, the smallest accepted vector (977,049 cycles):

| Mode | Result | Setup | Prove | Peak memory |
|---|---|---|---|---|
| core | PASS, verified; 2,791,471-byte proof, not onchain-verifiable | 7.1 s | 92.1 s (172.6 s for the whole process) | 12,128,672 kB VmHWM (11.6 GiB) |
| compressed | FAIL: killed by the memory cgroup after 229.8 s | | | 13,769,012 kB anon RSS when killed (`dmesg`: `Memory cgroup out of memory: Killed process 7079 (zk-host)`) |
| compressed, one worker per stage (`SP1_WORKER_NUM_*_WORKERS=1`, buffers 1) | FAIL: killed by the memory cgroup after 218.2 s | | | 13,810,392 kB anon RSS when killed |

The program's verifying key hash is `0x0029a2e92eff5078355a839e50e7b98fb75f9aa072503d2946513fbcf9ebf9ff`. SP1's [hardware requirements](https://docs.succinct.xyz/docs/sp1/getting-started/hardware-requirements) ask for 16 GB or more for core and compressed proofs, whatever the program's size: memory did not shrink with one worker per stage.

#### Wrapping

The onchain-verifiable proof wraps the compressed proof into Groth16 or PLONK. By default SP1 runs that last step in Docker, with `ghcr.io/succinctlabs/sp1-gnark:v6.1.0`; the SDK's `native-gnark` feature links gnark through Go instead, and was not tried. SP1's hardware page gives about 14 GB for the Groth16 step and 60 GB for PLONK, so only Groth16 was tried.

- **In the container: FAIL.** Docker works here: the image pulls from `ghcr.io` and runs.
  - `zk-host prove groth16` cannot get there, since the compressed proof before it runs out of memory (above).
  - The gnark step alone, on the sample witness that ships with the artifacts, capped at the session's 13.36 GiB, was killed after 92.7 s, once it had read the R1CS (55.8 s): `docker run --rm --memory 14341885952 --memory-swap 14341885952 -v ~/.sp1/circuits/groth16/v6.1.0:/circuit -v ~/.sp1/circuits/groth16/v6.1.0/groth16_witness.json:/witness -v <file>:/output ghcr.io/succinctlabs/sp1-gnark:v6.1.0 prove --system groth16 /circuit /witness /output`. `dmesg`: `Killed process 10594 (gnark-cli) total-vm:16474136kB, anon-rss:13977164kB`. The container's cgroup peak was the cap, 14,341,885,952 bytes. The cap was the trial's choice, to protect the other sessions on the machine; SP1 sets none, and an uncapped run on this 15.7 GiB machine was not tried.
- **On Actions: FAIL.** [Run 41200644739](https://github.com/detychey/jiro-ikusu/actions/runs/41200644739) and [run 41202821606](https://github.com/detychey/jiro-ikusu/actions/runs/41202821606), on `ubuntu-24.04` (image 20261025.353.1): 2 vCPUs, 7,932 MiB of RAM and 3,071 MiB of swap. The host built, executed `commit-at-tick-0` (PASS) and installed the artifacts, then `zk-host prove groth16 vectors/game/commit-at-tick-0.json` ended with `The runner has received a shutdown signal`, after 326 s and 198 s. In the second run, the sampler's last line, 8 s before the shutdown, read `used 7701 MiB, swap used 2821 MiB`, up from 890 MiB at the start: the runner ran out of memory during the STARK proving, most likely before the Docker step. The two runs took 24.6 and 17.3 minutes (25 and 18 billed minutes, rounded per job).
- **Docker:** needed by default, for the gnark step only. The core and compressed proofs run in the host process.

#### Onchain verifier

- **Gateways,** which route a proof to the verifier its first four bytes name. The same address on Arbitrum One (42161) and Arbitrum Sepolia (421614), from SP1's [contract addresses](https://docs.succinct.xyz/docs/sp1/verification/contract-addresses) page and [`sp1-contracts`](https://github.com/succinctlabs/sp1-contracts) `contracts/deployments/42161.json` and `421614.json` at commit `d3629729`:
  - Groth16: `0x397A5f7f3dBd538f23DE225B51f532c34448dA9B`
  - PLONK: `0x3B6041173B80E77f038f3F2C0f9744f04837185e`
- **v6.1.0 verifiers,** the circuit version of v6.10.0: Groth16 `0xb69f2584CBcFf99a58C4e7002E8b89Af54a6f4e2`, PLONK `0xc3c6dDDAc8829b233Dc6536Ec024775a57b0AF2A`. On both chains, on 2026-10-31:
  - `cast call 0x397A5f7f3dBd538f23DE225B51f532c34448dA9B "routes(bytes4)(address,bool)" 0x4388a21c --rpc-url <rpc>` returns the Groth16 verifier and `false` (not frozen), with `--rpc-url https://arb1.arbitrum.io/rpc` and `https://sepolia-rollup.arbitrum.io/rpc`;
  - `cast call 0x3B6041173B80E77f038f3F2C0f9744f04837185e "routes(bytes4)(address,bool)" 0x5a093a2f --rpc-url <rpc>` returns the PLONK verifier and `false`;
  - `VERSION()` returns `"v6.1.0"` on both verifiers.
- **Foundry tests,** with forge 1.8.6 in the container:
  - SP1's mock-verifier test, in [`sp1-project-template`](https://github.com/succinctlabs/sp1-project-template) at commit `d1b09245` (`contracts/test/Fibonacci.t.sol`, which mocks the gateway with `vm.mockCall`): `cd contracts && forge test -vv`, 4 tests passed, 0 failed.
  - `sp1-contracts` at `d3629729`: `cd contracts && forge test`, 18 tests passed, 0 failed, among them the gateway's 12 and `test_VerifyProof_V6` on real v6.0.0 fixtures, at 234,718 gas for Groth16 and 291,639 for PLONK.
  - `sp1-contracts` also ships `SP1MockVerifier`, which accepts an empty proof: the mock proofs of the SDK have empty onchain bytes.

#### Prover network

The Succinct Prover Network sells proofs by auction; its docs are [here](https://docs.succinct.xyz/docs/sp1/prover-network/intro). Read on 2026-10-31.

- **Chain and token:** it bills in PROVE, an ERC-20 on Ethereum mainnet (`0x6BEF15D938d4E72056AC92Ea4bDD0D76B1C4ad29`, 18 decimals). A requester deposits PROVE into the `SuccinctVApp` contract on Ethereum mainnet, `0x5Ad5Bc4B18f7c173DcE17A57682Cb0Dc8788951F` ([smart contracts](https://docs.succinct.xyz/docs/protocol/spn/smart-contracts), [payments](https://docs.succinct.xyz/docs/protocol/prove/pay)), and requests proofs with a secp256k1 requester key (`NETWORK_PRIVATE_KEY`, and the SDK's `network` feature).
- **Minimum deposit:** 0.01 PROVE. `cast call 0x5Ad5Bc4B18f7c173DcE17A57682Cb0Dc8788951F "minDepositAmount()(uint256)" --rpc-url https://ethereum-rpc.publicnode.com` returned `10000000000000000` at Ethereum block 26,312,550, as the [protocol parameters](https://docs.succinct.xyz/docs/protocol/spn/parameters) page says.
- **Price:** a base fee per proof, by mode, plus PGU × the price per PGU ([FAQ](https://docs.succinct.xyz/docs/sp1/prover-network/faq), "How am I charged for proofs?"). Both float with the market, so these are a snapshot. Read on 2026-10-31 at 11:48 UTC from the network's public RPC, `https://rpc.mainnet.succinct.xyz`, without a key:
  - `network.ProverNetwork/GetMarketPricePerPgu`: 581,395,348 PROVE-wei per PGU (0.581 PROVE per billion PGU), as of 11:30 UTC;
  - `network.ProverNetwork/GetProofRequestParams`: base fee 0.242248 PROVE for a compressed proof and 0.363372 PROVE for Groth16 or PLONK; a default maximum price of 580,000,000 PROVE-wei per PGU, to which SDK v6.10.0 adds 20%; a network floor of 200,000,000.
  - The explorer's front page listed 20 requests, made from 2026-10-23 to 2026-10-28, with base fees of 0.386 to 0.406 PROVE.
  - The network refuses core proofs: the cheapest request is a compressed proof.
- **Expected cost,** at that market price, with PROVE at $0.207562 and ETH at $2,247.18 (CoinGecko, 2026-10-31 11:49 UTC):

  | Proof | PGU | Groth16 | Compressed |
  |---|---:|---|---|
  | One level, the smallest (`commit-at-tick-0`) | 953,696 | 0.3639 PROVE ($0.076) | 0.2428 PROVE ($0.050) |
  | One level, the heaviest (`10-worst`) | 27,203,307 | 0.3792 PROVE ($0.079) | 0.2581 PROVE ($0.054) |
  | One six-level run, the heaviest six levels | 119,502,086 | 0.4329 PROVE ($0.090, 0.0000400 ETH) | 0.3117 PROVE ($0.065) |

  The base fee is 84% of the run proof's price. A Groth16 run proof costs about 80% of the 0.00005 ETH run fee ($0.112).

#### Findings for M1.12

- **All four checks pass.** The executor reproduces every vector, the mock round trip takes 8 s, and the verifiers are live on both Arbitrum chains.
- **No real proof here.** In this container, an SP1 compressed proof, and so any onchain-verifiable proof, does not fit in the session's 13.36 GiB, nor in a 2-vCPU, 7.7 GiB runner. Real proofs need the prover network (a mainnet PROVE account), a public repository's 16 GB runners (below SP1's stated need once the Groth16 step runs alongside), or a machine with 32 GB or more. This is M1.12's question for the user.
- **zk tier.** The bootstrap needs `protobuf-compiler`, and the circuit artifacts need 7.9 GB of disk. The zk-exec job of M1.12 needs a build cache: a clean build of the host takes about 16 minutes on a 2-vCPU runner, and `ci.yml`'s `rust` job has a 25-minute budget.
- **TOOLING.md** says that Docker pulls from `ghcr.io` did not work; on 2026-10-31 the gnark image pulled from `ghcr.io`.

## Challenge gas

M4.6 measured the gas of each step of a Challenge run (README §7.2) with forge 1.8.6, solc 0.8.28, the optimizer at 200 runs and `evmVersion` shanghai:

```bash
cd contracts && forge test --match-contract ChallengeGas -vv
```

Foundry meters a call from a test as a transaction: its gas includes the 21,000 base and the calldata's EIP-2028 gas, as anvil 1.8.6's receipts of the same calls confirm, to the unit. Neither includes Arbitrum's L1 data fee, which is charged on top, as extra gas, from the L1 price at the time.

| Step | Calldata | Gas |
|---|---:|---:|
| `startRun` | 36 B | 131,898; on anvil, 166,098 for the contract's first run, which writes the run counter and the season's fee total from zero |
| `revealRun` | 36 B | 63,284 |
| `commitRun`, typical blob: 6 journals of 32 events, 167 B each | 1,604 B | 99,049, of which 17,120 calldata gas |
| `commitRun`, full blob: 6 journals of 2,700 events, 8,171 B each | 49,604 B | 864,069, of which 767,756 calldata gas; 1,940,390 under EIP-7623's calldata floor |

- **Typical blob.** 32 events per level is the bots' mean median of 439 ticks per level ([`reports/playtest-449f231636aa.json`](../reports/playtest-449f231636aa.json)) at the 0.073 events per tick of the user's two play-test journals ([`reports/playtest-human-1.md`](../reports/playtest-human-1.md)).
- **The calldata floor.** EIP-7623 charges at least 21,000 + 10 gas per calldata token (a zero byte is 1 token, any other byte 4). Anvil 1.8.6 applies it to the full blob under every hardfork tried (shanghai, cancun and prague): 21,000 + 10 × 191,939 = 1,940,390. Foundry's test EVM does not. Whether Arbitrum's ArbOS charges the floor is not verified here; M4.16 measures the commit on nitro-devnode.
- **`commitSlackOf`.** `commitRun` reads the season's `commitSlack` through `Season.commitSlackOf`. Reading it through `paramsOf`, which copies all the season's parameters, cost 153,571 gas on the typical blob, 54,522 more.

## Settlement gas

M4.7 measured settlement (README §7.2) at commit 0fee0a072b52204a7c1a53984b8ef83d11d56f15, with forge 1.8.6, solc 0.8.28, the optimizer at 200 runs and `evmVersion` shanghai, as [Challenge gas](#challenge-gas) measures the other steps:

```bash
cd contracts && forge test --match-contract SettlementGas -vvvv
```

The run is the one of `SettlementTest`: the calibration season (`seasons/calibration-1.json`), and six levels that replay the gate-set vectors `05-synthetic`, `13-worst`, `10-synthetic`, `08-worst`, `01-synthetic` and `16-worst` of `vectors/levels/`, with journals of 4,055, 3,296, 4,439, 1,250, 7,445 and 1,262 bytes. MockReferee returns their Outcomes. Its own frame, read from the trace, is the part that a real referee replaces, so the settlement gas excluding the referee is the transaction's gas minus that frame.

| Call | Calldata | Gas | MockReferee frame | Excluding the referee | of which calldata gas | of which `Season.recordRun` |
|---|---:|---:|---:|---:|---:|---:|
| `settleRun` | 25,636 B | 666,564 | 89,961 (`verifyRun`) | 576,603 | 353,908 | 75,319 |
| `settleLevel`, level 0 of an unsettled run | 4,996 B | 169,477 | 15,427 (`verify`) | 154,050 | 70,600 | none |
| `settleLevel`, level 5, which records the run | 2,212 B | 187,250 | 14,345 (`verify`) | 172,905 | 25,528 | 75,319 |

- **What remains,** without the 21,000 base, the calldata and the referee: 201,695 gas for `settleRun`, 62,450 and 126,377 for the two `settleLevel` calls. It covers hashing the journals and the levels, `Season`'s slot and weight of each level, the Outcome checks, the deadline, the settlement record and `recordRun`'s best-run update. A player's first settled run of the season writes its best run from zero; a run that does not rank above the player's best skips that write.
- **Calldata dominates.** Each level adds its 472 level bytes and its journal. Under EIP-7623's calldata floor ([Challenge gas](#challenge-gas)), `settleRun` would cost at least 21,000 + 10 × 88,477 tokens = 905,770 gas. As for `commitRun`, M4.16 measures what ArbOS charges, and Arbitrum's L1 data fee comes on top.
- **Not cross-checked on anvil.** M4.6 matched Foundry's metering against anvil's receipts for `startRun`, `revealRun` and `commitRun`; M4.7 did not repeat that check for settlement.
- **The other steps moved.** With settlement in `Challenge`, `forge test --match-contract ChallengeGas -vv` now gives `startRun` 131,976, `revealRun` 63,294, and `commitRun` 99,113 (typical blob) and 864,133 (full blob): 10 to 78 gas more than the table above, from the longer function dispatch.

## Run file v1

The run file carries everything needed to replay, prove and settle one committed Challenge run, without reading the commit transaction: what the dApp hands to a prover (M4.10), shows and exports (M5.2), and what the season job settles from (M5.5). It is a JSON object:

| Field | JSON type | Content |
|---|---|---|
| `version` | number | 1, the run file format version |
| `chainId` | number | the chain of `Challenge`, such as 421614 for Arbitrum Sepolia |
| `challenge` | string | the `Challenge` address, 20 bytes in hex |
| `runId` | string | the run's `uint256` id, in decimal: a run id may exceed JSON's exact integers |
| `runNonce` | string | the run nonce that `revealRun` recorded (README §6.4), 32 bytes in hex |
| `levels` | array of 6 strings | the six level bytes (README §5) in `levelIndex` order, in hex |
| `drawSlots` | array of 6 numbers | the six draw slots of the run nonce (README §8.2): `drawSlots[i]` is the season slot of `levels[i]` |
| `journals` | array of 6 strings | the six committed journals (README §6.3) in `levelIndex` order, in hex |

Byte strings are lowercase hex with a `0x` prefix, as in `vectors/`.

```json
{
  "version": 1,
  "chainId": 421614,
  "challenge": "0x…",
  "runId": "1",
  "runNonce": "0x…",
  "levels": ["0x01…", "0x01…", "0x01…", "0x01…", "0x01…", "0x01…"],
  "drawSlots": [1, 0, 10, 14, 12, 2],
  "journals": ["0x0100020100…", "0x0100020100…", "0x0100020100…", "0x0100020100…", "0x0100020100…", "0x0100020100…"]
}
```

- **Level bytes, not level ids.** The file holds the levels themselves, so it replays and proves with nothing else; each level id is keccak256 of its bytes. The season's 16 level ids are onchain, so a reader can check `keccak256(levels[i])` against `levelIds[drawSlots[i]]` of the run's season without running the draw.
- **What a reader checks** before it proves or settles, all against the chain named by `chainId` and `challenge`: `runs(runId)` holds this `runNonce` and the commitment keccak256(keccak256(`journals[0]`) ‖ … ‖ keccak256(`journals[5]`)) (README §6.4), and each `keccak256(levels[i])` is the season's level id in `drawSlots[i]`. The rest is checked at settlement, from the Outcomes of the replay: each journal's header carries this `runNonce`, `levelIndex` i, the level's id and mode 1, and each Outcome's draw slot equals `drawSlots[i]` (P17).
- **Settling from it.** `settleRun(runId, levels, journals, proof)`, or `settleLevel(runId, i, [keccak256 of each journal], levels[i], journals[i], proof)` level by level. The file carries no proof: on Stylus there is none, and on zk the prover produces it from the file.
- **Not in the file:** the season, which `runs(runId)` gives, and the weights, which the season gives. A score in the file would be trusted by nothing (README §6.4), so there is none.
