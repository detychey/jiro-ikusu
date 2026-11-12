// The probe page (plan M3.12): its clock probe on a fake clock, the open field's 2,700 ticks
// through createLoop, with A3's count of the ticks due and not yet run before each frame's pump;
// the frame gaps its log records, on either clock; and a touch's distance from a side edge.

import { describe, expect, it } from "vitest";
import { type ClockEnv, clockProbe, edgeDistance, frameGap } from "../src/pages/probe";
import { loadEngine } from "./drive";

const core = await loadEngine();

/** A clock whose frame `n` comes `gapMs(n)` after the one before; the page is hidden once just
 *  before frame `hiddenAt`. */
function fakeClock(gapMs: (frame: number) => number, hiddenAt = -1): ClockEnv {
  let time = 1_000;
  let frame = 0;
  let hides = 0;
  return {
    now: () => time,
    frame: async () => {
      time += gapMs(frame);
      if (frame === hiddenAt) hides += 1;
      frame += 1;
    },
    hides: () => hides,
    pumped: () => undefined,
  };
}

describe("the clock probe", () => {
  it("plays 2,700 ticks to the time limit, at most one tick behind at 60 frames a second, and A3 holds", async () => {
    const result = await clockProbe(core, fakeClock(() => 1000 / 60));
    expect([result.ticksRun, result.endReason, result.maxBehind, result.hides, result.a3]).toEqual([2700, "Time limit", 1, 0, true]);
  });

  it("counts 3 ticks behind after a 200-ms frame gap, and A3 fails", async () => {
    const result = await clockProbe(core, fakeClock((frame) => (frame === 100 ? 200 : 1000 / 60)));
    expect([result.maxBehind, result.behind[3], result.a3]).toEqual([3, 1, false]);
  });

  it("does not hold A3 for a run the page was hidden in", async () => {
    const result = await clockProbe(core, fakeClock(() => 1000 / 60, 100));
    expect([result.maxBehind, result.hides, result.a3]).toEqual([1, 1, false]);
  });
});

describe("the probe's frame gaps", () => {
  it("records a gap that only Date.now() saw, as when performance.now() stops during a sleep", () => {
    expect(frameGap({ perfMs: 5_000, dateMs: 1_000_000 }, { perfMs: 5_016.7, dateMs: 1_060_017 })).toEqual({ perfMs: 17, dateMs: 60_017 });
  });

  it("records a gap that both clocks saw", () => {
    expect(frameGap({ perfMs: 5_000, dateMs: 1_000_000 }, { perfMs: 6_500.4, dateMs: 1_001_500 })).toEqual({ perfMs: 1_500, dateMs: 1_500 });
  });

  it("records no gap of 1,000 ms or less on both clocks", () => {
    expect(frameGap({ perfMs: 5_000, dateMs: 1_000_000 }, { perfMs: 6_000, dateMs: 1_001_000 })).toBeUndefined();
  });
});

describe("a touch's distance from a side edge", () => {
  it("measures a touch on the left half from the left edge", () => {
    expect(edgeDistance(12.4, 412)).toEqual({ edge: "left", px: 12 });
  });

  it("measures a touch on the right half from the right edge", () => {
    expect(edgeDistance(400.2, 412)).toEqual({ edge: "right", px: 12 });
  });
});
