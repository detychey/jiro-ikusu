// Plays a level through the page's session on a fake clock, as a player's keys would (README
// §6.2): before each tick is due, the controls of a journal or a script replace the keys held.

import { readFileSync } from "node:fs";
import { expect } from "vitest";
import { Core, hex } from "../src/core";
import { type Bindings, type Control, controlsOf, HeldKeys } from "../src/input";
import { journalEvents } from "../src/journal";
import { TICK_HZ } from "../src/loop";
import { startSession } from "../src/session";

export const repo = new URL("../../", import.meta.url);
const wasm = readFileSync(new URL("target/wasm32-unknown-unknown/release/jiro_wasm.wasm", repo));

export function loadEngine(): Promise<Core> {
  return Core.load(wasm);
}

/** The controls held on each tick, from a journal's events (README §6.2). */
export function schedule(journal: Uint8Array): Map<number, Control[]> {
  return new Map(journalEvents(journal).map(({ tick, mask }) => [tick, controlsOf(mask)]));
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
