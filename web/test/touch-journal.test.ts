// A2 (docs/PHONE.md §9.2): open-field-capture's controls, played as fingers on the touch controls
// through synthetic pointer events, through the session's loop and the core's Recorder, give the
// vector's journal bytes and final hash, as its keys do in play.test.ts. The finger on X goes
// down xHold ticks before the tick X enters the journal, for each xHold M3.14 chooses from.

import { describe, expect, it } from "vitest";
import { fromHex, hex } from "../src/core";
import { CONTROL_BITS, controlsOf } from "../src/input";
import { journalEvents } from "../src/journal";
import { type Point, TOUCH_DEFAULTS } from "../src/touch";
import { finalHash, loadEngine, playInput, vector } from "./drive";
import { centerOf, fingers } from "./fingers";

const VECTOR = "open-field-capture";
const STICK = 1;
const X_FINGER = 2;
const ORIGIN = centerOf("stick");
/** Where the stick's finger goes for each direction: 32 px from the origin, on its axis. */
const REACH: Record<string, Point> = {
  up: { x: ORIGIN.x, y: ORIGIN.y - 32 },
  down: { x: ORIGIN.x, y: ORIGIN.y + 32 },
  left: { x: ORIGIN.x - 32, y: ORIGIN.y },
  right: { x: ORIGIN.x + 32, y: ORIGIN.y },
};

describe("touch journal equivalence", () => {
  it.each([0, 2, 4, 8])(`reproduces the journal and final hash of ${VECTOR} by touch, at xHold %i`, async (xHold) => {
    const recorded = vector(VECTOR);
    const events = journalEvents(fromHex(recorded.journal));
    const commit = events.at(-1);
    expect(commit?.mask).toBe(CONTROL_BITS.x);
    const commitTick = commit?.tick ?? 0;
    const directions = new Map(events.slice(0, -1).map(({ tick, mask }) => [tick, controlsOf(mask)]));
    const hand = fingers({ ...TOUCH_DEFAULTS, xHold });
    const played = playInput(await loadEngine(), fromHex(recorded.level), fromHex(recorded.runNonce), hand.controls, (tick) => {
      const [direction, ...others] = directions.get(tick) ?? [];
      if (direction !== undefined) {
        const reach = REACH[direction];
        if (reach === undefined || others.length > 0) throw new Error(`${VECTOR} holds ${direction} ${others} at tick ${tick}`);
        if (hand.controls.stickAt === undefined) hand.down(STICK, ORIGIN);
        hand.move(STICK, reach);
      }
      if (tick === commitTick - xHold) hand.down(X_FINGER, centerOf("x"));
      if (tick === commitTick) hand.up(STICK);
    });
    expect([hex(played.journal), played.hash]).toEqual([recorded.journal, finalHash(VECTOR)]);
  });
});
