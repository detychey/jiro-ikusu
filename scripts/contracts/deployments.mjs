// The deployment records of deployments/README.md: assertDeploymentRecord checks a record against
// the schema, and prependGeneration adds a generation in front of a record's earlier ones, which it
// keeps unchanged. Usage: node deployments.mjs <deployments/<network>.json>...
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress } from "ethers";

export const BACKENDS = ["mock", "stylus", "zk"];
export const CONTRACT_KEYS = ["ArbSys", "ArbBlockhashEntropy", "Referee", "Season", "Challenge"];
const ACCOUNT_KEYS = ["operator", "treasury"];
const GENERATION_KEYS = ["deployedAt", "sourceCommit", "backend", ...ACCOUNT_KEYS, ...CONTRACT_KEYS, "seasons"];
const RECORD_KEYS = ["network", "chainId", "generations"];

function fail(where, problem) {
  throw new Error(`deployment record ${where}: ${problem}`);
}

function assertKeys(where, value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(where, "is not an object");
  const missing = keys.filter((key) => !(key in value));
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (missing.length > 0) fail(where, `misses ${missing.join(", ")}`);
  if (unknown.length > 0) fail(where, `has unknown keys ${unknown.join(", ")}`);
}

function assertChecksummedAddress(where, value) {
  let checksummed;
  try {
    checksummed = getAddress(value);
  } catch (error) {
    fail(where, `${JSON.stringify(value)} is not an address (${error.shortMessage ?? error.message})`);
  }
  if (checksummed !== value) fail(where, `${value} is not checksummed, expected ${checksummed}`);
}

function assertGeneration(where, generation) {
  assertKeys(where, generation, GENERATION_KEYS);
  const { deployedAt, sourceCommit, backend, seasons } = generation;
  if (typeof deployedAt !== "string" || new Date(deployedAt).toISOString() !== deployedAt) {
    fail(`${where}.deployedAt`, `${JSON.stringify(deployedAt)} is not an ISO 8601 UTC time`);
  }
  if (typeof sourceCommit !== "string" || !/^[0-9a-f]{40}$/.test(sourceCommit)) {
    fail(`${where}.sourceCommit`, `${JSON.stringify(sourceCommit)} is not a full git commit sha`);
  }
  if (!BACKENDS.includes(backend)) fail(`${where}.backend`, `${JSON.stringify(backend)} is not one of ${BACKENDS.join(", ")}`);
  for (const key of [...ACCOUNT_KEYS, ...CONTRACT_KEYS]) assertChecksummedAddress(`${where}.${key}`, generation[key]);
  if (seasons === null || typeof seasons !== "object" || Array.isArray(seasons)) fail(`${where}.seasons`, "is not an object");
  for (const [label, number] of Object.entries(seasons)) {
    if (!Number.isSafeInteger(number) || number < 1) fail(`${where}.seasons.${label}`, `${JSON.stringify(number)} is not a season number`);
  }
}

export function assertDeploymentRecord(record) {
  assertKeys("", record, RECORD_KEYS);
  if (typeof record.network !== "string" || !/^[a-z0-9-]+$/.test(record.network)) {
    fail(".network", `${JSON.stringify(record.network)} is not a lowercase network name`);
  }
  if (!Number.isSafeInteger(record.chainId) || record.chainId < 1) fail(".chainId", `${JSON.stringify(record.chainId)} is not a chain id`);
  if (!Array.isArray(record.generations) || record.generations.length === 0) fail(".generations", "is not a non-empty list");
  record.generations.forEach((generation, index) => assertGeneration(`.generations[${index}]`, generation));
  for (let index = 1; index < record.generations.length; index++) {
    if (record.generations[index].deployedAt > record.generations[index - 1].deployedAt) {
      fail(`.generations[${index}]`, "is newer than the generation before it: generations are listed newest first");
    }
  }
}

export function readDeploymentRecord(file) {
  const record = JSON.parse(readFileSync(file, "utf8"));
  assertDeploymentRecord(record);
  if (`${record.network}.json` !== basename(file)) fail(".network", `${record.network} does not name the file ${file}`);
  return record;
}

/** Writes `generation` as the newest of `file`'s generations, keeping the earlier ones as they are. */
export function prependGeneration(file, network, chainId, generation) {
  const earlier = existsSync(file) ? readDeploymentRecord(file) : { network, chainId, generations: [] };
  if (earlier.chainId !== chainId) fail(".chainId", `${file} records chain ${earlier.chainId}, not chain ${chainId}`);
  const record = { network, chainId, generations: [generation, ...earlier.generations] };
  assertDeploymentRecord(record);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  readDeploymentRecord(file);
  return record;
}

// Node resolves symlinks in a main module's URL but not in argv[1], so both are compared as realpaths.
export function isEntryPoint(moduleUrl) {
  return process.argv[1] !== undefined && realpathSync(fileURLToPath(moduleUrl)) === realpathSync(process.argv[1]);
}

if (isEntryPoint(import.meta.url)) {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("usage: node deployments.mjs <deployments/<network>.json>...");
  for (const file of files) {
    const { generations } = readDeploymentRecord(file);
    console.log(`${file}: matches the schema, ${generations.length} generation(s)`);
  }
}
