# Verification

## Stylus activation

[`scripts/contracts/activation.mjs`](../scripts/contracts/activation.mjs) reads `ArbWasm.activationGas()` from the precompile at `0x0000000000000000000000000000000000000071`, at the chain's latest block. New Stylus activations count as open at or below 30,000,000, cargo-stylus 0.10.10's threshold, as ethblockdigger's `scripts/contracts/checks.ts` checks: the chain owner pauses them by raising `activationGas` above it (README §7.3). M4.9, M4.10 and M4.16 reuse it.

| Network | chainId | Block | Date (UTC) | `activationGas` | Activations |
|---|---|---|---|---|---|
| Arbitrum Sepolia | 421614 | 324,664,851 | 2026-10-31 12:23:24 | 18,446,744,073,709,551,615 (2^64 − 1) | paused |
| Arbitrum One | 42161 | 519,986,698 | 2026-10-31 12:23:25 | 18,446,744,073,709,551,615 (2^64 − 1) | paused |
| Arbitrum Sepolia | 421614 | 325,258,195 | 2026-11-02 08:18:56 | 18,446,744,073,709,551,615 (2^64 − 1) | paused |
| Arbitrum One | 42161 | 520,513,231 | 2026-11-02 08:18:57 | 18,446,744,073,709,551,615 (2^64 − 1) | paused |

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

- **M4.9's readings,** the same commands with `activation.mjs` at `d2e71cc765d5f74da974953ed38d0e028d8c2906`, Node v22.22.0 and ethers 6.17.0, which decided D2 ([D2: the backend](#d2-the-backend)):

  ```text
  chainId 421614, block 325258195 (2026-11-02T08:18:56.000Z): activationGas 18446744073709551615, above 30000000: activations paused
  chainId 42161, block 520513231 (2026-11-02T08:18:57.000Z): activationGas 18446744073709551615, above 30000000: activations paused
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

Trial records of the zkVM frameworks for the zk path of `IReferee` (README §7.3). Each framework gets one row in the summary and one section below, with the same fields in the same order. M1.16 measured SP1 and M1.17 RISC Zero, in the same shape, and [SP1 and RISC Zero side by side](#sp1-and-risc-zero-side-by-side) sets their facts next to each other. M1.12 then compared the frameworks that pass the four tooling checks, on cycles and price, and recorded the choice, RISC Zero, in README §13 D2: [M1.12: the choice](#m112-the-choice).

The four tooling checks of README §7.3:

1. **Install:** it installs and runs in the agent's cloud environment.
2. **Execute:** it executes guests locally, with cycle counts and without a GPU.
3. **Mock:** it has a fast mock or dev mode for tests.
4. **Verifier:** it has a verifier contract on Arbitrum, with Foundry test support.

### Summary

| Framework | Version | Install | Execute | Mock | Verifier | Vectors reproduced | Cycles, heaviest level | CPU proof of a small level | Onchain-verifiable wrapping | Prover network, Groth16 proof of a six-level run | Kept branch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SP1 | v6.10.0 (circuits v6.1.0) | PASS | PASS | PASS | PASS | 75 of 75 | 31,227,278 (`10-worst`) | core: 92 s, 11.6 GiB; compressed: out of memory at 13.4 GiB | FAIL: out of memory in the container and on Actions | 0.433 PROVE (about 0.00004 ETH) | `zk-trial-sp1` |
| RISC Zero | 3.0.6 (Groth16 verifier 3.0.0) | PASS | PASS | PASS | PASS | 75 of 75 | 29,588,717 user, 30,932,992 proving (`10-worst`) | composite: 965 s, 9.2 GiB (832 s, 4.6 GiB with 2^19 segments) | PASS in the container (verified on Arbitrum One and Sepolia); PASS on Actions | Boundless: raw Groth16 not priced; market average about 0.000011 ETH ($0.024), mostly aggregated proofs | `zk-trial-risc0` |

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

### RISC Zero

Measured on 2026-11-01 in the same container as SP1: 4 CPUs, 15.7 GiB of RAM, no swap, no GPU, and the same 13.36 GiB memory cgroup, which also holds `dockerd`. Another session's play test kept about two of the four CPUs busy throughout, so the build and proving times below are slower than an idle machine's. The code is the kept branch `zk-trial-risc0` at commit `c7623f5`, and its workflow at `4088230`. The core is that of `main` at `a992075` (`RULES_VERSION` 2), whose `core/`, `vectors/game/` and `vectors/levels/` are unchanged since `cd3121d`, the base of SP1's trial.

#### Version and install

- **Version:** the crates `risc0-zkvm` and `risc0-build` pinned to `=3.0.6`, the newest release on crates.io on 2026-11-01 (`3.1.0-rc.1` and `5.0.0-rc.1` are release candidates). They resolve to the `risc0-circuit-rv32im` and `risc0-circuit-recursion` 4.0.5 circuits, `risc0-groth16` 3.0.5 and the `rzup` 0.5.2 library. The host enables `risc0-zkvm`'s `prove` feature, the in-process CPU prover; the guest uses `default-features = false, features = ["std"]`.
- **Toolchain:** `~/.risc0/toolchains/v1.97.0-rust-x86_64-unknown-linux-gnu/bin/rustc --version` prints `rustc 1.97.0-dev (e638c6cfe 2026-07-15)` (LLVM 22.1.6), the value that M0.2 recorded in [`TOOLING.md`](TOOLING.md). risc0-build 3.0.6 compiles the guest locally with that toolchain, which it finds through `~/.risc0/settings.toml` (its build output reads `Using Rust toolchain version 1.97.0`), for `riscv32im-risc0-zkvm-elf`, which is RV32IM. It did not use Docker, so the `r0.1.88.0` Docker caveat of [`TOOLING.md`](TOOLING.md) does not arise and the core's `rust-version = "1.96"` builds.
- **Install command:** the direct route of [`TOOLING.md`](TOOLING.md) (zkVM toolchains, RISC Zero), already in place from M0.2; rzup itself is not needed, since risc0-build reads rzup's settings as a library:
  1. `https://github.com/risc0/rust/releases/download/r0.1.97.0/rust-toolchain-x86_64-unknown-linux-gnu.tar.gz`, sha256 `100b597d605b706bec94e1d32bfaaf5851df8d75173f986d4b56a3e90916be53`, unpacked into `~/.risc0/toolchains/v1.97.0-rust-x86_64-unknown-linux-gnu`; then `~/.risc0/settings.toml` holding `[default_versions]` and `rust = "1.97.0"`. The Actions workflow does exactly this, and the run's toolchain step passed in 21 s.
  2. M0.2's `~/.risc0/bin/rzup` (0.6.0, sha256 `2cbb8081730ca42acac6818a279c7f218878b571a7f9ff76970f60688f54ddf5`) was not run.
  3. A C++ compiler: the `prove` feature compiles RISC Zero's circuit kernels with the system `g++` (13.3.0 here, preinstalled on the runner). No apt package was added; protoc is not needed.
  4. **For the wrapping step only:** the image `risczero/risc0-groth16-prover:v2025-04-03.1`, the tag that `risc0-groth16` 3.0.5 runs, on Docker Hub only: manifest list `sha256:a4f80ce2e0b8e2bb7637a93c37136a6776ac00ec843a3fdf1c67b1d5ffea64ee`, linux/amd64 manifest `sha256:7f173963196570b7a71816ed70565a4579264c5d2e3e0ecb028102538ad0e331`, 2,399,158,367 bytes of layers, 5.2 GB once loaded. `docker pull` failed twice: through the `mirror.gcr.io` mirror (`not found`), then from `registry-1.docker.io` (`429 Too Many Requests`). The trial fetched the manifest and the nine blobs with `curl` from `registry-1.docker.io` with an anonymous token (1 min 37 s), checked each blob's sha256 against its digest, and loaded them with `docker load`.
- **Other URLs fetched:** `index.crates.io` and `static.crates.io` (453 crates for the host), `git clone` of `github.com/risc0/risc0-ethereum` (tag `v3.0.1`, with its submodules) and `github.com/risc0/risc0-foundry-template`, `binaries.soliditylang.org` (solc 0.8.26), `auth.docker.io` and `registry-1.docker.io`, `dev.risczero.com`, `docs.boundless.network`, `raw.githubusercontent.com` (`BoundlessMarket.sol`), the Boundless indexer `d2mdvlnmyov1e1.cloudfront.net`, the public RPCs `arb1.arbitrum.io/rpc`, `sepolia-rollup.arbitrum.io/rpc` and `mainnet.base.org`, and `api.coingecko.com`.
- **Build:** `cargo build --release --manifest-path referee/zk/Cargo.toml -p zk-host` builds the guest through risc0-build, then the host. The host took about 64 minutes over two attempts (the first stopped by a 10-minute limit of the trial's own, the second 54 min 13 s), with `-j 3` on the shared CPUs, almost all of it `g++` on the circuit kernels of `risc0-sys`, `risc0-circuit-rv32im-sys` and `risc0-circuit-keccak-sys`. Relinking the host after a change takes 1 min 51 s. On a 2-vCPU runner, the clean build took 62 min 35 s. The guest ELFs are 128,836 bytes (`verify`) and 131,840 bytes (`trace`), and 161,260 and 164,264 bytes as the binaries risc0-build embeds, with RISC Zero's kernel.

#### The four checks

| Check | Result | Shown by |
|---|---|---|
| Install | PASS, through the direct toolchain asset; the Groth16 image only through `curl` and `docker load` | `rustc +risc0 --version`, then `cargo build --release --manifest-path referee/zk/Cargo.toml -p zk-host` |
| Execute | PASS: 75 of 75 vectors, with cycle counts, on the CPU | `referee/zk/target/release/zk-host execute vectors/game vectors/levels`, one call, 4 min 16 s, ending `75 vectors, 0 failed` |
| Mock | PASS: a dev-mode Groth16 receipt round-trips in 0.17 s | `cargo test --release --manifest-path referee/zk/Cargo.toml -p zk-host` (test `a_dev_mode_receipt_round_trips_to_the_vector_outcome`) |
| Verifier | PASS: the verifier router on Arbitrum One and Arbitrum Sepolia routes the 3.0 Groth16 verifier, not stopped; RISC Zero's Foundry tests pass, its mock verifier among them | `cast call` and `forge test`, in [Onchain verifier](#onchain-verifier-1) |

#### Trial code

On the kept branch `zk-trial-risc0`, which is pushed and never merged, in the layout of `zk-trial-sp1`. `referee/zk/` is its own workspace, excluded from the root one. Its root manifest and the guest's manifest carry the plan §3.3 profiles, and `bash scripts/check-profiles.sh` passes on that branch.

- **`guest/`**, built by risc0-build (the host's `[package.metadata.risc0] methods = ["../guest"]`) as its own workspace, with the core as a path dependency. It reads a count, then for each level the level bytes, the journal bytes and `weightBp`, as raw words through `env::read_slice` rather than the serde codec, which spends a 32-bit word per byte. Two programs:
  - `verify` replays each level with `jiro_core::replay`, and commits each Outcome as the ABI words of `(uint16 weightBp, Outcome)`: 384 bytes per level. It commits only once every level has replayed. A rejected journal makes it panic with replay's code, so the session ends with an error and no receipt: the executor reported `replay rejects: code N` for each of the 4 rejected vectors. Even a halt with a non-zero exit code would not verify onchain, since the verifier checks a claim with exit code `Halted(0)` (README §7.3, "Rejections revert").
  - `trace`, test only, replays with `replay_observed` and commits, per level, replay's error code (0 when it accepts), `traceKeccak` ([`vectors/README.md`](../vectors/README.md)) and the encoded Outcome, or zeros.
- **`host/`**, the `zk-host` binary:
  - `execute <files or directories>` runs every game vector through both programs, with the same checks as SP1's host, and prints the cycle table between `=== BEGIN zk-exec ===` and `=== END zk-exec ===`.
  - `execute-run <six files>` executes one six-level `verifyRun` input.
  - `prove <composite|succinct|groth16> <file> [segment po2]` proves one level with the verify program on the CPU, verifies the receipt against the image id, and prints the timings, the cycle statistics and its own peak RSS. Groth16 runs the Docker image above.
  - `tests/mock_round_trip.rs` is the dev-mode round trip, with dev mode set in `ProverOpts` and `VerifierContext` rather than through `RISC0_DEV_MODE`.
- **`peak-memory.sh`**, SP1's sampler.
- **`.github/workflows/zk-trial-risc0.yml`** runs on pushes to the branch: build, one execution, the Groth16 image, then the Groth16 proof of a small vector with segments of 2^19 cycles, with a memory sampler.

#### Executor: cycles per vector

`zk-host execute` reproduced the Outcome, or the error code, and `traceKeccak` of all 75 game vectors: 43 in `vectors/game/` and 32 in `vectors/levels/`. User cycles are the verify program's executed cycles (`SessionInfo::cycles()`). Proving cycles add paging and pad each segment to its power of two (`SessionInfo::segments`, 2^20 cycles at most by default): they are what the prover proves and what Boundless prices, and they equal the prover's `SessionStats::total_cycles` (1,310,720 for `commit-at-tick-0`). Trace-guest cycles include a state hash per tick and are test-only.

- **Fixed cost:** about 1.1 million user cycles before the first tick (`commit-at-tick-0`, which ends at tick 1: 1,122,341), in 2 segments, 1,310,720 proving cycles. The verify program on a rejected journal halts with no session, so it reports no cycles; the trace program rejects `rejected-level-id` in 1,195,363 cycles.
- **Per level:** the heaviest gate-set level is `10-worst`, at 29,588,717 user cycles and 30,932,992 proving cycles in 30 segments. `worst-case` takes 27,762,031 and 29,360,128. The 32 gate-set vectors average 15,616,118 user cycles and 16,491,520 proving cycles.
- **Six-level run:** `zk-host execute-run` on the six levels SP1 used (`10-worst`, `16-worst`, `04-worst`, `08-worst`, `03-worst`, `14-synthetic`) took 130,741,601 user cycles and 136,577,024 proving cycles in 131 segments, in 2.0 s, and reproduced the six Outcomes.
- **Against SP1:** on the 32 gate-set vectors, user cycles are 0.95 to 1.01 times SP1's executed instructions (`10-worst`: 29.6 million against 31.2 million), on RV32IM against SP1's RV64IM. The small vectors take up to 1.2 times, from the larger fixed cost (1.12 million against 0.98 million for `commit-at-tick-0`). On the 71 accepted vectors, the trace program takes 1.1 to 1.8 times SP1's, most likely because the state hash's 64-bit arithmetic costs more on a 32-bit target; on the 4 rejected ones, 0.83 to 1.09 times.
- **Keccak:** the guest uses the core's software keccak (tiny-keccak 2.0.2). RISC Zero's keccak accelerator was not tried.

##### `vectors/game/`

| Vector | Ticks used or error | User cycles | Proving cycles | Segments | Trace-guest user cycles |
|---|---:|---:|---:|---:|---:|
| `boss-bumps-trail` | 57 | 1,162,410 | 1,310,720 | 2 | 10,803,065 |
| `boss-corridor-b2` | 400 | 1,026,893 | 1,179,648 | 2 | 67,254,307 |
| `boss-corridor-b8` | 400 | 1,142,714 | 1,310,720 | 2 | 67,391,056 |
| `capture-around-obstacle` | 17 | 1,652,846 | 2,097,152 | 2 | 4,776,979 |
| `capture-edge-rectangle` | 17 | 1,653,456 | 2,097,152 | 2 | 4,777,747 |
| `capture-l-shape` | 36 | 1,642,428 | 2,097,152 | 2 | 7,894,658 |
| `capture-split-boss-left` | 60 | 1,432,104 | 1,572,864 | 2 | 11,614,893 |
| `capture-split-boss-right` | 60 | 1,411,094 | 1,572,864 | 2 | 11,589,675 |
| `clear-and-last-life` | 9 | 1,642,920 | 2,097,152 | 2 | 3,437,364 |
| `clear-the-level` | 61 | 1,652,981 | 2,097,152 | 2 | 12,028,846 |
| `commit-at-tick-0` | 1 | 1,122,341 | 1,310,720 | 2 | 1,507,342 |
| `commit-during-cut` | 6 | 1,121,158 | 1,310,720 | 2 | 2,327,670 |
| `event-at-last-tick` | 20 | 1,109,949 | 1,310,720 | 2 | 4,616,970 |
| `fast-cut-close-first-sub-step` | 10 | 1,654,727 | 2,097,152 | 2 | 3,617,306 |
| `fast-cut` | 7 | 1,121,824 | 1,310,720 | 2 | 2,489,656 |
| `full-journal` | 2,700 | 3,626,078 | 4,194,304 | 4 | 449,890,537 |
| `last-life-on-last-tick` | 10 | 1,123,986 | 1,310,720 | 2 | 2,992,395 |
| `minion-stranded-respawns` | 58 | 1,662,056 | 2,097,152 | 2 | 11,546,728 |
| `open-field-capture` | 162 | 3,801,297 | 4,194,304 | 4 | 31,246,577 |
| `open-field-empty` | 2,700 | 2,002,964 | 2,162,688 | 3 | 448,195,877 |
| `random-all-1` | 617 | 2,458,923 | 2,621,440 | 3 | 104,793,682 |
| `random-all-2` | 651 | 3,855,620 | 4,194,304 | 4 | 112,032,126 |
| `random-all-3` | 1,425 | 5,317,064 | 5,767,168 | 6 | 241,539,478 |
| `random-all-4` | 907 | 3,650,580 | 4,194,304 | 4 | 154,072,012 |
| `random-dirs-1` | 572 | 2,166,604 | 2,359,296 | 3 | 97,008,126 |
| `random-dirs-2` | 717 | 3,843,766 | 4,194,304 | 4 | 122,904,843 |
| `random-dirs-3` | 1,430 | 3,667,849 | 4,194,304 | 4 | 240,430,897 |
| `random-dirs-4` | 1,166 | 7,482,362 | 7,864,320 | 8 | 201,338,807 |
| `rejected-event-after-end` | error 14 | rejected |  |  | 1,383,482 |
| `rejected-event-at-time-limit` | error 13 | rejected |  |  | 1,195,612 |
| `rejected-level-before-its-id` | error 33 | rejected |  |  | 136,079 |
| `rejected-level-id` | error 12 | rejected |  |  | 1,195,363 |
| `respawn-after-bottom-captured` | 166 | 2,216,303 | 2,621,440 | 3 | 30,046,274 |
| `several-hits-one-life` | 11 | 1,131,135 | 1,310,720 | 2 | 3,167,628 |
| `several-hits-while-invulnerable` | 11 | 1,131,229 | 1,310,720 | 2 | 3,167,744 |
| `several-hits-with-shield` | 11 | 1,116,723 | 1,310,720 | 2 | 3,146,019 |
| `shield-absorbs-a-hit` | 13 | 1,125,151 | 1,310,720 | 2 | 3,493,886 |
| `slow-shield` | 11 | 1,122,348 | 1,310,720 | 2 | 3,151,904 |
| `step-onto-boss-from-below` | 19 | 1,135,002 | 1,310,720 | 2 | 4,495,239 |
| `step-onto-boss-from-right` | 19 | 1,134,926 | 1,310,720 | 2 | 4,495,184 |
| `stranded-off-rail` | 109 | 1,690,873 | 2,097,152 | 2 | 19,998,852 |
| `swap-collision` | 11 | 1,138,784 | 1,310,720 | 2 | 3,175,694 |
| `worst-case` | 2,700 | 27,762,031 | 29,360,128 | 28 | 478,201,144 |

##### `vectors/levels/`

| Vector | Ticks used or error | User cycles | Proving cycles | Segments | Trace-guest user cycles |
|---|---:|---:|---:|---:|---:|
| `01-synthetic` | 2,458 | 17,192,157 | 18,087,936 | 18 | 425,956,857 |
| `01-worst` | 2,700 | 17,456,884 | 18,350,080 | 18 | 466,277,458 |
| `02-synthetic` | 2,458 | 17,625,909 | 18,874,368 | 18 | 426,436,464 |
| `02-worst` | 2,700 | 17,884,065 | 18,874,368 | 18 | 466,752,950 |
| `03-synthetic` | 2,520 | 18,021,074 | 18,874,368 | 18 | 437,097,989 |
| `03-worst` | 2,700 | 18,343,312 | 19,398,656 | 19 | 467,254,204 |
| `04-synthetic` | 2,415 | 17,216,385 | 18,087,936 | 18 | 418,847,634 |
| `04-worst` | 2,700 | 21,026,792 | 22,020,096 | 21 | 470,287,581 |
| `05-synthetic` | 1,328 | 14,339,392 | 15,204,352 | 15 | 236,056,574 |
| `05-worst` | 2,700 | 4,374,793 | 4,718,592 | 5 | 450,902,258 |
| `06-synthetic` | 1,335 | 16,657,852 | 17,825,792 | 17 | 239,931,117 |
| `06-worst` | 2,700 | 4,871,040 | 5,242,880 | 5 | 451,472,704 |
| `07-synthetic` | 2,080 | 15,285,707 | 15,990,784 | 16 | 361,273,493 |
| `07-worst` | 2,700 | 16,362,196 | 17,301,504 | 17 | 464,908,881 |
| `08-synthetic` | 2,204 | 14,774,530 | 15,728,640 | 15 | 381,047,843 |
| `08-worst` | 2,700 | 20,082,508 | 20,971,520 | 20 | 469,249,549 |
| `09-synthetic` | 1,238 | 15,508,836 | 16,252,928 | 16 | 222,535,268 |
| `09-worst` | 2,700 | 5,568,177 | 6,291,456 | 6 | 452,302,668 |
| `10-synthetic` | 1,456 | 16,506,110 | 17,301,504 | 17 | 259,531,990 |
| `10-worst` | 2,700 | 29,588,717 | 30,932,992 | 30 | 480,323,529 |
| `11-synthetic` | 1,233 | 15,408,096 | 16,252,928 | 16 | 221,575,504 |
| `11-worst` | 2,700 | 7,914,935 | 8,388,608 | 8 | 454,946,035 |
| `12-synthetic` | 1,597 | 15,179,454 | 15,990,784 | 16 | 281,321,566 |
| `12-worst` | 2,700 | 6,714,834 | 7,340,032 | 7 | 453,526,445 |
| `13-synthetic` | 1,604 | 14,498,151 | 15,204,352 | 15 | 281,730,525 |
| `13-worst` | 2,221 | 14,996,188 | 15,728,640 | 15 | 384,225,795 |
| `14-synthetic` | 1,740 | 18,342,944 | 19,398,656 | 19 | 308,676,630 |
| `14-worst` | 2,700 | 17,059,828 | 17,858,560 | 18 | 465,638,313 |
| `15-synthetic` | 1,496 | 15,177,858 | 15,990,784 | 16 | 264,675,498 |
| `15-worst` | 2,700 | 17,682,184 | 18,874,368 | 18 | 466,299,299 |
| `16-synthetic` | 1,607 | 14,683,581 | 15,728,640 | 15 | 282,359,322 |
| `16-worst` | 2,700 | 23,371,284 | 24,641,536 | 24 | 473,036,120 |

#### Proving on the CPU

`bash referee/zk/peak-memory.sh referee/zk/target/release/zk-host prove <mode> vectors/game/commit-at-tick-0.json`, the smallest accepted vector (1,122,341 user cycles, 2 segments):

| Mode | Segment limit | Result | Prove | Peak memory |
|---|---|---|---|---|
| composite | 2^20 (default) | PASS, verified; 536,784-byte seal, not onchain-verifiable | 965.2 s, with two of the four CPUs taken by another session | 9,599,912 kB VmHWM (9.2 GiB) |
| composite | 2^19 | PASS, verified; 3 segments, 791,416-byte seal | 831.5 s | 4,815,260 kB VmHWM (4.6 GiB) |
| groth16 | 2^20 (default) | PASS, verified; 256-byte Groth16 seal, verified onchain (below) | 1,281.8 s for the whole chain, Docker step included | 9,599,020 kB VmHWM in the host; 7,203 MiB sampled in the Docker container, which runs after the host's STARK steps |

The program's image id is `0xdb9671cb97da76e0ec0789137da5e1497f34687e031d3a5082a316d3b3eab069`. RISC Zero's [local proving](https://dev.risczero.com/api/generating-proofs/local-proving) page advises a smaller segment limit when less than 10 GB is available: memory follows the segment size, not the program's length.

#### Wrapping

The onchain-verifiable receipt compresses the segment receipts into one succinct receipt, then into an `identity_p254` receipt, which `risc0-groth16` 3.0.5 hands to `docker run risczero/risc0-groth16-prover:v2025-04-03.1`, the "shrink-wrap" Groth16 prover. Its `cuda` feature replaces Docker with a native GPU prover; there is no native CPU route.

- **In the container: PASS.** `bash referee/zk/peak-memory.sh referee/zk/target/release/zk-host prove groth16 vectors/game/commit-at-tick-0.json`, with the default segments, ended `verified: yes` after 1,281.8 s (above). The peak was 9.2 GiB in the host process during the segment proofs, under the session's 13.36 GiB cgroup, then 7.0 GiB (sampled) in the container that `risc0-groth16` started, with no memory cap; `dmesg` shows no out-of-memory kill. The verifier parameters digest is `73c457ba541936f0d907daf0c7253a39a9c5c427c225ba7709e44702d3c6eedc`, whose first four bytes are the 3.0 verifier's selector.
- **Onchain check of that proof:** `cast call 0x0b144e07a0826182b6b59788c34b32bfa86fb711 "verify(bytes,bytes32,bytes32)" 0x73c457ba<seal> 0xdb9671cb97da76e0ec0789137da5e1497f34687e031d3a5082a316d3b3eab069 0x8394dc2c336cab35dc19c9c489d6afd15f09229a92955d14833bfcb41dcff6ba --rpc-url <rpc>`, with the seal and the sha256 of the journal (the 384-byte encoded Outcome of `commit-at-tick-0`) that `zk-host` printed, returns without reverting on Arbitrum One (block 520,373,707) and Arbitrum Sepolia (block 325,095,246), and `cast estimate` gives 277,009 gas on both. With the journal digest changed to `0x…01`, the call reverts with `VerificationFailed()` (`0x439cc0cd`).
- **On Actions: PASS.** [Run 41344460922](https://github.com/detychey/jiro-ikusu/actions/runs/41344460922), on `ubuntu-24.04` (image 20261025.353.1): 2 vCPUs, 7,932 MiB of RAM and 3,071 MiB of swap. The host built in 62 min 35 s, executed `commit-at-tick-0` (PASS), and `docker pull` fetched the Groth16 image in 30 s (digest `sha256:a4f80ce2…a64ee`, as above). Then `zk-host prove groth16 vectors/game/commit-at-tick-0.json 19`, with segments of 2^19 cycles (3 segments), ended `verified: yes` after 2,160.4 s: peak 4,815,332 kB VmHWM in the host, 5,661 MiB sampled in the Docker container, and the runner's sampler peaked at 6,520 MiB used with 2,206 MiB of swap during the Docker step; `dmesg` shows no out-of-memory kill. Its seal verifies through the router on Arbitrum One (block 520,387,800) and Arbitrum Sepolia (block 325,110,799) with the same `cast call`, under the runner's image id. The run took 100.5 minutes (101 billed minutes).
- **The image id depends on the build machine.** The runner's guest has image id `0x448f8f6e0e80d9a9cc06d51fc0b121c4ecc5b691e6f17a1e9787407e0f50e24d`, the container's `0xdb9671cb…b069`, from the same commit and toolchain: the ELF embeds absolute source paths in its panic locations (`strings` shows `/root/.cargo/registry/src/…` and `/home/user/wt/zk-trial-risc0/core/src/level.rs`). Each proof verifies only under its own image id; the runner's seal reverts with `VerificationFailed()` under the container's. A contract pins one image id, so the guest build must be reproducible: a path remap like M1.11's, or risc0-build's Docker build. Neither was tried here; M1.12 tried the first ([M1.12: the choice](#m112-the-choice), Image id).
- **Docker:** needed for the Groth16 step only, on x86. The STARK proofs run in the host process.

#### Onchain verifier

- **Router,** which routes a seal to the verifier its first four bytes select. The same address on Arbitrum One (42161) and Arbitrum Sepolia (421614), `0x0b144e07a0826182b6b59788c34b32bfa86fb711`, from RISC Zero's [verifier contracts](https://dev.risczero.com/api/blockchain-integration/contracts/verifier) page and [`risc0-ethereum`](https://github.com/risc0/risc0-ethereum) `contracts/deployment.toml` at commit `1d19771d` (`main`, 2026-10-22). `owner()` is the timelock `0xDC986a09728F76110FF666eE7b20d99086501d15` on both chains; its delay is 259,200 s (3 days) on Arbitrum One and 1 s on Sepolia.
- **3.0 Groth16 verifier,** for risc0-zkvm 3.0.x, selector `0x73c457ba`: `0x2a098988600d87650Fb061FfAff08B97149Fa84D` on both chains, behind an emergency-stop wrapper, `0x9F9994Eb4Cb5200198FEfb470f8b50301662e696` on Arbitrum One and `0x724d375B5b622e15f0E64e9Deb76a4cB17877797` on Sepolia. On 2026-11-01 (Arbitrum One block 520,345,747, Sepolia block 325,065,008):
  - `cast call 0x0b144e07a0826182b6b59788c34b32bfa86fb711 "getVerifier(bytes4)(address)" 0x73c457ba --rpc-url <rpc>` returns the emergency-stop wrapper, with `--rpc-url https://arb1.arbitrum.io/rpc` and `https://sepolia-rollup.arbitrum.io/rpc`;
  - `paused()` on the wrapper returns `false`, `verifier()` the 3.0 verifier, whose `VERSION()` is `"3.0.0"` and `SELECTOR()` `0x73c457ba`.
  - The 2.2 verifier (`0xbb001d44`) is also routed and not stopped; the 2.0 one (`0xf536085a`) is stopped (`paused()` returns `true`); the 1.x ones are removed from the router.
- **Foundry tests,** with forge 1.8.6 in the container:
  - `risc0-ethereum` at tag `v3.0.1` (`365e7b2d`, the contracts release for risc0-zkvm 3.0): `cd contracts && forge test`, 35 tests passed, 0 failed, in 5 suites. `RiscZeroMockVerifier` (`contracts/src/test/`), which accepts a seal made by its own `mockProve`, backs the 15 router tests, the 6 emergency-stop tests and the 7 set-verifier tests; `testVerifyKnownGoodReceipt` verifies a real 3.0 Groth16 receipt for 252,496 gas.
  - [`risc0-foundry-template`](https://github.com/risc0/risc0-foundry-template) at `6e6f8cad` (2025-06-16) still pins risc0-zkvm 2.0.2 and risc0-ethereum v2.1.0, and its test imports an `Elf.sol` generated by its own build; it was not run.

#### Prover network

RISC Zero's hosted prover is now [Boundless](https://docs.boundless.network/developers/what), a proof market: [Bonsai](https://docs.boundless.network/developers/tutorials/bonsai), its centralized proving API, "is no longer available" since December 2025, and the risc0-zkvm 3.0 [remote proving](https://dev.risczero.com/api/generating-proofs/remote-proving) page points to Boundless only. Read on 2026-11-01.

- **Chain and token:** it bills in ETH on Base mainnet (8453). A requester deposits ETH into `BoundlessMarket`, `0xfd152dadc5183870710fe54f939eae3ab9f0fe82` on Base ([deployments](https://docs.boundless.network/developers/smart-contracts/deployments)), or sends it with the request, and signs requests with an Ethereum key. Provers, not requesters, lock collateral in ZKC. A request also needs the program at a public URL: the docs suggest IPFS through Pinata, or S3. The proof is delivered on Base by default as a Merkle inclusion in an aggregated set (`SetVerifier`); a raw Groth16 seal, which is what an Arbitrum contract can check through the router above, is a request option that the docs say costs more ([proof types](https://docs.boundless.network/developers/tutorials/proof-types)).
- **Minimum deposit:** none. `deposit()` in [`BoundlessMarket.sol`](https://github.com/boundless-xyz/boundless/blob/main/contracts/src/BoundlessMarket.sol) (`main`, `3f289f83`) adds `msg.value` to the balance without a floor; each request must be covered by the balance up to its `maxPrice`.
- **Price:** set per request by a reverse Dutch auction between the requester's `minPrice` and `maxPrice` ([auction](https://docs.boundless.network/developers/tutorials/auction)). The SDK's default `maxPrice` is the market price per cycle times the request's total cycles, plus twice the estimated fulfilment gas; its static fallback is 100,000 wei per cycle (boundless-market 2.0.1). The market's realized prices come from the Boundless indexer that the SDK queries, read at 18:11 UTC: `https://d2mdvlnmyov1e1.cloudfront.net/v1/market/aggregates?aggregation=weekly&limit=2&sort=desc&before=<now>&after=<now − 14 days>`. For the week from 2026-10-26 on Base:
  - 1,348 requests fulfilled, from 10 requesters, by 2 provers, over 612,544,518,705 total cycles;
  - fees locked 0.032823 ETH: 0.026401 ETH of variable cost, or 43,101 wei per total cycle, and 0.006422 ETH of fixed (gas) cost, or 0.0000047675 ETH per locked request;
  - lock price per cycle: p10 25,367 wei, p50 81,480 wei, p90 136,580 wei. The daily figures for 2026-10-30 to 2026-11-01 are alike (p50 79,684 to 84,222 wei).
- **Expected cost,** at that week's variable cost per cycle plus its mean fixed cost per request, with ETH at $2,262.01 (CoinGecko, 2026-11-01 18:12 UTC). These are the market's averages, mostly for aggregated proofs; a raw Groth16 request would cost more.

  | Proof | Total cycles | Variable + fixed | At the p50 price per cycle |
  |---|---:|---|---|
  | One level, the smallest (`commit-at-tick-0`) | 1,310,720 | 0.0000048 ETH ($0.011) | 0.00000011 ETH ($0.0002) |
  | One level, the heaviest (`10-worst`) | 30,932,992 | 0.0000061 ETH ($0.014) | 0.0000025 ETH ($0.006) |
  | One six-level run, the heaviest six levels | 136,577,024 | 0.0000107 ETH ($0.024) | 0.0000111 ETH ($0.025) |

  The fixed cost is 45% of the run proof's price. A run proof costs about 21% of the 0.00005 ETH run fee.

#### Findings for M1.12

- **All four checks pass.** The executor reproduces every vector, the dev-mode round trip takes 0.17 s, and the router routes the 3.0 verifier on both Arbitrum chains.
- **A real onchain-verifiable proof here.** The Groth16 proof of `commit-at-tick-0` took 21 minutes in the container, at 9.2 GiB in the host and 7.0 GiB in Docker, one after the other, and verifies through the router on Arbitrum One and Sepolia (277,009 gas estimated). With segments of 2^19 cycles, the host's STARK proving takes 4.6 GiB. On a 2-vCPU, 7.9 GB runner, with 2^19 segments, the same proof took 36 minutes and passed, using swap during the Docker step. The guest's image id differs between the two builds (absolute paths in the ELF), so a reproducible guest build is a prerequisite of any deployment.
- **32-bit only.** RISC Zero 3.0 targets RV32IM; the plan's RV64IM preference (M1.12) cannot hold with it, and README §7.3 allows RV32IM.
- **Prover network.** Boundless bills in ETH on Base, with no minimum deposit; at the market's averages a run proof costs about 0.000011 ETH. It needs a Base wallet and a public URL for the program, and its default delivery is an aggregated Merkle proof on Base, so a raw Groth16 seal for Arbitrum is a non-default request whose price was not measured. Only 2 provers locked requests in the measured week.
- **zk tier.** The bootstrap needs a C++ compiler, the rzup settings written by hand, and, for wrapping only, the 2.4 GB Groth16 image, which this container's `docker pull` cannot fetch (mirror `not found`, then `429` from Docker Hub). The host's C++ circuit kernels make clean builds long (about an hour here, 62 min 35 s on a 2-vCPU runner, against 25 minutes for `ci.yml`'s `rust` job), so M1.12's zk-exec job needs a build cache.
- **TOOLING.md:** risc0-build 3.0.6 built the guest locally with the 1.97 toolchain, not in Docker with `r0.1.88.0`, so its MSRV caveat for M1.17 did not arise. It says Docker Hub pulls go through `mirror.gcr.io`; that mirror does not hold `risczero/risc0-groth16-prover`.

### SP1 and RISC Zero side by side

The facts M1.12 compares, from the two sections above; it makes no choice. Times come from the same container, but RISC Zero's ran with two of the four CPUs taken by another session.

| | SP1 | RISC Zero |
|---|---|---|
| Version, guest target | v6.10.0, RV64IM | 3.0.6, RV32IM |
| Four checks | all PASS | all PASS |
| Vectors reproduced | 75 of 75 | 75 of 75 |
| Heaviest level (`10-worst`) | 31,227,278 cycles; 27,203,307 PGU | 29,588,717 user cycles; 30,932,992 proving cycles |
| Six-level run | 136,915,482 cycles; 119,502,086 PGU | 130,741,601 user cycles; 136,577,024 proving cycles |
| Mock round trip | 7.84 s | 0.17 s |
| CPU proof of `commit-at-tick-0` | core 92 s at 11.6 GiB; compressed out of memory | composite 965 s at 9.2 GiB (832 s at 4.6 GiB with 2^19 segments) |
| Onchain-verifiable proof, container | FAIL, out of memory | PASS: Groth16 in 1,282 s, 9.2 GiB then 7.0 GiB in Docker |
| Onchain-verifiable proof, Actions (2 vCPUs, 7.9 GB) | FAIL, out of memory | PASS: Groth16 in 2,160 s with 2^19 segments, using swap |
| Wrapping needs | Docker image (161 MB, ghcr.io) and 6.2 GB of artifacts | Docker image (2.4 GB, Docker Hub only) |
| Clean host build | 16 min on a 2-vCPU runner | 62 min 35 s on a 2-vCPU runner |
| Program id, same commit, container and runner builds | not compared | differs: the guest ELF embeds absolute source paths |
| Arbitrum verifier | gateway `0x397A…dA9B`, v6.1.0 verifier | router `0x0b14…b711`, 3.0.0 verifier |
| Verification gas, framework fixture | 234,718 (Groth16, `forge test`) | 252,496 (`forge test`); 277,009 estimated on Arbitrum One for this trial's proof |
| Prover network | Succinct Prover Network: PROVE on Ethereum mainnet, minimum deposit 0.01 PROVE | Boundless: ETH on Base, no minimum deposit |
| Run proof price | 0.433 PROVE ($0.090), Groth16 | about 0.000011 ETH ($0.024) at market averages, mostly aggregated proofs; raw Groth16 not priced |

### M1.12: the choice

**RISC Zero,** chosen by the owner on 2026-11-02 ("RISC Zero (Recommended)") from the two trials above, and recorded in README §13 D2 (part 1). Both frameworks pass the four checks, so cycles and price decide (README §7.3):

| | SP1 | RISC Zero | Reading |
|---|---|---|---|
| Cycles, heaviest level (`10-worst`) | 31,227,278 executed; 27,203,307 PGU | 29,588,717 user; 30,932,992 proving | Within 5% of each other on every gate-set level: cycles do not separate them. Each network prices its own unit (PGU, proving cycles). |
| Cycles, six-level run (the heaviest six levels) | 136,915,482 executed; 119,502,086 PGU | 130,741,601 user; 136,577,024 proving | As above |
| Price of a six-level run proof on the framework's network | 0.433 PROVE ($0.090, about 0.00004 ETH), a Groth16 proof | about 0.000011 ETH ($0.024) at the Boundless market's averages, mostly aggregated proofs; a raw Groth16 seal was not priced | RISC Zero is about a quarter of SP1's price, with the caveat that its raw-Groth16 price is unmeasured. SP1's proof costs about 80% of the 0.00005 ETH run fee, RISC Zero's about 21%. |
| Onchain-verifiable proof without a network | out of memory in the container and on Actions | PASS in the container and on a 2-vCPU runner, verified on Arbitrum One and Sepolia | Only RISC Zero can prove without a paid network today |

The frameworks tie on cycles, and RISC Zero wins on price and on proving where the agent works. Its costs: 32-bit only (RV32IM; README §7.3 allows it), a clean host build of about an hour, and a raw Groth16 seal for Arbitrum being a non-default Boundless request.

#### The merged referee

`referee/zk/` on `main`: the kept branch's guest and host (`zk-trial-risc0`, `c7623f5`), as of `3cc7991`, the first commit of PR #57. RISC Zero 3.0.6 (`risc0-zkvm` and `risc0-build` pinned to `=3.0.6`), toolchain `r0.1.97.0` (`rustc 1.97.0-dev (e638c6cfe 2026-07-15)`), guest target `riscv32im-risc0-zkvm-elf`. Changes from the trial:

- `zk-host execute` also takes the format vectors, through the verify guest, as [`web/test/vectors.mjs`](../web/test/vectors.mjs) pairs them: each journal is replayed on the open-field level, and must be rejected with its recorded code or, if valid, not by a decoder code (1 to 11); each level is replayed with the open-field-empty journal made to name its id, and must be rejected with its recorded code or accepted with its recorded `levelId`. It takes directories recursively, so `execute vectors/` runs every vector (`derivations.json` holds no vectors). Replay's code is read from the panic message as a whole number, where the trial's substring match would have taken `code 12` for `code 1`. Its output starts with the two programs' image ids.
- The guests build with `-Zlocation-detail=none` (`[package.metadata.risc0] rustc-flags` in `guest/Cargo.toml`; the `r0.1.97.0` rustc is a `dev` build, which accepts `-Z` flags): panic locations no longer embed absolute source paths, below.
- The `prove` command and `peak-memory.sh` stay on the kept branch for M4.8.

**Executor.** `bash scripts/bootstrap.sh zk`, `cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host`, then `referee/zk/target/release/zk-host execute vectors/` (what the plan's `cargo run … -- execute vectors/` runs) at `3cc7991`, in the container: `126 vectors, 0 failed` in 4 min 6 s, the 51 format vectors, the 43 game vectors and the 32 gate-set vectors. The 75 game vectors' results and cycles (user and proving cycles, segments, trace-guest cycles) equal the trial's tables above in every cell, `full-journal` (3,626,078 user cycles) and `worst-case` (27,762,031) among them; panic locations are not on an accepted run's path. The six-level run (`zk-host execute-run`, the same six levels) takes 130,741,601 user cycles, as in the trial, and 136,445,952 proving cycles in 131 segments, 131,072 fewer than the trial's: the smaller ELF (126,756 bytes for `verify`, against 128,836) pages in less.

The format vectors, through the verify guest (a rejected journal or level halts with no session, so no cycles):

| Vector | Result | User cycles | Proving cycles | Segments |
|---|---|---:|---:|---:|
| `journal-challenge-level-5` | accepted | 2,004,856 | 2,162,688 | 3 |
| `journal-event-count-2701` | error 7 | rejected |  |  |
| `journal-first-broken-event-wins` | error 11 | rejected |  |  |
| `journal-first-mask-0` | error 11 | rejected |  |  |
| `journal-full-2700-events` | accepted | 4,155,053 | 4,456,448 | 5 |
| `journal-last-tick-2699` | accepted | 2,038,812 | 2,228,224 | 3 |
| `journal-level-index-6` | error 6 | rejected |  |  |
| `journal-mask-returns-to-0` | accepted | 1,124,881 | 1,310,720 | 2 |
| `journal-one-event` | accepted | 2,331,889 | 2,621,440 | 3 |
| `journal-open-field-empty` | accepted | 2,002,964 | 2,162,688 | 3 |
| `journal-other-rules-version` | error 4 | rejected |  |  |
| `journal-reserved-bit-7` | error 10 | rejected |  |  |
| `journal-reserved-mode-2` | error 5 | rejected |  |  |
| `journal-tick-2700` | error 8 | rejected |  |  |
| `journal-tick-not-increasing` | error 9 | rejected |  |  |
| `journal-trailing-bytes` | error 2 | rejected |  |  |
| `journal-truncated-events` | error 1 | rejected |  |  |
| `journal-truncated-header` | error 1 | rejected |  |  |
| `journal-unchanged-mask` | error 11 | rejected |  |  |
| `journal-unknown-mode-3` | error 5 | rejected |  |  |
| `journal-unknown-version` | error 3 | rejected |  |  |
| `level-b2-whole-interior-spawn` | accepted | 1,923,047 | 2,097,152 | 2 |
| `level-blocked-start` | error 39 | rejected |  |  |
| `level-border-obstacle` | error 22 | rejected |  |  |
| `level-boss-period-0` | error 26 | rejected |  |  |
| `level-boss-size-1` | error 23 | rejected |  |  |
| `level-boss-size-9` | error 23 | rejected |  |  |
| `level-boss-spawn-on-obstacle` | error 37 | rejected |  |  |
| `level-length-471` | error 20 | rejected |  |  |
| `level-lives-0` | error 33 | rejected |  |  |
| `level-minion-count-4` | error 27 | rejected |  |  |
| `level-minion-period-0-with-minions` | error 30 | rejected |  |  |
| `level-minion-period-1-without-minions` | error 30 | rejected |  |  |
| `level-minion-spawn-off-rail` | error 38 | rejected |  |  |
| `level-minion-spawn-x-60` | error 28 | rejected |  |  |
| `level-one-cell-spawn` | accepted | 1,997,910 | 2,162,688 | 3 |
| `level-open-area-1681` | error 36 | rejected |  |  |
| `level-open-area-1682` | accepted | 1,767,361 | 2,097,152 | 2 |
| `level-open-area-split` | error 35 | rejected |  |  |
| `level-open-field` | accepted | 2,002,964 | 2,162,688 | 3 |
| `level-respawn-delay-0-with-minions` | error 31 | rejected |  |  |
| `level-respawn-delay-1-without-minions` | error 31 | rejected |  |  |
| `level-spawn-x0-above-x1` | error 24 | rejected |  |  |
| `level-spawn-x1-255-b8` | error 25 | rejected |  |  |
| `level-spawn-x1-60-minus-b` | error 25 | rejected |  |  |
| `level-target-10001` | error 34 | rejected |  |  |
| `level-time-limit-0` | error 32 | rejected |  |  |
| `level-time-limit-2701` | error 32 | rejected |  |  |
| `level-unknown-version` | error 21 | rejected |  |  |
| `level-unused-minion-slot` | error 29 | rejected |  |  |
| `level-walls-and-minions` | accepted | 2,001,753 | 2,162,688 | 3 |

**Image id.** The verify program's image id is `0x7e6e7a83a41a65e6aff08eefc8f7c321cfabd3f48335ca0ffd246c8131826bcb` and the trace program's `0x85bd44e3f94ab7402e9e64c0528b746ed3a0f4b7392cc3ae586093a28c418342` at `3cc7991`, in the container. On the runner, from the same commit and toolchain (`ci.yml`'s zk-exec job, runs [41368126873](https://github.com/detychey/jiro-ikusu/actions/runs/41368126873) and [41374389802](https://github.com/detychey/jiro-ikusu/actions/runs/41374389802)), the trace program's image id is the same, but the verify program's is `0x1e72b2e22a97adf71a3fde993f810d0f51f2bd0b5a1ab707c3c196cfe38a448f`. So taking the paths out is not enough:

- The flag did remove every absolute source path: `strings` on both ELFs shows only the paths of the prebuilt standard library (`library/…`, and `rustc-demangle` under RISC Zero's own build machine's `/root/.cargo`), which are the same everywhere.
- The two `verify` ELFs have the same size, 126,756 bytes, and 22,272 bytes differ: `llvm-objdump -d` shows the same code with its functions placed in a different order, and the call offsets moved accordingly.
- The cause is Cargo's `-C metadata` hash, which takes the absolute path of a path dependency outside the workspace. `jiro-core` (`../../../core`) is outside the guest's workspace, so its crate hash, and every symbol name derived from it, changes with the checkout path: the guest target holds a different `libjiro_core-<hash>.rlib` for `/home/user/wt/m1.12`, for a copy of the tree at another path, and on the runner. The symbol names then most likely decide where the optimizer and linker place functions. A build from a copy at another path in the container happened to give the same ELFs, so a relocation test in one machine does not prove the build reproducible.

**A reproducible guest build therefore remains a prerequisite of any deployment, for M4.8 and M4.10.** Two routes: RISC Zero's Docker build (risc0-build's `use_docker` option, which builds at `/src` inside `risczero/risc0-guest-builder`; Docker Hub has its `r0.1.97.0` tag, while risc0-build 3.0.6 defaults to `r0.1.88.0`, whose rustc 1.88 is older than the core's `rust-version` 1.96, so the tag must be set), or every build at one fixed absolute path. The `-Zlocation-detail=none` flag stays either way, since it is what takes the source paths out of the ELF.

**CI.** `ci.yml`'s zk-exec job runs the format vectors and `full-journal`, `open-field-capture`, `rejected-level-id` and `worst-case` through the executor, and the dev-mode round trip (`cargo test --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host --test mock_round_trip`, 0.14 s of test in the container); `nightly.yml` runs `execute vectors/`, whose first run, on this PR's `ci:heavy` label ([run 41375987597](https://github.com/detychey/jiro-ikusu/actions/runs/41375987597)), ended `126 vectors, 0 failed` on the runner too. Their timings are in [`TOOLING.md`](TOOLING.md#actions-minutes).

**Left for M4.8 and M4.10:** a reproducible guest build (above), the public values' byte encoding (README §7.3), the price of a raw Groth16 seal on Boundless, and the Groth16 image, which only Docker Hub serves.

## zk costs

Plan M4.8: real proofs of the verify guest in both modes, their onchain verification, and their costs, measured on 2026-11-02. RISC Zero 3.0.6 (`risc0-zkvm`, `risc0-build`), toolchain `r0.1.97.0`, the Groth16 prover image `risczero/risc0-groth16-prover:v2025-04-03.1` (digest `sha256:a4f80ce2…a64ee`, 5,209,789,112 bytes once loaded; `docker pull` worked in the container this time, in 1 min 42 s), RISC Zero's verifier contracts from `risc0-ethereum` `v3.0.1` (`365e7b2d`), forge 1.8.6 and solc 0.8.28. The code is this PR's: [`referee/zk/README.md`](../referee/zk/README.md) describes the two modes, the public values' encoding and the build path.

- **Container:** 4 CPUs, 15.7 GiB of RAM, no swap, no GPU, in a 13.36 GiB memory cgroup that also holds `dockerd`; no other session ran. Each proof ran alone, with `bash referee/zk/peak-memory.sh referee/zk/target/release/zk-host prove …`, from the build at the fixed path.
- **Runner:** `ubuntu-24.04`, 2 vCPUs, 7,932 MiB of RAM and 3,071 MiB of swap, Docker 28.0.4, in `zk-prove.yml`'s PR run [41386918742](https://github.com/detychey/jiro-ikusu/actions/runs/41386918742), on the `ci:heavy` label.

### Reproducible image ids

A zk referee pins the verify program's image id (M4.10), so its build must not depend on the machine. M1.12 took the source paths out of the ELF (`-Zlocation-detail=none`), but the verify program's id still differed between the container and the runner, through Cargo's `-C metadata` hash of `jiro-core`'s absolute path ([The merged referee](#the-merged-referee)). M4.8 fixes the build path instead of the hash: **every build runs with the repository at `/home/runner/work/jiro-ikusu/jiro-ikusu`**, `actions/checkout`'s path on GitHub's runners, and a bind mount at that path elsewhere ([`referee/zk/README.md`](../referee/zk/README.md#reproducible-image-ids)).

| Build | Path | verify image id | trace image id |
|---|---|---|---|
| `main` at `3d081f9` (M1.12's guests), container | `/home/user/wt/m1.12`, M1.12's record | `0x7e6e7a83…6bcb` | `0x85bd44e3…8342` |
| the same, runner, M1.12's zk-exec runs [41368126873](https://github.com/detychey/jiro-ikusu/actions/runs/41368126873) and [41374389802](https://github.com/detychey/jiro-ikusu/actions/runs/41374389802) | `/home/runner/work/jiro-ikusu/jiro-ikusu` | `0x1e72b2e22a97adf71a3fde993f810d0f51f2bd0b5a1ab707c3c196cfe38a448f` | `0x85bd44e3f94ab7402e9e64c0528b746ed3a0f4b7392cc3ae586093a28c418342` |
| the same, container, M4.8 | bind mount at `/home/runner/work/jiro-ikusu/jiro-ikusu` | `0x1e72b2e2…448f`, equal to the runner's | `0x85bd44e3…8342`, equal |
| this PR's guests, container | bind mount at `/home/runner/work/jiro-ikusu/jiro-ikusu` | `0xa3013dc48ccd9e8e28c6625a8362a1fde513e1c51ae1e50286445c0eae3702b1` | `0x16dc16aa81d061849365ab4fe6e0bda97fe3ef177bbc8eb1d9b742221cd6d4ee` |
| this PR's guests, runner, ci.yml's zk-exec job in run [41386734191](https://github.com/detychey/jiro-ikusu/actions/runs/41386734191) and the zk-prove run | `/home/runner/work/jiro-ikusu/jiro-ikusu` | `0xa3013dc4…02b1`, equal to the container's | `0x16dc16aa…d4ee`, equal |

So both programs' image ids match between the container and the runner when both build at the same path, from the same commit and toolchain; `CARGO_TARGET_DIR` (the container built into `/home/user/wt/zk-trial-risc0/referee/zk/target`), `CARGO_HOME` (`/root/.cargo` against `/home/runner/.cargo`) and the toolchain's directory differ and do not matter. The proofs below verify under one image id whichever environment made them.

RISC Zero's Docker build was not used. risc0-build 3.0.6 builds at `/src` inside `risczero/risc0-guest-builder` when given `use_docker`, and Docker Hub has its `r0.1.97.0` tag (3.0.6 defaults to `r0.1.88.0`, whose rustc 1.88 is older than the core's `rust-version` 1.96). In the container, Docker Hub answered that image's manifest with `429 Too Many Requests` (`ratelimit-remaining: 0`, at 03:08 UTC), and the build's `cargo fetch` step would run in a build container, which cannot reach the container's network proxy at `127.0.0.1` ([`TOOLING.md`](TOOLING.md), Docker). On Actions it would add the image's pull and a guest build from scratch to every zk-exec run. The fixed path needs neither, and CI already builds there.

### Proving

`zk-host prove` proves the verify program in three steps: the segment proofs (composite receipt), their recursion into one succinct receipt, both in the host process on the CPU, then the Groth16 wrapping in Docker. Every proof below verified against the image id `0xa3013dc4…02b1` and its public values matched the vectors' Outcomes (`verified: yes`). Times are wall times; "host" is the process's `VmHWM`, "Docker" the sampled resident memory of the Groth16 container, which runs after the host's peak.

| Environment | Mode | Vectors | Segment limit | Segments | Proving cycles (user) | Segment proofs | Recursion | Groth16 | Total | Peak host | Peak Docker | Seal |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| container | run | six small (below) | 2^20 | 7 | 7,340,032 (6,707,648) | 2,772.9 s | 357.0 s | 167.3 s | 3,297.2 s | 9,601,376 kB (9.2 GiB) | 7,205 MiB | 260 bytes |
| container | level | `worst-case` | 2^20 | 28 | 29,360,128 (27,762,027) | 11,428.3 s | 1,576.2 s | 172.3 s | 13,176.8 s | 9,616,060 kB (9.2 GiB) | 7,206 MiB | 260 bytes |
| runner | level | `commit-at-tick-0` | 2^19 | 3 | 1,310,720 (1,122,337) | 1,237.9 s | 430.7 s | 459.8 s | 2,128.4 s | 4,815,444 kB (4.6 GiB) | 6,551 MiB | 260 bytes |
| runner | run | six small (below) | 2^19 | 15 | 7,602,176 (6,707,648) | 6,812.1 s | 2,883.4 s | 472.4 s | 10,167.9 s | 4,818,616 kB (4.6 GiB) | 7,015 MiB | 260 bytes |

The run mode's six vectors are the six smallest accepted game vectors, `commit-at-tick-0`, `commit-during-cut`, `fast-cut`, `event-at-last-tick`, `slow-shield` and `last-life-on-last-tick` (6.7 million user cycles in all); `zk-host execute-run` checks them in 0.19 s. Replays are independent (README §7.3), so a run-mode proof need not come from one Challenge run.

- **The seal is 260 bytes in both modes**, the router's encoding: the selector `0x73c457ba`, then the 256-byte Groth16 seal. The public values are 384 bytes for a level and 2,304 for a run.
- **Memory follows the segment size,** not the mode or the program's length: 9.2 GiB in the host with 2^20-cycle segments in both container proofs, 4.6 GiB with 2^19 on the runner. The Groth16 container takes about 7.0 GiB in the container and 6.4 to 6.9 GiB on the runner, where the sampler saw at most 7,760 MiB used with 366 MiB of swap (run mode) and 7,364 MiB with 787 MiB of swap (level mode), and `dmesg` no out-of-memory kill.
- **Time follows the proving cycles.** In the container, a 2^20-cycle segment takes about 400 s on 4 CPUs (396 s each for the run's 7, 408 s for `worst-case`'s 28), and the recursion 51 to 56 s per segment. At that rate, the heaviest six-level run of the gate set (136,445,952 proving cycles in 131 segments, M1.12) would take about 16 to 17 hours on 4 CPUs, and on a 2-vCPU runner more than twice that. On the runner, a 2^19-cycle segment takes about 413 to 454 s on 2 vCPUs (1,237.9 s for 3, 6,812.1 s for 15), so about 2.1 to 2.3 times the container's time per cycle, and the recursion 144 to 192 s per segment.
- **`worst-case` on a runner** was not proven: it would need about 10 hours there (some 56 segments of 2^19 cycles at about 450 s each, then about 3 hours of recursion), beyond the job's 6-hour limit and the minutes budget. `zk-prove.yml` proves it on `workflow_dispatch` (its default level), which fits a public repository's 4-vCPU runners at the container's rate; this PR's run proves `commit-at-tick-0` in level mode instead.
- **Which environment succeeded:** both, in both modes. The container is the faster (4 CPUs); the runner needs 2^19-cycle segments to stay within its RAM.

The fixture [`contracts/test/fixtures/zk-proofs.json`](../contracts/test/fixtures/zk-proofs.json) holds the runner's level and run proofs, copied from the log between `=== BEGIN zk-fixture ===` and `=== END zk-fixture ===`, and the container's `worst-case` proof (`zk-host prove --level vectors/game/worst-case.json`'s output; each entry names its source).

### Verification gas

RISC Zero's 3.0 Groth16 verifier (`RiscZeroGroth16Verifier`, selector `0x73c457ba`), from the `risc0-ethereum` submodule at `v3.0.1`, called directly as a zk referee calls it (`docs/ECONOMY.md`, zk prover trust). [`contracts/test/ZkVerify.t.sol`](../contracts/test/ZkVerify.t.sol) rebuilds each proof's public values from its game vectors, as `abi.encode(uint16 weightBp, Outcome)` per level with `journalHash` and `levelId` computed from the journal and level bytes, and checks them against the fixture, then verifies the seal against `sha256` of them. A changed `levelScore`, and a level proof given a run's public values, revert with `VerificationFailed()`.

`cd contracts && forge test --match-contract ZkVerify --gas-report`:

```text
[PASS] test_aLevelProofDoesNotVerifyARun() (gas: 1969643)
[PASS] test_aLevelProofOfAnotherScoreReverts() (gas: 1590074)
[PASS] test_aLevelProofVerifies() (gas: 1028993)
[PASS] test_aRunProofVerifies() (gas: 1405409)
[PASS] test_theLevelProofCommitsTheVectorsEncoding() (gas: 742855)
[PASS] test_theRunProofCommitsTheVectorsEncoding() (gas: 1126772)
[PASS] test_theWorstCaseLevelProofVerifies() (gas: 1506289)
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 18.59ms (49.38ms CPU time)
| lib/risc0-ethereum/contracts/src/groth16/RiscZeroGroth16Verifier.sol:RiscZeroGroth16Verifier Contract |                 |        |        |        |         |
+==============================================================================================================================================================+
| Deployment Cost                                                                                       | Deployment Size |        |        |        |         |
|-------------------------------------------------------------------------------------------------------+-----------------+--------+--------+--------+---------|
|                                                                                               1185417 |            9387 |        |        |        |         |
|-------------------------------------------------------------------------------------------------------+-----------------+--------+--------+--------+---------|
|                                                                                                       |                 |        |        |        |         |
|-------------------------------------------------------------------------------------------------------+-----------------+--------+--------+--------+---------|
| Function Name                                                                                         | Min             | Avg    | Median | Max    | # Calls |
|-------------------------------------------------------------------------------------------------------+-----------------+--------+--------+--------+---------|
| verify                                                                                                |          225095 | 226592 | 227591 | 227591 |       5 |
|-------------------------------------------------------------------------------------------------------+-----------------+--------+--------+--------+---------|
| verifyProof                                                                                           |          215599 | 215599 | 215599 | 215599 |       5 |
╰-------------------------------------------------------------------------------------------------------+-----------------+--------+--------+--------+---------╯
```

- **Per proof: 227,591 gas for `verify`,** in both modes and for every proof: Groth16 verification costs the same whatever it proves, and the public values reach it only as a 32-byte digest. The caller adds the digest: the `SHA256` precompile costs 60 + 12 per word, 204 gas for a level's 384 bytes and 924 for a run's 2,304, plus the cost of encoding them.
- **On the chains:** `cast estimate` on the deployed 3.0 verifier `0x2a098988600d87650Fb061FfAff08B97149Fa84D` gives 256,471 gas for the fixture's level and run proofs and 256,483 for `worst-case` on Arbitrum One (block 520,506,667) and Arbitrum Sepolia (block 325,250,777), the transaction's intrinsic and calldata gas included, so each proof verifies on both chains; through the router `0x0b14…b711`, the container's run proof takes 276,995 on both, as M1.17 measured. With the digest changed to `0x…01`, the router reverts with `VerificationFailed()` (`0x439cc0cd`) on both.
- **Per run:** one run proof costs one verification, 227,591 gas; settling the six levels with six level proofs (`settleLevel`) costs six.

### Prover network price

Boundless, RISC Zero's proof market on Base (M1.17, [Prover network](#prover-network-1)). Its indexer lists every request with its proof type: `GET https://d2mdvlnmyov1e1.cloudfront.net/v1/market/requests?limit=500`, paged by cursor, which `openapi.json` at the same host documents. Read on 2026-11-02 at 03:14 UTC; the requests created in the 7 days before, from 2026-10-26 03:19 to 2026-11-02 03:05 UTC, on Base (chain 8453):

- **1,411 requests: 1,376 fulfilled, 34 expired, 1 locked.** Of the fulfilled, 1,370 ask for selector `73c457ba`, a raw 3.0 Groth16 seal, the 260-byte seal that `ZkVerify.t.sol` verifies, and 6 for selector `00000000`, a Merkle inclusion into an aggregated set (196-byte seals starting `0x242f9d5b`). Over the 14 days read, 2,942 fulfilled requests delivered a 260-byte seal starting `0x73c457ba`. **This corrects M1.17:** the market's prices are mostly raw Groth16 prices, not aggregated ones, so a raw Groth16 seal is priced.
- **Two requesters and two provers** account for all the raw Groth16 requests: `0x7276fa3c…19c9` (1,307 requests, all `ClaimDigestMatch`, 176 million to 4.6 billion total cycles) and `0x68f4482f…7483` (63, `DigestMatch`, from 5.2 million cycles); provers `0x8252c632…2ec8` (1,235) and `0xa6c2cc7c…a024` (135).
- **The price barely depends on the cycles.** A least-squares fit of lock price on total cycles over the 1,307 fulfilled `ClaimDigestMatch` Groth16 requests gives 0.0000153 ETH + 17,383 wei per cycle, with R² 0.19; over the 63 `DigestMatch` ones, R² 0.00. The fixed part, the prover's Groth16 wrapping and its fulfilment gas on Base, dominates at these sizes.

| Fulfilled raw Groth16 requests | Requests | Predicate | Total cycles, median | Lock price p10 | p50 | p90 |
|---|---:|---|---:|---:|---:|---:|
| 5.2 to 45 million cycles | 39 | `DigestMatch` (journal delivered onchain) | 45,088,768 | 0.0000265 ETH | 0.0000550 ETH | 0.0000557 ETH |
| 176 to 196 million cycles | 788 | `ClaimDigestMatch` | 187,957,248 | 0.0000138 ETH | 0.0000184 ETH | 0.0000233 ETH |
| any size | 1,370 | both | 193,986,560 | 0.0000139 ETH | 0.0000188 ETH | 0.0000350 ETH |

The lowest price of the week was 0.0000134 ETH. A settler needs the seal, not the journal, onchain on Base: it computes the public values itself. So `ClaimDigestMatch` is the request a referee's prover would make, and its 176 to 196 million-cycle bucket, above the heaviest run's 136,445,952 proving cycles, prices our proofs: since the price does not fall with fewer cycles, it serves for both modes. With ETH at $2,295.05 (CoinGecko `simple/price`, 2026-11-02 03:15 UTC):

| Proof | Proving cycles | Expected price (p50) | p10 to p90 | Against the 0.00005 ETH run fee |
|---|---:|---|---|---:|
| One level, `commit-at-tick-0` to `10-worst` | 1,310,720 to 30,932,992 | 0.0000184 ETH ($0.042) | 0.0000138 to 0.0000233 ETH | 37% |
| One six-level run, the six small vectors to the heaviest six | 7,340,032 to 136,445,952 | 0.0000184 ETH ($0.042) | 0.0000138 to 0.0000233 ETH | 37% |
| One run as six level proofs | | 0.000110 ETH ($0.25) | | 220% |

These are a thin market's prices (two requesters, two provers), and the `ClaimDigestMatch` requests all come from one requester whose programs are larger than ours; the `DigestMatch` requests near our sizes paid three times as much (p50 0.000055 ETH), with the journal delivered onchain. No request was made: it needs a funded Base wallet and a public program URL (round F0).

### Season aggregation

RISC Zero's aggregation tooling is in `risc0-ethereum` `v3.0.1`: the `risc0-aggregation` 0.9.0 crate and its set-builder guest, which verifies a batch of receipts' claims inside the zkVM and commits the Merkle root of their claim digests, and `RiscZeroSetVerifier.sol`, which checks one Groth16 proof of that root (`submitMerkleRoot`, which caches it) and then each claim by its Merkle path (`verify` with a set-inclusion seal). Boundless's default delivery is this, on Base. `contracts/deployment.toml` at `v3.0.1` lists no set verifier on Arbitrum, so a season would deploy its own, pinned to the set builder's image id.

- **Onchain, measured with the framework's tests:** `cd contracts/lib/risc0-ethereum/contracts && forge test --match-contract RiscZeroSetVerifier --gas-report` (7 tests passed, fuzzed over random sets, with the mock verifier for the root): `verify` of one claim against a cached root takes 7,147 to 8,418 gas (median 8,358); `submitMerkleRoot` takes 54,438 gas with the mock root verifier, whose `verify` takes 3,376, so about 51,062 plus one real Groth16 verification (227,591) with the real one.
- **Against one proof per run,** for N verified runs in a season: N × 227,591 gas, against about 278,653 + N × 8,400 for one root and N inclusions. Aggregation is cheaper from N = 2, and for 100 runs takes about 1,118,653 gas against 22,759,100.
- **Proving side:** each run still needs its succinct receipt (segment proofs and recursion, without its own Groth16 wrapping), then one set-builder proof and one Groth16 wrapping per batch. Not run here: the set builder, its host and its Groth16 step are another build of the size of this host's, and their proving time is not measured. On Boundless, aggregation is the default delivery and is not priced separately: its 6 default requests of the week paid a median of 0.0000216 ETH, for 1.3 to 4.1 billion cycles each.
- **For M4.9:** aggregation saves verification gas, not proving cost, and needs a batch: runs settle only once the season's batch is proven, after the season's end and within its grace.

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
- **The calldata floor.** EIP-7623 charges at least 21,000 + 10 gas per calldata token (a zero byte is 1 token, any other byte 4). Anvil 1.8.6 applies it to the full blob under every hardfork tried (shanghai, cancun and prague): 21,000 + 10 × 191,939 = 1,940,390. Foundry's test EVM does not. Whether Arbitrum's ArbOS charges the floor is not verified here; M4.16 measures the commit on nitro-devnode. It does not, on nitro-devnode ([End-to-end gas](#end-to-end-gas)).
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
- **Calldata dominates.** Each level adds its 472 level bytes and its journal. Under EIP-7623's calldata floor ([Challenge gas](#challenge-gas)), `settleRun` would cost at least 21,000 + 10 × 88,477 tokens = 905,770 gas. As for `commitRun`, M4.16 measures what ArbOS charges ([End-to-end gas](#end-to-end-gas)), and Arbitrum's L1 data fee comes on top.
- **Not cross-checked on anvil.** M4.6 matched Foundry's metering against anvil's receipts for `startRun`, `revealRun` and `commitRun`; M4.7 did not repeat that check for settlement.
- **The other steps moved.** With settlement in `Challenge`, `forge test --match-contract ChallengeGas -vv` now gives `startRun` 131,976, `revealRun` 63,294, and `commitRun` 99,113 (typical blob) and 864,133 (full blob): 10 to 78 gas more than the table above, from the longer function dispatch.

## End-to-end gas

M4.16 ran a Challenge season end to end on nitro-devnode with the real Stylus referee: [`e2e.yml`](../.github/workflows/e2e.yml) starts the node with the vendored [`run-dev-node.sh`](../scripts/contracts/nitro/run-dev-node.sh) (`offchainlabs/nitro-node:v3.12.2-5f02f3f`, digest `sha256:87548501c3ee41cff84e6764cc86f65eb7f0a14e2e50a0d3219d462e5793680d`), and [`scripts/contracts/e2e.mjs`](../scripts/contracts/e2e.mjs) deploys a generation with `deploy.mjs` (forge 1.8.6, solc 0.8.28; the referee through cargo-stylus 0.10.10, wasm sha256 `afb5755f2cd3b24d586ded67d3c9e77c37a4aef00a03e6bcea2a2965339f58db`), opens a season of 30 s with a grace of 120 s and a `commitSlack` of 30 s, and runs its six cases. Every figure is a receipt's `gasUsed`; `run-dev-node.sh` sets the L1 price per unit to 0, so no L1 data component is included.

```bash
node scripts/contracts/e2e.mjs --network nitro-devnode   # DEPLOYER_KEY: the development key of run-dev-node.sh
node scripts/contracts/e2e.mjs --network local           # anvil and MockReferee, no Stylus
```

- **CI run:** [41350044090](https://github.com/detychey/jiro-ikusu/actions/runs/41350044090), on PR #52 at 0c5a9057d6ff50687ed3f78b70f545e2261cf9ec. The first run, [41348621860](https://github.com/detychey/jiro-ikusu/actions/runs/41348621860) at dc4043a, also passed every case, on other drawn levels: its `settleRun` took 19,514,026 gas over 4,181 ticks.
- **Deployment:** ArbBlockhashEntropy 496,001, the referee's deployment 4,163,379 and its activation 4,039,010, Season 1,736,792, Challenge 1,971,245, `bindChallenge` 45,310.
- **The drawn levels.** The bots cleared five of the happy path's six levels, and committed the sixth, in 3,332 ticks used; they cleared the six of the fallback run in 4,236.

| Case | Transaction | Calldata bytes | EIP-7623 floor | Gas |
|---|---|---:|---:|---:|
| setup | fund the player | 0 | 21,000 | 21,000 |
| setup | fund the settler | 0 | 21,000 | 21,000 |
| setup | ArbOwner.setMaxTxGasLimit(200000000) | 36 | 21,570 | 21,228 |
| setup | Season.open | 1,284 | 51,180 | 961,140 |
| happy path | Challenge.startRun | 36 | 21,510 | 162,179 |
| settleLevel fallback | Challenge.startRun | 36 | 21,510 | 127,979 |
| late commit | Challenge.startRun | 36 | 21,510 | 127,979 |
| copied journal | Challenge.startRun | 36 | 21,510 | 127,979 |
| wrong rulesVersion | Challenge.startRun | 36 | 21,510 | 127,979 |
| setup | advanceBlocks(41), in total | 0 | 861,000 | 861,000 |
| happy path | Challenge.revealRun | 36 | 21,510 | 59,396 |
| settleLevel fallback | Challenge.revealRun | 36 | 21,510 | 59,396 |
| late commit | Challenge.revealRun | 36 | 21,510 | 59,396 |
| copied journal | Challenge.revealRun | 36 | 21,510 | 59,396 |
| wrong rulesVersion | Challenge.revealRun | 36 | 21,510 | 59,396 |
| happy path | Challenge.commitRun | 4,740 | 177,990 | 145,772 |
| settleLevel fallback | Challenge.commitRun | 5,092 | 192,520 | 151,664 |
| copied journal | Challenge.commitRun | 4,740 | 177,990 | 145,772 |
| wrong rulesVersion | Challenge.commitRun | 1,028 | 44,510 | 91,235 |
| late commit | advanceBlocks(1), in total | 0 | 21,000 | 21,000 |
| late commit | Challenge.commitRun | 1,028 | 44,540 | 91,247 |
| happy path | Challenge.settleRun | 8,100 | 216,690 | 29,858,349 |
| settleLevel fallback | Challenge.settleLevel 0 | 1,476 | 56,100 | 3,328,208 |
| settleLevel fallback | Challenge.settleLevel 1 | 2,020 | 76,810 | 7,906,986 |
| settleLevel fallback | Challenge.settleLevel 2 | 1,796 | 69,710 | 5,613,435 |
| settleLevel fallback | Challenge.settleLevel 3 | 1,828 | 69,280 | 5,573,605 |
| settleLevel fallback | Challenge.settleLevel 4 | 1,604 | 67,700 | 3,900,911 |
| settleLevel fallback | Challenge.settleLevel 5 | 1,508 | 56,660 | 4,291,250 |
| late commit | Challenge.settleRun | 4,388 | 83,510 | 1,678,634 |
| season close | advanceBlocks(1), in total | 0 | 21,000 | 21,000 |
| season close | Season.closeSeason | 4 | 21,160 | 126,080 |
| season close | Season.claim | 36 | 21,510 | 84,198 |
| season close | Season.withdrawRake | 4 | 21,160 | 57,109 |

- **`settleRun` is close to Arbitrum's cap.** The happy path's `settleRun` took 29,858,349 gas: 93 % of the 32M L2 gas per transaction of README §7.3, whose P16 expects six replays to fit "well within" it. The fallback run's six `settleLevel` calls sum to 30,614,395, so as one `settleRun` it would have been about as close. Gas does not follow ticks: the first run's `settleRun` took 19,514,026 over more ticks, 4,181. A later run, [41352708191](https://github.com/detychey/jiro-ikusu/actions/runs/41352708191) at d2e71cc, took 31,174,196 over 4,608 ticks, 97 % of the cap. A run of longer levels would not fit: `settleLevel` is then its only path, until M4.9's gate and M4.15's optimization lower the replay cost. The suite raises nitro-devnode's per-transaction cap to 200M through `ArbOwner.setMaxTxGasLimit`, so that such a run still settles and is measured; its table names every transaction above 32M (none on these three runs).
- **ArbOS charges no calldata floor.** `commitRun` with 4,740 bytes of calldata took 145,772 gas on nitro-devnode, below its EIP-7623 floor of 177,990, which anvil 1.8.6 charges ([Challenge gas](#challenge-gas)): the floor is not applied on this node.

## D2: the backend

Plan M4.9, 2026-11-02: the M4 gas gate, the cycles of the 16 levels, the backend and testnet aggregation.

**D2 = zk for testnet.** The owner approved it on 2026-11-02 ("Approve D2 = zk (Recommended)"), from readings of `activationGas` = 2^64 − 1, activations paused, at Arbitrum Sepolia block 325,114,240 and Arbitrum One block 520,390,941. M4.9's fresh readings, at blocks 325,258,195 and 520,513,231 ([Stylus activation](#stylus-activation)), still read paused. The plan's rule is Stylus whenever activations are open on the target chain, and ZkReferee while they stay paused. The gate below failed while activations were paused, so M4.15, the Stylus gas optimization, is deferred (plan §16), and zk meets README §9's M4 gate through its measured costs.

- **What M4.14 deploys:** `ZkReferee` (M4.10), pinned to the verify program's image id and calling RISC Zero's 3.0 Groth16 verifier `0x2a098988600d87650Fb061FfAff08B97149Fa84D` directly, never the router ([Verification gas](#verification-gas), `docs/ECONOMY.md`). Each verified run gets one run proof, settled by `settleRun`, with `settleLevel` as the fallback.
- **Switching backends later** means opening a new season whose referee is the other backend (README §8.4, M0.7): a season's referee is fixed at `open`, and the runs of earlier seasons keep settling through their own.

### Gas gate

The gate of plan §4: the maximum `eth_estimateGas` of `verify` over the 32 gate-set vectors of `vectors/levels/`, on nitro-devnode, at most 1,000,000.

- **Run:** [`stylus-gas.yml` 41412617292](https://github.com/detychey/jiro-ikusu/actions/runs/41412617292), dispatched on this branch at `e7e8366` (`main` after M4.8; `core/`, `referee/` and `vectors/` unchanged since M4.2's run).
- **Result: FAIL.** The maximum is 11,599,408 gas, on `levels/10-worst`, 11.6 times the gate. All 32 gate-set vectors are above 1,000,000; the lowest is `05-worst`, at 1,599,425.
- **Same as M4.2.** The run's table equals [the table above](#table) in all 75 rows, from the same module (44,500 bytes raw, sha256 `afb5755f…8db`), on `offchainlabs/nitro-node` digest `sha256:87548501…680d`, with cargo-stylus 0.10.10. Its log ends `Outcomes: 75 vectors and 200 difffuzz cases checked, 0 mismatches.` and `Maximum: 11,599,408 gas (levels/10-worst).`
- **Billed:** 12 minutes (11 min 44 s), 9 of them building cargo-stylus, since a dispatch on a new branch finds no cache for it ([`TOOLING.md`](TOOLING.md#actions-minutes)).

### Cycles of the 16 levels

**Source.** These cycles are M1.12's executor measurement at `3cc7991` ([`vectors/levels/`](#vectorslevels-1) and [The merged referee](#the-merged-referee)), not a new run: the zk host was not rebuilt for M4.9. M4.8 changed the verify guest (a level-count check). `ci.yml`'s zk-exec job on `main` at `e7e8366` ([run 41411863291](https://github.com/detychey/jiro-ikusu/actions/runs/41411863291), verify image id `0xa3013dc4…02b1`) ran 14 accepted vectors, 11 format vectors and 3 game vectors, none of them in `vectors/levels/`. Each took exactly 4 user cycles fewer than M1.12 measured (`worst-case` 27,762,027 against 27,762,031), with the same proving cycles and segments. So current user cycles are the table's less 4, and the proving cycles, which set the price, are the table's.

| Level | `NN-worst` user cycles | `NN-synthetic` user cycles | Proving cycles, the heavier vector | `NN-worst` gas | `NN-synthetic` gas |
|---|---:|---:|---:|---:|---:|
| 01 | 17,456,884 | 17,192,157 | 18,350,080 (`01-worst`) | 6,308,876 | 6,283,665 |
| 02 | 17,884,065 | 17,625,909 | 18,874,368 (`02-worst`) | 6,424,170 | 6,402,435 |
| 03 | 18,343,312 | 18,021,074 | 19,398,656 (`03-worst`) | 7,283,863 | 7,186,359 |
| 04 | 21,026,792 | 17,216,385 | 22,020,096 (`04-worst`) | 7,655,029 | 6,044,284 |
| 05 | 4,374,793 | 14,339,392 | 15,204,352 (`05-synthetic`) | 1,599,425 | 5,109,935 |
| 06 | 4,871,040 | 16,657,852 | 17,825,792 (`06-synthetic`) | 1,948,272 | 6,006,621 |
| 07 | 16,362,196 | 15,285,707 | 17,301,504 (`07-worst`) | 5,883,429 | 5,459,181 |
| 08 | 20,082,508 | 14,774,530 | 20,971,520 (`08-worst`) | 7,868,570 | 5,517,927 |
| 09 | 5,568,177 | 15,508,836 | 16,252,928 (`09-synthetic`) | 2,190,902 | 5,660,938 |
| 10 | 29,588,717 | 16,506,110 | 30,932,992 (`10-worst`) | 11,599,408 | 6,275,699 |
| 11 | 7,914,935 | 15,408,096 | 16,252,928 (`11-synthetic`) | 3,063,991 | 5,697,751 |
| 12 | 6,714,834 | 15,179,454 | 15,990,784 (`12-synthetic`) | 2,727,967 | 5,676,793 |
| 13 | 14,996,188 | 14,498,151 | 15,728,640 (`13-worst`) | 5,298,297 | 5,128,489 |
| 14 | 17,059,828 | 18,342,944 | 19,398,656 (`14-synthetic`) | 6,773,301 | 7,057,238 |
| 15 | 17,682,184 | 15,177,858 | 18,874,368 (`15-worst`) | 6,722,971 | 5,566,942 |
| 16 | 23,371,284 | 14,683,581 | 24,641,536 (`16-worst`) | 9,447,196 | 5,653,844 |

The summary below takes each level's heavier vector. A six-level run plays six different levels of the 16, drawn uniformly (README §8.2), so its median is over all 8,008 draws, and its figure is the sum of its six levels' (for gas, six `verify` transactions). Measured, the heaviest run (`zk-host execute-run`, M1.12) took 130,741,601 user cycles, 13,956 fewer than its levels' sum, and 136,445,952 proving cycles, against 137,363,456 summed.

| | User cycles | Proving cycles | Stylus `verify` gas |
|---|---:|---:|---:|
| Per level: maximum | 29,588,717 (`10-worst`) | 30,932,992 (`10-worst`) | 11,599,408 (`10-worst`) |
| Per level: median of the 16 | 17,569,534 | 18,612,224 | 6,366,523 |
| Per level: minimum | 14,339,392 (`05-synthetic`) | 15,204,352 (`05-synthetic`) | 5,109,935 (`05-synthetic`) |
| Six-level run: maximum | 130,755,557 (measured: 130,741,601) | 137,363,456 (measured: 136,445,952) | 50,911,304 |
| Six-level run: median of the 8,008 draws | 108,992,200 | 114,819,072 | 41,001,984 |
| Six-level run: minimum | 91,794,162 | 96,731,136 | 33,327,143 |

- **On Stylus, no gate-set run fits one transaction.** Six `verify` figures sum to 33.3 to 50.9 million gas, above Arbitrum's 32 million L2 gas per transaction (README §7.3, P16), so such a run could settle only level by level. The bots' runs of [End-to-end gas](#end-to-end-gas), with shorter journals, took 19.5 to 31.2 million in one `settleRun`.
- **On zk, cycles barely move the price.** Every level and every run of the gate set takes fewer proving cycles than the 176 to 196 million-cycle requests that price our proofs, and the Boundless price barely follows cycles (R² 0.19, [Prover network price](#prover-network-price)), so a level proof and a run proof cost the same.

### Costs side by side

ETH costs at Arbitrum One's base fee of 0.020036 gwei (block 520,514,288, 2026-11-02 08:23:42 UTC) and ETH at $2,285.67 (Coinbase spot, the same minute), before Arbitrum's L1 data fee, which neither M4.7 nor M4.16 measured.

| | Stylus referee | zk: RISC Zero, one Groth16 proof per run |
|---|---|---|
| Deployable now | No: activations paused on both chains | Yes: the 3.0 verifier is live on Arbitrum One and Sepolia |
| Verification gas, one level | 5.1 to 11.6 million, median 6.4 million (above) | 227,591 for one proof ([Verification gas](#verification-gas)) |
| Verification gas, one run | 33.3 to 50.9 million over the gate set, beyond the 32 million cap; 19.5 to 31.2 million for the bots' runs | 227,591: one run proof |
| Cycles, one run | none | about 97 to 137 million proving cycles, median 115 million, as sums of the levels'; the heaviest run measured 136.4 million (above) |
| Proving cost, one run | none | 0.0000184 ETH ($0.042) on Boundless, p10 to p90 0.0000138 to 0.0000233 ETH; on the CPU, about 16 to 17 hours on 4 CPUs for the heaviest run ([Proving](#proving)) |
| Settlement overhead (M4.7), the same for both | `settleRun` 576,603 gas; `settleLevel` 154,050, or 172,905 for the level that records the run ([Settlement gas](#settlement-gas)) | the same |
| One verified run, against its 0.00005 ETH fee | a bots' run's `settleRun` (29,858,349 gas, M4.16), with nothing to prove: 0.00060 ETH ($1.37), 12 times the fee | 804,194 gas (verification and settlement), 0.0000161 ETH, plus 0.0000184 ETH of proving: 0.0000345 ETH ($0.079), 69% of the fee |
| Aggregation option (M4.8) | does not apply | about 278,653 gas per batch, plus about 8,400 per run, against 227,591 per run; the proving price per run does not fall ([Season aggregation](#season-aggregation)) |

Verification is by exception (README §7.3): a season verifies each player's best run, not every run.

### Aggregation on testnet

**Decided: testnet-1 does not aggregate** (owner, 2026-11-02, "No aggregation (Recommended)"). Each verified run is proven and settled on its own, through `ZkReferee` and the Groth16 verifier.

- **It saves little.** Aggregation saves verification gas, at most about 219,000 gas per run at large batches: 0.0000044 ETH ($0.010) at the base fee above, 13% of a verified run's cost. The proving price, more than half of that cost, does not fall: each run still needs its own proof, then the batch its set-builder proof.
- **It adds a pipeline.** RISC Zero's set builder is another zkVM build the size of the host's, whose proving time is not measured. Boundless delivers its aggregated proofs to its own set verifier on Base, and `risc0-ethereum` `v3.0.1` lists no set verifier on Arbitrum, so a season would deploy one, pin the set builder's image id, and submit each batch's root before any of its runs settles.
- **It delays settlement.** Runs settle only once their batch is proven, after the season's end and within its grace, and a player who proves their own run (`docs/ECONOMY.md`, threats) would need it in a batch.
- **Testnet scale.** A testnet season verifies a few best runs, on Arbitrum Sepolia's free ETH.

Aggregation stays a pre-mainnet prerequisite if zk becomes the mainnet path (plan §16), where the number of verified runs per season is known.

## ZkReferee

Plan M4.10, 2026-11-02: the zk backend behind `IReferee`, which M4.14 deploys (D2 = zk). [`contracts/src/ZkReferee.sol`](../contracts/src/ZkReferee.sol) holds three immutables: RISC Zero's verifier, the verify program's image id and its rules version. The verifier is the 3.0 Groth16 verifier `0x2a098988600d87650Fb061FfAff08B97149Fa84D` on Arbitrum One and Sepolia, called directly, never the router ([Verification gas](#verification-gas), `docs/ECONOMY.md`). `Challenge` and `Season` are unchanged.

- **The proof** is `abi.encode(bytes seal, bytes publicValues)`, the two values `zk-host prove` prints between its `zk-fixture` markers. `verify` requires 384 bytes of public values and `verifyRun` 2,304, so a level proof and a run proof cannot stand in for each other. `ZkReferee` verifies the seal against `sha256(publicValues)` and its image id, decodes the public values as `(uint16 weightBp, Outcome)` per level ([`referee/zk/README.md`](../referee/zk/README.md#public-values)), and requires each level's weight, `journalHash` and `levelId` to be the submitted ones. `Challenge` then binds the Outcomes to the run (README §7.2).
- **Proving a run:** `zk-host prove --run <run file> --season <season file>` ([Run file v1](#run-file-v1)); the season file gives each level's weight by its draw slot. The host executes the run first and checks each level's weight, level id, run nonce, level index, draw slot, mode and rules version before it proves.
- **Deployment:** `deploy.mjs --backend zk --image-id <zk-host image-id> --rules-version <n>`, over RISC Zero's mock verifier `RiscZeroMockVerifier` on the local chains and the Groth16 verifier elsewhere ([`deployments/README.md`](../deployments/README.md)).

### The fixture set

**The full set: one real run proof of six levels**, `challengeRun` in [`contracts/test/fixtures/zk-proofs.json`](../contracts/test/fixtures/zk-proofs.json), proving the run file [`contracts/test/fixtures/zk-run.json`](../contracts/test/fixtures/zk-run.json). It was proven **in the agent's container, not by a `zk-prove.yml` dispatch**: this month's Actions minutes were nearly used up (about 1,460 of 1,500), and the owner chose local checks only. The build ran at the fixed path, from a bind mount of the worktree, so its verify image id is `0xa3013dc48ccd9e8e28c6625a8362a1fde513e1c51ae1e50286445c0eae3702b1`, M4.8's, the runner's.

The run is run 1 of `ZkRefereeTest`'s deployment (`Challenge` `0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9` on chain 31337), in a season of `seasons/calibration-1.json`. MockArbSys's block hashes make its nonce `0xaab42536f4ae3853662197c83122e0ffaa0ab9b1a96ac78169485803947768a9` on every test run. Each drawn level was played by the `bold` bot (`jiro-tools playtest --policy bold --nonce … --level-index i`). To keep the proof to about two hours on 4 CPUs, the first five levels were then closed at tick c by an X, as a client closes a level early (README §7.2), keeping the bot's events before c. The sixth was kept whole: the bot cleared it.

| Level index | Level | Draw slot | Weight | Closed at | End reason | Claim | Ticks used | Score | Journal |
|---:|---|---:|---:|---:|---|---:|---:|---:|---:|
| 0 | `02-sentry` | 1 | 15,586 | 90 | Committed | 1,640 | 91 | 2,556 | 116 B |
| 1 | `10-maze` | 9 | 13,692 | 60 | Committed | 902 | 61 | 1,235 | 122 B |
| 2 | `03-heavy` | 2 | 15,770 | 30 | Committed | 856 | 31 | 1,349 | 104 B |
| 3 | `08-storm` | 7 | 14,979 | 90 | Committed | 983 | 91 | 1,472 | 167 B |
| 4 | `14-titan` | 13 | 28,591 | 30 | Committed | 570 | 31 | 1,629 | 110 B |
| 5 | `04-pair` | 3 | 15,758 | | Cleared | 8,168 | 262 | 12,871 | 260 B |

The native replay gives a run score of 21,112, 567 ticks and 1 clear; `ZkReferee.t.sol` settles the run through `Challenge` and expects exactly these in `RunSettled`.

Measured with `bash referee/zk/peak-memory.sh <zk-host> prove --run contracts/test/fixtures/zk-run.json --season seasons/calibration-1.json`, from the build at the fixed path, on 4 CPUs with 15.7 GiB of RAM, in the 13.36 GiB memory cgroup of M4.8. The Groth16 image `risczero/risc0-groth16-prover:v2025-04-03.1` (digest `sha256:a4f80ce2…a64ee`) pulled in 1 min 30 s through the registry mirror. It ran from 11:20:02 to 13:27:21 UTC, alone:

| Environment | Mode | Input | Segment limit | Segments | Proving cycles (user) | Segment proofs | Recursion | Groth16 | Total | Peak host | Peak Docker | Seal |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| container | run | `zk-run.json` | 2^20 | 16 | 16,777,216 (15,374,362) | 6,554.7 s | 913.3 s | 170.4 s | 7,638.5 s | 9,613,604 kB (9.2 GiB) | 7,207 MiB | 260 bytes |

- **Per segment:** 410 s of segment proving and 57 s of recursion, M4.8's rate ([Proving](#proving)). The six levels take 15.4 million user cycles for 567 ticks: each level's setup costs more than the ticks of these short journals.
- **Checked twice:** the host checked the executor's public values against the run file and the season before proving, and the Groth16 receipt's after (`verified: yes`). The public values equal the dev-mode receipt's, sha256 `0x1bed6b0e…3557`.

### Tests and gas

`cd contracts && forge test --match-contract ZkReferee -vv --gas-report`, with forge 1.8.6 and solc 0.8.28. All 12 tests pass, each one scenario:

- The run settles through `Challenge` with the real proof, and `RunSettled` carries the native replay's score, ticks and clears.
- `verifyRun` reverts in four cases: on tampered public values (`VerificationFailed`, from the verifier), under another image id (`VerificationFailed`), with another weight (`WeightMismatch`), and with another level (`LevelIdMismatch`).
- `settleRun` of a run whose committed journal 3 differs from the proven one reverts with `JournalHashMismatch`.
- A level proof does not pass as a run proof, and the reverse (`PublicValuesLengthMismatch`).
- `verify` returns M4.8's level proof's Outcome, equal to its vector's.
- The rest cover `rulesVersion()` and the constructor's checks.

Gas from the traces (`-vvvv`), each a call's own frame, without the transaction's 21,000 and its calldata:

| Call | Gas | Of which the Groth16 verifier's `verify` | ZkReferee's own |
|---|---:|---:|---:|
| `ZkReferee.verifyRun`, the fixture run | 262,251 | 225,091 | 37,160 |
| `ZkReferee.verify`, M4.8's level proof of `commit-at-tick-0` | 235,730 | 225,091 | 10,639 |
| `Challenge.settleRun`, the fixture run, `verifyRun` and `Season.recordRun` (75,319) included | 525,983 | 225,091 | |

- **ZkReferee's own gas** covers decoding the proof, the `sha256` of the public values, decoding the Outcomes, and hashing each level and journal, which `Challenge` also hashes.
- **Calldata:** this run's `settleRun` carries 7,524 bytes (5,713 of them zero), of which the proof is 2,720: 51,828 gas at EIP-2028's prices. EIP-7623's floor for it, 150,570 with the 21,000 included, is below the transaction's gas, so it does not apply. Settlement gas grows with the journals' calldata ([Settlement gas](#settlement-gas)); the verification stays near 262,000 per run, plus ZkReferee's hashing of longer journals.
- **Against M4.9's estimate,** which put a verified run at 804,194 gas (227,591 for the proof and M4.7's 576,603 of settlement): this run's `settleRun` takes 525,983 plus 51,828 of calldata and the 21,000 base, 598,811 in all, with short journals.

### End to end, zk mode

`node scripts/contracts/e2e.mjs --network local --zk`, run in the container from the fixed path on 2026-11-02 (anvil 1.8.6, forge 1.8.6): ZkReferee over `RiscZeroMockVerifier`, pinned to `zk-host image-id`, and every settlement with a dev-mode proof of `RISC0_DEV_MODE=1 zk-host prove`. The happy path's and the late run's run files go through `prove --run <run file> --season`, and each level of the fallback run through `prove --level`, as a game vector holding its native Outcome. Every case passed: the happy path settled with score 88,580, 3,783 ticks and 6 clears, and the `settleLevel` fallback with 74,836, 3,445 and 6, both as the native replay. The late run was marked late. The copied journal reverted with `OutcomeRunNonceMismatch`. For the wrong rulesVersion run, the prover refused with replay's code 4, so no proof of it exists. The six dev-mode proofs took under a second. The mock verifier's gas is not the Groth16 verifier's, so these figures are not costs:

| Transaction | Calldata bytes | Gas |
|---|---:|---:|
| deploy RiscZeroMockVerifier | | 509,372 |
| deploy ZkReferee | | 762,698 |
| `Challenge.settleRun`, happy path | 10,084 | 345,558 |
| `Challenge.settleLevel` 0 to 5, fallback | 1,732 to 2,308 | 94,407 to 113,229 |
| `Challenge.settleRun`, late run | 6,884 | 219,473 |

`e2e.yml` gains an `e2e-zk` job that runs this command on anvil, building the zk host with ci.yml's zk-exec cache. Because of the minutes budget, this PR does not run it.

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
