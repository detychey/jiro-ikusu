// One level in play in the browser: the core, the tick clock and the held keys, on the single
// input path (README §6.2): every due tick samples the controls once and goes through the
// core's Recorder.

import { Core, CoreError, type EndReason } from "./core";
import type { HeldKeys } from "./input";
import { createLoop, type Loop } from "./loop";

/** A Training run (README §8.1) at levelIndex 0. */
export const TRAINING = 0;

export function startSession(
  core: Core,
  level: Uint8Array,
  runNonce: Uint8Array,
  keys: HeldKeys,
  now: () => number,
): Loop<EndReason> {
  const code = core.loadLevel(level);
  if (code !== 0) throw new CoreError("load_level", code);
  core.start(runNonce, TRAINING, 0);
  return createLoop({ now, sample: () => keys.sample(), tick: (mask) => core.tick(mask) });
}

/** A Training run nonce: 32 random bytes, or `fixed` when the page asks for one. */
export function runNonce(fixed: Uint8Array | undefined): Uint8Array {
  return fixed ?? crypto.getRandomValues(new Uint8Array(32));
}
