// Replays every vector of a vectors directory through jiro-wasm (plan M1.11) and exits
// non-zero on any mismatch with the native core's recorded results.
// - format/journal-*: each journal is replayed on the open-field level; a malformed one must be
//   rejected with its recorded code, a valid one must pass the decoder (no code 1 to 11).
// - format/level-*: validate_level, load_level and replay (with a journal for that level's id)
//   must return the recorded code, or accept a valid level with its recorded id.
// - game/* and levels/* (the gate set of plan §4): replay must give the recorded Outcome or
//   error, and the trace tick for tick. Each game that ends is also played live through
//   load_level, start and tick, which must give the same per-tick state hashes and the vector's
//   journal bytes. On a trace mismatch the runner names the first differing tick and prints the
//   wasm state preimage at that tick, for `jiro-tools replay --diff`.
// Usage: node web/test/vectors.mjs <vectors dir> [jiro_wasm.wasm]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const WASM_DEFAULT = join(
  process.env.CARGO_TARGET_DIR ?? new URL("../../target", import.meta.url).pathname,
  "wasm32-unknown-unknown/release/jiro_wasm.wasm",
);
const HASH_LEN = 32;
const LEVEL_ID_AT = 36;

const [vectorsDir, wasmPath = WASM_DEFAULT] = process.argv.slice(2);
if (!vectorsDir) {
  console.error("usage: node web/test/vectors.mjs <vectors dir> [jiro_wasm.wasm]");
  process.exit(2);
}

const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
const wasm = instance.exports;
const memory = (ptr, len) => new Uint8Array(wasm.memory.buffer, ptr, len);
const hex = (bytes) => "0x" + Buffer.from(bytes).toString("hex");
const bytes = (text) => Uint8Array.from(Buffer.from(text.replace(/^0x/, ""), "hex"));
const be = (bytes) => bytes.reduce((value, byte) => value * 256 + byte, 0);

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

function readVectors(kind) {
  const dir = join(vectorsDir, kind);
  if (!existsSync(dir)) throw new Error(`${dir} not found`);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ file: `${kind}/${name}`, vector: JSON.parse(readFileSync(join(dir, name), "utf8")) }));
}

const failures = [];
const fail = (file, message) => failures.push(`${file}: ${message}`);
const expectCode = (file, call, actual, expected) => {
  if (actual !== expected) fail(file, `${call} returns ${actual}, the vector records ${expected}`);
};

const formats = readVectors("format");
const fixture = (name) => {
  const found = formats.find(({ file }) => file === `format/${name}.json`);
  if (!found) throw new Error(`format/${name}.json not found: the runner pairs vectors with it`);
  return bytes(found.vector.input);
};
const openField = fixture("level-open-field");
const openFieldJournal = fixture("journal-open-field-empty");

/** The open-field-empty journal, made to name another level id. */
const journalFor = (levelId) => {
  const journal = openFieldJournal.slice();
  journal.set(levelId, LEVEL_ID_AT);
  return journal;
};

for (const { file, vector } of formats) {
  const given = bytes(vector.input);
  if (vector.kind === "journal") {
    const code = wasm.replay(...input(openField, given), 10_000);
    if ("error" in vector) expectCode(file, "replay", code, vector.error);
    else if (code >= 1 && code <= 11) fail(file, `replay rejects a valid journal with code ${code}`);
  } else if (vector.kind === "level") {
    const expected = vector.error ?? 0;
    expectCode(file, "validate_level", wasm.validate_level(...input(given)), expected);
    expectCode(file, "load_level", wasm.load_level(...input(given)), expected);
    const levelId = "levelId" in vector ? bytes(vector.levelId) : new Uint8Array(HASH_LEN);
    expectCode(file, "replay", wasm.replay(...input(given, journalFor(levelId)), 10_000), expected);
    if (expected === 0) {
      const replayedId = hex(memory(wasm.outcome_ptr() + HASH_LEN, HASH_LEN));
      if (replayedId !== vector.levelId) fail(file, `replay gives levelId ${replayedId}, the vector records ${vector.levelId}`);
    }
  } else {
    fail(file, `unknown kind ${vector.kind}`);
  }
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

function firstDifferingTick(computed, recorded) {
  const ticks = Math.max(computed.length, recorded.length) / HASH_LEN;
  for (let tick = 0; tick < ticks; tick++) {
    const a = computed.subarray(tick * HASH_LEN, (tick + 1) * HASH_LEN);
    const b = recorded.subarray(tick * HASH_LEN, (tick + 1) * HASH_LEN);
    if (a.length !== b.length || a.some((byte, i) => byte !== b[i])) return tick;
  }
  return -1;
}

function reportTrace(file, tick, level, journal, weightBp) {
  wasm.replay_preimage(...input(level, journal), weightBp, tick);
  fail(file, `trace differs from tick ${tick}; wasm state preimage at tick ${tick}: ${hex(memory(wasm.preimage_ptr(), wasm.preimage_len()))}`);
}

/** The journal's events as a map from tick to mask (README §6.3). */
function events(journal) {
  const count = be(journal.subarray(69, 71));
  const masks = new Map();
  for (let k = 0; k < count; k++) {
    const at = 71 + 3 * k;
    masks.set(be(journal.subarray(at, at + 2)), journal[at + 2]);
  }
  return masks;
}

/** Plays the journal live through load_level, start and tick, against the recorded trace. */
function playLive(file, vector, level, journal, recorded) {
  expectCode(file, "load_level", wasm.load_level(...input(level)), 0);
  input(bytes(vector.runNonce));
  expectCode(file, "start", wasm.start(vector.mode, vector.levelIndex), 0);
  const masks = events(journal);
  let mask = 0;
  let tick = 0;
  for (; wasm.end_reason() === 0; tick++) {
    if (tick * HASH_LEN >= recorded.length) return fail(file, `live play runs past the ${recorded.length / HASH_LEN} recorded ticks`);
    mask = masks.get(tick) ?? mask;
    const code = wasm.tick(mask);
    if (code !== 0) return fail(file, `tick ${tick} returns ${code}`);
    const live = memory(wasm.state_hash(), HASH_LEN);
    if (firstDifferingTick(live, recorded.subarray(tick * HASH_LEN, (tick + 1) * HASH_LEN)) !== -1) {
      return fail(file, `live play differs from tick ${tick}; wasm state preimage: ${hex(memory(wasm.state_preimage(), wasm.preimage_len()))}`);
    }
  }
  const recordedJournal = hex(memory(wasm.journal_ptr(), wasm.journal_len()));
  if (recordedJournal !== vector.journal) fail(file, `the Recorder's journal ${recordedJournal} differs from the vector's`);
  if (tick * HASH_LEN !== recorded.length) fail(file, `live play ends after ${tick} ticks, the trace has ${recorded.length / HASH_LEN}`);
  // The getters the browser's HUD and end screen read.
  const live = { endReason: wasm.end_reason(), claimBp: wasm.claim_bp(), ticksUsed: wasm.ticks_used() };
  for (const [key, value] of Object.entries(live)) {
    if (value !== vector.outcome[key]) fail(file, `live ${key}: wasm ${value}, vector ${vector.outcome[key]}`);
  }
}

const games = [...readVectors("game"), ...readVectors("levels")];
for (const { file, vector } of games) {
  const level = bytes(vector.level);
  const journal = bytes(vector.journal);
  const recorded = Uint8Array.from(readFileSync(join(vectorsDir, dirname(file), vector.trace)));
  if (vector.rulesVersion !== wasm.rules_version()) fail(file, `rulesVersion ${vector.rulesVersion}, the wasm core has ${wasm.rules_version()}`);
  const code = wasm.replay(...input(level, journal), vector.weightBp);
  if ("error" in vector) {
    expectCode(file, "replay", code, vector.error);
  } else if (code !== 0) {
    fail(file, `replay returns ${code}, the vector records an Outcome`);
  } else {
    const replayed = outcome();
    for (const [key, value] of Object.entries(vector.outcome)) {
      if (replayed[key] !== value) fail(file, `field outcome.${key}: wasm ${replayed[key]}, vector ${value}`);
    }
  }
  const computed = memory(wasm.trace_ptr(), wasm.trace_ticks() * HASH_LEN).slice();
  const tick = firstDifferingTick(computed, recorded);
  if (tick !== -1) reportTrace(file, tick, level, journal, vector.weightBp);
  else if (!("error" in vector)) playLive(file, vector, level, journal, recorded);
}

for (const failure of failures) console.error(failure);
console.log(`jiro-wasm: ${formats.length} format vectors and ${games.length} game vectors, ${failures.length} mismatches`);
process.exit(failures.length ? 1 : 0);
