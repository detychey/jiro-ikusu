import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Core, fromHex, hex } from "../src/core";
import { type Bindings, type Control, CONTROLS, CONTROL_BITS, DEFAULT_BINDINGS, HeldKeys, rebind } from "../src/input";
import { TICK_HZ } from "../src/loop";
import { startSession } from "../src/session";

const repo = new URL("../../", import.meta.url);
const wasm = readFileSync(new URL("target/wasm32-unknown-unknown/release/jiro_wasm.wasm", repo));
const openField = fromHex(JSON.parse(readFileSync(new URL("vectors/format/level-open-field.json", repo), "utf8")).input);

interface GameVector {
  level: string;
  runNonce: string;
  levelIndex: number;
  mode: number;
  journal: string;
  trace: string;
}

function vector(name: string): GameVector {
  return JSON.parse(readFileSync(new URL(`vectors/game/${name}.json`, repo), "utf8"));
}

/** The controls held on each tick, from a journal's events (README §6.2). */
function schedule(journal: Uint8Array): Map<number, Control[]> {
  const count = (journal[69] ?? 0) * 256 + (journal[70] ?? 0);
  const events = new Map<number, Control[]>();
  for (let i = 0; i < count; i += 1) {
    const at = 71 + 3 * i;
    const tick = (journal[at] ?? 0) * 256 + (journal[at + 1] ?? 0);
    const mask = journal[at + 2] ?? 0;
    events.set(tick, CONTROLS.filter((control) => (mask & CONTROL_BITS[control]) !== 0));
  }
  return events;
}

/** Plays `level` on a fake clock: before tick k is due, the keys of `controlsAt(k)` (if any)
 *  replace the keys held, under `bindings`. Returns the journal and the final state hash. */
async function play(
  level: Uint8Array,
  runNonce: Uint8Array,
  bindings: Bindings,
  controlsAt: (tick: number) => Control[] | undefined,
): Promise<{ journal: Uint8Array; hash: string }> {
  const core = await Core.load(wasm);
  const keys = new HeldKeys(bindings);
  let time = 5_000;
  const t0 = time;
  const loop = startSession(core, level, runNonce, keys, () => time);
  for (let tick = 0; ; tick += 1) {
    const controls = controlsAt(tick);
    if (controls !== undefined) {
      keys.clear();
      for (const control of controls) keys.down(bindings[control]);
    }
    time = t0 + (tick * 1000) / TICK_HZ + 1;
    if (loop.pump() !== undefined) break;
    expect(loop.ticksRun).toBe(tick + 1);
  }
  return { journal: core.journal(), hash: hex(core.stateHash()) };
}

async function playVector(name: string) {
  const recorded = vector(name);
  expect([recorded.mode, recorded.levelIndex]).toEqual([0, 0]);
  const events = schedule(fromHex(recorded.journal));
  return play(fromHex(recorded.level), fromHex(recorded.runNonce), DEFAULT_BINDINGS, (tick) => events.get(tick));
}

function finalHash(name: string): string {
  const trace = readFileSync(new URL(`vectors/game/${vector(name).trace}`, repo));
  return hex(trace.subarray(trace.length - 32));
}

/** A scripted Training run on the open-field level: a cut up, left and down that captures, then
 *  a commit. */
const SCRIPT: [number, Control[]][] = [
  [0, ["up"]],
  [10, ["left"]],
  [20, ["down", "a"]],
  [32, []],
  [40, ["x"]],
];
const scripted = (tick: number) => SCRIPT.find(([at]) => at === tick)?.[1];

describe("play", () => {
  it.each(["open-field-empty", "open-field-capture"])("reproduces the journal and final hash of %s from its keys", async (name) => {
    const { journal, hash } = await playVector(name);
    expect([hex(journal), hash]).toEqual([vector(name).journal, finalHash(name)]);
  });

  it("gives the same journal bytes for the same controls after every control is rebound", async () => {
    let rebound: Bindings = DEFAULT_BINDINGS;
    for (const [index, control] of CONTROLS.entries()) {
      const next = rebind(rebound, control, `Digit${index}`);
      if (typeof next === "string") throw new Error(next);
      rebound = next;
    }
    const nonce = fromHex(vector("open-field-empty").runNonce);
    const [original, remapped] = await Promise.all([
      play(openField, nonce, DEFAULT_BINDINGS, scripted),
      play(openField, nonce, rebound, scripted),
    ]);
    expect(hex(remapped.journal)).toBe(hex(original.journal));
  });

  it("writes the journal and end-screen hash of a scripted run for native replay", async () => {
    const { journal, hash } = await play(openField, fromHex(vector("open-field-empty").runNonce), DEFAULT_BINDINGS, scripted);
    const out = new URL("out/", import.meta.url);
    mkdirSync(out, { recursive: true });
    writeFileSync(new URL("scripted.jrn", out), journal);
    writeFileSync(new URL("scripted.hash", out), `${hash}\n`);
    expect(journal.length).toBe(71 + 3 * SCRIPT.length);
  });
});
