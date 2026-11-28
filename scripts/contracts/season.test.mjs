import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import { Contract, keccak256 } from "ethers";
import { NETWORKS, REPO_ROOT, buildContracts, connect } from "./deploy.mjs";
import { prependGeneration, readDeploymentRecord } from "./deployments.mjs";
import { checkHappyPath, deployLocalnet, startAnvil } from "./localnet.mjs";
import {
  BEST_RUN_SEASONS,
  checkLevels,
  checkStatus,
  claimShare,
  closeSeasons,
  countRuns,
  openSeason,
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

test("seasons/testnet-0.json holds plan M4.14's provisional season, its referee the ZkReferee of the generation that opened it", () => {
  const { network, referee, runFee, length, grace, commitSlack } = readSeasonFile(TESTNET_0);
  const { generations } = JSON.parse(readFileSync(join(REPO_ROOT, "deployments", "arbitrum-sepolia.json"), "utf8"));
  const deployedReferee = generations.find((generation) => "testnet-0" in generation.seasons).Referee;
  assert.deepEqual(
    { network, referee, runFee, length, grace, commitSlack },
    { network: "arbitrum-sepolia", referee: deployedReferee, runFee: "50000000000000", length: 86_400, grace: 86_400, commitSlack: 120 },
  );
});

const TESTNET_1 = join(REPO_ROOT, "seasons", "testnet-1.json");
const PAID_DIR = join(REPO_ROOT, "levels", "paid");
const paidLevelIds = () =>
  readdirSync(PAID_DIR)
    .filter((name) => name.endsWith(".bin"))
    .sort()
    .map((name) => keccak256(readFileSync(join(PAID_DIR, name))));

test("seasons/testnet-1.json holds plan M5.16's season of testers on the v1 payout, its referee null until open", () => {
  const { network, calibration, referee, runFee, rakeBp, length, grace, commitSlack } = readSeasonFile(TESTNET_1);
  assert.deepEqual(
    { network, calibration, referee, runFee, rakeBp, length, grace, commitSlack },
    { network: "arbitrum-sepolia", calibration: null, referee: null, runFee: "176000000000000", rakeBp: 2_000, length: 1_209_600, grace: 86_400, commitSlack: 120 },
  );
});

test("seasons/testnet-1.json draws the paid copies of levels/paid/, in index order", () => {
  assert.deepEqual(readSeasonFile(TESTNET_1).levelIds, paidLevelIds());
});

test("a season file that names no calibration and weighs a level other than 10,000 is refused", () => {
  const weightsBp = Array.from({ length: 16 }, (_, slot) => (slot === 5 ? 9_999 : 10_000));
  assert.throws(() => readSeasonFile(seasonFileWith({ calibration: null, weightsBp })), /names no calibration, so its 16 weightsBp are all 10000/);
});

test("a season file with weights other than its calibration file's is refused", () => {
  const weightsBp = testnet0().weightsBp.map((weight, slot) => (slot === 3 ? weight + 1 : weight));
  assert.throws(() => readSeasonFile(seasonFileWith({ weightsBp })), /its weightsBp are not those of seasons\/calibration-1.json/);
});

test("a season file with an unknown key is refused", () => {
  assert.throws(() => readSeasonFile(seasonFileWith({ season: 1 })), /unknown keys season/);
});

test("a season file with D10's earlier minClears is refused: generation 3 has none", () => {
  assert.throws(() => readSeasonFile(seasonFileWith({ minClears: 1 })), /unknown keys minClears/);
});

test("the Seasons that pay the best run are those of Arbitrum Sepolia's generations 1 and 2", () => {
  const { generations } = JSON.parse(readFileSync(join(REPO_ROOT, "deployments", "arbitrum-sepolia.json"), "utf8"));
  assert.deepEqual(BEST_RUN_SEASONS, generations.slice(-2).map(({ Season }) => Season).reverse());
});

test("a season file whose runFee is a number is refused", () => {
  assert.throws(() => readSeasonFile(seasonFileWith({ runFee: 50_000_000_000_000 })), /not a decimal string of wei/);
});

test("Season.open's parameters take the deployed referee and the fee in wei", () => {
  const referee = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const params = seasonParamsOf(readSeasonFile(TESTNET_0), referee);
  assert.deepEqual([params.referee, params.runFee, params.length, "minClears" in params], [referee, 50_000_000_000_000n, 86_400n, false]);
});

test("checkLevels refuses a level id that no level of levels/ or levels/paid/ has", () => {
  const ids = testnet0().levelIds;
  const run = ([command]) => (command === "level" ? ids.slice(1).map((id, i) => `${id} levels/${i}.bin`).join("\n") : "");
  assert.throws(() => checkLevels(ids, run), new RegExp(`no valid level of levels/ or levels/paid/ has the id ${ids[0]}`));
});

test("checkLevels validates the paid copies of levels/paid/ with the 16 levels", () => {
  const validated = [];
  const run = ([command, subcommand, ...files]) => {
    if (subcommand === "validate") validated.push(...files);
    return files.map((file) => `${keccak256(readFileSync(join(REPO_ROOT, file)))} ${file}`).join("\n");
  };
  checkLevels(paidLevelIds(), run);
  assert.equal(validated.filter((file) => file.startsWith(join("levels", "paid"))).length, 16);
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

const STOPPED = { ok: false, detail: "the emergency stop 0x724d375B5b622e15f0E64e9Deb76a4cB17877797 is paused" };
const generationOnStop = (closed) => ({ Season: "0x0e9BcC5A9DBD9CAD05C531fC12E925164cfaDf6d", solvent: true, riscZero: STOPPED, seasons: [{ closed }] });

test("status fails when a season that is not closed sits on a RISC Zero stop that fails its check", () => {
  assert.throws(() => checkStatus([generationOnStop(false)]), /a season that is not closed sits on a RISC Zero stop that fails its check: Season 0x0e9B.* is paused/);
});

test("status passes when only closed seasons sit on a RISC Zero stop that fails its check", () => {
  assert.doesNotThrow(() => checkStatus([generationOnStop(true)]));
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
  // The level bytes carry only the target, 7,500 bp, at offset 470.
  const placeholderLevel = `0x${"00".repeat(470)}1d4c`;
  const placeholderLevels = () =>
    Array.from({ length: 6 }, () => ({ level: placeholderLevel, journal: "0x00", outcome: { levelScore: 0, ticksUsed: 0, endReason: 1, claimBp: 0 } }));
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
    const [played, bought] = await Promise.all([season.tallyOf(1, player), season.tallyOf(1, buyer)]);
    assert.deepEqual(
      [local.fees, local.closed, local.playersPot, local.totalClaimed, local.games, local.tickets, local.end, local.settlementEnd],
      [state.fees, state.closed, state.playersPot, state.totalClaimed, state.games, state.tickets, await season.endOf(1), await season.settlementEndOf(1)],
    );
    assert.deepEqual(local.players, [
      { player, runs: 1, games: 6n, tickets: played.tickets, prize: await season.prizeOf(1, player), claimed: false },
      { player: buyer, runs: 1, games: 6n, tickets: bought.tickets, prize: await season.prizeOf(1, buyer), claimed: false },
    ]);
    assert.deepEqual(
      [generation.balance, generation.pendingRollover, generation.rakeOwed, generation.solvent],
      [await provider.getBalance(generation.Season), null, await season.rakeOwed(), await season.isSolvent()],
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

  test("claim pays the player the prize of their games", async () => {
    await closeAfterSettlement();
    const prize = await season.prizeOf(1, await addressOf(PLAYER));
    const { amount } = await claimShare({ signer: await provider.getSigner(PLAYER), record, label: LABEL });
    assert.equal(amount, prize);
  });

  test("a player whose run never settled claims a lost game's prize, below the settled player's", async () => {
    await closeAfterSettlement();
    const { amount } = await claimShare({ signer: await provider.getSigner(BUYER), record, label: LABEL });
    const settled = await season.prizeOf(1, await addressOf(PLAYER));
    assert.ok(amount > 0n && amount < settled, `${amount} is not between 0 and ${settled}`);
  });

  test("status shows the closed season claimed, with at most one wei of dust per player", async () => {
    await closeAfterSettlement();
    await claimShare({ signer: await provider.getSigner(PLAYER), record, label: LABEL });
    await claimShare({ signer: await provider.getSigner(BUYER), record, label: LABEL });
    const status = await readStatus({ provider, record });
    const [local] = status.generations[0].seasons;
    assert.deepEqual([local.closed, local.players.every(({ claimed }) => claimed)], [true, true]);
    assert.ok(local.playersPot - local.totalClaimed <= 2n, `dust ${local.playersPot - local.totalClaimed} wei`);
    assert.match(renderStatus(status).join("\n"), /local, season 1: closed;[^]*claimed [0-9.]+ ETH, rounding dust [0-2] wei/);
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

  test("open opens seasons/testnet-1.json, its checks passed, once the local season has ended", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "season-open-test-"));
    try {
      const recordFile = join(workDir, "local.json");
      writeFileSync(recordFile, readFileSync(join(recordDir, "local.json")));
      const seasonFile = join(workDir, "testnet-1.json");
      writeFileSync(seasonFile, JSON.stringify({ ...JSON.parse(readFileSync(TESTNET_1, "utf8")), network: "local" }));
      await provider.send("evm_setNextBlockTimestamp", [Number(await season.endOf(1))]);
      const run = ([, , ...files]) => files.map((file) => `${keccak256(readFileSync(join(REPO_ROOT, file)))} ${file}`).join("\n");
      const { number } = await openSeason({ provider, operator: await provider.getSigner(0), seasonFile, recordFile, run });
      const params = await season.paramsOf(number);
      assert.deepEqual(
        [number, [...params.levelIds], params.weightsBp.map(Number), params.runFee, params.rakeBp],
        [2, paidLevelIds(), Array(16).fill(10_000), 176_000_000_000_000n, 2_000n],
      );
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  test("status fails when a Season is not solvent", async () => {
    await provider.send("anvil_setBalance", [record.generations[0].Season, "0x0"]);
    await assert.rejects(printStatus({ provider, record }), /not solvent: Season 0x/);
  });
});
