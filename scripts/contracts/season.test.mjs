import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import { Contract } from "ethers";
import { NETWORKS, REPO_ROOT, buildContracts, connect } from "./deploy.mjs";
import { prependGeneration, readDeploymentRecord } from "./deployments.mjs";
import { checkHappyPath, deployLocalnet, startAnvil } from "./localnet.mjs";
import {
  checkLevels,
  claimShare,
  closeSeasons,
  countRuns,
  playBotRuns,
  printStatus,
  readSeasonFile,
  readStatus,
  renderStatus,
  seasonParamsOf,
  withdrawRakes,
} from "./season.mjs";

const TESTNET_0 = join(REPO_ROOT, "seasons", "testnet-0.json");
const testnet0 = () => JSON.parse(readFileSync(TESTNET_0, "utf8"));

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "season-test-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function seasonFileWith(changes) {
  const file = join(dir, "testnet-0.json");
  writeFileSync(file, JSON.stringify({ ...testnet0(), ...changes }));
  return file;
}

test("seasons/testnet-0.json holds plan M4.14's provisional season, its referee the deployed ZkReferee", () => {
  const { network, referee, runFee, length, grace, commitSlack, minClears } = readSeasonFile(TESTNET_0);
  const deployedReferee = JSON.parse(readFileSync(join(REPO_ROOT, "deployments", "arbitrum-sepolia.json"), "utf8")).generations[0].Referee;
  assert.deepEqual(
    { network, referee, runFee, length, grace, commitSlack, minClears },
    { network: "arbitrum-sepolia", referee: deployedReferee, runFee: "50000000000000", length: 86_400, grace: 86_400, commitSlack: 120, minClears: 1 },
  );
});

test("seasons/testnet-1.json holds plan M5.5's season of testers, its referee null until open", () => {
  const { network, referee, runFee, rakeBp, length, grace, commitSlack, minClears } = readSeasonFile(join(REPO_ROOT, "seasons", "testnet-1.json"));
  assert.deepEqual(
    { network, referee, runFee, rakeBp, length, grace, commitSlack, minClears },
    { network: "arbitrum-sepolia", referee: null, runFee: "50000000000000", rakeBp: 1_000, length: 1_209_600, grace: 604_800, commitSlack: 120, minClears: 1 },
  );
});

test("a season file with weights other than its calibration file's is refused", () => {
  const weightsBp = testnet0().weightsBp.map((weight, slot) => (slot === 3 ? weight + 1 : weight));
  assert.throws(() => readSeasonFile(seasonFileWith({ weightsBp })), /its weightsBp are not those of seasons\/calibration-1.json/);
});

test("a season file with an unknown key is refused", () => {
  assert.throws(() => readSeasonFile(seasonFileWith({ season: 1 })), /unknown keys season/);
});

test("a season file whose runFee is a number is refused", () => {
  assert.throws(() => readSeasonFile(seasonFileWith({ runFee: 50_000_000_000_000 })), /not a decimal string of wei/);
});

test("Season.open's parameters take the deployed referee and the fee in wei", () => {
  const referee = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const params = seasonParamsOf(readSeasonFile(TESTNET_0), referee);
  assert.deepEqual([params.referee, params.runFee, params.length, params.minClears], [referee, 50_000_000_000_000n, 86_400n, 1]);
});

test("checkLevels refuses a level id that no level of levels/ has", () => {
  const ids = testnet0().levelIds;
  const run = ([command]) => (command === "level" ? ids.slice(1).map((id, i) => `${id} levels/${i}.bin`).join("\n") : "");
  assert.throws(() => checkLevels(ids, run), new RegExp(`no valid level of levels/ has the id ${ids[0]}`));
});

test("countRuns counts each run at every stage it reached", () => {
  const runs = [
    { revealed: false, committed: false, status: 0 },
    { revealed: true, committed: false, status: 0 },
    { revealed: true, committed: true, status: 0 },
    { revealed: true, committed: true, status: 1 },
    { revealed: true, committed: true, status: 2 },
  ];
  assert.deepEqual(countRuns(runs), { bought: 5, revealed: 4, committed: 3, settled: 1, late: 1 });
});

// The local season of localnet.mjs, with the run its happy path settles for anvil's account 2 and
// a run account 4 buys and never reveals. Each test starts from that state, at the same time.
describe("season operations on the local chain", () => {
  const ANVIL_PORT = 8561;
  const PLAYER = 2;
  const BUYER = 4;
  const KEEPER = 5;
  const BOT = 6;
  const LABEL = "local";
  let anvil;
  let provider;
  let record;
  let season;
  let challenge;
  let recordDir;
  let zkRecordFile;
  let snapshot;
  let rakeBp;

  before(async () => {
    const started = await startAnvil(ANVIL_PORT, false);
    anvil = started.anvil;
    provider = await connect("local", started.rpc);
    const artifacts = buildContracts();
    const generation = await deployLocalnet(artifacts, provider, started.rpc);
    recordDir = mkdtempSync(join(tmpdir(), "season-ops-test-"));
    prependGeneration(join(recordDir, "local.json"), "local", NETWORKS.local.chainId, generation);
    record = readDeploymentRecord(join(recordDir, "local.json"));
    // The same contracts, recorded as `localnet.mjs --up --backend zk` records them, as bots needs.
    mkdirSync(join(recordDir, "zk"));
    zkRecordFile = join(recordDir, "zk", "local.json");
    prependGeneration(zkRecordFile, "local", NETWORKS.local.chainId, { ...generation, backend: "zk" });
    await checkHappyPath(artifacts, provider, generation);
    season = new Contract(generation.Season, artifacts.Season.abi, provider);
    challenge = new Contract(generation.Challenge, artifacts.Challenge.abi, provider);
    const params = await season.paramsOf(generation.seasons[LABEL]);
    rakeBp = params.rakeBp;
    await (await challenge.connect(await provider.getSigner(BUYER)).startRun(generation.seasons[LABEL], { value: params.runFee })).wait();
    snapshot = await provider.send("evm_snapshot", []);
  });

  beforeEach(async () => {
    await provider.send("evm_revert", [snapshot]);
    snapshot = await provider.send("evm_snapshot", []);
  });

  after(() => {
    provider?.destroy();
    anvil?.kill();
    if (recordDir) rmSync(recordDir, { recursive: true, force: true });
  });

  const addressOf = async (index) => (await provider.getSigner(index)).getAddress();
  const keeper = () => provider.getSigner(KEEPER);

  // Six one-byte journals: commitRun never parses the journals, so these tests need no jiro-tools.
  const placeholderLevels = () => Array.from({ length: 6 }, () => ({ journal: "0x00", outcome: { levelScore: 0, ticksUsed: 0, endReason: 1 } }));
  const playBots = async (runs) =>
    playBotRuns({ network: "local", provider, player: await provider.getSigner(BOT), recordFile: zkRecordFile, label: LABEL, runs, play: placeholderLevels });

  async function closeAfterSettlement() {
    await provider.send("evm_setNextBlockTimestamp", [Number((await season.settlementEndOf(1)) + 1n)]);
    await provider.send("evm_mine", []);
    return closeSeasons({ provider, signer: await keeper(), record });
  }

  test("status counts the season's runs bought, revealed, committed, settled and late", async () => {
    const [{ seasons }] = (await readStatus({ provider, record })).generations;
    assert.deepEqual(seasons[0].runs, { bought: 2, revealed: 1, committed: 1, settled: 1, late: 0 });
  });

  test("status equals Season's views of the season, its players and its balance", async () => {
    const [generation] = (await readStatus({ provider, record })).generations;
    const [local] = generation.seasons;
    const state = await season.seasons(1);
    const [player, buyer] = await Promise.all([addressOf(PLAYER), addressOf(BUYER)]);
    const best = await season.bestRunOf(1, player);
    assert.deepEqual(
      [local.fees, local.closed, local.playersPot, local.totalClaimed, local.totalQualifiedPoints, local.end, local.settlementEnd],
      [state.fees, state.closed, state.playersPot, state.totalClaimed, state.totalQualifiedPoints, await season.endOf(1), await season.settlementEndOf(1)],
    );
    assert.deepEqual(local.players, [
      { player, runs: 1, best: { runId: best.runId, score: best.score, ticks: best.ticks, qualified: best.qualified }, claimed: false },
      { player: buyer, runs: 1, best: null, claimed: false },
    ]);
    assert.deepEqual(
      [generation.balance, generation.pendingRollover, generation.rakeOwed, generation.solvent],
      [await provider.getBalance(generation.Season), await season.pendingRollover(), await season.rakeOwed(), await season.isSolvent()],
    );
  });

  test("close sends nothing before the season's end plus grace", async () => {
    assert.deepEqual(await closeSeasons({ provider, signer: await keeper(), record }), []);
    assert.equal(await season.lastClosedSeason(), 0n);
  });

  test("close closes the season once its end plus grace has passed", async () => {
    const closed = await closeAfterSettlement();
    const state = await season.seasons(1);
    assert.deepEqual(closed.map(({ number }) => number), [1n]);
    assert.deepEqual([state.closed, state.playersPot], [true, state.fees - (state.fees * rakeBp) / 10_000n]);
  });

  test("claim before the close reverts with Season's error", async () => {
    await assert.rejects(claimShare({ signer: await provider.getSigner(PLAYER), record, label: LABEL }), /Season\.claim reverts with SeasonNotClosed\(1\)/);
  });

  test("claim pays the only qualified player the whole players' pot", async () => {
    await closeAfterSettlement();
    const { amount } = await claimShare({ signer: await provider.getSigner(PLAYER), record, label: LABEL });
    assert.equal(amount, (await season.seasons(1)).playersPot);
  });

  test("status shows the closed season claimed, with no rounding dust", async () => {
    await closeAfterSettlement();
    await claimShare({ signer: await provider.getSigner(PLAYER), record, label: LABEL });
    const status = await readStatus({ provider, record });
    const [local] = status.generations[0].seasons;
    assert.deepEqual([local.closed, local.totalClaimed, local.players[0].claimed], [true, local.playersPot, true]);
    assert.match(renderStatus(status).join("\n"), /local, season 1: closed;[^]*claimed [0-9.]+ ETH, rounding dust 0 wei/);
  });

  test("withdraw sends the season's rake to the treasury", async () => {
    await closeAfterSettlement();
    const treasury = await season.treasury();
    const before = await provider.getBalance(treasury);
    const [{ amount }] = await withdrawRakes({ signer: await keeper(), record });
    const { fees } = await season.seasons(1);
    assert.deepEqual([amount, await provider.getBalance(treasury)], [(fees * rakeBp) / 10_000n, before + amount]);
  });

  test("withdraw sends nothing while no rake is owed", async () => {
    assert.deepEqual(await withdrawRakes({ signer: await keeper(), record }), []);
  });

  test("bots commits each of its runs in the season, as the signer", async () => {
    const runs = await playBots(2);
    const onchain = await Promise.all(runs.map(({ runId }) => challenge.runs(runId)));
    const bot = await addressOf(BOT);
    assert.deepEqual(
      onchain.map(({ player, season: number, committedAt }) => [player, number, committedAt > 0n]),
      [
        [bot, 1n, true],
        [bot, 1n, true],
      ],
    );
  });

  test("bots plays nothing once the season's end has passed", async () => {
    await provider.send("evm_setNextBlockTimestamp", [Number(await season.endOf(1))]);
    await provider.send("evm_mine", []);
    assert.deepEqual(await playBots(1), []);
  });

  test("status fails when a Season is not solvent", async () => {
    await provider.send("anvil_setBalance", [record.generations[0].Season, "0x0"]);
    await assert.rejects(printStatus({ provider, record }), /not solvent: Season 0x/);
  });
});
