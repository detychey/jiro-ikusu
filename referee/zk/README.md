# zk referee

The zk path of `IReferee` (README §7.3): the core replays journals as the guest of RISC Zero's zkVM, and a proof of that replay is verified onchain by RISC Zero's verifier contract. RISC Zero 3.0.6 (`risc0-zkvm` and `risc0-build` pinned to `=3.0.6`), guest target `riscv32im-risc0-zkvm-elf`, toolchain `r0.1.97.0` (`bash scripts/bootstrap.sh zk`). Measurements and costs are in [`docs/VERIFICATION.md`](../../docs/VERIFICATION.md).

- `guest/`, its own workspace, built by risc0-build from the host's build script:
  - `verify`, the proving program. It replays each level and commits the public values below. A rejected level or journal makes it panic with replay's code, so no receipt, and no proof of an Outcome, exists for it (README §7.3, "Rejections revert").
  - `trace`, test only: per level, replay's error code, the keccak256 of the state-hash trace (`traceKeccak`, [`vectors/README.md`](../../vectors/README.md)) and the encoded Outcome.
- `host/`, the `zk-host` binary:
  - `execute <files or directories>` runs vectors through both programs in the executor and checks them against the native core's records, with a cycle table;
  - `execute-run <six files>` executes one run-mode input;
  - `prove --level <file>` and `prove --run <six files>`, each with an optional `--segment-po2 <n>`, prove the verify program on the CPU and wrap the proof into a Groth16 seal (Docker);
  - `tests/mock_round_trip.rs`, a dev-mode receipt round trip.
- `peak-memory.sh <command>` prints a command's wall time and peak memory, its process tree's and Docker's.

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

**Onchain.** The verifier contract checks `verify(seal, imageId, sha256(publicValues))`. A zk referee never decodes the public values: it rebuilds them, from the levels, journals and weights that settlement submits and the Outcomes the proof claims, and the proof verifies only if they are the ones the guest committed. For level `i`, it sets `journalHash = keccak256(journals[i])` and `levelId = keccak256(levels[i])` itself, and appends `abi.encode(weightsBp[i], outcome)`. A run's public values cannot pass as a level's, or the reverse: their lengths, so their digests, differ. [`contracts/test/ZkVerify.t.sol`](../../contracts/test/ZkVerify.t.sol) builds them this way.

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

## Proving

```bash
cargo run --release --manifest-path referee/zk/Cargo.toml -p zk-host -- prove --level vectors/game/worst-case.json
bash referee/zk/peak-memory.sh referee/zk/target/release/zk-host prove --run <six game vector files> --segment-po2 19
```

The segment proofs and their recursion into one succinct receipt run in the process, on the CPU. The Groth16 step runs `risczero/risc0-groth16-prover:v2025-04-03.1` through `docker run`, on x86 only; the image is on Docker Hub only. Memory follows the segment size: about 9.2 GiB with RISC Zero's default 2^20 cycles, 4.6 GiB with 2^19, so a 7.9 GB runner proves with `--segment-po2 19`. The output, between `=== BEGIN zk-prove ===` and `=== END zk-prove ===`, gives the image id, the cycles, each step's time, the peak memory and the seal's size, and between `=== BEGIN zk-fixture ===` and `=== END zk-fixture ===` the proof as JSON: `mode`, `vectors`, `imageId`, `seal` (the router's encoding: the verifier selector, then the 256-byte Groth16 seal) and `publicValues`. `.github/workflows/zk-prove.yml` runs it; `contracts/test/fixtures/zk-proofs.json` holds a level proof and a run proof from its log, and the container's proof of `worst-case`.
