// The end-to-end suite of Challenge runs (plan M4.16, README §7.2, §8.4), adapted from
// ethblockdigger's scripts/contracts/e2e.ts at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce.
// It deploys a fresh generation with deploy.mjs, writes its record to a temporary file checked
// against deployments/README.md's schema, opens one short season and runs six cases in it:
//   1. happy path: pay, reveal, play the six drawn levels with bots (jiro-tools playtest --nonce
//      --level-index), commit, then settleRun through one verifyRun;
//   2. settleLevel fallback: a second played run, settled by six settleLevel calls through verify;
//   3. late commit: a run whose six levels are closed unplayed (an X at tick 0, README §7.2),
//      committed after its deadline, and marked late at settlement;
//   4. copied journal: a run committed with the happy path's journals, whose settlement is rejected;
//   5. wrong rulesVersion: a run whose journals name another rules version, rejected by the referee;
//   6. season close: once end + grace has passed, closeSeason, the player's claim and withdrawRake.
// Every settled Outcome is checked against the native replay (jiro-tools replay). Rejections are
// eth_calls, so every transaction lands; the gas of each goes between `=== BEGIN e2e-gas ===` and
// `=== END e2e-gas ===`, and into the job summary ($GITHUB_STEP_SUMMARY).
//
// Networks: nitro-devnode runs the Stylus referee, deployed through cargo-stylus, with
// DEPLOYER_KEY, nitro-devnode's public development key. That node seals a block only when a
// transaction arrives, so advanceBlocks sends filler transactions to reach the entropy block.
// `local` starts anvil with MockReferee, which returns the native replay's Outcomes, and moves
// MockArbSys and the block time instead. The player and the settler are fresh accounts the
// deployer funds; the treasury is a fresh address.
// --zk, the zk mode (plan M4.10), deploys ZkReferee over RISC Zero's mock verifier on either network instead,
// pinned to the image id of the zk host's verify program. Each settlement then carries a dev-mode
// proof of `RISC0_DEV_MODE=1 zk-host prove`: of the run file (docs/VERIFICATION.md, Run file v1)
// for settleRun, and of each level, written as a game vector with its native Outcome, for
// settleLevel. In the wrong rulesVersion case the prover refuses the run: no proof of it exists.
//
// Arbitrum Sepolia (plan M4.14) deploys nothing: the cases named by --cases run on the newest
// generation of deployments/arbitrum-sepolia.json, in its season testnet-0 (season.mjs open), with
// TESTER_KEY as the player and DEPLOYER_KEY, the operator, as the settler:
//   - happy-path: a bot run committed, its run file written to seasons/testnet-0/runs/, proven for
//     real by `zk-host prove --run <run file> --season seasons/testnet-0.json` through RISC Zero's
//     Groth16 verifier, then settled; --short closes every level but the first the bots clear at
//     tick 30, as a client closes a level early, so that the proof takes about 2 h on 4 CPUs.
//     --resume <run file> proves and settles a run committed earlier; a proof already made is kept
//     as <run file>.proof.json and reused.
//   - full-commit: a run committed with six full journals (step 8), timed, never settled.
// The reveal timing, each commit's inclusion latency and margin, and ZkReferee's verification gas
// go between `=== BEGIN e2e-measurements ===` and `=== END e2e-measurements ===`.
// Usage: [DEPLOYER_KEY=0x…] node e2e.mjs --network <local|nitro-devnode> [--zk] [--rpc <url>] [--port <anvil port>]
//        DEPLOYER_KEY=0x… TESTER_KEY=0x… node e2e.mjs --network arbitrum-sepolia --cases <happy-path,full-commit>
//          [--short] [--resume <run file>] [--rpc <url>]
// jiro-tools and, in the zk mode, zk-host are built with cargo into $CARGO_TARGET_DIR (default
// target/, and referee/zk/target for zk-host).
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { AbiCoder, Contract, Wallet, concat, formatEther, getBytes, hexlify, keccak256, parseEther, toQuantity } from "ethers";
import {
  JIRO_TOOLS,
  NETWORKS,
  REPO_ROOT,
  assertPrivateKey,
  buildContracts,
  connect,
  deployContracts,
  deploymentFileOf,
  sendTransaction,
} from "./deploy.mjs";
import { isEntryPoint, prependGeneration, readDeploymentRecord } from "./deployments.mjs";
import { CALIBRATION, assertEqual, eventOf, startAnvil } from "./localnet.mjs";
import { isReady, preflight, renderRows } from "./preflight.mjs";

// The season of the suite. length covers the five startRun calls just after open, and grace the
// reveals, the play, the late commit's wait and the settlements, so the close follows within
// minutes. README §8.4 allows both from 1 s; a grace this short would strand runs bought near the
// end of a real season, which only a test season on a local node may do.
const SEASON = {
  runFee: 50_000_000_000_000n,
  rakeBp: 1_000,
  length: 30n,
  grace: 120n,
  commitSlack: 30n,
  minClears: 1,
};
const BACKEND_OF = { local: "mock", "nitro-devnode": "stylus" };
const FUNDING = parseEther("1");
// The reference mix of levels/targets.json first; a level keeps the first journal that clears.
const POLICIES = ["bold", "committer", "greedy", "edge-nibbler"];
const ZK_HOST = join(process.env.CARGO_TARGET_DIR ?? join(REPO_ROOT, "referee", "zk", "target"), "release", "zk-host");
const CALIBRATION_FILE = join(REPO_ROOT, "seasons", "calibration-1.json");
const OUTCOME_FIELDS = ["journalHash", "levelId", "runNonce", "levelIndex", "drawSlot", "mode", "rulesVersion", "endReason", "claimBp", "ticksUsed", "levelScore"];
const READ_WINDOW = 256n;
const TICKS_PER_SECOND = 15n;
const END_REASON_CLEARED = 2;
const SETTLEMENT_SETTLED = 1n;
const SETTLEMENT_LATE = 2n;
const ALL_LEVELS_SETTLED = 0x3fn;
// Journal v1 (README §6.3): the header's rulesVersion and levelId, its eventCount, and X alone.
const RULES_VERSION_OFFSET = 1;
const LEVEL_ID_OFFSET = 36;
const EVENT_COUNT_OFFSET = 69;
const MASK_X = 0x40;
// README §7.3: Arbitrum's cap of 32M L2 gas per transaction. The suite raises nitro-devnode's cap
// through ArbOwner, as the node's chain owner, so that a run whose settleRun exceeds Arbitrum's
// still settles and its gas is measured; the gas table names every transaction above 32M.
const ARBITRUM_TX_GAS_LIMIT = 32_000_000n;
const DEVNODE_TX_GAS_LIMIT = 200_000_000n;
const ARB_OWNER = "0x0000000000000000000000000000000000000070";
const ARB_OWNER_ABI = ["function setMaxTxGasLimit(uint64 limit)"];
// The live cases (plan M4.14): their season, the latest commit after a reveal (README §7.2), the
// tick at which --short closes a level, and how many runs the happy path plays for a clear.
const LIVE_CASES = ["happy-path", "full-commit"];
const LIVE_SEASON = "testnet-0";
const LIVE_SEASON_FILE = join(REPO_ROOT, "seasons", `${LIVE_SEASON}.json`);
const MAX_PLAY_SECONDS = 1_080n;
const SHORT_CLOSE_TICK = 30;
const HAPPY_PATH_RUNS = 3;
const ARB_BLOCK_POLLING_MS = 1_000;
const FULL_JOURNAL = JSON.parse(readFileSync(join(REPO_ROOT, "vectors", "game", "full-journal.json"), "utf8")).journal;
const ZK_PROOFS_FILE = join(REPO_ROOT, "contracts", "test", "fixtures", "zk-proofs.json");

export const transactions = [];
// The live cases' timings and gas estimates (plan M4.14 step 9), printed after the gas table.
export const measurements = [];

/**
 * The gas table's row of a mined transaction: its calldata size and EIP-7623 floor, its gas, the
 * part of it Arbitrum charged for L1 data (`gasUsedForL1`, which anvil does not report), its fee and hash.
 */
export async function rowOf(caseName, label, receipt) {
  const calldata = getBytes((await receipt.getTransaction()).data);
  const zeroBytes = calldata.filter((byte) => byte === 0).length;
  // EIP-7623: at least 21,000 + 10 gas per calldata token, a zero byte 1 token and any other 4.
  const calldataFloor = 21_000n + 10n * BigInt(zeroBytes + 4 * (calldata.length - zeroBytes));
  const { gasUsedForL1 } = await receipt.provider.send("eth_getTransactionReceipt", [receipt.hash]);
  const l1Gas = gasUsedForL1 === undefined ? null : BigInt(gasUsedForL1);
  return { caseName, label, calldataBytes: calldata.length, calldataFloor, gas: receipt.gasUsed, l1Gas, fee: receipt.fee, hash: receipt.hash };
}

/** sendTransaction, with the transaction's row kept for the gas table. */
async function record(caseName, label, transaction, contract) {
  const receipt = await sendTransaction(label, transaction, contract);
  transactions.push(await rowOf(caseName, label, receipt));
  return receipt;
}

/**
 * Makes `n` blocks on nitro-devnode, which seals one only when a transaction arrives: `n`
 * 0-value self-transfers, each awaited. At most the entropy source's 256-block read window, so
 * one call never moves a reveal from not yet readable to lapsed.
 */
export async function advanceBlocks(signer, n) {
  if (!Number.isInteger(n) || n < 1 || BigInt(n) > READ_WINDOW) throw new Error(`advanceBlocks: ${n} is not from 1 to ${READ_WINDOW}`);
  const to = await signer.getAddress();
  let gas = 0n;
  for (let block = 1; block <= n; block++) {
    gas += (await sendTransaction(`filler ${block}/${n}`, signer.sendTransaction({ to, value: 0n }))).gasUsed;
  }
  return gas;
}

/**
 * How the suite moves the entropy block number and the block time on each network. On Arbitrum
 * Sepolia it only waits for the chain's own blocks, polling ArbSys once a second.
 */
export function chainClockOf(network, provider, deployer, arbSys) {
  async function fill(caseName, n) {
    const gas = await advanceBlocks(deployer, n);
    transactions.push({ caseName, label: `advanceBlocks(${n}), in total`, calldataBytes: 0, calldataFloor: 21_000n * BigInt(n), gas, l1Gas: null, fee: null, hash: "" });
  }
  if (network === "arbitrum-sepolia") {
    return {
      async reachBlock(caseName, block) {
        while ((await arbSys.arbBlockNumber()) < block) await new Promise((resolve) => setTimeout(resolve, ARB_BLOCK_POLLING_MS));
      },
    };
  }
  if (network === "local") {
    return {
      reachBlock: (caseName, block) => record(caseName, "MockArbSys.setBlockNumber", arbSys.setBlockNumber(block), arbSys),
      async passTime(caseName, timestamp) {
        if ((await provider.getBlock("latest")).timestamp > timestamp) return;
        await provider.send("evm_setNextBlockTimestamp", [toQuantity(timestamp + 1n)]);
        await provider.send("evm_mine", []);
      },
    };
  }
  return {
    async reachBlock(caseName, block) {
      for (let current = await arbSys.arbBlockNumber(); current < block; current = await arbSys.arbBlockNumber()) {
        await fill(caseName, Number(block - current));
      }
    },
    async passTime(caseName, timestamp) {
      while ((await provider.getBlock("latest")).timestamp <= timestamp) {
        const wait = Number(timestamp) + 1 - Date.now() / 1000;
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait * 1000));
        await fill(caseName, 1);
      }
    },
  };
}

function jiroTools(args) {
  const result = spawnSync(JIRO_TOOLS, args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

function zkHost(args, env = process.env) {
  const result = spawnSync(ZK_HOST, args, { cwd: REPO_ROOT, encoding: "utf8", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`zk-host ${args.join(" ")} failed:\n${result.stderr}`);
  return result.stdout;
}

/** The seal and public values that `zk-host prove` prints between its zk-fixture markers. */
function fixtureOf(output) {
  const fixture = output.match(/=== BEGIN zk-fixture ===\n(.*)\n=== END zk-fixture ===/)?.[1];
  if (fixture === undefined) throw new Error(`zk-host prove printed no fixture:\n${output}`);
  return JSON.parse(fixture);
}

/** A proof as settlement takes it: abi.encode(seal, publicValues). */
export function encodeProof({ seal, publicValues }) {
  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes"], [seal, publicValues]);
}

/** The dev-mode proof of `zk-host prove <args>`. */
function devModeProof(args) {
  return encodeProof(fixtureOf(zkHost(["prove", ...args], { ...process.env, RISC0_DEV_MODE: "1" })));
}

/** Writes the run's file (docs/VERIFICATION.md, Run file v1), as the dApp exports it, into `dir`. */
function writeRunFile(context, run, dir) {
  const file = join(dir, `run-${run.runId}.json`);
  const runFile = {
    version: 1,
    chainId: NETWORKS[context.network].chainId,
    challenge: context.challengeAddress,
    runId: String(run.runId),
    runNonce: run.runNonce,
    levels: run.levels.map(({ level }) => level),
    drawSlots: run.levels.map(({ level }) => CALIBRATION.levelIds.indexOf(keccak256(level))),
    journals: run.levels.map(({ journal }) => hexlify(journal)),
  };
  writeFileSync(file, `${JSON.stringify(runFile, null, 2)}\n`);
  return file;
}

/** The run's dev-mode proof. */
function proveRun(context, run) {
  return devModeProof(["--run", writeRunFile(context, run, context.workDir), "--season", CALIBRATION_FILE]);
}

/** The proof of one level, given to the prover as a game vector (vectors/README.md) with its native Outcome. */
function proveLevel(context, { level, journal, weightBp, outcome }, name) {
  const file = join(context.workDir, `${name}.json`);
  writeFileSync(file, JSON.stringify({ kind: "game", name, level, journal, weightBp, outcome }));
  return devModeProof(["--level", file]);
}

/** README §7.3, "Rejections revert": the prover refuses a journal that replay rejects, so the run has no proof. */
function assertNoProof(run, prove, expectedCode) {
  let refusal;
  try {
    prove();
  } catch (error) {
    refusal = error.message.match(/replay rejects: code (\d+)/)?.[1];
    if (refusal === undefined) throw error;
  }
  assertEqual(`${run.caseName}: the prover's refusal code`, refusal, expectedCode);
  console.log(`[e2e] ${run.caseName}: run ${run.runId} has no proof, the prover refuses it with replay's code ${refusal}`);
}

/** The levels of levels/, by level id; every level of the calibration season must be there. */
function readLevels() {
  const levels = new Map();
  for (const name of readdirSync(join(REPO_ROOT, "levels")).filter((file) => file.endsWith(".bin"))) {
    const bytes = readFileSync(join(REPO_ROOT, "levels", name));
    levels.set(keccak256(bytes), hexlify(bytes));
  }
  const missing = CALIBRATION.levelIds.filter((levelId) => !levels.has(levelId));
  if (missing.length > 0) throw new Error(`levels/ misses the calibration levels ${missing.join(", ")}`);
  return levels;
}

/** The native replay's Outcome, or `{ error }` with the code replay rejects the journal with. */
function replay(workDir, level, journal, weightBp) {
  writeFileSync(join(workDir, "level.bin"), getBytes(level));
  writeFileSync(join(workDir, "journal.bin"), getBytes(journal));
  const result = jiroTools(["replay", "--level", join(workDir, "level.bin"), "--journal", join(workDir, "journal.bin"), "--weight", String(weightBp)]);
  if (result.status !== 0) {
    const code = result.stderr.match(/replay rejects the journal: error (\d+)/)?.[1];
    if (code === undefined) throw new Error(`jiro-tools replay failed:\n${result.stderr}`);
    return { error: Number(code) };
  }
  const outcome = Object.fromEntries(
    result.stdout
      .split("\n")
      .map((line) => line.split(" "))
      .filter(([field]) => OUTCOME_FIELDS.includes(field))
      .map(([field, value]) => [field, value.startsWith("0x") ? value : Number(value)]),
  );
  const missing = OUTCOME_FIELDS.filter((field) => !(field in outcome));
  if (missing.length > 0) throw new Error(`jiro-tools replay printed no ${missing.join(", ")}:\n${result.stdout}`);
  return outcome;
}

/** The level that run `runNonce` draws at `levelIndex`, played by `policy`, with its season weight. */
function playtest(context, runNonce, levelIndex, policy) {
  const out = join(context.workDir, "played.bin");
  const result = jiroTools(["playtest", "--levels", "levels", "--policy", policy, "--nonce", runNonce, "--level-index", String(levelIndex), "--out", out]);
  if (result.status !== 0) throw new Error(`jiro-tools playtest failed:\n${result.stderr}`);
  const journal = readFileSync(out);
  const levelId = hexlify(journal.subarray(LEVEL_ID_OFFSET, LEVEL_ID_OFFSET + 32));
  const weightBp = CALIBRATION.weightsBp[CALIBRATION.levelIds.indexOf(levelId)];
  return { level: context.levels.get(levelId), journal, weightBp };
}

function scored(context, { level, journal, weightBp }) {
  const outcome = replay(context.workDir, level, journal, weightBp);
  if (outcome.error !== undefined) throw new Error(`the native replay rejects a journal of the suite: error ${outcome.error}`);
  return { level, journal: hexlify(journal), weightBp, outcome };
}

/** The six drawn levels, each with the first policy's journal that clears it, or else the best-scoring one. */
function playRun(context, runNonce) {
  return [0, 1, 2, 3, 4, 5].map((levelIndex) => {
    let best;
    for (const policy of POLICIES) {
      const played = { ...scored(context, playtest(context, runNonce, levelIndex, policy)), policy };
      if (!best || played.outcome.levelScore > best.outcome.levelScore) best = played;
      if (played.outcome.endReason === END_REASON_CLEARED) break;
    }
    return best;
  });
}

/** The six drawn levels closed unplayed: the core's header, then one event, X alone at tick 0 (README §7.2). */
function unplayedJournals(context, runNonce) {
  return [0, 1, 2, 3, 4, 5].map((levelIndex) => {
    const played = playtest(context, runNonce, levelIndex, POLICIES[0]);
    const journal = concat([played.journal.subarray(0, EVENT_COUNT_OFFSET), "0x0001", "0x0000", hexlify(new Uint8Array([MASK_X]))]);
    return { ...played, journal: getBytes(journal) };
  });
}

function withRulesVersion({ journal, ...rest }, rulesVersion) {
  const copy = Uint8Array.from(journal);
  new DataView(copy.buffer).setUint16(RULES_VERSION_OFFSET, rulesVersion);
  return { ...rest, journal: hexlify(copy) };
}

/** The decoded custom error or Error(string) that `call` reverts with. */
async function revertOf(call, interfaces) {
  try {
    await call;
  } catch (error) {
    if (error.code !== "CALL_EXCEPTION" || !error.data) throw error;
    for (const contractInterface of interfaces) {
      const parsed = contractInterface.parseError(error.data);
      if (parsed) return `${parsed.name}(${parsed.args.join(", ")})`;
    }
    throw new Error(`unknown revert data ${error.data}`, { cause: error });
  }
  throw new Error("the call does not revert");
}

function totals(levels) {
  return {
    score: levels.reduce((sum, { outcome }) => sum + outcome.levelScore, 0),
    ticks: levels.reduce((sum, { outcome }) => sum + outcome.ticksUsed, 0),
    clears: levels.filter(({ outcome }) => outcome.endReason === END_REASON_CLEARED).length,
  };
}

async function assertRunSettled(context, caseName, run, receipt) {
  const { score, ticks, clears } = totals(run.levels);
  const event = eventOf(context.challenge, receipt, "RunSettled");
  assertEqual(`${caseName}: RunSettled's player`, event.player, context.player.address);
  assertEqual(`${caseName}: RunSettled's score`, event.score, score);
  assertEqual(`${caseName}: RunSettled's ticks`, event.ticks, ticks);
  assertEqual(`${caseName}: RunSettled's clears`, event.clears, clears);
  const settlement = await context.challenge.settlements(run.runId);
  assertEqual(`${caseName}: the settlement status`, settlement.status, SETTLEMENT_SETTLED);
  assertEqual(`${caseName}: the settled levels`, settlement.settledLevels, ALL_LEVELS_SETTLED);
  console.log(`[e2e] ${caseName}: run ${run.runId} settled, score ${score}, ticks ${ticks}, clears ${clears}, as the native replay`);
}

async function setMockOutcomes(context, runs) {
  for (const run of runs) {
    for (const [levelIndex, { level, journal, weightBp, outcome }] of run.levels.entries()) {
      await record("setup", `MockReferee.setOutcome ${run.caseName} ${levelIndex}`, context.referee.setOutcome(level, journal, weightBp, outcome), context.referee);
    }
  }
}

async function runCases(context) {
  const { challenge, season, number, clock, player, settler, entropy } = context;
  const asPlayer = challenge.connect(player);
  const asSettler = challenge.connect(settler);
  const elapsed = async () => `${(await context.provider.getBlock("latest")).timestamp - Number(context.seasonStart)} s into the season`;
  const runs = Object.fromEntries(
    ["happy path", "settleLevel fallback", "late commit", "copied journal", "wrong rulesVersion"].map((caseName) => [caseName, { caseName }]),
  );
  const happy = runs["happy path"];
  const fallback = runs["settleLevel fallback"];
  const late = runs["late commit"];
  const copied = runs["copied journal"];
  const wrongRules = runs["wrong rulesVersion"];

  for (const run of Object.values(runs)) {
    const started = await record(run.caseName, "Challenge.startRun", asPlayer.startRun(number, { value: SEASON.runFee }), challenge);
    ({ runId: run.runId, entropyId: run.entropyId } = eventOf(challenge, started, "RunStarted"));
  }
  const targets = await Promise.all(Object.values(runs).map((run) => entropy.targetBlock(context.challengeAddress, run.entropyId)));
  const highest = targets.reduce((top, target) => (target > top ? target : top));
  await clock.reachBlock("setup", highest + 1n);
  for (const run of Object.values(runs)) {
    assertEqual(`${run.caseName}: revealable`, await entropy.isRevealable(context.challengeAddress, run.entropyId), true);
    const revealed = await record(run.caseName, "Challenge.revealRun", asPlayer.revealRun(run.runId), challenge);
    ({ runNonce: run.runNonce, revealedAt: run.revealedAt } = eventOf(challenge, revealed, "RunRevealed"));
  }
  console.log(`[e2e] five runs revealed, ${await elapsed()}`);

  happy.levels = playRun(context, happy.runNonce);
  fallback.levels = playRun(context, fallback.runNonce);
  late.levels = unplayedJournals(context, late.runNonce).map((level) => scored(context, level));
  copied.levels = happy.levels;
  wrongRules.levels = unplayedJournals(context, wrongRules.runNonce).map((level) => withRulesVersion(level, CALIBRATION.rulesVersion + 1));
  for (const run of Object.values(runs)) {
    const summary = run.levels.map(({ policy, outcome }) => (outcome ? `${policy ?? "unplayed"} ${outcome.endReason}/${outcome.ticksUsed}` : "unscored")).join(", ");
    console.log(`[e2e] ${run.caseName}: run ${run.runId}, levels as policy endReason/ticksUsed: ${summary}`);
  }
  if (totals(happy.levels).clears + totals(fallback.levels).clears === 0) {
    throw new Error("the bots cleared no level of the two played runs, so the season would roll over: run the suite again");
  }

  for (const run of [happy, fallback, copied, wrongRules]) {
    await record(run.caseName, "Challenge.commitRun", asPlayer.commitRun(run.runId, run.levels.map(({ journal }) => journal)), challenge);
  }
  const lateDeadline = late.revealedAt + (BigInt(totals(late.levels).ticks) + TICKS_PER_SECOND - 1n) / TICKS_PER_SECOND + SEASON.commitSlack;
  await clock.passTime("late commit", lateDeadline);
  await record(late.caseName, "Challenge.commitRun", asPlayer.commitRun(late.runId, late.levels.map(({ journal }) => journal)), challenge);
  console.log(`[e2e] five runs committed, ${await elapsed()}`);

  if (context.backend === "mock") await setMockOutcomes(context, [happy, fallback, late]);
  if (context.backend === "zk") {
    for (const run of [happy, late]) run.proof = proveRun(context, run);
    copied.proof = happy.proof;
    fallback.levelProofs = fallback.levels.map((level, levelIndex) => proveLevel(context, level, `run-${fallback.runId}-level-${levelIndex}`));
    console.log(`[e2e] dev-mode proofs made, ${await elapsed()}`);
  }
  const settleArgs = (run) => [run.runId, run.levels.map(({ level }) => level), run.levels.map(({ journal }) => journal), run.proof ?? "0x"];

  await assertRunSettled(context, happy.caseName, happy, await record(happy.caseName, "Challenge.settleRun", asSettler.settleRun(...settleArgs(happy)), challenge));
  assertEqual("the player's best run after the happy path", (await season.bestRunOf(number, player.address)).runId, happy.runId);

  const journalHashes = fallback.levels.map(({ journal }) => keccak256(journal));
  let lastLevel;
  for (const [levelIndex, { level, journal }] of fallback.levels.entries()) {
    lastLevel = await record(
      fallback.caseName,
      `Challenge.settleLevel ${levelIndex}`,
      asSettler.settleLevel(fallback.runId, levelIndex, journalHashes, level, journal, fallback.levelProofs?.[levelIndex] ?? "0x"),
      challenge,
    );
  }
  await assertRunSettled(context, fallback.caseName, fallback, lastLevel);

  const lateSettled = await record(late.caseName, "Challenge.settleRun", asSettler.settleRun(...settleArgs(late)), challenge);
  const lateEvent = eventOf(challenge, lateSettled, "RunLate");
  assertEqual("late commit: RunLate's deadline", lateEvent.deadline, lateDeadline);
  assertEqual("late commit: the settlement status", (await challenge.settlements(late.runId)).status, SETTLEMENT_LATE);
  console.log(`[e2e] late commit: run ${late.runId}, committed at ${lateEvent.committedAt} after its deadline ${lateDeadline}, is late`);

  const copiedRevert = await revertOf(asSettler.settleRun.staticCall(...settleArgs(copied)), [challenge.interface]);
  assertEqual("copied journal: settleRun's revert", copiedRevert, `OutcomeRunNonceMismatch(0, ${happy.runNonce})`);
  console.log(`[e2e] copied journal: run ${copied.runId}'s settleRun reverts with ${copiedRevert}`);

  const [firstWrong] = wrongRules.levels;
  assertEqual("wrong rulesVersion: the native replay's error", replay(context.workDir, firstWrong.level, firstWrong.journal, firstWrong.weightBp).error, 4);
  if (context.backend === "zk") {
    assertNoProof(wrongRules, () => proveRun(context, wrongRules), 4);
  } else {
    const wrongRevert = await revertOf(asSettler.settleRun.staticCall(...settleArgs(wrongRules)), [challenge.interface, context.referee.interface]);
    const expectedWrong =
      context.backend === "stylus"
        ? "Error(level 0: replay error 4)"
        : `NoOutcome(${keccak256(firstWrong.level)}, ${keccak256(firstWrong.journal)}, ${firstWrong.weightBp})`;
    assertEqual("wrong rulesVersion: settleRun's revert", wrongRevert, expectedWrong);
    console.log(`[e2e] wrong rulesVersion: run ${wrongRules.runId}'s settleRun reverts with ${wrongRevert}`);
  }
  console.log(`[e2e] settlements done, ${await elapsed()}`);

  await clock.passTime("season close", await season.settlementEndOf(number));
  const closed = eventOf(season, await record("season close", "Season.closeSeason", season.connect(settler).closeSeason(), season), "SeasonClosed");
  const fees = SEASON.runFee * BigInt(Object.keys(runs).length);
  const rake = (fees * BigInt(SEASON.rakeBp)) / 10_000n;
  assertEqual("season close: the rake", closed.rake, rake);
  assertEqual("season close: the players' pot", closed.playersPot, fees - rake);
  assertEqual("season close: rolled over", closed.rolledOver, false);
  const claimed = eventOf(season, await record("season close", "Season.claim", season.connect(player).claim(number), season), "Claimed");
  // The player holds the only qualified best run, so its share is the whole pot.
  assertEqual("season close: the claim", claimed.amount, fees - rake);
  await record("season close", "Season.withdrawRake", season.connect(settler).withdrawRake(), season);
  assertEqual("season close: the treasury's balance", await context.provider.getBalance(context.treasury), rake);
  assertEqual("season close: Season's balance", await context.provider.getBalance(context.seasonAddress), 0n);
  assertEqual("season close: Season.isSolvent()", await season.isSolvent(), true);
  console.log(`[e2e] season close: fees ${formatEther(fees)} ETH, claim ${formatEther(claimed.amount)} ETH, rake ${formatEther(rake)} ETH withdrawn`);
}

export function gasTable() {
  const lines = ["| Case | Transaction | Calldata bytes | EIP-7623 floor | Gas | Of which L1 | Fee (ETH) | Hash |", "|---|---|---:|---:|---:|---:|---:|---|"];
  for (const { caseName, label, calldataBytes, calldataFloor, gas, l1Gas, fee, hash } of transactions) {
    const cells = [calldataBytes, calldataFloor, gas].map((number) => number.toLocaleString("en-US"));
    cells.push(l1Gas === null ? "" : l1Gas.toLocaleString("en-US"), fee === null ? "" : formatEther(fee), hash);
    lines.push(`| ${caseName} | ${label} | ${cells.join(" | ")} |`);
  }
  const above = transactions.filter(({ gas }) => gas > ARBITRUM_TX_GAS_LIMIT).map(({ caseName, label }) => `${caseName} ${label}`);
  lines.push("", `Above Arbitrum's ${ARBITRUM_TX_GAS_LIMIT.toLocaleString("en-US")} gas per transaction: ${above.length === 0 ? "none" : above.join(", ")}.`);
  return lines.join("\n");
}

async function runSuite(network, rpc, zk) {
  const backend = zk ? "zk" : BACKEND_OF[network];
  const provider = await connect(network, rpc);
  const deployerKey = process.env.DEPLOYER_KEY;
  // No child needs it from the environment: the Stylus build runs third-party build scripts.
  delete process.env.DEPLOYER_KEY;
  if (network !== "local") assertPrivateKey("DEPLOYER_KEY", deployerKey, network);
  const deployer = network === "local" ? await provider.getSigner(0) : new Wallet(deployerKey, provider);
  const player = Wallet.createRandom(provider);
  const settler = Wallet.createRandom(provider);
  const treasury = Wallet.createRandom().address;
  for (const [role, address] of [["player", player.address], ["settler", settler.address]]) {
    await record("setup", `fund the ${role}`, deployer.sendTransaction({ to: address, value: FUNDING }));
  }
  const rows = await preflight({ provider, deployer: await deployer.getAddress(), tester: player.address, backend });
  console.log(renderRows(rows));
  if (!isReady(rows)) throw new Error("the preflight fails");
  if (network === "nitro-devnode") {
    const arbOwner = new Contract(ARB_OWNER, ARB_OWNER_ABI, deployer);
    await record("setup", `ArbOwner.setMaxTxGasLimit(${DEVNODE_TX_GAS_LIMIT})`, arbOwner.setMaxTxGasLimit(DEVNODE_TX_GAS_LIMIT), arbOwner);
  }

  const artifacts = buildContracts();
  const recordDir = mkdtempSync(join(tmpdir(), "jiro-e2e-"));
  try {
    const recordFile = join(recordDir, `${network}.json`);
    prependGeneration(
      recordFile,
      network,
      NETWORKS[network].chainId,
      await deployContracts({
        artifacts,
        provider,
        rpc,
        network,
        deployer,
        deployerKey,
        backend,
        treasury,
        rulesVersion: CALIBRATION.rulesVersion,
        imageId: zk ? zkHost(["image-id"]).trim() : undefined,
      }),
    );
    const [generation] = readDeploymentRecord(recordFile).generations;
    console.log("[e2e] the deployment record matches the schema");

    const season = new Contract(generation.Season, artifacts.Season.abi, deployer);
    const opened = await record(
      "setup",
      "Season.open",
      season.open({
        referee: generation.Referee,
        rulesVersion: CALIBRATION.rulesVersion,
        levelIds: CALIBRATION.levelIds,
        weightsBp: CALIBRATION.weightsBp,
        ...SEASON,
      }),
      season,
    );
    const { season: number, start } = eventOf(season, opened, "SeasonOpened");
    const arbSys = new Contract(generation.ArbSys, artifacts.MockArbSys.abi, deployer);
    const context = {
      network,
      backend,
      provider,
      player,
      settler,
      treasury,
      number,
      season,
      seasonAddress: generation.Season,
      seasonStart: start,
      challengeAddress: generation.Challenge,
      challenge: new Contract(generation.Challenge, artifacts.Challenge.abi, provider),
      entropy: new Contract(generation.ArbBlockhashEntropy, artifacts.ArbBlockhashEntropy.abi, provider),
      referee: new Contract(generation.Referee, (zk ? artifacts.ZkReferee : artifacts.MockReferee).abi, deployer),
      clock: chainClockOf(network, provider, deployer, arbSys),
      levels: readLevels(),
      workDir: recordDir,
    };
    await runCases(context);
    const finalRows = await preflight({ provider, deployer: await deployer.getAddress(), tester: player.address, backend, seasonAddress: generation.Season });
    console.log(renderRows(finalRows));
    if (!isReady(finalRows)) throw new Error("the preflight fails after the suite");
  } finally {
    rmSync(recordDir, { recursive: true, force: true });
    provider.destroy();
  }
  printResults(network, backend);
}

/** The gas table and the measurements between their log markers, and in the job summary. */
export function printResults(network, backend) {
  const table = gasTable();
  console.log(`=== BEGIN e2e-gas ===\n${table}\n=== END e2e-gas ===`);
  if (measurements.length > 0) console.log(`=== BEGIN e2e-measurements ===\n${measurements.join("\n")}\n=== END e2e-measurements ===`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## End-to-end gas (${network}, ${backend} referee)\n\n${table}\n`);
  console.log(`[e2e] ${network}: every case passes`);
}

/** The newest generation of `recordFile` and its season `seasonLabel`, as the live cases use them. */
export async function liveContext({ network, provider, player, settler, artifacts, recordFile, seasonLabel, runsDir, clockOf = chainClockOf }) {
  const [generation] = readDeploymentRecord(recordFile).generations;
  const number = generation.seasons[seasonLabel];
  if (number === undefined) throw new Error(`${recordFile}'s newest generation has no season ${seasonLabel}: open it with season.mjs open`);
  if (generation.backend !== "zk") throw new Error(`the live cases settle with zk proofs, and the newest generation's backend is ${generation.backend}`);
  const season = new Contract(generation.Season, artifacts.Season.abi, provider);
  const { runFee, commitSlack } = await season.paramsOf(number);
  return {
    network,
    backend: generation.backend,
    provider,
    player,
    settler,
    number,
    runFee,
    commitSlack,
    season,
    seasonAddress: generation.Season,
    challengeAddress: generation.Challenge,
    challenge: new Contract(generation.Challenge, artifacts.Challenge.abi, provider),
    entropy: new Contract(generation.ArbBlockhashEntropy, artifacts.ArbBlockhashEntropy.abi, provider),
    referee: new Contract(generation.Referee, artifacts.ZkReferee.abi, provider),
    clock: clockOf(network, provider, settler, new Contract(generation.ArbSys, artifacts.MockArbSys.abi, settler)),
    levels: readLevels(),
    workDir: mkdtempSync(join(tmpdir(), "jiro-e2e-live-")),
    runsDir,
  };
}

/** Pays and reveals a run as the player, once its entropy block is readable. */
async function startAndReveal(context, caseName) {
  const { challenge, entropy, provider } = context;
  const asPlayer = challenge.connect(context.player);
  const started = await record(caseName, "Challenge.startRun", asPlayer.startRun(context.number, { value: context.runFee }), challenge);
  const { runId, entropyId } = eventOf(challenge, started, "RunStarted");
  await context.clock.reachBlock(caseName, (await entropy.targetBlock(context.challengeAddress, entropyId)) + 1n);
  const revealed = await record(caseName, "Challenge.revealRun", asPlayer.revealRun(runId), challenge);
  const { runNonce, revealedAt } = eventOf(challenge, revealed, "RunRevealed");
  const startedAt = BigInt((await provider.getBlock(started.blockNumber)).timestamp);
  measurements.push(`${caseName}: run ${runId} revealed at ${revealedAt}, ${revealedAt - startedAt} s after its startRun block`);
  return { caseName, runId, runNonce, revealedAt };
}

/** commitRun, timed from its submission to its block's timestamp, which has a resolution of 1 s; returns committedAt. */
async function timedCommit(context, run) {
  const journals = run.levels.map(({ journal }) => journal);
  const submittedAt = Date.now() / 1000;
  const receipt = await record(run.caseName, "Challenge.commitRun", context.challenge.connect(context.player).commitRun(run.runId, journals), context.challenge);
  const receivedAt = Date.now() / 1000;
  const { committedAt } = eventOf(context.challenge, receipt, "RunCommitted");
  const inclusion = (Number(committedAt) - submittedAt).toFixed(1);
  measurements.push(
    `${run.caseName}: run ${run.runId}'s commitRun (${getBytes(concat(journals)).length} journal bytes) is in a block of timestamp ${committedAt}, ` +
      `${inclusion} s after its submission; its receipt arrived ${(receivedAt - submittedAt).toFixed(1)} s after it`,
  );
  return committedAt;
}

/**
 * Closes a played level at `tick`, as a client closes a level early (README §7.2): its events
 * before `tick`, then X alone at `tick`. A level that ends before `tick` stays whole.
 */
function closedAt(context, played, tick) {
  if (played.outcome.ticksUsed <= tick) return played;
  const journal = getBytes(played.journal);
  const view = new DataView(journal.buffer, journal.byteOffset);
  const events = [];
  for (let index = 0; index < view.getUint16(EVENT_COUNT_OFFSET); index++) {
    const at = EVENT_COUNT_OFFSET + 2 + 3 * index;
    if (view.getUint16(at) < tick) events.push(journal.subarray(at, at + 3));
  }
  const closing = new Uint8Array([tick >> 8, tick & 0xff, MASK_X]);
  const count = new Uint8Array([(events.length + 1) >> 8, (events.length + 1) & 0xff]);
  const closed = getBytes(concat([journal.subarray(0, EVENT_COUNT_OFFSET), count, ...events, closing]));
  return { ...scored(context, { level: played.level, journal: closed, weightBp: played.weightBp }), policy: `${played.policy}, closed at ${tick}` };
}

/** The bots' run, or with `short`, the first level they clear kept whole and the others closed at SHORT_CLOSE_TICK. */
export function botRun(context, runNonce, short) {
  const levels = playRun(context, runNonce);
  if (!short) return levels;
  const kept = levels.findIndex(({ outcome }) => outcome.endReason === END_REASON_CLEARED);
  return levels.map((level, index) => (index === kept ? level : closedAt(context, level, SHORT_CLOSE_TICK)));
}

/** The real Groth16 proof of a run file, kept next to it as <run file>.proof.json so that a later session reuses it. */
export function realProof(runFile) {
  const proofFile = runFile.replace(/\.json$/, ".proof.json");
  if (!existsSync(proofFile)) {
    if (process.env.RISC0_DEV_MODE) throw new Error("RISC0_DEV_MODE is set: a dev-mode seal never verifies through RISC Zero's Groth16 verifier");
    console.log(`[e2e] proving ${runFile} with zk-host, about 2 h on 4 CPUs for a --short run (docs/DEPLOYMENT.md)`);
    const proved = spawnSync(ZK_HOST, ["prove", "--run", runFile, "--season", LIVE_SEASON_FILE], { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
    if (proved.error) throw proved.error;
    if (proved.status !== 0) throw new Error(`zk-host prove --run ${runFile} exited ${proved.status ?? proved.signal}`);
    process.stdout.write(proved.stdout);
    writeFileSync(proofFile, `${JSON.stringify(fixtureOf(proved.stdout), null, 2)}\n`);
  }
  return encodeProof(JSON.parse(readFileSync(proofFile, "utf8")));
}

/** A run file's six levels, at their season weights, scored by the native replay. */
export function levelsOfRunFile(context, file) {
  return file.levels.map((level, index) => scored(context, { level, journal: file.journals[index], weightBp: CALIBRATION.weightsBp[file.drawSlots[index]] }));
}

/** The run of a run file committed earlier. */
function committedRunOf(context, runFile) {
  const file = JSON.parse(readFileSync(runFile, "utf8"));
  assertEqual(`${runFile}'s Challenge`, file.challenge, context.challengeAddress);
  return { caseName: "happy path", runId: BigInt(file.runId), runNonce: file.runNonce, levels: levelsOfRunFile(context, file), file: runFile };
}

/** ZkReferee's verification gas, from eth_estimateGas: the run's proof, and M4.8's level proof of a game vector. */
async function measureVerifyGas(context, run, proof) {
  const runGas = await context.referee.verifyRun.estimateGas(
    run.levels.map(({ level }) => level),
    run.levels.map(({ journal }) => journal),
    run.levels.map(({ weightBp }) => weightBp),
    proof,
  );
  const { level: levelProof } = JSON.parse(readFileSync(ZK_PROOFS_FILE, "utf8"));
  const vector = JSON.parse(readFileSync(join(REPO_ROOT, levelProof.vectors[0]), "utf8"));
  const levelGas = await context.referee.verify.estimateGas(vector.level, vector.journal, vector.weightBp, encodeProof(levelProof));
  measurements.push(
    `ZkReferee.verifyRun of run ${run.runId}'s proof: ${runGas.toLocaleString("en-US")} gas (eth_estimateGas, with the transaction's 21,000 and calldata)`,
    `ZkReferee.verify of M4.8's level proof of ${levelProof.vectors[0]}: ${levelGas.toLocaleString("en-US")} gas (eth_estimateGas, with the transaction's 21,000 and calldata)`,
  );
}

/**
 * Case happy-path: a bot run of the player, committed, its run file written to `runsDir`, then
 * proven and settled by the settler, the operator. `play` gives a revealed run's six scored levels,
 * and `prove` the proof of a run file. A run that clears no level is followed by another, up to
 * HAPPY_PATH_RUNS, so that M5.5 can rehearse a claim. `resume`, a run file, settles that
 * committed run instead.
 */
export async function liveHappyPath(context, { play, prove, resume }) {
  let run;
  if (resume) {
    run = committedRunOf(context, resume);
    const commitment = keccak256(concat(run.levels.map(({ journal }) => keccak256(journal))));
    assertEqual(`run ${run.runId}'s commitment`, (await context.challenge.runs(run.runId)).commitment, commitment);
  } else {
    for (let attempt = 1; !run || totals(run.levels).clears === 0; attempt++) {
      if (attempt > HAPPY_PATH_RUNS) throw new Error(`the bots cleared no level in ${HAPPY_PATH_RUNS} runs`);
      if (run) console.log(`[e2e] happy path: run ${run.runId} clears no level, so M5.5 could not rehearse a claim: playing another`);
      run = await startAndReveal(context, "happy path");
      run.levels = play(context, run.runNonce);
      const committedAt = await timedCommit(context, run);
      const deadline = run.revealedAt + (BigInt(totals(run.levels).ticks) + TICKS_PER_SECOND - 1n) / TICKS_PER_SECOND + context.commitSlack;
      measurements.push(`happy path: run ${run.runId}'s margin at commit is ${deadline - committedAt} s, its deadline ${deadline} minus committedAt ${committedAt}`);
      run.file = writeRunFile(context, run, context.runsDir);
      console.log(`[e2e] happy path: run ${run.runId} committed, its run file ${run.file}`);
    }
  }
  const proof = prove(run.file);
  const settled = await record(
    run.caseName,
    "Challenge.settleRun",
    context.challenge.connect(context.settler).settleRun(run.runId, run.levels.map(({ level }) => level), run.levels.map(({ journal }) => journal), proof),
    context.challenge,
  );
  await assertRunSettled(context, run.caseName, run, settled);
  await measureVerifyGas(context, run, proof);
  return run;
}

/**
 * Case full-commit (plan M4.14 step 8): a run committed with six copies of the 8,171-byte journal
 * of vectors/game/full-journal, the largest commit. commitRun never parses the journals, so the run
 * need not settle, and never does: its margin is to the latest commit, revealedAt + 1,080 + commitSlack.
 */
export async function liveFullCommit(context) {
  const run = await startAndReveal(context, "full commit");
  run.levels = Array.from({ length: 6 }, () => ({ journal: FULL_JOURNAL }));
  const committedAt = await timedCommit(context, run);
  const latestCommit = run.revealedAt + MAX_PLAY_SECONDS + context.commitSlack;
  measurements.push(`full commit: run ${run.runId}'s margin at commit is ${latestCommit - committedAt} s to its latest commit ${latestCommit}`);
  return run;
}

/** The live cases on the newest generation of deployments/<network>.json, in season testnet-0. */
async function runLive(network, rpc, cases, { short, resume }) {
  const provider = await connect(network, rpc);
  const keys = { DEPLOYER_KEY: process.env.DEPLOYER_KEY, TESTER_KEY: process.env.TESTER_KEY };
  // No child needs them: jiro-tools and zk-host run from here.
  delete process.env.DEPLOYER_KEY;
  delete process.env.TESTER_KEY;
  for (const [name, key] of Object.entries(keys)) assertPrivateKey(name, key, network);
  const settler = new Wallet(keys.DEPLOYER_KEY, provider);
  const player = new Wallet(keys.TESTER_KEY, provider);
  const context = await liveContext({
    network,
    provider,
    player,
    settler,
    artifacts: buildContracts(),
    recordFile: deploymentFileOf(network),
    seasonLabel: LIVE_SEASON,
    runsDir: join(REPO_ROOT, "seasons", LIVE_SEASON, "runs"),
  });
  try {
    const rows = await preflight({ provider, deployer: settler.address, tester: player.address, backend: context.backend, seasonAddress: context.seasonAddress });
    console.log(renderRows(rows));
    if (!isReady(rows)) throw new Error("the preflight fails");
    if (cases.includes("happy-path")) {
      assertEqual("zk-host image-id, the verify program ZkReferee pins", zkHost(["image-id"]).trim(), await context.referee.imageId());
      mkdirSync(context.runsDir, { recursive: true });
      await liveHappyPath(context, { play: (_, runNonce) => botRun(context, runNonce, short), prove: realProof, resume });
    }
    if (cases.includes("full-commit")) await liveFullCommit(context);
    assertEqual("Season.isSolvent()", await context.season.isSolvent(), true);
  } finally {
    rmSync(context.workDir, { recursive: true, force: true });
    provider.destroy();
  }
  printResults(network, context.backend);
}

async function main() {
  const { values } = parseArgs({
    options: {
      network: { type: "string" },
      zk: { type: "boolean", default: false },
      rpc: { type: "string" },
      port: { type: "string", default: "8545" },
      cases: { type: "string" },
      short: { type: "boolean", default: false },
      resume: { type: "string" },
    },
  });
  const live = values.network === "arbitrum-sepolia";
  const cases = values.cases?.split(",") ?? [];
  if (live ? cases.length === 0 || cases.some((name) => !LIVE_CASES.includes(name)) : !BACKEND_OF[values.network] || values.cases) {
    throw new Error(
      "usage: node e2e.mjs --network <local|nitro-devnode> [--zk] [--rpc <url>] [--port <anvil port>]\n" +
        "       DEPLOYER_KEY=0x… TESTER_KEY=0x… node e2e.mjs --network arbitrum-sepolia --cases <happy-path,full-commit> [--short] [--resume <run file>] [--rpc <url>]",
    );
  }
  const build = (args) => execFileSync("cargo", ["build", "--release", "--locked", ...args], { cwd: REPO_ROOT, stdio: ["ignore", "inherit", "inherit"] });
  build(["-p", "jiro-tools"]);
  if (values.zk || cases.includes("happy-path")) build(["--manifest-path", join(REPO_ROOT, "referee", "zk", "Cargo.toml"), "-p", "zk-host"]);
  if (live) return runLive(values.network, values.rpc ?? NETWORKS[values.network].rpc, cases, values);
  if (values.network !== "local") return runSuite(values.network, values.rpc ?? NETWORKS[values.network].rpc, values.zk);
  const { anvil, rpc } = await startAnvil(values.port, false);
  try {
    await runSuite("local", rpc, values.zk);
  } finally {
    anvil.kill();
  }
}

if (isEntryPoint(import.meta.url)) await main();
