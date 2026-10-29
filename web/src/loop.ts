// The tick clock (README §4.4, §6.1): tick k is due at t0 + k × 1000 / 15 ms. Every due tick
// samples the controls once and steps once, in order; a late tick runs as soon as the loop runs
// again, so lateness never accumulates and no tick is skipped or stepped twice.

export const TICK_HZ = 15;

export interface LoopHooks<End> {
  /** The current time in milliseconds, as performance.now() reports it. */
  now(): number;
  /** The input mask held at this moment. */
  sample(): number;
  /** Steps one tick with `mask`; returns a value once the level has ended. */
  tick(mask: number): End | undefined;
}

export interface Loop<End> {
  /** Runs every tick that is due by now; returns the end once the level has ended. */
  pump(): End | undefined;
  readonly ticksRun: number;
}

export function createLoop<End>(hooks: LoopHooks<End>): Loop<End> {
  const t0 = hooks.now();
  let ticksRun = 0;
  let end: End | undefined;
  return {
    pump() {
      const due = Math.floor(((hooks.now() - t0) * TICK_HZ) / 1000) + 1;
      while (end === undefined && ticksRun < due) {
        end = hooks.tick(hooks.sample());
        ticksRun += 1;
      }
      return end;
    },
    get ticksRun() {
      return ticksRun;
    },
  };
}
