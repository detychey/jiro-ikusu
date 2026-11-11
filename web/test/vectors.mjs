// Replays every vector of a vectors directory through jiro-wasm (plan M1.11), with the checks of
// web/src/vectors.mjs, which the vectors page shares (plan M3.12), and exits non-zero on any
// mismatch with the native core's recorded results. A game vector's trace is compared whole.
// Usage: node web/test/vectors.mjs <vectors dir> [jiro_wasm.wasm]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkFormats, checkGame } from "../src/vectors.mjs";
import { WASM_DEFAULT, loadWasm } from "./wasm.mjs";

const [vectorsDir, wasmPath = WASM_DEFAULT] = process.argv.slice(2);
if (!vectorsDir) {
  console.error("usage: node web/test/vectors.mjs <vectors dir> [jiro_wasm.wasm]");
  process.exit(2);
}

const engine = await loadWasm(wasmPath);

function readVectors(kind) {
  const dir = join(vectorsDir, kind);
  if (!existsSync(dir)) throw new Error(`${dir} not found`);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ file: `${kind}/${name}`, vector: JSON.parse(readFileSync(join(dir, name), "utf8")) }));
}

const formats = readVectors("format");
const failures = checkFormats(engine, formats);

const games = [...readVectors("game"), ...readVectors("levels")];
for (const named of games) {
  const recorded = Uint8Array.from(readFileSync(join(vectorsDir, dirname(named.file), named.vector.trace)));
  failures.push(...(await checkGame(engine, named, () => recorded)));
}

for (const { file, message } of failures) console.error(`${file}: ${message}`);
console.log(`jiro-wasm: ${formats.length} format vectors and ${games.length} game vectors, ${failures.length} mismatches`);
process.exit(failures.length ? 1 : 0);
