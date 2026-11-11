// @ts-check
// The replay of the golden vectors (README §6.6) through jiro-wasm, shared by the Node runner
// web/test/vectors.mjs (plan M1.11) and the vectors page (plan M3.12). Plain JavaScript that reads
// no file, so that Node runs it as it is and Vite bundles it: the caller hands it the vectors and
// each game vector's recorded trace.
// - format/journal-*: each journal is replayed on the open-field level; a malformed one must be
//   rejected with its recorded code, a valid one must pass the decoder (no code 1 to 11).
// - format/level-*: validate_level, load_level and replay (with a journal for that level's id)
//   must return the recorded code, or accept a valid level with its recorded id.
// - game/* and levels/* (the gate set of plan §4): replay must give the recorded Outcome or
//   error, and the trace tick for tick. Each game that ends is also played live through
//   load_level, start and tick, which must give the same per-tick state hashes and the vector's
//   journal bytes. On a trace mismatch the failure names the first differing tick and carries the
//   wasm state preimage at that tick, for `jiro-tools replay --diff`.

export const HASH_LEN = 32;
const LEVEL_ID_AT = 36;

/** @typedef {{ memory: WebAssembly.Memory, [name: string]: any }} WasmExports */
/** @typedef {ReturnType<typeof bindWasm>} Engine */
/** A vector, with its path under vectors/, such as `game/fast-cut.json`.
 *  @typedef {{ file: string, vector: any }} NamedVector */
/** A disagreement with a vector, with the tick a trace first differs at.
 *  @typedef {{ file: string, message: string, tick?: number }} Failure */

/** @param {Uint8Array} bytes */
export const hex = (bytes) => "0x" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** @param {string} text a byte string in hex, with or without its 0x */
export function bytes(text) {
  const digits = text.replace(/^0x/, "");
  if (digits.length % 2 !== 0 || /[^0-9a-f]/i.test(digits)) throw new Error(`not hex: ${text}`);
  return Uint8Array.from({ length: digits.length / 2 }, (_, i) => parseInt(digits.slice(2 * i, 2 * i + 2), 16));
}

/** A big-endian unsigned integer. @param {Uint8Array} bytes */
export const be = (bytes) => bytes.reduce((value, byte) => value * 256 + byte, 0);

/** jiro-wasm's exports, with the moves of bytes in and out of its memory.
 *  @param {WasmExports} wasm */
export function bindWasm(wasm) {
  /** @param {number} ptr @param {number} len */
  const memory = (ptr, len) => new Uint8Array(wasm.memory.buffer, ptr, len);

  /** Writes the byte strings side by side into the input buffer and returns their lengths.
   *  @param {...Uint8Array} parts */
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

  /** The Outcome of README §7.3 from the 110 bytes of outcome_ptr.
   *  @returns {Record<string, string | number>} */
  function outcome() {
    const at = memory(wasm.outcome_ptr(), 110);
    return {
      journalHash: hex(at.subarray(0, 32)),
      levelId: hex(at.subarray(32, 64)),
      runNonce: hex(at.subarray(64, 96)),
      levelIndex: be(at.subarray(96, 97)),
      drawSlot: be(at.subarray(97, 98)),
      mode: be(at.subarray(98, 99)),
      rulesVersion: be(at.subarray(99, 101)),
      endReason: be(at.subarray(101, 102)),
      claimBp: be(at.subarray(102, 104)),
      ticksUsed: be(at.subarray(104, 106)),
      levelScore: be(at.subarray(106, 110)),
    };
  }

  /** The state hashes of every tick of the last replay. */
  const trace = () => memory(wasm.trace_ptr(), wasm.trace_ticks() * HASH_LEN);

  return { wasm, memory, input, outcome, trace };
}

/** The failures of one check, and the ways to record one. */
function failures() {
  /** @type {Failure[]} */
  const found = [];
  /** @param {string} file @param {string} message @param {number} [tick] */
  const fail = (file, message, tick) => {
    found.push(tick === undefined ? { file, message } : { file, message, tick });
  };
  /** @param {string} file @param {string} call @param {number} actual @param {number} expected */
  const expectCode = (file, call, actual, expected) => {
    if (actual !== expected) fail(file, `${call} returns ${actual}, the vector records ${expected}`);
  };
  return { found, fail, expectCode };
}

/** Checks the format vectors, among which must be the two that the checks pair the others with.
 *  @param {Engine} engine @param {NamedVector[]} formats @returns {Failure[]} */
export function checkFormats({ wasm, memory, input }, formats) {
  const { found, fail, expectCode } = failures();
  /** @param {string} name */
  const fixture = (name) => {
    const named = formats.find(({ file }) => file === `format/${name}.json`);
    if (!named) throw new Error(`format/${name}.json not found: the checks pair vectors with it`);
    return bytes(named.vector.input);
  };
  const openField = fixture("level-open-field");
  const openFieldJournal = fixture("journal-open-field-empty");

  /** The open-field-empty journal, made to name another level id. @param {Uint8Array} levelId */
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
  return found;
}

/** The first tick whose state hash differs, or -1. @param {Uint8Array} computed @param {Uint8Array} recorded */
export function firstDifferingTick(computed, recorded) {
  const ticks = Math.max(computed.length, recorded.length) / HASH_LEN;
  for (let tick = 0; tick < ticks; tick++) {
    const a = computed.subarray(tick * HASH_LEN, (tick + 1) * HASH_LEN);
    const b = recorded.subarray(tick * HASH_LEN, (tick + 1) * HASH_LEN);
    if (a.length !== b.length || a.some((byte, i) => byte !== b[i])) return tick;
  }
  return -1;
}

/** The journal's events as a map from tick to mask (README §6.3). @param {Uint8Array} journal */
function events(journal) {
  const count = be(journal.subarray(69, 71));
  const masks = new Map();
  for (let k = 0; k < count; k++) {
    const at = 71 + 3 * k;
    masks.set(be(journal.subarray(at, at + 2)), journal[at + 2]);
  }
  return masks;
}

/** Checks a game vector: its replay's Outcome or error, its trace tick for tick, then, for a game
 *  that ends, its live play. `recordedTrace` gives the vector's recorded trace; a caller that has
 *  matched the computed trace, which it is given, against the vector's digest may return it.
 *  @param {Engine} engine
 *  @param {NamedVector} named
 *  @param {(computed: Uint8Array) => Uint8Array | Promise<Uint8Array>} recordedTrace
 *  @returns {Promise<Failure[]>} */
export async function checkGame(engine, { file, vector }, recordedTrace) {
  const { wasm, memory, input, outcome, trace } = engine;
  const { found, fail, expectCode } = failures();
  const level = bytes(vector.level);
  const journal = bytes(vector.journal);
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
  const computed = trace().slice();
  const recorded = await recordedTrace(computed);
  const tick = firstDifferingTick(computed, recorded);
  if (tick !== -1) {
    wasm.replay_preimage(...input(level, journal), vector.weightBp, tick);
    fail(file, `trace differs from tick ${tick}; wasm state preimage at tick ${tick}: ${hex(memory(wasm.preimage_ptr(), wasm.preimage_len()))}`, tick);
  } else if (!("error" in vector)) {
    playLive(engine, { fail, expectCode }, file, vector, level, journal, recorded);
  }
  return found;
}

/** Plays the journal live through load_level, start and tick, against the recorded trace.
 *  @param {Engine} engine
 *  @param {Omit<ReturnType<typeof failures>, "found">} report
 *  @param {string} file @param {any} vector
 *  @param {Uint8Array} level @param {Uint8Array} journal @param {Uint8Array} recorded */
function playLive({ wasm, memory, input }, { fail, expectCode }, file, vector, level, journal, recorded) {
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
      return fail(file, `live play differs from tick ${tick}; wasm state preimage: ${hex(memory(wasm.state_preimage(), wasm.preimage_len()))}`, tick);
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
