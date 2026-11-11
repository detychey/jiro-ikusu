import { describe, expect, it } from "vitest";
import { CONTROL_BITS } from "../src/input";
import {
  loadTouchSetting,
  PAGE_RELEASES,
  POINTER_RELEASES,
  saveTouchSetting,
  stickBits,
  TOUCH_DEFAULTS,
  type TouchSetting,
} from "../src/touch";
import { centerOf, fingers } from "./fingers";

const { up: UP, down: DOWN, left: LEFT, right: RIGHT, a: A, b: B, x: X } = CONTROL_BITS;
const STICK = 1;
const BUTTON = 2;
const CENTER = centerOf("stick");
/** A point `dx`, `dy` px from the stick pad's center. */
const fromCenter = (dx: number, dy: number) => ({ x: CENTER.x + dx, y: CENTER.y + dy });

describe("the stick's directions", () => {
  it.each([
    [0, RIGHT],
    [30, RIGHT],
    [60, UP],
    [90, UP],
    [120, UP],
    [150, LEFT],
    [180, LEFT],
    [-150, LEFT],
    [-120, DOWN],
    [-90, DOWN],
    [-60, DOWN],
    [-30, RIGHT],
  ])("sends the nearest direction at %i degrees", (angle, bits) => {
    expect(stickBits(angle, 30, 0)).toBe(bits);
  });

  it("sends nothing inside the dead zone, even after a direction", () => {
    expect(stickBits(90, TOUCH_DEFAULTS.deadZone, UP)).toBe(0);
  });

  it("sends a direction just past the dead zone", () => {
    expect(stickBits(90, TOUCH_DEFAULTS.deadZone + 0.5, 0)).toBe(UP);
  });

  it.each([
    [40, RIGHT],
    [50, UP],
    [130, UP],
    [140, LEFT],
    [-140, LEFT],
    [-130, DOWN],
    [-50, DOWN],
    [-40, RIGHT],
  ])("in a diagonal band from rest, at %i degrees, sends the nearest direction alone", (angle, bits) => {
    expect(stickBits(angle, 30, 0)).toBe(bits);
  });

  it.each([
    [40, RIGHT, UP | RIGHT],
    [50, UP, UP | RIGHT],
    [35, RIGHT, UP | RIGHT],
    [55, UP | RIGHT, UP | RIGHT],
    [140, UP, UP | LEFT],
    [-140, DOWN, DOWN | LEFT],
    [-40, RIGHT, DOWN | RIGHT],
  ])("in a diagonal band at %i degrees, after mask %i, sends both adjacent directions", (angle, previous, bits) => {
    expect(stickBits(angle, 30, previous)).toBe(bits);
  });

  it.each([
    [40, LEFT, RIGHT],
    [40, DOWN, RIGHT],
    [50, DOWN, UP],
    [-130, UP, DOWN],
  ])("in a diagonal band at %i degrees, after mask %i on the other side, sends the nearest direction alone", (angle, previous, bits) => {
    expect(stickBits(angle, 30, previous)).toBe(bits);
  });

  it.each([
    [34, UP, RIGHT],
    [60, RIGHT, UP],
  ])("outside the bands, at %i degrees after mask %i, sends the nearest direction alone", (angle, previous, bits) => {
    expect(stickBits(angle, 30, previous)).toBe(bits);
  });

  it("starts at the point where the finger lands", () => {
    const hand = fingers();
    hand.down(STICK, fromCenter(-60, 60));
    hand.move(STICK, fromCenter(-60, 30));
    expect(hand.controls.sample()).toBe(UP);
  });

  it("follows a finger past the follow radius, so that a reversal costs little travel", () => {
    const hand = fingers();
    hand.down(STICK, CENTER);
    hand.move(STICK, fromCenter(60, 0));
    const right = hand.controls.sample();
    hand.move(STICK, fromCenter(-1, 0));
    expect([right, hand.controls.sample()]).toEqual([RIGHT, LEFT]);
  });

  it("keeps its origin while the finger stays within the follow radius", () => {
    const hand = fingers();
    hand.down(STICK, CENTER);
    hand.move(STICK, fromCenter(TOUCH_DEFAULTS.follow, 0));
    hand.controls.sample();
    hand.move(STICK, fromCenter(-1, 0));
    expect(hand.controls.sample()).toBe(0);
  });

  it("holds both directions while a finger drifts through a band it entered from one side", () => {
    const hand = fingers();
    hand.down(STICK, CENTER);
    hand.move(STICK, fromCenter(30, 0));
    const samples = [hand.controls.sample()];
    for (const degrees of [40, 50]) {
      const radians = (degrees * Math.PI) / 180;
      hand.move(STICK, fromCenter(30 * Math.cos(radians), -30 * Math.sin(radians)));
      samples.push(hand.controls.sample());
    }
    expect(samples).toEqual([RIGHT, UP | RIGHT, UP | RIGHT]);
  });
});

describe("the buttons", () => {
  it("one finger steers while another holds A", () => {
    const hand = fingers();
    hand.down(STICK, CENTER);
    hand.move(STICK, fromCenter(30, 0));
    hand.down(BUTTON, centerOf("a"));
    expect(hand.controls.sample()).toBe(RIGHT | A);
  });

  it("a finger slides from A to B, and holds B alone from the next sample", () => {
    const hand = fingers();
    hand.down(BUTTON, centerOf("a"));
    const a = hand.controls.sample();
    hand.move(BUTTON, centerOf("b"));
    expect([a, hand.controls.sample()]).toEqual([A, B]);
  });

  it("a finger that went down elsewhere on the page holds nothing it moves over", () => {
    const hand = fingers();
    hand.move(BUTTON, centerOf("a"));
    expect(hand.controls.sample()).toBe(0);
  });

  it.each([
    ["a", A],
    ["b", B],
  ] as const)("a tap on %s shorter than a tick counts in the next sample only", (pad, bit) => {
    const hand = fingers();
    hand.down(BUTTON, centerOf(pad));
    hand.up(BUTTON);
    expect([hand.controls.sample(), hand.controls.sample()]).toEqual([bit, 0]);
  });

  it("a stick flick shorter than a tick counts in the next sample only", () => {
    const hand = fingers();
    hand.down(STICK, CENTER);
    hand.move(STICK, fromCenter(0, -30));
    hand.up(STICK);
    expect([hand.controls.sample(), hand.controls.sample()]).toEqual([UP, 0]);
  });

  it("a tap on X shorter than a tick commits nothing", () => {
    const hand = fingers();
    hand.down(BUTTON, centerOf("x"));
    hand.up(BUTTON);
    expect([hand.controls.sample(), hand.controls.sample()]).toEqual([0, 0]);
  });

  it("a tap on X shorter than a tick counts once when X needs no hold", () => {
    const hand = fingers({ ...TOUCH_DEFAULTS, xHold: 0 });
    hand.down(BUTTON, centerOf("x"));
    hand.up(BUTTON);
    expect([hand.controls.sample(), hand.controls.sample()]).toEqual([X, 0]);
  });
});

describe("X's hold", () => {
  /** The samples of X held for `samples` samples, at `xHold`. */
  function holdX(xHold: number, samples: number): number[] {
    const hand = fingers({ ...TOUCH_DEFAULTS, xHold });
    hand.down(BUTTON, centerOf("x"));
    return Array.from({ length: samples }, () => hand.controls.sample());
  }

  it.each([2, 4, 8])("X held through xHold − 1 earlier samples commits nothing, at xHold %i", (xHold) => {
    expect(holdX(xHold, xHold)).toEqual(Array<number>(xHold).fill(0));
  });

  it.each([0, 2, 4, 8])("X held through xHold earlier samples commits, at xHold %i", (xHold) => {
    expect(holdX(xHold, xHold + 1).at(-1)).toBe(X);
  });

  it("starts again when X is pressed again", () => {
    const hand = fingers();
    hand.down(BUTTON, centerOf("x"));
    for (let held = 1; held < TOUCH_DEFAULTS.xHold; held += 1) hand.controls.sample();
    hand.up(BUTTON);
    hand.down(BUTTON, centerOf("x"));
    const samples = Array.from({ length: TOUCH_DEFAULTS.xHold + 1 }, () => hand.controls.sample());
    expect(samples.map((mask) => mask & X)).toEqual([0, 0, 0, 0, X]);
  });

  it("shows X's hold in whole ticks, up to xHold", () => {
    const hand = fingers();
    hand.down(BUTTON, centerOf("x"));
    const shown = Array.from({ length: TOUCH_DEFAULTS.xHold + 2 }, () => {
      hand.controls.sample();
      return hand.controls.xHeld;
    });
    expect(shown).toEqual([1, 2, 3, 4, 4, 4]);
  });
});

describe("releases", () => {
  it.each(POINTER_RELEASES)("%s releases the pointer's button by the next sample", (type) => {
    const hand = fingers();
    hand.down(BUTTON, centerOf("b"));
    const held = hand.controls.sample();
    hand.send(type, BUTTON);
    expect([held, hand.controls.sample()]).toEqual([B, 0]);
  });

  it.each(POINTER_RELEASES)("%s stands the stick still by the next sample", (type) => {
    const hand = fingers();
    hand.down(STICK, CENTER);
    hand.move(STICK, fromCenter(-30, 0));
    const held = hand.controls.sample();
    hand.send(type, STICK);
    expect([held, hand.controls.sample()]).toEqual([LEFT, 0]);
  });

  /** A finger on the stick, one on A and one on X, held through a sample. */
  function threeFingers() {
    const hand = fingers();
    hand.down(STICK, CENTER);
    hand.move(STICK, fromCenter(30, 0));
    hand.down(BUTTON, centerOf("a"));
    hand.down(3, centerOf("x"));
    hand.controls.sample();
    return hand;
  }

  it.each(PAGE_RELEASES)("%s on the page releases every control by the next sample", (type) => {
    const hand = threeFingers();
    hand.page.dispatchEvent(new Event(type));
    expect([hand.controls.sample(), hand.controls.xHeld]).toEqual([0, 0]);
  });

  it("the page turning hidden releases every control by the next sample", () => {
    const hand = threeFingers();
    hand.doc.visibilityState = "hidden";
    hand.doc.dispatchEvent(new Event("visibilitychange"));
    expect([hand.controls.sample(), hand.controls.xHeld]).toEqual([0, 0]);
  });

  it("the page turning visible releases nothing", () => {
    const hand = threeFingers();
    hand.doc.dispatchEvent(new Event("visibilitychange"));
    expect(hand.controls.sample()).toBe(RIGHT | A);
  });
});

describe("the touch setting", () => {
  it("restores the setting it stored", () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    };
    saveTouchSetting(storage, "mirrored");
    expect(loadTouchSetting(storage)).toBe<TouchSetting>("mirrored");
  });

  it("is on when the stored setting is not one of on, off and mirrored", () => {
    const storage = { getItem: () => JSON.stringify("left"), setItem: () => undefined };
    expect(loadTouchSetting(storage)).toBe<TouchSetting>("on");
  });
});
