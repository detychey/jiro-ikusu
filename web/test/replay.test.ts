import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Core, CoreError, END_REASONS, fromHex, HASH_LEN, hex, type Outcome } from "../src/core";
import { describeError } from "../src/errors";
import { firstMismatch, heldControls, type Recording, ReplayView } from "../src/pages/replay";

const repo = new URL("../../", import.meta.url);
const core = await Core.load(readFileSync(new URL("target/wasm32-unknown-unknown/release/jiro_wasm.wasm", repo)));

interface Vector {
  input: string;
  level: string;
  journal: string;
  weightBp: number;
  outcome?: Record<string, string | number>;
  error?: number;
  trace: string;
}

function vectors(kind: string): { name: string; vector: Vector }[] {
  const dir = new URL(`vectors/${kind}/`, repo);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, vector: JSON.parse(readFileSync(new URL(name, dir), "utf8")) as Vector }));
}

const games = vectors("game");
const played = games.filter(({ vector }) => vector.outcome !== undefined);
const formats = vectors("format");
const format = (name: string) => formats.find((found) => found.name === `${name}.json`)?.vector.input ?? "";
const openField = fromHex(format("level-open-field"));
const openFieldJournal = fromHex(format("journal-open-field-empty"));

const recording = (vector: Vector): Recording => ({
  level: fromHex(vector.level),
  journal: fromHex(vector.journal),
  weightBp: vector.weightBp,
});

const trace = (vector: Vector) => new Uint8Array(readFileSync(new URL(`vectors/game/${vector.trace}`, repo)));

function open(given: Recording): ReplayView {
  const view = ReplayView.open(core, given);
  if ("code" in view) throw new Error(describeError(view.code));
  return view;
}

/** The Outcome as a game vector records it, with the end reason as its code (README §7.3). */
const recorded = (outcome: Outcome) => ({ ...outcome, endReason: END_REASONS.indexOf(outcome.endReason) + 1 });

function gameVector(name: string): Vector {
  const found = games.find((game) => game.name === `${name}.json`);
  if (found === undefined) throw new Error(`vectors/game/${name}.json not found`);
  return found.vector;
}

/** The state hash after each of 0 to `ticks` ticks, stepping from tick 0. */
function steppedHashes(view: ReplayView): string[] {
  view.seek(0);
  const hashes = [hex(view.hash())];
  while (view.tick < view.ticks) {
    view.step();
    hashes.push(hex(view.hash()));
  }
  return hashes;
}

const traceHashes = (bytes: Uint8Array) =>
  Array.from({ length: bytes.length / HASH_LEN }, (_, t) => hex(bytes.subarray(t * HASH_LEN, (t + 1) * HASH_LEN)));

describe("replay viewer", () => {
  it.each(played)("ends $name on the vector's final state hash and Outcome", ({ vector }) => {
    const view = open(recording(vector));
    view.seek(view.ticks);
    const expected = trace(vector);
    expect([hex(view.hash()), recorded(view.outcome)]).toEqual([
      hex(expected.subarray(expected.length - HASH_LEN)),
      vector.outcome,
    ]);
  });

  it.each(played)("plays $name tick by tick on the vector's trace", ({ vector }) => {
    expect(steppedHashes(open(recording(vector))).slice(1)).toEqual(traceHashes(trace(vector)));
  });

  it("plays a Challenge journal at level index 5 tick by tick on the core's trace", () => {
    const journal = fromHex(format("journal-challenge-level-5"));
    const view = open({ level: openField, journal, weightBp: 10_000 });
    expect([view.outcome.mode, view.outcome.levelIndex]).toEqual([1, 5]);
    expect(steppedHashes(view).slice(1)).toEqual(traceHashes(view.trace));
  });

  it.each(played)("gives the same state hash seeking to a tick of $name as stepping to it", ({ vector }) => {
    const view = open(recording(vector));
    const stepped = steppedHashes(view);
    const ticks = [view.ticks, 0, 1, Math.floor(view.ticks / 2), view.ticks - 1, Math.floor(view.ticks / 3)];
    const sought = ticks.map((tick) => {
      view.seek(tick);
      return hex(view.hash());
    });
    expect(sought).toEqual(ticks.map((tick) => stepped[tick]));
  });

  it.each(games.filter(({ vector }) => vector.error !== undefined))("shows the error code of $name", ({ vector }) => {
    expect(ReplayView.open(core, recording(vector))).toEqual({ code: vector.error });
  });

  it.each(formats.filter(({ name, vector }) => name.startsWith("journal-") && vector.error !== undefined))(
    "shows the error code of the malformed journal $name",
    ({ vector }) => {
      expect(ReplayView.open(core, { level: openField, journal: fromHex(vector.input), weightBp: 10_000 })).toEqual({
        code: vector.error,
      });
    },
  );

  it.each(formats.filter(({ name, vector }) => name.startsWith("level-") && vector.error !== undefined))(
    "shows the error code of the malformed level $name",
    ({ vector }) => {
      expect(ReplayView.open(core, { level: fromHex(vector.input), journal: openFieldJournal, weightBp: 10_000 })).toEqual({
        code: vector.error,
      });
    },
  );

  it("shows the code of a level too long for the engine's input buffer", () => {
    const level = new Uint8Array(20_000);
    level.set(openField);
    expect(ReplayView.open(core, { level, journal: openFieldJournal, weightBp: 10_000 })).toEqual({ code: 20 });
  });

  it("shows the code of a journal followed by more bytes than the engine's input buffer holds", () => {
    const journal = new Uint8Array(20_000);
    journal.set(openFieldJournal);
    expect(ReplayView.open(core, { level: openField, journal, weightBp: 10_000 })).toEqual({ code: 2 });
  });

  it.each([Number.NaN, -1, 65_536, 1.5])("refuses the weight %s", (weightBp) => {
    expect(() => core.replay(openField, openFieldJournal, weightBp)).toThrow(CoreError);
  });

  it("reports the first tick of a corrupted trace", () => {
    const vector = gameVector("worst-case");
    const corrupted = trace(vector).slice();
    corrupted[1_234 * HASH_LEN + 17] = (corrupted[1_234 * HASH_LEN + 17] ?? 0) ^ 1;
    expect(firstMismatch(open(recording(vector)).trace, corrupted)).toBe(1_234);
  });

  it("reports the end of a trace cut short", () => {
    const view = open(recording(gameVector("open-field-capture")));
    expect(firstMismatch(view.trace, view.trace.subarray(0, (view.ticks - 1) * HASH_LEN))).toBe(view.ticks - 1);
  });

  it("finds no mismatch in an equal trace", () => {
    const vector = gameVector("open-field-capture");
    expect(firstMismatch(open(recording(vector)).trace, trace(vector))).toBeUndefined();
  });

  it.each([
    [0, "none"],
    [0b1010_001, "up a x"],
  ])("names the controls the mask %i holds", (mask, names) => {
    expect(heldControls(mask)).toBe(names);
  });
});
