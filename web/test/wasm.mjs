// The jiro-wasm loader of the Node runners, web/test/vectors.mjs and web/test/difffuzz.mjs:
// instantiates the module and moves bytes in and out of its memory.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const WASM_DEFAULT = join(
  process.env.CARGO_TARGET_DIR ?? new URL("../../target", import.meta.url).pathname,
  "wasm32-unknown-unknown/release/jiro_wasm.wasm",
);
export const HASH_LEN = 32;

export const hex = (bytes) => "0x" + Buffer.from(bytes).toString("hex");
export const bytes = (text) => Uint8Array.from(Buffer.from(text.replace(/^0x/, ""), "hex"));
export const be = (bytes) => bytes.reduce((value, byte) => value * 256 + byte, 0);

export async function loadWasm(wasmPath) {
  const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
  const wasm = instance.exports;
  const memory = (ptr, len) => new Uint8Array(wasm.memory.buffer, ptr, len);

  /** Writes the byte strings side by side into the input buffer and returns their lengths. */
  function input(...parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    if (total > wasm.input_capacity()) throw new Error(`input of ${total} bytes exceeds the buffer`);
    let at = 0;
    for (const part of parts) {
      memory(wasm.input_ptr() + at, part.length).set(part);
      at += part.length;
    }
    return parts.map((part) => part.length);
  }

  /** The Outcome of README §7.3 from the 110 bytes of outcome_ptr. */
  function outcome() {
    const at = memory(wasm.outcome_ptr(), 110);
    return {
      journalHash: hex(at.subarray(0, 32)),
      levelId: hex(at.subarray(32, 64)),
      runNonce: hex(at.subarray(64, 96)),
      levelIndex: at[96],
      drawSlot: at[97],
      mode: at[98],
      rulesVersion: be(at.subarray(99, 101)),
      endReason: at[101],
      claimBp: be(at.subarray(102, 104)),
      ticksUsed: be(at.subarray(104, 106)),
      levelScore: be(at.subarray(106, 110)),
    };
  }

  /** The state hashes of every tick of the last replay. */
  const trace = () => memory(wasm.trace_ptr(), wasm.trace_ticks() * HASH_LEN);

  return { wasm, memory, input, outcome, trace };
}
