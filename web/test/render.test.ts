import { describe, expect, it } from "vitest";
import type { Snapshot } from "../src/core";
import { BOSS_COLORS, cellRect, entityRects } from "../src/render";

const snapshot = (bosses: Snapshot["bosses"]): Snapshot => ({
  player: { x: 30, y: 59, cutting: false },
  lives: 3,
  invulnerable: 0,
  bosses,
  minions: [],
  claimBp: 0,
  targetBp: 7500,
  ticksUsed: 0,
  ticksLeft: 2700,
});

describe("entity rectangles", () => {
  it("draws two bosses first, each in its own color", () => {
    const rects = entityRects(snapshot([{ x: 20, y: 20, size: 5 }, { x: 45, y: 40, size: 4 }]));
    expect(rects.slice(0, 2)).toEqual([
      cellRect(20, 20, 5, 5, BOSS_COLORS[0]),
      cellRect(45, 40, 4, 4, BOSS_COLORS[1]),
    ]);
  });
});
