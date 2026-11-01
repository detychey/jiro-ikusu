// A Challenge run end to end on a local chain (plan M5.2, web/README.md): src/run and src/chain,
// loaded through Vite as the page loads them, buy, reveal, play and commit a run on a fake clock
// that the wallet stamps on each transaction. jiro-tools' playtest bots choose each level's
// inputs, fed as keys through input.ts; a reload rebuilds the page's objects on the same
// in-memory IndexedDB. Account 2 plays, account 0 advances MockArbSys (0.25 s per block) and
// account 3 settles against MockReferee.
// Usage: node scripts/contracts/localnet.mjs --up, then
//        node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545
//          [--reload-at <level 1-6> | --reload-after-end out-of-lives|cleared | --stale-season]
//          [--tools <jiro-tools binary>] [--network local] [--account 2]
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { IDBFactory } from "fake-indexeddb";
import { createServer } from "vite";
import { nodeWallet, rpcClient } from "./node-wallet.mjs";

const WEB_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const WASM = join(REPO_ROOT, "target", "wasm32-unknown-unknown", "release", "jiro_wasm.wasm");
const LEVELS_DIR = join(REPO_ROOT, "levels");
/** The page's frames: shorter than a tick, so that no tick runs before its keys are down. */
const FRAME_MS = 10;
/** Arbitrum's block time (README §7.2). */
const BLOCK_MS = 250;
/** How long the page is gone in a reload. */
const RELOAD_GAP_MS = 5_000;
const OPERATOR = 0;
const SETTLER = 3;
/** The bot of each level index: a mix of the playtest policies, for a mix of end reasons. */
const POLICIES = ["greedy", "random-walk", "committer", "bold", "edge-nibbler", "greedy"];
/** For --reload-after-end: the end reason wanted, and the policies to try for it, in order. */
const ENDS = {
  "out-of-lives": { endReason: "Out of lives", policies: ["random-walk", "edge-nibbler", "bold", "greedy"] },
  cleared: { endReason: "Cleared", policies: ["greedy", "bold", "committer", "edge-nibbler"] },
};

class Reload extends Error {}

function fail(message) {
  throw new Error(`challenge-e2e: ${message}`);
}

function check(what, actual, expected) {
  if (String(actual) !== String(expected)) fail(`${what} is ${actual}, expected ${expected}`);
}

/** Each transaction's block takes the fake clock's time, when the chain is behind it. */
function stampWith(send, clock) {
  return async () => {
    const latest = await send("eth_getBlockByNumber", ["latest", false]);
    const at = Math.floor(clock.now / 1000);
    if (at > Number(latest.timestamp)) await send("evm_setNextBlockTimestamp", [at]);
  };
}

/** The six level indices' bot journals for a run nonce, played by jiro-tools. */
function botPlan(tools, checker, journalEvents, levels, runNonce, drawSlots, wantedEnd, scratch) {
  const play = (levelIndex, policy) => {
    const out = join(scratch, `${runNonce.slice(2, 10)}-${levelIndex}-${policy}.jrn`);
    const args = ["playtest", "--levels", LEVELS_DIR, "--policy", policy, "--nonce", runNonce, "--level-index", String(levelIndex), "--out", out];
    const result = spawnSync(tools, args, { encoding: "utf8" });
    if (result.status !== 0) fail(`${tools} ${args.join(" ")} failed:\n${result.stderr}`);
    const journal = new Uint8Array(readFileSync(out));
    const replayed = checker.replay(levels[drawSlots[levelIndex]], journal, 0);
    if ("code" in replayed) fail(`the ${policy} bot's journal of level ${levelIndex} is rejected with code ${replayed.code}`);
    const masks = new Map(journalEvents(journal).map(({ tick, mask }) => [tick, mask]));
    return { policy, journal, masks, outcome: replayed.outcome };
  };
  const bots = POLICIES.map((policy, levelIndex) => play(levelIndex, policy));
  if (wantedEnd === undefined) return { bots, endLevel: undefined };
  // The level that ends as wanted must have a level after it.
  for (let levelIndex = 0; levelIndex < POLICIES.length - 1; levelIndex += 1) {
    for (const policy of wantedEnd.policies) {
      const bot = play(levelIndex, policy);
      if (bot.outcome.endReason === wantedEnd.endReason) {
        bots[levelIndex] = bot;
        return { bots, endLevel: levelIndex };
      }
    }
  }
  return fail(`no bot ends any of levels 0 to 4 of run nonce ${runNonce} by ${wantedEnd.endReason}`);
}

async function e2e(load, options) {
  const { networkNamed } = await load("/src/chain/networks.ts");
  const { bundledDeployment } = await load("/src/chain/deployments.ts");
  const { connect, formatEth, onNetwork, signerOf } = await load("/src/chain/wallet.ts");
  const { acceptingSeason, connectContracts } = await load("/src/chain/contracts.ts");
  const { connectMockArbSys } = await load("/src/chain/bindings/MockArbSys.ts");
  const { connectMockReferee } = await load("/src/chain/bindings/MockReferee.ts");
  const { connectSeason } = await load("/src/chain/bindings/Season.ts");
  const { Core, END_REASONS, fromHex, hex } = await load("/src/core.ts");
  const { DEFAULT_BINDINGS, HeldKeys, controlsOf } = await load("/src/input.ts");
  const { journalEvents } = await load("/src/journal.ts");
  const { buyRun, continueRun, runDeadline, unfinishedRun } = await load("/src/run/flow.ts");
  const { X_ALONE } = await load("/src/run/play.ts");
  const { openRunStore } = await load("/src/run/store.ts");
  const { parseRunFile, replayRunFile, runFileOf } = await load("/src/run/runfile.ts");

  const network = networkNamed(options.network);
  const deployment = bundledDeployment(network);
  const send = rpcClient(options.rpc);
  const accounts = await send("eth_accounts");
  const latest = await send("eth_getBlockByNumber", ["latest", false]);
  const clock = { now: Number(latest.timestamp) * 1000 };
  const wasm = readFileSync(WASM);
  const checker = await Core.load(wasm);
  const levels = readdirSync(LEVELS_DIR)
    .filter((name) => name.endsWith(".bin"))
    .sort()
    .map((name) => new Uint8Array(readFileSync(join(LEVELS_DIR, name))));
  const levelIds = levels.map((level) => hex(checker.levelId(level)));
  const scratch = mkdtempSync(join(tmpdir(), "jiro-challenge-e2e-"));
  const factory = new IDBFactory();
  const log = (line) => console.log(`challenge-e2e: ${line}`);

  const signerOfAccount = async (index) => {
    const wallet = nodeWallet(send, accounts[index], stampWith(send, clock));
    const connection = await connect(wallet);
    if (!onNetwork(connection, network)) fail(`${options.rpc} serves chain ${connection.chainId}, not ${network.chainName}`);
    return { connection, signer: await signerOf(wallet, connection, network) };
  };
  const operator = (await signerOfAccount(OPERATOR)).signer;
  const arbSys = connectMockArbSys(deployment.addresses.ArbSys, operator);

  /** What the page builds on load: a new engine, keys, store connection, signer and contracts. */
  const state = { status: undefined, lastFrameLevel: undefined, reloaded: false, plan: undefined, record: undefined, margin: undefined };
  async function pageEnv() {
    const core = await Core.load(wasm);
    const keys = new HeldKeys(DEFAULT_BINDINGS);
    const store = await openRunStore(factory);
    const { connection, signer } = await signerOfAccount(options.account);
    const contracts = connectContracts(deployment, signer);
    const planOf = () => {
      const reveal = state.record?.reveal;
      if (reveal === undefined) fail("the page plays before the run is revealed");
      state.plan ??= botPlan(options.tools, checker, journalEvents, levels, reveal.runNonce, reveal.drawSlots, options.wantedEnd, scratch);
      return state.plan;
    };
    const env = {
      core,
      store,
      keys,
      levels,
      levelIds,
      contracts,
      provider: signer.provider,
      chainId: network.chainId,
      now: () => clock.now,
      sleep: async (ms) => {
        const { endLevel } = state.plan ?? {};
        if (endLevel !== undefined && state.lastFrameLevel === endLevel && !state.reloaded) throw new Reload();
        clock.now += ms;
        if (state.record?.reveal === undefined) {
          const block = (await arbSys.blockNumber()) + BigInt(ms / BLOCK_MS);
          await (await arbSys.setBlockNumber(block)).wait();
          log(`the operator moves MockArbSys to block ${block}`);
        }
      },
      frame: async ({ levelIndex, ticksRun }) => {
        const { bots } = planOf();
        state.lastFrameLevel = levelIndex;
        const bot = bots[levelIndex];
        if (options.reloadAt === levelIndex + 1 && !state.reloaded && ticksRun === Math.floor(bot.outcome.ticksUsed / 2)) throw new Reload();
        const mask = bot.masks.get(ticksRun);
        if (mask !== undefined) {
          keys.clear();
          for (const control of controlsOf(mask)) keys.down(DEFAULT_BINDINGS[control]);
        }
        clock.now += FRAME_MS;
      },
      stopRequested: () => false,
      view: {
        status: (text) => {
          if (text !== state.status) log((state.status = text));
        },
        levelStarted: (levelIndex, slot) => log(`level ${levelIndex + 1} of 6: slot ${slot}, played by the ${planOf().bots[levelIndex].policy} bot`),
        ticked: () => {},
        levelEnded: (levelIndex, end) => log(`level ${levelIndex + 1} ended: ${end}; ${state.margin.onTime} s left before the deadline`),
        margin: (margin) => (state.margin = margin),
      },
    };
    return { env, connection, contracts };
  }

  let { env, connection, contracts } = await pageEnv();
  const player = connection.account;
  const accepting = await acceptingSeason(contracts.season, env.provider);
  log(`season ${accepting.number}: fee ${formatEth(accepting.runFee)}, rules version ${accepting.params.rulesVersion}, commit slack ${accepting.params.commitSlack} s`);

  if (options.staleSeason) {
    await staleSeason();
    return;
  }

  state.record = await buyRun(env, accepting, player);
  log(`bought run ${state.record.runId} in season ${state.record.season}`);
  try {
    state.record = await continueRun(env, state.record);
  } catch (error) {
    if (!(error instanceof Reload)) throw error;
    await checkInterrupted();
    state.reloaded = true;
    clock.now += RELOAD_GAP_MS;
    ({ env, connection, contracts } = await pageEnv());
    const challenge = await contracts.challenge.getAddress();
    const resumed = await unfinishedRun(env.store, network.chainId, challenge, connection.account);
    if (resumed?.key !== state.record.key) fail(`after the reload the page resumes ${resumed?.key}, not run ${state.record.runId}`);
    log(`reloaded after ${RELOAD_GAP_MS / 1000} s: the page resumes run ${resumed.runId}`);
    state.record = await continueRun(env, (state.interrupted = resumed));
  }
  await checkCommitted();
  env.provider.destroy();
  operator.provider.destroy();
  rmSync(scratch, { recursive: true, force: true });

  /** What the store held when the page went away. */
  async function checkInterrupted() {
    const stored = await (await openRunStore(factory)).get(state.record.key);
    const { bots, endLevel } = state.plan;
    if (options.reloadAt !== undefined) {
      check("the level stored in play", stored.live?.levelIndex, options.reloadAt - 1);
      log(`reload in level ${options.reloadAt}: the store holds ${stored.live.ticks} of its ticks and ${stored.live.events.length} events`);
    } else {
      check("the level stored in play", stored.live?.levelIndex, endLevel);
      check(`the ticks stored of level ${endLevel + 1}, which has ended`, stored.live.ticks, bots[endLevel].outcome.ticksUsed);
      log(`reload right after level ${endLevel + 1} ended (${bots[endLevel].outcome.endReason}), before level ${endLevel + 2} is stored`);
    }
    state.stored = stored;
  }

  async function checkCommitted() {
    const record = state.record;
    if (record.commit === undefined) fail(`run ${record.runId} is not committed: ${record.forfeited ?? "unknown reason"}`);
    const runId = BigInt(record.runId);
    const journals = record.journals.map(fromHex);
    const onchain = await contracts.challenge.runs(runId);
    const commitment = hex(checker.runCommitment(journals));
    check("the commitment onchain", onchain.commitment, commitment);
    log(`commitment ${commitment}, the core's run_commitment of the stored journals`);

    const transaction = await env.provider.getTransaction(record.commit.transaction);
    const call = contracts.challenge.interface.parseTransaction(transaction);
    check("the commit's function", call.name, "commitRun");
    check("the commit's run id", call.args[0], runId);
    check("the journals in the commit's calldata", JSON.stringify([...call.args[1]]), JSON.stringify(record.journals));
    log(`the commitRun calldata carries the six stored journals (transaction ${record.commit.transaction})`);

    const { bots, endLevel } = state.plan;
    for (const [levelIndex, journal] of record.journals.entries()) {
      if (state.reloaded && options.reloadAt === levelIndex + 1) {
        const live = state.stored.live;
        const expected = [...live.events, { tick: live.ticks, mask: X_ALONE }];
        check(`level ${levelIndex + 1}'s closed journal`, JSON.stringify(journalEvents(fromHex(journal))), JSON.stringify(expected));
      } else {
        check(`level ${levelIndex + 1}'s journal, against its bot's`, journal, hex(bots[levelIndex].journal));
      }
    }
    if (options.reloadAt !== undefined) log(`level ${options.reloadAt}'s journal is its stored events and an X alone at tick ${state.stored.live.ticks}`);
    if (endLevel !== undefined) log(`level ${endLevel + 1}'s journal is kept as played, ending ${bots[endLevel].outcome.endReason}`);
    log(`${options.reloadAt === undefined ? "every" : "every other"} journal is its bot's, key for key`);

    const file = join(scratch, `run-${record.runId}.json`);
    writeFileSync(file, JSON.stringify(runFileOf(record, levels), null, 2));
    const outcomes = replayRunFile(checker, parseRunFile(readFileSync(file, "utf8")), record.weightsBp);
    for (const [i, outcome] of outcomes.entries()) {
      const direct = checker.replay(levels[record.reveal.drawSlots[i]], journals[i], record.weightsBp[record.reveal.drawSlots[i]]);
      check(`level ${i + 1}'s Outcome from the run file`, JSON.stringify(outcome), JSON.stringify(direct.outcome));
      const { endReason, claimBp, ticksUsed, levelScore, drawSlot } = outcome;
      log(`  level ${i + 1}: slot ${drawSlot}, ${endReason}, claim ${claimBp} bp, ${ticksUsed} ticks, score ${levelScore}`);
    }
    log("the run file reloads and its six journals replay to these Outcomes");

    const deadline = runDeadline(checker, record, levels);
    const committedAt = BigInt(record.commit.committedAt);
    if (committedAt > deadline) fail(`committed at ${committedAt}, after the deadline ${deadline}`);
    log(`revealed at ${record.reveal.revealedAt}, committed at ${committedAt}: ${deadline - committedAt} s before the deadline ${deadline}`);
    await settle(record, outcomes);
  }

  /** settleRun against MockReferee, set to the core's Outcomes: the contract's own deadline check. */
  async function settle(record, outcomes) {
    const referee = connectMockReferee(deployment.addresses.Referee, operator);
    const runLevels = record.reveal.drawSlots.map((slot) => hex(levels[slot]));
    for (const [i, outcome] of outcomes.entries()) {
      const weightBp = record.weightsBp[record.reveal.drawSlots[i]];
      const tuple = { ...outcome, endReason: END_REASONS.indexOf(outcome.endReason) + 1 };
      await (await referee.setOutcome(runLevels[i], record.journals[i], weightBp, tuple)).wait();
    }
    const { signer } = await signerOfAccount(SETTLER);
    const challenge = connectContracts(deployment, signer).challenge;
    const receipt = await (await challenge.settleRun(BigInt(record.runId), runLevels, record.journals, "0x")).wait();
    const events = receipt.logs.map((entry) => challenge.interface.parseLog(entry)).filter((event) => event !== null);
    const settled = events.find(({ name }) => name === "RunSettled");
    if (settled === undefined) fail(`settleRun emitted ${events.map(({ name }) => name).join(", ")}, not RunSettled: the run is late`);
    const score = outcomes.reduce((sum, { levelScore }) => sum + levelScore, 0);
    check("the settled score", settled.args.score, score);
    log(`settleRun finds run ${record.runId} on time: RunSettled, score ${settled.args.score}, ${settled.args.ticks} ticks, ${settled.args.clears} clears`);
    signer.provider.destroy();
  }

  /** The season accepting runs changes after the season check and before startRun. */
  async function staleSeason() {
    const season = connectSeason(deployment.addresses.Season, operator);
    const end = await season.endOf(accepting.number);
    clock.now = Number(end) * 1000;
    // Calls estimate on the latest block, so the season's end is mined first.
    await send("evm_setNextBlockTimestamp", [Number(end)]);
    await send("evm_mine");
    const params = await season.paramsOf(accepting.number);
    await (await season.open(params.toArray(true))).wait();
    log(`season ${accepting.number} ended at ${end}, and season ${await season.currentSeason()} opened`);
    const message = await buyRun(env, accepting, player).then(
      () => fail(`the page bought a run in season ${accepting.number} after it ended`),
      (error) => error.message,
    );
    if (!message.includes(`NotAcceptingRuns(${accepting.number})`)) fail(`buying in the ended season failed otherwise: ${message}`);
    log(`the page's startRun(${accepting.number}): ${message}`);
    const sent = await contracts.challenge.startRun(accepting.number, { value: accepting.runFee, gasLimit: 500_000n });
    const failure = await sent.wait().then(
      () => fail(`a startRun(${accepting.number}) sent anyway was accepted`),
      (error) => error,
    );
    check(`a startRun(${accepting.number}) sent anyway: its receipt status`, failure.receipt?.status, 0);
    log(`a startRun(${accepting.number}) sent anyway, with a fixed gas limit, is mined and reverts (status 0, transaction ${sent.hash})`);
    env.provider.destroy();
    operator.provider.destroy();
  }
}

const { values } = parseArgs({
  options: {
    rpc: { type: "string" },
    network: { type: "string", default: "local" },
    account: { type: "string", default: "2" },
    "reload-at": { type: "string" },
    "reload-after-end": { type: "string" },
    "stale-season": { type: "boolean", default: false },
    tools: { type: "string", default: join(process.env.CARGO_TARGET_DIR ?? join(REPO_ROOT, "target"), "debug", "jiro-tools") },
  },
});
const usage =
  "usage: node web/scripts/challenge-e2e.mjs --rpc <url> [--reload-at <level 1-6> | --reload-after-end out-of-lives|cleared | --stale-season] [--tools <jiro-tools>] [--network local] [--account <index>]";
if (values.rpc === undefined) throw new Error(usage);
const reloadAt = values["reload-at"] === undefined ? undefined : Number(values["reload-at"]);
if (reloadAt !== undefined && !(Number.isInteger(reloadAt) && reloadAt >= 1 && reloadAt <= 6)) throw new Error(usage);
const wantedEnd = values["reload-after-end"] === undefined ? undefined : ENDS[values["reload-after-end"]];
if (values["reload-after-end"] !== undefined && wantedEnd === undefined) throw new Error(usage);
if ([reloadAt, wantedEnd, values["stale-season"] || undefined].filter((option) => option !== undefined).length > 1) throw new Error(usage);

const server = await createServer({ root: WEB_ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  await e2e((path) => server.ssrLoadModule(path), {
    rpc: values.rpc,
    network: values.network,
    account: Number(values.account),
    reloadAt,
    wantedEnd,
    staleSeason: values["stale-season"],
    tools: values.tools,
  });
} finally {
  await server.close();
}
