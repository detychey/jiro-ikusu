// Shared by worked-examples.mjs and derivations.mjs: the byte formats and derivations of README
// §5, §6.3, §6.4, §7.2 and §8.2, written independently of the Rust core.
import { concat, keccak256, solidityPackedKeccak256, toUtf8Bytes, getBytes, toBeHex, zeroPadValue } from "ethers";

export const WIDTH = 60;
export const CELLS = WIDTH * WIDTH;
export const MIN_OPEN_AREA = 1682;
export const MAX_TICKS = 2700;
export const TICKS_PER_SECOND = 15;
export const RULES_VERSION = 2;
export const LEVEL_VERSION = 1;
export const JOURNAL_VERSION = 1;
export const STATE_HASH_VERSION = 1;
export const PLAYER_START = { x: 30, y: 59 };
export const EMPTY = 0;
export const CLAIMED = 1;
export const TRAIL = 2;

export const LEVEL = {
  length: 472,
  bitmap: 1,
  bossSize: 451,
  spawnRect: 452,
  bossPeriod: 456,
  minionCount: 457,
  minionSpawns: 458,
  minionPeriod: 464,
  respawnDelay: 465,
  timeLimit: 467,
  lives: 469,
  target: 470,
};

export const LEVEL_ERRORS = {
  length: 20,
  version: 21,
  borderObstacle: 22,
  bossSize: 23,
  spawnOrder: 24,
  spawnBounds: 25,
  bossPeriod: 26,
  minionCount: 27,
  minionSpawn: 28,
  minionSlot: 29,
  minionPeriod: 30,
  respawnDelay: 31,
  timeLimit: 32,
  lives: 33,
  target: 34,
  openAreaSplit: 35,
  openAreaSmall: 36,
  bossSpawn: 37,
  minionSpawnRail: 38,
  playerStartRail: 39,
};

export const hex = (bytes) => "0x" + Buffer.from(bytes).toString("hex");
export const readU16 = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1];
export const readU32 = (bytes, offset) => readU16(bytes, offset) * 0x10000 + readU16(bytes, offset + 2);
export const u16 = (value) => [value >> 8, value & 0xff];
export const isBorder = (x, y) => x === 0 || y === 0 || x === WIDTH - 1 || y === WIDTH - 1;
export const index = (x, y) => y * WIDTH + x;
export const isObstacle = (levelBytes, cell) => (levelBytes[LEVEL.bitmap + (cell >> 3)] >> (7 - (cell & 7))) & 1;
export const spawnRect = (levelBytes) => levelBytes.subarray(LEVEL.spawnRect, LEVEL.spawnRect + 4);
export const minionSpawn = (levelBytes, slot) => ({
  x: levelBytes[LEVEL.minionSpawns + 2 * slot],
  y: levelBytes[LEVEL.minionSpawns + 2 * slot + 1],
});

export function encodeLevel(level) {
  const bytes = new Uint8Array(LEVEL.length);
  bytes[0] = LEVEL_VERSION;
  for (const { x, y } of level.obstacles) {
    const cell = index(x, y);
    bytes[LEVEL.bitmap + (cell >> 3)] |= 0x80 >> (cell & 7);
  }
  bytes.set([level.bossSize, ...level.spawnRect, level.bossPeriod, level.minions.length], LEVEL.bossSize);
  level.minions.forEach(({ x, y }, slot) => bytes.set([x, y], LEVEL.minionSpawns + 2 * slot));
  bytes.set(
    [level.minionPeriod, ...u16(level.respawnDelay), ...u16(level.timeLimit), level.lives, ...u16(level.target)],
    LEVEL.minionPeriod,
  );
  return bytes;
}

export function startGrid(levelBytes) {
  const grid = new Uint8Array(CELLS);
  for (let cell = 0; cell < CELLS; cell++) {
    const border = isBorder(cell % WIDTH, Math.floor(cell / WIDTH));
    grid[cell] = border || isObstacle(levelBytes, cell) ? CLAIMED : EMPTY;
  }
  return grid;
}

export function isRail(grid, x, y) {
  if (grid[index(x, y)] !== CLAIMED) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < WIDTH && ny < WIDTH) {
        const state = grid[index(nx, ny)];
        if (state === EMPTY || state === TRAIL) return true;
      }
    }
  }
  return false;
}

export function openArea(grid) {
  const open = [];
  for (let cell = 0; cell < CELLS; cell++) if (grid[cell] === EMPTY) open.push(cell);
  if (open.length === 0) return { size: 0, connected: false };
  const seen = new Uint8Array(CELLS);
  const stack = [open[0]];
  seen[open[0]] = 1;
  let reached = 1;
  while (stack.length) {
    const cell = stack.pop();
    const x = cell % WIDTH;
    const y = Math.floor(cell / WIDTH);
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
      const next = index(nx, ny);
      if (nx >= 0 && ny >= 0 && nx < WIDTH && ny < WIDTH && !seen[next] && grid[next] === EMPTY) {
        seen[next] = 1;
        reached++;
        stack.push(next);
      }
    }
  }
  return { size: open.length, connected: reached === open.length };
}

export function validateLevel(bytes) {
  if (bytes.length !== LEVEL.length) return LEVEL_ERRORS.length;
  if (bytes[0] !== LEVEL_VERSION) return LEVEL_ERRORS.version;
  for (let cell = 0; cell < CELLS; cell++) {
    if (isBorder(cell % WIDTH, Math.floor(cell / WIDTH)) && isObstacle(bytes, cell)) return LEVEL_ERRORS.borderObstacle;
  }
  const size = bytes[LEVEL.bossSize];
  if (size < 2 || size > 8) return LEVEL_ERRORS.bossSize;
  const [x0, y0, x1, y1] = spawnRect(bytes);
  if (x0 > x1 || y0 > y1) return LEVEL_ERRORS.spawnOrder;
  if (x0 < 1 || y0 < 1 || x1 > 59 - size || y1 > 59 - size) return LEVEL_ERRORS.spawnBounds;
  if (bytes[LEVEL.bossPeriod] === 0) return LEVEL_ERRORS.bossPeriod;
  const minionCount = bytes[LEVEL.minionCount];
  if (minionCount > 3) return LEVEL_ERRORS.minionCount;
  for (let slot = 0; slot < minionCount; slot++) {
    const { x, y } = minionSpawn(bytes, slot);
    if (x >= WIDTH || y >= WIDTH) return LEVEL_ERRORS.minionSpawn;
  }
  for (let slot = minionCount; slot < 3; slot++) {
    const { x, y } = minionSpawn(bytes, slot);
    if (x || y) return LEVEL_ERRORS.minionSlot;
  }
  if (bytes[LEVEL.minionPeriod] > 0 !== minionCount > 0) return LEVEL_ERRORS.minionPeriod;
  if (readU16(bytes, LEVEL.respawnDelay) > 0 !== minionCount > 0) return LEVEL_ERRORS.respawnDelay;
  const timeLimit = readU16(bytes, LEVEL.timeLimit);
  if (timeLimit < 1 || timeLimit > MAX_TICKS) return LEVEL_ERRORS.timeLimit;
  if (bytes[LEVEL.lives] === 0) return LEVEL_ERRORS.lives;
  const target = readU16(bytes, LEVEL.target);
  if (target < 1 || target > 10000) return LEVEL_ERRORS.target;

  const grid = startGrid(bytes);
  const area = openArea(grid);
  if (!area.connected) return LEVEL_ERRORS.openAreaSplit;
  if (area.size < MIN_OPEN_AREA) return LEVEL_ERRORS.openAreaSmall;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) if (grid[index(x + dx, y + dy)] !== EMPTY) return LEVEL_ERRORS.bossSpawn;
      }
    }
  }
  for (let slot = 0; slot < minionCount; slot++) {
    const { x, y } = minionSpawn(bytes, slot);
    if (!isRail(grid, x, y)) return LEVEL_ERRORS.minionSpawnRail;
  }
  if (!isRail(grid, PLAYER_START.x, PLAYER_START.y)) return LEVEL_ERRORS.playerStartRail;
  return 0;
}

export const u256 = (value) => getBytes(zeroPadValue(toBeHex(value), 32));
export const runNonceOf = (entropy, runId) => getBytes(keccak256(concat([toUtf8Bytes("jiro.run"), entropy, u256(runId)])));
export const deadline = (revealedAt, ticksUsed, commitSlack) => {
  const ticks = ticksUsed.reduce((sum, used) => sum + used, 0);
  return revealedAt + Math.floor((ticks + TICKS_PER_SECOND - 1) / TICKS_PER_SECOND) + commitSlack;
};

export const levelSeed = (runNonce, levelIndex) =>
  getBytes(solidityPackedKeccak256(["string", "bytes32", "uint8"], ["jiro.level", runNonce, levelIndex]));

export function bossStart(levelBytes, seed) {
  const [x0, y0, x1, y1] = spawnRect(levelBytes);
  const width = x1 - x0 + 1;
  const candidates = width * (y1 - y0 + 1);
  const pick = readU32(seed, 0) % candidates;
  return {
    candidates,
    pick,
    x: x0 + (pick % width),
    y: y0 + Math.floor(pick / width),
    vx: seed[4] & 1 ? 1 : -1,
    vy: seed[4] & 2 ? 1 : -1,
  };
}

export function draw(runNonce) {
  const deck = Array.from({ length: 16 }, (_, slot) => slot);
  const swaps = [];
  for (let i = 0; i < 6; i++) {
    const hash = BigInt(solidityPackedKeccak256(["string", "bytes32", "uint8"], ["jiro.draw", runNonce, i]));
    const j = i + Number(hash % BigInt(16 - i));
    swaps.push(j);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { swaps, slots: deck.slice(0, 6) };
}

export function fmix32(h) {
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export const deflectionKey = (seed) => readU32(seed, 5);
export const deflectionDraw = (key, tick) => fmix32((key ^ tick) >>> 0) >>> 26;

export function moveBoss(grid, boss, key, tick) {
  const draw = deflectionDraw(key, tick);
  if (draw === 0) boss.vx = -boss.vx;
  if (draw === 1) boss.vy = -boss.vy;
  const blocked = (cells) => cells.some((cell) => grid[cell] === CLAIMED || grid[cell] === TRAIL);
  const column = boss.vx > 0 ? boss.x + boss.size : boss.x - 1;
  const xEdge = Array.from({ length: boss.size }, (_, k) => index(column, boss.y + k));
  if (blocked(xEdge)) boss.vx = -boss.vx;
  else boss.x += boss.vx;
  const row = boss.vy > 0 ? boss.y + boss.size : boss.y - 1;
  const yEdge = Array.from({ length: boss.size }, (_, k) => index(boss.x + k, row));
  if (blocked(yEdge)) boss.vy = -boss.vy;
  else boss.y += boss.vy;
  return draw;
}

export function playBoss(grid, boss, key, timeLimit) {
  const deflections = [];
  for (let tick = 0; tick < timeLimit; tick++) {
    if (tick % boss.period !== 0) continue;
    const draw = moveBoss(grid, boss, key, tick);
    if (draw < 2) deflections.push({ tick, draw, x: boss.x, y: boss.y, vx: boss.vx, vy: boss.vy });
  }
  return deflections;
}

export function statePreimage({ tick, mask, grid, player, boss, captured, claimable, nextEvent }) {
  const packedGrid = new Uint8Array(CELLS / 4);
  for (let cell = 0; cell < CELLS; cell++) packedGrid[cell >> 2] |= grid[cell] << (6 - 2 * (cell & 3));
  const playerBytes = [
    player.x, player.y, player.cutting, player.cutStart.x, player.cutStart.y,
    player.lives, player.shield, player.invulnerable, player.previousDirection, ...u16(player.pressTick),
  ];
  const bossBytes = [boss.x, boss.y, boss.size, boss.vx & 0xff, boss.vy & 0xff, boss.period];
  const emptyMinionSlots = new Uint8Array(3 * 7);
  return getBytes(concat([
    new Uint8Array([STATE_HASH_VERSION, ...u16(tick), mask]),
    packedGrid,
    new Uint8Array(playerBytes),
    new Uint8Array(bossBytes),
    emptyMinionSlots,
    new Uint8Array([...u16(captured), ...u16(claimable), ...u16(nextEvent)]),
  ]));
}

export function encodeJournal({ mode, runNonce, levelId, levelIndex, events }) {
  return getBytes(concat([
    new Uint8Array([JOURNAL_VERSION, ...u16(RULES_VERSION), mode]),
    runNonce,
    levelId,
    new Uint8Array([levelIndex, ...u16(events.length)]),
    ...events.map(({ tick, mask }) => new Uint8Array([...u16(tick), mask])),
  ]));
}

// The worked-example inputs of README §5, §6.3 and §6.4, shared by both scripts.
export const openField = {
  obstacles: [],
  bossSize: 5,
  spawnRect: [20, 20, 34, 34],
  bossPeriod: 2,
  minions: [],
  minionPeriod: 0,
  respawnDelay: 0,
  timeLimit: 2700,
  lives: 3,
  target: 7500,
};
export const blockedStart = { ...openField, obstacles: [{ x: 29, y: 58 }, { x: 30, y: 58 }, { x: 31, y: 58 }] };
export const wideSpawn = { ...openField, spawnRect: [20, 20, 34, 25] };
export const exampleRunNonce = getBytes(keccak256(toUtf8Bytes("jiro.example.9")));
