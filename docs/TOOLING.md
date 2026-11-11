# Tooling

Probe record of work item M0.2, made on 2026-10-28 in the agents' cloud container: 4 CPUs, 15 GB RAM, about 30 GB of free disk, with outbound HTTPS through the session's proxy. [`scripts/bootstrap.sh`](../scripts/bootstrap.sh) installs the tools that passed, at the versions below. When a pin changes, re-probe the tool and update its row and its install route.

## Network rules seen by the probes

- **Reachable:** `static.rust-lang.org`, crates.io, npm, PyPI, apt (`archive.ubuntu.com`), `binaries.soliditylang.org`, `artifacts.risczero.net`, GitHub release assets (`github.com/<owner>/<repo>/releases/download/...`), `raw.githubusercontent.com`, and `git clone` of public repositories.
- **Refused (403):** `api.github.com`, GitHub release pages, and attestation downloads (`github.com/<owner>/<repo>/attestations/...`). foundryup, sp1up and rzup depend on them, so the bootstrap downloads the release asset directly and checks its sha256 instead.
- **Not tried:** `cdn.playwright.dev`, Playwright's browser download; the container uses its preinstalled browser.
- **Docker Hub:** anonymous pulls are rate-limited on the shared egress IP (`toomanyrequests`). `mirror.gcr.io` works; `public.ecr.aws` and `ghcr.io` did not.

## Decisions

- **P1, Rust pin: 1.98.0.** The pin exists and installs, with its targets and three components, in 35 to 49 s: 49 s in the probe, 35 s for `RUSTUP_HOME=<empty directory> bash scripts/bootstrap.sh core` (228 MB download, 1.1 GB on disk).
- **P2, contract toolchain: Foundry v1.8.6.** `forge` installs from its release asset and runs: build, tests and fuzzing with solc 0.8.28 (fetched by forge from `binaries.soliditylang.org`), and `anvil` answers RPC calls. ethblockdigger's harness is not used, so the plan's M4 test file names stay as written. CI uses `foundry-rs/foundry-toolchain` with `version: v1.8.6`.
- **P14, repository and CI profile: public since 2026-11-10, with the public CI profile** (plan §1.3). The owner keeps the repository private until a working version exists, then makes it public (owner, 2026-10-28; plan §15, question 15). M0.4 builds the private profile. When the repository becomes public, a follow-up PR switches CI to the public profile: the plan's round F3 schedules both once M4.14 has settled a run on Arbitrum Sepolia (owner, 2026-11-08). The owner made the repository public on 2026-11-10, and round F3's follow-up switched CI to the public profile: the heavy workflows run on the PRs that touch their paths, and `nightly.yml` runs daily.
  - The `detychey` organization's private repositories share 2,000 Actions minutes a month on GitHub Free, ethblockdigger included. Jobs run on 2-vCPU runners and are billed rounded up to the minute.
  - **Monthly budget for jiro-ikusu while it was private: 1,500 minutes** (a proposal; the owner can change it in review), leaving 500 for ethblockdigger.
- **Core MSRV input (plan §3.2).** The oldest zkVM rustc is 1.96 (SP1), so M1.1 sets `rust-version = "1.96"` in `core/Cargo.toml`. Caveat for M1.17: risc0-build 3.0.6 builds guests in Docker with `r0.1.88.0` (rustc 1.88), not with the 1.97 toolchain recorded here. If M1.17 needs that Docker build, `rust-version = "1.96"` is too new for it; M1.17 reports it, and lowering the MSRV needs a plan change, since plan §3.2 takes it only from this record.

## Probe results

| Tool | Version | Status | Tier | Affected items |
|---|---|---|---|---|
| Rust toolchain | rustc 1.98.0 (88d9e12ae 2026-08-18), LLVM 22.1.8; cargo 1.98.0; clippy 0.1.98; rustfmt 1.9.0 | PASS | core | all |
| Rust targets | `wasm32-unknown-unknown`, `riscv32im-unknown-none-elf`, `riscv64imac-unknown-none-elf` | PASS | core | M0.4, M1, M4.1 |
| llvm-tools | LLVM 22.1.8-rust-1.98.0 | PASS | core | M0.4 (float probe, `llvm-nm`) |
| cargo-stylus | 0.10.10 | PASS | contracts | M4.1, M4.2, M4.11, M4.14, M4.16 |
| Node, npm | v22.22.0, 10.9.4 | PASS (preinstalled) | web | M0.6, M1.2, M1.11, M2, M4 |
| binaryen (`wasm-opt`) | 120 | PASS | contracts | M4.1 |
| solc (solcjs) | 0.8.28+commit.7893614a | PASS, not used | none | none: only ethblockdigger's harness needs it, and P2 chose Foundry |
| Playwright | 1.63.0; Chrome for Testing 153.0.8010.12 (chromium revision 1243) | PASS (preinstalled browser) | web | M2.2 |
| wrangler | 4.154.0 | PASS | web (`web/package.json`, M2.2) | M2.2 |
| Foundry (forge, cast, anvil, chisel) | 1.8.6 (6bad0a66, 2026-10-21) | PASS, through the direct asset | contracts | M4 |
| Docker | 29.9.2; containerd 2.4.2; runc 1.5.2 | PASS, through a registry mirror | none (started by hand) | M1.16, M1.17, M4.2, M4.8, M4.14, M4.16 |
| nitro-devnode (M4.2) | `run-dev-node.sh` at OffchainLabs/nitro-devnode commit ebb523d4; `offchainlabs/nitro-node:v3.12.2-5f02f3f` | PASS, through a registry mirror | contracts (`stylus-gas.yml`, `e2e.yml`) | M4.2, M4.9, M4.14, M4.15, M4.16 |
| slither | 0.11.6 (solc-select 1.2.0, crytic-compile 0.4.2) | PASS | contracts | M4.12 |
| SP1 toolchain | cargo-prove v6.10.0 (d83ed91); `rustc +succinct` 1.96.0-dev, LLVM 22.1.2 | PASS, through direct assets | none: M1.12 chose RISC Zero | M1.1 (MSRV), M1.16 |
| RISC Zero toolchain | rzup 0.6.0 (unversioned download URL); `rustc +risc0` 1.97.0-dev (e638c6cfe 2026-07-15), LLVM 22.1.6 | PASS, through direct assets | zk | M1.1 (MSRV), M1.12, M1.17, M4.8 |

## Install routes

Each route lists the commands the bootstrap runs, the URLs they fetch, and what failed first.

### Rust (core)

- **Install:** `rustup toolchain install 1.98.0 --profile minimal --component clippy,rustfmt,llvm-tools --target wasm32-unknown-unknown,riscv32im-unknown-none-elf,riscv64imac-unknown-none-elf --no-self-update`. rustup checks every tarball against the channel manifest.
- **URLs:** `static.rust-lang.org/dist/channel-rust-1.98.0.toml` and the component tarballs under `static.rust-lang.org/dist/2026-08-20/`.
- **Implicit installs.** rustup 1.28.2 installs the toolchain of `rust-toolchain.toml` as soon as any proxied command runs in the repository. The bootstrap sets `RUSTUP_AUTO_INSTALL=0`, so its checks never install anything and only its explicit install step does.
- **llvm-tools path.** The tools are not on `PATH`: use `$(rustc --print sysroot)/lib/rustlib/x86_64-unknown-linux-gnu/bin/llvm-nm` (and `llvm-size`, `llvm-objcopy`, `llvm-readobj`). The system `llvm-nm` is LLVM 18.1.3, four major versions behind rustc.

### cargo-stylus (contracts)

- **Install:** `cargo install --locked cargo-stylus --version 0.10.10`. URLs: `index.crates.io` and `static.crates.io`, with no GitHub host. It builds from source in about 6.5 minutes, so CI caches `~/.cargo/bin/cargo-stylus`.

### npm tools (web, contracts)

- **binaryen:** `npm install --global binaryen@120.0.0` puts `wasm-opt` on `PATH` (contracts tier).
- **Playwright:**
  - In the container, pin `@playwright/test@1.63.0` in `web/`, the version of the preinstalled Playwright, with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Never run `playwright install` there.
  - A headless test on a `data:` URL passed this way, on `chromium_headless_shell-1243`.
  - On GitHub runners, CI runs `npx playwright install --with-deps chromium`. That download (`https://cdn.playwright.dev/builds/cft/153.0.8010.12/linux64/chrome-linux64.zip` and `chrome-headless-shell-linux64.zip`) was only dry-run here, not fetched. On a pull request, `pages.yml` installs `chromium webkit`, WebKit for the `webkit-iphone` project (M3.12). The container has no WebKit (`/opt/pw-browsers` holds Chromium alone), so that project runs only in CI.
- **wrangler:** an exact devDependency of `web/` (M2.2), `wrangler@4.154.0`. It pulls `workerd` from npm. No login or deploy was probed.
- **solc:** `solc@0.8.28` installs, but nothing needs it. npm audit flags its `tmp` dependency (GHSA-52f5-9888-hmc6, GHSA-ph9p-34f9-6g65).

### Foundry (contracts)

- **Install:**
  1. Download `https://github.com/foundry-rs/foundry/releases/download/v1.8.6/foundry_v1.8.6_linux_amd64.tar.gz`.
  2. Check its sha256: `58850106984038f3a7200f38a4182c8cb423d3a4f4c7848eacbc2453e6bc35fc`.
  3. Run `tar -xzf <archive> --no-same-owner -C /usr/local/bin forge cast anvil chisel`.
- **First error:** both `foundryup-init.sh` and `foundryup --install v1.8.6` (foundryup 2.0.0) read an attestation link from a release asset, then fetch the Sigstore bundle from a GitHub page, which returns 403: `failed to download https://github.com/foundry-rs/foundry/attestations/58324376/download ... 403 Forbidden`. foundryup's `--force`, which skips verification, is not used.
- **Notes:** `forge init` clones forge-std from github.com, which works. The first `forge build` downloads solc 0.8.28 from `binaries.soliditylang.org`.
- **Solidity libraries (M4.3):** forge-std v1.17.0 and OpenZeppelin Contracts v5.7.0, git submodules under `contracts/lib/`, installed with `forge install --root "$PWD/contracts" foundry-rs/forge-std@v1.17.0 OpenZeppelin/openzeppelin-contracts@v5.7.0`. The parent commit pins each submodule's commit, and `contracts/foundry.lock` records its tag. Run from the repository root with `--root contracts`, forge 1.8.6 failed with "Library directory is not relative to the repository root", and with `--shallow` it found no tag (`Tag: "v1.17.0" not found`); an absolute `--root` without `--shallow` works. In a checkout without them, `forge build` initializes them itself ("Missing dependencies found. Installing now..."); CI checks them out with `submodules: true`.

### slither (contracts)

- **Install:** `pip install slither-analyzer==0.11.6`. The system Python 3.13 accepts global installs, which put `slither`, `solc-select` and a `solc` shim in `/usr/local/bin`.
- **Note:** `slither .` exits with 255 when it reports findings, so CI must read its output rather than treat 255 as a crash.

### Docker (started by hand)

- **Start:**

  ```bash
  setsid nohup env HTTPS_PROXY="$HTTPS_PROXY" NO_PROXY="$NO_PROXY" SSL_CERT_FILE=/root/.ccr/ca-bundle.crt \
    dockerd --registry-mirror https://mirror.gcr.io > /tmp/dockerd.log 2>&1 < /dev/null &
  for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 1; done
  docker run --rm hello-world
  ```

- **First error:** after one pull, Docker Hub answered `toomanyrequests: You have reached your unauthenticated pull rate limit` (`ratelimit-remaining: 0`). Through the mirror, `hello-world` and `offchainlabs/nitro-node:v3.12.2-5f02f3f` both resolve.
- **Notes:**
  - The daemon starts in about 1 s as root.
  - Containers cannot reach the proxy at `127.0.0.1` and do not trust its CA. A container that needs outbound HTTPS runs with `--network host` and gets `/root/.ccr/ca-bundle.crt` installed.
  - nitro-devnode's script still defaults to `v3.7.1-926f1ab`; M4.2 sets `NITRO_NODE_VERSION` explicitly.

### nitro-devnode (M4.2)

- **Pins:** [`scripts/contracts/nitro/run-dev-node.sh`](../scripts/contracts/nitro/run-dev-node.sh) and `stylus-deployer-bytecode.txt`, vendored from OffchainLabs/nitro-devnode at commit `ebb523d4ed9c04d4183743af844a038e9843f352` (2025-10-21, the head of its default branch on 2026-11-01). `NITRO_NODE_VERSION` defaults to `v3.12.2-5f02f3f` in the vendored script, the newest `offchainlabs/nitro-node` release tag on Docker Hub on 2026-11-01; image digest `sha256:87548501c3ee41cff84e6764cc86f65eb7f0a14e2e50a0d3219d462e5793680d`, 4.97 GB unpacked.
- **URLs:** `https://raw.githubusercontent.com/OffchainLabs/nitro-devnode/ebb523d4ed9c04d4183743af844a038e9843f352/run-dev-node.sh` (sha256 `c06bfeb64439616db083b43f2c6853cfbb17f1176a5b0d0b2254d5b9447aece3` as fetched) and `.../stylus-deployer-bytecode.txt` (sha256 `ffe02027df14e24e3cae5eb71c18be85e50fd3490b16484fa8e691b5b99c99c6`, committed unchanged). The commit sha came from a `git clone`, since `api.github.com` is refused. The image comes from Docker Hub on the runners, and through `mirror.gcr.io` in the container.
- **Changes to the script:** a provenance header and the `NITRO_NODE_VERSION` default, which upstream leaves at `v3.7.1-926f1ab`.
- **Run:** from its own directory, since it reads `./stylus-deployer-bytecode.txt`: `cd scripts/contracts/nitro && bash run-dev-node.sh`. It needs `docker`, `curl` and Foundry's `cast`, serves RPC on `http://127.0.0.1:8547` (chainId 412346), and prints `Nitro node is running... (press Ctrl-C to stop)` once the node, the CREATE2 factory, the cache manager and StylusDeployer are set up, about 7 s after the image is present. It stays in the foreground and removes its container on exit.
- **Development key:** the script's `PRIVATE_KEY`, nitro-devnode's public prefunded account `0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E`. It is not a secret (plan §1.3); `stylus-gas.yml` reads it from the vendored script.
- **Quirk with Foundry 1.8.6:** `cast create2` prints the address and the salt, so the script's StylusDeployer check calls `cast code` with an extra argument, which prints a usage error and does not stop the script. StylusDeployer is still deployed at `0xcEcba2F1DC234f70Dd89F2041029807F8D03A990`, cargo-stylus's default `--deployer-address`, as `cast code` shows.
- **cargo stylus deploy** needs a `Stylus.toml` at the Cargo workspace root, even with `--wasm-file` (`error: missing Stylus.toml` otherwise). The repository root holds ethblockdigger's `referee/Stylus.toml`, unchanged.

### zkVM toolchains (for M1.12's zk tier)

Only each framework's Rust toolchain was installed; M1.16 and M1.17 install the full SDKs.

- **SP1, 1.3 GB, 36 s.**
  - **First error:** plain `sp1up` fails with `Unable to access the latest release at: https://api.github.com/repos/succinctlabs/sp1/releases/latest`. `sp1up --version 6.10.0` installs `cargo-prove` from its release asset, then `cargo prove install-toolchain` fails on `https://api.github.com/repos/succinctlabs/rust/releases`.
  - **Direct route:**
    1. Download `https://github.com/succinctlabs/sp1/releases/download/v6.10.0/cargo_prove_v6.10.0_linux_amd64.tar.gz` (sha256 `10394a834a0ab325b3736a74d0b7087274f2c6a66e2b38f96ecf3e9ecdf9e7b5`) and unpack it into `~/.sp1/bin`.
    2. Download `https://github.com/succinctlabs/rust/releases/download/succinct-1.96.0-64bit-v3/rust-toolchain-x86_64-unknown-linux-gnu.tar.gz` (sha256 `23905647c8ba007bed72e9207ceada06d08023f4dca73c87a122acbe7468ce07`) and unpack it into `~/.sp1/toolchains/succinct-1.96.0-64bit-v3`.
    3. Run `chmod 755 ~/.sp1/toolchains/succinct-1.96.0-64bit-v3/bin/* ~/.sp1/toolchains/succinct-1.96.0-64bit-v3/lib/rustlib/x86_64-unknown-linux-gnu/bin/*`, as `cargo prove install-toolchain` does.
    4. Run `rustup toolchain link succinct ~/.sp1/toolchains/succinct-1.96.0-64bit-v3`.
  - **Toolchain:** it provides `riscv64im-succinct-zkvm-elf` (SP1 v6 is 64-bit) and `riscv32im-succinct-zkvm-elf`.
- **RISC Zero, 1.6 GB, 46 s.**
  - **First error:** rzup 0.6.0 checks every download through `api.github.com`, and its built-in TLS roots reject the proxy's certificate: `InvalidCertificate(UnknownIssuer)` on `https://api.github.com/repos/risc0/rust/releases/tags/r0.1.97.0`.
  - **Direct route:**
    1. Download `https://artifacts.risczero.net/rzup/prod/Linux-X64/rzup` (sha256 `2cbb8081730ca42acac6818a279c7f218878b571a7f9ff76970f60688f54ddf5`) into `~/.risc0/bin`. The URL has no version and serves the newest rzup (0.6.0 on 2026-10-28), so this check fails loudly once RISC Zero publishes a new rzup. Then skip rzup, and write what step 3 writes by hand: `~/.risc0/settings.toml` with `[default_versions]` and `rust = "1.97.0"`, and the symlink `~/.rustup/toolchains/risc0 -> ~/.risc0/toolchains/v1.97.0-rust-x86_64-unknown-linux-gnu`. `rustup toolchain link risc0` alone is not enough: risc0-build 3.0.6 finds the toolchain through rzup's settings.
    2. Download `https://github.com/risc0/rust/releases/download/r0.1.97.0/rust-toolchain-x86_64-unknown-linux-gnu.tar.gz` (sha256 `100b597d605b706bec94e1d32bfaaf5851df8d75173f986d4b56a3e90916be53`) and unpack it into `~/.risc0/toolchains/v1.97.0-rust-x86_64-unknown-linux-gnu`.
    3. Run the offline `rzup default rust 1.97.0`, which registers the `risc0` rustup toolchain.
  - **Toolchain:** its target is `riscv32im-risc0-zkvm-elf`.
  - **The zk tier (M1.12)** runs step 2, then writes `~/.risc0/settings.toml` and runs `rustup toolchain link risc0 ~/.risc0/toolchains/v1.97.0-rust-x86_64-unknown-linux-gnu`, which makes the symlink of step 1. It skips the rzup binary and step 3: risc0-build reads rzup's settings as a library (M1.17). `RISC0_HOME` moves `~/.risc0`, as it does for risc0-build. The host's `prove` feature also needs a C++ compiler, which the tier checks for.

## Bootstrap tiers

`bash scripts/bootstrap.sh <tier>` installs only what is missing, checks each tool again after installing it, and prints `nothing to install` when the tier is complete.

The SessionStart hook in `.claude/settings.json` runs the core tier at the start of every cloud session whose working directory is this repository. Claude Code reads project hooks only from `<working directory>/.claude/settings.json`, so a session started with several repositories (working directory `/home/user`) does not run it; there, run `bash scripts/bootstrap.sh core` first. If the bootstrap fails, the hook tells both the user and the agent that the session is not ready.

| Tier | Installs | Fresh install time |
|---|---|---|
| core | the Rust toolchain of `rust-toolchain.toml` | 35 to 49 s |
| web | core, then checks for Node 22 and the preinstalled Chromium, and runs `npm install` in `web/` once it has a lockfile | under 1 s until `web/` exists |
| contracts | core, cargo-stylus 0.10.10, binaryen 120.0.0, Foundry v1.8.6, slither 0.11.6 | about 8 min, mostly cargo-stylus |
| zk | core, a check for a C++ compiler (`g++`), the RISC Zero Rust toolchain `r0.1.97.0` from its release asset with its sha256, rzup's `settings.toml` and the `risc0` rustup toolchain (zkVM toolchains, above). The first build of `referee/zk/` then takes about an hour (docs/VERIFICATION.md, RISC Zero) | 1 min 7 s with an empty `RUSTUP_HOME` and `RISC0_HOME`, the core tier's Rust install included (M1.12) |

## Actions minutes

Billed minutes per run of each workflow, read from `actions_list` job timings, rounded up per job. Items that add or change a workflow add its row.

Monthly budget: none since 2026-11-10, when the repository became public: GitHub does not bill standard runners on public repositories. While it was private, the budget was 1,500 minutes (see Decisions, P14). The `get_workflow_run_usage` method reports 0 ms for this organization's runs, so the minutes come from each job's start and end times.

| Workflow | Billed minutes per run | Measured in |
|---|---|---|
| `ci.yml`, job `rust` | 1: the job took 43 and 47 s with every step running, and the minimum is one minute | M0.4, runs [40819133258](https://github.com/detychey/jiro-ikusu/actions/runs/40819133258) and [40819307102](https://github.com/detychey/jiro-ikusu/actions/runs/40819307102) |
| `ci.yml`, job `rust`, from M1.1 | 2: the job took 72 s, of which debug tests 11 s, release tests 21 s (mostly the LTO build) and the target and MSRV builds 11 s | M1.1, run [40871486955](https://github.com/detychey/jiro-ikusu/actions/runs/40871486955) |
| `ci.yml`, job `rust`, from M1.11 | 4: the job took 192 s with the 43 game vectors of M1.9, the version gate and wasm-parity, and 207 s on M2.1's run | M1.11 and M2.1, runs [40974842315](https://github.com/detychey/jiro-ikusu/actions/runs/40974842315) and [40975310871](https://github.com/detychey/jiro-ikusu/actions/runs/40975310871) |
| `ci.yml`, job `rust`, from M1.10 | 5, as on `main` before it, where the job took 252 s: the job took 271 s. M1.10 adds 22 s to release tests (146 s against 124 s): about 10 s more release build with `jiro-tools` as `jiro-core`'s dev-dependency, and the 5 properties at 2,000 cases in 12.51 s. It adds 10 s to debug tests (66 s against 56 s) | M1.10, run [41131436522](https://github.com/detychey/jiro-ikusu/actions/runs/41131436522), against `main`'s run [41128889536](https://github.com/detychey/jiro-ikusu/actions/runs/41128889536) |
| `ci.yml`, job `rust`, from M4.1 | 6 with its cache warm: the job took 350 s, of which debug tests 71 s, release tests 168 s, the 200 fixed difffuzz cases 13 s and `referee/build-wasm.sh` 7 s. 14 on a cold cache, as when `Cargo.lock` changes: 820 s, of which clippy 117 s, debug tests 175 s and release tests 368 s, mostly building stylus-sdk and its alloy dependencies, LTO included. Its timeout rose from 15 to 25 minutes for such a run | M4.1, runs [41169977520](https://github.com/detychey/jiro-ikusu/actions/runs/41169977520) (warm) and [41167711178](https://github.com/detychey/jiro-ikusu/actions/runs/41167711178) (cold) |
| `ci.yml`, job `web` | 1: the job took 45 s with its caches warm: toolchain, wasm build, npm ci, typecheck, lint, vitest, build and the native replay check | M2.1, run [40975310871](https://github.com/detychey/jiro-ikusu/actions/runs/40975310871) |
| `ci.yml`, job `web`, from M5.2 | 2: the job took 118 s with its Rust cache warm, of which 24 s are the step M5.2 adds: the `jiro-tools` build (cached), `npm ci` of `scripts/contracts`, `localnet.mjs --up` with the forge build, and the five Challenge e2e cases, each a few seconds. Foundry's install adds 4 s | M5.2, run [41355562556](https://github.com/detychey/jiro-ikusu/actions/runs/41355562556) |
| `ci.yml`, job `contracts` | 1, an estimate until a run is measured. Locally, with solc 0.8.28 cached, the build and the 16 tests took 1.9 s and `scripts/contracts/abi.sh` 0.3 s; the runner adds the checkout with the two submodules, the Foundry download and solc's. When its steps skip, the job still bills the one-minute minimum | M4.3, local timing |
| `ci.yml`, job `contracts`, from M4.11 | 3, an estimate until this PR's run is measured. On `main` at M4.7's merge the job took 129 s, of which the forge build and tests 116 s. M4.11 adds `setup-node` with its npm cache, `npm ci` of `scripts/contracts` (1.4 s locally), the deployment-record tests (0.4 s) and `localnet.mjs --check` (2.8 s locally, from an empty `contracts/out`: the build, anvil's start, 18 transactions and the checks), a few seconds in all | M4.7's run [41343860951](https://github.com/detychey/jiro-ikusu/actions/runs/41343860951) on `main`, and local timing |
| `ci.yml`, job `zk-exec` | 4 with its cache warm: the job took 3 min 41 s, of which restoring the RISC Zero toolchain (501 MB) 15 s and the build cache (1.45 GB) 49 s, the build 39 s (the guests, and the host relinked), the executor on the 51 format vectors and 4 game vectors 13 s, and the dev-mode round trip 1 min 19 s. 70 on a cold cache: 69 min 52 s, of which the host build 62 min 58 s, almost all of it `g++` on RISC Zero's circuit kernels, and the round trip 5 min 13 s, since `cargo test` builds the dependencies again with `panic = "unwind"`. A cold run happens when `referee/zk/Cargo.lock`, `referee/zk/host/Cargo.toml` or a toolchain changes, on a branch with no cache to restore, and after GitHub evicts the cache, 7 days after its last use. The build step's time limit follows: 20 minutes on an exact cache hit, 80 otherwise, under a 95-minute job limit. The first push to `main` after M1.12 merges runs cold and seeds `main`'s cache, which later PRs restore. When its steps skip, the job bills 1 minute | M1.12, runs [41368126873](https://github.com/detychey/jiro-ikusu/actions/runs/41368126873) (cold) and [41375427775](https://github.com/detychey/jiro-ikusu/actions/runs/41375427775) (warm) |
| `ci.yml`, jobs `rust` and `zk-exec`, from M1.13 | Unchanged in whole minutes with their caches warm: `rust` took 6 min 0 s, of which the new difffuzz step 26 s (`npm ci` of `web` 25 s with setup-node's npm cache, then the 200 fixed cases through jiro-wasm under 1 s); `zk-exec` took 5 min 44 s, of which the 20 fixed cases 28 s (a debug build of `jiro-tools` 7 s, writing the cases 2 s, the executor 18 s) | M1.13, run [41414509413](https://github.com/detychey/jiro-ikusu/actions/runs/41414509413) |
| `pages.yml` | 3: job `build` took 66 s (2 minutes), of which the smoke test 31 s; job `deploy` took 22 s (1 minute), of which wrangler 13 s | M2.2, run [40975816996](https://github.com/detychey/jiro-ikusu/actions/runs/40975816996) |
| `stylus-gas.yml`, on the `ci:heavy` label | 10 on a cold cache: the job took 9 min 16 s, mostly building cargo-stylus and the release builds of `difffuzz` and the referee, with the 4.97 GB image pull overlapping them. About 5 with its caches warm, an estimate until a warm run is measured. The label also starts `nightly.yml`'s `heavy` job (1 minute on this run). 12 on a `workflow_dispatch` of a new branch: 11 min 44 s, of which 9 min building cargo-stylus, since its cache is saved per branch and `main` has none | M4.2, run [41335622698](https://github.com/detychey/jiro-ikusu/actions/runs/41335622698); M4.9, run [41412617292](https://github.com/detychey/jiro-ikusu/actions/runs/41412617292) |
| `e2e.yml`, on the `ci:heavy` label | 15 on a cold cache: the job took 14 min 42 s, of which 8 min 44 s to build cargo-stylus, with the image pull overlapping the builds. 5 with its caches warm: 4 min 29 s, of which the suite 3 min 19 s, about half of it the wait for the season's end + grace (30 s + 120 s). The label also starts `stylus-gas.yml` and `nightly.yml`, which this PR cancelled | M4.16, runs [41348621860](https://github.com/detychey/jiro-ikusu/actions/runs/41348621860) (cold) and [41350044090](https://github.com/detychey/jiro-ikusu/actions/runs/41350044090) (warm) |
| `nightly.yml`, on the `ci:heavy` label | 2: the job took 65 s, of which the toolchain 17 s, the 5 properties at 2,000 cases 25 s (13.41 s of tests) and `difffuzz`'s 200 cases 16 s | M1.10, run [41132129067](https://github.com/detychey/jiro-ikusu/actions/runs/41132129067) |
| `nightly.yml`, job `zk-exec`, from M1.12 | 7 with ci.yml's zk-exec cache warm: the job took 6 min 5 s, of which restoring the two caches 1 min 2 s, the build 50 s and every vector (126) through the executor 3 min 46 s. It runs after the `heavy` job, on the `ci:heavy` label and on schedule, and shares ci.yml's cache key, so it runs cold (about 70) only when that cache is missing | M1.12, run [41375987597](https://github.com/detychey/jiro-ikusu/actions/runs/41375987597) |
| `nightly.yml`, from M1.13, on `workflow_dispatch` | 19 with ci.yml's zk-exec cache warm: `heavy` 4 (3 min 15 s, of which the difffuzz step 2 min 15 s: the release build and 10,000 cases of the rotating seed 49 s, the wasm build 1 s, `npm ci` of `web` 39 s, the 10,000 cases through jiro-wasm 45 s) and `zk-exec` 15 (14 min 13 s, of which every vector through the executor 5 min 19 s and the difffuzz step 6 min 13 s: the debug `jiro-tools` build 8 s, writing the 200 cases 41 s, the executor 5 min 24 s). The scheduled run runs the same difffuzz counts, so it adds about 2 to `heavy` and about 7 to `zk-exec`; a `ci:heavy` label run uses 2,000 and 20 cases | M1.13, run [41414506340](https://github.com/detychey/jiro-ikusu/actions/runs/41414506340) |
| `nightly.yml`, weekly schedule | About 12 to 20, an estimate until the first scheduled run is measured. The 5 properties at 100,000 cases took 546 s locally on 4 CPUs, almost all of it the determinism property on one thread, and the minion coverage 21 s. The runner ran the 2,000 cases in 7.29 s and in 13.41 s against about 11 s locally, which gives about 6 to 11 minutes there; the toolchain, build and `difffuzz` add about 2. From M2.9, `calibrate --check` adds about 3 to 5: 75 s locally on 4 CPUs, with 293 s of CPU time across its threads; the playtest and levels build before it add about 1 to 2, the playtest taking 30 s locally. A week with no new commit on `main` stops after the first step and bills 1 minute. At 4 to 5 runs a month, that is at most about 100 minutes a month | M1.10 and M2.9, runs [41132129067](https://github.com/detychey/jiro-ikusu/actions/runs/41132129067) and [41144800510](https://github.com/detychey/jiro-ikusu/actions/runs/41144800510), and local timing |
| `zk-prove.yml`, on the `ci:heavy` label | 212 for the PR run's two jobs, which run at once: `prove (run)` 173 (172 min 44 s, of which proving the six small game vectors in run mode 169 min 33 s), `prove (level)` 39 (38 min 49 s, of which proving `commit-at-tick-0` 35 min 34 s). Each restores ci.yml's zk-exec cache (27 s), builds in 1 min 36 s to 1 min 39 s and pulls the Groth16 image in 30 s. Proving dominates and follows the proving cycles: 550 to 650 s of a 2-vCPU runner per 2^19-cycle segment, recursion included (docs/VERIFICATION.md, zk costs), so a dispatch of `worst-case` would exceed the 6-hour job limit here. The label also starts `nightly.yml`, `stylus-gas.yml` and `e2e.yml`, which this PR cancelled within two minutes | M4.8, run [41386918742](https://github.com/detychey/jiro-ikusu/actions/runs/41386918742) |

**M4.8's runs** (PR #58), billed minutes rounded up per job from `actions_list` job timings:

- `ci.yml` [41382294154](https://github.com/detychey/jiro-ikusu/actions/runs/41382294154): `rust` 7, `contracts` 3, `web` 2, and `zk-exec` about 10, cancelled after 9 min in its cold build: `main`'s first zk-exec run after M1.12, which seeds the cache that PRs restore, was still building. 22 in all.
- `ci.yml` [41386734191](https://github.com/detychey/jiro-ikusu/actions/runs/41386734191), with `main`'s zk-exec cache warm: `zk-exec` 6 (5 min 20 s), `rust` 6, `contracts` 3, `web` 2. 17 in all.
- `zk-prove.yml` [41386918742](https://github.com/detychey/jiro-ikusu/actions/runs/41386918742): 212 (above). `nightly.yml` [41386918596](https://github.com/detychey/jiro-ikusu/actions/runs/41386918596), `stylus-gas.yml` [41386918579](https://github.com/detychey/jiro-ikusu/actions/runs/41386918579) and `e2e.yml` [41386918477](https://github.com/detychey/jiro-ikusu/actions/runs/41386918477), started by the same label and cancelled: about 1 to 2 each.
- The push that commits the fixture runs `ci.yml` once more, about 17 with its caches warm; the PR links that run. M4.8 thus used about 270 billed minutes, 212 of them proving.

**M1.13's runs** (PR #60), billed minutes rounded up per job from `actions_list` job timings:

- `ci.yml` [41414509413](https://github.com/detychey/jiro-ikusu/actions/runs/41414509413): `rust` 6, `zk-exec` 6, `contracts` 4, `web` 2. 18 in all.
- `pages.yml` [41414509189](https://github.com/detychey/jiro-ikusu/actions/runs/41414509189), which `web/**` starts: `build` 2, `deploy` 1. 3 in all.
- `nightly.yml` [41414506340](https://github.com/detychey/jiro-ikusu/actions/runs/41414506340), dispatched on the branch: 19 (above).
- `ci.yml` [41416737122](https://github.com/detychey/jiro-ikusu/actions/runs/41416737122) and `pages.yml` [41416737007](https://github.com/detychey/jiro-ikusu/actions/runs/41416737007), on the push that changes only `docs/TOOLING.md`: `rust` 8, `zk-exec` 5, `contracts` 4, `web` 3, and `pages.yml` 3. 23 in all: the path filters compare the whole PR with `main`, not the push with the previous one, so a docs-only push to a PR re-runs every step its earlier commits started. M1.13 thus used about 63 billed minutes before its review fix, whose push runs `ci.yml` once more.

## CI runners and access (M0.4)

- **Runner:** `ubuntu-24.04` (image 20261025.353), 2 vCPUs (`nproc` = 2), 7 GB RAM and 2 GB swap (`free -g`), as GitHub gives private repositories. The image also ships Rust 1.99.1; `scripts/bootstrap.sh core` installs the 1.98.0 pin in about 17 s, and a step checks `rustc --version` against `rust-toolchain.toml`.
- **Logs:** `get_job_logs` with `return_content` returns a job's log in the container, so results printed between log markers can be read.
- **Artifacts:** `actions_get` `download_workflow_run_artifact` returns a short-lived signed URL on `productionresultssa30.blob.core.windows.net`, and `curl` fetches the zip through the proxy. Artifacts can therefore be brought into the container, as long as the URL is used within its few minutes of validity.
- **Labels:** adding an unknown label to a PR with `issue_write` creates it; `ci:heavy` was created this way on 2026-10-29.
- **Dispatch on a branch (M1.1):** `actions_run_trigger` `run_workflow` with `workflow_id` `ci.yml` and `ref` set to a branch returns 204 and starts a `workflow_dispatch` run on that branch's head. [Run 40869943184](https://github.com/detychey/jiro-ikusu/actions/runs/40869943184), on `claude/cool-brahmagupta-ylv9cn` at d7ad8e6, ran every step and passed in 37 s, and `get_job_logs` read its log. A workflow file must already be on `main` to be dispatched this way (plan §1.3).
