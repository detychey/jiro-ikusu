// The field (README §4.1): 60 × 60 cells of 4 × 4 pixels on a 240 × 240 logical canvas, shown
// at an integer scale with pixelated rendering. Cells are redrawn only when they change, on a
// grid layer; the entities are drawn on top of a copy of it every frame.

import type { Snapshot } from "./core";

export const CELL_PX = 4;
export const FIELD_CELLS = 60;
export const FIELD_PX = CELL_PX * FIELD_CELLS;

/** The colors of the cell values 0 to 3; BOSS_ZONE exists only during a capture. */
export const CELL_COLORS = ["#000000", "#2850ff", "#ff2a2a", "#000000"] as const;
export const ENTITY_COLORS = {
  player: "#ffffff",
  invulnerablePlayer: "#9a9a9a",
  boss: "#ff3cf0",
  minion: "#3cff78",
} as const;

export interface Rect {
  color: string;
  x: number;
  y: number;
  size: number;
}

/** The entities to draw over the grid, in pixels, back to front: boss, minions, player. */
export function entityRects(snapshot: Snapshot): Rect[] {
  const cell = (x: number, y: number, cells: number, color: string): Rect => ({
    color,
    x: x * CELL_PX,
    y: y * CELL_PX,
    size: cells * CELL_PX,
  });
  const { boss, player } = snapshot;
  return [
    cell(boss.x, boss.y, boss.size, ENTITY_COLORS.boss),
    ...snapshot.minions
      .filter((minion) => minion.state === "live")
      .map((minion) => cell(minion.x, minion.y, 1, ENTITY_COLORS.minion)),
    cell(
      player.x,
      player.y,
      1,
      snapshot.invulnerable > 0 ? ENTITY_COLORS.invulnerablePlayer : ENTITY_COLORS.player,
    ),
  ];
}

/** The largest integer scale at which the field fits in `width` × `height` CSS pixels. */
export function integerScale(width: number, height: number): number {
  return Math.max(1, Math.floor(Math.min(width, height) / FIELD_PX));
}

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly gridLayer: HTMLCanvasElement;
  private readonly gridContext: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = FIELD_PX;
    canvas.height = FIELD_PX;
    canvas.style.imageRendering = "pixelated";
    this.context = context2d(canvas);
    this.gridLayer = document.createElement("canvas");
    this.gridLayer.width = FIELD_PX;
    this.gridLayer.height = FIELD_PX;
    this.gridContext = context2d(this.gridLayer);
  }

  /** Sizes the canvas to the largest integer scale that fits `width` × `height`. */
  fit(width: number, height: number): void {
    const size = `${FIELD_PX * integerScale(width, height)}px`;
    this.canvas.style.width = size;
    this.canvas.style.height = size;
  }

  /** Redraws the cells at `indices` of `grid` on the grid layer. */
  drawCells(grid: Uint8Array, indices: Iterable<number>): void {
    for (const index of indices) {
      this.gridContext.fillStyle = CELL_COLORS[grid[index] ?? 0] ?? CELL_COLORS[0];
      this.gridContext.fillRect(
        (index % FIELD_CELLS) * CELL_PX,
        Math.floor(index / FIELD_CELLS) * CELL_PX,
        CELL_PX,
        CELL_PX,
      );
    }
  }

  /** Shows the grid layer with the entities of `snapshot` on top. */
  frame(snapshot: Snapshot): void {
    this.context.drawImage(this.gridLayer, 0, 0);
    for (const rect of entityRects(snapshot)) {
      this.context.fillStyle = rect.color;
      this.context.fillRect(rect.x, rect.y, rect.size, rect.size);
    }
  }
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("this browser has no 2D canvas");
  context.imageSmoothingEnabled = false;
  return context;
}
