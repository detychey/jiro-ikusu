// Season operations on deployments/<network>.json (plan M4.14 step 4, M5.8, M5.5, M5.15). The
// operator's settlement of a season's scoring runs is web/scripts/settle.mjs, which replays them
// with the web app's core.
//   - open: opens the season of a season file on the newest generation, as Season's operator,
//     after checking:
//       - the season file: its keys, and the rules version, level ids and weights of the
//         calibration file it names, which a season file takes (README §8.4); a season of the
//         v1 payout names none (`calibration` null) and takes equal weights of 10,000 (D18);
//       - the 16 levels with the level tool: each level id is a level of levels/ or of its paid
//         copies in levels/paid/ that `jiro-tools level validate` passes (README §8.4,
//         `levelIds`);
//       - for a Stylus referee, that its remaining activation time covers the season's length
//         plus grace;
//       - for a ZkReferee outside the local chains, that it calls RISC Zero's pinned emergency
//         stop, not paused, over the pinned 3.1 Groth16 verifier (deploy.mjs's
//         checkRiscZeroVerifier, plan M5.10).
//     It writes the season number `open` assigned into the record, under the season file's name,
//     and the referee it opened with into the season file, whose `referee` is null until then.
//   - status: every season of every generation, read at one block: its dates, its runs (bought,
//     revealed, committed, settled, late), fees, pot and claims, its games and tickets, and each
//     player's games, tickets and prize of the v1 payout (README §8.4); and each Season's balance,
//     rake owed and isSolvent(); and, for each zk generation outside the local chains, the check
//     of the RISC Zero emergency stop its ZkReferee calls. The Seasons of BEST_RUN_SEASONS, which
//     pay D10's earlier best run, show their seasons without players, and their rollover. It exits
//     1 if a Season is not solvent, or if a season that is not closed sits on a stop that fails its
//     check (plan M5.10). --season keeps one season.
//   - close: closeSeason on each Season whose next season to close has passed its end plus grace.
//   - withdraw: withdrawRake on each Season that owes rake, which goes to its treasury.
//   - claim: the signer's claim in a closed season.
//   - bots: --runs bot runs of the signer in a season of the newest generation, while it accepts
//     runs: each pays, reveals, plays the six drawn levels with the playtest bots of e2e.mjs and
//     commits; the operator settles its scoring runs (README §7.5). jiro-tools must be built.
// close and withdraw send nothing while nothing is due, and anyone may send them (README §8.4).
// Usage: [DEPLOYER_KEY=…] node season.mjs open --network <network> --season seasons/<label>.json [--rpc <url>]
//        node season.mjs status --network <network> [--season <label>] [--rpc <url>]
//        [TESTER_KEY=…] node season.mjs close|withdraw|claim --network <network> [--season <label>, for claim] [--rpc <url>]
//        [TESTER_KEY=…] node season.mjs bots --network <network> --season <label> [--runs <n>] [--rpc <url>]
// A key is 64 hex digits, with or without 0x. On the local chain every command signs with anvil's
// development account 0. Elsewhere DEPLOYER_KEY holds the operator's key, for open, and
// TESTER_KEY the key of close, withdraw, claim and bots: the tester is the bot player
// (docs/DEPLOYMENT.md), and the operator's key stays out of season-ops.yml.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { Contract, Wallet, formatEther, getAddress } from "ethers";
import { readProgramTimeLeft } from "./activation.mjs";
import { JIRO_TOOLS, LOCAL_NETWORKS, NETWORKS, REPO_ROOT, checkRiscZeroVerifier, connect, deploymentFileOf, privateKeyOf, sendTransaction } from "./deploy.mjs";
import { isEntryPoint, readDeploymentRecord, recordSeason } from "./deployments.mjs";
import { LEVEL_DIRS, botRun, liveCommittedRun, liveContext, measurements, totals } from "./e2e.mjs";
import { eventOf } from "./localnet.mjs";

const SEASON_KEYS = [
  "network",
  "calibration",
  "rulesVersion",
  "levelIds",
  "weightsBp",
  "referee",
  "runFee",
  "rakeBp",
  "length",
  "grace",
  "commitSlack",
];
const FROM_CALIBRATION = ["rulesVersion", "levelIds", "weightsBp"];
// Every weight of a season of the v1 payout (README §8.4, D18).
const EQUAL_WEIGHT_BP = 10_000;
const INTEGER_KEYS = ["rakeBp", "length", "grace", "commitSlack"];
const abiOf = (name) => JSON.parse(readFileSync(join(REPO_ROOT, "contracts", "abi", `${name}.json`), "utf8"));
const SEASON_ABI = abiOf("Season");
// The Seasons of Arbitrum Sepolia's generations 1 and 2, which pay D10's earlier best run (README
// §8.4), and the part of their Season's and Challenge's ABIs that status, close, withdraw and claim
// read.
export const BEST_RUN_SEASONS = ["0x0e9BcC5A9DBD9CAD05C531fC12E925164cfaDf6d", "0x8E9a993c9fb052dCEe447b2e8952319b000Ef446"];
const BEST_RUN_SEASON_ABI = [
  "function currentSeason() view returns (uint256)",
  "function lastClosedSeason() view returns (uint256)",
  "function pendingRollover() view returns (uint256)",
  "function rakeOwed() view returns (uint256)",
  "function isSolvent() view returns (bool)",
  "function treasury() view returns (address)",
  "function endOf(uint256 season) view returns (uint256)",
  "function settlementEndOf(uint256 season) view returns (uint256)",
  "function seasons(uint256 season) view returns (uint256 start, bool closed, bytes32 refereeCodehash, uint256 fees, uint256 playersPot, uint256 totalClaimed, uint256 totalQualifiedPoints)",
  "function closeSeason() returns (uint256 season)",
  "function claim(uint256 season) returns (uint256 amount)",
  "function withdrawRake() returns (uint256 amount)",
  "event SeasonClosed(uint256 indexed season, uint256 rake, uint256 playersPot, bool rolledOver)",
  "event Claimed(uint256 indexed season, address indexed player, uint256 amount)",
  "event RakeWithdrawn(uint256 amount)",
  "error SettlementOpen(uint256 season, uint256 settlementEnd)",
  "error SeasonNotClosed(uint256 season)",
  "error SeasonRolledOver(uint256 season)",
  "error NotQualified(uint256 season, address player)",
  "error AlreadyClaimed(uint256 season, address player)",
  "error TransferFailed(address to, uint256 amount)",
];
const BEST_RUN_CHALLENGE_ABI = [
  "function runCount() view returns (uint256)",
  "function runs(uint256 runId) view returns (address player, uint64 revealedAt, uint64 committedAt, uint256 season, bytes32 runNonce, bytes32 commitment)",
  "function settlements(uint256 runId) view returns (uint8 status, uint8 settledLevels, uint8 clears, uint32 score, uint32 ticks)",
];
const paysBestRun = (address) => BEST_RUN_SEASONS.includes(getAddress(address));
const seasonAbiOf = (address) => (paysBestRun(address) ? BEST_RUN_SEASON_ABI : SEASON_ABI);
const CHALLENGE_ABI = abiOf("Challenge");
// The contracts of e2e.mjs's liveContext, as their committed ABIs: bots needs no build of the contracts.
const LIVE_ARTIFACTS = Object.fromEntries(["Season", "Challenge", "ArbBlockhashEntropy", "ZkReferee", "MockArbSys"].map((name) => [name, { abi: abiOf(name) }]));
const COMMANDS = ["open", "status", "close", "withdraw", "claim", "bots"];
const USAGE = [
  "usage: [DEPLOYER_KEY=…] node season.mjs open --network <network> --season seasons/<label>.json [--rpc <url>]",
  "       node season.mjs status --network <network> [--season <label>] [--rpc <url>]",
  "       [TESTER_KEY=…] node season.mjs close|withdraw|claim --network <network> [--season <label>, for claim] [--rpc <url>]",
  "       [TESTER_KEY=…] node season.mjs bots --network <network> --season <label> [--runs <n>] [--rpc <url>]",
].join("\n");
// Challenge's SettlementStatus.
const SETTLED = 1;
const LATE = 2;
// The runs read in one round of calls, which ethers batches into JSON-RPC requests.
const RUNS_PER_ROUND = 100n;

function fail(file, problem) {
  throw new Error(`season file ${file}: ${problem}`);
}

/** A season file's values, once its keys, types and calibration values are checked. */
export function readSeasonFile(file) {
  const season = JSON.parse(readFileSync(file, "utf8"));
  const missing = SEASON_KEYS.filter((key) => !(key in season));
  const unknown = Object.keys(season).filter((key) => !SEASON_KEYS.includes(key));
  if (missing.length > 0) fail(file, `misses ${missing.join(", ")}`);
  if (unknown.length > 0) fail(file, `has unknown keys ${unknown.join(", ")}`);
  if (!NETWORKS[season.network]) fail(file, `names the unknown network ${season.network}`);
  if (season.calibration === null) {
    if (!Array.isArray(season.weightsBp) || season.weightsBp.length !== 16 || season.weightsBp.some((weight) => weight !== EQUAL_WEIGHT_BP)) {
      fail(file, `names no calibration, so its 16 weightsBp are all ${EQUAL_WEIGHT_BP} (the v1 payout)`);
    }
  } else {
    const calibration = JSON.parse(readFileSync(join(REPO_ROOT, season.calibration), "utf8"));
    for (const key of FROM_CALIBRATION) {
      if (JSON.stringify(season[key]) !== JSON.stringify(calibration[key])) fail(file, `its ${key} are not those of ${season.calibration}`);
    }
  }
  if (season.referee !== null && season.referee !== getAddress(season.referee)) fail(file, `referee ${season.referee} is not checksummed`);
  if (typeof season.runFee !== "string" || !/^[1-9][0-9]*$/.test(season.runFee)) fail(file, `runFee ${JSON.stringify(season.runFee)} is not a decimal string of wei`);
  for (const key of INTEGER_KEYS) {
    if (!Number.isSafeInteger(season[key]) || season[key] < 0) fail(file, `${key} ${JSON.stringify(season[key])} is not an integer`);
  }
  return season;
}

/** Season.open's parameters; Season.open itself checks README §8.4's ranges. */
export function seasonParamsOf(season, referee) {
  return {
    referee,
    rulesVersion: season.rulesVersion,
    levelIds: season.levelIds,
    weightsBp: season.weightsBp,
    runFee: BigInt(season.runFee),
    rakeBp: season.rakeBp,
    length: BigInt(season.length),
    grace: BigInt(season.grace),
    commitSlack: BigInt(season.commitSlack),
  };
}

function jiroTools(args) {
  const result = spawnSync(JIRO_TOOLS, args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`jiro-tools ${args.slice(0, 2).join(" ")} fails:\n${result.stderr}`);
  return result.stdout;
}

/** The level tool's check: every level of levels/ and levels/paid/ is valid, and each of `levelIds` is one of them. */
export function checkLevels(levelIds, run = jiroTools) {
  const files = LEVEL_DIRS.flatMap((dir) =>
    readdirSync(join(REPO_ROOT, dir))
      .filter((name) => name.endsWith(".bin"))
      .map((name) => join(dir, name)),
  );
  run(["level", "validate", ...files]);
  const fileOf = new Map(
    run(["level", "id", ...files])
      .trim()
      .split("\n")
      .map((line) => line.split(" ")),
  );
  const missing = levelIds.filter((levelId) => !fileOf.has(levelId));
  if (missing.length > 0) throw new Error(`no valid level of levels/ or levels/paid/ has the id ${missing.join(", ")}`);
  console.log(`the ${levelIds.length} levels are valid: ${levelIds.map((levelId) => fileOf.get(levelId)).join(", ")}`);
}

/**
 * Opens the season of `seasonFile` on the newest generation of `recordFile` as `operator`, then
 * records its number in `recordFile` and its referee in `seasonFile`.
 */
export async function openSeason({ provider, operator, seasonFile, recordFile, run = jiroTools }) {
  const label = basename(seasonFile, ".json");
  const season = readSeasonFile(seasonFile);
  const record = readDeploymentRecord(recordFile);
  if (record.network !== season.network) throw new Error(`${seasonFile} is a season of ${season.network}, not of ${record.network}`);
  const [generation] = record.generations;
  if (label in generation.seasons) throw new Error(`${label} is already open on this generation, as season ${generation.seasons[label]}`);
  if (season.referee !== null && season.referee !== generation.Referee) {
    throw new Error(`${seasonFile} names the referee ${season.referee}, and the newest generation's is ${generation.Referee}`);
  }
  checkLevels(season.levelIds, run);
  if (generation.backend === "stylus") {
    const timeLeft = await readProgramTimeLeft(provider, generation.Referee);
    const needed = BigInt(season.length + season.grace);
    if (timeLeft < needed) throw new Error(`the Stylus referee's activation expires in ${timeLeft} s, before the season's length plus grace, ${needed} s`);
  }
  if (generation.backend === "zk" && !LOCAL_NETWORKS.includes(record.network)) {
    await checkRiscZeroVerifier(provider, NETWORKS[record.network].chainId, generation.Referee);
  }
  const contract = new Contract(generation.Season, SEASON_ABI, operator);
  const receipt = await sendTransaction("Season.open", contract.open(seasonParamsOf(season, generation.Referee)), contract);
  const number = Number(eventOf(contract, receipt, "SeasonOpened").season);
  recordSeason(recordFile, label, number);
  writeFileSync(seasonFile, `${JSON.stringify({ ...season, referee: generation.Referee }, null, 2)}\n`);
  console.log(`${label} is season ${number} of Season ${generation.Season}, with the referee ${generation.Referee}`);
  return { number, receipt };
}

const isoOf = (timestamp) => new Date(Number(timestamp) * 1000).toISOString();

/** A season's runs counted: bought, revealed, committed, settled on time, and settled late. */
export function countRuns(runs) {
  return {
    bought: runs.length,
    revealed: runs.filter((run) => run.revealed).length,
    committed: runs.filter((run) => run.committed).length,
    settled: runs.filter((run) => run.status === SETTLED).length,
    late: runs.filter((run) => run.status === LATE).length,
  };
}

/** Every run of `challenge` at `blockTag`, in run id order. */
async function readRuns(challenge, blockTag) {
  const runCount = await challenge.runCount({ blockTag });
  const runs = [];
  for (let first = 1n; first <= runCount; first += RUNS_PER_ROUND) {
    const runIds = [];
    for (let runId = first; runId < first + RUNS_PER_ROUND && runId <= runCount; runId++) runIds.push(runId);
    const round = await Promise.all(
      runIds.map(async (runId) => {
        const [run, settlement] = await Promise.all([challenge.runs(runId, { blockTag }), challenge.settlements(runId, { blockTag })]);
        return { runId, player: run.player, season: run.season, revealed: run.revealedAt !== 0n, committed: run.committedAt !== 0n, status: Number(settlement.status) };
      }),
    );
    runs.push(...round);
  }
  return runs;
}

/**
 * Season `number` at `blockTag`: Season's state of it, its runs among `runs`, and the games,
 * tickets, prize and claim of each player who bought one. Their games and tickets must sum to the
 * season's, since every game is a run's and every ticket a run's of its player. A Season of
 * BEST_RUN_SEASONS has no games, tickets or prizes, and lists no player.
 */
async function readSeasonStatus(season, bestRun, number, runs, blockTag) {
  const [state, end, settlementEnd] = await Promise.all([
    season.seasons(number, { blockTag }),
    season.endOf(number, { blockTag }),
    season.settlementEndOf(number, { blockTag }),
  ]);
  const seasonRuns = runs.filter((run) => run.season === number);
  const common = {
    number,
    start: state.start,
    end,
    settlementEnd,
    closed: state.closed,
    fees: state.fees,
    playersPot: state.playersPot,
    totalClaimed: state.totalClaimed,
    runs: countRuns(seasonRuns),
  };
  if (bestRun) return { ...common, paysBestRun: true, players: [] };
  const players = await Promise.all(
    [...new Set(seasonRuns.map((run) => run.player))].map(async (player) => {
      const [tally, prize] = await Promise.all([season.tallyOf(number, player, { blockTag }), season.prizeOf(number, player, { blockTag })]);
      return { player, runs: seasonRuns.filter((run) => run.player === player).length, games: tally.games, tickets: tally.tickets, prize, claimed: tally.claimed };
    }),
  );
  for (const key of ["games", "tickets"]) {
    const sum = players.reduce((total, player) => total + player[key], 0n);
    if (sum !== state[key]) throw new Error(`season ${number}: its players' ${key} sum to ${sum}, not to Season's ${state[key]}`);
  }
  const { rakeBp } = await season.paramsOf(number, { blockTag });
  return { ...common, paysBestRun: false, rakeBp, games: state.games, tickets: state.tickets, players };
}

/** The check of the RISC Zero emergency stop that a ZkReferee calls, its failure recorded, not thrown. */
async function readRiscZeroStop(provider, chainId, referee) {
  try {
    return { ok: true, detail: await checkRiscZeroVerifier(provider, chainId, referee) };
  } catch (error) {
    return { ok: false, detail: error.shortMessage ?? error.message };
  }
}

/**
 * Each Season of `record` and its seasons, or only the season labeled `label`, at the latest block;
 * for a zk generation outside the local chains, also the check of its RISC Zero stop.
 */
export async function readStatus({ provider, record, label }) {
  const block = await provider.getBlock("latest");
  const blockTag = block.number;
  const generations = [];
  for (const generation of record.generations) {
    if (label !== undefined && !(label in generation.seasons)) continue;
    const bestRun = paysBestRun(generation.Season);
    const season = new Contract(generation.Season, seasonAbiOf(generation.Season), provider);
    const challenge = new Contract(generation.Challenge, bestRun ? BEST_RUN_CHALLENGE_ABI : CHALLENGE_ABI, provider);
    const labelOf = new Map(Object.entries(generation.seasons).map(([name, number]) => [BigInt(number), name]));
    const [currentSeason, balance, pendingRollover, rakeOwed, solvent, runs] = await Promise.all([
      season.currentSeason({ blockTag }),
      provider.getBalance(generation.Season, blockTag),
      bestRun ? season.pendingRollover({ blockTag }) : null,
      season.rakeOwed({ blockTag }),
      season.isSolvent({ blockTag }),
      readRuns(challenge, blockTag),
    ]);
    const numbers = [];
    for (let number = 1n; number <= currentSeason; number++) {
      if (label === undefined || labelOf.get(number) === label) numbers.push(number);
    }
    const seasons = await Promise.all(
      numbers.map(async (number) => ({ label: labelOf.get(number) ?? null, ...(await readSeasonStatus(season, bestRun, number, runs, blockTag)) })),
    );
    const riscZero =
      generation.backend === "zk" && !LOCAL_NETWORKS.includes(record.network)
        ? await readRiscZeroStop(provider, NETWORKS[record.network].chainId, generation.Referee)
        : null;
    generations.push({ Season: generation.Season, deployedAt: generation.deployedAt, balance, pendingRollover, rakeOwed, solvent, riscZero, seasons });
  }
  if (label !== undefined && generations.length === 0) throw new Error(`no generation of the ${record.network} record holds the season ${label}`);
  return { block: { number: block.number, timestamp: block.timestamp }, generations };
}

function phaseOf(season, now) {
  if (season.closed) return "closed";
  if (now < season.end) return "accepting runs";
  if (now <= season.settlementEnd) return "settling";
  return "to close";
}

/** Tickets in basis points, as tickets: 49,692 bp is 4.9692. */
const ticketsOf = (bp) => (Number(bp) / 10_000).toFixed(4);

/** `readStatus`'s result as lines of text. */
export function renderStatus({ block, generations }) {
  const now = BigInt(block.timestamp);
  const lines = [`block ${block.number}, ${isoOf(block.timestamp)}`];
  for (const generation of generations) {
    const rollover = generation.pendingRollover === null ? "" : `rollover ${formatEther(generation.pendingRollover)} ETH, `;
    lines.push(
      `Season ${generation.Season}, generation of ${generation.deployedAt}: balance ${formatEther(generation.balance)} ETH, ` +
        `${rollover}rake owed ${formatEther(generation.rakeOwed)} ETH, solvent: ${generation.solvent ? "yes" : "no"}`,
    );
    if (generation.riscZero) lines.push(`  RISC Zero verifier ${generation.riscZero.ok ? "PASS" : "FAIL"}: ${generation.riscZero.detail}`);
    for (const season of generation.seasons) {
      const { bought, revealed, committed, settled, late } = season.runs;
      lines.push(
        `  ${season.label ?? "unlabeled"}, season ${season.number}: ${phaseOf(season, now)}; ` +
          `start ${isoOf(season.start)}, end ${isoOf(season.end)}, settlement end ${isoOf(season.settlementEnd)}`,
        `    runs: ${bought} bought, ${revealed} revealed, ${committed} committed, ${settled} settled, ${late} late; fees ${formatEther(season.fees)} ETH`,
      );
      if (season.paysBestRun) {
        if (season.closed) lines.push(`    players' pot ${formatEther(season.playersPot)} ETH, claimed ${formatEther(season.totalClaimed)} ETH; it pays D10's earlier best run`);
        continue;
      }
      const average = season.games === 0n ? "none" : ticketsOf((season.tickets * 10_000n) / season.games);
      lines.push(`    games ${season.games}, tickets ${ticketsOf(season.tickets)}, average ticket ${average}`);
      if (season.closed) {
        const rake = (season.fees * BigInt(season.rakeBp)) / 10_000n;
        const dust = season.playersPot - season.players.reduce((sum, { prize }) => sum + prize, 0n);
        lines.push(
          `    rake ${formatEther(rake)} ETH; players' pot ${formatEther(season.playersPot)} ETH, claimed ${formatEther(season.totalClaimed)} ETH, ` +
            `rounding dust ${dust} wei`,
        );
      }
      for (const { player, runs, games, tickets, prize, claimed } of season.players) {
        const claim = season.closed ? `${claimed ? "claimed" : "unclaimed"} ${formatEther(prize)} ETH` : `${formatEther(prize)} ETH if it closed now`;
        lines.push(`    ${player}: ${runs} run${runs === 1 ? "" : "s"}, ${games} games, tickets ${ticketsOf(tickets)}; prize ${claim}`);
      }
    }
  }
  return lines;
}

/**
 * Throws if a Season of `readStatus`'s generations is not solvent, or holds a season that is not
 * closed while the RISC Zero stop of its ZkReferee fails its check.
 */
export function checkStatus(generations) {
  const problems = [];
  const insolvent = generations.filter((generation) => !generation.solvent).map((generation) => generation.Season);
  if (insolvent.length > 0) problems.push(`not solvent: Season ${insolvent.join(", ")}`);
  const stopped = generations
    .filter((generation) => generation.riscZero?.ok === false && generation.seasons.some((season) => !season.closed))
    .map((generation) => `${generation.Season} (${generation.riscZero.detail})`);
  if (stopped.length > 0) problems.push(`a season that is not closed sits on a RISC Zero stop that fails its check: Season ${stopped.join(", ")}`);
  if (problems.length > 0) throw new Error(problems.join("; "));
}

/** Prints the status, then throws as checkStatus does. */
export async function printStatus({ provider, record, label }) {
  const status = await readStatus({ provider, record, label });
  console.log(renderStatus(status).join("\n"));
  checkStatus(status.generations);
  return status;
}

/** closeSeason, as `signer`, on each Season of `record` whose next season to close has passed its end plus grace. */
export async function closeSeasons({ provider, signer, record }) {
  const closed = [];
  for (const generation of record.generations) {
    const season = new Contract(generation.Season, seasonAbiOf(generation.Season), signer);
    const labelOf = new Map(Object.entries(generation.seasons).map(([name, number]) => [BigInt(number), name]));
    for (;;) {
      const number = (await season.lastClosedSeason()) + 1n;
      if (number > (await season.currentSeason())) {
        console.log(`Season ${generation.Season}: no season to close`);
        break;
      }
      const name = `${labelOf.get(number) ?? "unlabeled"}, season ${number} of Season ${generation.Season}`;
      const settlementEnd = await season.settlementEndOf(number);
      // Block timestamps never decrease, so a close sent once the latest block is past the end plus grace lands past it too.
      if (BigInt((await provider.getBlock("latest")).timestamp) <= settlementEnd) {
        console.log(`${name}: settlement open until ${isoOf(settlementEnd)}, so it closes later`);
        break;
      }
      const receipt = await sendTransaction("Season.closeSeason", season.closeSeason(), season);
      const { rake, playersPot } = eventOf(season, receipt, "SeasonClosed");
      console.log(`${name} closed: rake ${formatEther(rake)} ETH, players' pot ${formatEther(playersPot)} ETH`);
      closed.push({ Season: generation.Season, number, receipt });
    }
  }
  return closed;
}

/** withdrawRake, as `signer`, on each Season of `record` that owes rake; it goes to that Season's treasury. */
export async function withdrawRakes({ signer, record }) {
  const withdrawn = [];
  for (const generation of record.generations) {
    const season = new Contract(generation.Season, seasonAbiOf(generation.Season), signer);
    if ((await season.rakeOwed()) === 0n) {
      console.log(`Season ${generation.Season}: no rake owed`);
      continue;
    }
    const receipt = await sendTransaction("Season.withdrawRake", season.withdrawRake(), season);
    const { amount } = eventOf(season, receipt, "RakeWithdrawn");
    console.log(`Season ${generation.Season}: ${formatEther(amount)} ETH of rake sent to the treasury ${await season.treasury()}`);
    withdrawn.push({ Season: generation.Season, amount, receipt });
  }
  return withdrawn;
}

/** `signer`'s prize in the closed season labeled `label`, on the newest generation that holds it. */
export async function claimShare({ signer, record, label }) {
  const generation = record.generations.find((candidate) => label in candidate.seasons);
  if (!generation) throw new Error(`no generation of the ${record.network} record holds the season ${label}`);
  const number = generation.seasons[label];
  const season = new Contract(generation.Season, seasonAbiOf(generation.Season), signer);
  const receipt = await sendTransaction("Season.claim", season.claim(number), season);
  const { player, amount } = eventOf(season, receipt, "Claimed");
  console.log(`${label}, season ${number} of Season ${generation.Season}: ${player} claimed ${formatEther(amount)} ETH`);
  return { amount, receipt };
}

/**
 * Up to `runs` runs of `player` in the season labeled `label` of the newest generation of
 * `recordFile`, each paid, revealed, played by `play` (by default the playtest bots of e2e.mjs) and
 * committed. It stops at the season's end, when the season stops accepting runs (README §8.4).
 * Returns the committed runs.
 */
export async function playBotRuns({ network, provider, player, recordFile, label, runs, play = (context, runNonce) => botRun(context, runNonce, false) }) {
  const context = await liveContext({ network, provider, player, settler: player, artifacts: LIVE_ARTIFACTS, recordFile, seasonLabel: label });
  const measured = measurements.length;
  try {
    const end = await context.season.endOf(context.number);
    const committed = [];
    while (committed.length < runs) {
      if (BigInt((await provider.getBlock("latest")).timestamp) >= end) {
        console.log(`${label}, season ${context.number}: its runs ended at ${isoOf(end)}`);
        break;
      }
      const run = await liveCommittedRun(context, "bot run", play);
      const { score, ticks, clears, tickets } = totals(run.levels);
      console.log(`${label}: bot run ${run.runId} of ${await player.getAddress()} committed, score ${score}, ${ticks} ticks, ${clears} cleared, tickets ${ticketsOf(tickets)}`);
      committed.push(run);
    }
    if (measurements.length > measured) console.log(measurements.slice(measured).join("\n"));
    return committed;
  } finally {
    rmSync(context.workDir, { recursive: true, force: true });
  }
}

/** The key `command` signs with, read from the environment, which then keeps neither key. */
function signingKeyOf(command, network) {
  const name = command === "open" ? "DEPLOYER_KEY" : "TESTER_KEY";
  const key = command === "status" || network === "local" ? undefined : privateKeyOf(name, process.env[name], network);
  // No child needs them: the level tool runs from here.
  delete process.env.DEPLOYER_KEY;
  delete process.env.TESTER_KEY;
  return key;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { network: { type: "string" }, season: { type: "string" }, rpc: { type: "string" }, runs: { type: "string" } },
  });
  const [command, ...extra] = positionals;
  const seasonNeeded = command === "open" || command === "claim" || command === "bots";
  const seasonRefused = command === "close" || command === "withdraw";
  const runsValid = values.runs === undefined || (command === "bots" && /^[1-9][0-9]*$/.test(values.runs));
  if (!COMMANDS.includes(command) || extra.length > 0 || !NETWORKS[values.network] || (seasonNeeded && !values.season) || (seasonRefused && values.season) || !runsValid) {
    throw new Error(USAGE);
  }
  const network = values.network;
  const key = signingKeyOf(command, network);
  const provider = await connect(network, values.rpc ?? NETWORKS[network].rpc);
  const signer = command === "status" ? undefined : network === "local" ? await provider.getSigner(0) : new Wallet(key, provider);
  const recordFile = deploymentFileOf(network);
  const label = values.season === undefined ? undefined : basename(values.season, ".json");
  const commands = {
    open: () => openSeason({ provider, operator: signer, seasonFile: values.season, recordFile }),
    status: () => printStatus({ provider, record: readDeploymentRecord(recordFile), label }),
    close: () => closeSeasons({ provider, signer, record: readDeploymentRecord(recordFile) }),
    withdraw: () => withdrawRakes({ signer, record: readDeploymentRecord(recordFile) }),
    claim: () => claimShare({ signer, record: readDeploymentRecord(recordFile), label }),
    bots: () => playBotRuns({ network, provider, player: signer, recordFile, label, runs: Number(values.runs ?? 1) }),
  };
  await commands[command]();
  provider.destroy();
}

if (isEntryPoint(import.meta.url)) await main();
