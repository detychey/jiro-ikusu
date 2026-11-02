// Measures the deployed Stylus referee on a Nitro node (plan M4.2, README §7.3). For each game
// vector and each gate-set vector, eth_call of verify must return the vector's Outcome, or revert
// with its `replay error <code>`, and eth_estimateGas of verify gives its gas. On each fixed
// difffuzz case, eth_call of verify must return native's Outcome. The gas table goes between
// log markers and into the job summary ($GITHUB_STEP_SUMMARY), then any mismatch exits 1. A gas
// figure above the 1M gate is a warning, not a failure.
// Usage: node stylus-gas.mjs --rpc <url> --referee <address> <vectors dir> <difffuzz dir>
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Contract, JsonRpcProvider } from "ethers";

const GAS_GATE = 1_000_000n;
const REFEREE_ABI = JSON.parse(readFileSync(new URL("../../contracts/abi/IReferee.json", import.meta.url), "utf8"));
const NO_PROOF = "0x";

function readJsonDir(dir) {
  if (!existsSync(dir)) throw new Error(`${dir} not found`);
  const files = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  if (files.length === 0) throw new Error(`${dir} holds no JSON file`);
  return files.map((name) => ({ file: join(dir, name), vector: JSON.parse(readFileSync(join(dir, name), "utf8")) }));
}

/** The Outcome as a vector records it (README §6.6, §7.3). */
function recorded(outcome) {
  return Object.fromEntries(
    Object.entries(outcome.toObject()).map(([field, value]) => [field, typeof value === "bigint" ? Number(value) : value]),
  );
}

/** What verify returns for the vector's inputs: its Outcome, or the reason it reverts with. */
async function verify(referee, vector) {
  try {
    return { outcome: recorded(await referee.verify.staticCall(vector.level, vector.journal, vector.weightBp, NO_PROOF)) };
  } catch (error) {
    if (error.code === "CALL_EXCEPTION" && error.revert?.name === "Error") return { reason: error.revert.args[0] };
    throw error;
  }
}

function expected(vector) {
  return vector.error === undefined ? { outcome: vector.outcome } : { reason: `replay error ${vector.error}` };
}

function mismatch(actual, wanted) {
  if (wanted.reason !== undefined || actual.reason !== undefined) {
    return actual.reason === wanted.reason ? undefined : `returns ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`;
  }
  const fields = new Set([...Object.keys(actual.outcome), ...Object.keys(wanted.outcome)]);
  const differing = [...fields]
    .filter((field) => actual.outcome[field] !== wanted.outcome[field])
    .map((field) => `${field} ${actual.outcome[field]} (expected ${wanted.outcome[field]})`);
  return differing.length === 0 ? undefined : `Outcome differs: ${differing.join(", ")}`;
}

const journalBytes = (vector) => (vector.journal.length - 2) / 2;
const formatGas = (gas) => gas.toLocaleString("en-US");

function gasTable(rows) {
  const lines = ["| Vector | Ticks used | Journal bytes | Gas (eth_estimateGas) |", "|---|---:|---:|---:|"];
  for (const { name, vector, gas, reason } of rows) {
    const ticks = vector.outcome?.ticksUsed ?? "-";
    lines.push(`| ${name} | ${ticks} | ${journalBytes(vector)} | ${gas === undefined ? `reverts: ${reason}` : formatGas(gas)} |`);
  }
  return lines.join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({
    options: { rpc: { type: "string" }, referee: { type: "string" } },
    allowPositionals: true,
  });
  if (!values.rpc || !values.referee || positionals.length !== 2) {
    throw new Error("usage: node stylus-gas.mjs --rpc <url> --referee <address> <vectors dir> <difffuzz dir>");
  }
  const [vectorsDir, difffuzzDir] = positionals;
  const vectors = ["game", "levels"].flatMap((kind) =>
    readJsonDir(join(vectorsDir, kind)).map(({ file, vector }) => ({ name: `${kind}/${vector.name}`, file, vector })),
  );
  const cases = readJsonDir(difffuzzDir);

  const provider = new JsonRpcProvider(values.rpc, undefined, { staticNetwork: true });
  // getNetwork() first: it throws on an unreachable RPC, where other calls retry forever.
  const { chainId } = await provider.getNetwork();
  if ((await provider.getCode(values.referee)) === "0x") throw new Error(`${values.referee} has no code on chainId ${chainId}`);
  const referee = new Contract(values.referee, REFEREE_ABI, provider);
  const block = await provider.getBlockNumber();
  console.log(`chainId ${chainId}, block ${block}, referee ${values.referee}`);

  const failures = [];
  const rows = [];
  for (const row of vectors) {
    const actual = await verify(referee, row.vector);
    const problem = mismatch(actual, expected(row.vector));
    if (problem) failures.push(`${row.file}: ${problem}`);
    const gas = actual.outcome && (await referee.verify.estimateGas(row.vector.level, row.vector.journal, row.vector.weightBp, NO_PROOF));
    rows.push({ ...row, gas, reason: actual.reason });
  }
  for (const { file, vector } of cases) {
    const problem = mismatch(await verify(referee, vector), { outcome: vector.outcome });
    if (problem) failures.push(`${file}: ${problem}`);
  }

  const measured = rows.filter((row) => row.gas !== undefined);
  const max = measured.reduce((top, row) => (row.gas > top.gas ? row : top));
  const over = measured.filter((row) => row.gas > GAS_GATE).map((row) => row.name);
  const report = [
    gasTable(rows),
    "",
    `Maximum: ${formatGas(max.gas)} gas (${max.name}).`,
    `Above ${formatGas(GAS_GATE)} gas (a warning, not the gate): ${over.length === 0 ? "none" : over.join(", ")}.`,
    `Outcomes: ${rows.length} vectors and ${cases.length} difffuzz cases checked, ${failures.length} mismatches.`,
  ].join("\n");
  console.log(`=== BEGIN stylus-gas ===\n${report}\n=== END stylus-gas ===`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Stylus gas\n\n${report}\n`);
  provider.destroy();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`stylus-gas: ${failure}`);
    process.exit(1);
  }
}

await main();
