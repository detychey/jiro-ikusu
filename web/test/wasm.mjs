// The jiro-wasm loader of the Node runners, web/test/vectors.mjs and web/test/difffuzz.mjs: reads
// and instantiates the module, bound by web/src/vectors.mjs, which moves bytes in and out of its
// memory.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bindWasm } from "../src/vectors.mjs";

export { bytes } from "../src/vectors.mjs";

export const WASM_DEFAULT = join(
  process.env.CARGO_TARGET_DIR ?? new URL("../../target", import.meta.url).pathname,
  "wasm32-unknown-unknown/release/jiro_wasm.wasm",
);

export async function loadWasm(wasmPath) {
  const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
  return bindWasm(instance.exports);
}
