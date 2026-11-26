// The capture effect (docs/STYLE_GUIDE.md §10): when a cut claims area, sparks leave the claimed
// cells and the gain, "+16.38 %", rises over them. It is presentation only: it reads snapshots
// and never touches the core, and it moves in whole ticks and whole cells, so a replay of a game
// looks the same each time. Sparks are white at 50 % and then 25 %, the capture highlight's two
// steps, and the gain is opaque white in the pixel font.

import type { Snapshot } from "./core";
import { CELL_PX, FIELD_PX } from "./render";

export const SPARK_TICKS = 6;
export const GAIN_TICKS = 12;
/** The least number of ticks between two effects, so that nothing flashes more than 3 times a second. */
export const MIN_GAP_TICKS = 5;
export const MAX_SPARKS = 24;
const SPARKS_BASE = 6;
const BP_PER_EXTRA_SPARK = 50;
const GAIN_FONT = '12px "Jiro Pixel 12", monospace';
const GAIN_RISE_TICKS_PER_CELL = 2;
const WHITE = "#ffffff";
const DIRECTIONS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const;

/** The part of a canvas context the effect draws with. */
export interface Brush {
  globalAlpha: number;
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
}

interface Spark {
  x: number;
  y: number;
  direction: number;
}

interface Capture {
  sparks: Spark[];
  gain: string;
  x: number;
  y: number;
  age: number;
}

const FIELD_CELLS = FIELD_PX / CELL_PX;

/** A fixed scramble of `index`, so that a spark's direction depends only on where it starts. */
function scramble(index: number): number {
  return Math.imul(index ^ (index >>> 7), 0x9e3779b1) >>> 0;
}

export class CaptureEffects {
  private capture: Capture | undefined;
  private lastTicksUsed = 0;
  private lastClaimBp = 0;
  private ticksSinceStart = MIN_GAP_TICKS;

  /** `enabled` is false for a player who asks for reduced motion: nothing is drawn. */
  constructor(private readonly enabled: boolean) {}

  /** Forgets the level that ended, at the start of the next. */
  reset(): void {
    this.capture = undefined;
    this.lastTicksUsed = 0;
    this.lastClaimBp = 0;
    this.ticksSinceStart = MIN_GAP_TICKS;
  }

  /** Takes the state after the last ticks, and the indices of the cells they changed. */
  observe(snapshot: Snapshot, changedCells: ArrayLike<number>): void {
    const elapsed = Math.max(0, snapshot.ticksUsed - this.lastTicksUsed);
    const gainBp = snapshot.claimBp - this.lastClaimBp;
    this.lastTicksUsed = snapshot.ticksUsed;
    this.lastClaimBp = snapshot.claimBp;
    if (!this.enabled) return;
    this.ticksSinceStart += elapsed;
    if (this.capture !== undefined) {
      this.capture.age += elapsed;
      if (this.capture.age >= GAIN_TICKS) this.capture = undefined;
    }
    if (gainBp > 0 && changedCells.length > 0 && this.ticksSinceStart >= MIN_GAP_TICKS) {
      this.capture = this.begin(gainBp, changedCells);
      this.ticksSinceStart = 0;
    }
  }

  private begin(gainBp: number, cells: ArrayLike<number>): Capture {
    const count = Math.min(MAX_SPARKS, SPARKS_BASE + Math.floor(gainBp / BP_PER_EXTRA_SPARK), cells.length);
    const sparks = Array.from({ length: count }, (_, i) => {
      const index = cells[Math.floor((i * cells.length) / count)] ?? 0;
      return { x: index % FIELD_CELLS, y: Math.floor(index / FIELD_CELLS), direction: scramble(index + i) % DIRECTIONS.length };
    });
    const middle = (axis: "x" | "y") => Math.round(sparks.reduce((sum, spark) => sum + spark[axis], 0) / sparks.length);
    return { sparks, gain: `+${(gainBp / 100).toFixed(2)} %`, x: middle("x"), y: middle("y"), age: 0 };
  }

  /** Draws the effect over the field, in logical pixels. */
  draw(brush: Brush): void {
    const { capture } = this;
    if (capture === undefined) return;
    if (capture.age < SPARK_TICKS) this.drawSparks(brush, capture);
    this.drawGain(brush, capture);
    brush.globalAlpha = 1;
  }

  private drawSparks(brush: Brush, { sparks, age }: Capture): void {
    brush.fillStyle = WHITE;
    brush.globalAlpha = age < SPARK_TICKS / 2 ? 0.5 : 0.25;
    for (const { x, y, direction } of sparks) {
      const [dx, dy] = DIRECTIONS[direction] ?? DIRECTIONS[0];
      const [cellX, cellY] = [x + dx * age, y + dy * age];
      if (cellX < 0 || cellY < 0 || cellX >= FIELD_CELLS || cellY >= FIELD_CELLS) continue;
      brush.fillRect(cellX * CELL_PX, cellY * CELL_PX, CELL_PX, CELL_PX);
    }
  }

  private drawGain(brush: Brush, { gain, x, y, age }: Capture): void {
    brush.globalAlpha = 1;
    brush.fillStyle = WHITE;
    brush.font = GAIN_FONT;
    brush.textAlign = "center";
    brush.textBaseline = "middle";
    const margin = 4 * CELL_PX;
    const left = Math.min(Math.max(x * CELL_PX, margin * 2), FIELD_PX - margin * 2);
    const top = Math.max(y * CELL_PX - Math.floor(age / GAIN_RISE_TICKS_PER_CELL) * CELL_PX, margin);
    brush.fillText(gain, left, top);
  }
}
