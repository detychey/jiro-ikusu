// Plays a level through the page's session on a fake clock, as a player's keys or fingers would
// (README §6.2): before each tick is due, the controls of a journal or a script replace the keys
// held, or a test moves its fingers.

import { readdirSync, readFileSync } from "node:fs";
import { expect } from "vitest";
import { Core, hex } from "../src/core";
import { type Bindings, type Control, controlsOf, HeldKeys, type InputSource } from "../src/input";
import { journalEvents } from "../src/journal";
import { TICK_HZ } from "../src/loop";
import { startSession } from "../src/session";

export const repo = new URL("../../", import.meta.url);
const wasm = readFileSync(new URL("target/wasm32-unknown-unknown/release/jiro_wasm.wasm", repo));

/** The site's 16 levels by name, in index order, as `levels/` holds them. */
export const bundled: [string, Uint8Array][] = readdirSync(new URL("levels/", repo))
  .filter((file) => file.endsWith(".bin"))
  .sort()
  .map((file) => [file.replace(/\.bin$/, ""), readFileSync(new URL(`levels/${file}`, repo))]);

export function loadEngine(): Promise<Core> {
  return Core.load(wasm);
}

/** The controls held on each tick, from a journal's events (README §6.2). */
export function schedule(journal: Uint8Array): Map<number, Control[]> {
  return new Map(journalEvents(journal).map(({ tick, mask }) => [tick, controlsOf(mask)]));
}

/** A game vector of `vectors/game/` (README §6.6), by name. */
export interface GameVector {
  level: string;
  runNonce: string;
  levelIndex: number;
  mode: number;
  journal: string;
  trace: string;
}

export function vector(name: string): GameVector {
  return JSON.parse(readFileSync(new URL(`vectors/game/${name}.json`, repo), "utf8"));
}

/** The state hash of the vector's last tick, from its trace. */
export function finalHash(name: string): string {
  const trace = readFileSync(new URL(`vectors/game/${vector(name).trace}`, repo));
  return hex(trace.subarray(trace.length - 32));
}

/** Plays `level` on `core` on a fake clock: before tick k is due, the keys of `controlsAt(k)`
 *  (if any) replace the keys held, under `bindings`. Returns the journal and the final state
 *  hash. */
export function play(
  core: Core,
  level: Uint8Array,
  runNonce: Uint8Array,
  bindings: Bindings,
  controlsAt: (tick: number) => Control[] | undefined,
): { journal: Uint8Array; hash: string } {
  const keys = new HeldKeys(bindings);
  return playInput(core, level, runNonce, keys, (tick) => {
    const controls = controlsAt(tick);
    if (controls === undefined) return;
    keys.clear();
    for (const control of controls) keys.down(bindings[control]);
  });
}

/** Plays `level` on `core` on a fake clock, sampling `input`, after `beforeTick(k)` ran before tick
 *  k is due. Returns the journal and the final state hash. */
export function playInput(
  core: Core,
  level: Uint8Array,
  runNonce: Uint8Array,
  input: InputSource,
  beforeTick: (tick: number) => void,
): { journal: Uint8Array; hash: string } {
  let time = 5_000;
  const t0 = time;
  const loop = startSession(core, level, runNonce, input, () => time);
  for (let tick = 0; ; tick += 1) {
    beforeTick(tick);
    time = t0 + (tick * 1000) / TICK_HZ + 1;
    if (loop.pump() !== undefined) break;
    expect(loop.ticksRun).toBe(tick + 1);
  }
  return { journal: core.journal(), hash: hex(core.stateHash()) };
}
