// Replays M1.10's random cases, as `jiro-tools difffuzz` writes them, through jiro-wasm (plan
// M1.13): each case's replay must give the native core's Outcome and the keccak256 of its
// per-tick trace. A case that disagrees is copied to <cases dir>/mismatch/, named after the case,
// and its path printed; `jiro-tools replay --vector <that path>` replays it natively. Exits
// non-zero on any mismatch.
// Usage: node web/test/difffuzz.mjs <cases dir> [jiro_wasm.wasm]
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { keccak256 } from "ethers";
import { WASM_DEFAULT, bytes, loadWasm } from "./wasm.mjs";

const [casesDir, wasmPath = WASM_DEFAULT] = process.argv.slice(2);
if (!casesDir) {
  console.error("usage: node web/test/difffuzz.mjs <cases dir> [jiro_wasm.wasm]");
  process.exit(2);
}

const { wasm, input, outcome, trace } = await loadWasm(wasmPath);

/** Why wasm disagrees with the case's native results, or undefined when it agrees. */
function mismatch(vector) {
  const code = wasm.replay(...input(bytes(vector.level), bytes(vector.journal)), vector.weightBp);
  if (code !== 0) return `replay returns code ${code}, native records an Outcome`;
  const digest = keccak256(trace());
  if (digest !== vector.traceKeccak) return `traceKeccak: wasm ${digest}, native ${vector.traceKeccak}`;
  const replayed = outcome();
  for (const [key, value] of Object.entries(vector.outcome)) {
    if (replayed[key] !== value) return `outcome.${key}: wasm ${replayed[key]}, native ${value}`;
  }
}

const files = readdirSync(casesDir)
  .filter((name) => /^case-\d+\.json$/.test(name))
  .sort();
if (files.length === 0) throw new Error(`${casesDir} holds no case-*.json`);

let mismatches = 0;
for (const name of files) {
  const file = join(casesDir, name);
  const vector = JSON.parse(readFileSync(file, "utf8"));
  const reason = mismatch(vector);
  if (reason === undefined) continue;
  mismatches++;
  const saved = join(casesDir, "mismatch", `${vector.name}.json`);
  mkdirSync(join(casesDir, "mismatch"), { recursive: true });
  copyFileSync(file, saved);
  console.error(`mismatch: ${saved}: ${reason}`);
}
console.log(`jiro-wasm: ${files.length} difffuzz cases, ${mismatches} mismatches`);
process.exit(mismatches ? 1 : 0);
