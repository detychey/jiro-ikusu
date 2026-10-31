// A level as the editor holds it (plan M2.5): its cells and its fields. The editor has no format
// of its own: the core's codec turns this model into level bytes v1 and back (README §5, P10),
// through jiro-wasm's edit buffers, and only the core says whether a level is valid.

export const LEVEL_LEN = 472;
export const FIELD_CELLS = 60;
export const MINION_SLOTS = 3;
/** The player's start cell (README §4.3). */
export const PLAYER_START = { x: 30, y: 59 } as const;

export interface Cell {
  x: number;
  y: number;
}

export interface Level {
  /** One byte per cell in row-major order: 1 for an obstacle, 0 for none. */
  cells: Uint8Array;
  bossSize: number;
  /** The top-left cells the boss body may start on, inclusive. */
  spawn: { x0: number; y0: number; x1: number; y1: number };
  bossPeriod: number;
  minionCount: number;
  /** All three slots; the slots past `minionCount` are (0, 0) in a valid level. */
  minionSpawns: Cell[];
  minionPeriod: number;
  respawnDelay: number;
  timeLimit: number;
  lives: number;
  targetBp: number;
}

/** The fields of `level` besides its cells, in the order of jiro-wasm's EDIT_FIELDS. */
export function editFields(level: Level): number[] {
  const { spawn } = level;
  return [
    level.bossSize,
    spawn.x0,
    spawn.y0,
    spawn.x1,
    spawn.y1,
    level.bossPeriod,
    level.minionCount,
    ...level.minionSpawns.flatMap(({ x, y }) => [x, y]),
    level.minionPeriod,
    level.respawnDelay,
    level.timeLimit,
    level.lives,
    level.targetBp,
  ];
}

export const EDIT_FIELDS = 18;

/** The level of `cells` and of `fields` in the order of jiro-wasm's EDIT_FIELDS. */
export function editedLevel(cells: Uint8Array, fields: number[]): Level {
  const field = (index: number) => fields[index] ?? 0;
  return {
    cells,
    bossSize: field(0),
    spawn: { x0: field(1), y0: field(2), x1: field(3), y1: field(4) },
    bossPeriod: field(5),
    minionCount: field(6),
    minionSpawns: Array.from({ length: MINION_SLOTS }, (_, slot) => ({ x: field(7 + 2 * slot), y: field(8 + 2 * slot) })),
    minionPeriod: field(13),
    respawnDelay: field(14),
    timeLimit: field(15),
    lives: field(16),
    targetBp: field(17),
  };
}

const index = ({ x, y }: Cell) => y * FIELD_CELLS + x;

export function isObstacle(level: Level, cell: Cell): boolean {
  return level.cells[index(cell)] === 1;
}

export function setObstacle(level: Level, cell: Cell, obstacle: boolean): void {
  level.cells[index(cell)] = obstacle ? 1 : 0;
}

export function isBorder({ x, y }: Cell): boolean {
  return x === 0 || y === 0 || x === FIELD_CELLS - 1 || y === FIELD_CELLS - 1;
}

/** The spawn slot of `cell` among the first `minionCount`, or -1. */
export function minionAt(level: Level, cell: Cell): number {
  return level.minionSpawns.slice(0, level.minionCount).findIndex(({ x, y }) => x === cell.x && y === cell.y);
}

/** Removes the minion spawn at `cell`, or adds one there if a slot is free. The spawns take
 *  their slots in row-major order, as a level source gives them (README §5, P10), and the slots
 *  past the count stay (0, 0). Returns false when all slots are taken. */
export function toggleMinion(level: Level, cell: Cell): boolean {
  const slot = minionAt(level, cell);
  const spawns = level.minionSpawns.slice(0, level.minionCount);
  if (slot >= 0) spawns.splice(slot, 1);
  else if (spawns.length < MINION_SLOTS) spawns.push({ ...cell });
  else return false;
  spawns.sort((a, b) => index(a) - index(b));
  level.minionCount = spawns.length;
  level.minionSpawns = Array.from({ length: MINION_SLOTS }, (_, i) => spawns[i] ?? { x: 0, y: 0 });
  return true;
}
