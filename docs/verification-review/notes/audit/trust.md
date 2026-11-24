# Audit notes: trust model, soundness and liveness of settlement

Lens: who and what an honest player depends on to be paid, whether a score can be forged, and what happens to a live season and its pot when a dependency fails.
Repository: `the repository root` at `f52a60a` (no change to `core/`, `referee/` or `contracts/src/` since the deployed commit `ca76f8f`).
Date of the review: 2026-11-10. Read-only: nothing in the repository was modified.

## Bottom line from this lens

- **Soundness is good.** A settled score is one that the committed journals produce, unless RISC Zero's proof system, its trusted setup or the pinned image id is wrong. No contract defect was found. Keep the binding, the pinned stop, permissionless settlement and the published journals (section 6).
- **Liveness is the weak side.** Every paid player needs a 9 to 17 hour proof, made in practice by one party who loses money on it, before a cutoff nothing can move, through a verifier that a third party can stop for good. When any of these fails, the rule in section 3 pays the pot to whoever was settled, or parks it.
- **Verify by exception is not an exception here.** With pro-rata payout to every qualified wallet, it means one proof per paying wallet (finding live-1).
- **The browser cannot make this proof.** The smallest proof of this guest, a one-tick level, takes 21 to 36 minutes with 4.6 to 9.2 GiB and then about 7 GiB in an x86 Docker image (section 7, fact 4).
- **What a lighter scheme has to change, whatever its form.** Either the proof becomes cheap enough for the player to make, or the liveness assumption moves from "a prover must act for every paid player" to "someone must act only when a claim is wrong". In both cases the scheme must say what happens when its verifier is paused: a clock that stops is recoverable, a cutoff that passes is not.

## 0. Method and limits

Read in full: README §7 and §8, `contracts/src/{Challenge,Season,ZkReferee,RunDerivations,ArbBlockhashEntropy}.sol`, `contracts/src/interfaces/IReferee.sol`, the mocks, `contracts/test/{Settlement,ZkReferee,ZkVerify,Invariant}.t.sol`, `docs/ECONOMY.md`, `docs/DEPLOYMENT.md`, `docs/VERIFICATION.md` (zk sections, D2, ZkReferee, run file), `deployments/`, `seasons/testnet-0.json` and its run and proof, `referee/zk/` (guest, host `prove.rs`, README), `core/src/{replay,journal,seed,game,hash}.rs`, `scripts/contracts/{deploy,preflight,season}.mjs`, the settlement and leaderboard code of `web/src/`, and plan items M5.3 and M5.5.

Not done, so not claimed:

- No Foundry test was run: `forge` is not installed here and the three submodules under `contracts/lib/` are empty directories. Test behavior is taken from the test sources.
- The zk host was not built and Docker was not run, as instructed.
- Three read-only checks went outside the repository, none carrying project data:
  1. RISC Zero's `RiscZeroVerifierEmergencyStop.sol` and `contracts/deployment.toml` at commit `365e7b2d` of `risc0-ethereum`, the revision `contracts/foundry.lock` pins (tag `v3.0.1`), fetched from GitHub because the submodule is not checked out. Copies are in `scratchpad/audit/ext/`.
  2. `eth_call` on the public RPCs of Arbitrum One (block about 522,983,300) and Arbitrum Sepolia (block about 327,878,000), at about 13:00 UTC: `owner()`, `paused()` and `verifier()` of the two pinned emergency stops, the code and nonce of their owners, `paused()` of the older stops on Arbitrum One, and `verifier()` and `imageId()` of the deployed `ZkReferee`.
- The Groth16 trusted setup was not investigated beyond noting that the repository never mentions it.

## 1. What a proof binds, and what each layer checks

| Layer | What it checks or commits | Where |
|---|---|---|
| Guest `verify` (the proven program) | Reads a count that must be 1 or 6, then per level the level bytes, the journal bytes and `weightBp`. Calls the core's `replay`, and panics on any rejection, so no receipt exists for a rejected level or journal. Commits per level 12 ABI words: `weightBp`, `journalHash`, `levelId`, `runNonce`, `levelIndex`, `drawSlot`, `mode`, `rulesVersion`, `endReason`, `claimBp`, `ticksUsed`, `levelScore`. | `referee/zk/guest/src/bin/verify.rs:12-22`, `referee/zk/guest/src/lib.rs:18,24-37,51-67` |
| Core `replay` | Journal decoding (version, rules version equal to the compiled `RULES_VERSION`, mode, level index below 6, event count, exact length, event rules); level decoding and validity; `keccak256(level bytes)` equal to the header's level id; no event at or past the time limit, none after the end; the draw slot from `draw(runNonce)[levelIndex]`; the score from claim and weight. `journalHash` and `levelId` are both computed inside the guest. | `core/src/replay.rs:37-86`, `core/src/journal.rs:55-94`, `core/src/seed.rs:64-76` |
| RISC Zero verifier, through its emergency stop | `verify(seal, imageId, sha256(publicValues))`: the 260-byte Groth16 seal proves that the program of `imageId` halted successfully with those public values. Reverts when the stop is paused. | `contracts/src/ZkReferee.sol:69-75`; stop source at `365e7b2d` |
| `ZkReferee` | Public values are exactly 384 bytes per level, so a level proof and a run proof cannot stand in for each other. Per level: proven weight equals the submitted weight, proven `journalHash` equals `keccak256` of the submitted journal, proven `levelId` equals `keccak256` of the submitted level. Image id, verifier and rules version are immutables. | `contracts/src/ZkReferee.sol:22-26,44-94` |
| `Challenge.settleRun` | The run is committed, unsettled, and `block.timestamp ≤ end + grace`. The keccak of the six journal hashes equals the stored commitment. Each level id is one of the season's 16, which gives its slot and weight. Each Outcome has the run's nonce, `levelIndex = i`, `mode = 1`, the season's rules version and `drawSlot = slot`. Sums score, ticks and clears. Late if `committedAt > revealedAt + ceil(ticks / 15) + commitSlack`, otherwise `Season.recordRun`. | `contracts/src/Challenge.sol:148-171,210-216,241-287` |
| `Season.recordRun` | Only from `Challenge`; keeps the player's best run in D10 order (qualified, score, fewer ticks), and `totalQualifiedPoints`. | `contracts/src/Season.sol:169-184,287-295` |

Bound indirectly, and correctly:

- **Chain, contract, run and player.** The proof names none of them. The run nonce does: `runNonce = keccak256("jiro.run" ‖ entropy ‖ runId)` (`RunDerivations.sol:8-10`), and `entropy = keccak256(arbBlockHash(target) ‖ Challenge address ‖ entropyId)` (`ArbBlockhashEntropy.sol:55`), with `entropyId = keccak256(Challenge ‖ runId)` (`Challenge.sol:206-208`). The player is the run's stored `player`.
- **Season.** Through the season's level ids and weights, which the proof must match.

Not bound, by design or by omission:

- That a person played (README §7.1, line 527).
- **Numeric bounds on the Outcome.** `checkOutcome` checks identities only. `levelScore`, `claimBp`, `ticksUsed` and `endReason` are taken as the referee returns them (`Challenge.sol:241-266`). README lines 569-570 state the maxima (393,210 points, 16,200 ticks) as facts; no contract enforces them. See finding sound-1.
- **The provenance of the image id.** It is a constructor argument (`ZkReferee.sol:35-41`), passed on the deployer's command line (`scripts/contracts/deploy.mjs:197,244,271`). See finding trust-2.

Verdict on soundness: I found no way to settle a score that the committed journals do not produce, short of breaking RISC Zero's proof system or its trusted setup, or deploying a wrong image id. The referee is called through `view` functions (`IReferee.sol:22-29`), so the call is a static call and even a hostile referee cannot re-enter. `settleRun` after a partial `settleLevel` rebuilds the settlement from its own six Outcomes (`Challenge.sol:165`), so nothing is counted twice. This agrees with the M4.12 review ("No contract defect was found", `docs/ECONOMY.md:150`). The weaknesses are in liveness and in who bears cost, below.

## 2. Inventory: what must be trusted, and what must stay live

### Must be trusted (a failure forges or misdirects money)

| Party or artifact | Why | Who controls it | Evidence |
|---|---|---|---|
| RISC Zero zkVM 3.0.6 circuits, recursion and the 3.0 Groth16 verifier `0x2a09…a84D` | A soundness bug lets anyone prove any public values | RISC Zero; the verifier contract is immutable | `docs/VERIFICATION.md:519`, `docs/ECONOMY.md:83` |
| The Groth16 trusted setup behind that verifier's key | Whoever holds its toxic waste can forge any seal, silently | RISC Zero's ceremony | Not mentioned anywhere: `grep -i 'trusted setup\|ceremony'` finds nothing in the repository |
| The image id pinned in `ZkReferee` | The program behind it defines every Outcome | The operator, at deployment | `ZkReferee.sol:25`, `deploy.mjs:197` |
| The core's rules as compiled into the guest | A consensus bug cannot be fixed in a live season | The repository at the deployed commit | `docs/ECONOMY.md:80` (accepted residual on testnet) |
| The operator's `Season.open` parameters | A referee that lies, a wrong level id, a grace too short | The operator key, immutable in `Season` | `Season.sol:51,129-157`, `docs/ECONOMY.md:76-77` |
| The Arbitrum sequencer | Block hashes feed the draw, `block.timestamp` the deadline | Offchain Labs' sequencer | `docs/ECONOMY.md:66` (accepted residual) |

Not trusted, correctly: the prover (it cannot forge), the settlement's sender (the credit goes to the run's player), the browser, the future proving service (README §7.5, lines 673-680).

### Must stay live for an honest player to be paid

| Dependency | When | If it fails | Evidence |
|---|---|---|---|
| The player's own reveal within the 256-block window, then the commit within the deadline | Right after paying | The run is forfeited, the fee stays in the pot | README lines 536-538, `Challenge.sol:115-143` |
| A prover that proves the player's best run before `end + grace` | End of season and grace | The run never counts; its fee is shared by others | `Challenge.sol:210-216` |
| In practice that prover is the operator | Same | Same | `docs/ECONOMY.md:84`, README line 671 |
| The operator's tooling: a host built at the fixed path, Docker, the image `risczero/risc0-groth16-prover:v2025-04-03.1` (5.2 GB, Docker Hub only, x86 only), 9.2 GiB of RAM, 9 to 17 hours per run | Same | Same | `referee/zk/README.md:58-67,92`, `docs/VERIFICATION.md:672,699-710` |
| Or the Boundless market on Base: a funded Base wallet, a public program URL, two active provers | Same | Same | `docs/VERIFICATION.md:531,753-754,771` |
| RISC Zero's emergency stop staying unpaused until settlement | Whole season plus grace | Every unsettled run of the season is lost for good | Section 3, scenario A |
| An RPC serving logs and transaction inputs, and traces for some smart-account commits | When runs are rebuilt from chain data | The run cannot be rebuilt by that operator | `web/src/chain/calldata.ts:67-100` |
| The Arbitrum sequencer including the settlement before the cutoff | Last hours of the grace | The run never counts | `Challenge.sol:213-215` |
| Someone calling `closeSeason`, then the player's own `claim` | After the grace | Permissionless, so no dependency on the operator | `Season.sol:186-223` |
| The operator opening a later season on the same `Season` | Only for a rolled-over pot | The rollover stays in `Season` | `Season.sol:129,201-202`, `docs/ECONOMY.md:78` |

### The emergency stop, concretely

- Source at the pinned revision: `estop()` is `onlyOwner`; `estop(Receipt)` is open to anyone who presents a verifying receipt whose claim digest is all zero; both call `_pause()`, and the contract comments say "Once stopped, this contract can never be restarted." `verify` is `whenNotPaused`.
- Pinned addresses (`scripts/contracts/deploy.mjs:44-47`): `0x9F9994Eb4Cb5200198FEfb470f8b50301662e696` on Arbitrum One, `0x724d375B5b622e15f0E64e9Deb76a4cB17877797` on Arbitrum Sepolia.
- Read onchain today: both report `paused() = false` and `verifier() = 0x2a098988600d87650Fb061FfAff08B97149Fa84D`. `owner()` is `0xF616A4f81857CFEe54A4A049Ec187172574bd412` on Arbitrum One and `0x3A54A45e44A71020Bd0AF42063B9f23E8B9E387D` on Sepolia. These are the `admin` accounts of RISC Zero's `deployment.toml`. Neither has contract code (`eth_getCode` returns `0x`; nonces 57 and 37), so there is no onchain multisig or timelock in front of the stop. That is reasonable for an emergency control, and it means one key held outside the project decides.
- Precedent: RISC Zero's `deployment.toml` lists six Groth16 verifier generations on Arbitrum One and Sepolia (1.1.0-rc.3, 1.2.0, 2.0.0-rc.3, 2.1.0, 2.2.0, 3.0.0) and marks two of them, 2.0.0-rc.3 and 2.1.0, `stopped = true`. Onchain, `paused()` returns true for both of those stops on Arbitrum One (`0x68dC…40E3`, `0xDa8f…B2b1`) and false for 2.2.0 and 3.0.0. `docs/VERIFICATION.md:522` records one of them and calls selector `0xf536085a` "the 2.0 one"; RISC Zero's table gives that selector to 2.1.0, and 2.0.0-rc.3 (`0x9f39696c`) is stopped as well.
- The repository records the router's owner, a timelock (`docs/VERIFICATION.md:518`), but never the owner of the stop it actually pins. `preflight.mjs:35` reads only `paused()` and `verifier()`.
- The deployed `ZkReferee` `0x1097…8c5a` reads `verifier() = 0x724d…7797` and `imageId() = 0xa3013dc4…02b1`, as `docs/DEPLOYMENT.md:129-133` says.

## 3. What happens to a live season and its pot

The rule that decides everything is in `Season.closeSeason` and `claim`:

```text
rake        = fees × rakeBp / 10,000                 always, Season.sol:194,200
playersPot  = fees − rake + pendingRollover          Season.sol:195
rolledOver  = totalQualifiedPoints == 0              Season.sol:196
claim       = bestScore × playersPot / totalQualifiedPoints   Season.sol:218
```

`fees` counts every run bought, settled or not. `totalQualifiedPoints` counts only settled, qualified best runs. So an unsettled run's fee is paid out to the settled ones.

| Scenario | Unsettled runs | New runs | Rake | Players' pot |
|---|---|---|---|---|
| **A. The stop is triggered**, nothing qualified settled yet | Can never settle: `verify` reverts with `EnforcedPause` (`ZkReferee.t.sol:178-185`), and neither the verifier (`ZkReferee.sol:24`) nor the season's referee (set once, `Season.sol:152`) can change | Still accepted until the season's end: `payFee` checks only the season and the fee (`Season.sol:159-167`), and the page never reads `paused()` | Credited to the treasury | Rolls over into `pendingRollover` of this `Season` contract |
| **A'. The stop is triggered** after some runs settled | Same | Same | Credited | All of it goes to the players settled before the stop, pro rata |
| **B. The operator disappears**, key lost or idle | Settle only if a player proves alone | Accepted until the end. No later season, ever: `open` is `onlyOperator` and the operator is immutable (`Season.sol:51,129`) | Credited; anyone can send it to the treasury | If nobody proves: a rollover that no season will ever release. If some prove: they share everything |
| **C. A proof arrives after `end + grace`** | `SettlementClosed`, for good (`Challenge.sol:213-215`); the grace is immutable and at most 30 days (`Season.sol:46,280`) | n/a | Credited | Shared by the runs settled in time, or rolled over |

Three consequences that the documents do not state:

1. **"The season's pot rolls over" is true only when nothing qualified was settled** (`docs/DEPLOYMENT.md:196`). In A' and C the pot is not rolled over: it is paid to a subset.
2. **The rake is taken on a season that could not settle** (`contracts/test/Season.t.sol:657-670` pins this: the rolled-over amount is fees minus rake). Players of a failed season are not refunded; the treasury is paid.
3. **The documented recovery strands the rollover.** `docs/DEPLOYMENT.md:195` says a stopped emergency stop, and a lost or leaked deployer key, each force a new generation, that is a new `Season` and `Challenge`. But a rollover is released only by the next `closeSeason` of the same `Season` contract with qualified points. `docs/ECONOMY.md:83` says instead that "the next season opens with a new `ZkReferee`", and README line 748 that a new backend "means a new season". The contracts allow that: `Season.open` takes any referee whose `rulesVersion()` matches. The tooling does not: `deploy.mjs` always deploys all four contracts ("it never resumes an earlier one", line 8), `season.mjs open` works only on `generations[0]` and refuses a season file that names another referee (lines 114-118, 126), and the site reads only `generations[0]` (`web/src/chain/deployments.ts:40-42`), so claims and settlements of an older generation are not reachable from the site either.

Also in scenario A: a stop exists because the proof system is believed broken. Runs settled before the stop may include forged ones, and `Season` has no way to remove a recorded best run (`Season.sol:169-184`); the pot would be shared with them at close.

`season.mjs open` checks, for a Stylus referee, that its activation outlasts the season (`season.mjs:120-124`). It has no matching check for zk: it will open a season on a `ZkReferee` whose stop is already paused. The preflight has the check (`preflight.mjs:94-104`), but only the deployment runbook runs it.

## 4. Findings, most severe first

### trust-1 (high). The operator is the only practical prover, and whoever is left unsettled pays the others

- **What.** README line 671: "any player can still prove and settle their own run". In practice that needs a Linux x86 machine, root for the bind mount at `/home/runner/work/jiro-ikusu/jiro-ikusu`, an hour-long host build, Docker with a 5.2 GB image from Docker Hub, 9.2 GiB of RAM (4.6 GiB with 2^19-cycle segments, then about 7 GiB for the Groth16 step) and 9 to 17 hours of four CPUs (`referee/zk/README.md:58-67,92`; `docs/VERIFICATION.md:512,699-710`; `docs/DEPLOYMENT.md:245-249`). `docs/ECONOMY.md:84` says it plainly: "the operator is in practice the only prover", and "Omission or delay stays an accepted residual on testnet."
- **Why it is worse than a delay.** By section 3's rule, an omitted player's fee is paid to the settled players. The operator may also play; nothing prevents it. An operator that settles only its own run receives the whole players' pot, and its treasury receives the rake. Everyone can see it afterwards, since journals are public, and nobody can undo it after `closeSeason`.
- **The incentive points the wrong way.** One verified run costs about 0.0000345 ETH (`docs/ECONOMY.md:44`). The rake on one run is 0.000005 ETH at testnet-0's 1,000 bp (`seasons/testnet-0.json:43`), 0.00001 ETH at the 2,000 bp cap (`Season.sol:44`). Settling a player who bought one run costs the operator about seven runs of rake, 3.5 at the cap. On its own machine the cost is 9 to 17 machine-hours for a run whose fee is 0.00005 ETH.
- **The tool does not exist yet.** `scripts/contracts/season.mjs` has one command, `open` (lines 1 and 139). The `settle` command that rebuilds runs from chain data, picks each player's best and proves it is plan M5.5, unbuilt. Today only `e2e.mjs`'s happy path proves and settles, for the tester's own run.
- **Small inconsistency.** The settle page tells the player "Send the operator the run file" (`web/src/pages/settle.ts:177`), where README line 671 says players do nothing after committing. The page also gives "credentials that cannot live in a browser" as the reason (lines 6-7), the README "gigabytes of memory, and ideally a GPU".

### live-1 (high). Proving throughput against a hard, immutable cutoff

- **Not an exception.** Payout is pro rata among all qualified players (`Season.sol:210-223`), and the reference mix qualifies 99.2 % of its runs at `minClears` 1 (`docs/ECONOMY.md:123`). So "runs that money depends on" is one run per paying wallet. README line 607 says so ("typically each player's best run"); the consequence is that proofs scale with players.
- **All of it lands in the grace.** A player's best run is known only at the season's end. Proving earlier risks proving a run that a later one replaces.
- **Capacity.** Whole bot runs that clear six levels: 67 to 81 segments, 8.7 to 10.6 hours on 4 CPUs (`docs/DEPLOYMENT.md:245-249`). The gate set's range is 97 to 137 million proving cycles (`docs/VERIFICATION.md:924-926`), which the runbook's own formula (segments × 467 s + 170 s) turns into 12 to 17 hours. Runs settled ≤ machines × grace ÷ hours per run: testnet-0's 24-hour grace (`seasons/testnet-0.json:45`) fits about two whole runs per machine, the proposed 48 hours four or five, the 30-day maximum about 70.
- **Never done at full length.** The only run settled onchain was proven with `--short`: 13 segments, 338 ticks, about 75 minutes (`docs/DEPLOYMENT.md:97,173-178`). The largest run ever proven has 16 segments (`docs/VERIFICATION.md:988`); the largest proof of any kind is one level of 28 segments. "16 to 17 hours" is an extrapolation (`docs/VERIFICATION.md:708`: "would take").
- **No resume.** `zk-host prove` runs segment proofs, recursion and Groth16 in one pass and keeps nothing in between (`referee/zk/host/src/prove.rs:59-79`). `e2e.mjs` keeps only a finished proof (`scripts/contracts/e2e.mjs:706-718`). A crash in hour nine restarts from zero.
- **The scalable route was never used.** Boundless: "No request was made" (`docs/VERIFICATION.md:771`), two requesters and two provers account for the priced requests, it needs a funded Base wallet and the program at a public URL, and the ELF is published nowhere.
- **Flooding.** Wallets are free and each wallet's best run needs its own proof. A nonce-aware bot clears every drawn level and takes about twice a mix player's share (`docs/ECONOMY.md:120-131`), so extra wallets earn their fee back when settled. The mitigation in `docs/ECONOMY.md:84`, "proves and settles only each player's best run", bounds runs per player, not players. An adversary can also choose journals near the heaviest (30.9 million cycles per level).
- **The spec understates it.** README line 590, the normative cost table, still says "CPU proving takes about an hour on 4 CPUs for six small levels".
- **Hard stop.** A proof that lands one second after `end + grace` reverts with `SettlementClosed` (`Challenge.sol:213-215`), and nothing can extend a grace.
- **An option inside today's contracts.** Six level proofs on six machines, settled with `settleLevel`, cut the wall time per run to that of its heaviest level (1.5 to 4 hours) at six verifications of 227,591 gas instead of one.

### live-2 (high). The emergency stop can end a live season's settlement for good, and nothing reacts

Mechanics and evidence are in section 2 ("The emergency stop, concretely") and section 3, scenarios A and A'. In short:

- Pinning the version-specific stop instead of the router was the right call for soundness (`docs/ECONOMY.md:154`): the router's owner could add a route that accepts forged proofs. The price is liveness: a stop is permanent, and `ZkReferee` and the season's referee are immutable.
- Two of the six verifier generations RISC Zero has deployed on Arbitrum are stopped.
- After a stop, `startRun` keeps accepting fees for runs that can never settle, and `season.mjs open` would open a new season on a dead referee.
- `docs/ECONOMY.md:92` lists "a procedure for … a stopped verifier under a zk referee" among the pre-mainnet prerequisites. It is not written, and the two documents that sketch it disagree (section 3, consequence 3).

### funds-1 (medium). A season that cannot settle still pays the rake, and its pot goes to a subset or to a stranded rollover

Section 3, consequences 1 to 3. The contract behavior is deliberate (rollover, permissionless close), but together with scenarios A to C it means: no refund path exists; the operator's treasury is paid by seasons in which its own proving failed; and the recovery the runbook prescribes abandons the `Season` contract that holds the rollover.

### trust-2 (medium). The image id is the root of trust, supplied by hand, and nothing checks it automatically

- `deploy.mjs` takes `--image-id` from the command line and checks only that it is 32 bytes of hex (line 197).
- The build is reproducible only at one absolute path (`referee/zk/README.md:58-67`: "a build at any other path gives another verify image id"), a workaround for Cargo's metadata hash rather than RISC Zero's Docker build, which was not used (`docs/VERIFICATION.md:691`). It was matched between two environments; the document itself warns that "a relocation test in one machine does not prove the build reproducible" (`docs/VERIFICATION.md:662`). A fork under another repository name gets another checkout path on Actions.
- Checking costs an hour: the host built in 62 min 35 s on a runner (`docs/VERIFICATION.md:512`).
- The deployment record has no image id key (`deployments/README.md:17-31`), and the guest ELF is committed and published nowhere, so a prover must first reproduce the exact ELF.
- `docs/ECONOMY.md:76` relies on "players can compare with the reproducible build". The site reads neither `imageId()` nor `refereeCodehash` (no occurrence under `web/src/` outside the generated bindings). The only automated comparison is in the live happy path (`scripts/contracts/e2e.mjs:827`).
- Known and accepted: `ZkReferee.rulesVersion` is a free constructor argument (`docs/ECONOMY.md:155`).

### excp-1 (medium). Verify by exception leaves no ranking, no validity signal and no payout figure until the grace ends

Section 5.

### trust-3 (low). The specification's trust model names none of the third parties that zk adds

- README §7 is titled "Verification and trust model". It says "a proof is checked by the contract" (line 673) and lists no dependency on RISC Zero.
- `grep -i 'emergency\|estop'` finds nothing in `README.md` or `IMPLEMENTATION_PLAN.md`; the stop appears only under `docs/` and `deployments/README.md`.
- No file mentions the Groth16 trusted setup.
- The Groth16 prover image is referenced by tag, not digest, in `.github/workflows/zk-prove.yml:43`. It cannot forge a proof, since the seal is verified afterwards, but it runs on the machine that also holds the operator key in the runbook's session.
- On testnet one key is deployer, operator, treasury and settler, kept as a cloud-environment variable (`docs/DEPLOYMENT.md:15`, `deployments/arbitrum-sepolia.json:9-10`). `docs/ECONOMY.md:91` lists custody as a pre-mainnet prerequisite.

### sound-1 (low). `Challenge` takes the referee's numbers without bounds, and a settled run cannot be removed

- `checkOutcome` (`Challenge.sol:241-260`) checks identities. `addLevel` (lines 262-266) sums `levelScore` and `ticksUsed` as returned. A sum above 2^32 − 1 reverts, so a forged run can carry up to about 4.29 billion points, against an honest maximum of 393,210.
- With a sound verifier this never matters. If the verifier, the setup or the image id were ever wrong, the difference is between a forger taking nearly the whole pot with one wallet and taking one top share per wallet. A check such as `levelScore ≤ weightBp`, `claimBp ≤ 10,000`, `ticksUsed ≤ 2,700` copies no rule of the core.
- There is no window in which a recorded best run can be contested or removed before close (`Season.sol:169-184`).

### Smaller observations, not listed as findings

- **Rejections are silent and all or nothing.** A run with one journal that replay rejects can never settle, so its other five levels are lost with it (README lines 640-643). On zk the failure is invisible onchain: no proof exists, and the run looks like any unsettled run. A guest could just as cheaply prove a rejection.
- **Redundant bytes.** Under zk, the public values already carry the keccak of each level and journal, and `ZkReferee` recomputes both from the submitted bytes only to compare (`ZkReferee.sol:88-91`). The `IReferee` shape comes from the Stylus backend, which replays the bytes. Calldata is 353,908 of `settleRun`'s 576,603 gas outside the referee (`docs/VERIFICATION.md:815`).
- **The reveal window** is a liveness requirement on the player: a second transaction within 256 Arbitrum blocks of the entropy block, about a minute, or the fee is forfeited. It is a known rule (README line 538).

## 5. What verify by exception leaves unverified

- **At commit, nothing.** `commitRun` stores the keccak of whatever six byte strings it receives: "The journals are never parsed" (`Challenge.sol:127-143`). A committed run may be valid, garbage, of another mode, or late. The only time check is the outer bound `revealedAt + 1,080 + commitSlack`.
- **Lateness** is decided in `finishRun`, at settlement (`Challenge.sol:270-277`). An unsettled late run is indistinguishable onchain from an on-time one; it can be computed offline from the journals.
- **Rankings.** `Season` knows a player only once a run of theirs is settled, and the plan settles best runs "after the end" (`IMPLEMENTATION_PLAN.md:2035`). The leaderboard is built from `BestRunRecorded`, `RunStarted` and `Claimed` (`web/src/chain/leaderboard.ts:1-5,71-75`). With the operator settling after the end, it stays empty for the whole season, then fills as proofs arrive, hours apart.
- **Payout figures.** Every claim divides by `totalQualifiedPoints`, which moves with each settlement until `end + grace`. Before that, the first settled player's projected claim is the whole pot.
- **Unsettled runs** count for nothing, whatever their real score, and their fees go to the others (section 3). Onchain, a good run that nobody proved, a run the operator skipped and an invalid run look the same.
- **What already exists to close the gap offchain.** The page can rebuild any committed run from its commit transaction and replay it in wasm (`web/src/chain/calldata.ts:112-134`, `web/src/pages/settle.ts:43-56`). A provisional ranking from public data, which anyone can recompute, is not built.

## 6. What the design gets right

1. **Complete binding, no client score.** Sections 1 and the tests `ZkReferee.t.sol:112-164`, `Settlement.t.sol:419-537`.
2. **An immutable image id and a version-specific stop, never the upgradeable router** (`ZkReferee.sol:18-26`, `deploy.mjs:40-47`). A third party can halt, never forge.
3. **Permissionless settlement that cannot hurt.** The credit goes to the run's player, a qualifying run always ranks above a higher-scoring non-qualifying one, and a late run is a result rather than a revert (`Challenge.sol:145-171,270-282`, `Season.sol:287-295`). A prover or a service can delay, not steal or redirect.
4. **Journals published and bound at commit** (`Challenge.sol:130-143`, `RunDerivations.sol:14-27`). Anyone can replay any committed run for free, which makes an omission by the operator publicly provable, and is the ground truth any lighter scheme can build on.
5. **Simple custody.** `closeSeason`, `claim` and `withdrawRake` are permissionless, only two functions send ETH, and the solvency invariant is fuzzed (`Season.sol:186-231`, `Invariant.t.sol:182-198`).
6. **The referee is a per-season parameter behind `IReferee`** (`Season.sol:129-157`), so the money contracts do not change with the backend.
7. **Real proofs in the tests.** `ZkVerify.t.sol` and `ZkReferee.t.sol` verify real Groth16 seals against RISC Zero's real verifier, including the stopped case.

## 7. Facts for designing a lighter scheme

1. Per run the chain already holds the player, `revealedAt`, `committedAt`, the season, the run nonce and the journal commitment (`Challenge.sol:11-18`); the journals are public in calldata. The true Outcomes are recomputable by anyone, and the browser already computes them (`web/src/pages/settle.ts:43-56`).
2. Under zk, settlement does not need the journal or level bytes (`ZkReferee.sol:88-91`); they are 353,908 of 576,603 gas (`docs/VERIFICATION.md:815`).
3. One level can be proven and settled alone: the guest accepts 1 or 6 levels (`referee/zk/guest/src/lib.rs:18`), and `ZkReferee.verify` and `Challenge.settleLevel` exist. A level takes 15 to 31 million proving cycles; `worst-case` took 13,177 s on 4 CPUs (`docs/VERIFICATION.md:700,921-923`).
4. The floor of any RISC Zero proof of this guest is high: a one-tick level is 1.12 million user cycles, 2 or 3 segments, 21 to 36 minutes, with 9.2 or 4.6 GiB and then about 7 GiB for Groth16 in x86 Docker (`docs/VERIFICATION.md:500-502,512,701`). Level setup, not ticks, sets it.
5. The core serializes the whole state to 948 bytes and hashes it per tick (`core/src/hash.rs:10-74`); wasm returns the trace (`web/wasm/src/lib.rs:733-769`). But "Stepping never computes it" (`hash.rs:2`), `Game::new` is the only constructor (`core/src/game.rs:53`), and the preimage omits what comes from the level and the seed (deflection key, minion spawns, respawn delay, target, time limit). Re-executing one tick from a hash needs a new core entry point, plus the level bytes and the nonce.
6. Stylus runs a one-tick `verify` for 313,515 gas and a level for 5.1 to 11.6 million (`docs/VERIFICATION.md:60,921-923`). Activations are paused on both chains (`docs/VERIFICATION.md:7-12`).
7. A new referee needs only a new season (`Season.sol:129-157`). A scheme that adds claims, bonds or challenge windows changes `Challenge`, so it needs a new generation (`docs/DEPLOYMENT.md:191-195`), and scripts and site follow only the newest generation.
8. Proofs scale with paying wallets, one each at about 0.0000345 ETH (`docs/ECONOMY.md:44`), against a rake of 0.000005 ETH per run at 10 % and 0.00001 ETH at the cap (`Season.sol:44`).
9. RISC Zero's only non-Docker Groth16 route is a GPU (`docs/VERIFICATION.md:508`); its hosted API, Bonsai, is gone since December 2025 (`docs/VERIFICATION.md:529`).

## 8. Checked and found fine

- Copied journals, foreign nonce, wrong level index, wrong draw slot, level outside the season, Training mode, other rules version: each reverts, with a test (`Settlement.t.sol:419-537`).
- A level proof used as a run proof, and the reverse: `PublicValuesLengthMismatch` (`ZkReferee.t.sol:187-215`).
- Double settlement, settlement after the close, partial `settleLevel` then `settleRun`: guarded (`Challenge.sol:188,210-216`, `Season.sol:174`).
- Settling someone else's run: harmless to them (`Season.sol:287-295`). It does dilute the settler's own share, so no player has a reason to settle a rival; only a neutral party would settle everyone.
- A verifier address without code: a high-level call to it reverts, and `deploy.mjs:180` checks for code.
- Mock verifier and mock referee on public chains: refused (`deploy.mjs:192-194`, `preflight.mjs:50-56`).
- No change to `core/`, `referee/` or `contracts/src/` since the deployed commit, so the pinned image id still matches the source if the build is reproducible.

## 9. Document corrections worth making, whatever is decided

1. `docs/DEPLOYMENT.md:196`: the pot rolls over only when no qualified run was settled.
2. `docs/DEPLOYMENT.md:195` against `docs/ECONOMY.md:83` and README line 748: new generation or new season after a stop.
3. `docs/VERIFICATION.md:522`: selector `0xf536085a` is version 2.1.0; 2.0.0-rc.3 is stopped too.
4. README line 590: the proving time quoted is for six small levels.
5. `web/src/pages/settle.ts:177`: "Send the operator the run file".
