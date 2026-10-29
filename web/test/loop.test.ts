import { describe, expect, it } from "vitest";
import { createLoop, TICK_HZ } from "../src/loop";

const tickMs = 1000 / TICK_HZ;

function fakeLoop() {
  let time = 1_000;
  const t0 = time;
  const ran: { tick: number; mask: number }[] = [];
  let sampled = 0;
  const loop = createLoop({
    now: () => time,
    sample: () => (sampled += 1),
    tick: (mask) => {
      ran.push({ tick: ran.length, mask });
      return undefined;
    },
  });
  const advanceTo = (t: number) => {
    time = t;
    loop.pump();
  };
  return { loop, ran, t0, advanceTo };
}

describe("loop", () => {
  it("runs floor((t - t0) / 66.667) + 1 ticks by time t after a 500 ms stall", () => {
    const { loop, t0, advanceTo } = fakeLoop();
    for (let t = t0; t <= t0 + 200; t += 16) advanceTo(t);
    const resumed = t0 + 200 + 500;
    advanceTo(resumed);
    expect(loop.ticksRun).toBe(Math.floor((resumed - t0) / tickMs) + 1);
  });

  it("runs each tick exactly once, in order, with its own sample, across a stall", () => {
    const { ran, t0, advanceTo } = fakeLoop();
    for (let t = t0; t <= t0 + 200; t += 16) advanceTo(t);
    advanceTo(t0 + 700);
    for (let t = t0 + 700; t <= t0 + 1_000; t += 16) advanceTo(t);
    expect(ran).toEqual(ran.map((_, k) => ({ tick: k, mask: k + 1 })));
  });

  it("runs tick 0 at t0 and tick k only once it is due", () => {
    const { loop, t0, advanceTo } = fakeLoop();
    advanceTo(t0);
    const atStart = loop.ticksRun;
    advanceTo(t0 + tickMs * 3 - 0.001);
    expect([atStart, loop.ticksRun]).toEqual([1, 3]);
  });

  it("stops stepping once the level has ended", () => {
    let time = 0;
    let steps = 0;
    const loop = createLoop({
      now: () => time,
      sample: () => 0,
      tick: () => ((steps += 1) === 2 ? "ended" : undefined),
    });
    time = 10_000;
    expect([loop.pump(), loop.pump(), steps]).toEqual(["ended", "ended", 2]);
  });
});
