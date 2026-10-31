import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { Core, CoreError, fromHex, hex } from "../src/core";
import { describeError, ERRORS } from "../src/errors";
import { FIELD_CELLS, isBorder, isObstacle, type Level, minionAt, MINION_SLOTS, setObstacle, toggleMinion } from "../src/level";
import { levelStatus } from "../src/pages/editor";

const repo = new URL("../../", import.meta.url);
const core = await Core.load(readFileSync(new URL("target/wasm32-unknown-unknown/release/jiro_wasm.wasm", repo)));

const levelFiles = readdirSync(new URL("levels/", repo))
  .filter((name) => name.endsWith(".bin"))
  .sort();
const levelBytes = (name: string) => new Uint8Array(readFileSync(new URL(`levels/${name}`, repo)));
const levelSource = (name: string) => readFileSync(new URL(`levels/src/${name.replace(/\.bin$/, ".txt")}`, repo), "utf8");

function decoded(bytes: Uint8Array): Level {
  const level = core.decodeLevel(bytes);
  if ("code" in level) throw new Error(describeError(level.code));
  return level;
}

/** A level with no obstacle, no minion and every field 0. */
function blankLevel(): Level {
  return {
    cells: new Uint8Array(FIELD_CELLS * FIELD_CELLS),
    bossSize: 0,
    spawn: { x0: 0, y0: 0, x1: 0, y1: 0 },
    bossPeriod: 0,
    minionCount: 0,
    minionSpawns: Array.from({ length: MINION_SLOTS }, () => ({ x: 0, y: 0 })),
    minionPeriod: 0,
    respawnDelay: 0,
    timeLimit: 0,
    lives: 0,
    targetBp: 0,
  };
}

/** The `key=value` header of a level source (levels/README.md), as numbers. */
function sourceHeader(source: string): Record<string, number[]> {
  const lines = source.split("\n").slice(0, 8);
  return Object.fromEntries(lines.map((line) => {
    const [key = "", value = ""] = line.split("=");
    return [key, value.split(",").map(Number)];
  }));
}

const formatLevels = readdirSync(new URL("vectors/format/", repo))
  .filter((name) => name.startsWith("level-"))
  .sort()
  .map((name) => ({ name, vector: JSON.parse(readFileSync(new URL(`vectors/format/${name}`, repo), "utf8")) }));

/** The field rows of a level source, as `jiro-tools level render` writes them (levels/README.md):
 *  `m` a minion spawn, `#` the border or an obstacle, `.` an open cell. */
function renderRows(level: Level): string[] {
  return Array.from({ length: FIELD_CELLS }, (_, y) =>
    Array.from({ length: FIELD_CELLS }, (_, x) => {
      const cell = { x, y };
      if (minionAt(level, cell) >= 0) return "m";
      return isBorder(cell) || isObstacle(level, cell) ? "#" : ".";
    }).join(""),
  );
}

/** A xorshift32 generator of whole numbers from `low` to `high`. */
function generator(seed: number): (low: number, high: number) => number {
  let state = seed | 1;
  return (low, high) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return low + ((state >>> 0) % (high - low + 1));
  };
}

/** A random level: up to 6 obstacle blocks, a boss spawn area, and up to 3 minions on the
 *  border, with every field in its range. */
function randomLevel(draw: (low: number, high: number) => number): Level {
  const level = blankLevel();
  for (let block = draw(0, 6); block > 0; block -= 1) {
    const [width, height] = [draw(1, 10), draw(1, 10)];
    const [x0, y0] = [draw(1, FIELD_CELLS - 1 - width), draw(1, FIELD_CELLS - 1 - height)];
    for (let y = y0; y < y0 + height; y += 1) {
      for (let x = x0; x < x0 + width; x += 1) setObstacle(level, { x, y }, true);
    }
  }
  level.bossSize = draw(2, 8);
  const last = FIELD_CELLS - 1 - level.bossSize;
  const [x0, y0] = [draw(1, last), draw(1, last)];
  level.spawn = { x0, y0, x1: draw(x0, Math.min(last, x0 + 8)), y1: draw(y0, Math.min(last, y0 + 8)) };
  level.bossPeriod = draw(1, 8);
  for (let minion = draw(0, MINION_SLOTS); minion > 0; minion -= 1) {
    toggleMinion(level, { x: draw(0, FIELD_CELLS - 1), y: [0, FIELD_CELLS - 1][draw(0, 1)] ?? 0 });
  }
  level.minionPeriod = level.minionCount > 0 ? draw(1, 8) : 0;
  level.respawnDelay = level.minionCount > 0 ? draw(1, 600) : 0;
  level.timeLimit = draw(1, 2_700);
  level.lives = draw(1, 9);
  level.targetBp = draw(1, 10_000);
  return level;
}

/** The first random level of `seed` that the core accepts. */
function validRandomLevel(seed: number): Level {
  const draw = generator(seed);
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const level = randomLevel(draw);
    if (core.validateLevel(core.encodeLevel(level)) === 0) return level;
  }
  throw new Error(`seed ${seed}: no valid level in 1,000 draws`);
}

let toolIds: Map<string, string>;

beforeAll(() => {
  const output = execFileSync(
    "cargo",
    ["run", "-q", "-p", "jiro-tools", "--locked", "--", "level", "id", ...levelFiles.map((name) => `levels/${name}`)],
    { cwd: fileURLToPath(repo), encoding: "utf8" },
  );
  toolIds = new Map(output.trim().split("\n").map((line) => {
    const [id = "", file = ""] = line.split(" ");
    return [file.replace("levels/", ""), id];
  }));
}, 600_000);

describe("level editor", () => {
  it.each(levelFiles)("imports and exports %s unchanged", (name) => {
    expect(hex(core.encodeLevel(decoded(levelBytes(name))))).toBe(hex(levelBytes(name)));
  });

  it.each(levelFiles)("draws the obstacles and minions of %s as its level source", (name) => {
    expect(renderRows(decoded(levelBytes(name)))).toEqual(levelSource(name).split("\n").slice(9, 9 + FIELD_CELLS));
  });

  it.each(levelFiles)("reads the fields of %s as its level source gives them", (name) => {
    const level = decoded(levelBytes(name));
    const { spawn } = level;
    expect({
      boss_size: [level.bossSize],
      boss_spawn: [spawn.x0, spawn.y0, spawn.x1, spawn.y1],
      boss_period: [level.bossPeriod],
      minion_period: [level.minionPeriod],
      respawn_delay: [level.respawnDelay],
      time_limit: [level.timeLimit],
      lives: [level.lives],
      target_bp: [level.targetBp],
    }).toEqual(sourceHeader(levelSource(name)));
  });

  it.each(levelFiles)("shows the level id that jiro-tools gives for %s", (name) => {
    expect(hex(core.levelId(levelBytes(name)))).toBe(toolIds.get(name));
  });

  it.each(Array.from({ length: 20 }, (_, seed) => seed + 1))("round-trips random valid level %i from model to bytes and back", (seed) => {
    const level = validRandomLevel(seed);
    expect(decoded(core.encodeLevel(level))).toEqual(level);
  });

  it.each(formatLevels.filter(({ vector }) => vector.error !== undefined))("shows the message of the rule $name breaks", ({ vector }) => {
    expect(levelStatus(core, fromHex(vector.input))).toBe(describeError(vector.error));
  });

  it.each(formatLevels.filter(({ vector }) => vector.error === undefined))("accepts the valid level $name", ({ vector }) => {
    expect(levelStatus(core, fromHex(vector.input))).toBe("valid");
  });

  it("gives each level rule a message of its own", () => {
    const meanings = Array.from({ length: 20 }, (_, i) => ERRORS[20 + i]?.[1]);
    expect(new Set(meanings).size).toBe(20);
  });

  it.each([
    ["time limit", { timeLimit: 70_000 }],
    ["lives", { lives: 256 }],
    ["minion x", { minionSpawns: [{ x: 300, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] }],
    ["boss size", { bossSize: -1 }],
    ["target", { targetBp: 1.5 }],
  ])("refuses to encode a %s its bytes cannot hold", (_, field) => {
    expect(() => core.encodeLevel({ ...decoded(levelBytes(levelFiles[0] ?? "")), ...field })).toThrow(CoreError);
  });

  it("refuses to encode a cell other than 0 or 1", () => {
    const level = blankLevel();
    level.cells[100] = 2;
    expect(() => core.encodeLevel(level)).toThrow(CoreError);
  });

  it("refuses to import bytes that are not a level's length", () => {
    expect(core.decodeLevel(new Uint8Array(471))).toEqual({ code: 20 });
  });

  it("numbers the minion spawns in row-major order, as a level source does", () => {
    const level = blankLevel();
    for (const cell of [{ x: 40, y: 0 }, { x: 0, y: 30 }, { x: 10, y: 0 }]) toggleMinion(level, cell);
    expect(level.minionSpawns).toEqual([
      { x: 10, y: 0 },
      { x: 40, y: 0 },
      { x: 0, y: 30 },
    ]);
  });

  it("keeps the minion slots past the count at (0, 0) when a minion is removed", () => {
    const level = blankLevel();
    for (const x of [5, 6, 7]) toggleMinion(level, { x, y: 0 });
    toggleMinion(level, { x: 5, y: 0 });
    expect([level.minionCount, level.minionSpawns]).toEqual([
      2,
      [
        { x: 6, y: 0 },
        { x: 7, y: 0 },
        { x: 0, y: 0 },
      ],
    ]);
  });

  it("refuses a fourth minion", () => {
    const level = blankLevel();
    for (const x of [5, 6, 7]) toggleMinion(level, { x, y: 0 });
    expect(toggleMinion(level, { x: 8, y: 0 })).toBe(false);
  });
});
