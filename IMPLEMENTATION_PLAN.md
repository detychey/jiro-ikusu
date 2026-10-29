# Jiro-ikusu implementation plan

**Status: adopted on 2026-10-27. On 2026-10-28 the owner answered every open decision (README §13), and on 2026-10-29 D14, which M0.7's review raised. M0's rules freeze closed with M0.7: M0.1, M0.2 and M0.5-M0.7 have merged, and M0.3 and M0.4 have not started.** This file is `IMPLEMENTATION_PLAN.md`, at the repository root. The PR that adds it also lists it in the README's "Repository files" and links it from README §9. It covers README §9 milestones M0 to M5. M6 (Superchallenge) is deferred ([`TODO.md`](TODO.md)).

[`README.md`](README.md) is the normative specification, and this plan turns it into 64 work items. Four are conditional (M1.14, M1.15, M4.10, M4.15) and one is optional (M4.13). A coding agent completes and checks each item as one pull request in the cloud container, and the user reviews and merges it. If this plan and the README disagree, the README wins. An item that needs a README change makes that change in its own PR and says so in the PR body.

The order:

1. **Gates before code** (M0.1-M0.4): a pinned toolchain, a session bootstrap, and CI checks that catch nondeterminism.
2. **Rules freeze** (M0.5-M0.7): every open decision except D2 and D7, and every "frozen in M0" placeholder, written into the README as exact, tagged text. D14, raised in M0.7's review, gets its exact rule in M1.18.
3. **The core** (M1): one rule area per PR, then golden vectors with per-tick traces that every later target must reproduce.
4. **Parallel tracks.** Device bring-up starts during M1 (M3.1), the contracts after M0 (M4.3), and the level tool after the format vectors (M2.4). Bots and levels follow replay (M1.8). Stylus gas and the zk trials follow the gameplay vectors (M1.9), and the zk proving pipeline follows the zk choice (M1.12). The browser follows the wasm build (M1.11). Measurements feed back into the work; they never block rule work.
5. **dApp and a testnet season** (M5).

Item count: M0 7, M1 18, M2 10, M3 7, M4 16, M5 6. Review findings split out of M4.12 add items from M4.17 on.

## Contents

1. [How to use this plan](#1-how-to-use-this-plan)
2. [Execution environment and what needs the user](#2-execution-environment-and-what-needs-the-user)
3. [Repository layout and toolchain](#3-repository-layout-and-toolchain)
4. [Milestone overview](#4-milestone-overview)
5. [M0 Rules freeze](#5-m0-rules-freeze)
6. [M1 Core](#6-m1-core)
7. [M2 Browser, levels and bots](#7-m2-browser-levels-and-bots)
8. [M3 Pico](#8-m3-pico)
9. [M4 Referee and contracts](#9-m4-referee-and-contracts)
10. [M5 dApp and testnet season](#10-m5-dapp-and-testnet-season)
11. [Decision schedule](#11-decision-schedule)
12. [Dependency graph and critical path](#12-dependency-graph-and-critical-path)
13. [Human-in-the-loop checklist](#13-human-in-the-loop-checklist)
14. [Risk register](#14-risk-register)
15. [Open questions](#15-open-questions)
16. [Deferred work](#16-deferred-work)

## 1. How to use this plan

### 1.1 One work item, one PR

- **Ids.** Items are numbered `M<milestone>.<n>`. Ids are stable and never reused. A new item, whether split from an existing one or added as a follow-up, takes the next free number in its milestone. So numbers do not always follow dependency order; the "Depends on" column does.
  - Reserved: M4.15 for the Stylus gas optimization that M4.9 files if the gas gate fails (§4); M4.17 and up for review findings that M4.12 splits out.
- **Conditional items** (M1.14, M1.15, M4.10, M4.15) are built only if a measurement calls for them. The PR that rules one out marks it "not built" (or "deferred") in this file. M4.13 is optional.
- **Depends on** means merged, unless the item is stacked on an open dependency (§1.2).
- **PR titles** start with the id, for example `M1.3 Level format v1, validity, rail and claim`.
- **Agents never push to `main` and never merge** their own PRs.
- **Sizes** count changed lines, excluding generated files (`vectors/`, `levels/*.bin`, `contracts/abi/`, lockfiles, `reports/`):

  | Size | Changed lines | Critical-path weight (§12) |
  |---|---|---|
  | S | up to 300 | 1 |
  | M | up to 1,000 | 2 |
  | L | up to 2,000, and finishable in one session | 3 |

- **Scope.** A PR contains only its item's deliverables ([`GUIDELINES.md`](GUIDELINES.md) §3). If an item outgrows L, or this plan is wrong, the PR updates this file, splits the item and explains why.

Each work item block has these fields:

| Field | Meaning |
|---|---|
| Goal | The one outcome the PR delivers |
| Deliverables | Files and changes the PR contains |
| Done when | Objective acceptance criteria; all must hold before merge. A line marked **(user)** can only be satisfied by the user (§1.2, step 7). |
| Verify with | Commands or checks that show each criterion |
| Skills | Skills to load before starting; "tier" names the extra `bootstrap.sh` tier to run |
| README | Sections the item implements or edits |
| Needs user | What only the user can do; "none" means agent-only |

### 1.2 Pick up, claim, resume, finish

1. **Find an eligible item.** List open and merged PRs with the GitHub tools. An item is eligible when:
   - each "Depends on" item is merged, or is open with every done-when line ticked except its (user) lines (then stack on it, step 3);
   - no open PR title starts with the item's id.
2. **Claim it.** Branch `m<milestone>-<n>-<slug>`, for example `m1-3-level-format`. If the session prescribes a branch name, use that one and keep the id in the PR title. Push the first commit and open a draft PR at once, titled with the id, with the body from the template. The draft PR is the claim.
3. **Stack on an open dependency** when needed: branch from the dependency's branch, set the PR base to it, and start the body with "Stacked on #N". When the base merges, retarget the PR to `main` (GitHub does this itself if head branches are deleted on merge) and rebase if needed. After any change to a base PR, rebase the PRs stacked on it.
4. **Resume.** Check out the draft PR's branch, read the PR's comments (the user's answers and reports arrive there), and continue from its unticked lines. The PR body is the state: a line is ticked only with its evidence.
5. **Checkpoint.** Push before a session ends. Items that span sessions list their checkpoints in the PR body. Time-bound checkpoints (M5.6) also get a reminder scheduled with `send_later`.
6. **Finish.** Every done-when line except the (user) lines is ticked with evidence, CI is green, and the user's step is written in the PR body as an instruction. Then mark the PR ready for review. Before the session ends, call `subscribe_pr_activity` on the PR, so the user's reply wakes a session; if that is not possible, the PR body tells the user to start a session with `resume M<x>`.
7. **Close the (user) lines.** The user answers in a PR comment, as text or as JSON in a fenced code block, or adds files to the PR branch with GitHub's "Upload files". The agent's tools read comment text but not files attached to comments, so anything the agent must commit or check comes as pasted text or as a file on the branch. The resuming agent commits the evidence (a report, a PASS list), ticks the (user) line, and says so in a comment. The user merges only after that.

### 1.3 Conventions for agents

- **Session start.** From M0.2 on, a SessionStart hook runs `scripts/bootstrap.sh core` in cloud sessions whose working directory is this repository. Claude Code reads project hooks only from the working directory's `.claude/settings.json`, so a session started with several repositories runs `bash scripts/bootstrap.sh core` itself first. An item that names another tier (`web`, `contracts`, `firmware`, `zk`) runs `bash scripts/bootstrap.sh <tier>` first.
- **Skills.** Load the skills an item lists before writing code. The project skills are:
  - [`deterministic-core`](.claude/skills/deterministic-core/SKILL.md)
  - [`journal-codec`](.claude/skills/journal-codec/SKILL.md)
  - [`parity-testing`](.claude/skills/parity-testing/SKILL.md)
  - [`rp2040-firmware`](.claude/skills/rp2040-firmware/SKILL.md)
  - [`onchain-referee`](.claude/skills/onchain-referee/SKILL.md)

  The ethskills are the `ethskills` index (M0.1), the `ship` guide and 19 topic skills (M0.3); `why` loads under the name `why-ethereum`. They are input, not project rules (README §12). Use the committed copies only. Never fetch from or send anything to ethskills.com, including the `feedback` POST and the "send a note via feedback" lines some of them contain, unless the user asks for it in the current session.
- **README first.** Read the README sections an item lists. The README is the rulebook; skills and this plan point to it.
- **ethblockdigger** supplies the ported files and patterns.
  - Commands in this plan expect a checkout at `../ethblockdigger`. If it is missing, attach it with `add_repo` and clone it.
  - Links point to `https://github.com/detychey/ethblockdigger/blob/main/`.
- **Changing a rule, a format, a level or a season parameter** follows the sync table that M0.1 puts in `CLAUDE.md`.
- **Measurements** (gas, cycles, timings, sizes) are committed to `docs/` or `reports/`, with the commit sha and tool versions. A number that exists only in a chat is lost.
  - Timing criteria in this plan are measured in the container: release build, 4 CPUs, with the command shown in the PR.
  - CI jobs have a `timeout-minutes` budget instead.
- **CI profile (P14).** M0.4 builds one of two profiles, chosen from the round A1 answer:
  - **public** (a public repository, or a plan with enough minutes): heavy workflows (`nightly`, `stylus-gas`, `zk-prove`, `e2e`) run on every `pull_request` that touches their paths, and scheduled runs are daily.
  - **private** (metered minutes, the expected case, §2): `ci.yml` groups its checks into at most four jobs (§3.4). Heavy workflows run only on `workflow_dispatch` or when the `ci:heavy` label is added to a PR (`pull_request` of type `labeled`). Scheduled runs are weekly.

  "This PR's `<workflow>` run" means a run on the PR's head: path-triggered in the public profile, label-triggered in the private one. To rerun a label-triggered workflow, remove the label and add it again.
- **Minutes budget.** `docs/TOOLING.md` records the billed minutes per run of each workflow, from the job timings that `actions_list` returns, and a monthly budget. Before triggering a heavy run, the agent sums this month's billed minutes the same way. If the run would exceed the budget, it skips the run and says so in the PR.
- **Workflows.** Every workflow file follows these rules.
  - `ci.yml` runs on every `pull_request` with no branch filter, so stacked PRs run too, on pushes to `main`, and on `workflow_dispatch`. Only `ci.yml` jobs may be required checks. A job that depends on paths always starts, and skips its steps through a pinned path-filter step (dorny/paths-filter), so it always reports a status. On `workflow_dispatch`, every step runs.
  - Every other workflow (`nightly`, `pages`, `stylus-gas`, `zk-prove`, `e2e`, `season-ops`) declares a `pull_request` trigger for its profile: a `paths` filter that includes the workflow file itself and the directories it covers, or the `ci:heavy` label. It also declares `workflow_dispatch`, and `schedule` or pushes to `main` where needed. These workflows are never required checks.
  - **Evidence for a new workflow** is its `pull_request` run on the PR that adds it. GitHub runs `schedule` only on the default branch, and `workflow_dispatch` only for workflow files already on the default branch, so neither can prove the PR that adds the workflow. Later items may dispatch it on their own branch (`actions_run_trigger` with `ref`).
  - **Heavy runs** use a reduced case count on `pull_request` and the full count on `schedule`. A scheduled `nightly.yml` run skips its work when `main` has no commit since the previous scheduled run. No other workflow skips scheduled work.
  - **Concurrency.** Every workflow sets a `concurrency` group per workflow and ref. Pull-request runs cancel in progress. Runs that deploy or send transactions never do: `season-ops.yml`, and `pages.yml` on pushes to `main`, set `cancel-in-progress: false`.
  - **Caching and limits.** Every workflow caches Rust builds (Swatinem/rust-cache) and installed binaries (actions/cache), and gives every job a `timeout-minutes`. Artifacts the user flashes (UF2 files) set `retention-days: 90`.
  - **Results the agent needs** (gas tables, cycle tables, proof fixtures, preview URLs) are printed to the job log between `=== BEGIN <name> ===` and `=== END <name> ===`, and read with `get_job_logs` (`tail_lines`). Job summaries and artifacts are secondary outputs.
- **Downloads.**
  - Pin every installer to an explicit version, for example `foundryup --install <version>` or `sp1up --version <version>`. A pinned installer fetches release assets from `github.com/<owner>/<repo>/releases/download/...`, which the proxy serves.
  - `api.github.com`, release-note pages, and the pages of repositories not attached to the session are refused (403). `raw.githubusercontent.com` and `git clone` work. `add_repo` cannot open third-party repositories; use it only for git clones. Versions are read from the installed tools, never from release notes.
  - When an installer insists on the API, `scripts/bootstrap.sh` downloads the pinned asset by its direct URL and checks its sha256. This is the documented install path, not a workaround.
- **Secrets.** Keys and tokens are never committed and never printed. Every key is testnet-only, except the prover-network credential, which may hold mainnet funds: the main prover networks bill on mainnet chains (M1.16 and M1.17 record which chain, token and minimum deposit). That credential lives in its own account, funded up to a spend cap the user sets.

  | Secret | Store | Used by | Set in round (§13) | First item |
  |---|---|---|---|---|
  | `CLOUDFLARE_API_TOKEN` (Cloudflare Pages Edit on the account, DNS Edit on the `jiro-ikusu.win` zone), `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions repository secrets | `pages.yml` | A1 | M2.2 |
  | `DEPLOYER_KEY` | Cloud-environment variable | `scripts/contracts/deploy.mjs` in the container | F2 | M4.14 |
  | `TESTER_KEY` | Cloud-environment variable; also an Actions secret for `season-ops.yml` | e2e on Sepolia, bot runs | F2, G2 | M4.14, M5.5 |
  | Prover-network credential (name set by the framework) | Cloud-environment variable; also an Actions secret if a workflow proves | `prove`, `season.mjs settle` | B3 or F0; G2 for the Actions secret | M4.8, M4.10 |

  - Cloud-environment variables reach only sessions started after they are set, and the environment's setup script cannot read them. An item that needs one continues in a fresh session.
  - `stylus-gas.yml` and `e2e.yml` use nitro-devnode's public prefunded development key, which is not a secret.
- **Fail loud.** If a "done when" line cannot be verified, the PR says so and leaves it unticked.

### 1.4 How acceptance is checked

- **The PR body** follows the template from M0.1: the item id, the item's "Needs user" text, and the "done when" checklist. Each ticked line carries its evidence: the command and the tail of its output, or a CI run link.
- **CI must be green.**
- **Gates are shown to fail.** Where an item says to show a gate failing, the agent pushes a scratch commit that breaks the gate, links the failing run, and reverts the commit before review. A gate that is a local script may show its failing output in the PR instead, but each new CI gate fails once in CI.
- **(user) lines** cover hardware checks, gating play tests and repository answers. Hardware and play steps run on the PR's own build: the UF2 artifact of the PR's CI run, and the PR's preview URL (M2.2 gives every PR one). M3.7 is a follow-up item of this kind: a hardware run of code that has already merged.
- **Impression plays** (M2.2, M2.10) are not done-when lines and don't gate the merge. Their feedback becomes a follow-up item if it calls for a change.
- **Milestone-closing PRs** (M0.7, M1.13, M2.10, M3.7, M4.14, M5.6) update the README status line and the status line of this file.

### 1.5 How the user reviews

- **Read the PR body top first:** what the item needs from you, then the decisions it makes and its README diff.
- **Your steps.** A PR marked ready may still have (user) lines open. Answer in a comment, or upload files to its branch; merge once the agent has ticked the line.
- **Stacked PRs** are merged bottom-up, with merge commits as the repository does today, not squash merges, so stacked branches retarget cleanly.
- **Decision items.** Merging is the approval. To change a decision, leave a review comment; the agent edits the PR before merge.
- **Owner rounds** (§13) list the decisions, tests and settings in dependency order, and mark the ones on the critical path. Routine review and merge of agent-only items is not listed there.
- **Review load.** Most items are S or M. The docs-only freeze PRs (M0.5-M0.7) deserve the most careful reading: everything later is built on them.

## 2. Execution environment and what needs the user

The agent works in an ephemeral cloud container. These facts were checked on 2026-10-27; M0.2 and M0.4 re-check them and record the results in `docs/TOOLING.md`.

| Area | State | Consequence for the plan |
|---|---|---|
| Rust | 1.97.0 stable via rustup. Targets `thumbv6m-none-eabi`, `wasm32-unknown-unknown`, `riscv32im-unknown-none-elf` install fine. The system `llvm-nm` is LLVM 18. | M0.2 installs ethblockdigger's 1.98.0 pin and rustup's `llvm-tools`, which matches rustc's LLVM |
| Other runtimes | Node 22, npm 10, Python 3.13, CMake 3.28, jq; apt is reachable | npm-hosted tools (solc, binaryen, rp2040js, Playwright, wrangler) are preferred; system packages come from apt (`libudev-dev` for elf2uf2-rs) |
| Compute | 4 CPUs, 15 GB RAM, no swap, about 30 GB free disk, no GPU | zk proving runs on CPU only. The onchain-verifiable wrapping step of SP1 and RISC Zero runs in Docker by default and may need more RAM than this (M1.16, M1.17, M4.8 measure). |
| Docker | CLI present, no daemon running; untested whether `dockerd` can be started | nitro-devnode runs on GitHub Actions runners (M4.2, M4.16); a local daemon is the secondary route |
| Not installed | Foundry (`forge`, `cast`), solc, `arm-none-eabi-gcc`, wasm-pack, `libudev-dev` | M0.2 probes them. The Rust firmware shell avoids `arm-none-eabi-gcc` and the wasm build avoids wasm-pack. |
| GitHub downloads | `api.github.com`, release-note pages, and the pages of repositories not attached to the session return 403. Release assets under `github.com/<owner>/<repo>/releases/download/` are served (206 for the Foundry tarball and for SP1's `cargo_prove`), and so is `raw.githubusercontent.com`. | Pinned installers and direct asset URLs (§1.3). M0.2 records, per tool, which URLs it fetches and whether they are API or asset URLs. |
| GitHub repository | `detychey` is an organization, and all its repositories are private, `jiro-ikusu` and `ethblockdigger` included. On GitHub Free, an organization gets 2,000 Actions minutes a month for private repositories, shared by all of them, and each job is billed rounded up to the minute; ethblockdigger's referee job took about 4 minutes. Private-repository runners have 2 vCPUs and about 7 GB RAM; public-repository runners have 4 vCPUs and 16 GB. | The private CI profile (§1.3, M0.4) and a minutes budget. Round A1 asks for an Actions spending limit, a paid plan, or a public repository (§15, question 18). On the free plan, branch protection and GitHub Pages are unavailable for private repositories. |
| GitHub tools | MCP tools: open PRs, add labels, trigger and read workflows (`actions_run_trigger`, `actions_list`, `get_job_logs`), subscribe to PR activity (`subscribe_pr_activity`) | Whether artifacts can be fetched into the container is untested; M0.4 checks. Until then, results travel through log markers (§1.3). The user's replies wake a subscribed session (§1.2). |
| Sessions | Ephemeral | A tiered bootstrap and a hook (M0.2), draft-PR claims (§1.2). Everything worth keeping is committed. |
| Hardware | The Raspberry Pi Pico and the Waveshare Pico-LCD-1.3 are with the user | Emulator parity in CI (M3.3). The user flashes PR artifacts and plays on PR previews. |

Only the user can:

- approve decisions, by merging;
- answer the repository questions: license, visibility, Actions plan or spending limit, preview privacy;
- change repository settings: enable Actions, set required checks where the plan allows;
- set Actions secrets and cloud-environment variables;
- satisfy (user) lines: flash and play on the hardware, play-test in the browser, and paste the results;
- create and fund testnet keys, and fund their own browser wallet;
- open a prover-network account and approve its spend cap, if one is needed;
- approve the scheduled season operations;
- recruit testers.

§13 groups these into owner rounds.

## 3. Repository layout and toolchain

### 3.1 Layout

```text
core/                jiro-core: no_std, no alloc. Rules, codec, seeds, state hash, Recorder
shell/               jiro-shell: no_std, not consensus. USB link codec and dirty-cell diff,
                     shared by the firmware and the web app; never hashed
tools/               jiro-tools: native CLI (vectors, replay, level, playtest, calibrate,
                     difffuzz, pack)
tools/xcheck/        Node + ethers: worked examples and keccak/deadline fixtures
web/                 Vite + TypeScript app. web/wasm is jiro-wasm (cdylib)
firmware/            own Cargo workspace: drivers (host-testable), app (jiro-firmware),
                     emu/ (rp2040js runner, transcripts/)
referee/stylus/      jiro-referee-stylus
referee/zk/          guest and host of the chosen zkVM, own workspace
contracts/           Solidity sources, tests, abi/ (generated)
levels/              src/*.txt sources, NN-name.bin, targets.json, README.md (generated)
vectors/             format/, game/, levels/, derivations.json, pack.bin, COVERAGE.md, README.md
seasons/             calibration-1.json (M2.9), testnet-0.json (M4.14), testnet-1.json (M5.5)
scripts/             bootstrap, CI checks, float-probe/ (own workspace),
                     contracts/ (Node package: deploy, preflight, e2e, localnet, stylus-gas,
                     activation, season operations; nitro/ holds the vendored dev-node script)
docs/                TOOLING, VERIFICATION, ECONOMY, LINK, DEPLOYMENT, SEASON_RUNBOOK,
                     TESTNET, TESTNET-1-REPORT
reports/             playtest, calibration, bot and device reports
deployments/         one record per network, with a list of contract generations
.github/workflows/   ci, nightly, pages, stylus-gas, zk-prove, e2e, season-ops
```

`tools/` and `shell/` are not in README §3's table yet; M0.4 adds them (P3).

**Cargo workspaces.**

- The root workspace holds `core`, `shell`, `tools`, `web/wasm` and `referee/stylus`.
- `firmware/`, `referee/zk/` and `scripts/float-probe/` are separate workspaces, because they have their own targets, profiles or toolchains. So is the zk guest, if the framework builds it on its own.
- Cargo ignores the root profiles inside a separate workspace, so each workspace root repeats the profiles of §3.3. `scripts/check-profiles.sh` (M0.4) enforces this.

### 3.2 Pins

| Tool | Pin | Set in |
|---|---|---|
| Rust | 1.98.0, as ethblockdigger's [`referee/rust-toolchain.toml`](https://github.com/detychey/ethblockdigger/blob/main/referee/rust-toolchain.toml); otherwise the newest version that installs (P1) | `rust-toolchain.toml`, CI |
| Rust targets | `thumbv6m-none-eabi`, `wasm32-unknown-unknown`, `riscv32im-unknown-none-elf`, and `riscv64imac-unknown-none-elf` as a 64-bit width check | `rust-toolchain.toml` |
| Rust components | clippy, rustfmt, llvm-tools | `rust-toolchain.toml` |
| Core MSRV | `rust-version` = the oldest rustc among the zkVM toolchains recorded by M0.2 (`rustc +succinct --version`, `rustc +risc0 --version`), if older than the pin | `core/Cargo.toml` (M1.1), targets job |
| tiny-keccak | 2, `keccak` feature; the core's only direct dependency | `core/Cargo.toml` |
| stylus-sdk | 0.10.8, as ethblockdigger | `referee/stylus/Cargo.toml` |
| cargo-stylus | 0.10.10, as ethblockdigger's preflight | `scripts/bootstrap.sh`, workflows |
| wasm-opt | npm `binaryen@120.0.0` | `referee/build-wasm.sh` |
| Node, npm | 22, 10 | CI, `web/`, `tools/xcheck/`, `scripts/contracts/`, `firmware/emu/` |
| ethers | 6, exact version in each lockfile | `tools/xcheck/`, `web/`, `scripts/contracts/` |
| solc | 0.8.28 with ethblockdigger's `evmVersion` (shanghai) | `contracts/` |
| OpenZeppelin | 5, exact version | `contracts/` |
| Contract toolchain | Foundry at an exact version, or ethblockdigger's harness, chosen by the M0.2 probe (P2) | `contracts/`, `scripts/bootstrap.sh` |
| Foundry in workflows | `foundry-rs/foundry-toolchain` at an exact version, whatever P2 decides, because nitro-devnode's script calls `cast` | `stylus-gas.yml`, `e2e.yml` |
| embassy-rp, embassy-executor, embassy-time, embassy-usb | exact versions | `firmware/Cargo.lock` |
| elf2uf2-rs, rp2040js, Playwright, wrangler | versions recorded by M0.2 | `scripts/bootstrap.sh`, lockfiles |
| RP2040 bootrom image for rp2040js | a `raw.githubusercontent.com` URL at a fixed commit, or a shallow clone at a tag, and its sha256 (M3.3) | `firmware/emu/` |
| nitro-devnode | `run-dev-node.sh` vendored from OffchainLabs/nitro-devnode at a fixed commit sha, and `NITRO_NODE_VERSION` set explicitly (M4.2) | `scripts/contracts/nitro/`, `stylus-gas.yml`, `e2e.yml` |
| GitHub Actions | each third-party action at an exact version | workflows |
| zkVM toolchain | version recorded by M1.12 | `referee/zk/`, `scripts/bootstrap.sh` (`zk` tier) |

### 3.3 Cargo profiles and core lints

```toml
[profile.dev]
overflow-checks = true
[profile.test]
overflow-checks = true
[profile.bench]
overflow-checks = true
[profile.release]
overflow-checks = true
lto = true
codegen-units = 1
panic = "abort"
strip = true
[profile.stylus]
inherits = "release"
opt-level = "z"
```

- README §3 requires `overflow-checks = true` in every build profile, so that all builds behave the same. Every workspace root of §3.1 carries these lines.
- `release` keeps opt-level 3 for native tools, bots and `--release` test suites, so time gates measure fast code. `referee/build-wasm.sh` builds with `--profile stylus`, the size settings of ethblockdigger's [`referee/Cargo.toml`](https://github.com/detychey/ethblockdigger/blob/main/referee/Cargo.toml). The firmware may define its own size profile the same way.

`jiro-core` and `jiro-shell` start with:

```rust
#![no_std]
#![forbid(unsafe_code)]
#![cfg_attr(not(test), deny(clippy::float_arithmetic, clippy::unwrap_used,
    clippy::expect_used, clippy::panic, clippy::arithmetic_side_effects,
    clippy::indexing_slicing))]
```

- Grid access goes through a bounded cell-index type and `get`, so stepping code cannot index out of bounds: y × 60 + x from two `u8` coordinates can reach 15,555.
- With `forbid(unsafe_code)` the core cannot own a mutable static. Its large buffers (grid, capture stack, journal) are fixed-size fields of the structs that use them (`Game`, `Recorder`), or are passed in as `&mut`. The targets (`jiro-wasm`, the firmware) place those structs in their own statics, with whatever minimal `unsafe` or cell type their platform needs.
- `jiro-wasm` is `no_std` only on wasm32: `#![cfg_attr(target_arch = "wasm32", no_std)]` with `#[cfg(target_arch = "wasm32")] #[panic_handler]`. Host builds of the workspace (clippy, build, test) then use std.

### 3.4 CI jobs

The workflow rules of §1.3 apply to every row. In the private profile, `ci.yml` groups its rows into the four jobs named in the last column; each row becomes a step group of that job, behind the same path filter. "Job" in the items below means the row.

| Job | Workflow and trigger | Added by | Checks | Private profile |
|---|---|---|---|---|
| rust | `ci.yml` | M0.4 | `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --locked` (debug) | rust |
| rust-release | `ci.yml` | M0.4 | `cargo test --workspace --release --locked`. Heavy tests carry `#[cfg_attr(debug_assertions, ignore)]`, so only this job runs them. | rust |
| targets | `ci.yml` | M0.4; MSRV build from M1.1 | `jiro-core` release builds for the four targets; an MSRV build | rust |
| determinism | `ci.yml` | M0.4 | No float tokens in source. No soft-float references in the project-crate members of the float probe, on two targets. No `usize` in state, hashing or codec signatures. `overflow-checks = true` in every profile of every workspace root. CI toolchain equal to `rust-toolchain.toml`. Every rule unit of README §4 tagged (`check-rule-tags.sh`, M0.5). | rust |
| vectors-drift | `ci.yml` | M1.2, M1.4; version gate from M1.9 | Regenerate `vectors/`, then `scripts/check-drift.sh vectors/`; `scripts/check-rules-version.sh` | rust |
| wasm-parity | `ci.yml` | M1.11 | Every vector through `jiro-wasm` under Node; wasm size and sha256 | rust |
| zk-exec | `ci.yml` (job-level path filter); full set in `nightly.yml` | M1.12 | Executor outcomes and trace digests equal native on a vector subset; a dev-mode round trip | rust |
| difffuzz | `ci.yml` (fixed seed); `nightly.yml` (rotating seed) | M1.13 | Native, wasm and the zk executor agree on random cases | rust |
| stylus | `ci.yml` | M4.1 | Generate the 200 fixed difffuzz cases, then TestVM replay of the vectors and the cases; size gate; sha256 | rust |
| web | `ci.yml` | M2.1 | `npm ci`, typecheck, lint, vitest, build | web |
| levels-drift | `ci.yml` | M2.4 | Rebuild `levels/` and `levels/README.md`, then `scripts/check-drift.sh levels/` | rust |
| contracts | `ci.yml` | M4.3 | Contract tests; regenerate `contracts/abi/`, then `scripts/check-drift.sh contracts/abi/` | contracts |
| firmware | `ci.yml` (job-level path filter) | M3.1; UF2s from M3.3 and M3.4 | Firmware build; `bringup.uf2`, `vectors.uf2` and `jiro-firmware.uf2` artifacts; static memory gate | firmware |
| firmware-emu | `ci.yml` (PR subset); `nightly.yml` (full set and packed difffuzz cases) | M3.3 | The vectors firmware in rp2040js; regenerated transcripts checked for drift | firmware |
| nightly | `nightly.yml`: `pull_request` at reduced counts, `schedule` at full counts | M1.10; extended by M1.12, M1.13, M2.9, M3.3 | Long property runs, 100,000 random journals, the minion coverage long run, difffuzz, the zk-exec full set, `calibrate --check`, the firmware-emu full set | heavy |
| pages | `pages.yml`: `pull_request` and pushes to `main` | M2.2 | Build, Playwright smoke test, Cloudflare Pages deploy: one preview per PR, production on `main` | own workflow |
| stylus-gas | `stylus-gas.yml`: `pull_request` on `core/`, `referee/`, `vectors/`, its script and itself | M4.2; gate set from M4.9; `cargo stylus verify` dispatch from M4.14 | The deployed wasm on nitro-devnode: outcomes equal native on the vectors and the 200 fixed cases, gas per vector | heavy |
| zk-prove | `zk-prove.yml`: `pull_request` on itself and the host's prove module; `workflow_dispatch` | M4.8 | A real proof, the wrapping step, timings, the proof fixture | heavy |
| e2e | `e2e.yml`: `pull_request` on `contracts/`, `scripts/contracts/`, `referee/` and itself | M4.16 | Contract end-to-end run on nitro-devnode with the real referee | heavy |
| season-ops | `season-ops.yml`: daily `schedule`, `workflow_dispatch`, `pull_request` on itself | M5.5 | Season status and solvency, bot runs, close, zk settlement | own workflow |

## 4. Milestone overview

Each milestone's README §9 "done when" closes when these items merge:

| Milestone | README §9 done when | Closed by |
|---|---|---|
| M0 Rules freeze | No open decision blocks M1 | M0.2 (D1), M0.5, M0.6, M0.7 |
| M1 Core | Tests pass; vectors committed; zkVM chosen; cycle counts recorded | M1.9, M1.10, M1.12, M1.13 |
| M2 Browser | All 16 levels playable; bot clear rates on target | M2.9, M2.10 |
| M3 Pico | Device state-hash traces match the native build | M3.3 (emulator), M3.7 (hardware) |
| M4 Referee and contracts | A run settled end to end on testnet. A level verifies within 1M gas on Stylus, or the zk fallback's costs are measured. | M4.14, with the gas gate below measured in M4.9 |
| M5 dApp and season 1 | A full season closes and pays out on testnet | M5.6 |

**The M4 gas gate**, defined once here:

- **Gate set:** for each of the 16 levels, `vectors/levels/NN-worst.json` (the longest bot journal) and `vectors/levels/NN-synthetic.json` (a synthetic worst case on that level), both produced by M2.9.
- **Metric:** `eth_estimateGas` of one `verify` call on nitro-devnode, the metric of ethblockdigger's B2 measurements.
- **Gate:** the maximum over the gate set is at most 1,000,000.
- Other vectors, `worst-case` and the full journal included, are reported but do not gate. Numbers measured before M2.9 (M4.2) are provisional.

## 5. M0 Rules freeze

| ID | Title | Depends on | Size | Needs user |
|---|---|---|---|---|
| M0.1 | Agent workspace files and license | none | S | Answer the repository questions; confirm the Cometh rules |
| M0.2 | Environment probe, toolchain pins, tiered bootstrap; confirm D1 | M0.1 | M | Review the hook and bootstrap; pick the fallback if the blinky fails |
| M0.3 | Import the ethskills `ship` guide and topic skills | M0.1 | S | Read the imported text; approve dropping `feedback` |
| M0.4 | Cargo workspace, CI gates, README §3 layout | M0.2, M0.5 | M | Required checks, if the plan allows |
| M0.5 | Rules freeze A: rule decisions, pinned details, rule tags | M0.1 | M | Approve the pinned details and the crate and contract names |
| M0.6 | Rules freeze B: byte formats, procedures, worked examples | M0.5 | M | Approve the formats |
| M0.7 | Rules freeze C: run, settlement and season; close D10 | M0.2, M0.6 | M | Choose settlement, publication and the draw check; approve the D10 qualification |

#### M0.1 Agent workspace files and license

- **Goal:** every agent session loads the same project rules, the reference in `GUIDELINES.md` to `.claude/AGENTS_COMETH.md` resolves, and the repository has a license.
- **Deliverables:**
  - `CLAUDE.md`. It imports `@.claude/AGENTS_COMETH.md` and `@GUIDELINES.md`, and states:
    - `README.md` is the normative specification, and `IMPLEMENTATION_PLAN.md` is the work breakdown. Follow its §1 to pick up, claim and finish items.
    - Use the committed ethskills copies under `.claude/skills/`. Never fetch from or send anything to ethskills.com, including the `feedback` skill's POST and the "send a note via feedback" lines of other ethskills, unless the user asks for it in the current session.
    - Milestone-closing PRs update the README status line and the plan's status line.
    - The sync table below, modeled on the file list of ethblockdigger's [`CLAUDE.md`](https://github.com/detychey/ethblockdigger/blob/main/CLAUDE.md) `balancing.md` rule.

      **Behavior change** means a change that alters the outcome, error code or trace of a committed vector, or that implements an edit to README §4-§6 rule text made after that rule was first implemented. Implementing a frozen rule for the first time is not a behavior change: `RULES_VERSION` stays, and vectors are added, not modified. M1.9's version gate checks this.

      | A change to | Also, in the same PR |
      |---|---|
      | `core/src/**` that changes behavior | Bump `RULES_VERSION`. Update README §4-§6. Regenerate `vectors/` and explain the moved outcomes. Once M2.6 has merged, rerun the playtest and regenerate its report. Once M2.9 has merged, rerun `calibrate --check`: regenerate the calibration file in place until a season that references it has opened, and write a new calibration file for a new season after that. |
      | a byte format | Bump the format's version; regenerate `vectors/format/` |
      | `core/src/consts.rs` | README §2, §4 and §5 |
      | `levels/src/**` | Rebuild `levels/*.bin` and `levels/README.md`. Once M2.6 has merged, the playtest report. Once M2.9 has merged, the calibration rule above. |
      | `seasons/*.json` | README §8.4 and `docs/ECONOMY.md` |
      | `contracts/src/**` | Regenerate `contracts/abi/` (from M4.3); the threat table of `docs/ECONOMY.md`, if a mitigation moved |
      | `vectors/**` | Regenerate `vectors/pack.bin` and `firmware/emu/transcripts/` (from M3.3) |

      Owners of numbers: README §4 and §5 own the rule numbers and defaults; `levels/README.md`, generated from `levels/src/`, owns the per-level knobs; `seasons/*.json` own the season parameters; `docs/ECONOMY.md` derives from them and owns none.
  - `.claude/AGENTS_COMETH.md`, copied byte for byte from ethblockdigger's [`AGENTS_COMETH.md`](https://github.com/detychey/ethblockdigger/blob/main/.claude/AGENTS_COMETH.md).
  - `.claude/skills/ethskills/SKILL.md`, copied byte for byte from ethblockdigger's [`.claude/skills/ship/SKILL.md`](https://github.com/detychey/ethblockdigger/blob/main/.claude/skills/ship/SKILL.md). That file is the ethskills root index (`name: ethskills`), not the `ship` guide, so it gets the directory of its declared name. M0.3 imports the real guide.
  - `LICENSE`, per the owner's answer in this PR (§15, question 16).
  - `.gitignore`: `target/`, `node_modules/`, `dist/`.
  - `.github/pull_request_template.md`:
    - the item id, what the item needs from the user, and the done-when checklist with evidence, (user) lines marked;
    - a determinism checklist: Rules touched? `RULES_VERSION` or format version bumped (yes; no, with the reason; or "N/A, first implementation")? README §4-§6 updated? `vectors/` regenerated? `levels/README.md` regenerated? Calibration rerun?
  - The README "Repository files" list, updated with `CLAUDE.md`, `LICENSE` and `.claude/AGENTS_COMETH.md`.
  - The PR body asks the repository questions of §15 (16, 18, 19). M0.1 records the license; M0.2 records the rest.
- **Done when:**
  - both copies are byte-identical to ethblockdigger's;
  - `CLAUDE.md` contains the two imports, the rules, the behavior-change definition and the sync table;
  - (user) the owner has named the license in a PR comment;
  - `LICENSE` matches that answer.
- **Verify with:**
  - `cmp .claude/AGENTS_COMETH.md ../ethblockdigger/.claude/AGENTS_COMETH.md`
  - `cmp .claude/skills/ethskills/SKILL.md ../ethblockdigger/.claude/skills/ship/SKILL.md`
  - `grep -c '^@' CLAUDE.md` prints 2; `grep -c 'send anything to ethskills.com' CLAUDE.md` prints 1.
  - `test -f LICENSE && test -f .github/pull_request_template.md && test -f IMPLEMENTATION_PLAN.md`
- **Skills:** none. **README:** §12, Repository files. **Needs user:** confirm that Cometh's code philosophy applies (merge = yes); name the license; answer the visibility, Actions-plan and preview questions (round A1).

#### M0.2 Environment probe, toolchain pins, tiered bootstrap; confirm D1

- **Goal:** know what the container can install and run before any item depends on it, commit the results, make every session start ready, and confirm D1 with build evidence.
- **Probes.** Each one becomes a row of `docs/TOOLING.md`: tool, exact version, install command, the URLs it fetches (API or release asset), PASS or FAIL, error text, fallback, affected items. A tool is marked FAIL only after both the pinned-version installer and the direct asset URL were tried.
  - rustup:
    - Rust 1.98.0;
    - the four targets of §3.2. `riscv64imac-unknown-none-elf` is the 64-bit width check, because `riscv64im-unknown-none-elf` is tier 3 and builds only with build-std;
    - the components clippy, rustfmt and llvm-tools.
  - `cargo install --locked`: cargo-stylus 0.10.10, and elf2uf2-rs after `apt-get install -y libudev-dev pkg-config`, or a dependency-free UF2 converter. The choice is recorded.
  - npm:
    - `binaryen@120.0.0`;
    - `solc@0.8.28`;
    - rp2040js;
    - `@playwright/test` and its chromium download.
  - Foundry: `foundryup --install <version>`, then `forge --version`, `cast --version` and `anvil --version`.
  - Docker: start `dockerd`, then `docker run hello-world`. If Docker Hub refuses anonymous pulls, try a registry mirror and record which one.
  - zkVM toolchains, SP1 and RISC Zero: the pinned installer, then only the framework's Rust toolchain at a pinned version (`cargo prove install-toolchain`, `rzup install rust <version>`, or their direct asset URLs). Record `rustc +succinct --version` and `rustc +risc0 --version`. Release-note pages are refused, so these commands are the only source of the versions. The full install is the job of M1.16 and M1.17, which confirm the values.
  - slither via pip, for M4.12.
  - A throwaway embassy-rp blinky, built for `thumbv6m-none-eabi` and not committed. It is the D1 evidence that a Rust shell needs no `arm-none-eabi-gcc`.
  - The repository answers from M0.1's review: visibility, Actions plan, spending limit, minutes quota. They select the CI profile (§1.3).
- **Deliverables:**
  - `docs/TOOLING.md`, which also records P1 (Rust pin), P2 (contract toolchain) and P14 (visibility, Actions budget, CI profile);
  - `rust-toolchain.toml`: channel, targets, components;
  - `scripts/bootstrap.sh <tier>`, idempotent, with the tiers `core` (default), `web`, `contracts` and `firmware`; M1.12 adds `zk`. Each tier installs the PASS tools it needs, through pinned versions and sha256-checked direct downloads, and prints `nothing to install` when it is already complete.
  - `.claude/settings.json`: only a SessionStart hook that runs `scripts/bootstrap.sh core` in cloud sessions (see the `session-start-hook` skill), with no permission changes. The hook applies to sessions started after this PR merges.
  - README edits: a link from the §13 D1 row to the blinky's `TOOLING.md` row;
  - if P2 is the harness: this plan's M4 test file names and verify commands, rewritten for it (for example `contracts/test/season.test.ts` and `npx vitest run contracts/test/season.test.ts`);
  - only if the blinky fails: the fallback the owner then picks (rp2040-hal, or C++ on the Pico SDK), written into README §3, the §13 D1 row and the `rp2040-firmware` skill, with this plan's §3.2 firmware pins and M3.1-M3.5 rewritten for it. For C++: a `jiro-core` C-ABI staticlib for `thumbv6m-none-eabi` with a generated header, a CMake build, and `arm-none-eabi-gcc` in the `firmware` tier, all recorded in `TOOLING.md`.
- **Done when:**
  - every probe has a `TOOLING.md` row, and every FAIL row names a fallback;
  - `bootstrap.sh core` exits 0 twice in a row, and the second run prints `nothing to install`;
  - every other tier exits 0;
  - `rustc --version` inside the repository prints the pin;
  - the zkVM toolchains' rustc versions are recorded;
  - the D1 row links the blinky's `TOOLING.md` row. If the blinky fails, the PR reports the error, and the owner chooses between `rp2040-hal` and C++ on the Pico SDK.
  - P1, P2 and P14 are recorded, with the CI profile;
  - no product code is committed.
- **Verify with:**
  - `bash scripts/bootstrap.sh core && bash scripts/bootstrap.sh core | tail -1 | grep -qx 'nothing to install'`
  - `for t in web contracts firmware; do bash scripts/bootstrap.sh "$t" || exit 1; done`
  - `rustc --version` and `rustup target list --installed`
  - `cargo stylus --version`; `forge --version` (recorded either way)
  - `grep -E '^\| D1 \|' README.md | grep -c 'docs/TOOLING.md'` prints 1.
- **Skills:** `rp2040-firmware`, `session-start-hook`. **README:** §3, §7.3, §13 D1. **Needs user:** review `.claude/settings.json` and `scripts/bootstrap.sh`, which run in every later session; if the blinky failed, choose rp2040-hal or C++ on the Pico SDK (round A2).

#### M0.3 Import the ethskills `ship` guide and topic skills

- **Goal:** the `ship` guide and 19 of the 20 topic skills listed in [`skills-import.md`](skills-import.md) become reviewed, pinned agent instructions. `feedback` is not imported.
- **Deliverables:**
  - `.claude/skills/ship/SKILL.md`, verbatim from https://ethskills.com/ship/SKILL.md;
  - `.claude/skills/<name>/SKILL.md`, verbatim, for:
    - why, protocol, gas, wallets, l2s;
    - standards, tools, building-blocks, orchestration, addresses;
    - concepts, security, audit, noir, testing;
    - indexing, frontend-ux, frontend-playbook, qa.
  - `scripts/ethskills.sha256`;
  - `skills-import.md`, with fetch-date and sha256 columns, the `ship` row, a note that the index lives at `.claude/skills/ethskills/`, a note that `why` declares `name: why-ethereum`, and `feedback` marked "not imported" with the reason;
  - the ethskills paragraph of README §12, matching that layout.

  **Why `feedback` is dropped.** As fetched on 2026-10-27, it has no `name` field (it uses `title: Feedback`), and it asks the agent to POST project notes to `https://ethskills.com/api/feedback`, which the `CLAUDE.md` rule forbids. The agent confirms both on fetch; if the file has changed, the PR says so and asks the user.

  The agent reads every file fully before committing it. The PR body lists each statement that conflicts with the README or with `CLAUDE.md`, or states that there are none. Known examples:
  - `ship` defaults to Ethereum mainnet, against D12;
  - the `ethskills` index tells the agent to fetch skills by URL;
  - `ship` and `addresses` end with "send a one-line note via feedback".

  The README and `CLAUDE.md` stay authoritative (README §12).
- **Done when:**
  - there are 26 `SKILL.md` files: 5 project skills, the `ethskills` index, `ship` and 19 topic skills;
  - each starts with front matter that has `name` and `description`;
  - the checksums verify;
  - the conflicts are listed;
  - `skills-import.md` marks `feedback` as not imported, with the reason.
- **Verify with:**
  - `ls .claude/skills/*/SKILL.md | wc -l` prints 26.
  - `for f in .claude/skills/*/SKILL.md; do head -1 "$f" | grep -qx -- '---' && grep -q '^name: ' "$f" && grep -q '^description: ' "$f" || echo "$f"; done` prints nothing.
  - `sha256sum -c scripts/ethskills.sha256`
  - `grep -c '^name: why-ethereum' .claude/skills/why/SKILL.md` prints 1; `test ! -e .claude/skills/feedback`
- **Skills:** `ethskills`. **README:** §12. **Needs user:** read the imported text before merging, since it will steer future sessions, and approve dropping `feedback` from the list (round A5).

#### M0.4 Cargo workspace, CI gates and README §3 layout

- **Goal:** every later PR passes the same determinism gates from its first commit.
- **Deliverables:**
  - The root workspace:
    - `Cargo.toml` and `Cargo.lock`;
    - the profiles of §3.3;
    - members `core`, `shell` and `tools`, named per D13 (M0.5). `firmware`, `referee/zk` and `scripts/float-probe` are excluded.
  - Skeleton crates, all empty: `core/` (`jiro-core`) and `shell/` (`jiro-shell`) as libraries with the lints of §3.3, `tools/` (`jiro-tools`) as a binary.
  - `scripts/float-probe/`: its own workspace with the §3.3 profiles plus `lto = false` in its release profile. It is a `no_std` staticlib with a panic handler, whose exported functions call `jiro-core`'s public API. M1.8 makes it call `replay`.
  - `scripts/check-no-float.sh`. It fails on:
    - `f32` or `f64` tokens in `core/src` and `shell/src`;
    - soft-float references in the float probe built for `thumbv6m-none-eabi` and `riscv32im-unknown-none-elf`. The script runs rustup's llvm-nm (`$(rustc --print sysroot)/lib/rustlib/x86_64-unknown-linux-gnu/bin/llvm-nm -A`) on `libfloat_probe.a`, and keeps only the archive members of the probe's own dependency tree outside the sysroot. That list comes from `cargo tree -e normal --prefix none` on the probe, with `-` mapped to `_`; today it is `float_probe`, `jiro_core`, `tiny_keccak` and `crunchy`, and a new dependency is scanned automatically. It ignores `core-*`, `compiler_builtins-*` and the compiler-rt members (`<16 hex digits>-*.o`), which always carry soft-float references. It fails on any undefined soft-float symbol in the kept members: `__aeabi_f*`, `__aeabi_d*`, the `__aeabi_*2f`/`*2d` conversions, the `__*sf*`/`__*df*` family (`__addsf3`, `__muldf3`, `__floatsidf` and the rest), and the `fmax*`/`fmin*`/`fmod*` calls that `max`, `min` and `%` lower to.
    - `CHECK_TOKENS=0` disables the token check, to show the symbol check alone.

    With `lto = false`, each crate keeps its own archive member, and the script builds the probe with `-C link-dead-code`, so every non-generic function of `jiro-core` lands in the `jiro_core` member even if nothing calls it, and the symbol check catches dead float code too. A generic function is scanned once something instantiates it (M1.8's `replay`).
  - `scripts/check-no-usize.sh`: fails on a `usize` field in any struct or enum of `core/src`, and on `usize` in any function signature of the hash, journal, keccak, level and seed modules. Index arithmetic inside function bodies stays allowed.
  - `scripts/check-profiles.sh`: finds every Cargo workspace root with `cargo locate-project --workspace` run next to each `Cargo.toml`. It fails unless each root sets `overflow-checks = true` under dev, test, bench and release, and no profile sets it to false.
  - `scripts/check-drift.sh <paths>`: `git diff --exit-code` on the paths, then `test -z "$(git status --porcelain <paths>)"`, so untracked generated files fail too.
  - `.github/workflows/ci.yml`, following §1.3 in the profile that P14 selected: the rust, rust-release, targets and determinism rows of §3.4, as separate jobs (public) or as the merged `rust` job (private). The determinism checks include `scripts/check-rule-tags.sh` (M0.5). A step fails if the CI toolchain differs from `rust-toolchain.toml`, and another prints the runner's `nproc` and `free -g`. The determinism checks upload a tiny artifact, to test fetching artifacts into the container.
  - If the private profile is selected: the `ci:heavy` label, created when the agent first adds it to a PR. If the tools cannot create it, the PR asks the user to (round A3).
  - `docs/TOOLING.md` additions: runner size; the billed minutes of the first `ci.yml` runs, per job; the monthly budget (§1.3); whether `get_job_logs` and artifact downloads work from the container.
  - README §3 table: rows for `tools/` and `shell/` (P3).
- **Done when:**
  - CI is green;
  - the clean tree passes `check-no-float.sh` on both targets, with the kept members listed in the output (output in the PR);
  - a scratch commit adds an `#[inline(never)] pub fn` with an `f32` loop to `jiro-core`, called by nothing. Clippy and `check-no-float.sh` fail on it in CI (run link in the PR), and `CHECK_TOKENS=0 bash scripts/check-no-float.sh` fails on the symbol alone (output in the PR). The commit is then reverted.
  - a scratch profile without `overflow-checks` fails `check-profiles.sh` (output in the PR);
  - `jiro-core` builds for the four targets without `alloc`;
  - README §3 lists `tools/` and `shell/`;
  - the `TOOLING.md` additions are recorded.
- **Verify with:**
  - `cargo fmt --check && cargo clippy --workspace --all-targets --locked -- -D warnings && cargo test --workspace --locked`
  - `cargo test --workspace --release --locked`
  - `for t in thumbv6m-none-eabi wasm32-unknown-unknown riscv32im-unknown-none-elf riscv64imac-unknown-none-elf; do cargo build -p jiro-core --release --locked --target $t || exit 1; done`
  - `bash scripts/check-no-float.sh && bash scripts/check-no-usize.sh && bash scripts/check-profiles.sh && bash scripts/check-rule-tags.sh`
- **Skills:** `deterministic-core`. **README:** §3. **Needs user:** enable Actions if needed; if the plan allows it, make the `ci.yml` jobs required checks on `main` (round A3).

#### M0.5 Rules freeze A: rule decisions, pinned details, rule tags

- **Goal:** pin every §4 detail an implementer would otherwise have to guess for the rule decisions M1 needs, and give every rule a stable tag that tests can find.
- **Decisions.** The owner answered them on 2026-10-28, and README §13 records the answers. This item pins their details, and proposes what the answers left open:
  - D3: rail only.
  - D4: the own trail blocks; no fuse.
  - D5: 3 lives, 2,700 ticks and a 7,500 bp target, adjustable per level; running out of lives scores zero.
  - D6: one shield charge per level.
  - D8: Key0-3 = A, B, X, Y. Y and the joystick press are unused and not journaled. In the browser, the keys are configurable (M2.1).
  - D9: a square B × B boss body, B set per level, B = 2 to 8, default 5 (README §4.6).
  - D13: the name is Jiro-ikusu (owner). Proposed for approval here, names with no Taito titles in them:
    - crates `jiro-core`, `jiro-shell`, `jiro-tools`, `jiro-wasm`, `jiro-firmware`, `jiro-firmware-drivers`, `jiro-referee-stylus`;
    - contracts `IReferee`, `Referee`, `ZkReferee`, `Challenge`, `Season`.
  - D7 stays provisional until M1.7 measures it.
- **Tags.**
  - **Rule units.** In README §4.1-§4.10, every unit that states a rule gets a tag `[R4.<n>-<k>]`, for example `[R4.5-3]`. A unit is a bullet or sub-bullet, a numbered step, a table row other than a header row, a paragraph, or a fenced code block; a code block carries its tag in a comment line inside the block. So the rail definition of §4.2, the entity table of §4.3, tick steps 1-7 of §4.4, the boss pseudocode of §4.6, capture steps 1-3 of §4.8, the resolution steps of §4.9, and the rows of the §4.10 table and its ticks-used paragraph are all tagged.
  - **Exemptions.** A unit that only gives a rationale, history or an example (for example "Why this procedure" and its bullets, or the "Known gap" note of §4.7) ends with the marker `<!-- rationale -->`.
  - **Other tags.** Every pinned detail below gets `[PIN-nn]`. Every coverage bullet of the `parity-testing` skill gets `[COV-nn]`.
  - Each tag appears exactly once, where its rule is written; M1.9's coverage index finds them by regex.
  - **`scripts/check-rule-tags.sh`** prints every unit from README §4.1 to the end of §4 that carries neither a tag nor the marker: each non-blank line outside code blocks that is not a heading, a table header row or a separator row, and each code block without a tag. It also prints every repeated, malformed or misplaced tag, and fails loudly if it finds no §4.1. Empty output and exit 0 mean every rule is tagged. M0.4 runs it in CI.
- **Pinned details** (proposals). Each is written once, in the §4 subsection it belongs to:
  1. `[PIN-01]` Initial player state: cell (30, 59), lives from the level, 1 shield charge, invulnerability 0, previous direction none, not cutting, cut start (30, 59), `press_tick` 0.
  2. `[PIN-02]` Invulnerability: a life lost at tick h protects ticks h+1 to h+30 inclusive; a hit absorbed by invulnerability or by the shield starts nothing. Starting a cut ends it at step 3 of that tick, before that tick's collisions.
  3. `[PIN-03]` `press_tick` is 0 when an event at tick 0 holds B.
  4. `[PIN-04]` Fast cut: if sub-step 1 is blocked by the own trail, hits the boss's body, or closes the cut, there is no sub-step 2.
  5. `[PIN-05]` A blocked move keeps the resolved direction.
  6. `[PIN-06]` Minion orientation: for a tested heading h, "ahead" is the 4-neighbor in direction h, and "on its right" is the 4-neighbor a quarter turn clockwise from h (E for N, S for E, W for S, N for W).
  7. `[PIN-07]` X held at tick 0: the level is committed with claim 0, and ticks used is 1.
  8. `[PIN-08]` Ticks used is t + 1 when the level ends during tick t, whatever the step.
  9. `[PIN-09]` A clear at step 3 ends the level before that tick's hits are resolved.
  10. `[PIN-10]` The level is cleared when `claim_bp` ≥ the target.
  11. `[PIN-11]` A minion that respawns at step 5 onto the player's cell hits the player (the share rule of PIN-15).
  12. `[PIN-12]` v1 decoders reject mode 2 until Superchallenge returns.
  13. `[PIN-13]` `RULES_VERSION` = 1 (§6.3). It is bumped on every behavior change: a change that alters the outcome, error code or trace of a committed vector, or that implements an edit to §4-§6 rule text made after the rule was first implemented. Implementing a frozen rule for the first time is not a behavior change.
  14. `[PIN-14]` The D7 coverage property, written only in §4.7; the `parity-testing` skill links to it.
      - Let C be the 4-connected component of rail cells that contains the minion's cell. Its target cells are all the cells of C, the border corners and other cells that touch open field only diagonally included.
      - After its spawn and after each capture, while the rail stays unchanged, a minion is **trapped** if its (cell, heading) state repeats before it has visited every cell of C.
      - There are at most 4 × |C| states, so this is the same as coverage being incomplete after 4 × |C| moves.
  15. `[PIN-15]` The minion hit predicate (§4.9).
      - Let P0 be the player's cell at the start of step 3, and P1 … Pn the cells it actually entered at step 3, with n = 0, 1 or 2.
      - For each minion present after step 5, let a be its cell at the start of step 5 and b its cell at the end of step 5. a = b if it did not move; a = b = its respawn cell if it respawned this tick. A destroyed minion has no cell and cannot hit.
      - The minion hits the player if any of these holds:
        - **share:** b = Pn;
        - **swap:** a = Pk and b = Pk−1, for some k in 1 … n;
        - **pass:** b = Pk for some k in 1 … n − 1, the intermediate fast-cut cell.
      - When n ≥ 1, a minion that moves into P0 from any cell other than P1 does not hit.
  16. `[PIN-16]` At level start and at every respawn, a minion's heading is set to N just before its orientation step; a destroyed minion keeps no heading. Every minion runs the orientation step at level start.
  17. `[PIN-17]` Minion lifecycle:
      - At a capture (step 3), each live minion whose cell is no longer a rail cell is destroyed, with its countdown set to R. Every other live minion runs the orientation step.
      - At step 5, minions are processed in index order:
        - a destroyed minion's countdown drops by one, from the tick of its destruction on, as README §4.7 reads. At zero, the minion respawns, oriented, and does not move on that tick. A minion destroyed at tick t therefore respawns at step 5 of tick t + R − 1.
        - a live minion moves when `tick % period == 0`.
      - A respawn cell always exists: the boss's body is always on `EMPTY` cells, so the rail is never empty.
  18. `[PIN-18]` A minion with no direction leading to a rail cell, for example on a one-cell obstacle, stays in place and keeps its heading.
- **Deliverables:**
  - README edits to §4.1-§4.10, §6.3 and §13, with the tags and markers;
  - the `parity-testing` skill: `[COV-nn]` tags on its coverage bullets, and its minion property line replaced by a link to README §4.7 (PIN-14), which keeps the whole-component target;
  - `scripts/check-rule-tags.sh`.
- **Done when:**
  - D3, D4, D5, D6, D8, D9 and D13 read Decided, and D7 reads provisional;
  - every tag is unique, and there are 18 pinned details;
  - `check-rule-tags.sh` prints nothing, and prints the offending line when a tag is removed (output in the PR);
  - the PR body maps each `[PIN-nn]` and `[COV-nn]` tag to the name of the vector or test that will check it. M1.9's `vectors/COVERAGE.md` uses those names.
- **Verify with:**
  - `grep -E '^\| D(3|4|5|6|8|9|13) \|' README.md | grep -vc Decided` prints 0.
  - `grep -E '^\| D7 \|' README.md | grep -c provisional` prints 1.
  - `grep -oE '\[(R4\.[0-9]+-[0-9]+|PIN-[0-9]+)\]' README.md | sort | uniq -d` prints nothing.
  - `grep -oE '\[PIN-[0-9]+\]' README.md | sort -u | wc -l` prints 18.
  - `grep -oE '\[COV-[0-9]+\]' .claude/skills/parity-testing/SKILL.md | sort | uniq -d` prints nothing.
  - `bash scripts/check-rule-tags.sh | wc -l` prints 0.
- **Skills:** `deterministic-core`, `parity-testing`. **README:** §4, §6.3, §13. **Needs user:** approve the pinned details and the crate and contract names (merge = approval; round A2).

#### M0.6 Rules freeze B: byte formats, procedures and worked examples

- **Goal:** replace the "frozen in M0" placeholders of README §5, §6.3, §6.4 and §8.2 with byte-exact definitions. Each gets a worked hex example, computed by a committed script.
- **Proposals:**
  - **Level bytes v1:** 472 bytes, big-endian, trailing bytes rejected. `level_id` = keccak256 of the 472 bytes. Every rule in the last column has its own error code.

    | Offset | Field | Type | Rule |
    |---|---|---|---|
    | 0 | version | u8 | 1 |
    | 1 | obstacle bitmap | 450 bytes | cell i is bit 7 − i % 8 of byte i / 8; border bits must be 0 |
    | 451 | boss body size B | u8 | 2-8 (D9; the level tool defaults to 5) |
    | 452 | boss spawn rectangle | u8 x0, y0, x1, y1 | top-left cells of the body, inclusive; x0 ≤ x1, y0 ≤ y1, x0 ≥ 1, y0 ≥ 1, x1 ≤ 59 − B, y1 ≤ 59 − B (B is checked first, so 59 − B cannot underflow), so every body position stays inside the border |
    | 456 | boss period | u8 | at least 1 |
    | 457 | minion count | u8 | 0-3 |
    | 458 | minion spawns | 3 × (u8 x, u8 y) | used slots: coordinates < 60; unused slots must be zero |
    | 464 | minion period | u8 | at least 1 if the count is above 0; 0 if the count is 0 |
    | 465 | respawn delay R | u16 | at least 1 if the count is above 0; 0 if the count is 0 |
    | 467 | time limit | u16 | 1-2,700 |
    | 469 | lives | u8 | at least 1 |
    | 470 | target | u16 bp | 1-10,000 |

    The zero rules keep the bytes canonical, so one level has one id.
  - **Validity:** the range rules in table order, then the §5 conditions in README order, each with its own error code. The minimum open area is 1,682 cells, half of the 3,364-cell interior.
  - **Journal v1 rules split.** `levelIndex` must be below 6. The decoder rejects what the bytes alone show: an unknown version, `rulesVersion` or mode, reserved bit 7, ticks that don't increase, an event that doesn't change the mask, a tick ≥ 2,700, `levelIndex` ≥ 6, truncation, trailing bytes. Replay, which knows the level, rejects events at or after the level's time limit and events after the level ended. README §6.3 and the `journal-codec` skill are amended to say so.
  - **Boss start:**
    - The candidates are the cells of the spawn rectangle in row-major order, each a top-left position of the body. By validity, the body placed at any of them covers only `EMPTY` cells at level start.
    - index = the big-endian u32 of seed bytes 0-3, modulo the candidate count, which validity keeps at least 1.
    - vx = +1 if bit 0 of seed byte 4 is set, otherwise −1; vy is the same, from bit 1.
    - The modulo bias, below 2^−20, is documented.
  - **Draw (§8.2),** a forward partial Fisher-Yates:
    - The deck is [0, 1, …, 15].
    - For i = 0 to 5: j = i + (uint256(keccak256("jiro.draw" ‖ runNonce ‖ u8 i)) mod (16 − i)). Swap deck[i] and deck[j].
    - The run's levels are deck[0] to deck[5]: the draw slots, indices into the season's 16 levels.

    That is six keccak calls, computed only by the core (M0.7, P17).
  - **State hash v1:**
    - u8 version;
    - u16 tick;
    - u8 current input mask;
    - the grid at 2 bits per cell, 900 bytes: cell i takes the two bits starting at bit 7 − 2 × (i % 4) of byte i / 4;
    - the player, the boss and three minion slots, in the §4.3 field order at fixed widths. Each minion slot has a presence byte, and absent slots are zeroed.
    - counters: captured cells, claimable cells, next event index.

    The total length is stated. The hash is recorded after each processed tick, including the ending tick.
  - **Vector files** (a new README §6.6). One JSON file per vector, with a `kind` key:
    - `journal`: input hex; the expected re-encoded hex, or the expected error code.
    - `level`: input hex; the expected `level_id` and re-encoded hex, or the expected error code.
    - `game`: `name`, `covers` (README sections and tags), `rulesVersion`, `level` (hex), `runNonce`, `levelIndex`, `mode`, `weightBp`, `journal` (hex), the expected outcome or error code, the `.trace` file name and its keccak256 digest. M0.7 adds the outcome keys.

    Derivation fixtures (seeds, boss starts, draws, commitments; later run nonces and deadline cases) live in `vectors/derivations.json` (M1.2). A `.trace` file holds 32 bytes per processed tick.
  - **Diagnosis.** A runner reports the first differing tick. A target that can expose its state (native, wasm, the emulator) also prints its state-hash preimage at that tick. `jiro-tools replay --dump-tick <t> --diff <hex>` decodes that preimage, compares it with native's, and names the differing fields.
- **Worked examples**, computed by `tools/xcheck/worked-examples.mjs` with ethers' keccak, committed with `tools/xcheck/{package.json, package-lock.json}` so anyone can rerun them:
  - the open-field level's bytes and `level_id`, and one validity failure, which become format vectors in M1.4;
  - a boss start and a draw, which become entries of `vectors/derivations.json` in M1.2;
  - the state hash after tick 0 of `open-field-empty` (the open-field level, a fixed nonce, an empty journal), which becomes `vectors/game/open-field-empty.json` in M1.8.
- **Done when:**
  - the level table states every offset and every range rule, and the 472-byte total, with the sum shown in the PR;
  - the boss start and the draw can be executed from the text alone;
  - the state hash lists every field with its width and order, and states its total length;
  - the vector schema lists every key, except the outcome keys of M0.7;
  - README §6.3 and the `journal-codec` skill split the decoder's rejections from replay's;
  - the script reproduces every worked example printed in the README;
  - only the §7.2 slack placeholder remains, for M0.7.
- **Verify with:**
  - `grep -nE 'frozen (and versioned )?in M0' README.md` lists only the §7.2 line.
  - `grep -n '^### 6.6' README.md`
  - `npm --prefix tools/xcheck ci && node tools/xcheck/worked-examples.mjs --check README.md` exits 0: every hex it prints appears in the README.
- **Skills:** `journal-codec`, `deterministic-core`, `parity-testing`. **README:** §5, §6.3, §6.4, §6.6, §8.2. **Needs user:** approve the rectangular spawn area, the range rules, the 1,682-cell threshold, the journal rule split and the draw (round A3).

#### M0.7 Rules freeze C: run, settlement and season; close D10

- **Goal:** freeze what the contracts need, close D10, and finish M0.
- **Result:** README §6.4, §7.2, §7.3, §8.2 and §8.4 hold the frozen text. Where it differs from the proposals below, the README wins, and the M0.7 PR lists each difference and its reason.
- **Proposals:**
  - **Verifier interface (P4).** `IReferee` has three functions, behind which either backend sits:
    - `verifyRun(bytes[6] levels, bytes[6] journals, uint16[6] weightsBp, bytes proof) returns (Outcome[6])`, the main path;
    - `verify(bytes level, bytes journal, uint16 weightBp, bytes proof) returns (Outcome)`, the per-level fallback;
    - `rulesVersion() returns (uint16)`.

    Outcome is `(bytes32 journalHash, bytes32 levelId, bytes32 runNonce, uint8 levelIndex, uint8 drawSlot, uint8 mode, uint16 rulesVersion, uint8 endReason, uint16 claimBp, uint16 ticksUsed, uint32 levelScore)`, where `drawSlot` = draw(runNonce)[levelIndex], computed by the core.

    Why each input:
    - the level bytes, because the journal carries only `levelId`;
    - the weight, because the core computes the score (§8.4);
    - the decoded header fields and the draw slot in the outcome, so the contracts never parse journal bytes or recompute the draw (`journal-codec` skill);
    - `proof`, which is empty on Stylus.

    This replaces `verify(journal) → outcome` in README §3 and §7.3 point 3, and in the `onchain-referee` skill. The PR body calls the change out.
  - **Settlement shape (P16)**, put to the user in round A4:
    - **(a), recommended: per run.** `settleRun(runId, bytes[6] levels, bytes[6] journals, bytes proof)` calls `verifyRun` once. On Stylus, the referee replays the six levels in one transaction: six replays of at most 1M gas each fit well within Arbitrum's 32M gas limit per transaction. On zk, one guest execution replays all six levels and commits six Outcomes, so each verified run gets one proof, as README §7.3 point 4 says. `settleLevel(runId, i, journalHashes[6], level, journal, proof)` stays as the fallback for a run that does not fit one transaction (`onchain-referee` skill). Season aggregation, the rest of point 4, is measured in M4.8 and decided with D2 in M4.9. README §7.3 point 4 stays as written.
    - **(b) per level only:** six proofs per run on zk. README §7.3 point 4 and the `onchain-referee` skill are amended to "one proof per level on testnet; per-run proofs and season aggregation before mainnet", listed in the PR body as a README change. If the user picks (b), this PR rewrites M4.7, M4.8, M4.10 and M4.16.
  - **Draw check (P17).** The contracts never compute the draw. Before calling the referee, the contract takes each level's weight from the season by `levelId = keccak256(level bytes)`, and reverts if the level is not in the season. After the call, it checks `seasonLevelIds[outcome.drawSlot] == outcome.levelId`. The alternative, a Solidity copy of the draw, is a second implementation of a core procedure (`journal-codec` skill); M4.4 builds it only if the user prefers it.
  - **Run nonce:** keccak256("jiro.run" ‖ entropy ‖ uint256 runId), computed only by the contract. The core takes `runNonce` as an input and never derives it.
  - **Deadline:** committedAt ≤ revealedAt + ceil(Σ ticksUsed / 15) + commitSlack. It is checked once all six levels are verified.
    - commitSlack is a season parameter (P6). The proposal is 120 s: 60 s for transaction latency plus 6 × 10 s for level transitions.
    - M5.5 sets the testnet value from measurements.
  - **Closing a level early.** The client closes a level's journal with an X event: at tick 0 for an unplayed or abandoned level, and at the last tick it knows of for a level interrupted by a disconnect or a page reload (M5.2, M5.4). Either way the journal is valid, the level is committed with its claim, and its ticks used follow the time actually spent.
  - **Settlement:**
    - a run counts only once all six levels are settled;
    - anyone may submit;
    - the credit goes to the run's player;
    - the level bytes and the journals are submitted, plus a proof on zk. The weights come from the season. The seed and the score are never submitted. README §6.4's last bullet ("Only the journal bytes are submitted") and §7.2 step 4 ("The journal bytes are submitted") are rewritten to say this.
  - **Season parameters and sequencing:**
    - committed at season open, immutable afterwards: `rulesVersion`, `referee` (address), the 16 level ids, 16 weights in bp, the run fee in wei (50_000_000_000_000 for the 0.00005 ETH of D12), the rake (at most 2,000 bp), start, length, settlement grace, commitSlack;
    - `Season` takes an immutable `treasury` address in its constructor. At close, the rake is credited to the treasury, and a permissionless `withdrawRake()` sends it there, so a treasury that rejects ETH never blocks close or claims. ethblockdigger pays it to `vault.creator()`; Jiro has no creator.
    - `open` requires `referee.rulesVersion() == rulesVersion`. `ZkReferee` pins its image id or program key immutably, so the referee address also fixes the zk program.
    - `open(s + 1)` requires `block.timestamp ≥ end(s)`, so seasons overlap only during season s's grace period. `startRun` reverts when no season is open.
    - a run belongs to the season of its `startRun`, settles through that season's referee, and can settle until season end plus grace (proposed: 48 h). A new rules version or a new backend therefore means a new season; runs of the previous season keep settling under their own rules.
    - after the season end plus grace, `closeSeason` is permissionless. Qualified players need it called before they can claim, which gives them the reason to call it. An empty season's rollover goes to the season open at its close, or, if none is open, to the next season opened.
  - **Journal publication (P5)**, put to the user in round A4:
    - **(a), recommended, keeps README §7.3 point 2, §7.4 and §8.4 as written:** `commitRun(runId, commitment, bytes journals)` carries the six journals as calldata. The contract stores only the commitment and never reads the blob. Anyone can check the blob against the commitment offchain at no gas cost, and replay it. M4.6 measures the commit's gas with a typical and a full blob.
    - **(b) an offchain public store:** at commit, the dApp uploads the six journals, for example to a Cloudflare R2 bucket behind a Worker, keyed by run id; readers check them against the commitment. No gas, but new infrastructure, and an operator who can drop files.
    - **(c) settled runs only:** journals become public through settlement calldata; README §7.3, §7.4 and §8.4 are amended (the inspect lever covers settled runs, and later seasons' weights come from settled journals plus bot data).

    If the user picks (b) or (c), this PR rewrites M4.6, M5.2 and M5.3.
  - **Testnet seasons** are named `testnet-N`. A sentence in §8.4 says that their journals don't feed mainnet weights, and that the first mainnet season uses bot data.
  - **D10:**
    - players are ranked by their best settled run of the season, with ties going to fewer ticks;
    - the payout is pro-rata by best-run score, among players whose best run cleared at least one level.
  - **D12,** decided by the owner on 2026-10-28, which this item pins:
    - native ETH, on Arbitrum Sepolia for M4 and M5 and Arbitrum One later, reusing what is reusable from ethblockdigger's contracts;
    - a Challenge run fee of 0.00005 ETH, committed with each season, so a later season can reprice it;
    - 14-day seasons on testnet, apart from M4.14's 1-day `testnet-0` rehearsal; likely 14 days on mainnet too;
    - `startRun` is `payable` and requires `msg.value` to equal the season's fee, with no approve step. Payouts stay pull-based, as ethblockdigger's claims already are, and the rake is credited to the treasury and sent by a permissionless `withdrawRake()`, so `closeSeason` never sends ETH. Every function that sends ETH follows checks-effects-interactions.
- **Deliverables:**
  - README edits to §3, §6.4, §6.6 (the outcome keys of the `game` vector schema), §7.2, §7.3, §8.2, §8.4 and §13, and to §7.4 only if P5 = (c);
  - the interface line of the `onchain-referee` skill, and its settlement line if P16 = (b);
  - a skeleton of `docs/ECONOMY.md`:
    - the money flow of a run, the rake going to the treasury;
    - cost cells marked TBD, each naming the item that fills it (M4.2, M4.6, M4.7, M4.8, M4.9);
    - a threat table whose rows name their mitigation and the item that measures it, including journal publication per P5, and "a consensus bug in a live season's referee", marked as an accepted residual on testnet;
    - a "Pre-mainnet prerequisites (not scheduled)" list: the audit; a legal read of the paid pot, with geo-gating as its fallback; custody of the operator key behind `Season.open` and of the treasury address, for example a multisig; a procedure for a consensus bug found mid-season, since a season's referee is immutable and has no pause.
- **Done when:**
  - the D10 row states the qualification and no longer reads proposed;
  - the interface, the settlement shape, the draw check, the run nonce, the deadline, the season parameters and the sequencing rules are written with Solidity types and rounding;
  - the P5, P16 and P17 choices are recorded in the README;
  - no "frozen in M0" placeholder is left, and neither old submission sentence remains;
  - every §13 row except D2, D7 and D11 reads Decided, which is README §9's M0 done-when;
  - every TBD in `ECONOMY.md` names an item.
- **Verify with:**
  - `! grep -nE 'frozen (and versioned )?in M0' README.md`
  - `! grep -nE 'Only the journal bytes are submitted|The journal bytes are submitted' README.md`
  - `grep -E '^\| D[0-9]+ \|' README.md | grep -vE '^\| D(2|7|11) \|' | grep -vc Decided` prints 0, and `grep -E '^\| D[0-9]+ \|' README.md | grep -vE '^\| D(2|7|11) \|' | grep -ciE 'proposed|still open'` prints 0.
  - `grep -n 'jiro.run\|commitSlack\|rulesVersion()\|verifyRun\|drawSlot\|treasury' README.md`
  - `grep TBD docs/ECONOMY.md | grep -vcE 'M[0-9]+\.[0-9]+'` prints 0.
- **Skills:** `onchain-referee`, `journal-codec`. **README:** §3, §6.4, §6.6, §7.2, §7.3, §7.4, §8.2, §8.4, §13. **Needs user:** choose the settlement shape (P16), the journal publication (P5) and the draw check (P17); approve the D10 qualification, the interface, the season-bound referee and treasury, the sequencing and the 120 s slack proposal (round A4).

## 6. M1 Core

| ID | Title | Depends on | Size | Needs user |
|---|---|---|---|---|
| M1.1 | Core foundations and journal codec v1 | M0.4, M0.6 | M | none |
| M1.2 | Derivations and ethers fixtures | M1.1 | S | none |
| M1.3 | Level format v1, validity, rail and claim | M1.1 | M | none |
| M1.4 | Vector generator, format vectors, drift gate | M1.2, M1.3 | M | none |
| M1.18 | D14 seeded boss randomness: specification | M0.7 | S | Approve the rule |
| M1.5 | Capture and boss | M1.2, M1.3, M1.18 | M | none |
| M1.6 | Player movement, cuts, fast cut and slow shield | M1.5 | M | none |
| M1.7 | Minions and the D7 measurement | M1.5 | M | Review the trap measurement |
| M1.14 | D7 replacement rule: specification (only if M1.7 finds traps) | M1.7 | S | Approve the replacement or a bounded trap rate |
| M1.8 | Tick loop, hits, end of level, state hash, replay, Recorder | M0.7, M1.4, M1.6, M1.7 | L | none |
| M1.15 | D7 replacement rule: implementation (only if M1.14 changes the rule) | M1.8, M1.14 | M | none |
| M1.9 | Gameplay golden vectors, coverage index, version gate | M1.4, M1.8, M1.15 if built | L | none |
| M1.10 | Property suite, case generator, no-panic fuzzing, nightly workflow | M1.8, M1.15 if built | M | none |
| M1.11 | wasm engine and Node parity runner | M1.9 | M | none |
| M1.16 | zkVM trial: SP1 | M0.2, M1.9 | M | none |
| M1.17 | zkVM trial: RISC Zero | M0.2, M1.9 | M | none |
| M1.12 | zkVM choice (D2, part 1) | M1.10, M1.16, M1.17 | M | Approve the framework; a prover route if wrapping failed |
| M1.13 | Differential fuzzing across native, wasm and the zk executor | M1.10, M1.11, M1.12 | S | none |

#### M1.1 Core foundations and journal codec v1

- **Goal:** the core's types and the strict journal v1 codec, with no heap and no decoded copy of the journal.
- **First step:** dispatch `ci.yml` on this branch once with `actions_run_trigger` (`ref` = the branch), read it with `get_job_logs`, and record in `docs/TOOLING.md` whether dispatch on a branch works.
- **Deliverables:**
  - `core/Cargo.toml`: the only direct dependency is tiny-keccak 2 with the `keccak` feature. `rust-version` is set from M0.2's zkVM toolchain record, and the targets job gains an MSRV build of `jiro-core`.
  - `core/src/{lib,types,consts,error,keccak,journal}.rs`:
    - **Types:** the cell states 0-3; `Pos { x: u8, y: u8 }`; `Dir`; `InputMask` with the bits of §6.1; a bounded cell index.
    - **Constants:** `W` = 60, `CELLS` = 3,600, `CAPTURE_STACK` = 3,364, `MAX_TICKS` = `MAX_EVENTS` = 2,700, `TICK_HZ` = 15, `RULES_VERSION` = 1, `HEADER_LEN` = 71, `MAX_JOURNAL_LEN` = 71 + 8,100.
    - **Errors:** one `Error` enum, with a stable u8 code per rejection.
    - **Journal:**
      - `decode(&[u8])` validates the bytes in place and returns a view: the header and an iterator over the 3-byte events of the borrowed bytes. Nothing is copied.
      - encode into a caller-provided buffer;
      - `journal_hash`;
      - `run_commitment(&[[u8; 32]; 6])`.
  - `core/tests/journal_codec.rs`.

  The decoder rejects what the bytes alone show (M0.6):
  - an unknown version, `rulesVersion` or mode, mode 2 included;
  - reserved bit 7 set;
  - ticks that don't increase;
  - an event that doesn't change the mask, including a first event with mask 0;
  - a tick ≥ 2,700;
  - an `eventCount` above 2,700;
  - a `levelIndex` of 6 or more;
  - truncated input;
  - trailing bytes.

  Events at or after the level's time limit, or after the level ended, are rejected by replay (M1.8), which knows the level.
- **Done when:**
  - each rejection rule has its own test, asserting its error code;
  - encode(decode(x)) == x holds on 10,000 random valid journals from an in-repo seeded xorshift generator, which adds no dependency;
  - a test asserts that the event area is 8,100 bytes (README §2) and `MAX_JOURNAL_LEN` is `HEADER_LEN` + 8,100;
  - keccak256 of empty input equals `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`;
  - error codes are unique;
  - tiny-keccak is the only direct dependency;
  - the dispatch check is recorded.
- **Verify with:**
  - `cargo test -p jiro-core --test journal_codec --locked`
  - `cargo test -p jiro-core --test journal_codec --locked -- --list | grep -c ': test$'` prints at least 13.
  - `cargo tree -p jiro-core -e normal --depth 1 --prefix none | wc -l` prints 2.
- **Skills:** `deterministic-core`, `journal-codec`, `parity-testing`. **README:** §2, §4.1, §6.1-§6.4. **Needs user:** none.

#### M1.2 Derivations and ethers fixtures

- **Goal:** the seed, boss-start and draw procedures of M0.6 in the core, checked against an independent implementation.
- **Deliverables:**
  - `core/src/seed.rs`:
    - `level_seed` = keccak256("jiro.level" ‖ runNonce ‖ u8 levelIndex);
    - `boss_start(rect, seed)`;
    - `draw(runNonce) -> [u8; 6]`, which reduces the 256-bit hash mod (16 − i) with Horner's rule over its 32 bytes, so no bignum is needed.
  - `core/tests/derivations.rs`.
  - `tools/xcheck/derivations.mjs`, in the package of M0.6: ethers v6 `solidityPackedKeccak256` and BigInt.
  - `vectors/derivations.json`:
    - level seeds;
    - the level ids of fixed level bytes;
    - boss starts, including the M0.6 worked example;
    - draws for 100 nonces, including the M0.6 worked example;
    - run commitments.

    M4.4 adds run nonces and M4.7 deadline cases to the same file, through the same script.
  - The first part of the vectors-drift CI job.
- **Done when:**
  - the core equals the fixture for every entry;
  - over 100,000 random nonces, every draw returns 6 distinct indices below 16;
  - regenerating the fixture leaves no drift;
  - the M0.6 boss-start and draw examples match.
- **Verify with:**
  - `cargo test -p jiro-core --test derivations --locked`
  - `npm --prefix tools/xcheck ci && node tools/xcheck/derivations.mjs --write && bash scripts/check-drift.sh vectors/derivations.json`
- **Skills:** `journal-codec`, `parity-testing`. **README:** §4.6, §6.4, §8.2. **Needs user:** none.

#### M1.3 Level format v1, validity, rail and claim

- **Goal:** decode and validate levels, and build the level-start grid.
- **Deliverables:**
  - `core/src/level.rs`: decode, encode, `level_id`, and validity in the M0.6 order. The region search is iterative, on a fixed-size stack passed in as `&mut [u16; 3_364]`. `Game::new` (M1.8) passes its own capture stack; other callers (the level tool, `validate_level` in `jiro-wasm`) pass their own.
  - `core/src/grid.rs`:
    - the level-start grid, with the border and the obstacles `CLAIMED`;
    - the rail predicate over 8 neighbors, with `TRAIL` counted as open;
    - the claimable cells;
    - `claim_bp = captured × 10,000 / claimable` in u32, with a single floor division.
  - `core/tests/level.rs`. Test levels are built in code, not stored as files.
- **Done when:**
  - each range rule and each validity rule has a test asserting its code. Among them: a boss body size of 1 or 9; boss period 0; minion period or R nonzero with 0 minions, or 0 with minions; x0 > x1; y0 > y1; a spawn rectangle that lets the body reach the border (x1 = 60 − B); x1 = 255 with B = 8; a body position covering an obstacle; a minion spawn coordinate of 60; a nonzero unused minion slot.
  - encode(decode(x)) == x for every built test level;
  - on the empty level, there are 3,364 claimable cells and all four border corners are rail cells;
  - claim_bp is 10,000 for 3,364 of 3,364 cells and 2 for 1 of 3,364.
- **Verify with:** `cargo test -p jiro-core --test level --locked`
- **Skills:** `deterministic-core`, `journal-codec`. **README:** §4.1, §4.2, §5. **Needs user:** none.

#### M1.4 Vector generator, format vectors and drift gate

- **Goal:** the `vectors/` pipeline, with drift detection in CI, in place before any gameplay code.
- **Deliverables:**
  - The `vectors` subcommand of `jiro-tools`.
  - `tools/src/scenarios/`: scenario functions. Each one asserts what it exercises, so a scenario that stops testing its rule fails generation.
  - `vectors/format/journal-*.json` (kind `journal`): valid journals, and one malformed journal per decoder rejection rule.
  - `vectors/format/level-*.json` (kind `level`): valid levels, one invalid level per range and validity rule, and the M0.6 level-bytes and validity examples.
  - `vectors/README.md`.
  - `core/tests/vectors.rs`. It checks every vector, prints the first differing field, and asserts encode(decode(x)) == x for every valid journal and level in `vectors/`.
  - The vectors-drift job: regenerate, then `scripts/check-drift.sh vectors/`. This is the fixture pattern of ethblockdigger's [`ci.yml`](https://github.com/detychey/ethblockdigger/blob/main/.github/workflows/ci.yml).

  The boss-start and draw examples are checked through `vectors/derivations.json` (M1.2), the state-hash example in M1.8, and the gameplay vectors in M1.9.
- **Done when:**
  - two generations are byte-identical;
  - a hand-edited vector fails CI. The run link goes in the PR, and the edit is reverted.
  - every malformed vector is rejected with its recorded code;
  - the round trip holds for every valid journal and level vector;
  - the M0.6 level-bytes and validity examples exist as vectors.
- **Verify with:**
  - `cargo run -p jiro-tools --locked -- vectors && bash scripts/check-drift.sh vectors/`
  - `cargo test -p jiro-core --test vectors --locked`
- **Skills:** `parity-testing`, `journal-codec`. **README:** §6, §9 M1. **Needs user:** none.

#### M1.18 D14 seeded boss randomness: specification

- **Goal:** the exact rule by which the level seed keeps driving the boss through the level (D14), so that no two runs share a game, written into the README and approved before M1.5 builds the boss.
- **Deliverables:**
  - README §4.6 and §6.4, with tags:
    - an integer PRNG with explicit 32-bit wrapping (the `journal-codec` skill), seeded from the level seed;
    - when it is drawn, for example at each bounce, and how its output changes the boss's move;
    - its state.

    The rule keeps §4.6's guarantees: the boss moves one axis at a time, and its body only ever covers `EMPTY` cells.
  - if the rule adds boss state, such as the PRNG's state, which enters the state hash because README §6.4 hashes the whole state: its width, the §4.3 Boss row, the §6.4 state-hash layout and its total length, and the M0.6 worked examples recomputed with `tools/xcheck/worked-examples.mjs`.
  - the PR body: the results of a throwaway prototype (not committed), showing that:
    - over 5,000 random boards × 2,700 ticks, for each B from 2 to 8, the body never covers a cell that isn't `EMPTY`;
    - two seeds with the same boss start and direction diverge within N ticks, with N stated in the rule text for M1.5's test.

  The rule only adds to §4.6 and §6.4. R4.6-5 and the §6.4 boss start (the candidate index from seed bytes 0-3, the direction from byte 4) stay as M0.6 froze them, because M1.2 may already implement them. The added rule is first implemented by M1.5, so it bumps no `RULES_VERSION`.
- **Done when:**
  - the rule can be implemented from the text alone;
  - the prototype results are in the PR, and the PR states whether the state-hash layout changed;
  - the M0.6 boss-start worked examples are unchanged;
  - `worked-examples.mjs --check README.md` exits 0;
  - `check-rule-tags.sh` prints nothing.
- **Verify with:** `npm --prefix tools/xcheck ci && node tools/xcheck/worked-examples.mjs --check README.md`; `bash scripts/check-rule-tags.sh | wc -l` prints 0.
- **Skills:** `deterministic-core`, `journal-codec`. **README:** §4.3, §4.6, §6.4, §13 D14. **Needs user:** approve the rule (round B0).

#### M1.5 Capture and boss

- **Goal:** README §4.8 capture and §4.6 boss movement, with the capture shown not to depend on fill order.
- **Deliverables:**
  - `core/src/capture.rs`:
    - cells are marked `BOSS_ZONE` when pushed;
    - a fixed-size `[u16; 3_364]` stack, owned by the game state and not on the call stack;
    - one pass over the grid, which returns the capture size.
  - `core/src/boss.rs`:
    - the §4.6 pseudocode for a B × B body, testing the whole leading edge on each axis, with a global move phase;
    - a bump into `TRAIL` anywhere on the leading edge sets the tick's hit flag;
    - the start position (the body's top-left cell) and the direction come from M1.2;
    - the seeded randomness of D14, as M1.18 wrote it.
  - `core/tests/{capture_order,boss}.rs`, with queue and scanline fills that exist in test code only.
- **Done when:**
  - unit tests cover an edge rectangle, an L-shaped cut, a cut enclosing an obstacle, a pocket next to an obstacle, and a cut splitting the field with the boss on either side;
  - the stack, queue and scanline fills give identical grids and capture sizes on 5,000 random grids;
  - the stack depth never exceeds 3,364;
  - boss tests cover the outside corner, a corridor exactly as wide as the body, `TRAIL` bumps on x and on y at either end and in the middle of the leading edge, and bodies with B = 2 and B = 8;
  - after a capture, every cell of the body is still `EMPTY`, and a pocket narrower than the body that connects to the boss's region stays open;
  - over 5,000 random boards × 2,700 ticks, for each body size from 2 to 8, no cell of the body is ever on `CLAIMED` or `TRAIL`, and vx and vy stay ±1, with the D14 randomness enabled;
  - D14: on the same random boards, with the same boss start and direction, two level seeds whose bytes 5 to 8 are drawn at random and differ give boss trajectories that diverge within N = 400 boss moves (README R4.6-12), at boss move periods 1 to 6.
- **Verify with:** `cargo test -p jiro-core --release --locked --test capture_order --test boss`
- **Skills:** `deterministic-core`, `parity-testing`. **README:** §4.6, §4.8, §6.4. **Needs user:** none.

#### M1.6 Player movement, cuts, fast cut and slow shield

- **Goal:** README §4.5, with the details pinned in M0.5.
- **Deliverables:** `core/src/player.rs` and its unit tests, covering:
  - direction resolution: keep the previous direction while it is held, otherwise take up, down, left, right in that order;
  - rail-to-rail movement (D3);
  - leaving the rail, which records the cut start and lays `TRAIL`;
  - the off-rail rule;
  - the own trail blocking a move (D4);
  - a step onto any cell of the boss's body, which is a hit and doesn't move the player;
  - closing a cut onto `CLAIMED`, which captures and ends movement for the tick;
  - fast cut: two sub-steps when the player is cutting at the start of the tick and A is held, and no second sub-step after a blocked, hitting or closing first one (PIN-04);
  - the slow-shield phase from `press_tick`, with B winning over A;
  - the cells P0 … Pn of the tick, kept for the hit predicate (PIN-15).
- **Done when:** each §4.5 rule tag and each §4.5 pinned detail (PIN-01, PIN-03, PIN-04, PIN-05) has its own named test, at least 12 in all; PIN-02 (§4.9) is tested in M1.8. These include:
  - a fast cut closing on its first sub-step;
  - two held directions keeping the previous one;
  - a player stranded off the rail by their own capture, walking over `CLAIMED` cells back to the rail.
- **Verify with:**
  - `cargo test -p jiro-core --locked player`
  - `cargo test -p jiro-core --locked player -- --list | grep -c ': test$'` prints at least 12.
- **Skills:** `deterministic-core`. **README:** §4.3, §4.5, §4.8. **Needs user:** none.

#### M1.7 Minions and the D7 measurement

- **Goal:** README §4.7 minions with the right-hand rule, and a committed measurement of its trap rate under the coverage property. This item measures and stops; it does not design a replacement.
- **Deliverables:**
  - `core/src/minion.rs`:
    - the right-hand rule;
    - the orientation step at level start, at respawn and after every capture, with the reference cells and initial heading pinned in M0.5 (PIN-06, PIN-16);
    - the lifecycle of PIN-17: destruction at the capture, the countdown, respawn at the spawn cell or at the first rail cell in row-major order, and no move on the respawn tick;
    - the move period, in index order;
    - a minion with no rail direction staying in place (PIN-18).
  - `core/tests/minion_coverage.rs`: the PIN-14 property on random boards with obstacle blobs and captures applied mid-patrol. It reports the trap count and the failing seeds. Two constants are committed in the test, each asserted by its own test:
    - `EXPECTED_TRAPS_10K`, for 10,000 fixed-seed boards, run in the rust-release job;
    - `EXPECTED_TRAPS_100K`, for 100,000 boards, under `#[ignore]`, run in the nightly run and once locally in this PR.
  - README §4.7: the measured rates replace the uncommitted simulation numbers of the "known gap" paragraph; the §13 D7 row.

  If both counts are 0, D7 reads Decided and this PR marks M1.14 and M1.15 "not built". Otherwise D7 stays provisional, the constants hold the measured counts, and M1.14 starts.
- **Done when:**
  - both trap counts are committed, and the rust-release run takes under 120 s in the container;
  - the 100,000-board release run has been done locally, with its command, output and trap count in the PR;
  - minions are on rail cells after every move;
  - each §4.7 rule tag and PIN-06, PIN-16, PIN-17 and PIN-18 has a named unit test, both respawn locations included;
  - the D7 row states the measured rates and either reads Decided or names M1.14.
- **Verify with:**
  - `cargo test -p jiro-core --release --locked --test minion_coverage -- --nocapture`
  - `cargo test -p jiro-core --release --locked --test minion_coverage -- --include-ignored --nocapture`
- **Skills:** `deterministic-core`, `parity-testing`. **README:** §4.3, §4.7, §13 D7. **Needs user:** review the measurement (merge; round B1).

#### M1.14 D7 replacement rule: specification (only if M1.7 finds traps)

- **Goal:** an exact replacement patrol rule in README §4.7, or an accepted bounded trap rate, approved by the user before any code depends on it.
- **Deliverables:**
  - README §4.7: the replacement written exactly, with its tags. The default candidate is contour tracing of the field boundary, which README §4.7 names.
  - the pinned details it changes, if any;
  - if the rule adds minion state: the §4.3 entity table, the §6.4 state-hash layout and its version, its total length, and the M0.6 worked example recomputed with `tools/xcheck/worked-examples.mjs`;
  - the PR body: the trap count of a throwaway prototype (not committed) on M1.7's 10,000 seeds, and on the seeds that failed in M1.7.

  **Exit.** If no rule reaches 0 traps, the PR lists the failing seeds and asks the user to choose: another rule, or an accepted bounded trap rate. If the user accepts a rate, for the current rule or for a replacement, README §4.7 and the D7 row state the rule, the measured rates and the reason. M1.15 is then built only if the rule changes, with the accepted counts as its constants.
- **Done when:**
  - the rule can be implemented from the text alone;
  - the prototype shows 0 traps on those seeds, or the accepted rate is written into README §4.7 and the D7 row;
  - the PR states whether the state-hash layout changed;
  - `check-rule-tags.sh` prints nothing.
- **Verify with:** `grep -oE '\[(R4\.[0-9]+-[0-9]+|PIN-[0-9]+)\]' README.md | sort | uniq -d` prints nothing; `bash scripts/check-rule-tags.sh | wc -l` prints 0.
- **Skills:** `deterministic-core`, `parity-testing`. **README:** §4.3, §4.7, §6.4, §13 D7. **Needs user:** approve the replacement, or accept a bounded trap rate (round B2).

#### M1.8 Tick loop, hits, end of level, state hash, replay and Recorder

- **Goal:** a complete level simulation, and the replay API that every target calls.
- **Deliverables:** `core/src/{game,hits,hash,replay,recorder}.rs` and their tests:
  - **Game.** `Game::new(level, runNonce, levelIndex, mode)` and `step(mask) -> Option<EndReason>`. Each step runs §4.4 steps 1-7 and stops at the first end condition.
  - **Hits.** Three sources (README R4.9-2 to R4.9-4: the boss's bump into `TRAIL`, a step onto the boss's body, and a minion meeting the player by PIN-15's share, swap or pass case), one flag per tick. Resolution at step 6, in this order:
    1. if the player is invulnerable, nothing happens;
    2. otherwise, if B is held and a shield charge is left, the charge is spent;
    3. otherwise, a life is lost: the trail is erased, the player returns to the cut start, and invulnerability starts (PIN-02).
  - **Level score.** `level_score` = claim_bp × weight_bp / 10,000 with floor division, and 0 when the lives ran out.
  - **State hash v1** (M0.6). It is computed only when a trace is requested, never inside `step`. A function exposes its preimage for diagnosis.
  - **Replay.** `replay(level_bytes, journal_bytes, weight_bp) -> Result<Outcome, Error>`:
    - checks keccak256 of the level bytes against the header's `levelId`;
    - iterates the journal bytes in place;
    - rejects events at ticks ≥ T, and events after the level ended;
    - returns the Outcome of README §7.3, `drawSlot` included.
  - **Recorder,** the single input path for every target: a raw mask is journaled as an event if it changed, then the game steps with the journaled mask. Its buffer of `MAX_JOURNAL_LEN` bytes is a field of the `Recorder`.
  - `vectors/game/open-field-empty.json` and its trace, produced by the M1.4 generator: the M0.6 state-hash worked example. On a mismatch, the agent fixes whichever side contradicts the README text, the core or `tools/xcheck/worked-examples.mjs`, and says why in the PR.
  - The float probe of M0.4, changed to call `replay`.

  M1.8 uses the minion rule of M1.7. If M1.15 later replaces it, M1.15 updates the minion tests below.
- **Done when** these tests pass:
  - Hits and lives:
    - one test per hit source;
    - for PIN-15: a share on the player's final cell, a swap on the rail, a swap at a fast-cut close after the capture, a pass through the intermediate fast-cut cell, and no hit for a minion moving into the cell the player left;
    - a minion respawning onto the player's cell hits (PIN-11);
    - three hits in one tick cost one life;
    - a hit with B held and a charge left spends only the charge;
    - a hit while invulnerable does nothing;
    - tick h+30 is protected and tick h+31 is not;
    - starting a cut ends invulnerability;
    - the player respawns at the cut start after the bottom border was captured.
  - End of level:
    - X at tick 0 gives claim 0 and ticks used 1;
    - X during a cut erases the trail, captures nothing, and leaves the claim unchanged;
    - a clear and the loss of the last life on the same tick end the level as Cleared;
    - an event at T−1 is accepted, and one at T is rejected;
    - an event after a commit is rejected;
    - an empty journal runs T ticks and ends on time.
  - State and recording:
    - tick 0 of `open-field-empty` hashes to the M0.6 worked example;
    - the Recorder's journal bytes replay to the same per-tick trace as the live run;
    - `drawSlot` equals `draw(runNonce)[levelIndex]`.

  The clippy gates and `check-no-float.sh` (now covering `replay`) also pass.
- **Verify with:**
  - `cargo test -p jiro-core --locked`
  - `cargo clippy -p jiro-core --all-targets --locked -- -D warnings && bash scripts/check-no-float.sh`
- **Skills:** `deterministic-core`, `journal-codec`, `parity-testing`. **README:** §4.4, §4.9, §4.10, §6.2, §6.4, §7.3, §8.4. **Needs user:** none.

#### M1.15 D7 replacement rule: implementation (only if M1.14 changes the rule)

- **Goal:** the rule of M1.14 in the core, with the trap counts M1.14 set.
- **Deliverables:**
  - `core/src/minion.rs` changed to M1.14's rule;
  - `EXPECTED_TRAPS_10K` and `EXPECTED_TRAPS_100K` set to 0, or to the counts M1.14 accepted;
  - `RULES_VERSION` bumped: M1.14 edited rule text after M1.7 implemented it, so this is a behavior change;
  - if M1.14 changed the state-hash layout: the hash code, its version and `open-field-empty`;
  - `vectors/` regenerated;
  - the D7 row reading Decided.
- **Done when:**
  - the trap counts equal the committed constants on the 10,000 boards in CI and on the 100,000 boards in a local release run (output in the PR);
  - the M1.7 unit tests still pass, or are updated per M1.14's text;
  - M1.8's minion hit tests (PIN-11, PIN-15) still pass, or are updated per M1.14's text;
  - the drift gate is green after regeneration.
- **Verify with:** the two commands of M1.7, `cargo test -p jiro-core --locked`, and `cargo run -p jiro-tools --locked -- vectors && bash scripts/check-drift.sh vectors/`.
- **Skills:** `deterministic-core`, `parity-testing`. **README:** §4.7, §13 D7. **Needs user:** none.

#### M1.9 Gameplay golden vectors, coverage index and version gate

- **Goal:** committed, drift-checked golden vectors with per-tick traces, pinning every tagged rule, and a CI gate that ties moved outcomes to a version bump.
- **Deliverables:**
  - Gameplay scenarios in `tools/src/scenarios/`.
  - `vectors/game/*.json` and `*.trace` (kind `game`). Named vectors that later items use: `open-field-empty` (M1.8), `open-field-capture` (a scripted game with captures on the open-field level), and `worst-case`.
  - The `replay` subcommand of `jiro-tools`: `replay --vector <file>`, or `--level <file> --journal <file>`, prints the outcome and the final hash. With `--vector`, `--journal <file>` replaces the vector's journal. `--dump-tick <t>` prints the state-hash preimage at tick t, and `--diff <hex>` names the fields that differ from another target's preimage.
  - `vectors/COVERAGE.md`: maps every `[R4.*]` and `[PIN-*]` tag of README.md and every `[COV-*]` tag of the `parity-testing` skill to vector names, or to `test:<function>` for a core unit test.
  - `core/tests/coverage_index.rs`. It extracts the tags by regex from README.md and the skill, and fails on a tag with no mapping, on a mapping to a missing vector file or to a test function not found under `core/`, and on an unknown tag in `COVERAGE.md`.
  - `core/tests/vectors.rs`, extended: the round trip on the journal and level of every game vector.
  - `scripts/check-rules-version.sh`, in the vectors-drift job. With `base=$(git merge-base origin/main HEAD)`:
    - if `git diff --diff-filter=MD --name-only $base -- vectors/game vectors/levels` is non-empty, `RULES_VERSION` in `core/src/consts.rs` must differ from its value at `$base`, and every game vector's `rulesVersion` must equal the new value;
    - a modified file under `vectors/format` requires a bump of a format version (journal, level, state hash) or of `RULES_VERSION`;
    - added vector files don't trigger it;
    - `--reverse` fails if any vector file is modified or any version changed (M4.15).

  The scenarios include:
  - every `[COV-*]` bullet;
  - Commit during a cut: the trail is erased and nothing is captured;
  - a full 2,700-event journal;
  - at least 8 long random games: some with direction and X bits only, then some with all bits;
  - `worst-case`, a synthetic worst case for Stylus gas and zk cycles: 2,700 ticks, a B = 8 boss with period 1, 3 minions, obstacles, frequent captures, an event every tick.
- **Done when:**
  - there are at least 30 gameplay vectors;
  - the coverage-index test passes;
  - the drift gate is green;
  - a scratch commit that changes a rule and regenerates `vectors/` without a bump fails `check-rules-version.sh` in CI (run link in the PR), and is reverted;
  - `du -sm vectors` is below 10;
  - after a deliberate local rule change, the vector test reports the first differing tick, and `replay --dump-tick --diff` names the differing field (output in the PR).
- **Verify with:**
  - `cargo run -p jiro-tools --release --locked -- vectors && bash scripts/check-drift.sh vectors/ && bash scripts/check-rules-version.sh`
  - `cargo test -p jiro-core --locked --test vectors --test coverage_index`
- **Skills:** `parity-testing`, `deterministic-core`. **README:** §4, §6.3, §6.6, §9 M1. **Needs user:** none.

#### M1.10 Property suite, case generator, no-panic fuzzing and nightly workflow

- **Goal:** the `parity-testing` properties checked over random games, evidence that stepping cannot panic, and one random-case generator that every target's differential test reads.
- **Deliverables:**
  - The `difffuzz` subcommand of `jiro-tools`: writes N random cases from a seed, each with a valid level (B drawn from 2 to 8), a nonce, a journal, and the native outcome and trace digest. Fixed seed 1 with 200 cases is the shared fixed set.
  - `core/tests/properties.rs`, seeded by the in-repo generator, with the case count read from `JIRO_CASES`. Properties:
    - `claim_bp` never decreases within a level;
    - no cell of the boss's body is ever `CLAIMED` or `TRAIL`;
    - minions stay on rail cells;
    - replay never panics on arbitrary bytes: it returns an `Error` or an `Outcome`;
    - two replays of the same input are identical.
  - `.github/workflows/nightly.yml`, following §1.3:
    - `pull_request` on `core/`, `tools/`, `vectors/` and itself (or the `ci:heavy` label), at 2,000 cases;
    - `schedule` at full counts: 100,000 cases per property, 100,000 random journals through replay in a release build, and the 100,000-board minion coverage run asserting `EXPECTED_TRAPS_100K`;
    - `workflow_dispatch` with a case-count input.
- **Done when:**
  - 2,000 cases per property pass in the rust-release job, in under 5 minutes in the container;
  - this PR's `nightly.yml` run is green;
  - a local release run at full counts passes, with its command and timing in the PR.
- **Verify with:**
  - `cargo test -p jiro-core --release --locked --test properties`
  - `JIRO_CASES=100000 cargo test -p jiro-core --release --locked --test properties`
  - `cargo run -p jiro-tools --release --locked -- difffuzz --seed 1 --cases 200 --out target/difffuzz`
- **Skills:** `parity-testing`, `deterministic-core`. **README:** §4, §6.3. **Needs user:** none.

#### M1.11 wasm engine and Node parity runner

- **Goal:** the browser build of the core, checked tick for tick against the vectors before any UI exists.
- **Deliverables:**
  - `web/wasm` (`jiro-wasm`): a cdylib with `#![cfg_attr(target_arch = "wasm32", no_std)]` and `#[cfg(target_arch = "wasm32")] #[panic_handler]`, so host builds of the workspace keep std (§3.3). It exports a raw `extern "C"` interface over one static Game and Recorder (P7), with no wasm-bindgen or wasm-pack:
    - `load_level`, `start`, `tick(raw_mask)`;
    - `grid_ptr`, entity getters, `state_hash`, `state_preimage`;
    - `journal_ptr` and `journal_len`;
    - `replay`, `validate_level`.

    `tick` goes through the Recorder, and there is no direct `step` export, so the single input path holds by construction. Builds use the `CARGO_HOME` path remap of ethblockdigger's [`build-wasm.sh`](https://github.com/detychey/ethblockdigger/blob/main/referee/build-wasm.sh).
  - `web/test/vectors.mjs`: plain Node, no dependencies. It replays every vector, reports the first differing tick, and prints the wasm state preimage at that tick for `replay --diff`.
  - The wasm-parity CI job, which prints the wasm size and sha256.
- **Done when:**
  - every vector matches tick for tick. Native x86_64 is 64-bit and wasm32 is 32-bit, so this catches `usize`-width bugs.
  - every malformed vector is rejected through `replay`;
  - two clean builds give the same sha256;
  - a corrupted trace byte makes the runner exit non-zero and name the tick (output in the PR);
  - with `jiro-wasm` in the workspace, host `cargo clippy --workspace --all-targets`, `cargo build --workspace` and `cargo test --workspace` pass.
- **Verify with:**
  - `cargo build -p jiro-wasm --release --locked --target wasm32-unknown-unknown && node web/test/vectors.mjs vectors/`
  - `cargo clippy --workspace --all-targets --locked -- -D warnings && cargo build --workspace --locked && cargo test --workspace --locked`
- **Skills:** `parity-testing`, `deterministic-core`. **README:** §3, §6.2, §9 M1. **Needs user:** none.

#### M1.16 zkVM trial: SP1

- **Goal:** SP1 measured against README §7.3's four tooling checks, plus cycles and price, with its code kept on a branch for M1.12. The trial fits one session.
- **Steps:**
  - install a pinned version, through the pinned installer or direct asset URLs (§1.3), and confirm the toolchain rustc version that M0.2 recorded;
  - write a thin guest that reads the level, the journal and the weight, calls `jiro_core::replay` and commits the Outcome. A test-only mode also commits the trace digest of the `game` vector schema.
  - run the executor on every vector, with cycle counts;
  - run a dev-mode or mock round trip in a test;
  - prove one small vector on the CPU, recording wall time and peak RAM;
  - try the onchain-verifiable wrapping step of one small vector, in the container and in an Actions job, recording peak RAM, whether it needs Docker, and the result;
  - find the verifier contract on Arbitrum One and Sepolia, and run the framework's own Foundry mock-verifier test. If `forge` is missing, run it in an Actions job with the foundry-toolchain action.
  - The guest's manifest carries the §3.3 profiles if the framework builds it on its own.
- **Deliverables:**
  - the framework's row in `docs/VERIFICATION.md`, creating the file if it does not exist:
    - version, install command and URLs fetched, the toolchain's rustc version;
    - each of the four checks as PASS or FAIL, with the command that showed it;
    - cycles per vector, CPU proving time and RAM, the wrapping result;
    - the hosted prover network: its public price (per cycle or per proof, with source and date), the chain and token it bills in, the minimum deposit, and the expected cost of one level proof and of one six-level run proof;
    - the kept branch.
  - the guest and host, pushed to the kept branch `zk-trial-sp1`, not merged. A push-triggered workflow on that branch may run the Actions steps.
- **Done when:**
  - the row is complete;
  - the executor reproduces every vector outcome and trace digest, or the failure is recorded;
  - the kept branch exists and is named in the row.
- **Verify with:** `grep -n 'zk-trial-sp1' docs/VERIFICATION.md`, plus the commands recorded in the row.
- **Skills:** `onchain-referee`, `parity-testing`, `deterministic-core`. **README:** §7.3. **Needs user:** none.

#### M1.17 zkVM trial: RISC Zero

- **Goal:** RISC Zero measured the same way as M1.16, in its own session.
- **Steps and deliverables:** those of M1.16, for RISC Zero: its row in `docs/VERIFICATION.md`, prover network included, and its guest and host on the kept branch `zk-trial-risc0`.
- **Done when:** the three conditions of M1.16 hold for RISC Zero.
- **Verify with:** `grep -n 'zk-trial-risc0' docs/VERIFICATION.md`, plus the commands recorded in the row.
- **Skills:** `onchain-referee`, `parity-testing`, `deterministic-core`. **README:** §7.3. **Needs user:** none.

#### M1.12 zkVM choice (D2, part 1)

- **Goal:** choose the zkVM by README §7.3's four tooling checks, then by measured cycles and price, and merge only the winner.
- **Deliverables:**
  - `referee/zk/`: the winner's guest and host, merged from its kept branch, as their own workspace. Its root manifest, and the guest's manifest if built separately, carry the §3.3 profiles. A nightly toolchain is allowed there only if the guest target needs build-std. Build for RV64IM if the winner supports it, otherwise for riscv32im, which README §7.3 allows.
  - The `zk` tier of `scripts/bootstrap.sh`, and its `TOOLING.md` row.
  - The zk-exec job in `ci.yml`, with a job-level path filter on `core/`, `referee/zk/` and `vectors/`. It runs the format vectors and 4 game vectors through the executor, compares outcomes and trace digests, and runs one dev-mode round trip. `nightly.yml` gains the full vector set.
  - `docs/VERIFICATION.md`: the comparison of the frameworks that pass, on cycles and price.
  - README §13 D2: the chosen framework (part 1).
  - The target line of the `deterministic-core` skill, updated to the chosen RISC-V width. Its `usize` rationale stays: native builds are 64-bit either way.

  **Exit:** if no framework passes the four checks, this PR records the FAIL rows and asks the user to choose: a third framework from the EF zkVM standards group (preferably one that targets RV64IM), a hosted prover, or Stylus only.
- **Done when:**
  - D2 part 1 reads Decided, citing both cycles and price;
  - the chosen executor reproduces every vector outcome and trace digest;
  - cycles are recorded per vector, including the full journal and `worst-case`, with the framework version and the commit sha;
  - this PR's zk-exec job is green;
  - `check-profiles.sh` passes with `referee/zk/` included.
- **Verify with:**
  - `bash scripts/bootstrap.sh zk && cargo run --release --manifest-path referee/zk/Cargo.toml -p zk-host -- execute vectors/`
  - `bash scripts/check-profiles.sh`
- **Skills:** `onchain-referee`, `parity-testing`, `deterministic-core`. **README:** §7.3, §13 D2. **Needs user:** approve the framework choice. If wrapping failed both in the container and on Actions, choose a route for real proofs: approve a prover network with a spend cap and set its credential (it bills on a mainnet chain, §1.3), or choose a public repository (larger runners), a machine of yours with Docker and 32 GB, or a settlement on the local node for M4 (§15, question 7). Round B3.

#### M1.13 Differential fuzzing across native, wasm and the zk executor

- **Goal:** random games agree across the native build, wasm and the zk executor.
- **Deliverables:**
  - `web/test/difffuzz.mjs`, and a `difffuzz` mode of the zk host, both reading M1.10's cases.
  - A mismatch writes its case under `target/difffuzz/` and exits non-zero; the PR that fixes it adds the case to `vectors/`.
  - Runs:
    - the difffuzz job in `ci.yml`: the 200 fixed cases through wasm, 20 of them also through the executor;
    - `nightly.yml`: a rotating seed, 10,000 wasm cases and 200 executor cases.
- **Done when:**
  - the fixed cases agree;
  - an injected mismatch exits non-zero and prints the case path (output in the PR);
  - this PR's `nightly.yml` run is green.

  With M1.9, M1.10 and M1.12, this closes README §9's M1, so this PR updates the status lines.
- **Verify with:** `cargo run -p jiro-tools --release --locked -- difffuzz --seed 1 --cases 200 --out target/difffuzz && node web/test/difffuzz.mjs target/difffuzz`
- **Skills:** `parity-testing`. **README:** §3, §9 M1. **Needs user:** none.

## 7. M2 Browser, levels and bots

| ID | Title | Depends on | Size | Needs user |
|---|---|---|---|---|
| M2.1 | Browser game shell | M1.11 | M | none |
| M2.2 | Per-PR preview deploy and browser smoke test | M2.1 | S | Cloudflare secrets (round A1); optional first play |
| M2.3 | Replay viewer | M2.1 | M | none |
| M2.4 | Level sources, level tool, levels table and L01 | M1.4 | M | Approve the README §5 amendment |
| M2.5 | Level editor | M2.1, M2.4 | M | none |
| M2.6 | Playtest bots, target curve and floor | M1.8, M2.4, M1.15 if built | M | Approve the target curve and the floor |
| M2.7 | Levels 1-8 | M2.6 | M | Approve the layouts |
| M2.8 | Levels 9-16 | M2.7 | M | Approve the layouts |
| M2.9 | Play test, calibration gate, weights, gate-set journals; level freeze | M1.10, M2.2, M2.8 | M | Play the 16 levels on the PR preview |
| M2.10 | Browser Training mode | M2.1, M2.3, M2.5, M2.9 | S | Optional check on the PR preview |

#### M2.1 Browser game shell

- **Goal:** a playable browser build on the single input path, with a tick clock that doesn't drift.
- **Deliverables:**
  - **Package.** `web/`: Vite and TypeScript, with vitest and ESLint, pinned versions and a lockfile. The stack (P8) is recorded in `web/README.md`.
  - **DirtyCells,** in `jiro-shell`: the diff of the core grid against a shadow grid. It is not consensus and never hashed, and it is exported through `jiro-wasm`.
  - **`web/src/core.ts`:** the typed loader.
  - **`web/src/loop.ts`:**
    - tick k is due at t0 + k × 66.667 ms on the `performance.now()` clock;
    - each due tick samples the keys once and calls `tick(mask)` once;
    - a late tick runs as soon as possible, so lateness doesn't accumulate against the duration-based commit deadline;
    - no tick is ever skipped or stepped twice.
  - **`web/src/input.ts`:** by default, the arrows for the joystick and the keys A, B and X for the device keys of the same names. A settings panel rebinds each control to any key (D8). The bindings are stored in localStorage, wrapped in try/catch so the page works without storage, and the defaults are documented in `web/README.md`. Input produces controls, never keys, so the journal doesn't depend on the bindings.
  - **`web/src/render.ts`:** a 240 × 240 logical canvas at an integer scale, with pixelated rendering, the §4.1 colors, dirty-cell redraw, and entities drawn on top.
  - **Screens:**
    - a HUD outside the field: claim %, lives, shield, ticks left;
    - an end screen showing the outcome and the final state hash prefix;
    - a journal download (`.jrn`);
    - a level picker: every `levels/*.bin` bundled at build time, the open-field level of `vectors/`, or a level file.
  - **The web CI job:** build the wasm, then `npm ci`, typecheck, lint, vitest, build.
- **Done when:**
  - with a fake clock and the key schedule of `open-field-capture`, a vitest produces that vector's journal bytes and final hash;
  - a fake-clock test with a simulated 500 ms stall shows that, once the loop runs again:
    - floor((t − t0) / 66.667) + 1 ticks have run by time t;
    - each tick ran exactly once, in order, with its own input sample;
  - a vitest rebinds every control to other keys and produces the same journal bytes for the same control sequence; a binding conflict (one key on two controls) is refused with a message;
  - a vitest plays a scripted run on the open-field level with `open-field-empty`'s nonce, writes its journal to `web/test/out/scripted.jrn` and its end-screen hash to `web/test/out/scripted.hash`, and native replay of that journal prints the same hash.
- **Verify with:**
  - `npm --prefix web ci && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web test && npm --prefix web run build`
  - `cargo run -p jiro-tools --locked -- replay --vector vectors/game/open-field-empty.json --journal web/test/out/scripted.jrn | grep -qF "$(cat web/test/out/scripted.hash)"`
- **Skills:** `deterministic-core`, `parity-testing`; tier `web`. **README:** §2, §4.1, §4.4, §6.1, §6.2, §11. **Needs user:** none.

#### M2.2 Per-PR preview deploy and browser smoke test

- **Goal:** every PR, and every merged build, can be played from its own URL, with no local toolchain.
- **Deliverables:**
  - `.github/workflows/pages.yml` (P9). On `pull_request` (paths `web/`, `core/`, `shell/`, `levels/`, `vectors/` and itself) and on pushes to `main`, it:
    1. builds the wasm and `web/`, and runs the smoke test;
    2. creates the Cloudflare Pages project `jiro-ikusu` if `wrangler pages project list` doesn't show it;
    3. deploys with wrangler, as ethblockdigger's [`deploy.yml`](https://github.com/detychey/ethblockdigger/blob/main/.github/workflows/deploy.yml) does: branch `pr-<number>` for a PR, production for `main`. Production is served at `https://jiro-ikusu.win`, the project's custom domain: each run adds the domain and its DNS record through the Cloudflare API if the project doesn't list it yet;
    4. prints the deployment URL between log markers, and posts it as a PR comment.

    Its concurrency cancels in-progress pull-request runs only; production deploys on `main` are never cancelled (§1.3).
  - `web/e2e/smoke.spec.ts`, a Playwright test:
    - opens the built site on the open-field level;
    - presses keys on a schedule;
    - reads the state hash exposed in a data attribute;
    - compares it with a vector.
  - A README link to the production site, `https://jiro-ikusu.win`.

  GitHub Pages is not used: it cannot serve one preview per PR, and it needs a paid plan for a private repository.
- **Done when:**
  - the smoke test is green in CI;
  - this PR's build is served at its own preview URL, which is in the PR;
  - the Pages project lists `jiro-ikusu.win` as an active custom domain.
- **Verify with:**
  - `get_job_logs` for this PR's `pages.yml` run, reading the URL between its markers;
  - `curl -s -o /dev/null -w '%{http_code}' <that URL>` prints 200;
  - the custom-domain check, printed between the log markers of the same run.
- **Skills:** none; tier `web`. **README:** §8.1. **Needs user:** the Cloudflare secrets as Actions repository secrets (round A1). Optional, not gating: play the open-field level on this PR's preview, and comment on feel, controls and rendering (round D1).

#### M2.3 Replay viewer

- **Goal:** watch and audit any journal. As in ethblockdigger's [`ReplayPage.tsx`](https://github.com/detychey/ethblockdigger/blob/main/src/ui/ReplayPage.tsx), the bytes are the match.
- **Deliverables:** `web/src/pages/replay.ts` and `web/test/replay.test.ts`:
  - load a level and a journal from a file, from hex, or from a vector;
  - play, pause, step, and scrub, which re-simulates from tick 0;
  - show the tick, the per-tick state hash, the held inputs, and the outcome computed by the core;
  - a trace-compare mode that marks the first tick differing from a vector's trace;
  - decoder errors shown by their code.

  Committed runs load from chain calldata in M5.3.
- **Done when:**
  - for every vector, the viewer model's final hash and outcome equal the vector's;
  - seeking to tick t gives the same hash as stepping to t;
  - a corrupted trace reports its first mismatch;
  - a malformed journal shows its error code.
- **Verify with:** `npm --prefix web test -- replay`
- **Skills:** `parity-testing`; tier `web`. **README:** §7.3, §10. **Needs user:** none.

#### M2.4 Level sources, level tool, levels table and L01

- **Goal:** a level authoring path an agent can drive and a reviewer can read in diffs, compiled by the core's single level codec.
- **Deliverables:**
  - `levels/src/NN-name.txt`, one per level:
    - a 60 × 60 ASCII field: `#` for obstacles, `.` for open cells, `m` for minion spawns;
    - a key=value header: boss body size, boss spawn rectangle, boss and minion periods, R, time limit, lives, target.
  - `jiro-tools level build|validate|id|render`.
  - `levels/NN-name.bin`, the canonical bytes; `level_id` = keccak256 of the file.
  - `levels/README.md`, generated: index, name, `level_id`, knobs, ASCII preview. The target and measured clear-rate columns are filled by M2.6 and M2.9.
  - The levels-drift CI job.
  - L01: `levels/src/01-open.txt`, with no obstacles, a default-size boss and a centered spawn rectangle, 0 minions and default rules.
  - README §5, amended (P10): the 16 levels are authored as ASCII sources or in the editor, and both produce the same level bytes.

  The `CLAUDE.md` sync table (M0.1) already covers `levels/src/`.
- **Done when:**
  - a rebuild leaves no drift;
  - each validity error is reported with its file and line;
  - render(build(src)) == src for every source;
  - L01 is valid, and its id in `levels/README.md` equals keccak256 of its `.bin` file.
- **Verify with:** `cargo run -p jiro-tools --locked -- level build levels/src levels && bash scripts/check-drift.sh levels/`
- **Skills:** `journal-codec`. **README:** §5. **Needs user:** approve the README §5 amendment (merge; round D2).

#### M2.5 Level editor

- **Goal:** README §5's browser editor, producing the same level bytes.
- **Deliverables:** `web/src/pages/editor.ts` and `web/test/editor.test.ts`:
  - paint obstacles;
  - set the boss body size and spawn rectangle, and up to 3 minion spawns;
  - edit the numeric fields;
  - validate live through `validate_level`, showing the error code and a message;
  - import and export `.bin` and hex;
  - show the `level_id`;
  - a Play button that opens the game on the edited level.

  The editor has no format of its own.
- **Done when:**
  - import then export is byte-identical for every `levels/*.bin`;
  - 20 random valid levels round-trip from model to bytes and back;
  - each validity violation shows its own message;
  - the `level_id` shown equals `jiro-tools level id`.
- **Verify with:** `npm --prefix web test -- editor`
- **Skills:** `journal-codec`; tier `web`. **README:** §5. **Needs user:** none.

#### M2.6 Playtest bots, target curve and floor

- **Goal:** scripted playtest bots that cannot score differently from the referee, the target clear-rate curve, and the claim floor the weights rely on.
- **Deliverables:**
  - `tools/src/bots/`, modeled on ethblockdigger's [`scripts/playtest.ts`](https://github.com/detychey/ethblockdigger/blob/main/scripts/playtest.ts) and its `src/sim/policies`. The policies:
    - EdgeNibbler: small cuts from the rail;
    - Greedy: the largest rectangle away from the boss and the minions;
    - Committer: banks the claim with X at 1 life or above a claim threshold;
    - RandomWalk: the baseline.
  - `jiro-tools playtest`:
    - bots emit one raw mask per tick through the core Recorder, and `replay()` scores them;
    - runs are deterministic per integer seed, parallel across seeds with `std::thread`;
    - `--only <range>` restricts the levels, for example `1-8`;
    - `--policy <name>` runs one policy instead of the reference mix;
    - `--check levels/targets.json` exits non-zero and names each level outside its band, or whose median effective claim is at or below the floor;
    - `--nonce <hex> --level-index <i>` plays one level of a given run, for M4.16.
  - **Effective claim:** a run's `claim_bp`, or 0 when its lives ran out, which is what it scores (D5). Every claim statistic of the reports and of M2.9 uses it.
  - `reports/playtest-<levels-hash>.{md,json}`: clear rate, median and quartile effective claim, death rate, ticks used, commit rate.
  - `levels/targets.json` (P11): a non-increasing target clear rate per level for a named reference policy mix, and the claim floor. The proposal goes from at least 90 % at level 1 to about 15 % at level 16, within ±5 percentage points over 1,000 seeds, with a floor of 500 bp. The reference mix's median effective claim must stay above the floor on every level, which M2.7 and M2.8 check.
- **Done when:**
  - two runs with the same seed produce byte-identical reports;
  - every bot journal decodes strictly and replays to its reported outcome;
  - 1,000 nonces on L01 finish in under 60 s in the container;
  - `--check` passes on L01, and fails on a deliberately out-of-band target, naming the level (output in the PR);
  - `levels/README.md` shows the targets.
- **Verify with:**
  - `cargo run -p jiro-tools --release --locked -- playtest --levels levels/ --runs 1000 --seed 1 --out target/pt1`, then again with `--out target/pt2`, then `diff -r target/pt1 target/pt2`.
  - `cargo run -p jiro-tools --release --locked -- playtest --levels levels/ --only 1 --runs 1000 --seed 1 --check levels/targets.json`
- **Skills:** `parity-testing`. **README:** §5, §8.4, §10. **Needs user:** approve the target curve and the floor (merge; round D3).

#### M2.7 Levels 1-8

- **Goal:** the first half of the difficulty ramp, with every level on target.
- **Deliverables:** `levels/src/01..08-*.txt` (01 is L01) and their `.bin` files; the regenerated `levels/README.md`; the playtest report. The ramp uses the §5 knobs:
  - the boss period goes from 3 down to 1, and the boss body size varies (a larger body reaches more of the trail);
  - minions go from 0 to 2, with slow periods first, then faster ones;
  - corridor-making obstacles start around level 5;
  - the time limit and the target vary late in the ramp.
- **Done when:**
  - all 8 levels are valid, with distinct ids;
  - each level's reference clear rate over 1,000 seeds is within its band, and its median effective claim is above the floor;
  - the drift gates are green.
- **Verify with:** `cargo run -p jiro-tools --release --locked -- playtest --levels levels/ --only 1-8 --runs 1000 --seed 1 --check levels/targets.json`
- **Skills:** `parity-testing`, `deterministic-core`. **README:** §5. **Needs user:** approve the layouts from the ASCII previews in `levels/README.md` and the bot numbers. The levels can also be played on this PR's preview, through the level picker. (Round D4.)

#### M2.8 Levels 9-16

- **Goal:** the second half of the ramp, on target, including the hardest corridor layouts and the 3-minion levels.
- **Deliverables:** `levels/src/09..16-*.txt` and their `.bin` files; the regenerated `levels/README.md`; the playtest report.
- **Done when:**
  - all 8 levels are valid, with distinct ids across all 16;
  - each level is within its band, with its median effective claim above the floor;
  - the drift gates are green.
- **Verify with:** `cargo run -p jiro-tools --release --locked -- playtest --levels levels/ --only 9-16 --runs 1000 --seed 1 --check levels/targets.json`
- **Skills:** `parity-testing`, `deterministic-core`. **README:** §5. **Needs user:** approve the layouts (round D5).

#### M2.9 Play test, calibration gate, weights, gate-set journals; level freeze

- **Goal:** README §9's M2 "bot clear rates on target", after the user has played all 16 levels; the calibration that seeds the testnet seasons' weights; the per-level journals of the M4 gas gate (§4); and the point where the levels freeze.
- **Deliverables:**
  - The user's play test of the 16 levels on this PR's preview. Fixes from it go into this PR and rerun the playtest. A fix too large for this PR becomes a new numbered M2 item that this PR then depends on. The agent copies the user's comment into `reports/playtest-human-1.md`.
  - `jiro-tools calibrate --check`: all policies × 16 levels × 1,000 seeds. It asserts every band, and fails on any weight that hits the floor or the u16 clamp, listing the levels concerned.
  - `seasons/calibration-1.json`, written only by `calibrate`: the `rulesVersion`, the 16 level ids in index order, 16 weights, P and the floor. Season files (M4.14, M5.5) reference it and own every other parameter.
    - The weights follow §8.4: the reference mix's median effective claim on each level is worth P points.
    - weight_bp = P × 10,000 / max(median_effective_claim_bp, floor). P is chosen so that no weight is clamped.
    - If no P keeps every weight unclamped, the formula switches to the mean effective claim, and README §8.4 records the change and the reason.
  - `vectors/levels/NN-worst.json` and `.trace`: each level's longest bot journal. `vectors/levels/NN-synthetic.json` and `.trace`: the `worst-case` scenario's policy (an event every tick, as many captures as it finds, never committing) applied to each level. Together they are the M4 gate set. Every target, the Stylus gas workflow and the zk executor replay them.
  - The measured clear rates, in `levels/README.md`.
  - `reports/calibration-1.md`.
  - `nightly.yml`: a `calibrate --check` drift step, on `schedule` only.

  **Freeze.** Merging this PR freezes the levels and `calibration-1.json`, which M3.5, M4.9, M4.14 and M5.5 use. After that, a level change or a `RULES_VERSION` bump follows the `CLAUDE.md` calibration rule, and its PR lists the measurements it invalidates.
- **Done when:**
  - (user) the user's play-test result is in a PR comment: one line per level, OK or what feels wrong;
  - `calibrate --check` exits 0, in under 15 minutes in the container;
  - `seasons/`, `levels/` and `vectors/` regenerate with no drift, and `check-rules-version.sh` passes;
  - median effective claim × weight is equal across levels within integer rounding, with no level at the floor or the clamp;
  - the 32 gate-set vectors exist.
- **Verify with:** `cargo run -p jiro-tools --release --locked -- calibrate --check --out seasons/calibration-1.json && bash scripts/check-drift.sh seasons/ levels/ vectors/ && ls vectors/levels/*-worst.json vectors/levels/*-synthetic.json | wc -l` prints 32.
- **Skills:** `parity-testing`. **README:** §5, §8.4, §9 M2. **Needs user:** play the 16 levels on this PR's preview, and comment on each level (round D6).

#### M2.10 Browser Training mode

- **Goal:** README §8.1 Training in the browser: all 16 levels, free, offline, with local scores.
- **Deliverables:** `web/src/pages/training.ts` and `web/test/training.test.ts`:
  - a level select for the 16 levels;
  - scores from the core's `level_score`, with the weights of `seasons/calibration-1.json`;
  - a local best per level in localStorage, wrapped in try/catch so the page works without storage;
  - a random training `runNonce` from `crypto.getRandomValues`, since §6.3 allows any value in training;
  - a journal download after each attempt;
  - links to the replay viewer and the editor;
  - no wallet and no network call.
- **Done when:**
  - all 16 levels start and finish, tested by driving 16 bot journals through the page logic;
  - the scores shown equal `level_score`;
  - the page works when localStorage throws.

  With M2.9, this closes README §9's M2, whose deliverables include the replay viewer (M2.3) and the editor (M2.5), so this PR updates the status lines.
- **Verify with:** `npm --prefix web test -- training && npm --prefix web run build`
- **Skills:** none; tier `web`. **README:** §8.1, §8.4, §9 M2. **Needs user:** none. Optional, not gating: play a few levels in Training on this PR's preview, and check the scores and local bests (round D7).

## 8. M3 Pico

Bring-up (M3.1) starts during M1; README §9 allows it to run in parallel at any time. The items below use Rust embassy-rp (D1). Only if M0.2's blinky fails does M0.2 rewrite them, for the fallback the owner then picks.

| ID | Title | Depends on | Size | Needs user |
|---|---|---|---|---|
| M3.1 | Firmware workspace, LCD and input bring-up | M0.2, M1.1 | M | Flash; check the display and 9 inputs |
| M3.2 | Link protocol and USB CDC transport | M3.1, M1.11 | M | none |
| M3.3 | Vector pack, vectors firmware, emulator parity | M3.2, M1.9, M1.10 | M | none |
| M3.6 | Device page "Run vectors" | M3.3, M2.1 | M | none |
| M3.7 | Hardware vector run | M3.6, M2.2 | S | Flash; run the vectors; paste the report |
| M3.4 | Device game loop and live mirror | M2.1, M2.2, M3.3, M3.6 | M | Play; report timing |
| M3.5 | Firmware Training mode with the 16 levels | M3.4, M2.9 | M | Play all 16 levels; post the PASS list |

#### M3.1 Firmware workspace, LCD and input bring-up

- **Goal:** the device shell builds in CI and drives the display and every input, before any gameplay depends on it.
- **Deliverables:** `firmware/`, its own Cargo workspace:
  - **The workspace root manifest,** with the §3.3 profiles and a release opt-level chosen for size.
  - **`firmware/.cargo/config.toml`:** `build.target = "thumbv6m-none-eabi"` and the linker settings, so builds from `firmware/` target the device.
  - **`firmware/drivers` (`jiro-firmware-drivers`):**
    - the ST7789VW command stream, the 4 × 4 cell blit, and the pin-to-mask table;
    - generic over the embedded-hal 1.0 traits, so host tests can record the SPI byte stream and drive the pins.
  - **`firmware/app` (`jiro-firmware`):**
    - embassy-rp, embassy-executor and embassy-time, pinned;
    - `memory.x` for 2 MB of flash and 264 KB of RAM;
    - no global allocator;
    - path dependencies on `../../core` and `../../shell`.
  - **Wiring, per README §2:**
    - SPI1 with CLK on GP10, DIN on GP11, CS on GP9, DC on GP8, RST on GP12 and BL on GP13, and the Waveshare reference init sequence;
    - inputs with pull-ups, active-low, mapped to the §6.1 mask per D8. Y and the joystick press are never read into the mask.
  - **`bringup` binary:** a blue border, a black interior, and one indicator per input, 9 in all.
  - **`scripts/check-fw-mem.sh`.** The float check stays on the probe (M0.4), which covers the core on `thumbv6m-none-eabi`; the firmware itself may use floats in rendering effects that never feed back into game state (`rp2040-firmware` skill).
  - **The firmware CI job,** with a job-level path filter: `apt-get install -y libudev-dev pkg-config` and elf2uf2-rs (or the converter M0.2 chose); a release build; `bringup.uf2` uploaded as an artifact with `retention-days: 90`; a `.text`/`.data`/`.bss` report.
- **Done when:**
  - CI produces the `bringup` UF2;
  - `.data` + `.bss` is printed and at most 64 KiB;
  - the map file has no `__rust_alloc` symbol;
  - host tests show that the init bytes equal the committed table, and that a one-cell change emits exactly one CASET/RASET/RAMWR window of 16 pixels;
  - a host test asserts the pin-to-mask table: GP2 → bit 0 (up), GP18 → bit 1 (down), GP16 → bit 2 (left), GP20 → bit 3 (right), GP15 → bit 4 (A), GP17 → bit 5 (B), GP19 → bit 6 (X), and GP21 (Y) and GP3 (press) are never read;
  - `check-profiles.sh` passes with `firmware/` included;
  - (user) on hardware, the border shows and all 9 indicators respond: a PASS comment with a photo.
- **Verify with:**
  - `cd firmware && cargo build --release --locked -p jiro-firmware --bin bringup && elf2uf2-rs target/thumbv6m-none-eabi/release/bringup bringup.uf2`
  - `cd firmware && cargo test --locked -p jiro-firmware-drivers --target x86_64-unknown-linux-gnu`
  - `bash scripts/check-fw-mem.sh firmware/target/thumbv6m-none-eabi/release/bringup && bash scripts/check-profiles.sh`
- **Skills:** `rp2040-firmware`; tier `firmware`. **README:** §2, §6.1. **Needs user:** flash `bringup.uf2` from this PR's CI run (hold BOOTSEL, plug in USB, copy the file), check the display and the 9 inputs, and comment PASS with a photo (round C1).

#### M3.2 Link protocol and USB CDC transport

- **Goal:** a single implementation of the USB link protocol, shared by the firmware and the web app.
- **Deliverables:**
  - `shell/src/link.rs`:
    - frames of u8 type, u16 big-endian length, payload and CRC-16;
    - down messages: LoadLevel (level bytes, `runNonce`, `levelIndex`, mode), Start;
    - up messages:
      - Hello (firmware version, `RULES_VERSION`). The firmware version is the crate version constant, never a git sha, so recorded transcripts stay stable.
      - Event (tick, mask), sent as it happens;
      - LevelEnd (outcome, final state hash, journal bytes);
      - Trace (tick, 32-byte state hash), in test builds only;
      - TickStats, every 15 ticks, carrying the current tick: the heartbeat M5.4 relies on;
      - Error;
    - strict decoding.
  - Link exports in `jiro-wasm`.
  - `firmware/app/src/usb.rs`: embassy-usb CDC-ACM. Emulator builds use UART0 instead.
  - `docs/LINK.md`: the protocol, versioned and not consensus.
  - A one-line pointer to `docs/LINK.md` in README §6.5.
- **Done when:**
  - round-trip tests pass;
  - truncated, oversized, bad-CRC and unknown-type frames are rejected, with a test each;
  - the firmware builds with USB enabled.
- **Verify with:**
  - `cargo test -p jiro-shell --locked`
  - `cd firmware && cargo build --release --locked -p jiro-firmware`
- **Skills:** `rp2040-firmware`, `journal-codec`; tier `firmware`. **README:** §6.5. **Needs user:** none.

#### M3.3 Vector pack, vectors firmware, emulator parity

- **Goal:** README §9's M3 done-when checked in an emulator in CI: the device build's traces match the native build.
- **Deliverables:**
  - **`jiro-tools pack`:** writes `vectors/pack.bin`, holding every vector's level, nonce, `levelIndex`, mode and journal. It is drift-checked. `pack --difffuzz target/difffuzz --out target/difffuzz-pack.bin` packs a small set of M1.10's cases, generated first, for the nightly run.
  - **The `vectors` firmware binary:**
    - embeds `pack.bin`;
    - replays every vector with the device's own core build;
    - streams Trace and LevelEnd frames;
    - paints the stack, to report its high-water mark.
  - **`firmware/emu/{package.json, package-lock.json, run.mjs}`:**
    - runs the firmware in rp2040js, pinned, under Node. The rp2040js npm package ships no loader and no bootrom, so `run.mjs` carries its own UF2 loader, which writes the UF2 blocks the firmware job produces into flash.
    - the bootrom comes from a `raw.githubusercontent.com` URL at a fixed commit (rp2040js's `demo/bootrom.ts`), or from a shallow clone of raspberrypi/pico-bootrom at a tag (the B1 image), checked against its sha256;
    - reads the UART frames and compares them with `vectors/**/*.trace`;
    - reports the first differing tick.
  - **`firmware/emu/transcripts/run-vectors-subset.bin`:** the recorded frame stream of the PR subset, for M3.6's mock serial port. The firmware-emu job regenerates it and checks it with `check-drift.sh`.
  - **The firmware job** converts the `vectors` binary to `vectors.uf2` and uploads it, on PRs and on pushes to `main`, with `retention-days: 90`.
  - **The firmware-emu CI job,** with a job-level path filter on `core/`, `shell/`, `firmware/` and `vectors/`, and a time budget: the format vectors and 4 game vectors on PRs. `nightly.yml` gains the full set and the packed difffuzz cases.

  If rp2040js cannot run embassy's clock or USB setup, the `vectors` binary uses a minimal rp2040-hal main over UART instead. The PR records which path works.
- **Done when:**
  - the emulator reports PASS for the PR subset in CI, and this PR's `nightly.yml` run is green;
  - a local emulator run passes the full set and the packed difffuzz cases, with its command, output and duration in the PR;
  - static RAM plus the stack high-water mark is at most 50 % of 264 KB;
  - the transcript regenerates with no drift;
  - CI uploads `vectors.uf2`;
  - the bootrom source and sha256 are recorded in `docs/TOOLING.md`.
- **Verify with:**
  - `cargo run -p jiro-tools --locked -- pack && bash scripts/check-drift.sh vectors/pack.bin`
  - `cd firmware && cargo build --release --locked -p jiro-firmware --bin vectors && elf2uf2-rs target/thumbv6m-none-eabi/release/vectors vectors.uf2 && node emu/run.mjs vectors.uf2 ../vectors`
  - `cargo run -p jiro-tools --release --locked -- difffuzz --seed 1 --cases 200 --out target/difffuzz && cargo run -p jiro-tools --locked -- pack --difffuzz target/difffuzz --out target/difffuzz-pack.bin`
- **Skills:** `rp2040-firmware`, `parity-testing`; tier `firmware`. **README:** §6.5, §9 M3. **Needs user:** none.

#### M3.6 Device page "Run vectors"

- **Goal:** a one-click hardware vector run in the browser, tested before anyone flashes a device.
- **Deliverables:**
  - `web/src/serial.ts`, a Web Serial wrapper over the M3.2 link exports.
  - `web/src/pages/device.ts`, with a "Run vectors" button. It:
    - connects over Web Serial;
    - compares the streamed hashes with the traces bundled into the site;
    - shows PASS or FAIL per vector, with the first differing tick;
    - builds a JSON report with the keys `firmwareVersion`, `rulesVersion`, `results` (per vector: `name`, `pass`, `firstDifferingTick`), `staticRam` and `stackHighWater`, offered for download and through a "Copy report" button, so the user can paste it into a PR comment.
  - `web/test/device.test.ts`: a mock SerialPort that replays M3.3's transcript.
- **Done when:**
  - the transcript produces PASS for every vector in it;
  - a corrupted transcript byte produces FAIL with its tick;
  - the copied report equals the downloaded one;
  - an unsupported-browser message shows outside desktop Chrome and Edge.
- **Verify with:** `npm --prefix web test -- device`
- **Skills:** `rp2040-firmware`, `parity-testing`; tier `web`. **README:** §6.5. **Needs user:** none.

#### M3.7 Hardware vector run

- **Goal:** README §9's M3 done-when on the real device.
- **Deliverables:**
  - a `ci.yml` run on `main` dispatched by the agent (`actions_run_trigger`, `workflow_dispatch`, so every step runs), and the direct link to that run's `vectors.uf2` artifact, posted in the PR;
  - `reports/device-<date>.json`: the report the user pastes, committed by the agent;
  - the status lines.
- **Done when:**
  - (user) the Device page report is pasted into a PR comment;
  - the committed report shows PASS for every vector;
  - static RAM plus the stack high-water mark in the report is at most 135,168 bytes, 50 % of the RP2040's 270,336.

  This closes README §9's M3.
- **Verify with:**
  - `jq -e 'all(.results[]; .pass)' reports/device-*.json`
  - `jq -e '.staticRam + .stackHighWater <= 135168' reports/device-*.json`
- **Skills:** `rp2040-firmware`. **README:** §9 M3. **Needs user:** flash `vectors.uf2` from the run linked in the PR, open the Device page of the preview in desktop Chrome or Edge, click "Run vectors", then "Copy report", and paste the JSON into a PR comment in a code block (round C2).

#### M3.4 Device game loop and live mirror

- **Goal:** the game playable on the Pico within the 66 ms tick budget, and mirrored live in the browser.
- **Deliverables:**
  - **`firmware/app/src/{tick,game,render}.rs`:**
    - an embassy Ticker every 66,667 µs, on an absolute schedule. A late tick is late; it is never skipped or stepped twice.
    - each tick:
      1. sample the inputs once;
      2. pass the mask to the core Recorder, which steps the game;
      3. redraw the cells reported by DirtyCells;
      4. draw the entities;
      5. stream Event frames, and a TickStats frame every 15 ticks.
    - a capture redraw that doesn't fit in one tick is spread across ticks;
    - step time and render time are measured separately, with the worst case and an overrun counter, in TickStats;
    - an end screen shows the claim and the state hash prefix;
    - it plays a level received by LoadLevel, or the embedded open-field level.
  - **`firmware/emu/inputs.mjs`:** drives GPIO levels on a schedule in rp2040js, and checks the journal bytes and the final hash against a scripted vector.
  - **Device page "Play" mode:**
    - sends LoadLevel and a nonce;
    - mirrors the board from the streamed events, with the wasm core;
    - at LevelEnd, checks the device's journal and hash against its own replay.
  - **The firmware job** uploads `jiro-firmware.uf2`, on PRs and on pushes to `main`, with `retention-days: 90`.
- **Done when:**
  - the emulator GPIO test passes;
  - CI uploads `jiro-firmware.uf2`;
  - (user) on hardware, a full level with captures shows 0 overruns and a worst tick under 50 ms, and the Device page reports a match: the user posts the three values;
  - the numbers are committed to `docs/LINK.md`.
- **Verify with:**
  - `cd firmware && cargo build --release --locked -p jiro-firmware && elf2uf2-rs target/thumbv6m-none-eabi/release/jiro-firmware jiro-firmware.uf2 && node emu/inputs.mjs jiro-firmware.uf2 ../vectors/game/open-field-capture.json`
  - `npm --prefix web test -- device`
- **Skills:** `rp2040-firmware`, `deterministic-core`; tiers `firmware`, `web`. **README:** §2, §4.4, §6.2, §6.5. **Needs user:** flash this PR's `jiro-firmware.uf2`, play a level with this PR's Device page open, and post the overrun counter, the worst tick time and whether it matched (round E1).

#### M3.5 Firmware Training mode with the 16 levels

- **Goal:** README §8.1 Training on the Pico: all 16 levels, offline.
- **Deliverables:**
  - `firmware/app/build.rs`: embeds `levels/*.bin` and the weights of `seasons/calibration-1.json`.
  - `menu.rs`: a level select outside play, driven by the joystick and A, never journaled.
  - `hud.rs` (P12): a between-level screen with claim, score and lives, plus a brief overlay at level start. See §15, question 11.
  - A training `runNonce` from ROSC entropy; scores kept in RAM.
  - `firmware/emu/training.mjs`: plays level 1 with scripted inputs up to the summary screen, and checks the score against native replay.
- **Done when:**
  - the UF2 is built in CI;
  - the emulator test passes;
  - static RAM stays within the M3.1 budget;
  - (user) on hardware, each of the 16 levels can be selected, and at least one was played to its end: the user posts the PASS list of the 16 levels.
- **Verify with:** `cd firmware && cargo build --release --locked -p jiro-firmware && elf2uf2-rs target/thumbv6m-none-eabi/release/jiro-firmware jiro-firmware.uf2 && node emu/training.mjs jiro-firmware.uf2`
- **Skills:** `rp2040-firmware`; tier `firmware`. **README:** §2, §8.1. **Needs user:** flash this PR's UF2, select each of the 16 levels, play at least one to its end, and post the PASS list, with any comment on HUD readability and overruns (round E2).

## 9. M4 Referee and contracts

M4.1 and M4.2 start once the gameplay vectors and the case generator land (M1.9, M1.10). M4.3-M4.7 start after M0. The zk proving pipeline (M4.8) starts with the zk choice (M1.12). All of them run in parallel with M2 and M3.

Commands below use Foundry. If M0.2 chose ethblockdigger's harness (P2), M0.2's PR rewrote these file names and commands. Settlement follows P16 (a) and journal publication P5 (a); as decided in M0.7.

| ID | Title | Depends on | Size | Needs user |
|---|---|---|---|---|
| M4.1 | Stylus referee crate, TestVM parity, size gate | M0.7, M1.9, M1.10 | M | none |
| M4.2 | Stylus gas on nitro-devnode (provisional) | M0.3, M4.1, M4.3 | M | none |
| M4.15 | Stylus gas optimization (only if M4.9's gate run fails while activations are open) | M4.2, M2.9 | M | none |
| M4.3 | Contracts project, ported base, ABIs, activation reading | M0.2, M0.3, M0.7 | M | none |
| M4.4 | IReferee, MockReferee and run-nonce fixtures | M4.3, M1.2 | S | none |
| M4.5 | Season contract with onchain best-run points | M4.3, M4.4 | M | none |
| M4.6 | Challenge: pay, reveal, commit | M4.4, M4.5 | M | none |
| M4.7 | Settlement, run file, deadline fixtures, invariant suite | M4.6, M1.9 | L | none |
| M4.8 | zk proving pipeline and costs | M1.12, M4.3 | M | A prover credential, only if proving fails here and on Actions |
| M4.9 | D2, part 2: gas gate, 16-level costs, verification backend | M2.9, M4.2, M4.7, M4.8, M4.15 if filed | S | Approve D2 |
| M4.11 | Deploy tooling and local chain | M2.8, M4.1, M4.7 | M | none |
| M4.16 | End-to-end suite on nitro-devnode | M4.2, M4.11 | M | none |
| M4.10 | ZkReferee adapter (if activations are paused, or D2 = zk) | M4.7, M4.8, M4.16; M4.9 if activations are open | M | none, if round F0 has run when M4.8 asked |
| M4.12 | Economy document and contract review | M0.3, M4.7, M4.9, M4.10 if D2 = zk | S | Accept the residual risks |
| M4.13 | Bot-advantage study (optional) | M2.9 | M | none |
| M4.14 | Arbitrum Sepolia deployment and first settled run | M4.9, M4.11, M4.12, M4.16, M4.10 if D2 = zk, M4.17+ | M | Keys, funding, approval |

#### M4.1 Stylus referee crate, TestVM parity, size gate

- **Goal:** the core as a reproducible Stylus contract that fits within Arbitrum's size limit. The TestVM runs the contract natively, so it checks the contract code, not the wasm build; M4.2 checks the wasm build.
- **Deliverables:**
  - `referee/stylus` (`jiro-referee-stylus`), with stylus-sdk 0.10.8 pinned as in ethblockdigger:
    - implements the `verifyRun`, `verify` and `rulesVersion` of README §7.3; `verifyRun` replays its six levels in order;
    - any rejection, and any non-empty proof, reverts with `Error(string)` and a reason code;
    - the verify path computes no per-tick state hash.
  - `referee/build-wasm.sh`, adapted from ethblockdigger's [`build-wasm.sh`](https://github.com/detychey/ethblockdigger/blob/main/referee/build-wasm.sh):
    - checks the rustc pin;
    - builds with `--profile stylus`;
    - runs `binaryen@120.0.0` `wasm-opt -Oz`;
    - remaps the `CARGO_HOME` path;
    - enforces the 24 KB brotli and 128 KB raw limits;
    - prints the sha256.
  - `referee/stylus/tests/verify_native.rs`, using the stylus-test TestVM as ethblockdigger's [`verify_native.rs`](https://github.com/detychey/ethblockdigger/blob/main/referee/stylus/tests/verify_native.rs) does. It replays every vector and M1.10's 200 fixed difffuzz cases, and fails, rather than skipping, when `target/difffuzz` is missing.
  - The stylus CI job, which generates the fixed cases before the test.
- **Done when:**
  - the TestVM reproduces every vector outcome and every fixed case, and rejects every malformed vector with its reason;
  - `verifyRun` on six game vectors returns their six outcomes;
  - the brotli size is printed and under 24 KB, and the raw size is under 128 KB;
  - two clean builds print the same sha256.
- **Verify with:**
  - `cargo run -p jiro-tools --release --locked -- difffuzz --seed 1 --cases 200 --out target/difffuzz && cargo test -p jiro-referee-stylus --locked`
  - `bash referee/build-wasm.sh`, run twice, comparing the sha256 lines.
- **Skills:** `onchain-referee`, `deterministic-core`; tier `contracts`. **README:** §7.3, §10. **Needs user:** none.

#### M4.2 Stylus gas on nitro-devnode (provisional)

- **Goal:** the first Stylus gas numbers, measured on the deployed wasm, early enough that the core's data layout is still cheap to change, and a check that the wasm build agrees with native. This is a report, not the gate: the gate set (§4) exists only from M2.9, and M4.9 measures it.
- **Deliverables:**
  - `scripts/contracts/nitro/run-dev-node.sh`, vendored from OffchainLabs/nitro-devnode at a fixed commit sha, fetched from `raw.githubusercontent.com`, with `NITRO_NODE_VERSION` set explicitly. Both pins are recorded in `docs/TOOLING.md` (§3.2).
  - `.github/workflows/stylus-gas.yml`, following §1.3: `pull_request` on `core/`, `referee/`, `vectors/`, `scripts/contracts/stylus-gas.mjs` and itself (or the `ci:heavy` label), plus `workflow_dispatch`. It:
    1. installs Foundry with a pinned `foundry-rs/foundry-toolchain` step, since the dev-node script calls `cast`;
    2. starts nitro-devnode in Docker on the runner, with the vendored script;
    3. installs cargo-stylus 0.10.10, cached;
    4. builds with `referee/build-wasm.sh`;
    5. deploys and activates the referee with nitro-devnode's public development key;
    6. generates M1.10's 200 fixed difffuzz cases;
    7. runs `scripts/contracts/stylus-gas.mjs`.
  - `scripts/contracts/stylus-gas.mjs`, in the Node package of M4.3, using ethers v6:
    - runs `eth_estimateGas` of `verify` for each vector, and checks the returned outcome against the vector;
    - runs `eth_call` of `verify` on each fixed difffuzz case, and compares the outcome with native's;
    - prints the gas table between log markers, and also writes it to the job summary.
  - The Stylus section of `docs/VERIFICATION.md`: the table, marked provisional, the commit sha and the run link.

  In the public profile, this workflow checks the deployed wasm build against native on every PR that touches the core or the referee; in the private profile, on labeled runs. The secondary route runs the same script in the container, if M0.2 found a working `dockerd`.
- **Done when:**
  - this PR's `stylus-gas.yml` run records gas for every vector, including the full journal and `worst-case`;
  - the outcomes returned onchain equal native on every vector and every fixed case;
  - the PR states whether any provisional number exceeds 1M. That is a warning, not a gate result: this item never marks M4.15.
- **Verify with:**
  - `get_job_logs` for this PR's `stylus-gas.yml` run, reading the table between its markers;
  - with local Docker: `node scripts/contracts/stylus-gas.mjs --rpc http://127.0.0.1:8547 vectors/ target/difffuzz`
- **Skills:** `onchain-referee`, `gas`, `l2s`; tier `contracts`. **README:** §7.3, §9 M4. **Needs user:** none.

#### M4.15 Stylus gas optimization (only if M4.9's gate run fails while activations are open)

- **Goal:** bring the gate set (§4) within 1M gas without changing any outcome.
- **When.** M4.9 files this item when its gate run fails and activations are open, and fills in the hot paths and levers it measured: an incremental rail bitmap; no full-grid scan per tick; keccak once per level; no per-tick hashing in `verify`. If the gate fails while activations are paused, M4.9 marks this item "deferred" (§16).
- **Deliverables:** changes to the core's hot paths named by M4.9; a re-measurement in `docs/VERIFICATION.md`.
- **Done when:**
  - `bash scripts/check-rules-version.sh --reverse` passes: no vector changed and no version bumped;
  - every `ci.yml` parity job that exists on `main` is green;
  - this PR's `stylus-gas.yml` run, over the gate set, shows the maximum at or below 1M.
- **Verify with:** `cargo run -p jiro-tools --release --locked -- vectors && bash scripts/check-drift.sh vectors/ && bash scripts/check-rules-version.sh --reverse`, and `get_job_logs` for this PR's `stylus-gas.yml` run.
- **Skills:** `deterministic-core`, `onchain-referee`, `gas`. **README:** §7.3. **Needs user:** none.

#### M4.3 Contracts project, ported base, ABIs and activation reading

- **Goal:** one contract toolchain, with ethblockdigger's entropy base ported verbatim, generated ABIs for the web app, and an early reading of the Stylus activation status.
- **Deliverables:**
  - `contracts/`, on the toolchain M0.2 chose (P2). It uses one harness or the other, never both:
    - Foundry: `foundry.toml` pinning solc 0.8.28, ethblockdigger's `evmVersion` and OpenZeppelin v5;
    - or, if `forge` failed the probe, ethblockdigger's solc-npm + ethereumjs + vitest harness (`scripts/contracts/compile.ts`, `evm.ts`, `contracts/test/helpers.ts`) for every contract test, zk verifier tests included.
  - `scripts/contracts/package.json`: a Node package with ethers v6, for the deploy, gas, activation and season scripts.
  - Files ported verbatim, each with a provenance header naming the ethblockdigger commit sha:
    - [`ArbBlockhashEntropy.sol`](https://github.com/detychey/ethblockdigger/blob/main/contracts/src/ArbBlockhashEntropy.sol), which takes ArbSys as a constructor argument;
    - `interfaces/IEntropySource.sol`, `interfaces/IArbSys.sol`;
    - the mocks `MockArbSys` (settable block number) and `MockEntropy`. ethblockdigger's `MockUSDC` is not needed: runs are paid in ETH (D12).
  - Entropy tests, ported from [`entropy.test.ts`](https://github.com/detychey/ethblockdigger/blob/main/contracts/test/entropy.test.ts).
  - `contracts/abi/`: the ABI of every contract, written by the contracts job and checked with `check-drift.sh`, so the web app never needs the contract toolchain.
  - `scripts/contracts/activation.mjs`: reads `ArbWasm.activationGas()` from the precompile at `0x0000000000000000000000000000000000000071`. Activations count as open at or below cargo-stylus's 30,000,000 threshold, as ethblockdigger's [`checks.ts`](https://github.com/detychey/ethblockdigger/blob/main/scripts/contracts/checks.ts) checks. M4.9, M4.10 and M4.16 reuse it.
  - The first activation readings on Arbitrum Sepolia and Arbitrum One, with block number and date, in `docs/VERIFICATION.md` (created if it does not exist yet).
  - The contracts CI job.
- **Done when:**
  - the entropy tests cover commit, not ready, window lapse, re-anchor, and namespacing by sender;
  - CI is green, with no ABI drift;
  - the ported files differ from ethblockdigger's only in the provenance header, with the diff shown in the PR;
  - the activation readings are recorded.
- **Verify with:**
  - `cd contracts && forge build && forge test -vv`
  - for each ported file: `diff` against `../ethblockdigger/contracts/src/`, after stripping the provenance header.
  - `bash scripts/check-drift.sh contracts/abi/`
  - `node scripts/contracts/activation.mjs --rpc https://sepolia-rollup.arbitrum.io/rpc` and `--rpc https://arb1.arbitrum.io/rpc`
- **Skills:** `onchain-referee`, `ship`, `testing`, `security`; tier `contracts`. **README:** §7.2, §7.3, §10. **Needs user:** none.

#### M4.4 IReferee, MockReferee and run-nonce fixtures

- **Goal:** the contract side of the frozen interfaces, pinned by the shared fixtures.
- **Deliverables:**
  - `contracts/src/interfaces/IReferee.sol`: the README §7.3 `verifyRun`, `verify`, `rulesVersion` and `Outcome`, `drawSlot` included.
  - `contracts/src/mocks/MockReferee.sol`: returns configurable outcomes and rules version. It is adapted from ethblockdigger's [`MockReferee.sol`](https://github.com/detychey/ethblockdigger/blob/main/contracts/src/mocks/MockReferee.sol).
  - Run-nonce entries ("jiro.run") in `vectors/derivations.json`, computed by ethers only, through `tools/xcheck/derivations.mjs`. The core never computes a run nonce.
  - Tests that read `vectors/derivations.json`: the Solidity run nonce and run commitment.
- **Done when:**
  - the Solidity run nonce and run commitment equal every fixture;
  - the fixture file regenerates with no drift;
  - the MockReferee tests pass.
- **Verify with:**
  - `cd contracts && forge test --match-contract 'RunNonce|MockReferee' -vv`
  - `node tools/xcheck/derivations.mjs --write && bash scripts/check-drift.sh vectors/derivations.json`
- **Skills:** `onchain-referee`, `journal-codec`; tier `contracts`. **README:** §6.4, §7.3. **Needs user:** none.

#### M4.5 Season contract with onchain best-run points

- **Goal:** ethblockdigger's `Season`, with points accrued onchain instead of posted by an oracle as a Merkle root, the referee bound to each season, and the sequencing of README §8.4.
- **Deliverables:**
  - `contracts/src/Season.sol`, adapted from ethblockdigger's [`Season.sol`](https://github.com/detychey/ethblockdigger/blob/main/contracts/src/Season.sol). It keeps the rake cap at 2,000 bps, the rollover of seasons with no qualified points, pro-rata claims, and dust kept in escrow.
    - The constructor takes the immutable `treasury` and the operator. `bindChallenge(challenge)`, operator only, sets `Challenge` once. `closeSeason` credits the rake to the treasury, and `withdrawRake()`, callable by anyone, zeroes the credit before sending it there.
    - `open(params)`, restricted to the operator, commits the parameters of README §8.4, `referee` included, which are immutable afterwards. It starts the season at `block.timestamp` and records the referee's codehash. It reverts unless `referee.rulesVersion()` equals `params.rulesVersion`, unless the previous season has ended, and on any parameter outside its README §8.4 range, duplicate level ids included.
    - `slotOf(levelId)` and `weightOf(levelId)` serve settlement's lookups.
    - `Season` holds all the ETH (README §8.4). `payFee(season)`, payable and callable only by `Challenge`, reverts unless `season` is the season accepting runs and `msg.value` equals its `runFee` exactly (D12), then adds the fee to that season's pot. `currentSeason()` returns the number of the last season opened. `isSolvent()` checks the README §8.4 invariant.
    - `recordRun(season, player, runId, uint32 score, uint32 ticks, uint8 clears)`, callable only by `Challenge`, reverting once the season is closed:
      - keeps each player's best run by qualification (`clears ≥ minClears`), then score, then fewer ticks (D10);
      - maintains `totalQualifiedPoints` incrementally.
    - `closeSeason` is permissionless after the season end plus the grace period, and closes seasons in order. It credits the rake to the treasury. The players' pot of a season with no qualified points becomes the pending rollover, which the next season to close absorbs without raking it. It sends no ETH.
    - `claim` pays bestScore × playersPot / totalQualifiedPoints, rounded down.
  - `contracts/test/Season.t.sol`.
- **Done when** tests cover:
  - Points:
    - a better run replacing a worse one;
    - a tie going to fewer ticks;
    - a higher-scoring run that clears too few levels never replacing a qualifying one;
    - a player with no qualifying run earning no share, with `minClears` at 1 and at 2.
  - Season lifecycle:
    - parameters immutable after open;
    - `open` with a referee of another rules version reverting;
    - `open(s + 1)` before `end(s)` reverting, and succeeding after it;
    - each parameter outside its range reverting, a rake above 2,000 bp and a duplicate level id included;
    - `payFee` and `recordRun` from any address other than `Challenge` reverting; `payFee` with no open season, with a `season` other than the one accepting runs, and with a `msg.value` below or above the fee reverting; and `recordRun` after the close reverting;
    - a close before end plus grace reverting, and any address able to close after it;
    - the rake credited to the treasury at close and sent by `withdrawRake()`, a second withdrawal sending nothing, and a treasury that rejects ETH leaving close and claims working;
    - a claim re-entered from a receiving contract paying nothing more;
    - the pot of a season with no qualified points, including one whose only qualified players scored 0, reaching the next season to close, unraked, and seasons closing only in order.
  - Claims:
    - a double claim reverting;
    - claims rounding down, with the dust kept.
- **Verify with:** `cd contracts && forge test --match-contract Season -vv`
- **Skills:** `onchain-referee`, `security`, `testing`; tier `contracts`. **README:** §8.2, §8.4, §10. **Needs user:** none.

#### M4.6 Challenge: pay, reveal, commit

- **Goal:** the keyless pay, reveal and commit flow of ethblockdigger's `Vault`, for Challenge runs, with the journals published at commit (P5).
- **Deliverables:**
  - `contracts/src/Challenge.sol`, modeled on [`Vault.sol`](https://github.com/detychey/ethblockdigger/blob/main/contracts/src/Vault.sol). Unlike `Vault`, it holds no referee of its own; the run's season names it.
    - `startRun(season)` is `payable`. It forwards `season` and `msg.value` to `Season.payFee(season)` (M4.5), which reverts unless `season` is the season accepting runs and `msg.value` equals its run fee (D12). It then records the run's player and season, and commits entropy, with the id namespaced as in `Vault`. `Challenge` holds no ETH.
    - `revealRun(runId)`, player only, derives the `runNonce` per README §6.4 and records `revealedAt`.
    - A lapsed reveal window forfeits the run, and the fee stays in the pot. There is no free re-anchor, which would re-roll the levels.
    - `commitRun(runId, bytes[6] journals)`, player only, can be called once. It computes the run commitment from the journals (README §6.4), stores it, and records `committedAt`. It reverts after `revealedAt + 1,080 + commitSlack` (README §7.2). It never parses the journals, which are there to publish them as calldata.
    - Every step emits an event, and `RunRevealed` carries the run nonce.
  - `contracts/test/Challenge.t.sol`.
  - The gas of `startRun`, `revealRun`, and `commitRun` with a typical six-journal blob and with a full one (6 × 8,171 bytes), in the matching TBD cells of `docs/ECONOMY.md`.
- **Done when:**
  - each revert has its own test: no open season, a `season` other than the one accepting runs, a `msg.value` below or above the fee, reveal by another address, commit by another address, reveal before ready, double reveal, lapsed window, commit before reveal, double commit, commit after `revealedAt + 1,080 + commitSlack`;
  - the stored commitment equals the run commitment of the journals passed;
  - events carry the expected arguments;
  - `Season.isSolvent()` holds after every operation in the tests;
  - the commit gas is recorded.
- **Verify with:** `cd contracts && forge test --match-contract Challenge -vv --gas-report`
- **Skills:** `onchain-referee`, `security`, `standards`; tier `contracts`. **README:** §6.4, §7.2, §8.2, §8.4, §10. **Needs user:** none.

#### M4.7 Settlement, run file, deadline fixtures and invariant suite

- **Goal:** settlement bound to its run and its season's referee, with the duration-based deadline, and solvency under random use.
- **Deliverables:**
  - In `Challenge.sol`, one internal check path used by two entry points:
    - `settleRun(runId, levels[6], journals[6], proof)`, the main path (P16):
      1. check that the run is committed and not settled, and that `block.timestamp ≤ end + grace` for its season;
      2. check that keccak256(concat(keccak256(journal_i))) == the commitment;
      3. for each level, take the slot and weight from the run's season by `levelId_i = keccak256(levels[i])`, reverting if the level is not in the season;
      4. call `verifyRun(levels, journals, weights, proof)` on the referee of the run's season;
      5. check each returned Outcome: `journalHash`, `runNonce`, `levelIndex` == i, `mode` == 1, `rulesVersion` == the season's, `levelId` == `levelId_i`, and `drawSlot` == the season's slot of `levelId_i` (P17);
      6. store each level's score, ticks used and whether its `endReason` is Cleared, which give the run's score, ticks and clears (README §7.2).
    - `settleLevel(runId, i, journalHashes[6], level, journal, proof)`, the fallback: the same checks for one level through `verify`, with the commitment checked against `journalHashes` on every call. `settleRun` stays available after a partial `settleLevel` (README §7.2).
  - Once all six levels are settled, `Challenge`:
    - checks committedAt ≤ revealedAt + ceil(Σ ticks / 15) + commitSlack;
    - then calls `Season.recordRun`. A late run is marked late and earns nothing.
  - Settlement rules:
    - it stays open until the season end plus grace;
    - anyone may submit;
    - the credit goes to the run's player.
  - **Deadline fixtures:** cases added to `vectors/derivations.json` through `tools/xcheck`: revealedAt, the six ticksUsed, commitSlack, committedAt, and the expected accept or reject, with cases on both sides of each ceil-division boundary. `Settlement.t.sol` reads them, and M5.2 reuses them.
  - **Run file v1,** in `docs/VERIFICATION.md`: a JSON file with the format version, chainId, `Challenge` address, runId, runNonce, the six level bytes or level ids, the six drawn slots and the six journals in hex. M4.10, M5.2 and M5.5 use it.
  - `contracts/test/{Settlement,Invariant}.t.sol`.
  - Settlement gas excluding `verifyRun`, recorded in `docs/VERIFICATION.md`.
- **Done when:**
  - each `settleRun` rejection has its own test: wrong commitment, a journal not matching it, foreign nonce, wrong `levelIndex`, a level not in the season, a `drawSlot` naming another level, wrong `rulesVersion`, training-mode journal, double settle, settle before commit, settle after the grace period;
  - a late commit is marked late, earns nothing and cannot be settled again, without a revert;
  - the run's score, ticks and clears reach `Season.recordRun`, on both paths;
  - a happy path settles a run through `settleRun`, another through six `settleLevel` calls, and a third through `settleRun` after two `settleLevel` calls, with MockReferee returning real vector outcomes;
  - a run of season s settles through season s's referee during s's grace period, after season s + 1 has opened with a different referee and rules version;
  - every deadline fixture gives its expected result;
  - an invariant suite over `Challenge` and `Season` keeps `isSolvent()` true and Σ claims ≤ the players' pot. It runs random start, reveal, commit, settle, close, claim and rake-withdrawal sequences: at least 256 runs × depth 50 on Foundry, or 20 seeded sequences of 50 steps each on the harness.
- **Verify with:**
  - `cd contracts && forge test --match-contract 'Settlement|Invariant' -vv --gas-report`
  - `node tools/xcheck/derivations.mjs --write && bash scripts/check-drift.sh vectors/derivations.json`
- **Skills:** `onchain-referee`, `journal-codec`, `security`, `testing`; tier `contracts`. **README:** §6.4, §7.2, §7.3, §8.2. **Needs user:** none.

#### M4.8 zk proving pipeline and costs

- **Goal:** real proofs and their costs, so that README §9's M4 gate can be met with the zk backend, without waiting for the frozen levels: the pipeline only needs valid levels.
- **Deliverables:**
  - a run mode in the guest (P16 a): six levels, journals and weights in, alongside the level mode of M1.12. Both modes commit keccak256 of each level and journal, each weight and each Outcome (README §7.3), in a byte encoding this item fixes in `referee/zk/README.md`;
  - a `prove` subcommand in the zk host, for both modes;
  - `.github/workflows/zk-prove.yml`: `pull_request` on itself and on the host's prove module (or the `ci:heavy` label), so this PR runs it, and `workflow_dispatch` afterwards, with a 6 h job limit. It:
    - proves the `worst-case` vector in level mode, and a run of six game vectors in run mode;
    - runs the onchain-verifiable wrapping step;
    - prints the proof fixture in hex, wall time, peak RAM and proof size between log markers.
  - the same proofs attempted in the container (4 CPUs, 15 GB), recording which environment succeeded;
  - the proof fixture, committed from the log, and a contract test that verifies it against the framework's verifier contract, with its gas;
  - the network-proving price, from the framework's public pricing, per level proof and per run proof;
  - season aggregation: the cost of one aggregated proof against N run proofs, measured with the framework's aggregation tooling if it runs here, otherwise taken from its documentation with the source;

  All of it goes into the zk costs section of `docs/VERIFICATION.md`, and fills the matching TBD cells of `ECONOMY.md`. If neither the container nor the runner can prove and wrap within limits, the item records the failure and the hosted-prover route with its price, and asks for the prover-network credential and its spend cap: in round F0, unless round B3 already set them.
- **Done when:**
  - a real proof verifies in a contract test with its gas reported, or the failure is recorded along with the hosted-prover alternative and its price, and round F0 is requested in the PR;
  - CPU proving time and peak RAM are recorded for each environment tried, for both modes;
  - the aggregation option is recorded with its source.
- **Verify with:**
  - `cargo run --release --manifest-path referee/zk/Cargo.toml -p zk-host -- prove --level vectors/game/worst-case.json`
  - `get_job_logs` for this PR's `zk-prove.yml` run, reading between its markers;
  - `cd contracts && forge test --match-contract ZkVerify --gas-report`
- **Skills:** `onchain-referee`; tiers `zk`, `contracts`. **README:** §7.3. **Needs user:** only if proving and wrapping are impractical here and on Actions: a prover-network account, its credential and a spend cap (round F0, or B3 if already done).

#### M4.9 D2, part 2: gas gate, 16-level costs and verification backend

- **Goal:** measure the M4 gas gate (§4) and the zk cycles on the frozen levels, and decide the testnet verification backend from the activation status and the numbers.
- **Deliverables:**
  - executor cycles for the 32 gate-set vectors of `vectors/levels/`: max and median per level, and per six-level run;
  - the gate run: a `stylus-gas.yml` run over the gate set, dispatched on this branch (the workflow is on `main` since M4.2);
  - fresh `activation.mjs` readings on Arbitrum Sepolia and Arbitrum One, with block number and date;
  - the final table of `docs/VERIFICATION.md`: gas per level, cycles, proving cost per run, settlement overhead (M4.7), and the aggregation option (M4.8);
  - README §7.3 and §13 D2, including whether testnet-1 aggregates proofs;
  - this plan: M4.10 marked "not built (D2 = Stylus)" if Stylus is chosen and M4.10 has not started; M4.15 marked "not built", "deferred" or filed.

  **The rule.** Stylus whenever activations are open on the target chain (README §7.3, point 4), and ZkReferee while they stay paused.
  - If the gate passes, M4.15 is marked "not built".
  - If it fails while activations are open, this PR files M4.15 with the hot paths it measured, waits for it to merge, and runs the gate again. If it still fails, the PR shows both cost tables and the user chooses the backend.
  - If it fails while activations are paused, the PR records the failure, marks M4.15 "deferred" (§16), and D2 = zk meets the M4 gate through the measured zk costs.

  The PR names the backend that M4.14 deploys, and records that switching backends later means opening a new season with the other referee (M0.7).
- **Done when:**
  - D2 reads Decided, with the numbers and the activation readings;
  - the gate result is stated: the maximum gas over the gate set and the level it comes from, pass or fail;
  - cycles cover all 16 levels;
  - M4.15 is marked or filed.
- **Verify with:**
  - `cargo run --release --manifest-path referee/zk/Cargo.toml -p zk-host -- execute vectors/levels/`
  - `actions_run_trigger` on `stylus-gas.yml` with `ref` = this branch, then `get_job_logs`
  - `node scripts/contracts/activation.mjs --rpc https://sepolia-rollup.arbitrum.io/rpc` and `--rpc https://arb1.arbitrum.io/rpc`
- **Skills:** `onchain-referee`, `gas`, `l2s`, `ship`; tier `zk`. **README:** §7.3, §9 M4, §13 D2. **Needs user:** approve D2, or choose the backend if the gate failed with activations open (round F1).

#### M4.11 Deploy tooling and local chain

- **Goal:** a scripted deployment and a local chain for the dApp work.
- **Deliverables:**
  - `scripts/contracts/deploy.mjs`, adapted from ethblockdigger's `scripts/contracts/deploy.ts` without its MockUSDC: `ArbBlockhashEntropy`, the referee (Stylus through cargo-stylus, or MockReferee on the local chain; M4.10 adds ZkReferee), `Season` with the treasury, `Challenge`.
  - `scripts/contracts/localnet.mjs`, the local chain for M5:
    - starts anvil, or the Hardhat node from npm if Foundry did not install (ethblockdigger rehearsed on a local Hardhat chain);
    - deploys MockArbSys, `ArbBlockhashEntropy` with MockArbSys as its constructor argument, MockReferee configured with vector outcomes, `Season` with a season of the 16 level ids, and `Challenge`;
    - advances the reveal with `MockArbSys.setBlockNumber`;
    - writes `deployments/local.json`, naming the backend.
  - `deployments/README.md`: the schema of `deployments/<network>.json`, which keeps a list of contract generations, newest first, so earlier addresses are never overwritten.
- **Done when:**
  - `localnet.mjs --check` runs the happy path against MockReferee: start, reveal, commit with the journals, `settleRun`;
  - `deploy.mjs` deploys the full set on the local chain and writes a record that matches the schema.
- **Verify with:** `node scripts/contracts/localnet.mjs --check`
- **Skills:** `onchain-referee`, `ship`, `testing`; tier `contracts`. **README:** §7.2, §10. **Needs user:** none.

#### M4.16 End-to-end suite on nitro-devnode

- **Goal:** an end-to-end run against the real Stylus referee on a local Arbitrum node, and the preflight that guards every deployment.
- **Deliverables:**
  - `scripts/contracts/preflight.mjs`, adapted from ethblockdigger's `preflight.ts`, checking:
    - the chain id: 421614 or a local node only;
    - the balances, and that the deployer is not the tester;
    - the cargo-stylus version and the activation status (`activation.mjs`, M4.3);
    - a clean `referee/` tree;
    - with `--check-solvent`, `isSolvent()` on a deployment.
  - `scripts/contracts/preflight.test.mjs`: the chain-id and deployer checks, against stubbed providers.
  - An `advanceBlocks(n)` helper for nitro-devnode, which only makes blocks when transactions arrive: it sends filler transactions, staying within the entropy source's 256-block read window.
  - `scripts/contracts/e2e.mjs`, adapted from ethblockdigger's [`e2e.ts`](https://github.com/detychey/ethblockdigger/blob/main/scripts/contracts/e2e.ts), with these cases:
    - the happy path: pay, reveal, play the drawn levels with bots through `jiro-tools playtest --nonce --level-index`, commit with the journals, then `settleRun`;
    - the `settleLevel` fallback, six calls;
    - a late commit, marked late at settlement;
    - a journal copied from another run, rejected;
    - a wrong `rulesVersion`, rejected;
    - season close, claim and rake withdrawal, on a season whose length and grace are short enough for the run (seconds to minutes, README §8.4 allows from 1 s), stated in the script.
  - `.github/workflows/e2e.yml`, following §1.3: `pull_request` on `contracts/`, `scripts/contracts/`, `referee/` and itself (or the `ci:heavy` label), and `workflow_dispatch`. It installs Foundry with a pinned `foundry-rs/foundry-toolchain` step, starts nitro-devnode with the vendored script of M4.2, runs the cases with the real Stylus referee and the public development key, and prints the gas per transaction between log markers.
- **Done when:**
  - this PR's `e2e.yml` run is green on nitro-devnode, with real `verifyRun` and `verify` calls;
  - the gas of every transaction is in the log, `settleRun` and the six `settleLevel` calls included;
  - a test shows the preflight refusing any other chain id.
- **Verify with:**
  - `get_job_logs` for this PR's `e2e.yml` run
  - `node --test scripts/contracts/preflight.test.mjs`
- **Skills:** `onchain-referee`, `ship`, `testing`; tier `contracts`. **README:** §7.2, §10. **Needs user:** none.

#### M4.10 ZkReferee adapter (if activations are paused, or D2 = zk)

- **Goal:** the zk backend behind the same `IReferee`, so `Challenge` and `Season` don't change.
- **When it runs.** It starts once the activation reading (M4.3, refreshed at the start of this item) shows activations paused on Arbitrum Sepolia, which is the expected case, so the zk chain does not wait for M4.9. Otherwise it waits for M4.9, and M4.9's PR marks it "not built" if Stylus is chosen. If M4.8 asked for a prover credential, round F0 runs before this item starts.
- **Deliverables:**
  - `contracts/src/ZkReferee.sol`, implementing `IReferee`, for an image id or program key fixed at construction:
    - `verifyRun` verifies one run proof, whose public values are keccak256 of each level and journal, the six weights and the six Outcomes;
    - `verify` verifies one level proof, with the same public values for one level;
    - `rulesVersion()` returns its program's version.
  - `ZkReferee` decodes the public values in M4.8's encoding, and calls the framework's verifier of a fixed version, held immutably, never an upgradeable router or gateway (`docs/ECONOMY.md`).
  - The ZkReferee branch of `deploy.mjs`, wired to that verifier.
  - The host's `prove --run <run file>`, producing the settlement proof of a run file (M4.7).
  - A zk mode of `scripts/contracts/e2e.mjs`: it proves the run with the host's `prove`, then settles. In `e2e.yml` it runs against the framework's mock verifier with mock proofs; M4.14 runs it with real proofs.
  - `referee/zk/README.md`: how to prove a run for settlement.
  - `contracts/test/ZkReferee.t.sol`.
  - **Fixture set.** One real run proof of six levels, produced by a `zk-prove.yml` dispatch on this branch within its 6 h limit, or through the prover network with the round F0 credential. If a run proof does not fit those limits, a real proof of one level, settled through `settleLevel`, and the full six-level run settled through the framework's mock verifier. The PR states which set it used.
- **Done when:**
  - a test settles a run through `Challenge` with ZkReferee and the fixture set;
  - tampered public values, a proof for another journal, and a wrong image id each revert;
  - this PR's `e2e.yml` run passes the zk mode.
- **Verify with:**
  - `cd contracts && forge test --match-contract ZkReferee -vv`
  - `get_job_logs` for this PR's `e2e.yml` run
- **Skills:** `onchain-referee`, `security`; tiers `zk`, `contracts`. **README:** §7.3. **Needs user:** none, if round F0 has run when M4.8 asked for a credential.

#### M4.12 Economy document and contract review

- **Goal:** the residual risks of the money contracts are written down, reviewed and accepted before any deployment.
- **Deliverables:**
  - `docs/ECONOMY.md`, completed, with its TBD cells filled from `docs/VERIFICATION.md`:
    - the money flow and the solvency invariant;
    - a threat table modeled on ethblockdigger's [`TOKENOMICS.md`](https://github.com/detychey/ethblockdigger/blob/main/docs/TOKENOMICS.md) §6.3, covering:
      - real-time bots;
      - copied journals;
      - the nonce preview of up to 256 blocks;
      - sybils;
      - deadline gaming, and censorship near the deadline;
      - settlement griefing and abandoned runs;
      - rake, treasury and rollover;
      - a season's referee and its rules version;
      - a consensus bug in a live season's referee, accepted residual on testnet;
      - journal publication (P5);
      - unaudited code.
    - if D2 = zk, the prover trust assumptions: the image id and verifier address pinned in `ZkReferee`; who holds a hosted prover's credential and its spend cap; and the operator as the only prover in practice.
  - A review of `contracts/`, including `ZkReferee.sol` when D2 = zk, with the ethskills `security`, `audit` and `qa` skills, plus slither if M0.2 installed it. Each finding gets a severity and one of three outcomes:
    - **fixed:** small fixes, under 20 changed lines each, land in this PR with a test;
    - **split:** every other fix becomes its own numbered item from M4.17 on, with a regression test. M4.14 depends on each of them.
    - **accepted:** recorded with the reason it stays.
- **Done when:**
  - every finding is marked fixed (with the test name), split (with the item id) or accepted (with the reason);
  - every threat row names its mitigation and the test that covers it, or reads "accepted residual";
  - no high or medium slither finding is left unaddressed.
- **Verify with:**
  - `cd contracts && forge test`
  - `slither contracts/src`, if installed.
- **Skills:** `onchain-referee`, `security`, `audit`, `qa`; tier `contracts`. **README:** §7.4, §8, §10. **Needs user:** read `ECONOMY.md` and accept the residual risks for testnet (round F1).

#### M4.13 Bot-advantage study (optional)

- **Goal:** put a number on README §7.4's main product risk. The item is optional: no done-when depends on it, and it is off the critical path.
- **Deliverables:**
  - `tools/src/bots/search.rs`: a nonce-aware lookahead bot that runs a beam search over masks with the core. Its budget is 1 s of compute per game second on one core, so it would still meet the commit deadline.
  - `playtest --shard <i>/<n>`: runs only the i-th of n seed ranges, so the study can span sessions.
  - `reports/bot-advantage/shard-<i>.json`, committed after each shard as a checkpoint, and `reports/bot-advantage.md`, merged from the shards: the bot's run-score uplift over the scripted bots, with confidence intervals, over 200 six-level runs.
  - A section of `docs/ECONOMY.md` with recommendations on the D10 qualification threshold, and on fresh entropy per level before mainnet.

  **Wall time.** At the full budget, 200 runs of up to 6 × 180 s cost about 216,000 core-seconds, about 15 hours on the container's 4 CPUs. The study therefore runs as 8 shards of 25 runs, about 2 hours each.
- **Done when:**
  - all 8 shards are committed;
  - the report gives the mean and median uplift with intervals;
  - `ECONOMY.md` states the recommendation.
- **Verify with:** for each shard i in 1-8, `cargo run -p jiro-tools --release --locked -- playtest --policy search --runs 200 --seed 7 --shard $i/8 --out reports/bot-advantage/shard-$i.json`; then `cargo run -p jiro-tools --release --locked -- playtest --merge reports/bot-advantage/ --out reports/bot-advantage.md`.
- **Skills:** `parity-testing`. **README:** §7.4, §8.2. **Needs user:** optional: provide a few of your own Training journals as a human baseline.

#### M4.14 Arbitrum Sepolia deployment and first settled run

- **Goal:** README §9's M4 done-when: a run settled end to end on testnet.
- **Session.** The deployment steps run in a session started after round F2 has set the keys as cloud-environment variables.
- **Deliverables:** `deployments/arbitrum-sepolia.json`, `seasons/testnet-0.json` and `docs/DEPLOYMENT.md`. The steps:
  1. run the preflight;
  2. deploy `ArbBlockhashEntropy`, with ArbSys at `0x64`;
  3. deploy the referee M4.9 chose: Stylus, or ZkReferee wired to the framework's verifier of a fixed version;
  4. deploy `Season` with the treasury set to the deployer key's address (testnet only), and open the provisional season of `seasons/testnet-0.json`, committed in this PR: the ids and weights of `calibration-1.json`, the deployed referee, a length of 1 day and a grace of 24 h, so that M5.5 can close it, the D12 fee, the 120 s slack proposed in README §8.4, `minClears` 1, and a rake the PR states. Before opening, it checks the 16 levels with the level tool and, for a Stylus referee, its remaining activation time, and it records the season number `open` assigned in `deployments/arbitrum-sepolia.json`;
  5. deploy `Challenge`;
  6. verify the Solidity sources on Sourcify. For a Stylus referee, add a `deployment_tx` input to `stylus-gas.yml` that runs `cargo stylus verify --deployment-tx <tx>` (it needs Docker), and dispatch it;
  7. run the e2e happy path with a bot run, in zk mode with real proofs if D2 = zk. If the bot's run clears no level, play another, so that M5.5 can rehearse a claim;
  8. record the addresses, transaction links, gas per transaction, verify gas per level and reveal timing.

  `docs/DEPLOYMENT.md` also holds a redeploy section, modeled on ethblockdigger's [`DEPLOYMENT.md`](https://github.com/detychey/ethblockdigger/blob/main/docs/DEPLOYMENT.md) B5: contracts are immutable, so a redeploy is a new generation, appended to the deployments record's list of generations.
- **Done when:**
  - a run is settled end to end on Arbitrum Sepolia, with Arbiscan links in `docs/DEPLOYMENT.md`, and it cleared at least one level;
  - `isSolvent()` returns true;
  - the Solidity sources are verified on Sourcify (links in `DEPLOYMENT.md`);
  - for a Stylus referee, the `cargo stylus verify` run passes (run link);
  - README §9's M4 gate holds as M4.9 states it.

  This closes README §9's M4, so this PR updates the status lines.
- **Verify with:**
  - `node scripts/contracts/e2e.mjs --network arbitrum-sepolia --cases happy-path`
  - `cast call "$(jq -r '.generations[0].Season' deployments/arbitrum-sepolia.json)" 'isSolvent()(bool)' --rpc-url https://sepolia-rollup.arbitrum.io/rpc` prints `true`; without Foundry, `node scripts/contracts/preflight.mjs --network arbitrum-sepolia --check-solvent`.
- **Skills:** `onchain-referee`, `ship`, `addresses`, `l2s`; tier `contracts`. **README:** §7.2, §9 M4. **Needs user:** create a testnet-only deployer key and a separate tester key as cloud-environment variables, fund both with Arbitrum Sepolia ETH, and approve the deployment (round F2).

## 10. M5 dApp and testnet season

| ID | Title | Depends on | Size | Needs user |
|---|---|---|---|---|
| M5.1 | Wallet and chain plumbing | M2.10, M4.11 | M | none |
| M5.2 | Challenge run flow in the browser | M5.1 | M | none |
| M5.3 | Settlement, season pages, replay of committed runs | M2.3, M4.9, M5.2 | M | none |
| M5.4 | Web Serial bridge for Challenge runs | M3.4, M4.14, M5.2 | M | Fund your wallet; a six-level Pico run on Sepolia |
| M5.5 | Season operations, testnet-1 parameters, testnet-0 close | M4.14, M5.3, M5.4 | M | Approve the parameters, the schedule, its secrets and the feedback channel |
| M5.6 | Testnet season 1 | M5.3, M5.5 | M | Testers, play, approvals |

Each verify line says which chain it uses: the local chain of `localnet.mjs` (M4.11) with MockReferee, `e2e.yml` on nitro-devnode with the real referee, or Arbitrum Sepolia.

#### M5.1 Wallet and chain plumbing

- **Goal:** the web app talks to the deployed contracts, while Training stays wallet-free.
- **Deliverables:**
  - `web/src/chain/`:
    - ethers v6, pinned, as in ethblockdigger;
    - an EIP-1193 injected wallet, with a switch to Arbitrum Sepolia;
    - a loader for `deployments/<network>.json`, reading its newest generation;
    - typed bindings generated from `contracts/abi/` (M4.3), never hand-written;
    - the ETH balance, with a link to an Arbitrum Sepolia faucet for testers.
  - A footer with the contract addresses and the build's git sha.
  - `web/test/chain.test.ts`, with a mock EIP-1193 provider.
  - `web/scripts/chain-smoke.mjs`.
  - A test that the Training pages import nothing from `web/src/chain`.
- **Done when:**
  - the mock-provider tests cover connecting, the wrong network and balance reads;
  - the bindings regenerate from `contracts/abi/` with no drift;
  - on the local chain, the smoke script runs `startRun` for the season accepting runs, passing its number and fee, through this module;
  - the Training import test passes.
- **Verify with:**
  - `npm --prefix web test -- chain`
  - local chain: `node scripts/contracts/localnet.mjs --up && node web/scripts/chain-smoke.mjs --rpc http://127.0.0.1:8545`
- **Skills:** `wallets`, `frontend-ux`, `frontend-playbook`; tiers `web`, `contracts`. **README:** §8.1, §8.2. **Needs user:** none.

#### M5.2 Challenge run flow in the browser

- **Goal:** a full Challenge run in the browser, committed within its deadline, on the rules the season accepts, and robust to a page reload.
- **Deliverables:** `web/src/pages/challenge.ts` and `web/src/run/`:
  - Run start:
    - a season view: price, pot, parameters;
    - a season check: the page refuses to call `startRun` unless the wasm core's `RULES_VERSION` equals the season's `rulesVersion` and the 16 shipped level ids equal the season's ids;
    - `startRun(s)`, where s is the season number whose `rulesVersion` and level ids the season check passed, sending that season's fee;
    - a wait that polls the entropy source's `isRevealable` until the entropy block exists (usually 10 to 20 s, README §7.2), then `revealRun` at once.
  - Play:
    - the six drawn levels, from the wasm core's draw;
    - back-to-back play with mode-1 journals, and no pause;
    - a live deadline countdown using the contract's formula, tested against the deadline fixtures of `vectors/derivations.json` (M4.7).
  - Interruption:
    - the run state (nonce, drawn levels, current level) and the live events and current tick are written to IndexedDB every second;
    - after a reload, the page closes the interrupted level's journal as README §7.2 specifies. It replays the stored journal through tick c − 1, where c = max(n, e + 1), n is the stored tick count and e the last event's tick. If the level ended by then, it keeps the journal as it is; otherwise it appends an X at tick c. It then resumes the run at the next level.
  - Commit:
    - one `commitRun` transaction as soon as the run ends, carrying the six journals (P5), showing the margin left before the deadline;
    - X-at-tick-0 journals for unplayed levels;
    - the journals kept in IndexedDB, and downloadable as a run file (M4.7).
  - A warning when the tab is hidden, since browsers throttle background timers.
  - `web/scripts/challenge-e2e.mjs`.
- **Done when:**
  - a headless e2e on the local chain goes from buy to commit, with bot inputs fed through `input.ts`;
  - the committed commitment equals the core's `run_commitment` of the stored journals, and the commit calldata carries them;
  - the deadline computation matches every deadline fixture;
  - a season with another `rulesVersion` or another level id is refused before `startRun`, with a test each, and a `startRun` sent after the accepting season changed reverts;
  - a reload in the middle of the third level, simulated in the headless e2e, still commits a run within the deadline whose six journals replay;
  - a reload right after a level ends, one by lives out and one by a clear, before the next level is persisted, still commits a run whose six journals replay;
  - a run file reloads and reproduces the six outcomes.
- **Verify with:**
  - `npm --prefix web test -- run deadline season-check reload`
  - local chain: `node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545` and `--reload-at 3`
- **Skills:** `frontend-ux`, `onchain-referee`; tiers `web`, `contracts`. **README:** §6.4, §7.2, §8.2. **Needs user:** none.

#### M5.3 Settlement, season pages, replay of committed runs

- **Goal:** verify-by-exception settlement from the dApp, a leaderboard without an indexer, and every committed run replayable from chain data.
- **Deliverables:**
  - `web/src/pages/settle.ts`, for the backend in `deployments/<network>.json`:
    - Stylus: settles the player's best run with one `settleRun` transaction, falling back to six `settleLevel` transactions if it fails for gas, with progress, retries and decoded revert reasons;
    - zk: the operator settles (M5.5), because proving needs credentials that cannot live in a browser; the contract itself stays open to any submitter (README §7.2). The page exports the run file and shows the settlement cutoff: the season's end plus grace, read from the `Season` contract (M4.5). M5.5 adds the handoff instructions.
  - `web/src/pages/season.ts`: parameters, pot, end time and a countdown, a permissionless close button, and claiming.
  - A leaderboard, built from `Challenge` and `Season` events through chunked `eth_getLogs`.
  - `web/src/chain/calldata.ts`: the M2.3 viewer loads any committed run's journals from its commit transaction (P5). It decodes a direct call's input as `commitRun`; for a smart-account wallet, it finds the embedded `commitRun` call by its selector and run id, and otherwise falls back to `debug_traceTransaction` where the RPC serves it, or says the run needs a trace RPC. It keeps the journals only if they match the stored commitment.
  - Tests.
- **Done when:**
  - on the local chain, with two bot players, the leaderboard equals `Season`'s best scores, and the claim amounts shown equal the contract's;
  - a run replayed from its commit calldata shows the outcomes the referee returned when it was settled;
  - a run committed through a forwarder contract on the local chain, standing in for a smart account, loads and replays to the same outcomes as a direct commit;
  - with `deployments/local.json` naming the zk backend, `settle.ts` exports a run file that reloads to the six outcomes, and shows the contract's cutoff.
- **Verify with:**
  - `npm --prefix web test -- leaderboard season settle`
  - local chain: `node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545 --players 2 --settle`, and the same with `--backend zk`
- **Skills:** `frontend-ux`, `indexing`, `onchain-referee`; tiers `web`, `contracts`. **README:** §7.2, §7.3, §8.2, §8.4. **Needs user:** none.

#### M5.4 Web Serial bridge for Challenge runs

- **Goal:** Challenge runs played on the Pico, with the browser as the link to the chain, and a disconnect that costs the level's remaining time, not the run.
- **Deliverables:**
  - Run-flow support in `web/src/serial.ts`:
    - the device's Hello `RULES_VERSION` must equal the season's, or the page refuses to start a run;
    - LoadLevel for each drawn level, with `runNonce`, `levelIndex` and mode 1;
    - events received live into the browser's journal and mirror, and the current tick from TickStats (every 15 ticks);
    - LevelEnd checked against the wasm replay. A mismatch aborts the run with a message.
    - the same commit path as browser play;
    - an unsupported-browser message outside desktop Chrome and Edge;
    - a disconnect mid-level closes that level's journal with the events received plus an X event, or none if the level already ended, as README §7.2 specifies, with n the last tick count known from TickStats. The level is committed with its claim, and its ticks used follow the time actually spent. The run continues at the next level once the device reconnects; levels still unplayed at the end get X-at-tick-0 journals. See §15, question 13.
  - `firmware/app/src/challenge.rs`: waits for LoadLevel, plays the level, returns LevelEnd. There is no pause.
  - `web/test/bridge.test.ts`: replays a six-level transcript, recorded from rp2040js, through a mock SerialPort.
  - Level-transition overhead, measured in the emulator rehearsal and recorded in `docs/LINK.md`.
- **Done when:**
  - the transcript rebuilds the six journals byte for byte;
  - an altered device hash raises an error;
  - a Hello with another `RULES_VERSION` is refused;
  - a transcript cut in the middle of the second level gives a valid journal for it that replays, and the run commits within the deadline computed from the deadline fixtures' formula;
  - the transition overhead is recorded;
  - (user) on hardware, a six-level run on Arbitrum Sepolia completes with all six checks matching: the user posts its run id and the margin shown at commit, and the agent checks the run onchain.
- **Verify with:**
  - `npm --prefix web test -- bridge`
  - `cd firmware && cargo build --release --locked -p jiro-firmware`
- **Skills:** `rp2040-firmware`, `journal-codec`, `frontend-ux`; tiers `web`, `firmware`. **README:** §6.5, §7.1, §7.2. **Needs user:** fund your browser wallet from an Arbitrum Sepolia faucet; flash this PR's UF2; play one six-level Challenge run on this PR's preview in desktop Chrome or Edge; post the run id and the margin shown at commit (round G1).

#### M5.5 Season operations, testnet-1 parameters and testnet-0 close

- **Goal:** everything needed to open, watch, settle and close a season on schedule, the testnet-1 parameters set from measurements, and a rehearsed close and claim on Sepolia.
- **Deliverables:**
  - `scripts/contracts/season.mjs`, with five commands:
    - `open`: opens a season from a season file, and writes the season number `open` assigned, from its event, into `deployments/<network>.json` under the file's label, after checking the 16 levels with the level tool and, for a Stylus referee, that its remaining activation time (`ArbWasm.programTimeLeft`) covers the season's length plus grace;
    - `status`: runs, commits, settlements, pot, `isSolvent`;
    - `close`: the permissionless close;
    - `withdraw`: the permissionless rake withdrawal to the treasury;
    - `settle`: replays a player's run files offline with the core, picks their best run in D10 order (qualification, then score, then fewer ticks), and submits that run only, proving it first when D2 = zk.
  - `seasons/testnet-1.json` (P13), which references `calibration-1.json` for the ids and weights:
    - the referee from `deployments/arbitrum-sepolia.json`;
    - the fee (0.00005 ETH, in wei), the rake, `minClears`, and a length of 14 days (D12);
    - the settlement grace. With Stylus, the 48 h proposal. With zk, sized from M4.8's proving time per run × the expected number of settled runs, with the derivation stated.
    - commitSlack, sized from the M5.4 rehearsal and the margin reported in round G1: at least 2 × the worst observed transition and transaction overhead. If M4.13 ran, its threshold recommendation is applied through `minClears` or declined here, with the reason.
  - `.github/workflows/season-ops.yml`, following §1.3, with `cancel-in-progress: false`:
    - a daily `schedule`: `status`, failing when `isSolvent` is false; the bot runs from `TESTER_KEY` on the days the runbook lists; `close` and `withdraw` once end plus grace has passed; with zk, `settle` for each player with a handed-off run file under `seasons/testnet-1/runs/` whose best run is not yet settled;
    - `pull_request` on itself and `season.mjs`: a read-only `status` of `testnet-0` on Sepolia, with no secret;
    - `workflow_dispatch`.
  - `docs/SEASON_RUNBOOK.md`:
    - the season's dates, the settlement cutoff, and what runs on which date;
    - the freeze rule: while a season is open, no PR that changes `core/` or `levels/` merges, so that a rule change that moves no vector cannot slip in;
    - with zk, the run-file handoff: players send their run file to the operator through the channel named in `docs/TESTNET.md`, before the cutoff, and the operator commits it under `seasons/testnet-1/runs/` through a PR;
    - the slack and grace derivations.
  - `docs/TESTNET.md`, the tester guide:
    - getting test ETH from an Arbitrum Sepolia faucet;
    - desktop Chrome or Edge for the Pico;
    - the controls and rules: keyboard mapping, Commit, the zero score when the lives run out;
    - flashing the season's UF2 with BOOTSEL;
    - with zk, the handoff channel and cutoff;
    - a feedback channel reachable without repository access, where testers attach their journal or run file: GitHub issues if the repository is public, otherwise the form or mailbox the user names in round G2;
    - known gaps: test ETH only; unaudited contracts; the run nonce computable up to 256 blocks before the reveal; a lapsed reveal forfeits the run; a disconnect or reload closes the current level; desktop and keyboard only; Web Serial only in Chrome and Edge.
  - The handoff instructions and the feedback channel, added to `web/src/pages/settle.ts` (M5.3).
  - The season's UF2, published by `pages.yml` under `/firmware/` on the preview site, with its sha256 and `RULES_VERSION`.
  - **testnet-0 rehearsal:** once its end plus grace has passed, `season.mjs close` on `testnet-0`, a claim for the M4.14 bot player, `season.mjs withdraw` for the rake, and the `isSolvent` result and the dust, recorded in `docs/DEPLOYMENT.md`.
- **Done when:**
  - on the local chain, the five commands run and `status` output equals the contract views;
  - this PR's `season-ops.yml` run is green;
  - `testnet-1.json` is complete, and the runbook explains the slack and grace derivations;
  - this PR's preview serves the UF2 and its checksum;
  - `testnet-0` is closed, the bot player has claimed and the rake has reached the treasury on Sepolia, with Arbiscan links and `isSolvent` true.
- **Verify with:**
  - local chain: `node scripts/contracts/localnet.mjs --up && node scripts/contracts/season.mjs status --rpc http://127.0.0.1:8545`
  - `node scripts/contracts/season.mjs status --network arbitrum-sepolia --season seasons/testnet-0.json` shows the season closed and claimed.
  - `curl -sf <this PR's preview URL>/firmware/SHA256SUMS`
- **Skills:** `onchain-referee`; tiers `contracts`, `firmware`. **README:** §7.2, §8.2, §8.4. **Needs user:** approve the testnet-1 parameters; add `TESTER_KEY`, and the prover credential if D2 = zk, as Actions secrets; approve the season-ops schedule; name the tester feedback channel if the repository is private (round G2).

#### M5.6 Testnet season 1

- **Goal:** README §9's M5 done-when: a full season closes and pays out on testnet.
- **Checkpoints,** each a commit on the draft PR: open; mid-season status; settlement cutoff; close after end plus grace; claims and the report. `send_later` reminders are set for mid-season and for end plus grace.
- **Deliverables:**
  - testnet season 1, opened on Arbitrum Sepolia with `seasons/testnet-1.json`;
  - testers playing in the browser and on the Pico, and bots playing from the tester key;
  - best runs settled: by players with Stylus, or by `season-ops.yml` from handed-off run files with zk;
  - after the end plus the grace period, any address closes the season, qualified players claim, and `season.mjs withdraw` sends the rake to the treasury;
  - `docs/TESTNET-1-REPORT.md`:
    - runs, settled runs, and gas and verification cost per settled run;
    - deadline margins and misses, interrupted levels included;
    - rejected settlements;
    - payouts, the rake sent to the treasury, and `isSolvent` after every claim;
    - suspicious patterns found in the published journals;
    - a summary of the tester feedback.
  - `deployments/arbitrum-sepolia.json`, with a new generation appended if anything was redeployed.
- **Done when:**
  - the season closed through a permissionless `closeSeason` transaction;
  - at least one player claimed a pro-rata payout, and `isSolvent` held after every claim;
  - each claim paid exactly bestScore × playersPot / totalQualifiedPoints, rounded down, and playersPot − Σ shares, claimed or not, is less than the number of qualified players, in wei (rounding dust);
  - (user) at least one settled run was played on the Pico, and at least one in the browser: the user names their run ids.

  This closes README §9's M5, so this PR updates the status lines.
- **Verify with:**
  - `node scripts/contracts/season.mjs status --network arbitrum-sepolia --season seasons/testnet-1.json`
  - Arbiscan links for the close and claim transactions, in the report.
- **Skills:** `onchain-referee`, `qa`. **README:** §8.2, §9 M5. **Needs user:** recruit testers, approve opening the season, play (at least one Pico run), keep the tester key funded, commit or pass on handed-off run files if D2 = zk, and check the report after the close (round G3).

## 11. Decision schedule

Each decision, or each part of one, is closed by the owner or by exactly one item, before its first use. Where the owner answered on 2026-10-28, the items named pin the details and propose what the answer left open. A decision item is approved by merging it.

| ID | Decision | Decided in | Needed by | Recommendation |
|---|---|---|---|---|
| D1 | Firmware shell language | Owner, 2026-10-28; confirmed by M0.2's blinky | M3.1 | Decided: Rust embassy-rp, as its own Cargo workspace, with a UF2 from elf2uf2-rs. It needs no `arm-none-eabi-gcc`. If the blinky fails, the owner chooses between rp2040-hal and C++ on the Pico SDK, and M0.2 rewrites M3.1-M3.5 for that choice. |
| D2, part 1 | zkVM framework | M1.12, from M1.16 and M1.17 | M1.13, M4.8 | README §7.3's four tooling checks first, then measured cycles and price. Trial SP1 and RISC Zero. |
| D2, part 2 | Verification backend, and testnet aggregation | M4.9 | M4.10 (unless it starts early), M4.12, M4.14, M5.3 | Stylus whenever activations are open on the target chain; ZkReferee while they stay paused. The gas gate is defined in §4. If it fails with activations open, M4.15 runs, and if it still fails the user chooses from both cost tables. Both backends sit behind `IReferee`. |
| D3 | Movement on claimed cells | Owner, 2026-10-28; pinned in M0.5 | M1.6 | Decided: rail only |
| D4 | Trail rules | Owner, 2026-10-28; pinned in M0.5 | M1.6 | Decided: the own trail blocks movement; no fuse |
| D5 | Level defaults; running out of lives | Owner, 2026-10-28; pinned in M0.5 | M1.8 | Decided: 3 lives, 2,700 ticks, 7,500 bp, adjustable per level; running out of lives scores zero |
| D6 | Shield | Owner, 2026-10-28; pinned in M0.5 | M1.6 | Decided: one charge per level; an absorbed hit costs only the charge |
| D7 | Minion patrol rule; stranded minions | Approach agreed by the owner, 2026-10-28; measured in M1.7; final in M1.7, or in M1.14 (and M1.15 if the rule changes) | M1.9, M1.10, M2.6 | The right-hand rule with the orientation step, if the coverage test finds 0 traps on 100,000 boards; otherwise a replacement specified in M1.14 and approved before it is built, or a bounded trap rate the user accepts, written into README §4.7. Stranded minions are destroyed, and respawn when their countdown of R, which counts the tick of destruction, reaches zero: at tick t + R − 1 ([README §4.7](README.md#47-minions), PIN-17). |
| D8 | Key mapping | Owner, 2026-10-28; pinned in M0.5 | M1.1, M2.1 | Decided: Key0-3 = A, B, X, Y; Y and the joystick press unused and not journaled; keys configurable in the browser (M2.1) |
| D9 | Boss size | Owner, 2026-10-28; pinned in M0.5 and M0.6 | M1.3, M1.5 | Decided: a square B × B body, B per level, B = 2 to 8, default 5 |
| D10 | Ranking and payout | Owner, 2026-10-28; qualification and contract details in M0.7 | M4.5 | Decided: best settled run per player per season; pro-rata payout among qualified players. M0.7: ties go to fewer ticks, and a qualifying run clears at least `minClears` levels, a season parameter defaulting to 1, and ranks above any run that doesn't (README §8.4). |
| D11 | Superchallenge design | Deferred | none | Stays in [`TODO.md`](TODO.md) |
| D12 | Chain, currency, season length | Owner, 2026-10-28; pinned in M0.7 | M4.3, M4.5, M4.6 | Decided: native ETH; Arbitrum Sepolia for M4 and M5, Arbitrum One later, reusing ethblockdigger's contracts; a 0.00005 ETH Challenge run; 14-day seasons on testnet (`testnet-0` aside), likely on mainnet too. |
| D13 | Names | Owner, 2026-10-28; crate and contract names in M0.5 | M0.4 (crates), M4.1 (contracts) | Decided: Jiro-ikusu ([`name.md`](name.md)); the crates and contracts listed in README §13 D13, approved by merging M0.5 |
| D14 | Seed space: seeded boss randomness | Owner, 2026-10-29, from M0.7's review; rule in M1.18 | M1.5 | Decided: the level seed keeps driving the boss through the level, so no two runs share a game and inputs can be neither copied nor precomputed (README §7.4). M1.18 writes the exact rule. |
| P1 | Rust pin | M0.2 | M0.4 | 1.98.0, as ethblockdigger; otherwise the newest version that installs |
| P2 | Contract toolchain | M0.2 | M4.3 | Foundry at a pinned version, if `forge` installs and runs: zk verifiers ship Foundry tests, and fuzz and invariant tests are built in. Otherwise ethblockdigger's harness for everything. Never both. Decided only after the pinned installer and the direct asset URL were both tried. |
| P3 | Repository layout additions | M0.4 | M1.4, M2.1 | Add `tools/` (the native target of README §3) and `shell/` (shared code that is not consensus) to README §3 |
| P4 | Verifier interface | M0.7 | M1.8 (Outcome), M4.1, M4.4 | Decided in M0.7 (README §7.3): `verifyRun(bytes[6], bytes[6], uint16[6], bytes)` returning six Outcomes, the per-level `verify(bytes, bytes, uint16, bytes)`, and `rulesVersion()`, all `view`. The Outcome carries the decoded header fields and the draw slot. |
| P5 | Journal publication | M0.7 | M4.6, M5.2, M5.3 | Decided in M0.7 (README §7.2): (a), the six journals as `commitRun(runId, bytes[6] journals)` calldata, from which the contract computes the commitment. Alternatives were (b) an offchain public store and (c) settled runs only. |
| P6 | Commit slack | M0.7 (mechanism), M5.5 (testnet value) | M4.7 | A season parameter, `commitSlack` (README §8.4); 120 s proposed |
| P7 | wasm interface | M1.11 | M2.1 | Raw `extern "C"` exports over static state; no wasm-bindgen or wasm-pack |
| P8 | Web stack | M2.1 | M2.1 | Vite + TypeScript with a plain canvas, vitest, ESLint and one Playwright smoke test; ethers v6 in M5; no UI framework |
| P9 | Preview hosting | M2.2 | M2.2 | Cloudflare Pages through wrangler, with one preview per PR, as ethblockdigger deploys. GitHub Pages cannot serve per-PR previews and needs a paid plan for a private repository. |
| P10 | Level authoring | M2.4 | M2.7 | ASCII sources compiled by the core's level codec, with `.bin` files canonical; the editor produces the same bytes |
| P11 | Target clear-rate curve and floor | M2.6 | M2.7 | Non-increasing, from at least 90 % at level 1 to about 15 % at level 16, within ±5 pp over 1,000 seeds; a 500 bp floor, with every level's median effective claim above it |
| P12 | Device HUD | M3.5 | M3.5 | Between-level screens, plus a brief overlay at level start |
| P13 | Testnet-1 parameters | M5.5 | M5.6 | Ids and weights from `calibration-1.json`; slack and grace from measurements; length per D12 |
| P14 | Repository visibility, Actions budget, CI profile | M0.2, from the owner's answer in round A1 | M0.4 | Public, if the license allows: larger runners, unmetered minutes, required checks available, and the public CI profile. Otherwise the private CI profile, a spending limit or paid plan, and the budget recorded in `docs/TOOLING.md`. |
| P15 | License | M0.1 | M2.2 | The owner's choice; no default |
| P16 | Settlement shape | M0.7 | M4.4, M4.7, M4.8 | Decided in M0.7 (README §7.3): (a) per run, `settleRun` with one `verifyRun`, and `settleLevel` as the fallback; season aggregation decided in M4.9. The alternative was (b), per level only. |
| P17 | Draw check | M0.7 | M1.8, M4.4, M4.7 | Decided in M0.7 (README §8.2): the core returns `drawSlot`; the contract looks up the slot and weight by level id and checks the slot. No Solidity draw. |

## 12. Dependency graph and critical path

Arrows read "enables"; `+` joins prerequisites. "if" marks a conditional edge.

```text
Gates and freeze
  M0.1 -> M0.2, M0.3, M0.5
  M0.2 + M0.5 -> M0.4
  M0.5 -> M0.6 ; M0.2 + M0.6 -> M0.7

Core
  M0.4 + M0.6 -> M1.1 -> M1.2, M1.3
  M0.7 -> M1.18 ; M1.2 + M1.3 -> M1.4 ; M1.2 + M1.3 + M1.18 -> M1.5
  M1.5 -> M1.6, M1.7 ; M1.7 -> M1.14 (if M1.7 finds traps)
  M0.7 + M1.4 + M1.6 + M1.7 -> M1.8
  M1.8 + M1.14 -> M1.15 (if M1.14 changes the rule)
  M1.4 + M1.8 (+ M1.15 if built) -> M1.9 ; M1.8 (+ M1.15 if built) -> M1.10
  M1.9 -> M1.11 ; M0.2 + M1.9 -> M1.16, M1.17
  M1.10 + M1.16 + M1.17 -> M1.12 ; M1.10 + M1.11 + M1.12 -> M1.13

Browser, levels and bots
  M1.11 -> M2.1 -> M2.2, M2.3
  M1.4 -> M2.4 ; M2.1 + M2.4 -> M2.5
  M1.8 + M2.4 (+ M1.15 if built) -> M2.6 -> M2.7 -> M2.8
  M1.10 + M2.2 + M2.8 -> M2.9 ; M2.1 + M2.3 + M2.5 + M2.9 -> M2.10

Device (bring-up starts during M1)
  M0.2 + M1.1 -> M3.1 ; M3.1 + M1.11 -> M3.2
  M3.2 + M1.9 + M1.10 -> M3.3 ; M3.3 + M2.1 -> M3.6 ; M3.6 + M2.2 -> M3.7
  M3.3 + M3.6 + M2.1 + M2.2 -> M3.4 ; M3.4 + M2.9 -> M3.5

Verification
  M0.7 + M1.9 + M1.10 -> M4.1 ; M4.1 + M0.3 + M4.3 -> M4.2
  M1.12 + M4.3 -> M4.8
  M2.9 + M4.2 + M4.7 + M4.8 (+ M4.15 if filed) -> M4.9
  M4.2 + M2.9 -> M4.15 (if M4.9's gate run fails with activations open)
  M4.7 + M4.8 + M4.16 (+ M4.9 if activations are open) -> M4.10 (if activations are paused, or D2 = zk)

Contracts (start after M0)
  M0.2 + M0.3 + M0.7 -> M4.3 ; M4.3 + M1.2 -> M4.4 ; M4.3 + M4.4 -> M4.5
  M4.4 + M4.5 -> M4.6 ; M4.6 + M1.9 -> M4.7
  M2.8 + M4.1 + M4.7 -> M4.11 ; M4.2 + M4.11 -> M4.16
  M0.3 + M4.7 + M4.9 (+ M4.10 if zk) -> M4.12 -> M4.17+ (if findings are split)
  M2.9 -> M4.13 (optional)
  M4.9 + M4.11 + M4.12 + M4.16 (+ M4.10 if zk, + M4.17+) -> M4.14

dApp and season
  M2.10 + M4.11 -> M5.1 -> M5.2 ; M5.2 + M2.3 + M4.9 -> M5.3
  M5.2 + M3.4 + M4.14 -> M5.4 ; M4.14 + M5.3 + M5.4 -> M5.5 ; M5.3 + M5.5 -> M5.6
```

**Critical path.** This is the longest chain to M5.6, derived from the "Depends on" columns with S = 1, M = 2 and L = 3. The planning baseline is the likely case: activations stay paused, so D2 = zk, and M1.7 finds traps that M1.14 replaces, as README §4.7's uncommitted simulation suggests (about 0.15 %). The number after each item is its earliest finish. The end is at 39.

```text
M0.1 1 > M0.5 3 > M0.6 5 > M1.1 7 > M1.3 9 > M1.5 11 > M1.7 13 > M1.8 16 > M1.15 18
     > M1.9 21 > M4.7 24 > M4.11 26 > M4.16 28 > M4.10 30 > M4.12 31 > M4.14 33
     > M5.4 35 > M5.5 37 > M5.6 39
```

Several chains tie with it, so each of these is also critical (slack 0):

- M0.1 > M0.2 3 > M0.4 5 > M1.1, beside M0.5 > M0.6;
- M1.5 > M1.6 13 > M1.8, beside M1.7;
- M1.15 > M2.6 20 > M2.7 22 > M2.8 24 > M4.11, beside M1.9 > M4.7;
- M1.9 > M1.11 23 > M2.1 25 > M2.2 26 > M2.9 28 > M2.10 29 > M5.1 31 > M5.2 33 > M5.3 35 > M5.5, and M5.2 > M5.4.

- **Other cases:**
  - Stylus chosen (activations open): M4.10 drops out and M4.14 finishes at 32, but the browser chain through M5.3 still ends at 39.
  - M1.7 finds no traps, or the user accepts the current rule's rate: M1.14 and M1.15 drop out, and the end moves to 37.
- **Near-critical items** (slack in units):
  - 1: M1.2; M0.7 > M1.18; the zk trials M1.16, M1.17 > M1.12; M4.8; the Stylus measurement M4.1 > M4.2; M4.9; the viewer and editor M2.3, M2.5.
  - 2: M1.4; M1.10; M1.14; the device chain M3.2 > M3.3 > M3.6 > M3.4.
  - 5 or more: M2.4 (5); M3.5 (6); the contracts chain M4.3 > M4.4 > M4.5 > M4.6 (7); M3.7 and M4.13 (9); M0.3 (12); M1.13 (13); M3.1 (16).
- **Owner latency.** The 39 units count agent work only. The main chain alone holds 19 sequential merges. These owner rounds (§13) sit on critical chains: A1, A2, A3 (M0.1, M0.2 and M0.5, M0.4 and M0.6), B1 (M1.7), D3, D4, D5 (the target curve and the layouts of M2.6-M2.8), D6 (the play test of M2.9), F0 when it occurs (before M4.10), F1 and F2 (M4.9 and M4.12, M4.14), and G1-G3 (M5.4-M5.6). Stacking (§1.2) lets agents work ahead of merges, but each review and each hardware or play turnaround on this list delays the end by its own length. The season then runs for its configured length plus the settlement grace.
- **Owner steps with little slack:** A4 and B0, the M0.7 review and the D14 rule (1); B3, the zk framework and any prover route (1); B2, the D7 replacement (2); E1, the device timing check (2); and the reviews of M2.3 and M2.5 (1).

## 13. Human-in-the-loop checklist

The user's steps are grouped into owner rounds, in dependency order. A round can start once the PRs it lists are ready for review: every done-when line ticked except the (user) lines, which are the user's step (§1.2). With stacking, consecutive rounds of one chain, such as A2 and A3, can be done in one sitting by merging bottom-up. Rounds marked **critical** are on a critical chain (§12). Rounds marked **does not gate** collect impressions only. Routine review and merge of agent-only items is not listed.

To answer a (user) line, comment on the PR (text, or JSON in a code block) or upload files to its branch; the agent records the evidence, and you merge after it has ticked the line.

### Round A: repository and M0 decisions

- [ ] **A1, critical** (M0.1 ready):
  - Answer the repository questions: the license (§15, question 16), visibility, the Actions plan and a spending limit (question 18), and preview privacy (question 19). Answered on 2026-10-28.
  - Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as Actions repository secrets (needed from M2.2). The token needs Cloudflare Pages Edit on the account, and DNS Edit on the `jiro-ikusu.win` zone.
  - Merge M0.1 once the agent has committed the license.
- [ ] **A2, critical** (M0.2, M0.5 ready):
  - Review `.claude/settings.json` and `scripts/bootstrap.sh`, and, if the blinky failed, choose rp2040-hal or C++ on the Pico SDK (M0.2).
  - Approve the 18 pinned details and the crate and contract names (M0.5).
  - Merge both.
- [ ] **A3, critical** (M0.4, M0.6 ready):
  - Approve the formats (M0.6).
  - Merge M0.4; then, if the plan allows, make the `ci.yml` jobs required checks on `main`.
  - Merge M0.6.
- [ ] **A4** (M0.7 ready; slack 1): choose the settlement shape (P16), the journal publication (P5) and the draw check (P17); approve the D10 qualification, the interface, the season-bound referee, the treasury, the sequencing and the slack proposal. Merge.
- [ ] **A5** (M0.3 ready; any time before M4.3): read the imported ethskills, and approve dropping `feedback`. Merge.

### Round B: M1 decisions

- [ ] **B0** (M1.18 ready; slack 1): approve the D14 rule, and merge.
- [ ] **B1, critical** (M1.7 ready): review the measured trap rate, and merge.
- [ ] **B2, only if M1.7 found traps** (M1.14 ready; slack 2): approve the replacement rule, or accept a bounded trap rate, which M1.14 then writes into README §4.7 and the D7 row.
- [ ] **B3** (M1.16, M1.17, M1.12 ready; slack 1):
  - Merge the two trial rows, then approve the framework (M1.12).
  - If wrapping failed in the container and on Actions, choose a route for real proofs: approve a prover network with a spend cap and set its credential (it bills on a mainnet chain; secrets table, §1.3), or choose a public repository, a machine of yours with Docker and 32 GB, or a settlement on the local node for M4 (question 7).

### Round C: hardware vector checks

- [ ] **C1** (M3.1 ready): flash `bringup.uf2` from the PR's CI run (hold BOOTSEL, plug in USB, copy the file). Check the border and the 9 inputs, and comment PASS with a photo.
- [ ] **C2** (M3.7 open): flash `vectors.uf2` from the run the agent links in the PR. Open the Device page of the preview in desktop Chrome or Edge, click "Run vectors", then "Copy report", and paste the JSON into a PR comment. This closes M3.

### Round D: browser play and levels

- [ ] **D1, does not gate** (M2.2 ready): play the open-field level on the PR's preview, and comment on feel, controls and rendering.
- [ ] **D2** (M2.4 ready; slack 5): approve the README §5 amendment.
- [ ] **D3, critical** (M2.6 ready): approve the target curve and the floor.
- [ ] **D4, critical** (M2.7 ready): approve layouts 1-8 from the ASCII previews and the bot numbers; the levels are also playable on the PR's preview.
- [ ] **D5, critical** (M2.8 ready): approve layouts 9-16.
- [ ] **D6, critical** (M2.9 ready): play all 16 levels on the PR's preview, and comment one line per level. Merging freezes the levels.
- [ ] **D7, does not gate** (M2.10 ready): play a few levels in Training on the PR's preview, and check the scores and local bests.

### Round E: hardware play

- [ ] **E1** (M3.4 ready; slack 2): flash the PR's `jiro-firmware.uf2` and play a level with the PR's Device page open. Post the overrun counter, the worst tick time and whether it matched.
- [ ] **E2** (M3.5 ready): select each of the 16 levels on the device, play at least one to its end, and post the PASS list, with any comment on HUD readability and overruns.

### Round F: testnet deployment

- [ ] **F0, critical when it occurs** (M4.8 ready, only if M4.8 asked for a prover credential): approve the prover network's spend cap and set its credential as a cloud-environment variable, and as an Actions secret if a workflow proves, before M4.10 starts.
- [ ] **F1, critical** (M4.9, M4.12 ready):
  - Approve D2, or choose the backend if the gate failed with activations open (M4.9).
  - Read `ECONOMY.md` and accept the residual risks (M4.12).
- [ ] **F2, critical** (M4.14 open):
  - Create a testnet-only deployer key and a separate tester key, as cloud-environment variables.
  - Fund both with Arbitrum Sepolia ETH.
  - Approve the deployment. M4.14's work continues in a fresh session.

### Round G: testnet season

- [ ] **G1, critical** (M5.4 ready): fund your browser wallet from an Arbitrum Sepolia faucet. Flash the PR's UF2, play one six-level Challenge run on the PR's preview, and post its run id and the margin shown at commit.
- [ ] **G2, critical** (M5.5 ready):
  - Approve the testnet-1 parameters.
  - Add `TESTER_KEY`, and the prover credential if D2 = zk, as Actions secrets.
  - Approve the season-ops schedule.
  - If the repository is private, name the tester feedback channel (a form or a mailbox).
- [ ] **G3, critical** (M5.6 open):
  - Recruit testers, and approve opening the season.
  - Play at least one run on the Pico, keep the tester key funded, and name the run ids of a Pico run and a browser run.
  - If D2 = zk, commit or pass on the run files testers hand off, before the cutoff.
  - After the close, check the report.

## 14. Risk register

| Risk | Mitigation | Retired by |
|---|---|---|
| Stylus activations stay paused (since 2026-10-02), so no Stylus referee can be deployed for the testnet season | Gas measured on nitro-devnode, where the pause doesn't apply (M4.2, M4.9); an activation reading from M4.3 on, so ZkReferee starts before D2 (M4.10); zk costs measured (M4.8, M4.9); D2 decided from a live reading (M4.9) | M4.9 |
| The container has no Docker daemon | nitro-devnode on GitHub Actions runners, triggered and read with the MCP tools (M4.2, M4.16); M0.2 also tries starting `dockerd` | M4.2 |
| Toolchains fail to install; GitHub API calls and release-note pages are refused | Pinned installers that fetch release assets, sha256-checked direct downloads where an installer insists on the API, versions read from the installed tools (M0.2); npm-hosted tools preferred; the contract toolchain follows the probe (P2) | M0.2 |
| Actions minutes run out: the organization's private repositories share a metered pool, ethblockdigger included | The private CI profile: merged `ci.yml` jobs, heavy workflows only on dispatch or the `ci:heavy` label, weekly schedules (M0.4); minutes per run and a monthly budget checked before heavy runs (§1.3); a spending limit, a paid plan or a public repository chosen in round A1 (P14) | M0.4 |
| Runners are too small for proving or the time gates | Time gates measured in the container; runner size recorded (M0.4); proving tried in both environments (M1.16, M1.17, M4.8) | M4.8 |
| Stylus gas exceeds 1M per level | Provisional numbers on the deployed wasm right after M1.9 (M4.2); the gate defined once on the 16 levels (§4) and measured in M4.9; an optimization item that keeps outcomes unchanged (M4.15); the user chooses if the gate still fails | M4.9 |
| The Stylus wasm exceeds 24 KB brotli | Size gate in CI from M4.1; `opt-level = "z"` in the `stylus` profile only | M4.1 |
| No zkVM passes the four checks, or CPU proving or wrapping is impractical | One trial per framework, including a wrapping attempt with peak RAM (M1.16, M1.17); an exit with user options (M1.12); real proofs in the container and on Actions (M4.8); a prover route chosen in round B3, or round F0 before M4.10 | M4.8 |
| A prover network needs real money on a mainnet chain | Its chain, token, minimum deposit and cost per proof recorded (M1.16, M1.17); a separate account with a spend cap the user approves (rounds B3, F0); other routes offered (question 7) | M4.10 |
| Minions get trapped on 2-wide rails (D7) | The coverage property over every cell of the rail component, on 10,000 boards in CI and 100,000 locally and nightly, with one committed count each (M1.7); a replacement or an accepted rate specified and approved before it is built (M1.14, M1.15) | M1.7, or M1.15 |
| Targets disagree, through `usize` width, overflow, floats or iteration order | The M0.4 gates: lints including `indexing_slicing`, soft-float references in the project crates of a linked probe, no `usize` in state or codecs, overflow checks in every workspace root, four cross builds. Per-tick traces on native and wasm (M1.11); trace digests on the zk executor (M1.12); difffuzz across native, wasm and the executor (M1.13); emulator traces and packed difffuzz cases (M3.3); the hardware run (M3.7). The Stylus contract code under the TestVM, which runs natively (M4.1). The wasm build itself, deployed on nitro-devnode, on the vectors and the 200 fixed cases (M4.2). | M1.13, M3.7, M4.2 |
| Spec gaps get resolved silently in code | The M0.5-M0.7 freeze; every rule unit of README §4 tagged or marked as rationale, checked in CI (M0.5, M0.4); every tag mapped to a vector or test, checked by test (M1.9); the `CLAUDE.md` sync table and the PR template for later gaps | M1.9 |
| A rule changes without a `RULES_VERSION` bump | The behavior-change definition (M0.1, PIN-13); `check-rules-version.sh` in the vectors-drift job, shown failing once (M1.9); the reverse check for optimizations (M4.15); no `core/` or `levels/` change while a season is open (M5.5) | M1.9 |
| The hardware is only with the user, so device bugs surface late | Bring-up in parallel during M1 (M3.1); host byte-stream and pin-table tests; rp2040js parity in CI (M3.3); a one-click "Run vectors" page tested on a recorded transcript (M3.6); PR previews and UF2 artifacts for every hardware step | M3.7 |
| rp2040js cannot run embassy's setup or USB | Its own UF2 loader and a pinned bootrom image; UART transport in emulator builds; a minimal rp2040-hal runner for the vectors binary (M3.3) | M3.3 |
| The RP2040 misses the 66 ms tick on a capture plus redraw | Dirty-cell redraw; capture redraws spread across ticks; step and render timing with an overrun counter | M3.4 |
| Levels or rules change after costs were measured or a season opened | The level freeze at M2.9; the `CLAUDE.md` calibration rule; the runbook's freeze while a season is open (M5.5) | M2.9, M5.5 |
| A client or device on other rules than the season's takes a paid run that cannot settle | The season check before `startRun` (M5.2) and the device's Hello check (M5.4); a season-bound referee (M0.7, M4.5) | M5.4 |
| A USB disconnect or a page reload mid-level makes the whole run late | The level's journal is closed as README §7.2 specifies, so its ticks used follow the wall time (M0.7); a TickStats heartbeat (M3.2); IndexedDB persistence every second (M5.2); tested with a cut transcript and a simulated reload (M5.2, M5.4) | M5.4 |
| Browser timer lateness or background-tab throttling eats the commit slack | The absolute-deadline loop (M2.1); a hidden-tab warning (M5.2); the slack as a season parameter, sized from measurements (M5.5) | M5.5 |
| The commit slack is too tight for Pico players | Transition overhead measured in the emulator rehearsal and on a real Pico run (M5.4, round G1); the slack set before the season opens (M5.5) | M5.5 |
| Season deadlines pass while no agent session is running | `season-ops.yml` on a daily schedule, never cancelled mid-run, failing on insolvency; `send_later` reminders for the season checkpoints (M5.5, M5.6) | M5.6 |
| The settlement grace is too short for zk proving | Grace sized from M4.8's proving time per run and the expected settled runs (M5.5) | M5.5 |
| Close and claim fail on Sepolia when they first matter | `testnet-0` closed and claimed in a rehearsal before `testnet-1` opens (M5.5) | M5.5 |
| The run commitment computed in Solidity diverges from the core's, or the Solidity run nonce from its fixtures | The ethers fixtures of `vectors/derivations.json`, read by both (M1.2, M4.4); the run nonce in Solidity only, and the draw in the core only (P17) | M4.4 |
| Inputs copied from public journals or precomputed for every boss start (README §7.4) | D14: seeded boss randomness, so no two runs share a game (M1.18, M1.5) | M1.5 |
| Real-time bots dominate paid play (README §7.4) | The entry fee, D10 qualification, journals published at commit and replayable (P5, M5.3), the optional bot-advantage study (M4.13), observation in the season report (M5.6) | Not retired; observed in M5.6 |
| Ephemeral sessions lose tools, measurements, work in progress or the user's replies | The tiered bootstrap and hook (M0.2); draft-PR claims and checkpoints; `subscribe_pr_activity`, or a `resume M<x>` session, for (user) lines (§1.2); every measurement committed | M0.2 |
| Imported ethskills steer agents against the spec, fetch unreviewed text, or send project details to a third party | A separate PR with sha256 pins, conflicts listed, and the user's review (M0.3); `feedback` not imported; the `CLAUDE.md` rule against fetching from or sending to ethskills.com (M0.1); the README stays authoritative | M0.3 |
| Toolchain drift changes the referee's bytes, or a zkVM's rustc lags the pin | Pinned rustc, binaryen and cargo-stylus; `--locked`; sha256 compared across clean builds (M4.1); a core MSRV from the zkVM toolchains, built in CI (M0.2, M1.1) | M4.1 |
| Keys in the agent's environment | Testnet-only keys, stored per the secrets table (§1.3); the prover credential in its own capped account; the preflight refuses any other chain id (M4.16) | M4.14 |
| Preview URLs are reachable by anyone who has them, while the repository is private | Asked in round A1 (§15, question 19); Cloudflare Access on the Pages project if the user wants previews private | M2.2 |
| Web Serial works only in desktop Chrome and Edge | Documented in the dApp and in `docs/TESTNET.md`; browser play works everywhere and verifies the same way (README §7.1) | M5.4 |
| A consensus bug is found in a live season's referee, which is immutable and has no pause | Accepted residual on testnet (M0.7, M4.12); a procedure listed as a pre-mainnet prerequisite (§16) | Out of scope (pre-mainnet) |
| Unaudited contracts, and the regulatory exposure of a paid pot | Testnet with test ETH only; the residual risks in `ECONOMY.md` (M4.12); an audit, a legal read with geo-gating as its fallback, and key custody listed as pre-mainnet prerequisites | Out of scope (pre-mainnet) |

## 15. Open questions

Each question has a default in this plan, and the item that settles it unless the user decides otherwise.

| # | Question | Plan default | Settled in |
|---|---|---|---|
| 1 | README §3 and §7.3 give the verifier as `verify(journal) → outcome`. The referee also needs the level bytes, the season weights and, for zk, a proof. Accept the wider interface? | `verifyRun` for a whole run and `verify` per level, both returning Outcomes with the decoded header fields and the draw slot, plus a `rulesVersion()` view | M0.7 |
| 2 | Settlement must check that each level is the one the draw assigned. Should the contracts compute the draw too? | No. The core returns `drawSlot`, the contract looks up each weight by level id and checks the slot, so the draw has one implementation. Either backend can return it, since both run the core. A Solidity draw only if the user prefers it. | M0.7, M4.4 |
| 3 | The deadline needs the sum of ticks used, which only replay reveals. Does ranking a run require all six levels to be settled? | Yes | M0.7 |
| 4 | README §7.3 says journals are published so anyone can replay them, but the commit carries only a hash. Where are they published? | In the `commitRun` calldata, which keeps README §7.3, §7.4 and §8.4. Alternatives: an offchain public store, or settled runs only with the README amended. | M0.7 |
| 5 | Does the 1M gas gate cover `verify` alone, or settlement overhead too? | `verify` alone, over the gate set of §4; the overhead is recorded separately | M4.9 |
| 6 | Is a nitro-devnode on a GitHub Actions runner acceptable as README §7.3's "local Arbitrum node"? | Yes | M4.2 |
| 7 | If Stylus stays paused, "settled on testnet" needs ZkReferee with real proofs, possibly from a paid prover. Is that acceptable, or should M4 accept a settlement on the local node plus measured zk costs? | ZkReferee on Sepolia | M4.9 |
| 8 | If D2 = zk, proving needs credentials that cannot live in a browser. Who proves, and how do run files reach the prover? | The operator, through `season-ops.yml`. Players hand off their run file through a channel named in `docs/TESTNET.md`, before a cutoff. | M5.5 |
| 9 | A 7-day testnet season, against ethblockdigger's 14 days? | Settled by the owner on 2026-10-28: 14 days on testnet, likely on mainnet too | Owner, 2026-10-28 |
| 10 | When does `RULES_VERSION` bump during development? | On every behavior change: one that moves a committed vector's outcome, error code or trace, or implements a rule edit made after the rule was first implemented. First implementations of frozen rules don't bump it. M1.9's gate enforces this. | M0.5 |
| 11 | The 60 × 60 grid fills the whole 240 × 240 screen, which leaves no room for a HUD during play. | Between-level screens, plus a brief overlay at level start | M3.5 |
| 12 | The Pico has no chain access, but Training uses the season's scoring. How does it get the weights? | Baked into each firmware build from the calibration file; sending them over USB can come later | M3.5 |
| 13 | What happens if the USB link drops, or the page reloads, mid-level in a Challenge run? | The level's journal is closed with the events received and an X at tick max(n, e + 1), where n is the ticks known to be processed and e the last event's tick, or with no X if the level has already ended (README §7.2), so the level keeps its claim and its ticks used follow the wall time; the run continues at the next level | M5.2, M5.4 |
| 14 | README §5 says the 16 levels are authored with the editor, but an agent cannot drive a GUI reliably. | ASCII sources compiled by the core codec, with the editor producing the same bytes; README §5 is amended | M2.4 |
| 15 | `GUIDELINES.md` references Cometh's `AGENTS_COMETH.md`. Copy it from ethblockdigger, or drop the reference? | Copy it | M0.1 |
| 16 | Neither repository has a license file. Which license applies? | Settled by the owner on 2026-10-28: MIT | Owner, 2026-10-28; committed in M0.1 |
| 17 | The hat also fits the Pico 2 (RP2350). Is it in scope? | RP2040 only | Not scheduled |
| 18 | The repository is private, in an organization whose private repositories share 2,000 Actions minutes a month on the free plan, on 2-vCPU runners, with no branch protection or GitHub Pages. Can it be public, or which plan and spending limit apply? | Settled by the owner on 2026-10-28: private, on the free plan's minutes with the private CI profile, until a working version exists; then public, with the public CI profile | Owner, 2026-10-28; recorded in M0.2 (P14) |
| 19 | Cloudflare Pages previews are reachable by anyone who has the URL. Is that acceptable while the repository is private? | Settled by the owner on 2026-10-28: yes, previews stay public | Owner, 2026-10-28; applied in M2.2 |
| 20 | `skills-import.md` lists the ethskills `feedback` skill, which has no `name` field and posts notes to ethskills.com. Import it? | No; it is marked "not imported" | M0.3 |
| 21 | Settle a run in one transaction, or level by level? | One `settleRun` per run, which on zk means one proof per run as README §7.3 says; `settleLevel` stays as the fallback | M0.7 |

## 16. Deferred work

- **Superchallenge** (M6, D11). It stays in [`TODO.md`](TODO.md), which keeps its analysis and the bounty-rounds proposal. It needs its own design pass and a legal read before any work starts. Until then, v1 decoders reject journal mode 2 (M0.5). When it comes back, it reuses the level format and validity check (M1.3), the level tool and editor (M2.4, M2.5), and ethblockdigger's `MapNFT` and map renderer.
- **Proving service** (a later version): a third-party service that proves runs through an API and settles them for the player, with gasless claims, which need a new `Season` generation with signed claims and a relay-fee cap. Its design is in README §7.5.
- **Stylus gas optimization while activations are paused.** If M4.9's gate fails while activations are paused, M4.15 is marked "deferred" and runs when activations reopen, before any Stylus season.
- **Pre-mainnet prerequisites** (not scheduled; listed in `docs/ECONOMY.md` from M0.7):
  - a professional audit of the contracts;
  - a legal read of the paid prize pool, with geo-gating as the fallback if the read requires it;
  - custody of the operator key behind `Season.open` and of the treasury address, for example a multisig;
  - a procedure for a consensus bug found in a live season's referee, which is immutable and has no pause;
  - an Arbitrum One deployment in native ETH, with seasons of likely 14 days, whose first season takes its weights from bot data (M0.7);
  - weights for later seasons from the previous season's public journals plus bot data (README §8.4), through a `calibrate --from-season <season>` mode;
  - fresh entropy per level (README §7.4);
  - journal signing with a device key on the RP2350 (README §7.1);
  - season proof aggregation, if M4.9 did not adopt it for testnet and zk becomes the mainnet path;
  - a reactivation policy for the Stylus referee.
