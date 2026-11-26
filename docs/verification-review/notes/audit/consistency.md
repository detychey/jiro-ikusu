# Consistency audit of the verification path

Lens: spec, code and test consistency of how level completion is verified, and what was never verified.
Repository: `the repository root` at `f52a60a` (2026-11-10). Read-only: these probes changed nothing in the repository, and `git status --porcelain` is empty at the end. One gitignored cache file, `target/.rustc_info.json`, changed at 13:40:08 UTC during the audit; these probes ran cargo once, at 13:38, with its target directory in the scratchpad, so that write came from another process working in the same checkout.

## 0. Method and limits

Read: README §3, §6, §7, §8.2, §8.4; `contracts/src/{interfaces/IReferee,ZkReferee,Challenge,Season,RunDerivations,ArbBlockhashEntropy}.sol`; `contracts/test/{ZkReferee,ZkVerify}.t.sol`; `referee/zk/{README.md,guest/src,host/src,host/tests}`; `referee/stylus/src/lib.rs`; `core/src/{game,hash,replay,recorder,journal,level,seed,boss,minion,grid,player,hits,capture,types,consts}.rs`; `tools/src/{difffuzz,preimage,replay,random}.rs`; `web/wasm/src/lib.rs`, `web/src/core.ts`, `web/src/pages/settle.ts`, `web/test/{vectors,difffuzz,wasm}.mjs`; `vectors/README.md`, `vectors/COVERAGE.md`; `docs/VERIFICATION.md` (zkVM trials, zk costs, D2, ZkReferee, Run file v1), `docs/DEPLOYMENT.md`, `docs/ECONOMY.md`; `seasons/`, `deployments/`, `contracts/test/fixtures/`; `.github/workflows/{ci,zk-prove,nightly,e2e}.yml`; plan items M4.14 and M5.5.

Ran (all outside the repository):

- `scratchpad/audit/wasm_probe.mjs`: the prebuilt `target/wasm32-unknown-unknown/release/jiro_wasm.wasm` (28,250 bytes) under Node 22.
- `scratchpad/audit/run_check.mjs`: replays the two proven Challenge runs in that wasm and compares with the proofs' public values.
- `scratchpad/audit/restore-check/src/main.rs`: a 257-line Rust probe that depends on `jiro-core` by path, built offline with `CARGO_TARGET_DIR=scratchpad/audit/target`.

Could not verify:

- **Foundry tests.** `forge` is not installed and the three submodules of `contracts/lib/` are not checked out (`git submodule status` shows them uninitialized). Every statement about what a Foundry test does comes from reading the test, and every statement that tests pass comes from `docs/VERIFICATION.md`.
- **The RISC Zero verifier's Solidity source** (not in this checkout). That it requires exit code `Halted(0)` is taken from `docs/VERIFICATION.md:389`.
- **Any seal.** No proof was verified here; the public values were.
- The zk host was not built, Docker was not run, nothing was fetched.

## 1. What was actually exercised

Decoded from `contracts/test/fixtures/zk-proofs.json` and `seasons/testnet-0/runs/run-1.proof.json` (each is `12 × 32` bytes per level), and read from the proving tables.

| Real Groth16 proof | Mode | Journal mode | Ticks | Segments | Proving cycles | Wall time | Where it was verified |
|---|---|---|---:|---:|---:|---:|---|
| `commit-at-tick-0` (`.level`) | level | Training (0) | 1 | 3 at 2^19 | 1,310,720 | 2,128 s, 2 vCPUs | forge, `cast` on both chains |
| six smallest vectors (`.run`) | run | Training (0), all `levelIndex` 0 | 1+6+7+20+11+10 = 55 | 15 at 2^19 (7 at 2^20 in the container) | 7,602,176 (7,340,032) | 10,168 s (3,297 s) | forge, `cast` |
| `worst-case` (`.worstCase`) | level | Training (0) | 2,700 | 28 | 29,360,128 | 13,177 s, 4 CPUs | forge, `cast` |
| `zk-run.json` (`.challengeRun`) | run | Challenge (1) | 91+61+31+91+31+262 = 567 | 16 | 16,777,216 | 7,638 s | forge `settleRun`, fork rehearsal |
| testnet-0 run 1 | run | Challenge (1) | 183+31+31+31+31+31 = 338 | 13 | 13,631,488 | about 74.5 min (4,515 s offline) | `settleRun` on Arbitrum Sepolia |

Sources: `docs/VERIFICATION.md:697-704`, `:969-990`; `docs/DEPLOYMENT.md:173-178`. The M1.17 trial also proved `commit-at-tick-0` under its own guest, in 2 to 3 segments (`docs/VERIFICATION.md:496-512`).

What the real work looks like, executed only (`docs/DEPLOYMENT.md:241-250`, "Executed (not proven)"; `docs/VERIFICATION.md:917-926`):

| Input | Ticks | Segments | Proving cycles | Estimated proof |
|---|---:|---:|---:|---|
| three whole six-clear bot runs | 3,181 to 4,710 | 67 to 81 | 69,468,160 to 84,934,656 | 8.7 to 10.6 h |
| heaviest gate-set run | 15,240 (five levels of 2,700 and one of 1,740) | 131 | 136,445,952 | 16 to 17 h |

So:

- The largest real proof of any kind has 28 segments. The largest run-mode proof has 16.
- No whole bot run was ever proven. Both Challenge-mode proofs are of runs cut short on purpose: `docs/VERIFICATION.md:971` ("To keep the proof to about two hours on 4 CPUs, the first five levels were then closed at tick c by an X") and `docs/DEPLOYMENT.md:97` (`--short` "closes the other five at tick 30").
- The run settled on Sepolia is 338 ticks: 2.1 % of a run's 16,200-tick maximum, 7 to 11 % of the whole bot runs' ticks, 16 to 20 % of their proving cycles.

Paths by the strongest evidence each has:

| Path | Real Groth16 seal | Dev-mode seal, mock verifier | Executor or mock referee only |
|---|---|---|---|
| `settleRun`, shortened bot run | Sepolia run 1; forge and fork with the fixture run | | |
| `settleRun`, whole bot run | never | anvil, `e2e.mjs --zk`: 3,783 ticks, 6 clears (`docs/VERIFICATION.md:1020`) | three runs executed |
| `settleLevel` | never | anvil, the fallback run: 3,445 ticks | 22 Foundry tests, all on MockReferee |
| late run, copied journal, wrong rules version | never | anvil | Foundry on MockReferee |
| journal recorded by the browser's Recorder | never | `web/scripts/challenge-e2e.mjs`, local zk backend (`web/README.md:196-200`) | |
| run played by a person | never | never | never (plan `IMPLEMENTATION_PLAN.md:2053`, pending) |
| full-size `settleRun` (about 53 KB of calldata) | never: largest sent is 7,300 B on Sepolia | 10,084 B on anvil | 25,636 B in forge with MockReferee |
| a proof bought on Boundless | never (`docs/VERIFICATION.md:771`, "No request was made") | | |
| proof on a GPU | never (no GPU in either environment) | | |

Checked here: `run_check.mjs` replays both Challenge runs in the wasm core at their season's weights, and each level's `(weightBp, Outcome)` words equal the proof's public values byte for byte (run 1: score 20,310, 338 ticks, 1 clear; fixture run: 21,112, 567, 1).

## 2. Findings

Ids in the structured result: F1 `scale-1`, F2 `pipeline-1`, F3 `readme-1`, F4 `cost-1`, F5 `imageid-1`, F6 `settlelevel-1`, F7 `calldata-1`, F8 `binding-1`, F9 `statehash-1`. The result orders the medium findings F4, F5, F3, F6.

### F1 (high). No real-size run has ever been proven

- The proving times a season is planned on, 9 to 11 h for a real six-clear run and 16 to 17 h for the heaviest, are `segments × 467 s + 170 s` (`docs/DEPLOYMENT.md:252`), fitted on a 16-segment proof and applied to 67 to 131 segments.
- The per-segment rate is not stable: 396 to 410 s plus 51 to 57 s of recursion in M4.8 and M4.10, against 295 s plus 43 s for run 1, also in a 4-CPU agent container (`docs/DEPLOYMENT.md:178`: "faster than M4.10's 410 s and 57 s"). At the two rates a 67 to 81-segment run takes 6.3 to 10.5 h and the heaviest 12.3 to 17.0 h.
- Recursion over more than 28 segments, and the host's memory with 131 segment receipts, were never observed.
- The 16 levels' cycle counts are M1.12's executor figures, not a new run: `docs/VERIFICATION.md:896` ("the zk host was not rebuilt for M4.9"), with current values inferred from 14 small vectors ("the table's less 4").
- Differential agreement with the zk backend is at the executor: `referee/zk/host/src/main.rs:233-236` (`default_executor()`), 20 difffuzz cases in CI (`ci.yml:485-490`), 200 weekly (`nightly.yml:149`). That is the right tool for agreement; it says nothing about whether a real-size execution proves in the time and memory assumed.
- Plan M5.5 will present "the proving time of M4.14's bot run" to the owner for the proving-route decision (`IMPLEMENTATION_PLAN.md:1997`): that run is the 13-segment shortened one.

### F2 (high). The v1 settlement process the README describes is not built, and its capacity was never checked against the grace

- README §7.5 (`README.md:671`), present tense: "the operator rebuilds each committed run's file from chain data ... replays the runs offline with the core, then proves and settles each player's best run, on its own machines or through a hosted prover network on its own capped account".
- In the repository: `scripts/contracts/season.mjs:1` ("M5.5 adds status, close, withdraw and settle") and `:139-140` (only `open` is accepted). No prover-network credential exists: `docs/ECONOMY.md:83` ("No hosted prover credential exists: round F0 never ran, and the operator proves on its own machine").
- GitHub Actions cannot do it: `IMPLEMENTATION_PLAN.md:2008` ("Actions cannot prove whole runs ... GitHub-hosted jobs stop at 6 h").
- Money depends on one proof per qualified player, not on a few winners: the pot "is shared pro-rata by best-run score among the qualified players, those with a qualifying settled run" (`README.md:712`), and 99.2 % of the reference mix's runs qualify at `minClears` 1 (`docs/ECONOMY.md:123`).
- A player's best run is final only at the season's end, so unless the operator proves runs that a later run may supersede, the proving window is the grace. `seasons/testnet-0.json` has `"grace": 86400`: at 9 to 11 h per run, with 9.2 GiB per proof (one at a time on a 16 GB machine), one 4-CPU machine settles two real runs in that grace. `Season.MAX_GRACE` is 30 days (`contracts/src/Season.sol:46`): about 65 to 80 runs per machine per season.
- A run not settled by `end + grace` earns nothing, and `closeSeason` is permissionless one second later (`contracts/src/Season.sol:186-191`). Since shares are pro-rata among settled runs, every unsettled run raises the others' shares.
- The dApp contradicts the README today: `web/src/pages/settle.ts:175-178` tells the player "Send the operator the run file", where README §7.5 says "Players do nothing after committing". Plan M5.5 schedules the rewording (`IMPLEMENTATION_PLAN.md:2020`).

### F3 (medium). README §7 states costs and routes that the repository contradicts

1. `README.md:590`, the zk row of the cost table: "CPU proving takes about an hour on 4 CPUs for six small levels". Those six levels are the six smallest game vectors, 55 ticks in all, 3.7 s of play (decoded `.run` fixture). A real run is 9 to 11 h by the repository's own estimate (`docs/DEPLOYMENT.md:253`). The normative spec's only CPU figure is off by an order of magnitude.
2. `README.md:681`: "v1 can already use zk without running prover infrastructure, through the operator's hosted-prover account." No such account exists and no proof was ever bought (`docs/ECONOMY.md:83`, `docs/VERIFICATION.md:771`).
3. `README.md:671`: "Players do nothing after committing" against the dApp's "Send the operator the run file" (F2).
4. `README.md:7`, the status line: "a bot run was proven and settled end to end". It was a bot run with five of six levels closed at tick 30; `docs/DEPLOYMENT.md` says so, the status line does not.
5. `README.md:609`: "Stylus first, zk as the fallback". M4.9 measured a bot run's `settleRun` at 29,858,349 gas, "0.00060 ETH ($1.37), 12 times the fee" (`docs/VERIFICATION.md:943`), and every gate-set run above the 32M cap (`:928`). The optimization item M4.15 is deferred. Stylus is not a cheaper path waiting for a pause to lift.

### F4 (medium). The cost of one verified run is not known

- The headline, "0.0000345 ETH ($0.079), 69% of the fee" (`docs/VERIFICATION.md:943`, `README.md:607`), is 0.0000161 ETH of gas plus 0.0000184 ETH of proving.
- The proving price was never paid. It is the median of another requester's 176 to 196 million-cycle requests in a market of "two requesters, two provers"; "the `DigestMatch` requests near our sizes paid three times as much (p50 0.000055 ETH)" (`docs/VERIFICATION.md:771`), which alone is above the 0.00005 ETH fee.
- Arbitrum's L1 data fee is excluded and was never measured: `docs/VERIFICATION.md:933` ("before Arbitrum's L1 data fee, which neither M4.7 nor M4.16 measured"), `:826` (the dev node "sets the L1 price per unit to 0"), `docs/DEPLOYMENT.md:120` ("every receipt reports `gasUsedForL1` 0").
- The own-machine route has a time and no price: `docs/ECONOMY.md:42` lists seconds and GiB only.
- On the documents' own 69 %, testnet-0's 10 % rake (`seasons/testnet-0.json`, `rakeBp` 1000) pays for one verified run per 6.9 paid runs, and the 20 % cap for one per 3.5. Nothing in `docs/ECONOMY.md` states who pays when players play fewer runs than that.

### F5 (medium). Nothing ties the pinned image id to the source, and proving one's own run means reproducing the operator's build

- The image id depends on the checkout path: the build must run at `/home/runner/work/jiro-ikusu/jiro-ikusu`, from a root bind mount elsewhere (`referee/zk/README.md:58-65`), after a clean host build of about an hour (`ci.yml:407`), with RISC Zero's `r0.1.97.0` toolchain, then Docker and a 5.2 GB image that only Docker Hub serves, on x86 (`referee/zk/README.md:92`).
- The cause of the path dependence is a hypothesis: "The symbol names then most likely decide where the optimizer and linker place functions" (`docs/VERIFICATION.md:662`). The fix was observed on two environments.
- CI prints the id and never compares it (`ci.yml:477-495`). `contracts/test/ZkReferee.t.sol:34` builds the referee from the fixture's own `imageId`, so the Foundry suite stays green whatever the guest becomes. `deployments/arbitrum-sepolia.json` records no image id. Commit `2b647a0` asserts in prose that "the zk referee's image id does not move".
- The guest ELF is not published by the repository. "Any player can still prove and settle their own run" (`README.md:671`) has only ever been done by the operator's container.

### F6 (medium). `settleLevel` has never run with a real proof, and zk does not need it

- The two real level proofs are of Training-mode vectors (`mode` 0 in both, decoded), which `Challenge.checkOutcome` must reject (`contracts/src/Challenge.sol:254`). `contracts/test/ZkReferee.t.sol:195-206` calls `ZkReferee.verify` directly, never `Challenge.settleLevel`; the file does not contain the word `settleLevel`.
- The zk `settleLevel` path ran only with dev-mode seals against `RiscZeroMockVerifier` on anvil (`docs/VERIFICATION.md:1020`), in a CI job the PR that added it did not run (`:1030`, "Because of the minutes budget, this PR does not run it").
- On zk a run proof always fits one transaction: a 260-byte seal and 2,304 bytes of public values. Six level proofs cost six provings, "220%" of the fee (`docs/VERIFICATION.md:769`). The fallback exists for Stylus's gas, yet it is deployed, immutable, in the zk generation (`contracts/src/Challenge.sol:176-202`, with a per-run bitmask and a partial-settlement state).

### F7 (low). The zk settlement uploads what it only hashes

- `IReferee` is shaped for a replaying referee. On zk, `settleRun` still takes the six level byte strings and the six journals, and `ZkReferee` only hashes them to compare with the public values (`contracts/src/ZkReferee.sol:88-91`), after `Challenge` hashed the same bytes (`contracts/src/Challenge.sol:153`, `:220`).
- The journals were already published in `commitRun`'s calldata, their hashes are words of the public values, and the level ids are in the season. A zk settlement needs the public values and the seal: about 3 KB, against 7,300 bytes for run 1 and about 53 KB for a full run.
- As built, calldata is 353,908 of the 576,603 gas of M4.7's `settleRun` outside the referee (`docs/VERIFICATION.md:815`), and a full run carries about 53 KB (`README.md:649`), plus the unmeasured L1 data fee on it.

### F8 (low). Binding warts

The binding itself is sound (§3). Warts:

- `ZkReferee.rulesVersion` is a free constructor argument (`contracts/src/ZkReferee.sol:35-41`), known as finding 2 of `docs/ECONOMY.md` §6. `test_RulesVersion_IsTheProgramsVersion` (`contracts/test/ZkReferee.t.sol:219-221`) asserts only that the constructor's value is echoed; its name claims more.
- A level proof and a run proof are told apart by the length of the public values only (`contracts/src/ZkReferee.sol:69-72`). It works because every field is static; the comment at `:7-9` relies on that silently.
- The committed proof file embeds the build path (`seasons/testnet-0/runs/run-1.proof.json`, `runFile`).

### F9 (low). The per-tick state hash is not a checkpoint format yet

It is declared test-only (`README.md:441`, `core/src/hash.rs:1-2`), and as shipped it cannot anchor anything lighter without new consensus code. See §5: encoder only, level start not hashed, tick field ambiguous at level start, six fields outside it, flat digest. This is a fact for the redesign more than a defect of today's path.

## 3. Public values: the check for ambiguity

Chain of binding, each link read in the code:

1. **Seal to program and values.** `verifier.verify(seal, imageId, sha256(publicValues))` (`contracts/src/ZkReferee.sol:73`), with `imageId` and `verifier` immutable (`:24-25`).
2. **All or nothing.** The guest replays every level, then commits once (`referee/zk/guest/src/bin/verify.rs:13-21`). A rejected journal panics before any commit, so no receipt with exit code 0 exists for it.
3. **Fixed layout.** Twelve 32-byte words per level, numbers left-padded (`referee/zk/guest/src/lib.rs:51-73`); the count is 1 or 6 and anything else panics (`:18`, `:26-29`); the contract requires exactly 384 or 2,304 bytes (`contracts/src/ZkReferee.sol:71-72`). No length prefix, no dynamic field, so one byte string has one reading.
4. **Values to the submitted bytes.** Per level: the weight, `keccak256(journal)` and `keccak256(level)` (`contracts/src/ZkReferee.sol:87-91`). The Outcome's `journalHash` is the hash of the bytes the guest replayed (`core/src/replay.rs:71`), and replay rejects a header whose `levelId` is not the hash of the level bytes (`core/src/replay.rs:47-49`).
5. **Outcome to the run.** `Challenge.checkOutcome` requires the run's nonce, `levelIndex` i, mode 1, the season's rules version and the level's draw slot (`contracts/src/Challenge.sol:250-258`).
6. **Nonce to one run.** The entropy mixes `msg.sender` and the id (`contracts/src/ArbBlockhashEntropy.sol:55`), and the id is `keccak256(address(this), runId)` (`contracts/src/Challenge.sol:206-208`), so a run nonce belongs to one `Challenge` and one run id. The public values carry no chain id or contract address of their own and do not need one.

Result: no ambiguity found that would let a proof stand for another level, journal, weight, run or position. The negative tests cover a tampered score, another image id, another weight, another level, another journal and the two length mix-ups (`contracts/test/ZkReferee.t.sol:112-215`). The warts are F8.

Not checked here: the verifier contract's own source, and any seal.

## 4. What the documents themselves say was not measured

| Not measured | Where it is said |
|---|---|
| Arbitrum's L1 data fee, on any transaction | `docs/VERIFICATION.md:790`, `:820`, `:826`, `:933`; `docs/DEPLOYMENT.md:24`, `:120` |
| A Boundless request | `docs/VERIFICATION.md:771`; `docs/ECONOMY.md:83` |
| A whole bot run's proof | `docs/DEPLOYMENT.md:241` ("Executed (not proven)") |
| `worst-case` on a runner | `docs/VERIFICATION.md:709` ("was not proven") |
| The 16 levels' cycles on the current guest | `docs/VERIFICATION.md:896` |
| Aggregation's proving side | `docs/VERIFICATION.md:779` ("Not run here ... their proving time is not measured") |
| The `e2e-zk` job | `docs/VERIFICATION.md:1030` |
| Settlement gas against anvil's receipts | `docs/VERIFICATION.md:821` ("Not cross-checked on anvil") |
| RISC Zero's keccak accelerator | `docs/VERIFICATION.md:407` ("was not tried") |
| RISC Zero's Docker guest build | `docs/VERIFICATION.md:691` ("was not used") |
| A human baseline | `docs/ECONOMY.md:136` (two Training journals) |

The documents are candid about each of these. The gap is in the README, which carries the conclusions without the caveats (F3).

## 5. Facts for lighter schemes

### 5.1 The preimage is a complete checkpoint, but only an encoder exists

- `core/src/hash.rs:14` (`preimage`) and `:72` (`state_hash`) are the whole module. There is no decoder. `tools/src/preimage.rs:72-109` reads a preimage field by field to describe or diff it; it builds no `Game`.
- `Game`'s fields are public except `stack` (`core/src/game.rs:27-47`), so a `Game` cannot be built literally outside the crate; `Game::new` (`:53`) is the only constructor, and it validates the level.
- **Measured:** `restore-check` restores a `Game` from (level bytes, run nonce, level index, preimage) with public items only (`Game::new`, then `Grid::set`, and the public fields of `Player`, `Boss`, `Minions`, `Game`), calls `Game::step` once and compares with the next recorded preimage and state hash. Result over the 71 accepted game vectors of `vectors/game/` and `vectors/levels/`: `88776 single steps from restored preimages, 71 level starts, 0 failures`. So there is no hidden state: the capture stack is scratch.
- A tick changes 7.3 bytes of the preimage on average and 527 at most (same run). 900 of the 948 bytes are the grid.

### 5.2 `Game::step` is public and takes the tick's mask

- `pub fn step(&mut self, mask: InputMask) -> Result<Option<EndReason>, Error>` (`core/src/game.rs:82`).
- The mask of the next tick is local: the journal event at index `events_applied` if its tick equals `ticks_used`, else the mask in force (`core/src/replay.rs:53-60`; the probe uses exactly this rule and matches on every step). Both values are in the preimage ("next event index", "input mask", "tick").
- Events are 3 bytes at offset `71 + 3k` (`core/src/journal.rs:154-159`), so one step needs one event. The run commitment is a flat `keccak256` of six flat journal hashes (`core/src/journal.rs:176-184`), so showing one event onchain today means sending the whole journal, 8,171 bytes at most.

### 5.3 Outside the preimage

| Missing | Where it lives | Source |
|---|---|---|
| deflection key | `Boss.deflection_key` (`core/src/boss.rs:19-20`) | level seed: run nonce and level index (`core/src/seed.rs:57-59`) |
| minion spawn cells | `Minion.spawn` (`core/src/minion.rs:26`) | level bytes |
| respawn delay | `Minions.respawn_delay` (`core/src/minion.rs:41`) | level bytes |
| target and time limit | `Game.target_bp`, `Game.time_limit` (`core/src/game.rs:43-44`) | level bytes |
| end reason | `Game.end` (`core/src/game.rs:45`) | the step's return value |
| capture stack | `Game.stack` (`core/src/game.rs:46`) | scratch, rewritten by each fill |

README §6.4 names only the deflection key as absent (`README.md:471`). Boss size, boss period, minion period and claimable cells are level constants that the preimage repeats.

### 5.4 Level start and the first hash

- The trace starts after tick 0: `observe` runs after `step` (`core/src/replay.rs:60-61`). The level-start state is never hashed.
- Its preimage would carry tick 0 as well: `ticks_used.saturating_sub(1)` (`core/src/hash.rs:21`); the probe confirms the tick field of `Game::new`'s preimage equals tick 0's. A scheme that commits to the start state needs another marker.
- Level start is `Game::new`: decode, validity (a flood fill of the open area), level seed, boss start, minion orientation (`core/src/game.rs:53-73`, `core/src/level.rs:187-216`). In the zkVM it costs about 1.1 million cycles before the first tick (`docs/VERIFICATION.md:403`), two segments on its own.
- `Game::new` then one `step` gives the first recorded preimage on all 71 vectors (probe).

### 5.5 The last hash and the Outcome

The Outcome is a function of the last preimage, the level's target and time limit, the journal header and the weight (`core/src/replay.rs:69-85`):

- `claimBp` = captured × 10,000 / claimable, both in the preimage; `ticksUsed` = tick + 1;
- `endReason`: X in the mask gives Committed; else claim at or above the target gives Cleared; else no lives gives OutOfLives; else TimeLimit at tick `time_limit − 1`. The probe derives it this way on the 71 vectors, and no earlier preimage looks final by the same rule;
- the journal is accepted only if the last "next event index" equals `eventCount` (`core/src/replay.rs:66-68`).

The end reason is not in the preimage and the Outcome is not in the trace.

### 5.6 What the browser already produces

- `Core.replay(level, journal, weightBp)` returns the Outcome and the trace of 32-byte state hashes of every tick (`web/src/core.ts:280-291`, `web/wasm/src/lib.rs:733-758`), one level per call, up to 86,400 bytes; a run is six calls, up to 518,400 bytes.
- The wasm also exports `replay_preimage(…, tick)` and `state_preimage()` (`web/wasm/src/lib.rs:687-697`, `:781-805`); `web/src/core.ts:19-68` does not declare them yet.
- **Measured** with `wasm_probe.mjs`: 18 to 24 ms per 2,700-tick level with the trace, 0.3 to 3.2 ms without the hashes; the 32 gate-set levels, 71,490 ticks, in 589 ms including JSON parsing. A whole run with its trace is about 0.15 s.
- The trace's digest is a flat keccak (`traceKeccak`, `vectors/README.md:20`); there is no Merkle root over ticks.
- The trace is already a cross-target artifact: native, wasm and the RISC Zero executor's trace guest reproduce it on the 75 vectors and on the difffuzz cases (`web/test/vectors.mjs:150-153`, `referee/zk/host/src/main.rs:117-124`).

### 5.7 Cost of state hashing and of the smallest proof in this zkVM

- With the per-tick state hash, `open-field-empty` takes 448,195,877 user cycles against 2,002,964 without (`docs/VERIFICATION.md:432`): about 165,000 cycles per tick for one keccak of 948 bytes in software (`:407`); over every vector of 100 ticks or more in the two tables the figure is 165,257 to 169,415. Game logic is about 330 cycles on a quiet tick and about 930 with an event on every tick (`full-journal`, `:428`). A per-tick hash inside this guest would multiply the cycles by 14 to 224 on the vectors of 1,000 ticks or more (`09-synthetic`, `open-field-empty`).
- The smallest proof ever made, a one-tick level, took 1,282 s on 4 CPUs and 2,128 to 2,160 s on 2 vCPUs, at 4.6 to 9.2 GiB, then 5.5 to 7.0 GiB for Groth16 (5,661 to 7,207 MiB sampled) (`docs/VERIFICATION.md:502`, `:512`, `:701`). For the Groth16 step, "there is no native CPU route": Docker on x86, or CUDA (`:508`).
- So in this stack nothing can be proven in a browser tab, however small the statement: the floor is tens of minutes, gigabytes and a container.

### 5.8 Structure a new scheme can reuse

- The six levels are independent replays (`referee/zk/README.md:26`); `verify` and `settleLevel` already exist per level.
- The deadline needs Σ `ticksUsed` (`contracts/src/Challenge.sol:285-287`), so any scheme must bind each level's ticks used.
- The contracts are immutable and a season's referee is fixed at `open`: a new scheme is a new generation and a new season (`docs/DEPLOYMENT.md:191-195`). It needs no rule change as long as `core/src` stays as it is; a state decoder in the core would be new consensus code under `STATE_HASH_VERSION` 1 (`core/src/hash.rs:9`).
- On Stylus a level's heavier gate-set journal costs 5.1M to 11.6M gas for 1,233 to 2,700 ticks, a few thousand gas per tick on average (`docs/VERIFICATION.md:921-923`), but new activations are paused.

## 6. What the design gets right

1. **One core, pinned by per-tick traces.** 75 golden vectors with a state hash per tick, and seeded random cases, reproduced tick for tick by native, wasm and the RISC Zero executor, and by Outcome on the Stylus build, which computes no state hash (`vectors/README.md`, `web/test/vectors.mjs:133-154`, `referee/zk/host/src/main.rs:112-145`, `referee/stylus/src/lib.rs:7`). The two proven runs replay to the same bytes in wasm (§1).
2. **The binding of proof to run** (§3): fixed-width public values, one commit after all six replays, a panic on any rejection, and the contract's own checks of nonce, index, mode, rules version and draw slot.
3. **Journals published at commit.** `commitRun` stores a commitment and publishes the bytes (`contracts/src/Challenge.sol:130-143`), so anyone replays any run for free and settlement is decoupled from play.
4. **A pinned verifier, never the router.** The image id and RISC Zero's emergency stop are immutables (`contracts/src/ZkReferee.sol:24-26`); rejections revert, anyone may settle, the credit goes to the run's player.
5. **Candid measurements.** `docs/VERIFICATION.md` and `docs/DEPLOYMENT.md` record what was executed, what was proven and what was skipped, with run links. Every gap in §4 was found by reading them.

## 7. Dependency inventory of today's path

| Dependency | Evidence |
|---|---|
| RISC Zero 3.0.6: 453 packages in the host's lockfile, 157 in the guest's; the core alone needs `tiny-keccak` | `referee/zk/Cargo.lock`, `referee/zk/guest/Cargo.lock`, `core/Cargo.toml` |
| RISC Zero's `r0.1.97.0` Rust toolchain and the system `g++`; clean build about 63 minutes | `ci.yml:407`, `docs/VERIFICATION.md:366-373` |
| One fixed absolute build path, root for the bind mount | `referee/zk/README.md:58-65` |
| Docker on x86 and `risczero/risc0-groth16-prover:v2025-04-03.1`, 5.2 GB, Docker Hub only; `429` seen twice | `referee/zk/README.md:92`, `docs/VERIFICATION.md:371`, `:691` |
| 9.2 GiB of RAM (4.6 GiB with 2^19 segments), then about 7 GiB; 4 CPUs for 9 to 17 h per run | `docs/VERIFICATION.md:697-708`, `docs/DEPLOYMENT.md:253` |
| RISC Zero's deployed verifier and emergency stop on Arbitrum, whose owner can stop it for good | `docs/ECONOMY.md:83`, `docs/DEPLOYMENT.md:195-196` |
| `risc0-ethereum` v3.0.1 and OpenZeppelin as submodules | `.gitmodules`, `contracts/foundry.toml` |
| Optional and unused: Boundless on Base, a funded wallet, a public program URL | `docs/VERIFICATION.md:771` |

Against it, the replay itself: a 28,250-byte wasm module and 20 ms per level.

## 8. Probe outputs

```text
$ node wasm_probe.mjs the repository root
wasm bytes: 28250
vectors/levels/10-worst.json      2700 ticks  23.6 ms with the trace   3.2 ms for one preimage
vectors/game/worst-case.json      2700 ticks  21.5 ms                  2.8 ms
vectors/game/full-journal.json    2700 ticks  18.5 ms                  0.26 ms
vectors/game/open-field-empty.json 2700 ticks 20.5 ms                  0.32 ms
vectors/levels/16-worst.json      2700 ticks  22.9 ms                  2.5 ms
gate set: 32 levels, 71490 ticks, 588.5 ms in all (JSON parsing included)

$ node run_check.mjs … seasons/testnet-0/runs/run-1.json seasons/testnet-0.json seasons/testnet-0/runs/run-1.proof.json
run 1: score 20310, ticks 338, clears 1, journals 723 bytes, trace 10816 bytes; public values match the wasm replay: true

$ node run_check.mjs … contracts/test/fixtures/zk-run.json seasons/calibration-1.json contracts/test/fixtures/zk-proofs.json challengeRun
run 1: score 21112, ticks 567, clears 1, journals 879 bytes, trace 18144 bytes; public values match the wasm replay: true

$ restore-check vectors/game/*.json vectors/levels/*.json
restore-check: 71 accepted vectors (4 rejected ones skipped), 88776 single steps from restored preimages, 71 level starts, 0 failures; preimage bytes changed per tick: mean 7.3, max 527
```

Timings are from this container (Node 22.23.4), one run each; they are orders of magnitude, not benchmarks.
