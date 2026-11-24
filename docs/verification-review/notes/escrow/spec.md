# ProofBounty: pay-on-delivery bounties for run proofs, and the payee in the zk public values

Specification, 2026-11-10. It turns the lead sketch into something a developer can implement, and corrects the sketch where the repository's code shows it wrong or incomplete. Nothing in `the repository root` was changed. A working prototype of the two contract changes, with 84 passing tests, is in the scratch folder (§9).

**Where each number comes from.** Every number is tagged:

- **[repo]**: recorded in the repository, with the file that records it.
- **[here]**: measured in this session, in the scratch prototype or on the public chains; §9 gives the commands.
- **[est]**: an estimate, with its inputs.
- **[lead]**: from the lead's research of 2026-11-10, not checked here unless the text says so.

## Contents

1. [The design on one page](#1-the-design-on-one-page)
2. [The sketch, point by point](#2-the-sketch-point-by-point)
3. [Proof format change](#3-proof-format-change)
4. [The ProofBounty contract](#4-the-proofbounty-contract)
5. [Prover protocol and pricing](#5-prover-protocol-and-pricing)
6. [Gas and costs](#6-gas-and-costs)
7. [Documents and plan items to change](#7-documents-and-plan-items-to-change)
8. [Weaknesses and open decisions](#8-weaknesses-and-open-decisions)
9. [What was run](#9-what-was-run)
10. [Appendix A: prototype `ProofBounty.sol`](#appendix-a-prototype-proofbountysol)
11. [Appendix B: `ZkReferee.sol` diff](#appendix-b-zkrefereesol-diff)

## 1. The design on one page

- **The proof names who is paid.** The prover gives the guest a 20-byte payee. The guest commits it as one more 32-byte word after the levels' Outcomes, in both modes. `ZkReferee` verifies the seal against `sha256` of all the public values, so the payee cannot be changed without making a new proof. A new function, `ZkReferee.payeeOf(proof)`, reads it.
- **`ProofBounty` holds the money.** One contract per `ZkReferee`. Anyone posts ETH on a committed run with `post(runId)`. The bounty only grows until it is paid or refunded.
- **One call delivers and credits.** `claim(runId, levels, journals, proof)` credits the run's whole bounty to the proof's payee, never to the caller. If the run is unsettled, the call settles it through `Challenge.settleRun`. If someone already settled it, the call verifies the proof itself. The branch is chosen from the run's status when the call executes.
- **The payee withdraws.** `claim` only credits `owed[payee]`. `withdraw(payee)`, which anyone may call, sends the credit to the payee.
- **Refunds.** `refund(runId, depositor)`, which anyone may call, returns a depositor's own deposit once the season's settlement period has ended with the run still unsettled. A settled run's bounty that nobody claimed returns `CLAIM_GRACE` (7 days) after the settlement end.
- **Unchanged:** `Challenge`, `Season`, `IReferee`, `RunDerivations`, the core, `RULES_VERSION`, the vectors, run file v1, the Stylus referee.
- **Changed:** the guest (so the image id), `ZkReferee` (so its address), the host, the four real proof fixtures, and what quotes the public values' layout.

```text
player or sponsor -- post(runId) {value} --> ProofBounty <-- claim(runId, levels, journals, proof) -- anyone
                                                |                    |
              refund(runId, depositor) <--------+                    +- run unsettled: Challenge.settleRun(...)
              withdraw(payee) --> payee <-------+                    +- run settled:   commitment, weights, ZkReferee.verifyRun(...)
                                                          payee = ZkReferee.payeeOf(proof), from the public values
```

## 2. The sketch, point by point

| # | Sketch | Verdict from the code | Correction or addition |
|---|---|---|---|
| 1 | The guest commits the payee as one word after the outcomes; the escrow pays that address, never `msg.sender` | Sound. A RISC Zero claim does not commit the guest's input (`ReceiptClaimLib.ok` sets `input` to zero, `contracts/lib/risc0-ethereum/contracts/src/IRiscZeroVerifier.sol`), so only the public values can bind the payee, and `ZkReferee` verifies the seal against `sha256(publicValues)` (`contracts/src/ZkReferee.sol:73`). | **Incomplete in three places.** (a) `IReferee` returns only Outcomes, so the escrow cannot learn the payee from `verifyRun` or `settleRun`: `ZkReferee` gains `payeeOf(proof)`. (b) The escrow must pay only through a referee that binds the payee. MockReferee ignores the proof and the Stylus referee takes an empty one, so with them anyone could name a payee: the escrow pins one `ZkReferee` and refuses deposits on runs of other referees. (c) "Pays" becomes "credits, then the payee withdraws": the project's rule is pull payments (`.claude/skills/onchain-referee/SKILL.md`, Security), and with it a payee that rejects ETH can neither undo a settlement nor lock a bounty. The zero address means "no payee" and is refused. |
| 2 | The escrow pays on a valid proof, whether the call settles the run or the run was settled already | Sound, and needed for more than a sequencer front-run: a reverted `claim` leaves the proof in public calldata, and an `eth_estimateGas` shows it to the RPC provider. | **Incomplete.** `Challenge.checkOutcome` is private and `Challenge` stores no Outcome (`contracts/src/Challenge.sol:241`, `:28-34`), so on a settled run the escrow binds the proof to the run itself: the commitment, the season's weights, `verifyRun` (§4.3). One entry point picks the branch at execution, so the prover's own transaction succeeds on either side of a copier. Consequence to accept: a bounty on a run settled outside the escrow stays open to any later valid proof (§8, W6). |
| 3 | One payout per run id, never keyed on proof bytes | Correct. **[here]** A copy of the repository's real `challengeRun` seal, re-randomized without its witness, differs in 189 to 191 of its 260 bytes and verifies under RISC Zero's 3.0 Groth16 verifier for the same public values, and for no others. | `bountyOf[runId]` is zeroed at payout; no deposit can follow, because the run is settled by then. |
| 4 | Refund to the depositor only if the run is still unsettled when the settlement period ends | The first half is exact: `checkSettlementOpen` (`Challenge.sol:210-216`) makes "unsettled after `settlementEndOf`" permanent, so that refund never overlaps a possible claim. The refund must use `block.timestamp > settlementEnd`, since `settleRun` still works at equality. | **Incomplete.** (a) Several depositors need per-depositor accounting. (b) No withdrawal before the end is a requirement, not a detail: a depositor who could withdraw would make the claim revert and take the proof from its calldata. (c) Read strictly, the rule locks ETH for good in reachable states: a run settled by a proof that names no payee, by six level proofs, or by a party that never claims; and any settled run once RISC Zero's emergency stop is pulled, which is permanent (`RiscZeroVerifierEmergencyStop.estop`: "can never be restarted"). **Added:** a settled run's unclaimed bounty returns `CLAIM_GRACE` after the settlement end (B15). It is an owner decision (§8, O1). |
| 5 | A Late run still pays | Correct, with no code for it: `finishRun` marks the run Late without reverting (`Challenge.sol:270-277`), so `settleRun` returns; on a settled run, Late counts as settled. | Lateness can be computed before proving, from a free replay and the deadline formula, so the dApp warns before a deposit on a run that will be Late. |
| 6 | The poster sets the price; provers price by the cycles the executor measures in seconds | Workable. | **Incomplete.** (a) The host has no command that executes a run file and prints its cycles without proving: `execute-run` takes six vector files (`referee/zk/host/src/main.rs:172-186`) and `prove` prints the cycles only after proving (`prove.rs:103-106`). (b) Before a proof exists there is nothing to pass to `eth_estimateGas`, so the claim's gas is priced by a formula (§6). (c) A bounty can only grow, so a quote stays valid while the prover works. |
| 7 | `Challenge`, `Season`, `IReferee`, the core and `RULES_VERSION` stay; the guest, `ZkReferee` (length), the host (a payee argument) and four fixtures change | Correct on what stays. **[here]** With `ZkReferee` changed, 207 of the 218 existing tests pass unchanged. | **Incomplete on what changes** (§3): `ZkReferee.payeeOf`; the trace guest, which shares `read_inputs`; the host's checks, not only its command line; 11 of the 15 tests of `ZkReferee.t.sol`, which fail until the fixtures are re-proven **[here]**; `ZkVerify.t.sol`; `e2e.mjs`; `zk-prove.yml`; the ABI and the web bindings; and, since the image id changes, a new `ZkReferee` and so a new generation on Arbitrum Sepolia. |
| 8 | A lock with a stake against racing is left for later | Accepted residual. | The first valid `claim` wins and the loser's proving is lost; the prover script re-reads the bounty before the Groth16 step and before sending (§5). |

## 3. Proof format change

### 3.1 Public values

The public values of a proof are, for each level in input order, the 12 ABI words of `abi.encode(uint16 weightBp, Outcome)`, as today, **followed by one word: `abi.encode(address payee)`**, that is 12 zero bytes and the payee's 20 bytes.

| Mode | Levels | For | Public values, today | With the payee |
|---|---:|---|---:|---:|
| level | 1 | `verify` | 384 bytes | 416 bytes |
| run | 6 | `verifyRun` | 2,304 bytes | 2,336 bytes |

- In Solidity terms a run's public values are `abi.encode(ScoredOutcome[6], address)` and a level's `abi.encode(ScoredOutcome, address)`: both types are static, so the encoding is the concatenation.
- **Both modes carry the payee.** Only run proofs are ever paid, but one layout rule ("the levels, then the payee") keeps the guest free of a mode branch and the two lengths distinct. The alternative, a payee in run mode only, saves the two level fixtures' public values and nothing else: all four seals change either way, because the image id changes (§8, O3).
- **Any 20 bytes are accepted, zero included.** The guest has no policy. The zero address is how a proof says it claims no bounty; `ProofBounty` refuses to credit it.
- **No version number moves.** The public values have none: the image id identifies the program and so the layout, and `ZkReferee`'s exact-length check rejects a proof of the other layout. `vectors/format/` is not concerned (CLAUDE.md's byte-format row is about the journal, level, state-hash and run-file formats). Run file v1 does not change: the payee is the prover's, not the run's.
- **Cycles:** the change adds one 20-byte read and one word to the committed bytes. SHA-256 pads 2,304 and 2,336 bytes to the same 37 blocks, and 384 and 416 bytes to the same 7. **[est]** A few hundred cycles; not measured, since `referee/zk` was not built here.

### 3.2 Guest

Not built here; the fragments are a proposal to compile and test.

`referee/zk/guest/src/lib.rs`:

- `:8` keep `OUTCOME_LEN`; add `pub const PAYEE_LEN: usize = 20;`.
- `:20-37` `read_inputs` returns the levels and the payee:

  ```rust
  pub struct Inputs {
      pub levels: Vec<LevelInput>,
      pub payee: [u8; PAYEE_LEN],
  }

  pub fn read_inputs() -> Inputs {
      let count = read_word();
      assert!(MODE_LEVEL_COUNTS.contains(&count), "{count} levels: a proof covers one level or a run of six");
      let levels = (0..count)
          .map(|_| LevelInput { level: read_bytes(), journal: read_bytes(), weight_bp: u16::try_from(read_word()).expect("weightBp exceeds u16") })
          .collect();
      let mut payee = [0; PAYEE_LEN];
      env::read_slice(&mut payee);
      Inputs { levels, payee }
  }
  ```

  The levels must be collected before the payee is read: the `map` is lazy, and reading the payee first would take the levels' first bytes. The input stream is therefore: the count, the levels as today, then the payee's 20 raw bytes. The stream already mixes words with byte strings of any length, so 20 bytes after the last weight word follow the existing pattern.
- New, next to `encode` (`:51-67`):

  ```rust
  /// The payee as the ABI word of `address`.
  pub fn encode_payee(payee: &[u8; PAYEE_LEN]) -> [u8; 32] {
      let mut word = [0; 32];
      word[12..].copy_from_slice(payee);
      word
  }
  ```

`referee/zk/guest/src/bin/verify.rs:12-22`: replay `inputs.levels` as today, then `committed.extend(encode_payee(&inputs.payee))` before the single `env::commit_slice`. The property the file's header states is kept: nothing is committed unless every level replayed.

`referee/zk/guest/src/bin/trace.rs:15-16`: iterate `read_inputs().levels`. The trace guest commits no payee, so `TRACED_LEN` stays.

### 3.3 ZkReferee

`contracts/src/ZkReferee.sol`, prototyped and tested here (Appendix B is the diff):

- `:22` add `PAYEE_PUBLIC_VALUES_LENGTH = 32`; the expected length becomes `levelCount × 384 + 32` (`:69-75`), checked in a private `checkLength` that `payeeOf` shares.
- `:51` and `:64` decode `(ScoredOutcome[6], address)` and `(ScoredOutcome, address)`. The decoder reverts on a payee word whose 12 upper bytes are not zero **[here]**, which a correct guest never commits.
- New:

  ```solidity
  /// @notice The payee that a run proof's public values name. It checks no seal: the payee is
  /// the prover's only for a `proof` that `verifyRun` accepts.
  function payeeOf(bytes calldata proof) external pure returns (address payee);
  ```

  It reverts with `PublicValuesLengthMismatch` unless the public values are a run's 2,336 bytes. It lives in `ZkReferee` because `ZkReferee` owns the layout: the escrow never parses public values. It is `pure`, so it is only meaningful next to a successful `verifyRun` of the same `proof` bytes in the same transaction, which is how `ProofBounty.claim` uses it on both branches.
- `IReferee` is unchanged; `payeeOf` is outside it. `verifyRun` and `verify` ignore the payee.
- **[here]** `payeeOf` takes 10,840 gas as a call frame. Deployment: 820,068 gas on anvil, against 762,710 **[repo, docs/DEPLOYMENT.md]**; runtime 3,530 bytes.

### 3.4 Host

`referee/zk/host/src/lib.rs`:

- `:205-226` `env(inputs, payee: &[u8; 20], segment_limit_po2)`: after the levels, `builder.write_slice(payee)`.
- `:295-316` `check_levels` expects `records.len() * OUTCOME_LEN + WORD` bytes and checks that the last word is the payee it was given. `check_outcome` and `check_format` (`:256-259`, `:318-354`), which receive one level's words, are given the public values without the payee word by one helper that checks that word.
- `:14-16` `TRACED_LEN` unchanged.

`referee/zk/host/src/main.rs`:

- `:13-19` usage: each `prove` form takes `--payee <address>`, before the optional `--segment-po2 <n>`:

  ```text
  zk-host prove --level <game vector file> --payee <address> [--segment-po2 <n>]
  zk-host prove --run <six game vector files> --payee <address> [--segment-po2 <n>]
  zk-host prove --run <run file> --season <season file> --payee <address> [--segment-po2 <n>]
  zk-host execute-run --run <run file> --season <season file>          (new form, with M5.10: §5, step 4)
  ```
- `:233-241` `run` passes a payee. `execute`, `execute-run` and `difffuzz` use the zero address and check that the committed word is zero.

`referee/zk/host/src/prove.rs`:

- `:26-56` `--payee` is **required**: a prover that forgets it finds out before proving, not after. It is `0x` and 40 hex digits; the host does not check an EIP-55 checksum (it has no keccak), so the prover script passes an address it validated (§5).
- `:58` and `:80-81` both `check_levels` calls check the payee word, before proving and on the Groth16 receipt.
- `:95-134` the `zk-prove` block prints `payee: 0x…`, the public values' new size appears as it is, and the `zk-fixture` JSON gains `"payee"`.

`referee/zk/host/tests/mock_round_trip.rs:14-24`: pass a payee, check its word.

`referee/zk/host/Cargo.toml`, for the GPU prover (plan item M5.10, not the format item): `[features] cuda = ["risc0-zkvm/cuda"]`. **[here]** crates.io's index lists, for `risc0-zkvm` 3.0.6, `cuda = ["prove", "risc0-circuit-keccak/cuda", "risc0-circuit-recursion/cuda", "risc0-circuit-rv32im/cuda", "risc0-groth16/cuda", "risc0-zkp/cuda"]`, which agrees with the lead's finding that the Groth16 step also runs on the GPU. Nothing was built or timed here.

### 3.5 Fixtures and tests

The four real proofs of `contracts/test/fixtures/zk-proofs.json` (`level`, `run`, `worstCase`, `challengeRun`) are proofs of the old program: each must be proven again, under the one new image id, with a payee.

- **Payee of the fixtures:** `0x79d91B679DeD1b5e48D095D2f6af98fB2D32Cd47`, forge's `makeAddr("prover")`, so that the tests compare it without a constant. Its key is public by construction, which is harmless: these proofs settle only test deployments. Each entry gains `"payee"`, and its `source` says how the new proof was made.
- `contracts/test/fixtures/zk-run.json` does not change. `seasons/testnet-0/runs/run-1.proof.json` is a record of a run settled under the old referee and stays as it is.
- **Cost of re-proving.** **[repo, docs/VERIFICATION.md]** On 4 CPUs the same inputs took 3,297 s (`run`, 7 segments), 13,177 s (`worstCase`, 28) and 7,638 s (`challengeRun`, 16); `level` was proven only on a 2-vCPU runner, in 2,128 s. **[est]** About 7 hours on 4 CPUs for the four, or minutes on a GPU at the lead's rates. `worstCase` fits a `zk-prove.yml` job's 6 hours only on a 4-vCPU runner: it would take about 10 hours on 2 vCPUs **[repo]**.
- **[here]** Until then, 11 of the 15 tests of `contracts/test/ZkReferee.t.sol` fail with `PublicValuesLengthMismatch`: every test that feeds a committed proof to `ZkReferee`. `ZkVerify.t.sol`, which calls the verifier alone, still passes. So the format change and the new fixtures are one pull request.
- `contracts/test/ZkReferee.t.sol`: `:189` and `:213` expect lengths 2,336 and 416; `:131` flips the last byte "of level 5's levelScore", which becomes the payee's last byte: keep a score test at byte `6 × 384 − 1` and keep this one as the payee test (a proof does not verify with another payee); add `payeeOf` tests. The prototype's `ZkRefereePayeeTest` (8 tests, mock verifier) has them.
- `contracts/test/ZkVerify.t.sol:19-26` `publicValuesOf` appends `abi.encode(payee)` from the fixture; `:80` as above.

### 3.6 Other files that carry the format

- `scripts/contracts/e2e.mjs:224-255` (`devModeProof`, `proveRun`, `proveLevel`) and `:707-719` (`realProof`) pass `--payee`.
- `.github/workflows/zk-prove.yml:129-130` passes `--payee`.
- `scripts/contracts/fork-rehearsal.mjs` settles the `challengeRun` fixture on a fork: it works again once that fixture is re-proven for the same run file.
- `contracts/abi/ZkReferee.json` and `web/src/chain/bindings/ZkReferee.ts` are regenerated (`scripts/contracts/abi.sh`, `web/scripts/bindings.mjs`); CI checks the drift.
- Documentation: §7.

### 3.7 What does not change

`contracts/src/Challenge.sol`, `Season.sol`, `RunDerivations.sol`, `interfaces/IReferee.sol`, the mocks; `core/`, `RULES_VERSION` and `vectors/`; run file v1; the Stylus referee, which takes no proof. `ProofBounty` reads `Challenge` and `Season` only through functions that exist: `Challenge.runs`, `settlements`, `seasons`, `settleRun`; `Season.refereeOf`, `settlementEndOf`, `weightOf`.

### 3.8 Deployment consequence

The image id changes, `ZkReferee` pins it immutably, and a season's referee is fixed at `open`. The `ZkReferee` deployed on Arbitrum Sepolia (`0x1097BDED737146D4A83Cf969a357e504FA028c5a`, image id `0xa3013dc4…02b1`, **[repo]**) keeps settling `testnet-0` with 2,304-byte proofs. Bounties need a new `ZkReferee`, which by `docs/DEPLOYMENT.md` §4 means a new generation of all the contracts, now with `ProofBounty`.

## 4. The ProofBounty contract

One contract, about 150 lines, with no owner, no pause, no upgrade and no fee. Appendix A is the prototype, which lints clean and passes the tests of §9. The name is a proposal (§8, O4).

### 4.1 Interface

```solidity
contract ProofBounty {
    // Constants and immutables.
    uint64 public constant CLAIM_GRACE = 7 days;
    Challenge public immutable challenge;
    Season public immutable seasons;      // challenge.seasons()
    ZkReferee public immutable referee;   // the only referee whose runs it pays

    // Storage.
    mapping(uint256 runId => uint256) public bountyOf;                                    // unpaid total of the run
    mapping(uint256 runId => mapping(address depositor => uint256)) public depositOf;     // each depositor's part
    mapping(address payee => uint256) public owed;                                        // credited, not yet withdrawn

    // Events.
    event BountyPosted(uint256 indexed runId, address indexed depositor, uint256 amount, uint256 bounty);
    event BountyPaid(uint256 indexed runId, address indexed payee, uint256 amount);
    event BountyRefunded(uint256 indexed runId, address indexed depositor, uint256 amount);
    event Withdrawn(address indexed payee, uint256 amount);

    // Errors of its own.
    error ZeroAddress();
    error ZeroDeposit();
    error WrongReferee(uint256 runId, IReferee seasonReferee);
    error NoBounty(uint256 runId);
    error ZeroPayee(uint256 runId);
    error NoDeposit(uint256 runId, address depositor);
    error SettlementOpen(uint256 runId, uint256 settlementEnd);
    error ClaimOpen(uint256 runId, uint256 claimEnd);
    error TransferFailed(address to, uint256 amount);
    // Errors of Challenge that it raises itself, with Challenge's selectors:
    // Challenge.NotCommitted, Challenge.AlreadySettled, Challenge.SettlementClosed, Challenge.WrongCommitment.

    constructor(Challenge challenge_, ZkReferee referee_);

    function post(uint256 runId) external payable;
    function claim(uint256 runId, bytes[6] calldata levels, bytes[6] calldata journals, bytes calldata proof) external;
    function refund(uint256 runId, address depositor) external returns (uint256 amount);
    function withdraw(address payee) external returns (uint256 amount);
}
```

It has no `receive` and no `fallback`: ETH enters only through `post`. A `claim` can also revert with any error of `Challenge.settleRun`, of `Season`, of `ZkReferee` and of RISC Zero's verifier and emergency stop; a client decodes with those ABIs too.

### 4.2 Rules and reasons

**Deposits**

- **B1. Anyone may deposit on any run.** A sponsor or the operator can fund a player's proof, and no depositor slot exists for someone to occupy with 1 wei.
- **B2. `post` accepts a deposit only if it could be paid by a settling claim.** In this order, each failure reverting:
  1. `msg.value > 0`, else `ZeroDeposit`;
  2. the run is committed (`Challenge.runs(runId).committedAt != 0`), else `Challenge.NotCommitted`: before the commit there are no journals to price, and a run that does not exist reads the same;
  3. the run's season settles through this contract's referee (`Season.refereeOf(season)`), else `WrongReferee`: through another referee the payee would not be proven;
  4. the run is unsettled, else `Challenge.AlreadySettled`;
  5. `block.timestamp ≤ Season.settlementEndOf(season)`, else `Challenge.SettlementClosed`.
- **B3. Deposits add up.** `bountyOf[runId]` and `depositOf[runId][msg.sender]` both grow by `msg.value`. A top-up is a deposit.
- **B4. Nothing reduces a bounty before it is paid or refundable.** There is no withdrawal and no cancellation. Two reasons. A prover that reads `bountyOf ≥ price` must find at least that when it delivers, minutes or hours later. And a depositor who could withdraw would do it just before the claim lands, the claim would revert, and its calldata would hand the proof over for nothing.

**Payout**

- **B5. `claim` credits the run's whole bounty to the payee the proof names,** read by `ZkReferee.payeeOf(proof)`, never to the caller. Anyone may submit a proof. A copied proof pays its prover.
- **B6. The payee must not be the zero address,** else `ZeroPayee`: zero means the prover claimed nothing, and crediting it would burn the bounty.
- **B7. An unsettled run is settled by the claim,** through `Challenge.settleRun`, in the same transaction: the run settles if and only if the prover is credited.
- **B8. A run someone already settled, Settled or Late, pays on a proof verified by `ProofBounty` itself** (§4.3). Copying a proof and settling directly neither starves the prover nor frees the deposit.
- **B9. The branch follows the run's status when `claim` executes.** The caller does not choose, so a prover's transaction pays on either side of a copier's.
- **B10. One payout per run id.** `bountyOf[runId]` is zeroed when it is credited; `post` then reverts for good, the run being settled. Nothing is keyed on proof bytes, which anyone can re-randomize (§2, point 3).
- **B11. A Late run pays.** The proof was delivered; lateness is the run's result.
- **B12. Credit, then withdraw.** `claim` adds to `owed[payee]`; `withdraw(payee)` sends it, whoever calls. `claim` therefore calls no address the prover chose, a payee that rejects ETH affects only its own withdrawal, and a prover's hot key can move the credit to a cold payee.
- **B13. The first valid claim wins.** A later one reverts with `NoBounty`, before any verification. There is no lock and no stake.

**Refunds**

- **B14. A run left unsettled when its season's settlement ends returns its deposits.** From `block.timestamp > Season.settlementEndOf(season)`, `refund(runId, depositor)` sends `depositor` its own deposit. The condition is permanent, because no call can settle the run any more, and it never overlaps a claim.
- **B15. A settled run's bounty that nobody claimed returns `CLAIM_GRACE` (7 days) after the settlement end.** Until then only a proof can take it. After it, a claim still takes what was not refunded. A prover holding a proof needs one transaction within the settlement period plus 7 days, so the rule costs an honest prover nothing, and it is the only way out of the locked states of §2, point 4.
- **B16. A refund goes to its depositor, whoever calls.** The operator's season job can return forgotten deposits; nobody can redirect one.

**The contract itself**

- **B17. No privileged role.** Three immutables, no setter. The only outside powers over it are the ones over settlement: RISC Zero's emergency stop, and the sequencer's ordering.
- **B18. Checks, effects, then interactions.** `refund` and `withdraw` write state before they send. `claim` writes its credit before it calls `Challenge` or the referee, and a failure there reverts the credit.

### 4.3 `claim`, both branches

Common to both, in this order:

1. `bountyOf[runId] != 0`, else `NoBounty`. A non-zero bounty implies B2 held at deposit, and none of B2's conditions on the season and referee can change.
2. `payee = referee.payeeOf(proof)`, which reverts on public values that are not a run's; `payee != address(0)`, else `ZeroPayee`.
3. Effects: `bountyOf[runId] = 0`, `owed[payee] += amount`, `emit BountyPaid`.
4. One of the two branches. If it reverts, the whole call reverts.

**Branch A: the run is unsettled. `Challenge.settleRun(runId, levels, journals, proof)` performs every check** (`contracts/src/Challenge.sol:148-171`):

| Check | Performed by |
|---|---|
| committed, not settled, `block.timestamp ≤ end + grace` | `checkSettlementOpen`, `Challenge.sol:210-216` |
| the six journals hash to the run's commitment | `RunDerivations.commitmentOf`, `Challenge.sol:153-154` |
| each level is one of the season's 16; its slot and weight | `levelInSeason`, `Challenge.sol:219-223`, through `Season.slotOf` and `weightOf` |
| the seal proves the public values under the pinned image id; exact length; the verifier is not stopped | `ZkReferee.verifiedPublicValues`, `ZkReferee.sol:69-75`, through RISC Zero's emergency stop and Groth16 verifier |
| each proven weight, journal hash and level id is the submitted one | `ZkReferee.boundOutcome`, `ZkReferee.sol:78-94` |
| each Outcome's journal hash, level id, run nonce, level index, mode, rules version and draw slot are the run's | `Challenge.checkOutcome`, `Challenge.sol:241-260` |
| the deadline: Late or Settled, then `Season.recordRun` | `Challenge.finishRun`, `Challenge.sol:270-282` |

`settleRun` stays available after partial `settleLevel` calls (README §7.2), so this branch also covers a run with some levels settled.

**Branch B: the run is Settled or Late. `ProofBounty.verifySettledRun` performs three checks:**

| Check | Performed by |
|---|---|
| the six journals hash to the run's commitment, else `Challenge.WrongCommitment` | `RunDerivations.runCommitment`, `RunDerivations.sol:14-16`, against `Challenge.runs(runId).commitment` |
| each level is one of the season's 16, and its weight | `Season.weightOf(season, keccak256(levels[i]))`, `Season.sol:261-263`, which reverts with `LevelNotInSeason` through `slotOf` |
| the seal, the image id, the length, and each proven weight, journal hash and level id | `ZkReferee.verifyRun`, `ZkReferee.sol:44-55`, called on the pinned referee |

Why these three suffice. An Outcome is a function of the level bytes, the journal bytes and the weight. The journals are the committed ones. The level is forced by its journal, whose header names the level id that replay checks (`core/src/replay.rs:47-49`). The weight is the season's for that level. So the six Outcomes this proof commits are the ones that passed `checkOutcome` when the run settled, and no cheaper proof exists: any proof that passes replayed the run's six journals in full. The settlement deadline is not checked: a settled run's bounty stays claimable after the settlement end, which is what gives B15 its window. Six `settleLevel` calls leave the run in the same state as `settleRun`, so the branch covers them too.

### 4.4 `refund`

`refund(runId, depositor)`, in this order:

1. `depositOf[runId][depositor] != 0`, else `NoDeposit`;
2. `bountyOf[runId] != 0`, else `NoBounty`: the bounty was paid, and the deposit records of a paid run are stale on purpose;
3. if the run is unsettled: `block.timestamp > settlementEnd`, else `SettlementOpen`; if it is settled: `block.timestamp > settlementEnd + CLAIM_GRACE`, else `ClaimOpen`;
4. effects: the deposit to zero, `bountyOf[runId] -= amount`, `emit BountyRefunded`; then the send, reverting with `TransferFailed` if the depositor rejects ETH, which keeps the deposit.

Invariant behind step 2: an unpaid bounty equals the sum of its remaining deposits, and a paid one is zero for good.

### 4.5 Cases

| Case | What happens |
|---|---|
| Late run | Branch A settles it as Late and credits the payee; branch B treats Late as settled. The depositor paid for a run that earns nothing: the dApp warns before the deposit. |
| Journals that replay rejects | No proof can exist, the run stays unsettled, and B14 refunds after the settlement end. The executor shows the rejection to a prover in seconds, and the wasm core shows it to the dApp before the deposit. Nothing onchain can show it earlier. |
| Uncommitted run, or a run id that does not exist | `post` reverts with `Challenge.NotCommitted`. |
| Several depositors | Each has its own `depositOf`; the payout takes the whole `bountyOf`; each refund returns one depositor's part. |
| Top-up | A further `post`, by anyone, while B2 holds. |
| Deposit on a settled run, or after the settlement end | `post` reverts. |
| Run of a season with another referee | `post` reverts with `WrongReferee`. |
| A copier settles directly with the prover's proof | The prover's `claim` takes branch B and credits the prover. If the copier calls `claim` instead, it credits the prover and pays the gas. |
| A copier changes the payee word | The seal no longer verifies: `VerificationFailed`. |
| A re-randomized seal | Same public values, same payee, one payout. |
| Two provers | The first `claim` to execute is credited; the other reverts with `NoBounty`. |
| Run settled by a proof with no payee, or by six level proofs, or by someone who never claims | The bounty stays open to any valid run proof with a payee until it is refunded under B15. |
| The verifier is stopped | Every claim reverts with `EnforcedPause`, for good. Unsettled runs refund under B14, settled ones under B15. |
| A proof that names the zero address | `claim` reverts with `ZeroPayee`. The proof can still settle the run through `Challenge`. |
| A payee that rejects ETH | Its `withdraw` reverts and keeps the credit. The claim, and so the settlement, went through. |
| `claim` on an unsettled run after the settlement end | Reverts with `Challenge.SettlementClosed`; the deposits refund. |
| The same run funded in two `ProofBounty` contracts over the same referee | Each pays its own bounty once, to the same payee: the first claim settles the run, the second verifies the proof on the settled run. |
| ETH forced in by `selfdestruct` | Not accounted, and stays. |

### 4.6 Who calls what, and why

| Call | Who | Why they would | Gas they pay (§6) |
|---|---|---|---|
| `post` | the player, or a sponsor | a settled best run is the only way to a share of the pot | 97,436 |
| `claim` | a prover, or anyone holding a valid proof | the bounty, credited to the proof's payee | about 590,000 for a human-style run |
| `withdraw` | the payee, or its hot key | its own credit | about 38,000 |
| `refund` | the depositor, or the operator's season job | its own deposit back | about 67,000 |

- **Operator powers:** none in this contract. Seasons and their referee stay the operator's, as today.
- **If the operator disappears:** `post`, `claim`, `refund` and `withdraw` keep working for the seasons already open; what stops is the opening of new seasons, as today.
- **What an observer learns:** who funded which run and for how much, which payee proved it, and every proof and journal, which were public already.

### 4.7 Invariants and tests

Invariants, all held over 256 runs of 500 calls with no reverting call **[here]**:

1. the balance equals what was deposited minus what was refunded and withdrawn;
2. the balance equals the sum of `bountyOf` over runs plus the sum of `owed` over payees;
3. an unpaid bounty equals the sum of its deposits;
4. for each run, paid plus refunded plus remaining equals deposited;
5. only settled runs are paid.

Tests to write, one scenario each; the prototype's 52 tests of `ProofBountyTest` are the list, by name:

- **`post`:** adds to the bounty; a top-up; a second depositor; reverts with no value, on an uncommitted run, on an unknown run, on a run of another referee, on a settled run, after the settlement end; succeeds at the settlement end.
- **`claim`, unsettled run:** settles the run; credits the payee; credits the payee when another address submits; credits several depositors' total; pays for a Late run; settles after two `settleLevel` calls; reverts with no bounty, on a second claim, on a zero payee, on another payee under the same seal, on a rejected settlement (bounty kept), after the settlement end, once the verifier is stopped.
- **`claim`, settled run:** pays the prover whose copied proof settled the run; pays the first proof presented; pays for a run settled Late; pays for a run settled level by level; pays after the settlement end; reverts on another payee under the same seal, on journals outside the commitment, on another run's proof, on a level outside the season.
- **`refund`:** returns an unsettled run's deposit; pays the depositor when another address calls; reverts at the settlement end, with no deposit, on a second refund, on a paid bounty, on a settled run until the claim grace has passed; returns a settled run's unclaimed deposit after it; leaves the other deposits claimable; keeps the deposit when the depositor rejects ETH; a re-entering depositor gets nothing more.
- **`withdraw`:** sends the credit whoever calls; returns zero with nothing owed; a re-entering payee gets nothing more; keeps the credit when the payee rejects ETH.
- **Once the fixtures are re-proven:** one test claims a bounty with the real `challengeRun` proof and expects `makeAddr("prover")` credited.
- **A test trap met here:** `vm.expectRevert` applies to the next call, and `sha256(...)` in the reverting call's arguments is a call to a precompile. Compute digests and proofs before `vm.expectRevert`, as `ZkVerify.t.sol` does with `this.verifyFixture`.

The tests use the real `Challenge`, `Season` and `ZkReferee`, and RISC Zero's emergency stop over its mock verifier, whose seal is the selector and the claim digest, so a test builds the proof of any public values in Solidity (`BountyFixture`, in the prototype). The handler's `playedLevelsOf` duplicates `SettlementHandler`'s private one: in the repository it should be shared, not copied.

Static analysis **[here]**: slither 0.11.6 gives 12 results on the repository's sources, as `docs/ECONOMY.md` §6 records, and 23 with the prototype. The 11 new ones are all in `ProofBounty`: 6 `unused-return` (partial reads of public getters, and `verifyRun` called for its revert), 1 `uninitialized-local` (`weightsBp`, filled by the loop, as in `Challenge`), 1 `calls-loop` (six `weightOf` views on the immutable `Season`), 2 `timestamp`, 1 `low-level-calls`. None is a reentrancy result. `forge lint` needs six `disable-next-line(unused-return)` comments, which the prototype has.

### 4.8 Deployment and tooling

- `scripts/contracts/deploy.mjs`: build `ProofBounty` (`:65`); on the zk backend deploy it after `Challenge`, with `(Challenge, ZkReferee)` (`:190-228`); record its address.
- `deployments/README.md` and `scripts/contracts/deployments.mjs:10-12,37-52`: a generation gains the key `ProofBounty`. It must be **optional**: `assertGeneration` requires exactly the listed keys, and the committed generation of `deployments/arbitrum-sepolia.json` has none, and is kept as it is.
- `web/src/chain/deployments.ts:8` and `contracts.ts`: the optional address and the binding.
- `scripts/contracts/localnet.mjs --backend zk` uses MockReferee as a stand-in today; for bounties it must deploy `ZkReferee` over the mock verifier, as `deploy.mjs --backend zk` does on local chains, and `ProofBounty`.
- `scripts/contracts/e2e.mjs`, zk mode: three cases with dev-mode proofs on the local chain: a claim on an unsettled run; a proof used on `Challenge.settleRun` directly, then claimed; a refund after the settlement end.
- `scripts/contracts/abi.sh` writes `contracts/abi/ProofBounty.json`; `web/scripts/bindings.mjs` writes its binding. The contract has no overloaded function, which the bindings do not support.
- After a deployment, the bounty e2e case must pass before the address is announced: nothing in the constructor proves that the referee has `payeeOf`.

## 5. Prover protocol and pricing

The script acts for one payee, with one hot key that only pays gas. Every chain read of a step is made at one block.

**Once per generation**

1. Build `zk-host` at the fixed path (`referee/zk/README.md`, Reproducible image ids), with the `cuda` feature. Require `zk-host image-id` to equal `ZkReferee.imageId()`, and `ProofBounty.referee()` to be the season's referee.
2. Calibrate: prove `contracts/test/fixtures/zk-run.json` (16 segments **[repo]**) and record seconds per segment, the Groth16 step's seconds, and the card's limits. Nothing about a GPU is measured in the repository.
3. Configure: the payee, validated as an EIP-55 address; the hot key; the cost of a second of proving; a minimum margin; a time safety factor.

**Per bounty**

1. **See it.** Read `BountyPosted` logs of `ProofBounty` in chunks, as `web/src/chain/logs.ts` reads logs, and `bountyOf(runId)` at the head. Forget a run on `BountyPaid`, or when its refunds bring it to zero.
2. **Screen it,** for free: the run is unsettled; the emergency stop that `ZkReferee.verifier()` names is not paused; `Season.settlementEndOf(season)` is far enough (step 5). A settled run with an unpaid bounty would pay too, for a proof that settles nothing (§8, W6): the owner's prover leaves those to the refund of B15, unless it already holds the proof.
3. **Rebuild the run file** (run file v1) from the chain, never from the depositor: the six journals from the `commitRun` calldata, checked against `Challenge.runs(runId).commitment`; the run nonce from `runs(runId)`; the drawn levels from the shipped level bytes whose ids the season holds. `web/src/chain/calldata.ts` does the first part today.
4. **Count the cycles.** `zk-host execute-run --run <run file> --season <season file>` (new form, plan item M5.10) executes the run in seconds and prints the proving cycles and segments. If replay rejects, mark the run unprovable for good: no proof can exist.
5. **Price it and decide.**

   ```text
   cost  = claimGas × gasPrice × 1.25                  claimGas ≈ 575,000 + 17 × (bytes of the six journals)   [est, §6]
         + L1 data fee of the claim                    Arbitrum One only; at most calldata bytes × ArbGasInfo's price per byte
         + (segments × secondsPerSegment + groth16Seconds) × costPerSecond
   take if  bountyOf(runId) ≥ cost + margin
        and settlementEnd − now ≥ 2 × provingSeconds + 600
   ```

   A bounty too low is left alone; a top-up emits `BountyPosted` again. The quote cannot go stale: a bounty only grows (B4).
6. **Prove.** Read the status and the bounty again, then `zk-host prove --run <run file> --season <season file> --payee <payee>`. The host checks the receipt and the public values, payee included, before it prints them. Write `<run file>.proof.json` to disk before any transaction: it is the claim, and it stays valid for the whole claim window.
7. **Check before sending:**
   - `bountyOf(runId) > 0`; if it is zero another prover was paid, and nothing is sent;
   - `ZkReferee.payeeOf(proof)` is the configured payee;
   - `eth_call` of `claim(runId, levels, journals, proof)` succeeds, whatever the run's status now is;
   - the gas limit is `eth_estimateGas × 1.3`; the hot key holds it;
   - the settlement end is still ahead, if the run is unsettled.

   The simulation shows the proof to the RPC provider. That is harmless by design.
8. **Send `ProofBounty.claim`,** never `Challenge.settleRun`: a direct settlement leaves the bounty to whichever claim comes first.
9. **Read the receipt.** Success means a `BountyPaid(runId, payee, amount)` with the configured payee. On a revert: `NoBounty`, another claim won; `Challenge.SettlementClosed`, too late; out of gas or a network failure, send again. The proof is public from then on, and whoever uses it credits the same payee.
10. **Withdraw.** `withdraw(payee)` from the hot key when `owed(payee)` passes a threshold.

The script prints each step between `=== BEGIN <name> ===` and `=== END <name> ===` markers (plan §1.3), so the supervising agent reads states, not prose.

**Pricing, for the poster.** The contract knows no price. The browser cannot count cycles, and cycles do not follow ticks: **[repo]** 567 ticks took 15.4 million cycles (`zk-run.json`), 3,181 ticks 72.4 million, 4,710 ticks 84.9 million (`docs/DEPLOYMENT.md` §6). So the dApp proposes a default from the season's observed bounties, the operator's prover publishes its formula, and a bounty nobody takes is topped up. A quote service is a later step (§8, O8).

## 6. Gas and costs

**Method.** `forge test` with `vm.lastCallGas()`, as `ChallengeGas` and `SettlementGas` measure (forge 1.8.6, solc 0.8.28, optimizer 200 runs, `shanghai`). For a state-changing call the figure is a transaction's gas, base and calldata included: **[here]** `MockArbSys.setBlockNumber` reads 26,506, the anvil receipt that `docs/DEPLOYMENT.md` §5 records, and `ProofBounty.post` reads 97,436 both in the test and in an anvil receipt. The Groth16 verification is RISC Zero's mock behind its real emergency-stop contract.

**From mock to real.** **[here]** Through the emergency stop, the real Groth16 verifier's frame takes 230,876 gas (the figure `docs/VERIFICATION.md` records) and the mock's 10,706: 220,170 more. A real seal is 224 bytes longer than a mock one, about 3,600 gas of calldata. **[est]** Real = measured + 223,800. Check against the chain: this gives 536,300 for a direct `settleRun` with 1,002 bytes of journals, and the settlement of run 1 on Arbitrum Sepolia took 530,256 gas with 723 bytes **[repo, docs/DEPLOYMENT.md]**.

| Call | Journals | Calldata | Gas, mock verifier [here] | Gas, Groth16 verifier [est] |
|---|---|---:|---:|---:|
| `post`, a run's first deposit | | 36 B | 97,436 | same |
| `post`, a top-up by the same depositor | | 36 B | 63,236 | same |
| `post`, a second depositor | | 36 B | 80,336 | same |
| `claim`, unsettled run | typical: 6 × 167 B | 7,492 B | 364,880 | 588,700 |
| `claim`, unsettled run, payee already owed, season already has points | typical | 7,492 B | 330,692 | 554,500 |
| `claim`, unsettled run | gate set: 21,747 B | 28,164 B | 707,956 | 931,800 |
| `claim`, unsettled run | full: 6 × 8,171 B | 55,492 B | 1,174,601 | 1,398,400 |
| `claim`, settled run | typical | 7,492 B | 230,323 | 454,100 |
| `claim`, settled run | gate set | 28,164 B | 567,944 | 791,700 |
| `claim`, settled run | full | 55,492 B | 1,024,874 | 1,248,700 |
| `Challenge.settleRun`, for comparison | typical / gate set / full | same | 312,526 / 650,290 / 1,107,411 | 536,300 / 874,100 / 1,331,200 |
| `refund` | | 68 B | 67,481 | same |
| `withdraw`, to a funded account | | 36 B | 37,949 | same |
| deploy `ProofBounty` (5,805 bytes of runtime) | | | 1,314,624, anvil receipt | same |
| deploy the changed `ZkReferee` | | | 820,068, anvil receipt | same |

- **The escrow adds 52,000 to 67,000 gas to a settlement** (364,880 against 312,526; 1,174,601 against 1,107,411), about 10 % for a human-style run: the credit's storage write, `payeeOf`, and one more copy of the calldata.
- **Anvil receipts [here]**, same contracts, other inputs: `claim` 359,852 on an unsettled run, 208,195 on a settled one, 277,701 when neither the payee's credit nor the player's best run is new; `withdraw` 30,649.
- **Formula for a quote [est]:** `claimGas ≈ 575,000 + 17 × journal bytes`, within 1.5 % of the three estimates above.
- **Limits:** the largest claim is under 1.4 million gas, against Arbitrum's 32 million, and 55,492 bytes, against the sequencer's 95,000 **[repo, README §7.3]**.

**Prices [here], 2026-11-10 15:02 UTC.** Arbitrum One, block 523,011,416: base fee 0.020214 gwei, `cast gas-price` 0.02 gwei, `ArbGasInfo.getPricesInWei` 228,810,576 wei per byte of L1 data. Arbitrum Sepolia, block 327,905,246: 0.02 gwei, L1 data priced at 0. ETH at $2,091.84 (Coinbase spot).

| | Arbitrum One, L2 gas | L1 data [est] | Total | Against the 0.00005 ETH run fee |
|---|---:|---:|---:|---:|
| `post` | 0.0000020 ETH | negligible | 0.0000020 ETH ($0.004) | 4 % |
| `claim`, human-style run (typical journals) | 0.0000119 ETH | 0.0000004 to 0.0000017 ETH | 0.0000123 to 0.0000136 ETH ($0.026 to $0.029) | 25 to 27 % |
| `claim`, bot-style run (gate-set journals) | 0.0000188 ETH | 0.0000037 to 0.0000064 ETH | 0.0000225 to 0.0000253 ETH ($0.047 to $0.053) | 45 to 51 % |
| `claim`, six full journals | 0.0000283 ETH | at most 0.0000127 ETH | at most 0.0000410 ETH ($0.086) | at most 82 % |

The L1 range runs from the brotli-compressed size of the calldata (quality 0: 1,829 bytes for the fixture run's 7,556, and 15,954 for the gate-set run's 28,164 **[here]**) to its raw size. No real settlement's L1 fee was ever measured: Arbitrum Sepolia charges none **[repo]**.

**Proving time [lead], not measured on this guest.** 0.57 s per 2^20-cycle segment plus 0.33 s of recursion and about 2 s for the Groth16 step on an RTX 5090; 8 to 15 minutes per 10^8 cycles on a 16 GB card of the RTX 4060 Ti class. No figure exists for the owner's RTX 3060 12 GB.

| Run | Cycles | RTX 5090 [est] | 4060 Ti class [est] | 4 CPUs [repo rate, 467 s per segment] |
|---|---:|---:|---:|---:|
| human-style | 15 to 18 million [lead] | 15 to 20 s | 1 to 3 minutes | about 2 hours |
| bot-style | 70 to 137 million [repo] | 1 to 2 minutes | 6 to 21 minutes | 9 to 17 hours |
| one-cell captures | about 2.9 billion [lead] | about 40 minutes | 4 to 7 hours | 15 days |

**[est]** At 200 W and $0.30 per kWh, a second of proving costs about 0.000000008 ETH: under 0.0000015 ETH for a human-style run on the slower card, and 0.000003 to 0.00001 ETH for a bot-style one. So the claim's gas dominates, and a sensible bounty today for a human-style run on Arbitrum One is 0.000015 to 0.00002 ETH, 30 to 40 % of the run fee.

## 7. Documents and plan items to change

**Rules that apply** (CLAUDE.md): a change to `contracts/src/**` updates README §7 and §8 where a frozen rule or range changes, regenerates `contracts/abi/`, and updates the threat table of `docs/ECONOMY.md` if a mitigation moved; README §7 and §8 own the numbers of runs and settlement, so `CLAIM_GRACE` is written there; the plan's rule is one work item, one pull request, each new item taking the next free number of its milestone. No `core/src/**` change: `RULES_VERSION` and the vectors stay. No status line moves: none of these items closes a milestone.

**README.md**

| Place | Change |
|---|---|
| §7.2, step 4 | Settlement stays open to anyone; add that a bounty settles a run through `ProofBounty.claim`. |
| §7.3, the `proof` bullet (`:645`) | The public values end with `abi.encode(address payee)`; `ZkReferee.payeeOf`. |
| §7.3, the cost table and "Verify by exception" | The Boundless price is no longer an offer: the market paused on 2026-11-05 **[lead]**. Proving is bought through bounties. |
| §7.5 (`:669-683`) | Rewrite from "Later version: proving service" to the bounty rules B1 to B18, with `CLAIM_GRACE` = 7 days. "Someone pays for proving" becomes: the depositor, on delivery. Gasless claims stay later. |
| §8.4, Custody (`:757`) | `Season` holds the fees; `ProofBounty` holds bounties and provers' credits, outside `Season`'s solvency invariant, with its own. |
| §9, the "Later" row (`:774`) | The bounty part moves into M5. |
| §13, D2 (`:854`) and D13 (`:865`) | D2: the proving route, an open bounty market, the owner's GPU first (owner, 2026-11-10). D13: the contract's name. |
| §3, the `contracts/` row | "Payments, entropy, runs, seasons, proof bounties". |
| Repository files | `docs/PROVER.md`, when M5.10 adds it. |

**Other documents**

| File | Change |
|---|---|
| `referee/zk/README.md` | `:13` the `prove` forms with `--payee`; `:19-26` the input stream and the table (416 and 2,336 bytes); `:28-49` the public values table gains the payee word, and "Onchain" the new lengths and `payeeOf`; `:71-83` "Proving a run for settlement" with `--payee` and `ProofBounty.claim`; `:85-92` the fixture's `payee` key, and the GPU build. |
| `docs/VERIFICATION.md` | `:706`, `:745`, `:963` the lengths; the image-id table and the fixture set (`:959-991`) with the new image id, the re-proven fixtures and their timings; a `ProofBounty` gas section from §6; a GPU proving section when measured. Lines `:191` and `:389` describe the M1 trials and stay. |
| `docs/ECONOMY.md` §1 | The money flow gains the bounty: deposit, credit on delivery, refund; the escrow's invariant. `:7` and `:17` no longer say all ETH is in `Season`. |
| `docs/ECONOMY.md` §2 | Rows for `post`, `claim`, `refund` and `withdraw`; the Boundless row (`:42`) marked paused; the cost of one verified run (`:44`) with the escrow's overhead. |
| `docs/ECONOMY.md` §3 | New rows, each with its tests: a copied proof; a withdrawn bounty; a copied proof used to settle directly; a re-randomized seal; racing provers (accepted residual); a bounty nobody takes, or on rejected journals; a settled run's unclaimed bounty; a stopped verifier. Changed rows: "On zk, the operator is in practice the only prover" (`:84`) and "zk prover trust" (`:83`). |
| `docs/ECONOMY.md` §4 and §6 | §4: the lock with a stake, and gasless claims, as later work. §6: a review of `ProofBounty` and of the changed `ZkReferee`, with the slither results of §4.7. |
| `docs/DEPLOYMENT.md` | §4: `ProofBounty`'s immutables, and that a new verify program means a new `ProofBounty` too; a section for the second generation when it is deployed. |
| `deployments/README.md` | The optional `ProofBounty` key; the `zk` backend's text ("whose runs the operator proves and settles"). |
| `docs/TOOLING.md` | The GPU machine's setup, with M5.10. |
| `TODO.md`, "Proving service" | What is built (bounties) and what stays deferred. |
| `.claude/skills/onchain-referee/SKILL.md` | One line under Security: a proof names its payee, and a bounty is paid by run id, never by proof bytes. |

**IMPLEMENTATION_PLAN.md**

New items, in dependency order. M5.4 is deferred and M5.7 is the last id in use, so they start at M5.8.

| ID | Title | Depends on | Size | Needs user |
|---|---|---|---|---|
| M5.8 | Payee in the zk public values: guest, `ZkReferee.payeeOf`, host `--payee`, the four fixtures re-proven, tests, `e2e.mjs`, `zk-prove.yml`, ABI, documents | M4.10, M4.14 | M | None if the fixtures are proven in the container (about 7 h on 4 CPUs, over several sessions) or by `zk-prove.yml`; otherwise the owner's GPU and the four fixture lines pasted in the PR |
| M5.9 | `ProofBounty`: contract, unit, invariant and gas tests, deploy tooling and the deployments schema, ABI and bindings, e2e bounty cases, README §7.5, ECONOMY | M5.8 | M | Approve the rules by merging: `CLAIM_GRACE`, pull payment, the name |
| M5.10 | Prover: the `cuda` feature, `execute-run --run`, the bounty loop of §5, `docs/PROVER.md`, the GPU's measured rates | M5.9 | M | The GPU machine, a funded hot key, the payee address; the calibration figures |
| M5.11 | Bounties in the dApp: `settle.ts` on zk posts, tops up, shows and refunds a bounty, after a local replay; `localnet.mjs --backend zk` with `ZkReferee` and `ProofBounty` | M5.9 | M | None |
| M5.12 | Second generation on Arbitrum Sepolia: the payee `ZkReferee`, `ProofBounty`, one bounty posted, proven on the GPU and claimed | M5.9, M5.10 | S | Keys, funding, the GPU, approval |

Edits to what exists:

- **Lines 5 and 15:** the item counts (58 items, "M5 6").
- **§10, the M5 table and M5.5:** the proving route is decided (owner, 2026-11-10), so "Choose the proving route" leaves M5.5's "Needs user"; `season.mjs settle` is replaced by M5.10's loop, and `season.mjs` gains the refund sweep of B16; the grace derives from the GPU's measured time per run; `season-ops.yml` requests no proof from a prover network; M5.5 depends on M5.12 for `testnet-1.json`'s referee.
- **M5.3's text and M5.6:** on zk, best runs settle through bounties; the report adds bounties posted, paid and refunded, and proving times. M5.5's `docs/SEASON_RUNBOOK.md` and `docs/TESTNET.md` describe bounties, not the operator's settlement.
- **§11:** two rows, the proving route (owner, 2026-11-10) and the bounty rules (M5.9); D2's row.
- **§12:** `M5.8 -> M5.9 -> M5.10, M5.11 ; M5.9 + M5.10 -> M5.12 -> M5.5`.
- **§13:** round G2 loses the route choice and gains the GPU steps; a step for M5.8's fixtures if the owner proves them.
- **§14:** the rows "Actions cannot prove players' whole runs", "The settlement grace is too short for zk proving" and "A prover network needs real money on a mainnet chain" are rewritten; new rows: a copied proof (retired by M5.8 and M5.9), no prover takes a bounty before the settlement end, racing provers, nothing measured on a GPU (retired by M5.10).
- **§15, question 8:** who proves, and how they are paid.
- **§16:** "Proving service" keeps gasless claims and gains the lock with a stake.

## 8. Weaknesses and open decisions

**Weaknesses, most serious first**

- **W1. The escrow moves the cost; it does not lower it.** A human-style settlement costs 0.000012 to 0.000014 ETH of gas alone on Arbitrum One today, a quarter of the run fee, before the prover's margin, and every player who wants a share must fund one. A player whose expected share is below the bounty will not post, and the pot goes to those who do.
- **W2. Nothing makes a prover exist.** If the one home GPU is off, or a bounty is below its price, the run stays unsettled, the deposit comes back, and the payout is lost. Runs funded in the last hours of the settlement period are the most exposed, and a legal journal of about 2.9 billion cycles takes hours on a small card.
- **W3. No GPU figure was measured on this guest,** and none exists for the RTX 3060 12 GB. Prices, the time rule and the settlement grace all rest on M5.10's calibration.
- **W4. The format change is not free.** A new image id, four proofs to make again (about 7 hours on 4 CPUs), 11 tests red until then, a new generation on Arbitrum Sepolia, and the `--payee` argument everywhere a proof is made.
- **W5. Racing provers lose their work.** The first claim wins. With one prover it does not matter; with several it invites either waste or an offchain agreement.
- **W6. A bounty on a run settled outside the escrow pays for a useless proof.** If the operator settles a funded run for free, any prover can still prove it again and take the bounty until B15 returns it. Rule for every tool: when a run has a bounty, settle it through `claim`, with a payee.
- **W7. Deposits are locked until the settlement end,** up to the season's length plus its grace (16 days for a 14-day season with 48 h of grace), even when no proof can ever exist. The dApp must replay before it lets a player deposit.
- **W8. RISC Zero's emergency stop is outside the project and permanent.** After it, no claim verifies, proving in progress is lost, deposits return only at the refund dates, and the season's pot is shared among the runs settled before it.
- **W9. The payee is fixed when proving starts.** A wrong address is a lost bounty; the host does not check a checksum.
- **W10. The sequencer can still delay or drop a claim.** It cannot redirect one.
- **W11. `ProofBounty` is unaudited code holding users' ETH.** It gets the review M4.12 gave the others, on testnet only.
- **W12. `settleLevel` is never paid.** A run settled through six level proofs earns its provers nothing from the escrow.
- **W13. No offer of proofs exists outside this market.** Boundless, the only hosted source of these proofs, paused **[lead]**.

**Open decisions**

| # | Decision | This specification's choice | Alternative |
|---|---|---|---|
| O1 | A settled run's unclaimed bounty | Refund `CLAIM_GRACE` = 7 days after the settlement end (B15). Added to the sketch. | The sketch as written: never refunded. One constant, one branch and three tests go; the locked states of §2, point 4 stay. |
| O2 | How the payee receives | Credit and `withdraw(payee)`; one withdrawal, about 38,000 gas, covers any number of claims | Send in `claim`: no withdrawal for the prover; a payee that rejects ETH then makes its own claim, and the settlement in it, revert. |
| O3 | Payee in level proofs | Yes, one layout rule | Run mode only: the two level fixtures keep their public values. |
| O4 | The contract's name | `ProofBounty` (D13 lists the names; "bounty" also names a Superchallenge idea in `TODO.md`) | `Bounty`, `ProofEscrow` |
| O5 | Deposits before the commit | Refused | Accepted: one step less in the dApp, deposits on runs that may never be committed. |
| O6 | Cancelling a deposit | Never before the refund dates | A cancellation that takes effect after a delay longer than any proving time: more state, and provers must watch it. |
| O7 | One escrow per referee | Pinned, immutable | Follow each season's referee: one escrow for all generations, and deposits on seasons whose referee cannot name a payee. |
| O8 | Price discovery | Offchain: a default in the dApp, the prover's published formula, top-ups | A quote endpoint; a lock with a stake (the sketch's point 8). |
| O9 | Who makes the four fixtures | The item's agent, in the container | The owner's GPU, which also gives the first GPU timings. |
| O10 | The operator's own proving | Through `claim`, with its payee, for runs with a bounty | Free settlement of best runs, as M5.5 planned: then W6. |
| O11 | Who may trigger a refund | Anyone, for a named depositor, as `withdraw` (B16) | The depositor only, as `Season.claim`: no sweep by the season job. |

## 9. What was run

Everything is under `scratchpad/escrow/`. The repository was only read; `git status` is clean.

- **Tools.** `bash scripts/bootstrap.sh contracts` installed Foundry v1.8.6 (and cargo-stylus, binaryen, slither 0.11.6); log in `bootstrap.log`. The repository's submodules are not checked out, so forge-std v1.17.0 (`f3dae6e`), OpenZeppelin v5.7.0 (`cab1993`) and risc0-ethereum v3.0.1 (`365e7b2`), the revisions of `contracts/foundry.lock`, were cloned into `proto/contracts/lib/`. `referee/zk` was not built and Docker was not run.
- **Baseline.** `proto/` holds copies of `contracts/src`, `contracts/test`, `foundry.toml`, `vectors/` and `seasons/`. `forge test`: 218 tests pass, as in the repository. Deployments on anvil match `docs/DEPLOYMENT.md` to the unit (`Season` 1,736,804, `Challenge` 1,971,257, `ArbBlockhashEntropy` 496,229).
- **Prototype.** `proto/contracts/src/ZkReferee.sol` (changed; `ZkReferee.diff` is its diff) and `proto/contracts/src/ProofBounty.sol` (new). `forge lint src` reports nothing, and `forge fmt --check` passes on both.
- **Tests,** `forge test` in `proto/contracts` (log: `full-suite.log`): 302 tests in 21 suites, 291 passing and 11 failing. The 11 are the tests of `ZkReferee.t.sol` that use the committed proofs, all with `PublicValuesLengthMismatch`, as §3.5 says; the other 207 of the repository's 218 tests pass, and so do the 84 new ones. The new files:
  - `test/ProofBounty.t.sol`: `ZkRefereePayeeTest`, 8 tests; `ProofBountyTest`, 52 tests;
  - `test/ProofBountyGas.t.sol`: 18 measurements (`gas-table.txt`);
  - `test/ProofBountyInvariant.t.sol`: 5 invariants, 256 runs, 128,000 calls, no revert (`invariant-full.log`); path counters show claims on unsettled and settled runs, direct settlements, and refunds of both kinds reached;
  - `test/Rerandomized.t.sol`: 3 tests against RISC Zero's real Groth16 verifier, on seals made by `rerandomize/rerandomize.py` from the `challengeRun` fixture (`(A, B, C)` to `(A, B + t·δ, C + t·A)`);
  - `test/CalldataDump.t.sol`: the calldata of two claims, for the compression estimate (`calldata-dump.txt`).
- **Transactions on anvil.** `script/BountyFlow.s.sol`, broadcast with `forge script`: deployments, a season, three runs, deposits, a claim on an unsettled run, a direct settlement then a claim, a withdrawal; receipts in `anvil-receipts.txt`.
- **slither** on the prototype and on the repository's sources (§4.7).
- **Chain reads,** with `cast`, on the public RPC endpoints of Arbitrum One and Arbitrum Sepolia: gas price, base fee, `ArbGasInfo.getPricesInWei`. ETH price from Coinbase's public spot endpoint. The `risc0-zkvm` 3.0.6 feature list from crates.io's index. No request named the project.
- **Not done.** No proof was made, so nothing ran through the real verifier with the new layout: the verifier sees only a digest, and the tests of the new layout use the mock. The guest and host changes of §3.2 and §3.4 were not compiled. No GPU was used. The claims of the lead's research on the sequencer were not checked; the design does not depend on them.

## Appendix A: prototype `ProofBounty.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Challenge, SettlementStatus} from "./Challenge.sol";
import {IReferee} from "./interfaces/IReferee.sol";
import {RunDerivations} from "./RunDerivations.sol";
import {Season} from "./Season.sol";
import {ZkReferee} from "./ZkReferee.sol";

/// @notice Bounties for the run proofs of `referee` (README §7.5): anyone posts ETH on a committed
/// run, and whoever presents a proof of that run that `referee` accepts is credited the run's whole
/// bounty, at the payee the proof itself names, never at the caller. A bounty is paid once per run
/// and returns to its depositors only once no proof can settle the run any more, or once nobody has
/// claimed a settled run's bounty `CLAIM_GRACE` after its season's settlement closed. Only `refund`
/// and `withdraw` send ETH, after their state changes, and only to the depositor or the payee.
contract ProofBounty {
    uint64 public constant CLAIM_GRACE = 7 days;
    uint256 private constant LEVELS_PER_RUN = 6;

    Challenge public immutable challenge;
    Season public immutable seasons;
    ZkReferee public immutable referee;

    mapping(uint256 runId => uint256) public bountyOf;
    mapping(uint256 runId => mapping(address depositor => uint256)) public depositOf;
    mapping(address payee => uint256) public owed;

    event BountyPosted(uint256 indexed runId, address indexed depositor, uint256 amount, uint256 bounty);
    event BountyPaid(uint256 indexed runId, address indexed payee, uint256 amount);
    event BountyRefunded(uint256 indexed runId, address indexed depositor, uint256 amount);
    event Withdrawn(address indexed payee, uint256 amount);

    error ZeroAddress();
    error ZeroDeposit();
    error WrongReferee(uint256 runId, IReferee seasonReferee);
    error NoBounty(uint256 runId);
    error ZeroPayee(uint256 runId);
    error NoDeposit(uint256 runId, address depositor);
    error SettlementOpen(uint256 runId, uint256 settlementEnd);
    error ClaimOpen(uint256 runId, uint256 claimEnd);
    error TransferFailed(address to, uint256 amount);

    constructor(Challenge challenge_, ZkReferee referee_) {
        if (address(challenge_) == address(0) || address(referee_) == address(0)) revert ZeroAddress();
        challenge = challenge_;
        seasons = challenge_.seasons();
        referee = referee_;
    }

    /// @notice Adds `msg.value` to the bounty of a committed, unsettled run whose season settles
    /// through `referee` and is still open for settlement: any other deposit could never be paid.
    function post(uint256 runId) external payable {
        if (msg.value == 0) revert ZeroDeposit();
        // forge-lint: disable-next-line(unused-return)
        (,, uint64 committedAt, uint256 season,,) = challenge.runs(runId);
        if (committedAt == 0) revert Challenge.NotCommitted(runId);
        // forge-lint: disable-next-line(unused-return)
        (IReferee seasonReferee,) = seasons.refereeOf(season);
        if (address(seasonReferee) != address(referee)) revert WrongReferee(runId, seasonReferee);
        if (statusOf(runId) != SettlementStatus.Unsettled) revert Challenge.AlreadySettled(runId);
        uint256 settlementEnd = seasons.settlementEndOf(season);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > settlementEnd) revert Challenge.SettlementClosed(runId, settlementEnd);

        uint256 bounty = bountyOf[runId] + msg.value;
        bountyOf[runId] = bounty;
        depositOf[runId][msg.sender] += msg.value;
        emit BountyPosted(runId, msg.sender, msg.value, bounty);
    }

    /// @notice Credits the run's bounty to the payee that `proof` names. An unsettled run is settled
    /// by this call, through `Challenge.settleRun`; for a run that someone already settled, `proof`
    /// is verified here against the run's committed journals. Anyone may submit: the caller earns
    /// nothing, so a copied proof still pays its prover.
    function claim(uint256 runId, bytes[6] calldata levels, bytes[6] calldata journals, bytes calldata proof) external {
        uint256 amount = bountyOf[runId];
        if (amount == 0) revert NoBounty(runId);
        address payee = referee.payeeOf(proof);
        if (payee == address(0)) revert ZeroPayee(runId);

        bountyOf[runId] = 0;
        owed[payee] += amount;
        emit BountyPaid(runId, payee, amount);

        if (statusOf(runId) == SettlementStatus.Unsettled) {
            challenge.settleRun(runId, levels, journals, proof);
        } else {
            verifySettledRun(runId, levels, journals, proof);
        }
    }

    /// @notice Returns `depositor` its deposit on a run that no proof can settle any more, or on a
    /// settled run whose bounty nobody claimed within `CLAIM_GRACE` of the settlement end. Anyone
    /// may call it: the deposit only ever goes back to its depositor.
    function refund(uint256 runId, address depositor) external returns (uint256 amount) {
        amount = depositOf[runId][depositor];
        if (amount == 0) revert NoDeposit(runId, depositor);
        if (bountyOf[runId] == 0) revert NoBounty(runId);
        // forge-lint: disable-next-line(unused-return)
        (,,, uint256 season,,) = challenge.runs(runId);
        uint256 settlementEnd = seasons.settlementEndOf(season);
        // forge-lint: disable-start(block-timestamp)
        if (statusOf(runId) == SettlementStatus.Unsettled) {
            if (block.timestamp <= settlementEnd) revert SettlementOpen(runId, settlementEnd);
        } else if (block.timestamp <= settlementEnd + CLAIM_GRACE) {
            revert ClaimOpen(runId, settlementEnd + CLAIM_GRACE);
        }
        // forge-lint: disable-end(block-timestamp)

        depositOf[runId][depositor] = 0;
        bountyOf[runId] -= amount;
        emit BountyRefunded(runId, depositor, amount);
        send(depositor, amount);
    }

    /// @notice Sends `payee` what its proofs earned. Anyone may call it, as `Season.withdrawRake`.
    function withdraw(address payee) external returns (uint256 amount) {
        amount = owed[payee];
        if (amount == 0) return 0;
        owed[payee] = 0;
        emit Withdrawn(payee, amount);
        send(payee, amount);
    }

    function statusOf(uint256 runId) private view returns (SettlementStatus status) {
        // forge-lint: disable-next-line(unused-return)
        (status,,,,) = challenge.settlements(runId);
    }

    /// @notice What `Challenge.settleRun` checked when the run settled still holds for its committed
    /// journals, so the commitment, the season's weights and `verifyRun` bind `proof` to the run.
    function verifySettledRun(uint256 runId, bytes[6] calldata levels, bytes[6] calldata journals, bytes calldata proof)
        private
        view
    {
        // forge-lint: disable-next-line(unused-return)
        (,,, uint256 season,, bytes32 commitment) = challenge.runs(runId);
        if (RunDerivations.runCommitment(journals) != commitment) revert Challenge.WrongCommitment(runId);
        uint16[6] memory weightsBp;
        for (uint256 i; i < LEVELS_PER_RUN; ++i) {
            // forge-lint: disable-next-line(calls-loop)
            weightsBp[i] = seasons.weightOf(season, keccak256(levels[i]));
        }
        // forge-lint: disable-next-line(unused-return)
        referee.verifyRun(levels, journals, weightsBp, proof);
    }

    function send(address to, uint256 amount) private {
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool sent,) = to.call{value: amount}("");
        if (!sent) revert TransferFailed(to, amount);
    }
}
```

## Appendix B: `ZkReferee.sol` diff

Abridged; the whole diff is `ZkReferee.diff` in the scratch folder.

```diff
 /// @notice One level of the verify program's public values: `abi.encode(uint16 weightBp, Outcome)`
 /// (referee/zk/README.md, README §7.3). A run's six are concatenated, which is how
-/// `abi.encode(ScoredOutcome[6])` lays them out.
+/// `abi.encode(ScoredOutcome[6])` lays them out. One word follows the levels: the payee the prover
+/// named, as `abi.encode(address)`.
 struct ScoredOutcome {
     uint16 weightBp;
     Outcome outcome;
 }

 /// @notice The zk backend of `IReferee` (README §7.3, D2): a RISC Zero proof that the verify program
-/// of `imageId` replayed the submitted levels and journals at their weights and committed these
-/// Outcomes. `proof` is `abi.encode(bytes seal, bytes publicValues)`, as `zk-host prove` prints
-/// them. The verifier is a fixed version, held immutably and called directly, never an upgradeable
-/// router (docs/ECONOMY.md, zk prover trust). Rejections revert: a journal that replay rejects has
-/// no proof.
+/// of `imageId` replayed the submitted levels and journals at their weights, committed these
+/// Outcomes and named the prover's payee. `proof` is `abi.encode(bytes seal, bytes publicValues)`,
+/// as `zk-host prove` prints them. The verifier is a fixed version, held immutably and called
+/// directly, never an upgradeable router (docs/ECONOMY.md, zk prover trust). Rejections revert: a
+/// journal that replay rejects has no proof.
 contract ZkReferee is IReferee {
     uint256 private constant LEVEL_PUBLIC_VALUES_LENGTH = 12 * 32;
+    uint256 private constant PAYEE_PUBLIC_VALUES_LENGTH = 32;
+    uint256 private constant LEVELS_PER_RUN = 6;
@@ verifyRun
-        bytes memory publicValues = verifiedPublicValues(proof, 6);
-        ScoredOutcome[6] memory scored = abi.decode(publicValues, (ScoredOutcome[6]));
-        for (uint256 i; i < 6; ++i) {
+        bytes memory publicValues = verifiedPublicValues(proof, LEVELS_PER_RUN);
+        (ScoredOutcome[6] memory scored,) = abi.decode(publicValues, (ScoredOutcome[6], address));
+        for (uint256 i; i < LEVELS_PER_RUN; ++i) {
             outcomes[i] = boundOutcome(i, levels[i], journals[i], weightsBp[i], scored[i]);
         }
@@ verify
         bytes memory publicValues = verifiedPublicValues(proof, 1);
-        return boundOutcome(0, level, journal, weightBp, abi.decode(publicValues, (ScoredOutcome)));
+        (ScoredOutcome memory scored,) = abi.decode(publicValues, (ScoredOutcome, address));
+        return boundOutcome(0, level, journal, weightBp, scored);
     }

-    /// @notice The public values of `levelCount` levels, once the seal proves that the program
-    /// committed them. The length also tells a run proof from a level proof.
+    /// @notice The payee that a run proof's public values name. It checks no seal: the payee is
+    /// the prover's only for a `proof` that `verifyRun` accepts.
+    function payeeOf(bytes calldata proof) external pure returns (address payee) {
+        (, bytes memory publicValues) = abi.decode(proof, (bytes, bytes));
+        checkLength(publicValues, LEVELS_PER_RUN);
+        (, payee) = abi.decode(publicValues, (ScoredOutcome[6], address));
+    }
+
+    /// @notice The public values of `levelCount` levels and their payee, once the seal proves that
+    /// the program committed them.
     function verifiedPublicValues(bytes calldata proof, uint256 levelCount) private view returns (bytes memory) {
         (bytes memory seal, bytes memory publicValues) = abi.decode(proof, (bytes, bytes));
-        uint256 expected = levelCount * LEVEL_PUBLIC_VALUES_LENGTH;
-        if (publicValues.length != expected) revert PublicValuesLengthMismatch(publicValues.length, expected);
+        checkLength(publicValues, levelCount);
         verifier.verify(seal, imageId, sha256(publicValues));
         return publicValues;
     }

+    /// @notice The length also tells a run proof from a level proof.
+    function checkLength(bytes memory publicValues, uint256 levelCount) private pure {
+        uint256 expected = levelCount * LEVEL_PUBLIC_VALUES_LENGTH + PAYEE_PUBLIC_VALUES_LENGTH;
+        if (publicValues.length != expected) revert PublicValuesLengthMismatch(publicValues.length, expected);
+    }
```
