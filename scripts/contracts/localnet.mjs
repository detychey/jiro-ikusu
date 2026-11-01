// The local chain for the dApp work (plan M4.11, M5): anvil, with the full set of deploy.mjs on the
// mock backend, MockReferee returning the rules version of seasons/calibration-1.json, and a season
// opened with that file's 16 level ids and weights. Anvil has no ArbSys precompile, so MockArbSys
// stands in for it, and MockArbSys.setBlockNumber advances the reveal.
//   --up     leaves anvil running in the background and writes deployments/local.json.
//   --check  runs a Challenge run's happy path on a fresh anvil, then stops it: start, reveal,
//            commit with six gate-set vectors' journals, settleRun against MockReferee, with each
//            result checked against the vectors. It writes its record to a temporary file and
//            checks it against the schema of deployments/README.md.
// Usage: node localnet.mjs --up|--check [--port <port>]
import { spawn } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Contract, concat, getBytes, hexlify, keccak256, solidityPacked } from "ethers";
import { REPO_ROOT, buildContracts, connect, deployContracts, deploymentFileOf, sendTransaction } from "./deploy.mjs";
import { prependGeneration, readDeploymentRecord } from "./deployments.mjs";

const NETWORK = "local";
const CHAIN_ID = 31337;
const SEASON_LABEL = "local";
const CALIBRATION = JSON.parse(readFileSync(join(REPO_ROOT, "seasons", "calibration-1.json"), "utf8"));
// README §8.4's proposals and D12's fee; the rake is the contract tests' RAKE_BP.
const LOCAL_SEASON = {
  runFee: 50_000_000_000_000n,
  rakeBp: 1_000,
  length: 14n * 24n * 3600n,
  grace: 48n * 3600n,
  commitSlack: 120n,
  minClears: 1,
};
// The run of contracts/test/Settlement.t.sol: levels that end Cleared, out of lives and at the time limit.
const RUN_VECTORS = ["05-synthetic", "13-worst", "10-synthetic", "08-worst", "01-synthetic", "16-worst"];
const MODE_CHALLENGE = 1;
const END_REASON_CLEARED = 2;
const SETTLEMENT_SETTLED = 1n;
const ALL_LEVELS_SETTLED = 0x3fn;
const JOURNAL_MODE_OFFSET = 3;
const JOURNAL_RUN_NONCE_OFFSET = 4;
const JOURNAL_LEVEL_INDEX_OFFSET = 68;
const ANVIL_READY_ATTEMPTS = 100;
const ANVIL_READY_INTERVAL_MS = 100;

function assertEqual(what, actual, expected) {
  if (String(actual) !== String(expected)) throw new Error(`localnet --check: ${what} is ${actual}, expected ${expected}`);
}

async function rpcAnswers(rpc) {
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Starts anvil on `port`; detached, it outlives this process. Throws, with anvil's log, if it does not answer. */
async function startAnvil(port, detached) {
  const rpc = `http://127.0.0.1:${port}`;
  if (await rpcAnswers(rpc)) throw new Error(`a node already answers on ${rpc}: stop it, or pass another --port`);
  const logFile = join(tmpdir(), `jiro-localnet-anvil-${port}.log`);
  const log = openSync(logFile, "w");
  const anvil = spawn("anvil", ["--port", String(port), "--chain-id", String(CHAIN_ID)], { detached, stdio: ["ignore", log, log] });
  closeSync(log);
  let exited = false;
  anvil.on("exit", () => (exited = true));
  for (let attempt = 0; attempt < ANVIL_READY_ATTEMPTS && !exited; attempt++) {
    if (await rpcAnswers(rpc)) {
      if (detached) anvil.unref();
      return { anvil, rpc, logFile };
    }
    await new Promise((resolve) => setTimeout(resolve, ANVIL_READY_INTERVAL_MS));
  }
  anvil.kill();
  throw new Error(`anvil did not answer on ${rpc}; its log, ${logFile}:\n${readFileSync(logFile, "utf8")}`);
}

/** Opens the local season and returns the number `open` assigned, from its SeasonOpened event. */
async function openLocalSeason(season, referee) {
  const receipt = await sendTransaction(
    "Season.open",
    season.open({
      referee,
      rulesVersion: CALIBRATION.rulesVersion,
      levelIds: CALIBRATION.levelIds,
      weightsBp: CALIBRATION.weightsBp,
      ...LOCAL_SEASON,
    }),
    season,
  );
  return Number(eventOf(season, receipt, "SeasonOpened").season);
}

/** Deploys the full set, opens the local season and returns the generation that records both. */
async function deployLocalnet(artifacts, provider, rpc) {
  const deployer = await provider.getSigner(0);
  const treasury = await (await provider.getSigner(1)).getAddress();
  const generation = await deployContracts({
    artifacts,
    provider,
    rpc,
    network: NETWORK,
    deployer,
    backend: "mock",
    treasury,
    rulesVersion: CALIBRATION.rulesVersion,
  });
  const season = new Contract(generation.Season, artifacts.Season.abi, deployer);
  generation.seasons[SEASON_LABEL] = await openLocalSeason(season, generation.Referee);
  return generation;
}

function readVector(name) {
  const vector = JSON.parse(readFileSync(join(REPO_ROOT, "vectors", "levels", `${name}.json`), "utf8"));
  assertEqual(`${name}'s rules version`, vector.rulesVersion, CALIBRATION.rulesVersion);
  const slot = CALIBRATION.levelIds.indexOf(vector.outcome.levelId);
  if (slot < 0) throw new Error(`localnet --check: ${name}'s level is not in seasons/calibration-1.json`);
  assertEqual(`${name}'s weight`, vector.weightBp, CALIBRATION.weightsBp[slot]);
  const journal = getBytes(vector.journal);
  assertEqual(`${name}'s journal mode`, journal[JOURNAL_MODE_OFFSET], vector.mode);
  assertEqual(`${name}'s journal run nonce`, hexlify(journal.slice(JOURNAL_RUN_NONCE_OFFSET, JOURNAL_RUN_NONCE_OFFSET + 32)), vector.runNonce);
  assertEqual(`${name}'s journal level index`, journal[JOURNAL_LEVEL_INDEX_OFFSET], vector.levelIndex);
  return { vector, slot, journal };
}

/**
 * A gate-set vector played at `levelIndex` of the run, as contracts/test/Settlement.t.sol plays it:
 * the training journal's header takes the run's mode, nonce and level index, its events are
 * unchanged, and the vector's Outcome is bound to the run.
 */
function playedLevelOf(name, runNonce, levelIndex) {
  const { vector, slot, journal } = readVector(name);
  journal[JOURNAL_MODE_OFFSET] = MODE_CHALLENGE;
  journal.set(getBytes(runNonce), JOURNAL_RUN_NONCE_OFFSET);
  journal[JOURNAL_LEVEL_INDEX_OFFSET] = levelIndex;
  return {
    level: vector.level,
    journal: hexlify(journal),
    weightBp: vector.weightBp,
    outcome: { ...vector.outcome, journalHash: keccak256(journal), runNonce, levelIndex, drawSlot: slot, mode: MODE_CHALLENGE },
  };
}

function eventOf(contract, receipt, name) {
  const event = receipt.logs.map((log) => contract.interface.parseLog(log)).find((parsed) => parsed?.name === name);
  if (!event) throw new Error(`localnet: transaction ${receipt.hash} emitted no ${name}`);
  return event.args;
}

async function checkHappyPath(artifacts, provider, generation) {
  const [deployer, player, settler] = await Promise.all([0, 2, 3].map((index) => provider.getSigner(index)));
  const playerAddress = await player.getAddress();
  const number = generation.seasons[SEASON_LABEL];
  const season = new Contract(generation.Season, artifacts.Season.abi, provider);
  const entropy = new Contract(generation.ArbBlockhashEntropy, artifacts.ArbBlockhashEntropy.abi, provider);
  const arbSys = new Contract(generation.ArbSys, artifacts.MockArbSys.abi, deployer);
  const referee = new Contract(generation.Referee, artifacts.MockReferee.abi, deployer);
  const challenge = new Contract(generation.Challenge, artifacts.Challenge.abi, player);

  const started = await sendTransaction("Challenge.startRun", challenge.startRun(number, { value: LOCAL_SEASON.runFee }), challenge);
  const { runId, entropyId } = eventOf(challenge, started, "RunStarted");
  assertEqual("the run's entropy id", entropyId, await challenge.entropyIdOf(runId));
  assertEqual("revealable before the entropy block", await entropy.isRevealable(generation.Challenge, entropyId), false);
  const target = await entropy.targetBlock(generation.Challenge, entropyId);
  await sendTransaction("MockArbSys.setBlockNumber", arbSys.setBlockNumber(target + 1n), arbSys);
  assertEqual("revealable after the entropy block", await entropy.isRevealable(generation.Challenge, entropyId), true);

  const revealed = await sendTransaction("Challenge.revealRun", challenge.revealRun(runId), challenge);
  const { runNonce } = eventOf(challenge, revealed, "RunRevealed");
  const entropyValue = keccak256(
    solidityPacked(["bytes32", "address", "bytes32"], [keccak256(solidityPacked(["uint256"], [target])), generation.Challenge, entropyId]),
  );
  assertEqual("the run nonce", runNonce, keccak256(solidityPacked(["string", "bytes32", "uint256"], ["jiro.run", entropyValue, runId])));

  const played = RUN_VECTORS.map((name, levelIndex) => playedLevelOf(name, runNonce, levelIndex));
  for (const [levelIndex, { level, journal, weightBp, outcome }] of played.entries()) {
    await sendTransaction(`MockReferee.setOutcome ${levelIndex}`, referee.setOutcome(level, journal, weightBp, outcome), referee);
  }
  const journals = played.map(({ journal }) => journal);
  await sendTransaction("Challenge.commitRun", challenge.commitRun(runId, journals), challenge);
  assertEqual("the run commitment", (await challenge.runs(runId)).commitment, keccak256(concat(journals.map((journal) => keccak256(journal)))));

  const levels = played.map(({ level }) => level);
  const settled = await sendTransaction("Challenge.settleRun", challenge.connect(settler).settleRun(runId, levels, journals, "0x"), challenge);
  const score = played.reduce((sum, { outcome }) => sum + outcome.levelScore, 0);
  const ticks = played.reduce((sum, { outcome }) => sum + outcome.ticksUsed, 0);
  const clears = played.filter(({ outcome }) => outcome.endReason === END_REASON_CLEARED).length;
  const event = eventOf(challenge, settled, "RunSettled");
  assertEqual("RunSettled's player", event.player, playerAddress);
  assertEqual("RunSettled's score", event.score, score);
  assertEqual("RunSettled's ticks", event.ticks, ticks);
  assertEqual("RunSettled's clears", event.clears, clears);
  const settlement = await challenge.settlements(runId);
  assertEqual("the settlement status", settlement.status, SETTLEMENT_SETTLED);
  assertEqual("the settled levels", settlement.settledLevels, ALL_LEVELS_SETTLED);
  const best = await season.bestRunOf(number, playerAddress);
  assertEqual("the player's best run", best.runId, runId);
  assertEqual("the best run's score", best.score, score);
  assertEqual("the best run's ticks", best.ticks, ticks);
  assertEqual("the best run's qualification", best.qualified, clears >= LOCAL_SEASON.minClears);
  assertEqual("the season's fees", (await season.seasons(number)).fees, LOCAL_SEASON.runFee);
  assertEqual("Season.isSolvent()", await season.isSolvent(), true);
  console.log(`localnet --check: run ${runId} settled, score ${score}, ticks ${ticks}, clears ${clears}: every result matches the vectors`);
}

async function up(port) {
  const file = deploymentFileOf(NETWORK);
  // A fresh anvil is a new chain: the previous record's addresses belong to one that no longer exists.
  rmSync(file, { force: true });
  const artifacts = buildContracts();
  const { anvil, rpc, logFile } = await startAnvil(port, true);
  try {
    const provider = await connect(NETWORK, rpc);
    prependGeneration(file, NETWORK, CHAIN_ID, await deployLocalnet(artifacts, provider, rpc));
    provider.destroy();
  } catch (error) {
    anvil.kill();
    throw error;
  }
  console.log(`anvil ${anvil.pid} serves ${rpc} (log ${logFile}); record ${file}. Stop it with: kill ${anvil.pid}`);
}

async function check(port) {
  const artifacts = buildContracts();
  const { anvil, rpc } = await startAnvil(port, false);
  const recordDir = mkdtempSync(join(tmpdir(), "jiro-localnet-"));
  try {
    const provider = await connect(NETWORK, rpc);
    const file = join(recordDir, `${NETWORK}.json`);
    prependGeneration(file, NETWORK, CHAIN_ID, await deployLocalnet(artifacts, provider, rpc));
    const [generation] = readDeploymentRecord(file).generations;
    console.log("localnet --check: the deployment record matches the schema");
    await checkHappyPath(artifacts, provider, generation);
    provider.destroy();
  } finally {
    anvil.kill();
    rmSync(recordDir, { recursive: true, force: true });
  }
}

const { values } = parseArgs({ options: { up: { type: "boolean" }, check: { type: "boolean" }, port: { type: "string", default: "8545" } } });
if (values.up === values.check) throw new Error("usage: node localnet.mjs --up|--check [--port <port>]");
await (values.up ? up(values.port) : check(values.port));
