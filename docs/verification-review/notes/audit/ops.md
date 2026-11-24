# Ops audit: dependency and operations footprint of the zk pipeline

Read-only review of `the repository root` at `f52a60a` (branch `claude/keen-ritchie-k2wh9h`), 2026-11-10. Lens: what it takes, in tools, downloads, machines, manual steps and third parties, to produce and to check one proof, and how that compares with the browser build of the same core.

## 0. Method and what is first-hand

- **Read in full:** `referee/zk/` (README, three manifests, `host/src/{lib,main,prove}.rs`, `guest/src/lib.rs`, `guest/src/bin/{verify,trace}.rs`, `host/tests/mock_round_trip.rs`, `peak-memory.sh`), `scripts/bootstrap.sh`, `docs/TOOLING.md`, `docs/VERIFICATION.md`, `docs/DEPLOYMENT.md`, `docs/ECONOMY.md`, `.github/workflows/{ci,nightly,zk-prove,e2e}.yml`, `contracts/src/ZkReferee.sol`, `scripts/contracts/{deploy,season}.mjs`, plan items M4.8, M4.10, M4.14, M5.5, §1.3, §2, §3, §13, §14, §16, and README §3, §6.4, §7.
- **Read in part:** `scripts/contracts/{e2e,preflight}.mjs`, `contracts/src/Season.sol` (`open`, `recordRun`, `closeSeason`), `web/wasm/src/lib.rs` (the replay exports), `web/src/pages/settle.ts`, `core/src/hash.rs`.
- **Measured here** (the only two first-hand numbers; everything else is quoted from the documents):
  1. `CARGO_TARGET_DIR=scratchpad/audit/target bash web/wasm/build-wasm.sh`, from an empty target directory, on this container (4 CPUs, 15 GB): 5 crates compiled (`crunchy 0.2.4`, `tiny-keccak 2.0.2`, `jiro-core`, `jiro-shell`, `jiro-wasm`), `Finished … in 5.33s`, `jiro-wasm: 28250 bytes, sha256 1355519906fb156f34dc9dc83423957741aa53768bc845f1eb989ee914ecabcc`.
  2. `node scratchpad/audit/time-replay.mjs` (Node v22.23.4): jiro-wasm's `replay`, which also writes a keccak256 state hash per tick, on the six levels of the heaviest gate-set run (`10-worst`, `16-worst`, `04-worst`, `08-worst`, `03-worst`, `14-synthetic`; 15,240 ticks): 31.8 + 27.4 + 23.5 + 22.2 + 24.0 + 14.6 = **143 ms** (means of 20 calls each; every Outcome equal to the vector's). `worst-case`: 24.7 ms. `commit-at-tick-0`: 0.09 ms.
- **Not done, as instructed:** no build of `referee/zk`, no Docker, no web access, nothing written in the repository (`git status --short` is empty). The repository's git-ignored `target/` gained a `wasm32-unknown-unknown` directory at 12:50 UTC from another process, not from this audit, whose builds went to the scratchpad.
- **Not verified:** RISC Zero's emergency stop source (the `contracts/lib/risc0-ethereum` submodule is not checked out here), the `risc0-*` crate internals (not in the local registry), and every onchain reading. Claims about them are the documents'.
- **This container as a data point:** a fresh session has no `~/.risc0`, no RISC Zero crates and no Docker daemon (`docker info` fails): the SessionStart hook installs the core tier only (`.claude/settings.json`). The first proving second is therefore about an hour away (bootstrap, cold build, `dockerd` by hand, image pull), where the browser module built in 5.3 s.

## 1. Verdict in brief

The zk pipeline is correct in shape and carefully measured, but its operations footprint is out of proportion with what it proves. The same 2,471-line core that the browser replays in 143 ms for the heaviest run needs, to be proven: a vendor fork of rustc, a C++ compiler, 453 locked crates, an hour-long build at one fixed absolute path, 9.2 GiB of RAM, a 5.2 GB x86 Docker image from Docker Hub, and 9 to 17 hours of a 4-CPU machine, per run, in one non-resumable process. Settlement then depends on a third-party contract that its owner can stop for good. No whole real run has been proven yet, the operator's settlement tooling does not exist yet, and the hosted-prover route that would make volume possible has never been tried. As built, none of the proving stack can run in a browser (§7); a wasm build of the prover is not on record, so this is a reading of its documented requirements, not a test.

What is sound and should be kept: one core behind `IReferee`, journals in calldata, verification by exception, the emergency-stop pin instead of the router, the executor pre-check, and the measurement discipline.

## 2. Inventory: producing one proof

Sizes and versions as the documents record them. "Breaks" is what stops when the dependency is unavailable.

| # | Dependency | Pin | Size | Source host | Breaks when unavailable | Reference |
|---|---|---|---|---|---|---|
| 1 | Rust toolchain | 1.98.0, `rust-toolchain.toml` | 228 MB download, 1.1 GB on disk, 35 to 49 s | `static.rust-lang.org` | the host does not build | `docs/TOOLING.md:14` |
| 2 | RISC Zero's rustc fork | `r0.1.97.0` (`rustc 1.97.0-dev`), sha256 `100b597d…be53` | 1.6 GB installed; 501 MB as CI cache | `github.com/risc0/rust` release asset; x86-64 Linux only | no guest, so no image id and no proof | `scripts/bootstrap.sh:19-23,161-170`; `docs/TOOLING.md:120-127,159` |
| 3 | rzup | 0.6.0, unversioned URL, bypassed: `settings.toml` written by hand, `rustup toolchain link` | small | `artifacts.risczero.net` | nothing today; the bypass mirrors rzup's private layout, which a new rzup may change | `scripts/bootstrap.sh:172-181`; `docs/TOOLING.md:123` |
| 4 | C++ compiler | system `g++` 13.3.0, unpinned | system | apt | the `prove` feature does not build | `scripts/bootstrap.sh:208`; `docs/VERIFICATION.md:370` |
| 5 | Host crates | `risc0-zkvm` and `risc0-build` `=3.0.6`; lockfile of 453 packages (421 in `zk-host`'s closure): `risc0-circuit-rv32im` 4.0.5, `risc0-circuit-recursion` 4.0.5, `risc0-circuit-keccak` 4.0.6, `risc0-groth16` 3.0.5, `risc0-zkp` 3.0.5, `rzup` 0.5.2, `bonsai-sdk` 1.4.3 | 1.45 GB build cache | `index.crates.io`, `static.crates.io` | no host | `referee/zk/host/Cargo.toml:12,16`; `referee/zk/Cargo.lock`; `docs/TOOLING.md:159` |
| 6 | Guest crates | `risc0-zkvm =3.0.6`; own lockfile of 157 packages (146 in `zk-guest`'s closure); the core adds `tiny-keccak 2.0.2` | in the cache above | crates.io | no guest | `referee/zk/guest/Cargo.toml:15-16`; `referee/zk/guest/Cargo.lock` |
| 7 | Host build time | none | 54 to 64 min in the container, 62 min 35 s to 62 min 58 s on a 2-vCPU runner, "almost all of it `g++` on RISC Zero's circuit kernels"; relink 1 min 51 s | | a cold build before any proof | `docs/VERIFICATION.md:373`; `docs/TOOLING.md:159` |
| 8 | Fixed build path | `/home/runner/work/jiro-ikusu/jiro-ikusu`, by `sudo mount --bind` elsewhere | | root on the machine | another image id; the proof reverts with `VerificationFailed()` | `referee/zk/README.md:53-67`; `docs/DEPLOYMENT.md:35-47` |
| 9 | Docker | 29.9.2 in the container (started by hand, with a registry mirror and the proxy's CA), 28.0.4 on the runner | | Docker | no Groth16 step | `docs/TOOLING.md:35,81-96`; `docs/VERIFICATION.md:675` |
| 10 | Groth16 prover image | `risczero/risc0-groth16-prover:v2025-04-03.1`, the tag `risc0-groth16` 3.0.5 runs; digest `sha256:a4f80ce2…a64ee` recorded in the documents only | 2,399,158,367 bytes of layers, 5.2 GB loaded | Docker Hub only; linux/amd64 only | no onchain-verifiable seal, so no settlement: "there is no native CPU route" | `docs/VERIFICATION.md:371,508,514`; `referee/zk/README.md:92`; `.github/workflows/zk-prove.yml:43,118-121` |
| 11 | Machine | x86-64 Linux, 4 CPUs; 9.2 GiB with 2^20-cycle segments or 4.6 GiB with 2^19, then about 7 GiB in Docker | | | out-of-memory kill | `docs/VERIFICATION.md:697-707` |
| 12 | Time | 295 to 410 s per 2^20 segment, 43 to 57 s of recursion per segment, 122 to 172 s of Groth16: 1.25 h (run 1, shortened), 2.1 h (`zk-run.json`), 3.7 h (`worst-case`, one level), 9 to 11 h (real six-clear runs, estimated), 16 to 17 h (heaviest, estimated) | | | the settlement grace | `docs/DEPLOYMENT.md:175-178,239-253`; `docs/VERIFICATION.md:697-708,988` |
| 13 | Inputs | the run file, rebuilt from chain data, and the season file | | an Arbitrum RPC (`sepolia-rollup.arbitrum.io/rpc`) | nothing to prove or settle | `docs/VERIFICATION.md:1032-1065`; `scripts/contracts/deploy.mjs:28-32` |
| 14 | Settlement tooling | Node 22, ethers 6.17.0, Foundry v1.8.6 (sha256 pinned), solc 0.8.28, `jiro-tools` | | npm, GitHub release asset, `binaries.soliditylang.org` | no `settleRun` from the scripts | `scripts/bootstrap.sh:15-16`; `docs/DEPLOYMENT.md:37-47` |
| 15 | Alternative: Boundless | not integrated: no client in the repository, no credential | a funded wallet on Base mainnet, a requester key, the program at a public URL (IPFS or S3), `boundless-market` SDK | Base; the Boundless indexer; a market of two provers | the only alternative to the operator's machine | `docs/VERIFICATION.md:531-533,754,771`; `referee/zk/host/src/prove.rs:59` |

Summing the documented sizes: about 4.3 GB of downloads before crates (0.23 + 1.6 + 2.4) and about 9.4 GB on disk (1.1 + 1.6 + 1.45 + 5.2). The sum is this audit's.

## 3. Inventory: checking one proof

| # | Dependency | Pin | Who controls it | Breaks when unavailable | Reference |
|---|---|---|---|---|---|
| 1 | `RiscZeroGroth16Verifier` 3.0.0, selector `0x73c457ba` | `0x2a098988600d87650Fb061FfAff08B97149Fa84D` on Arbitrum One and Sepolia | RISC Zero, immutable | | `docs/VERIFICATION.md:519-521`; `scripts/contracts/preflight.mjs:33-34` |
| 2 | Emergency stop over it | `0x724d375B…7797` (Sepolia), `0x9F9994Eb…e696` (Arbitrum One), by chain id | RISC Zero's owner can pause "for good"; "anyone can pause it with a proof of the all-zero claim" | every settlement of every season on this `ZkReferee` reverts (`EnforcedPause`) | `scripts/contracts/deploy.mjs:40-47`; `docs/ECONOMY.md:83`; `docs/VERIFICATION.md:1013` |
| 3 | `ZkReferee` | three immutables: verifier, image id, rules version | the deployer, once | | `contracts/src/ZkReferee.sol:24-26,69-75` |
| 4 | `risc0-ethereum` | submodule at `v3.0.1` (`365e7b2d`): `IRiscZeroVerifier`, the mock verifier, and in tests the Groth16 verifier, `ControlID` and the stop | RISC Zero | contracts do not build | `contracts/foundry.lock`; `contracts/foundry.toml`; `contracts/src/ZkReferee.sol:4` |
| 5 | Gas | 227,591 per Groth16 `verify`, plus 5,785 through the stop, plus `ZkReferee`'s own 10,639 to 37,160; `settleRun` of run 1 took 530,256 on Sepolia | | | `docs/VERIFICATION.md:745,1006-1013`; `docs/DEPLOYMENT.md:150` |
| 6 | To audit that the image id is this source | the whole of §2, rows 1 to 8: the hour-long build at the fixed path | | the pinned id cannot be checked | `docs/ECONOMY.md:76`; `referee/zk/README.md:79` |

The prover side is large but untrusted: a wrong prover cannot forge. The trusted base is small: the Groth16 verifier and its control ids, the stop, and the image id, which commits to the core, the risc0 crates linked into the guest and the toolchain.

## 4. Manual steps on the proving path

1. Bind-mount the checkout at the fixed path, as root (`referee/zk/README.md:60-65`; `docs/DEPLOYMENT.md:38-40`).
2. `bash scripts/bootstrap.sh contracts && bash scripts/bootstrap.sh zk`, `git submodule update --init`, `npm --prefix scripts/contracts ci` (`docs/DEPLOYMENT.md:41-43`).
3. `cargo build --release --locked … -p zk-host`, about an hour cold (`docs/DEPLOYMENT.md:45`).
4. Compare `zk-host image-id` with `cast call <ZkReferee> 'imageId()(bytes32)'` (`referee/zk/README.md:79`). `e2e.mjs` does it on the live happy path (`scripts/contracts/e2e.mjs:827`); nothing else does.
5. Start `dockerd` by hand, with `--registry-mirror https://mirror.gcr.io`, the proxy variables and the CA bundle, and wait for it (`docs/TOOLING.md:83-90`; `docs/DEPLOYMENT.md:50`). The zk bootstrap tier does not install or check Docker or the image (`scripts/bootstrap.sh:206-211`).
6. Get the 5.2 GB image: `docker pull`, or, when the pull fails, the manifest and nine blobs by `curl` with an anonymous token, each sha256 checked by hand, then `docker load` (`docs/VERIFICATION.md:371`).
7. Choose the segment size from the machine's RAM: `--segment-po2 19` under 10 GB (`referee/zk/README.md:92`).
8. Run the proof under `nohup` and keep the session alive for hours (`docs/DEPLOYMENT.md:93`). If the session or the proof stops, `--resume` reuses only a finished proof file (`docs/DEPLOYMENT.md:99`; `scripts/contracts/e2e.mjs:707-720`): `prove.rs` keeps the segment receipts in memory and writes nothing before the end (`referee/zk/host/src/prove.rs:59-76`).
9. Without `e2e.mjs`: copy the seal and the public values from between the `zk-fixture` markers and `cast abi-encode 'f(bytes,bytes)'` them (`referee/zk/README.md:81`).
10. Test fixtures: copy the proof JSON out of a CI log, between markers, into `contracts/test/fixtures/zk-proofs.json` (`.github/workflows/zk-prove.yml:9`; `docs/VERIFICATION.md:712`).
11. Before any heavy CI run: sum the month's billed minutes by hand from job timings, since `get_workflow_run_usage` "reports 0 ms" (`IMPLEMENTATION_PLAN.md:103`; `docs/TOOLING.md:146`). To rerun a label-triggered workflow, remove the label and add it again (`IMPLEMENTATION_PLAN.md:102`).
12. Keys: set as cloud-environment variables, which reach only sessions started afterwards (`docs/DEPLOYMENT.md:11`); in round F2 they were set without the `0x` prefix the scripts require, and every command was run with a rewritten variable (`docs/DEPLOYMENT.md:186`).

## 5. Fragilities the documents themselves record

- **Rate limits.** Docker Hub answers `toomanyrequests` on the shared egress IP after one pull (`docs/TOOLING.md:10,92`). `mirror.gcr.io` does not hold the Groth16 image (`not found`), then Docker Hub gave `429` (`docs/VERIFICATION.md:371,554`). The guest-builder image's manifest got `429` too (`docs/VERIFICATION.md:691`). `api.github.com` is refused, so `rzup`, `foundryup` and `sp1up` fail (`docs/TOOLING.md:8,121`).
- **The pull path is not stable.** `docs/TOOLING.md:92` says images resolve "through the mirror"; `docs/VERIFICATION.md:554` says the mirror lacks this image; `docs/VERIFICATION.md:672` says `docker pull` "worked in the container this time"; `docs/VERIFICATION.md:984` and `docs/DEPLOYMENT.md:50` say it comes "through the registry mirror". The documents do not say which registry actually served it.
- **Out-of-memory kills.** SP1's compressed proof was killed at 13.4 GiB in the container and shut the runner down twice (`docs/VERIFICATION.md:302-303,314`), one of the two reasons RISC Zero was chosen (`:588-590`). RISC Zero fits a 7.9 GB runner only with 2^19 segments and swap: "6,520 MiB used with 2,206 MiB of swap" (`docs/VERIFICATION.md:512`), "7,760 MiB used with 366 MiB of swap" (`:707`). `zk-prove.yml` carries a 30 s memory sampler "so the log keeps the last reading if the runner dies" and an out-of-memory step (`.github/workflows/zk-prove.yml:123-138`). The container's processes share a 13.36 GiB cgroup that "also holds `dockerd`" (`docs/VERIFICATION.md:361,674`), and another session once took two of the four CPUs (`:361`).
- **Fixed build path.** Two builds of one commit gave two verify image ids (`docs/VERIFICATION.md:513,658`); the cause is Cargo's `-C metadata` hash of `jiro-core`'s absolute path (`:662`), and "a relocation test in one machine does not prove the build reproducible" (`:662`). RISC Zero's own Docker build was not usable: its default builder tag `r0.1.88.0` is older than the core's `rust-version` 1.96, build containers cannot reach the proxy, and Docker Hub rate-limited (`referee/zk/README.md:69`; `docs/TOOLING.md:19,95`).
- **Hour-long builds.** 62 min 35 s to 62 min 58 s on a runner, 69 min 52 s for the whole cold job; a cold run "when `referee/zk/Cargo.lock`, `referee/zk/host/Cargo.toml` or a toolchain changes, on a branch with no cache to restore, and after GitHub evicts the cache, 7 days after its last use" (`docs/TOOLING.md:159`). `cargo test` rebuilds the dependencies with `panic = "unwind"`: 5 min 13 s for a 0.17 s test (`:159`). `zk-prove.yml` and `e2e.yml`'s zk job restore the cache and never save it (`save-if: false`).
- **CI limits.** GitHub-hosted jobs stop at 6 h; private runners have 2 vCPUs and are 2.1 to 2.3 times slower (`docs/VERIFICATION.md:708-709`). `zk-prove.yml`'s dispatch default, `worst-case`, "would take about 10 on this repository's 2-vCPU runners, beyond the job's 6 hours" (`.github/workflows/zk-prove.yml:44-46`). One label run billed 212 minutes (`docs/TOOLING.md:168`); November's budget stood at "about 1,460 of 1,500" (`docs/VERIFICATION.md:969`); M4.10 "Merged with the last line open", its `e2e.yml` zk run postponed to "the 1 December reset" (`IMPLEMENTATION_PLAN.md:1810`; `docs/VERIFICATION.md:1030`).
- **Version churn.** `3.1.0-rc.1` and `5.0.0-rc.1` were on crates.io on 2026-11-01 (`docs/VERIFICATION.md:365`). RISC Zero's 2.0 verifier "is stopped" and "the 1.x ones are removed from the router" (`:522`). Bonsai "is no longer available" since December 2025 (`:529`), while `bonsai-sdk 1.4.3` is still in `referee/zk/Cargo.lock`. `risc0-foundry-template` still pins 2.0.2 (`:525`). rzup's download URL has no version (`docs/TOOLING.md:123`).
- **Prover credential never set.** Round F0 "has not run" (`IMPLEMENTATION_PLAN.md:2237`); "No hosted prover credential exists" (`docs/ECONOMY.md:83`); Boundless "needs round F0's prover credential, which was never set" (`docs/DEPLOYMENT.md:254`); "No request was made" (`docs/VERIFICATION.md:771`). M1.17's first price reading was wrong and M4.8 corrected it (`:753`).
- **Lost measurements.** `e2e.mjs` kept `zk-host prove`'s output, so round F2's log "lacks its figures"; they come from a second proof (`docs/DEPLOYMENT.md:175`).
- **Whole runs not proven.** The three bot runs of `docs/DEPLOYMENT.md:241-253` are "Executed (not proven)". The largest proof ever made is one level of 28 segments (`docs/VERIFICATION.md:700`); the largest run-mode proof has 16 (`:988`); the settled testnet run has 13 (`docs/DEPLOYMENT.md:176`). Real six-clear runs have 67 to 81 and the heaviest 131. The 9 to 17 h figures are a formula, "segments × 467 s + 170 s" (`docs/DEPLOYMENT.md:252`).

## 6. What a RISC Zero bump or a stopped verifier forces

**Any change to the guest's bytes moves the image id**: the core, `referee/zk/guest`, the risc0 crates linked into the guest and its embedded kernel (`docs/VERIFICATION.md:373`, "161,260 … bytes as the binaries risc0-build embeds, with RISC Zero's kernel"), or the toolchain. M4.8's change to the guest moved it from `0x1e72b2e2…` to `0xa3013dc4…` at the same path (`docs/VERIFICATION.md:683-687,896`). A new RISC Zero version line also means a new verifier contract and selector: 2.0, 2.2 and 3.0 each have their own (`docs/VERIFICATION.md:519-522`), and the selector is the first four bytes of the verifier parameters' digest (`referee/zk/host/src/prove.rs:20-22`).

Redo list for a version bump:

1. Pins: `referee/zk/host/Cargo.toml:12,16`, `referee/zk/guest/Cargo.toml:16`, both lockfiles, `scripts/bootstrap.sh:19-21` (toolchain version, tag, sha256), the cache key `risc0-r0.1.97.0` in `ci.yml:447`, `nightly.yml:158`, `zk-prove.yml:99` and `e2e.yml:121`, the Groth16 image tag in `zk-prove.yml:43`, the `risc0-ethereum` submodule and `contracts/foundry.lock`, the stop addresses in `scripts/contracts/deploy.mjs:44-47`, the verifier address and selector in `scripts/contracts/preflight.mjs:33-34`.
2. Code against the vendor API: `prove.rs` (`ProverOpts`, `InnerReceipt::Groth16` and `Fake`, `verifier_parameters`), `lib.rs` (`ExecutorEnv`), the guests (`env::read_slice`, `commit_slice`). The seal encoding and the mock selector are copied by hand from risc0-ethereum's `encode_seal` (`referee/zk/host/src/prove.rs:20-24,82-92`; `scripts/contracts/deploy.mjs:48-50`).
3. A cold build of about an hour in every environment, and the path probe again: the fixed path fixes one cause, found by experiment.
4. Every committed real proof again, since a seal verifies only under its image id and its verifier: the four of `contracts/test/fixtures/zk-proofs.json` (212 billed Actions minutes for two, 13,176.8 s and 7,638.5 s of container time for the others) and `seasons/testnet-0/runs/run-1.proof.json`.
5. Every measured figure that the documents own: cycles, segments, proving times, verification gas, the Boundless price bucket (`docs/VERIFICATION.md`, zk costs), then README §7.3 and §13 D2, `docs/ECONOMY.md` §2, `docs/DEPLOYMENT.md`.
6. A new `ZkReferee`. `Season.open` takes the referee per season (`contracts/src/Season.sol:129-156`), so the contracts would allow a new referee on the same `Season`. The tooling does not: `deploy.mjs` "never resumes an earlier one" (`scripts/contracts/deploy.mjs:6-8`) and `season.mjs` opens only on `generations[0]` with `generation.Referee` (`scripts/contracts/season.mjs:114-126`). `docs/DEPLOYMENT.md:195` accordingly lists "a new verify program" under "What forces a new generation", of all four contracts.
7. With a new generation, a rollover pending in the old `Season` stays there until a season is opened on it, which no script does.

A stopped verifier adds, at once and with no notice:

1. Every season whose referee is the stopped `ZkReferee` can never settle another run: the referee is fixed at `open`, and the pause is permanent (`docs/ECONOMY.md:83`).
2. `docs/DEPLOYMENT.md:196` says "the season's pot rolls over". `contracts/src/Season.sol:196-206` rolls it over only when `totalQualifiedPoints == 0`, and `:218` pays each claim as `best.score * playersPot / totalQualifiedPoints`. If some best runs settled before the stop, those players share the whole players' pot and the others get nothing. The referee is read per season at settlement (`contracts/src/Challenge.sol:162-163`), so nothing reroutes the season to another referee. With one operator proving serially at hours per run, the order of proving decides who is paid.
3. No zk season can open until the bump above is done, since `preflight.mjs:98` refuses a paused stop, and Stylus activations are paused too.

The pin on the stop is still the right one: the alternative, the raw verifier, would keep accepting forged seals (`docs/ECONOMY.md:154`).

## 7. The browser build of the same core

| | Browser (`web/wasm`) | zk proving (`referee/zk`) |
|---|---|---|
| Toolchain | Rust 1.98.0 with the `wasm32-unknown-unknown` target; no wasm-bindgen, wasm-pack or wasm-opt (`web/wasm/build-wasm.sh:7`; `IMPLEMENTATION_PLAN.md:1092`) | the same, plus RISC Zero's rustc fork, `g++`, Docker |
| Crates compiled | 5, of which 2 third-party (measured) | 453 locked for the host, 157 for the guest |
| Clean build | 5.3 s (measured); "the wasm build 1 s" warm (`docs/TOOLING.md:166`) | 54 to 70 min |
| Artifact | 28,250 bytes (measured) | guest ELF 126,756 bytes (`docs/VERIFICATION.md:600`), more with RISC Zero's kernel embedded (the trial's 128,836-byte ELF became 161,260, `:373`); a 5.2 GB image at run time |
| Reproducible build | path remap flags: "two builds, in any checkout, give the same sha256" (`web/wasm/build-wasm.sh:4-7`) | one absolute path, root elsewhere |
| Memory | fixed buffers: grid 3,600, capture stack 6,728, journal 8,100 bytes (`README.md:59-65`) | 4.6 to 9.2 GiB, then about 7 GiB |
| Heaviest six-level run | 143 ms, with 15,240 state hashes (measured) | 16 to 17 h on 4 CPUs (estimated) |
| Runs on | any browser | x86-64 Linux with Docker |
| CI | seconds inside the `rust` and `web` jobs; 10,000 difffuzz cases in 45 s (`docs/TOOLING.md:166`) | its own job, a 1.45 GB cache, 70 min cold; real proofs only by hand |
| Third parties at run time | none for the replay | Docker Hub, RISC Zero's contracts, optionally Boundless and Base |

- The ratio between proving and replaying the heaviest run is about 4 × 10^5 in wall time.
- The browser already does everything the proof attests, except prove it: `web/src/pages/settle.ts:1-3` replays the player's committed runs with the core and ranks them in D10's order, and `web/wasm/src/lib.rs:728-775` returns the Outcome and the per-tick trace.
- **Could the user prove in the browser with this stack? No.** The STARK prover is native code that `g++` builds (`scripts/bootstrap.sh:208`), it needs 4.6 GiB even with 2^19 segments (`docs/VERIFICATION.md:501`), above a 32-bit wasm address space (general knowledge, not from the repository), and the Groth16 step, without which nothing verifies onchain, exists only as an x86 Docker image or a CUDA build (`docs/VERIFICATION.md:508`). Even a one-tick level takes 21 minutes on 4 native CPUs (`:502`), because the fixed cost is 1.12 million cycles in 2 segments before the first tick (`:403`) and 122 to 172 s of Groth16. README §7.5 states the conclusion (`README.md:671`). Player-side proving therefore needs another proof system or another verification scheme, not a port. Smaller segments and a wasm build of the prover were not tried.

## 8. Findings

Full text in the structured result. Severity and the main evidence of each:

| Id | Severity | Finding | Main evidence |
|---|---|---|---|
| ops-1 | high | The operator is the only practical prover, at 9 to 17 h per run in one process that saves nothing until it ends; no whole real run has been proven; the `settle` command and `season-ops.yml` do not exist | `docs/DEPLOYMENT.md:241-253`; `docs/VERIFICATION.md:708,988`; `referee/zk/host/src/prove.rs:59-76`; `scripts/contracts/season.mjs:139-140`; `docs/ECONOMY.md:84` |
| ops-2 | high | RISC Zero's stop is permanent; a stop during a season or its grace ends settlement, and the pot rolls over only if nothing settled | `docs/VERIFICATION.md:365,522,1013`; `docs/ECONOMY.md:83`; `docs/DEPLOYMENT.md:196`; `contracts/src/Season.sol:196-206,218` |
| ops-3 | medium | A version change redoes pins, builds, proofs and measurements, and the scripts make it a new generation of four contracts | §6 |
| ops-4 | medium | The hosted-prover fallback has a price and nothing else: no client, no credential, no request | `docs/VERIFICATION.md:529,754,771`; `docs/ECONOMY.md:83`; `IMPLEMENTATION_PLAN.md:116,2237` |
| ops-5 | medium | The image id reproduces at one absolute path only, and no check outside the live happy path ties the code to the pinned id | `referee/zk/README.md:58-67`; `docs/VERIFICATION.md:658,662`; `contracts/test/ZkVerify.t.sol:93`; `scripts/contracts/e2e.mjs:827`; `IMPLEMENTATION_PLAN.md:2011` |
| ops-6 | medium | The Groth16 step depends on one 5.2 GB x86 image, pulled by tag from Docker Hub, with failed pulls on record and no digest check | `docs/VERIFICATION.md:371,508`; `.github/workflows/zk-prove.yml:43,118-121`; `scripts/bootstrap.sh:206-211` |
| ops-7 | medium | CI cannot prove a real run; the zk jobs depend on a 7-day cache and a minutes budget that ran out | `.github/workflows/zk-prove.yml:44-46`; `docs/TOOLING.md:159,168`; `docs/VERIFICATION.md:969,1030`; `IMPLEMENTATION_PLAN.md:1810` |
| ops-8 | medium | The proving stack is native-only; the browser already replays the heaviest run in 143 ms | §7 |
| ops-9 | low | README §7.3 gives only the best-case proving time; the settle page asks players to send a file; `zk-host prove` prints `verified: yes` in dev mode | §11 |

The planned season freeze covers `core/` and `levels/` only (`IMPLEMENTATION_PLAN.md:2011`), not `referee/zk/**`, its lockfiles or the toolchain pins, each of which moves the image id (ops-5).

Arithmetic used in ops-1, from the documents' figures: a real six-clear run takes 8.7 to 10.6 h on 4 CPUs (`docs/DEPLOYMENT.md:245-249`), so one machine proves 2.3 to 2.8 runs a day; 20 players' best runs are about 200 machine-hours, more than 8 days of one machine, against a grace of 24 h (`seasons/testnet-0.json`, `grace` 86,400) or the 48 h proposal (`IMPLEMENTATION_PLAN.md:2001`). On Boundless the same 20 proofs would cost about 0.00037 ETH at the measured median, if the market serves them.

A second arithmetic, outside this lens, for whoever reviews the economics: one verified run costs the operator about 0.0000345 ETH (`docs/ECONOMY.md:44`), and the rake on one run fee is 0.000005 ETH at testnet-0's 1,000 bp. The operator covers its cost only if a settled player bought about 7 runs, or 3.5 at the 2,000 bp cap.

## 9. Strengths to keep

- One core, thin wrappers: the proving guest is 22 lines (`referee/zk/guest/src/bin/verify.rs`), and vectors and difffuzz tie native, wasm and the executor in CI (`.github/workflows/ci.yml:477-490`; `nightly.yml:176-186`).
- `IReferee` keeps the money contracts unaware of the backend, and the referee is a per-season parameter (`README.md:608,630-637`; `contracts/src/Season.sol:129-156`).
- The stop is pinned, never the upgradeable router, and the preflight reads it before a deployment (`scripts/contracts/deploy.mjs:40-47`; `scripts/contracts/preflight.mjs:94-103`).
- The host executes and checks the inputs in seconds before hours of proving, and checks the public values again after (`referee/zk/host/src/prove.rs:57-58,77-81`); a rejected journal has no proof (`referee/zk/guest/src/bin/verify.rs:16-17`).
- Journals in calldata and verification by exception: anyone can replay any run for free, and only runs that money depends on are proven (`README.md:539,607`).
- Public values bind every input once, and their length separates a level proof from a run proof (`contracts/src/ZkReferee.sol:69-75,87-91`).
- Measurement discipline: every figure has its commit, environment and date; downloads are sha256-pinned (`scripts/bootstrap.sh:16,21`); the runbook was rehearsed on a fork with a real proof (`docs/DEPLOYMENT.md` §5); keys are removed from the environment before any child runs (`scripts/contracts/e2e.mjs:806-808`).
- Costs were measured before the decision, SP1 included, and the decision is recorded with its numbers (`docs/VERIFICATION.md:579-590`).

## 10. Facts for a lighter scheme

1. Replay is free and already in the browser: 28,250 bytes, 143 ms for the heaviest run with a state hash per tick (measured); exports `replay`, `outcome_ptr`, `trace_ptr`, `state_hash`, `state_preimage` (`web/wasm/src/lib.rs:672-775`).
2. All inputs of any run are public and authenticated onchain: journals in `commitRun` calldata, the commitment `keccak256(keccak256(j0) ‖ … ‖ keccak256(j5))`, the run nonce, the season's 16 level ids (`README.md:539,563-564`; `docs/VERIFICATION.md:1062-1063`).
3. The state hash covers "the whole state" in a 948-byte preimage, 900 of them the grid (`README.md:441-471`; `core/src/hash.rs:10`). It is a test and diagnosis tool: "Stepping never computes it" (`core/src/hash.rs:1-2`), and the core has no function that restores a game from a preimage. The level bytes and the level seed are needed beside it, since the deflection key "is not in it" (`README.md:471`).
4. In the zkVM a state hash costs about 165,000 cycles per tick (449,890,537 trace-guest cycles against 3,626,078 for `full-journal`'s 2,700 ticks, `docs/VERIFICATION.md:428`), 16 to 500 times a tick's own cost (about 330 cycles idle, about 10,000 on the heaviest levels, from `:432,455,480`). RISC Zero's keccak accelerator "was not tried" (`:407`).
5. The floor of a RISC Zero proof is fixed cost, not ticks: 1,122,341 user cycles and 2 segments before the first tick (`docs/VERIFICATION.md:403`), 1,281.8 s on 4 CPUs at 9.2 GiB or 2,128 to 2,160 s on a 2-vCPU runner at 4.6 GiB for a one-tick level (`:502,512,701`), 260-byte seal, 227,591 gas whatever is proven (`:745`).
6. Settlement is atomic and `view`-based: `settleRun` calls `verifyRun` and records the run in one transaction, and the deadline needs Σ `ticksUsed` from the Outcomes (`README.md:540-551,561-573,640`). A scheme with a challenge window changes `Challenge`, so a new generation; a scheme that only changes how Outcomes are justified fits a new `IReferee` and a new season (`contracts/src/Season.sol:129-156`; `docs/VERIFICATION.md:883`).
7. The Stylus referee exists and agrees with native on 75 vectors and 200 fuzz cases, at 271,192 to 11,599,408 gas per level, about 313,000 for a one-tick replay; it cannot be deployed while `activationGas` is 2^64 − 1 (`docs/VERIFICATION.md:9-12,58-60`).
8. Money per proof is small and nearly flat in cycles on Boundless, 0.0000153 ETH + 17,383 wei per cycle with R² 0.19 (`docs/VERIFICATION.md:755`); what is expensive is the operator's time, the machine-hours and the dependency chain. The stake per run is 0.00005 ETH, about $0.11 (`:350`).

## 11. Inconsistencies noticed

- `docs/DEPLOYMENT.md:196`, "the season's pot rolls over", against `contracts/src/Season.sol:196-206` (only when no qualified run settled).
- `README.md:590`, "CPU proving takes about an hour on 4 CPUs for six small levels": the README gives no other proving time; the 9 to 17 h of real runs are in `referee/zk/README.md:80`, `docs/DEPLOYMENT.md`, `docs/ECONOMY.md` and the plan. README §13 D2 (`README.md:854`) prices a verified run with the Boundless price, a route never used.
- `web/src/pages/settle.ts:177`, "Send the operator the run file", against `README.md:671`, "Players do nothing after committing"; M5.5 plans the rewording (`IMPLEMENTATION_PLAN.md:2020`).
- The registry that serves the Groth16 image (§5).
- `CLAUDE.md`'s sync table has rows for `core/src/**`, byte formats, levels, seasons and `contracts/src/**`, and none for what moves the image id (`referee/zk/**`, the risc0 pins, the zk toolchain) with its consequences: fixtures, `ZkReferee`, a generation.
- `zk-host prove` prints `verified: yes` for a dev-mode receipt when `RISC0_DEV_MODE` is set (`referee/zk/host/src/prove.rs:77-79,88-90,125`); the refusal of dev mode on a live network is in `scripts/contracts/e2e.mjs:710` only.
- The context given to this audit says "about 300 to 470 s per 2^20-cycle segment, plus 45 to 57 s of recursion": the documents give 295 to 410 s of segment proving and 43 to 57 s of recursion; 467 s is their sum in the estimate's formula (`docs/DEPLOYMENT.md:178,252`).

## 12. Not tried in the repository, per its own documents

- RISC Zero's keccak accelerator (`docs/VERIFICATION.md:407`), a GPU prover (`:508`, the `cuda` feature), segments below 2^19, a wasm build of the prover.
- RISC Zero's Docker guest build with the `r0.1.97.0` tag, the vendor's route to a reproducible image id (`referee/zk/README.md:69`). Moving `jiro-core` inside the guest's workspace was not tried either: the path enters the hash because the dependency "lies outside the guest's workspace" (`referee/zk/README.md:56`).
- Any Boundless request (`docs/VERIFICATION.md:771`), RISC Zero's set builder (`:779`), a real proof of a whole run.
