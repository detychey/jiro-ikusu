// A Challenge run end to end on a local chain (plan M5.2, web/README.md): src/run and src/chain,
// loaded through Vite as the page loads them, buy, reveal, play and commit a run on a fake clock
// that the wallet stamps on each transaction. jiro-tools' playtest bots choose each level's
// inputs, fed as keys through input.ts; a reload rebuilds the page's objects on the same
// in-memory IndexedDB, and a reload while startRun confirms leaves the page's wallet unanswered. Account 2 plays, account 0 advances MockArbSys (0.25 s per block) and
// account 3 settles against MockReferee. With --players n, accounts 2 to n + 1 each play a run.
// With --settle (plan M5.3), the players' best runs settle through src/pages/settle.ts instead:
// each player settles their own on the mock backend; on the zk backend, the operator settles the
// season from chain data with web/scripts/settle.mjs (plan M5.5). Then the runs replay from their commit
// calldata, a run committed through MockForwarder (account 8's stand-in for a smart account)
// replays from its embedded call and its trace, the leaderboard is checked against Season, and
// account 9 closes the season once its settlement has ended, which leaves no season accepting runs.
// Usage: node scripts/contracts/localnet.mjs --up [--backend zk], then
//        node web/scripts/challenge-e2e.mjs --rpc http://127.0.0.1:8545
//          [--reload-at <level 1-6> | --reload-after-end out-of-lives|cleared | --reload-during-buy | --stale-season]
//          [--players <n>] [--settle] [--backend mock|zk] [--tools <jiro-tools binary>] [--network local] [--account 2]
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ContractFactory, JsonRpcProvider } from "ethers";
import { IDBFactory } from "fake-indexeddb";
import { createServer } from "vite";
import { buildContracts } from "../../scripts/contracts/deploy.mjs";
import { nodeWallet, rpcClient } from "./node-wallet.mjs";
import { settleBestRuns } from "./settle.mjs";

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
const FORWARDER_OWNER = 8;
const CLOSER = 9;
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
  const { acceptingSeason, claim, closeSeason, connectContracts } = await load("/src/chain/contracts.ts");
  const { connectMockArbSys } = await load("/src/chain/bindings/MockArbSys.ts");
  const { connectMockReferee } = await load("/src/chain/bindings/MockReferee.ts");
  const { connectSeason } = await load("/src/chain/bindings/Season.ts");
  const { Core, END_REASONS, fromHex, hex } = await load("/src/core.ts");
  const { DEFAULT_BINDINGS, HeldKeys, controlsOf } = await load("/src/input.ts");
  const { journalEvents } = await load("/src/journal.ts");
  const { buyRun, continueRun, runDeadline, unfinishedRuns } = await load("/src/run/flow.ts");
  const { X_ALONE } = await load("/src/run/play.ts");
  const { openRunStore, runKey } = await load("/src/run/store.ts");
  const { parseRunFile, replayRunFile, runFileOf } = await load("/src/run/runfile.ts");
  const { committedRun, tracedCommitRunCalls } = await load("/src/chain/calldata.ts");
  const { eventLogs } = await load("/src/chain/logs.ts");
  const { connectMockForwarder } = await load("/src/chain/bindings/MockForwarder.ts");
  const { bestRun, operatorHandoff, settleOnchain, settlementCutoff, settlesInBrowser } = await load("/src/pages/settle.ts");
  const { readSeason } = await load("/src/pages/season.ts");

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

  /** Resolves with the startRun transaction of --reload-during-buy, once the node has mined it. */
  let boughtUnseen;
  const sentUnseen = new Promise((resolve) => (boughtUnseen = resolve));
  const signerOfAccount = async (index, goneAfterSend = false) => {
    const node = nodeWallet(send, accounts[index], stampWith(send, clock));
    // The page is gone once the wallet sent the transaction: it never sees the hash.
    const gone = async (request) => {
      const result = await node.request(request);
      if (request.method !== "eth_sendTransaction") return result;
      boughtUnseen(result);
      return new Promise(() => {});
    };
    const wallet = goneAfterSend ? { request: gone } : node;
    const connection = await connect(wallet);
    if (!onNetwork(connection, network)) fail(`${options.rpc} serves chain ${connection.chainId}, not ${network.chainName}`);
    return { connection, signer: await signerOf(wallet, connection, network) };
  };
  const operator = (await signerOfAccount(OPERATOR)).signer;
  const arbSys = connectMockArbSys(deployment.addresses.ArbSys, operator);
  const referee = connectMockReferee(deployment.addresses.Referee, operator);
  if (deployment.backend !== options.backend) {
    fail(`deployments/${network.name}.json names the ${deployment.backend} backend, not ${options.backend}: start the chain with localnet.mjs --up --backend ${options.backend}`);
  }

  /** What the page builds on load: a new engine, keys, store connection, signer and contracts. */
  let state;
  async function pageEnv() {
    const core = await Core.load(wasm);
    const keys = new HeldKeys(DEFAULT_BINDINGS);
    const store = await openRunStore(factory);
    const { connection, signer } = await signerOfAccount(state.account, options.reloadDuringBuy && !state.reloaded);
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
      input: keys,
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

  let env, connection, contracts;
  const runs = [];
  for (let player = 0; player < options.players; player += 1) {
    const run = await playRun(options.account + player);
    if (run === undefined) break;
    runs.push(run);
  }
  if (options.settle) await settleSeason(runs);
  for (const run of runs) run.env.provider.destroy();
  operator.provider.destroy();
  rmSync(scratch, { recursive: true, force: true });

  /** Account `account` buys, plays and commits a run, as the page does; returns it, with the core's
   *  Outcomes of its journals, or undefined after --stale-season, which buys none. */
  async function playRun(account) {
    state = { account, status: undefined, lastFrameLevel: undefined, reloaded: false, plan: undefined, record: undefined, margin: undefined };
    ({ env, connection, contracts } = await pageEnv());
    const player = connection.account;
    const accepting = await acceptingSeason(contracts.season, env.provider);
    log(`account ${account}, ${player}: season ${accepting.number}, fee ${formatEth(accepting.runFee)}, rules version ${accepting.params.rulesVersion}, commit slack ${accepting.params.commitSlack} s`);

    if (options.staleSeason) {
      await staleSeason(accepting, player);
      return undefined;
    }

    if (options.reloadDuringBuy) {
      const hash = await Promise.race([buyRun(env, accepting, player).then(() => fail("the page saw startRun's receipt")), sentUnseen]);
      const runId = await contracts.challenge.runCount();
      const key = runKey(network.chainId, await contracts.challenge.getAddress(), runId);
      check(`the stored run ${runId}`, await (await openRunStore(factory)).get(key), undefined);
      log(`reload while startRun ${hash} confirms: the node mined run ${runId}, and the store holds nothing of it`);
      state.record = await reload(key);
      state.record = await continueRun(env, state.record);
    } else {
      state.record = await buyRun(env, accepting, player);
      log(`bought run ${state.record.runId} in season ${state.record.season}`);
      try {
        state.record = await continueRun(env, state.record);
      } catch (error) {
        if (!(error instanceof Reload)) throw error;
        await checkInterrupted();
        state.record = await continueRun(env, (state.interrupted = await reload(state.record.key)));
      }
    }
    const outcomes = await checkCommitted();
    return { player, record: state.record, outcomes, env, contracts, plan: state.plan };
  }

  /** Rebuilds the page's objects, which must find run `key` alone unfinished. */
  async function reload(key) {
    state.reloaded = true;
    clock.now += RELOAD_GAP_MS;
    ({ env, connection, contracts } = await pageEnv());
    const resumed = await unfinishedRuns(env, connection.account);
    check("the runs the page resumes after the reload", resumed.map((record) => record.key), key);
    log(`reloaded after ${RELOAD_GAP_MS / 1000} s: the page resumes run ${resumed[0].runId}`);
    return resumed[0];
  }

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
    if (!options.settle) await settle(record, outcomes);
    return outcomes;
  }

  /** Sets MockReferee to return the core's Outcomes for the run's levels and journals, as the
   *  referee's replay would. */
  async function setRefereeOutcomes(record, outcomes) {
    const runLevels = record.reveal.drawSlots.map((slot) => hex(levels[slot]));
    for (const [i, outcome] of outcomes.entries()) {
      const weightBp = record.weightsBp[record.reveal.drawSlots[i]];
      const tuple = { ...outcome, endReason: END_REASONS.indexOf(outcome.endReason) + 1 };
      await (await referee.setOutcome(runLevels[i], record.journals[i], weightBp, tuple)).wait();
    }
    return runLevels;
  }

  /** settleRun against MockReferee, set to the core's Outcomes: the contract's own deadline check. */
  async function settle(record, outcomes) {
    const runLevels = await setRefereeOutcomes(record, outcomes);
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

  /** The players' best runs settle through settle.ts, replay from their commit calldata to the
   *  referee's Outcomes, the leaderboard matches Season, and the season closes and pays out. */
  async function settleSeason(played) {
    const reader = new JsonRpcProvider(options.rpc, network.chainId, { staticNetwork: true, cacheTimeout: -1 });
    const readContracts = connectContracts(deployment, reader);
    const { season, challenge } = readContracts;
    const number = BigInt(played[0].record.season);
    const minClears = Number((await season.paramsOf(number)).minClears);
    const challengeAddress = await challenge.getAddress();
    const bests = [];
    for (const run of played) {
      const best = bestRun(checker, levels, await run.env.store.runsOf(network.chainId, challengeAddress, run.player), number, minClears);
      if (best === undefined) fail(`settle.ts finds no best run of ${run.player}`);
      check(`${run.player}'s best run`, best.record.runId, run.record.runId);
      await setRefereeOutcomes(best.record, run.outcomes);
      bests.push(best);
    }
    const firstBlock = await reader.getBlockNumber();
    if (!settlesInBrowser(deployment)) await operatorSettles(played, bests, number, season);
    for (const [index, run] of played.entries()) {
      const best = bests[index];
      if (settlesInBrowser(deployment)) {
        // The second player's settleRun is refused for gas, so that it settles level by level.
        const gasCap = index === 1 ? 1n : undefined;
        log(`${run.player} settles run ${best.record.runId} through settle.ts${gasCap === undefined ? "" : ", with a gas cap of 1 for settleRun"}:`);
        await settleOnchain(run.contracts, best.file, (text) => log(`  ${text}`), gasCap);
      }
      const settlement = await challenge.settlements(BigInt(best.record.runId));
      check(`run ${best.record.runId}'s settlement status`, settlement.status, 1n);
      check(`run ${best.record.runId}'s settled score`, settlement.score, best.score);
      const [settled] = await eventLogs(reader, challenge, "RunSettled", [BigInt(best.record.runId)], firstBlock, await reader.getBlockNumber());
      await checkReplayFromCalldata(readContracts, reader, best, settled.log.blockNumber);
    }
    await forwarderRun(readContracts, reader, number);

    const open = await readSeason(readContracts, reader, number);
    check("the leaderboard's players", open.rows.length, played.length);
    for (const run of played) {
      const best = await season.bestRunOf(number, run.player);
      const row = open.rows.find(({ player }) => player.toLowerCase() === run.player.toLowerCase());
      if (row === undefined) fail(`the leaderboard has no row of ${run.player}`);
      check(`${run.player}'s row`, JSON.stringify([row.runId, row.score, row.ticks, row.qualified].map(String)), JSON.stringify([best.runId, best.score, best.ticks, best.qualified].map(String)));
      log(`leaderboard ${row.rank}. ${row.player}: run ${row.runId}, score ${row.score}, ${row.ticks} ticks, qualified ${row.qualified}, ${row.runs} run(s): Season.bestRunOf's`);
    }

    const closeAt = Number(open.settlementEnd) + 1;
    clock.now = closeAt * 1000;
    // Calls estimate on the latest block, so the end of the settlement is mined first.
    await send("evm_setNextBlockTimestamp", [closeAt]);
    await send("evm_mine");
    const closer = await signerOfAccount(CLOSER);
    const closed = await closeSeason(connectContracts(deployment, closer.signer));
    closer.signer.provider.destroy();
    log(`account ${CLOSER} closes season ${closed.season}: rake ${formatEth(closed.rake)}, players' pot ${formatEth(closed.playersPot)}`);
    const shown = await readSeason(readContracts, reader, number);
    for (const run of played) {
      const row = shown.rows.find(({ player }) => player.toLowerCase() === run.player.toLowerCase());
      const contractClaim = await run.contracts.season.claim.staticCall(number);
      check(`${run.player}'s claim shown`, row.claim, contractClaim);
      const paid = await claim(run.contracts, number);
      check(`${run.player}'s claim paid`, paid, row.claim);
      log(`${run.player} claims ${formatEth(paid)}, the claim the page shows`);
    }
    check("Season.isSolvent()", await season.isSolvent(), true);
    reader.destroy();
  }

  /** On zk, settle.ts shows each player the cutoff and exports the run file, and the operator
   *  settles the season from chain data with web/scripts/settle.mjs: each run it rebuilds is the
   *  run file the dApp wrote at commit, and it settles exactly the players' best runs. */
  async function operatorSettles(played, bests, number, season) {
    for (const [index, run] of played.entries()) {
      const cutoff = await settlementCutoff(run.contracts, number);
      check("the cutoff settle.ts shows", cutoff, await season.settlementEndOf(number));
      const handoff = operatorHandoff(network.chainName, cutoff);
      if (!handoff.includes(`block time ${cutoff}`)) fail(`settle.ts does not show the cutoff ${cutoff}: ${handoff}`);
      log(`settle.ts, on the zk backend: ${handoff}`);
      const file = parseRunFile(JSON.stringify(bests[index].file, null, 2));
      const reloaded = replayRunFile(checker, file, run.record.weightsBp);
      check("the exported run file's Outcomes", JSON.stringify(reloaded), JSON.stringify(run.outcomes));
    }
    const label = Object.keys(deployment.seasons).find((name) => BigInt(deployment.seasons[name]) === number);
    log(`the operator settles ${label} from chain data (web/scripts/settle.mjs):`);
    const { runs, failed } = await settleBestRuns(load, { network: options.network, season: label, rpc: options.rpc, signer: operator, log: (line) => log(`  ${line}`) });
    if (failed.length > 0) fail(`the operator did not settle ${failed.map(({ runId, error }) => `run ${runId} (${error.message})`).join(", ")}`);
    const ids = (list) => list.map(String).sort().join(", ");
    check("the runs the operator settles", ids(runs.map(({ runId }) => runId)), ids(bests.map(({ record }) => record.runId)));
    for (const best of bests) {
      const rebuilt = runs.find(({ runId }) => String(runId) === best.record.runId);
      check(`run ${best.record.runId}'s file, rebuilt from chain data`, JSON.stringify(rebuilt.file), JSON.stringify(best.file));
    }
    log("each run file the operator rebuilt from chain data is the one the dApp wrote at commit");
  }

  /** A run committed from its commit calldata replays to the Outcomes the referee returned when
   *  it settled, at the settlement's block. */
  async function checkReplayFromCalldata(readContracts, reader, best, block) {
    const loaded = await committedRun(readContracts, reader, checker, levels, BigInt(best.record.runId));
    check(`run ${best.record.runId}'s journals' source`, loaded.source, "its commitRun call");
    const replayed = replayRunFile(checker, loaded.file, loaded.weightsBp);
    const weights = loaded.file.drawSlots.map((slot) => loaded.weightsBp[slot]);
    const returned = await referee.verifyRun(loaded.file.levels, loaded.file.journals, weights, "0x", { blockTag: block });
    const asCore = returned.map((outcome) => ({
      ...outcome.toObject(),
      levelIndex: Number(outcome.levelIndex),
      drawSlot: Number(outcome.drawSlot),
      mode: Number(outcome.mode),
      rulesVersion: Number(outcome.rulesVersion),
      endReason: END_REASONS[Number(outcome.endReason) - 1],
      claimBp: Number(outcome.claimBp),
      ticksUsed: Number(outcome.ticksUsed),
      levelScore: Number(outcome.levelScore),
    }));
    check(`run ${best.record.runId} replayed from its commit calldata`, JSON.stringify(replayed), JSON.stringify(asCore));
    log(`run ${best.record.runId}, replayed from its commit transaction ${loaded.transaction}, gives the Outcomes the referee returned at its settlement, block ${block}`);
  }

  /** A run that MockForwarder buys, reveals and commits for account FORWARDER_OWNER, as a smart
   *  account would: its journals load from the call embedded in the commit transaction, and from
   *  the transaction's trace, and replay to the Outcomes of the journals it committed. */
  async function forwarderRun(readContracts, reader, number) {
    const { signer } = await signerOfAccount(FORWARDER_OWNER);
    const artifact = buildContracts().MockForwarder;
    const deployed = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(await signer.getAddress());
    await deployed.waitForDeployment();
    const forwarder = connectMockForwarder(await deployed.getAddress(), signer);
    const { challenge, season } = readContracts;
    const target = await challenge.getAddress();
    const execute = async (data, value = 0n) => (await (await forwarder.execute(target, value, data, { value })).wait()).hash;
    const runFee = (await season.paramsOf(number)).runFee;
    const runId = (await challenge.runCount()) + 1n;
    await execute(challenge.interface.encodeFunctionData("startRun", [number]), runFee);
    check(`run ${runId}'s player`, (await challenge.runs(runId)).player, await forwarder.getAddress());
    const entropyTarget = await readContracts.entropy.targetBlock(target, await challenge.entropyIdOf(runId));
    await (await arbSys.setBlockNumber(entropyTarget + 1n)).wait();
    await execute(challenge.interface.encodeFunctionData("revealRun", [runId]));
    const { runNonce } = await challenge.runs(runId);
    const drawSlots = checker.draw(fromHex(runNonce));
    const { bots } = botPlan(options.tools, checker, journalEvents, levels, runNonce, drawSlots, undefined, scratch);
    const journals = bots.map(({ journal }) => hex(journal));
    const commit = await execute(challenge.interface.encodeFunctionData("commitRun", [runId, journals]));
    log(`MockForwarder ${await forwarder.getAddress()} buys, reveals and commits run ${runId} for account ${FORWARDER_OWNER}, in transaction ${commit}`);

    const loaded = await committedRun(readContracts, reader, checker, levels, runId);
    check(`run ${runId}'s journals' source`, loaded.source, "a commitRun call embedded in it");
    check(`run ${runId}'s loaded journals`, JSON.stringify(loaded.file.journals), JSON.stringify(journals));
    const trace = await reader.send("debug_traceTransaction", [commit, { tracer: "callTracer" }]);
    const traced = tracedCommitRunCalls(readContracts, target, trace, runId);
    check(`run ${runId}'s journals in the commit's trace`, JSON.stringify(traced), JSON.stringify([journals]));
    const replayed = replayRunFile(checker, loaded.file, loaded.weightsBp);
    const committed = journals.map((journal, i) => checker.replay(levels[drawSlots[i]], fromHex(journal), loaded.weightsBp[drawSlots[i]]).outcome);
    check(`run ${runId} replayed from the forwarder's commit`, JSON.stringify(replayed), JSON.stringify(committed));
    for (const [i, { endReason, claimBp, ticksUsed, levelScore }] of replayed.entries()) {
      log(`  level ${i + 1}: slot ${drawSlots[i]}, ${endReason}, claim ${claimBp} bp, ${ticksUsed} ticks, score ${levelScore}`);
    }
    log(`run ${runId} loads from the commitRun call embedded in MockForwarder's call, and from the trace, and replays to the Outcomes of the journals it committed`);
    signer.provider.destroy();
  }

  /** The season accepting runs changes after the season check and before startRun. */
  async function staleSeason(accepting, player) {
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
    if (!message.startsWith(`season ${accepting.number + 1n} accepts runs now`)) fail(`buying in the ended season failed otherwise: ${message}`);
    log(`the page refuses to buy in season ${accepting.number}, which it showed: ${message}`);
    const sent = await contracts.challenge.startRun(accepting.number, { value: accepting.runFee, gasLimit: 500_000n });
    const failure = await sent.wait().then(
      () => fail(`a startRun(${accepting.number}) sent anyway was accepted`),
      (error) => error,
    );
    check(`a startRun(${accepting.number}) sent anyway: its receipt status`, failure.receipt?.status, 0);
    log(`a startRun(${accepting.number}) sent anyway, with a fixed gas limit, is mined and reverts (status 0, transaction ${sent.hash})`);
    env.provider.destroy();
  }
}

const { values } = parseArgs({
  options: {
    rpc: { type: "string" },
    network: { type: "string", default: "local" },
    account: { type: "string", default: "2" },
    "reload-at": { type: "string" },
    "reload-after-end": { type: "string" },
    "reload-during-buy": { type: "boolean", default: false },
    "stale-season": { type: "boolean", default: false },
    players: { type: "string", default: "1" },
    settle: { type: "boolean", default: false },
    backend: { type: "string", default: "mock" },
    tools: { type: "string", default: join(process.env.CARGO_TARGET_DIR ?? join(REPO_ROOT, "target"), "debug", "jiro-tools") },
  },
});
const usage =
  "usage: node web/scripts/challenge-e2e.mjs --rpc <url> [--reload-at <level 1-6> | --reload-after-end out-of-lives|cleared | --reload-during-buy | --stale-season] [--players <n>] [--settle] [--backend mock|zk] [--tools <jiro-tools>] [--network local] [--account <index>]";
if (values.rpc === undefined) throw new Error(usage);
const reloadAt = values["reload-at"] === undefined ? undefined : Number(values["reload-at"]);
if (reloadAt !== undefined && !(Number.isInteger(reloadAt) && reloadAt >= 1 && reloadAt <= 6)) throw new Error(usage);
const wantedEnd = values["reload-after-end"] === undefined ? undefined : ENDS[values["reload-after-end"]];
if (values["reload-after-end"] !== undefined && wantedEnd === undefined) throw new Error(usage);
if ([reloadAt, wantedEnd, values["reload-during-buy"] || undefined, values["stale-season"] || undefined].filter((option) => option !== undefined).length > 1) throw new Error(usage);
const players = Number(values.players);
// One player's run each, before FORWARDER_OWNER's account.
if (!(Number.isInteger(players) && players >= 1 && Number(values.account) + players <= FORWARDER_OWNER)) throw new Error(usage);
if (players > 1 && (values["reload-during-buy"] || values["stale-season"])) throw new Error(usage);
if (values.settle && values["stale-season"]) throw new Error(usage);
if (!["mock", "zk"].includes(values.backend)) throw new Error(usage);

const server = await createServer({ root: WEB_ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  await e2e((path) => server.ssrLoadModule(path), {
    rpc: values.rpc,
    network: values.network,
    account: Number(values.account),
    reloadAt,
    wantedEnd,
    reloadDuringBuy: values["reload-during-buy"],
    staleSeason: values["stale-season"],
    players,
    settle: values.settle,
    backend: values.backend,
    tools: values.tools,
  });
} finally {
  await server.close();
}
