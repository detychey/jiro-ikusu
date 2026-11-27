import { describe, expect, it } from "vitest";
import type { Snapshot } from "../src/core";
import { type Brush, CaptureEffects, GAIN_TICKS, MAX_SPARKS, MIN_GAP_TICKS, SPARK_TICKS } from "../src/effects";
import { CELL_PX, FIELD_PX } from "../src/render";

interface Drawn {
  kind: "spark" | "gain";
  alpha: number;
  x: number;
  y: number;
  text?: string;
}

/** A brush that records what is drawn, with the alpha in force at the time. */
function recordingBrush(): { brush: Brush; drawn: Drawn[] } {
  const drawn: Drawn[] = [];
  const brush: Brush = {
    globalAlpha: 1,
    fillStyle: "",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    fillRect(x, y) {
      drawn.push({ kind: "spark", alpha: brush.globalAlpha, x, y });
    },
    fillText(text, x, y) {
      drawn.push({ kind: "gain", alpha: brush.globalAlpha, x, y, text });
    },
  };
  return { brush, drawn };
}

const snapshot = (ticksUsed: number, claimBp: number): Snapshot => ({
  player: { x: 30, y: 59, cutting: false },
  lives: 3,
  invulnerable: 0,
  bosses: [{ x: 20, y: 20, size: 5 }],
  minions: [],
  claimBp,
  targetBp: 7500,
  ticksUsed,
  ticksLeft: 2700 - ticksUsed,
});

/** The cells of a block, as grid indices. */
const block = (x0: number, y0: number, width: number, height: number): number[] =>
  Array.from({ length: width * height }, (_, i) => (y0 + Math.floor(i / width)) * 60 + x0 + (i % width));

const drawnBy = (effects: CaptureEffects): Drawn[] => {
  const { brush, drawn } = recordingBrush();
  effects.draw(brush);
  return drawn;
};

const captured = (effects = new CaptureEffects(true)): CaptureEffects => {
  effects.observe(snapshot(10, 1638), block(10, 40, 20, 19));
  return effects;
};

describe("CaptureEffects", () => {
  it("draws nothing before a capture", () => {
    const effects = new CaptureEffects(true);
    effects.observe(snapshot(5, 0), block(0, 0, 3, 3));
    expect(drawnBy(effects)).toEqual([]);
  });

  it("shows the gain with the HUD's two decimals", () => {
    expect(drawnBy(captured()).find((item) => item.kind === "gain")?.text).toBe("+16.38 %");
  });

  it("draws the gain opaque", () => {
    expect(drawnBy(captured()).find((item) => item.kind === "gain")?.alpha).toBe(1);
  });

  it("draws the sparks at 50 % first", () => {
    expect(new Set(drawnBy(captured()).filter((item) => item.kind === "spark").map((item) => item.alpha))).toEqual(new Set([0.5]));
  });

  it("draws the sparks at 25 % later", () => {
    const effects = captured();
    effects.observe(snapshot(10 + SPARK_TICKS / 2, 1638), []);
    expect(new Set(drawnBy(effects).filter((item) => item.kind === "spark").map((item) => item.alpha))).toEqual(new Set([0.25]));
  });

  it("stops the sparks after their ticks and keeps the gain", () => {
    const effects = captured();
    effects.observe(snapshot(10 + SPARK_TICKS, 1638), []);
    expect(drawnBy(effects).map((item) => item.kind)).toEqual(["gain"]);
  });

  it("stops everything after the gain's ticks", () => {
    const effects = captured();
    effects.observe(snapshot(10 + GAIN_TICKS, 1638), []);
    expect(drawnBy(effects)).toEqual([]);
  });

  it("puts every spark on a whole cell inside the field", () => {
    const effects = captured();
    effects.observe(snapshot(12, 1638), []);
    const sparks = drawnBy(effects).filter((item) => item.kind === "spark");
    expect(sparks.every(({ x, y }) => x % CELL_PX === 0 && y % CELL_PX === 0 && x >= 0 && y >= 0 && x < FIELD_PX && y < FIELD_PX)).toBe(true);
  });

  it("limits the sparks", () => {
    const effects = new CaptureEffects(true);
    effects.observe(snapshot(10, 9000), block(1, 1, 58, 58));
    expect(drawnBy(effects).filter((item) => item.kind === "spark").length).toBeLessThanOrEqual(MAX_SPARKS);
  });

  it("draws the same effect for the same capture", () => {
    expect(drawnBy(captured())).toEqual(drawnBy(captured()));
  });

  it("holds the gain inside the field", () => {
    const effects = new CaptureEffects(true);
    effects.observe(snapshot(10, 300), block(1, 1, 2, 2));
    const gain = drawnBy(effects).find((item) => item.kind === "gain");
    expect([(gain?.x ?? 0) >= 0, (gain?.y ?? 0) >= 0]).toEqual([true, true]);
  });

  it("lets the gain rise in whole cells", () => {
    const effects = captured();
    const before = drawnBy(effects).find((item) => item.kind === "gain")?.y ?? 0;
    effects.observe(snapshot(14, 1638), []);
    expect(before - (drawnBy(effects).find((item) => item.kind === "gain")?.y ?? 0)).toBe(2 * CELL_PX);
  });

  it("starts no second effect within the gap, so nothing flashes more than 3 times a second", () => {
    const effects = captured();
    effects.observe(snapshot(10 + MIN_GAP_TICKS - 1, 2400), block(40, 40, 10, 10));
    expect(drawnBy(effects).find((item) => item.kind === "gain")?.text).toBe("+16.38 %");
  });

  it("starts a second effect once the gap has passed", () => {
    const effects = captured();
    effects.observe(snapshot(10 + MIN_GAP_TICKS, 2400), block(40, 40, 10, 10));
    expect(drawnBy(effects).find((item) => item.kind === "gain")?.text).toBe("+7.62 %");
  });

  it("draws nothing for a player who asks for reduced motion", () => {
    expect(drawnBy(captured(new CaptureEffects(false)))).toEqual([]);
  });

  it("starts afresh on a new level", () => {
    const effects = captured();
    effects.reset();
    expect(drawnBy(effects)).toEqual([]);
  });

  it("counts a new level's capture, when its ticks start again from zero", () => {
    const effects = captured();
    effects.reset();
    effects.observe(snapshot(4, 500), block(5, 40, 10, 5));
    expect(drawnBy(effects).find((item) => item.kind === "gain")?.text).toBe("+5.00 %");
  });
});
