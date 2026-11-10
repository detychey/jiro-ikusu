// Season operations (plan M4.14 step 4; M5.5 adds status, close, withdraw and settle). `open` opens
// the season of a season file on the newest generation of deployments/<network>.json, as Season's
// operator, after checking:
//   - the season file: its keys, and the rules version, level ids and weights of the calibration
//     file it names, which a season file takes (README §8.4);
//   - the 16 levels with the level tool: each level id is a level of levels/ that
//     `jiro-tools level validate` passes (README §8.4, `levelIds`);
//   - for a Stylus referee, that its remaining activation time covers the season's length plus grace.
// It writes the season number `open` assigned into the record, under the season file's name, and
// the referee it opened with into the season file, whose `referee` is null until then.
// Usage: [DEPLOYER_KEY=0x…] node season.mjs open --network <network> --season seasons/<label>.json [--rpc <url>]
// The local chain's operator is anvil's development account 0; elsewhere DEPLOYER_KEY holds its key.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { Contract, Wallet, getAddress } from "ethers";
import { readProgramTimeLeft } from "./activation.mjs";
import { JIRO_TOOLS, NETWORKS, REPO_ROOT, connect, deploymentFileOf, privateKeyOf, sendTransaction } from "./deploy.mjs";
import { isEntryPoint, readDeploymentRecord, recordSeason } from "./deployments.mjs";
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
  "minClears",
];
const FROM_CALIBRATION = ["rulesVersion", "levelIds", "weightsBp"];
const INTEGER_KEYS = ["rakeBp", "length", "grace", "commitSlack", "minClears"];
const SEASON_ABI = JSON.parse(readFileSync(join(REPO_ROOT, "contracts", "abi", "Season.json"), "utf8"));

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
  const calibration = JSON.parse(readFileSync(join(REPO_ROOT, season.calibration), "utf8"));
  for (const key of FROM_CALIBRATION) {
    if (JSON.stringify(season[key]) !== JSON.stringify(calibration[key])) fail(file, `its ${key} are not those of ${season.calibration}`);
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
    minClears: season.minClears,
  };
}

function jiroTools(args) {
  const result = spawnSync(JIRO_TOOLS, args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`jiro-tools ${args.slice(0, 2).join(" ")} fails:\n${result.stderr}`);
  return result.stdout;
}

/** The level tool's check: every level of levels/ is valid, and each of `levelIds` is one of them. */
export function checkLevels(levelIds, run = jiroTools) {
  const files = readdirSync(join(REPO_ROOT, "levels"))
    .filter((name) => name.endsWith(".bin"))
    .map((name) => join("levels", name));
  run(["level", "validate", ...files]);
  const fileOf = new Map(
    run(["level", "id", ...files])
      .trim()
      .split("\n")
      .map((line) => line.split(" ")),
  );
  const missing = levelIds.filter((levelId) => !fileOf.has(levelId));
  if (missing.length > 0) throw new Error(`no valid level of levels/ has the id ${missing.join(", ")}`);
  console.log(`the ${levelIds.length} levels are valid: ${levelIds.map((levelId) => basename(fileOf.get(levelId), ".bin")).join(", ")}`);
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
  const contract = new Contract(generation.Season, SEASON_ABI, operator);
  const receipt = await sendTransaction("Season.open", contract.open(seasonParamsOf(season, generation.Referee)), contract);
  const number = Number(eventOf(contract, receipt, "SeasonOpened").season);
  recordSeason(recordFile, label, number);
  writeFileSync(seasonFile, `${JSON.stringify({ ...season, referee: generation.Referee }, null, 2)}\n`);
  console.log(`${label} is season ${number} of Season ${generation.Season}, with the referee ${generation.Referee}`);
  return { number, receipt };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { network: { type: "string" }, season: { type: "string" }, rpc: { type: "string" } },
  });
  if (positionals.join(" ") !== "open" || !NETWORKS[values.network] || !values.season) {
    throw new Error("usage: [DEPLOYER_KEY=0x…] node season.mjs open --network <network> --season seasons/<label>.json [--rpc <url>]");
  }
  const network = values.network;
  const provider = await connect(network, values.rpc ?? NETWORKS[network].rpc);
  const deployerKey = network === "local" ? undefined : privateKeyOf("DEPLOYER_KEY", process.env.DEPLOYER_KEY, network);
  // No child needs it: the level tool runs from here.
  delete process.env.DEPLOYER_KEY;
  const operator = network === "local" ? await provider.getSigner(0) : new Wallet(deployerKey, provider);
  await openSeason({ provider, operator, seasonFile: values.season, recordFile: deploymentFileOf(network) });
  provider.destroy();
}

if (isEntryPoint(import.meta.url)) await main();
