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

## zkVM trials

Trial records of the zkVM frameworks for the zk path of `IReferee` (README §7.3). Each framework gets one row in the summary and one section below, with the same fields in the same order. M1.16 measured SP1 and M1.17 RISC Zero, in the same shape, and [SP1 and RISC Zero side by side](#sp1-and-risc-zero-side-by-side) sets their facts next to each other. M1.12 then compares the frameworks that pass the four tooling checks, on cycles and price, and records the choice in README §13 D2.

The four tooling checks of README §7.3:

1. **Install:** it installs and runs in the agent's cloud environment.
2. **Execute:** it executes guests locally, with cycle counts and without a GPU.
3. **Mock:** it has a fast mock or dev mode for tests.
4. **Verifier:** it has a verifier contract on Arbitrum, with Foundry test support.

### Summary

| Framework | Version | Install | Execute | Mock | Verifier | Vectors reproduced | Cycles, heaviest level | CPU proof of a small level | Onchain-verifiable wrapping | Prover network, Groth16 proof of a six-level run | Kept branch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SP1 | v6.10.0 (circuits v6.1.0) | PASS | PASS | PASS | PASS | 75 of 75 | 31,227,278 (`10-worst`) | core: 92 s, 11.6 GiB; compressed: out of memory at 13.4 GiB | FAIL: out of memory in the container and on Actions | 0.433 PROVE (about 0.00004 ETH) | `zk-trial-sp1` |
| RISC Zero | 3.0.6 (Groth16 verifier 3.0.0) | PASS | PASS | PASS | PASS | 75 of 75 | 29,588,717 user, 30,932,992 proving (`10-worst`) | composite: 965 s, 9.2 GiB (832 s, 4.6 GiB with 2^19 segments) | PASS in the container (verified on Arbitrum One and Sepolia); @@ACTIONS_SUMMARY@@ | Boundless, about 0.000011 ETH ($0.024) at market averages | `zk-trial-risc0` |

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

Measured on 2026-11-01 in the same container as SP1: 4 CPUs, 15.7 GiB of RAM, no swap, no GPU, and the same 13.36 GiB memory cgroup, which also holds `dockerd`. Another session's play test kept about two of the four CPUs busy throughout, so the build and proving times below are slower than an idle machine's. The code is the kept branch `zk-trial-risc0` at commit `@@CODE_SHA@@`. The core is that of `main` at `a992075` (`RULES_VERSION` 2), whose `core/`, `vectors/game/` and `vectors/levels/` are unchanged since `cd3121d`, the base of SP1's trial.

#### Version and install

- **Version:** the crates `risc0-zkvm` and `risc0-build` pinned to `=3.0.6`, the newest release on crates.io on 2026-11-01 (`3.1.0-rc.1` and `5.0.0-rc.1` are release candidates). They resolve to the `risc0-circuit-rv32im` and `risc0-circuit-recursion` 4.0.5 circuits, `risc0-groth16` 3.0.5 and the `rzup` 0.5.2 library. The host enables `risc0-zkvm`'s `prove` feature, the in-process CPU prover; the guest uses `default-features = false, features = ["std"]`.
- **Toolchain:** `~/.risc0/toolchains/v1.97.0-rust-x86_64-unknown-linux-gnu/bin/rustc --version` prints `rustc 1.97.0-dev (e638c6cfe 2026-07-15)` (LLVM 22.1.6), the value that M0.2 recorded in [`TOOLING.md`](TOOLING.md). risc0-build 3.0.6 compiles the guest locally with that toolchain, which it finds through `~/.risc0/settings.toml` (its build output reads `Using Rust toolchain version 1.97.0`), for `riscv32im-risc0-zkvm-elf`, which is RV32IM. It did not use Docker, so the `r0.1.88.0` Docker caveat of [`TOOLING.md`](TOOLING.md) does not arise and the core's `rust-version = "1.96"` builds.
- **Install command:** the direct route of [`TOOLING.md`](TOOLING.md) (zkVM toolchains, RISC Zero), already in place from M0.2; rzup itself is not needed, since risc0-build reads rzup's settings as a library:
  1. `https://github.com/risc0/rust/releases/download/r0.1.97.0/rust-toolchain-x86_64-unknown-linux-gnu.tar.gz`, sha256 `100b597d605b706bec94e1d32bfaaf5851df8d75173f986d4b56a3e90916be53`, unpacked into `~/.risc0/toolchains/v1.97.0-rust-x86_64-unknown-linux-gnu`; then `~/.risc0/settings.toml` holding `[default_versions]` and `rust = "1.97.0"`. The Actions workflow does exactly this, and the run's toolchain step passed in 21 s.
  2. M0.2's `~/.risc0/bin/rzup` (0.6.0, sha256 `2cbb8081730ca42acac6818a279c7f218878b571a7f9ff76970f60688f54ddf5`) was not run.
  3. A C++ compiler: the `prove` feature compiles RISC Zero's circuit kernels with the system `g++` (13.3.0 here, preinstalled on the runner). No apt package was added; protoc is not needed.
  4. **For the wrapping step only:** the image `risczero/risc0-groth16-prover:v2025-04-03.1`, the tag that `risc0-groth16` 3.0.5 runs, on Docker Hub only: manifest list `sha256:a4f80ce2e0b8e2bb7637a93c37136a6776ac00ec843a3fdf1c67b1d5ffea64ee`, linux/amd64 manifest `sha256:7f173963196570b7a71816ed70565a4579264c5d2e3e0ecb028102538ad0e331`, 2,399,158,367 bytes of layers, 5.2 GB once loaded. `docker pull` failed twice: through the `mirror.gcr.io` mirror (`not found`), then from `registry-1.docker.io` (`429 Too Many Requests`). The trial fetched the manifest and the nine blobs with `curl` from `registry-1.docker.io` with an anonymous token (1 min 37 s), checked each blob's sha256 against its digest, and loaded them with `docker load`.
- **Other URLs fetched:** `index.crates.io` and `static.crates.io` (453 crates for the host), `git clone` of `github.com/risc0/risc0-ethereum` (tag `v3.0.1`, with its submodules) and `github.com/risc0/risc0-foundry-template`, `binaries.soliditylang.org` (solc 0.8.26), `auth.docker.io` and `registry-1.docker.io`, `dev.risczero.com`, `docs.boundless.network`, `raw.githubusercontent.com` (`BoundlessMarket.sol`), the Boundless indexer `d2mdvlnmyov1e1.cloudfront.net`, the public RPCs `arb1.arbitrum.io/rpc`, `sepolia-rollup.arbitrum.io/rpc` and `mainnet.base.org`, and `api.coingecko.com`.
- **Build:** `cargo build --release --manifest-path referee/zk/Cargo.toml -p zk-host` builds the guest through risc0-build, then the host. The host took about 64 minutes over two attempts (the first stopped by a 10-minute limit of the trial's own, the second 54 min 13 s), with `-j 3` on the shared CPUs, almost all of it `g++` on the circuit kernels of `risc0-sys`, `risc0-circuit-rv32im-sys` and `risc0-circuit-keccak-sys`. Relinking the host after a change takes 1 min 51 s. @@ACTIONS_BUILD@@ The guest programs are 161,260 bytes (`verify`) and 164,264 bytes (`trace`).

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
- **Against SP1:** on the 32 gate-set vectors, user cycles are 0.95 to 1.01 times SP1's executed instructions (`10-worst`: 29.6 million against 31.2 million), on RV32IM against SP1's RV64IM. The small vectors take up to 1.2 times, from the larger fixed cost (1.12 million against 0.98 million for `commit-at-tick-0`). The trace program takes 1.1 to 1.8 times SP1's, most likely because the state hash's 64-bit arithmetic costs more on a 32-bit target.
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

- **In the container: PASS.** `bash referee/zk/peak-memory.sh referee/zk/target/release/zk-host prove groth16 vectors/game/commit-at-tick-0.json`, with the default segments, uncapped by Docker, ended `verified: yes` after 1,281.8 s (above). The peak was 9.2 GiB in the host process during the segment proofs, then 7.0 GiB (sampled) in the container `docker run` started, under the session's 13.36 GiB cgroup; `dmesg` shows no out-of-memory kill. The verifier parameters digest is `73c457ba541936f0d907daf0c7253a39a9c5c427c225ba7709e44702d3c6eedc`, whose first four bytes are the 3.0 verifier's selector.
- **Onchain check of that proof:** `cast call 0x0b144e07a0826182b6b59788c34b32bfa86fb711 "verify(bytes,bytes32,bytes32)" 0x73c457ba<seal> 0xdb9671cb97da76e0ec0789137da5e1497f34687e031d3a5082a316d3b3eab069 0x8394dc2c336cab35dc19c9c489d6afd15f09229a92955d14833bfcb41dcff6ba --rpc-url <rpc>`, with the seal and the sha256 of the journal (the 384-byte encoded Outcome of `commit-at-tick-0`) that `zk-host` printed, returns without reverting on Arbitrum One (block 520,373,707) and Arbitrum Sepolia (block 325,095,246), and `cast estimate` gives 277,009 gas on both. With the journal digest changed to `0x…01`, the call reverts with `VerificationFailed()` (`0x439cc0cd`).
@@ACTIONS@@
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
- **A real onchain-verifiable proof here.** The Groth16 proof of `commit-at-tick-0` took 21 minutes in the container, at 9.2 GiB in the host and 7.0 GiB in Docker, one after the other, and verifies through the router on Arbitrum One and Sepolia (277,009 gas estimated). With segments of 2^19 cycles, the host's STARK proving takes 4.6 GiB. @@ACTIONS_FINDING@@
- **32-bit only.** RISC Zero 3.0 targets RV32IM; the plan's RV64IM preference (M1.12) cannot hold with it, and README §7.3 allows RV32IM.
- **Prover network.** Boundless bills in ETH on Base, with no minimum deposit; at the market's averages a run proof costs about 0.000011 ETH. It needs a Base wallet and a public URL for the program, and its default delivery is an aggregated Merkle proof on Base, so a raw Groth16 seal for Arbitrum is a non-default request whose price was not measured. Only 2 provers locked requests in the measured week.
- **zk tier.** The bootstrap needs a C++ compiler, the rzup settings written by hand, and, for wrapping only, the 2.4 GB Groth16 image, which this container's `docker pull` cannot fetch (mirror `not found`, then `429` from Docker Hub). The host's C++ circuit kernels make clean builds long (about an hour here, @@ACTIONS_BUILD_SHORT@@), so M1.12's zk-exec job needs a build cache.
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
| Onchain-verifiable proof, Actions (2 vCPUs, 7.9 GB) | FAIL, out of memory | @@ACTIONS_CMP@@ |
| Wrapping needs | Docker image (161 MB, ghcr.io) and 6.2 GB of artifacts | Docker image (2.4 GB, Docker Hub only) |
| Clean host build | 16 min on a 2-vCPU runner | @@ACTIONS_BUILD_CMP@@ |
| Arbitrum verifier | gateway `0x397A…dA9B`, v6.1.0 verifier | router `0x0b14…b711`, 3.0.0 verifier |
| Verification gas, framework fixture | 234,718 (Groth16, `forge test`) | 252,496 (`forge test`); 277,009 estimated on Arbitrum One for this trial's proof |
| Prover network | Succinct Prover Network: PROVE on Ethereum mainnet, minimum deposit 0.01 PROVE | Boundless: ETH on Base, no minimum deposit |
| Run proof price | 0.433 PROVE ($0.090), Groth16 | about 0.000011 ETH ($0.024) at market averages, mostly aggregated proofs; raw Groth16 not priced |
