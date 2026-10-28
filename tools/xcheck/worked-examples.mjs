// Computes the worked examples of README §5, §6.3, §6.4 and §8.2 independently of the
// Rust core. With --check <README>, exits 1 unless every printed line appears in it.
import { readFileSync } from "node:fs";
import { concat, keccak256, toUtf8Bytes, getBytes } from "ethers";

const WIDTH = 60;
const CELLS = WIDTH * WIDTH;
const LEVEL_LENGTH = 472;
const BITMAP_OFFSET = 1;
const MIN_OPEN_AREA = 1682;
const MAX_TICKS = 2700;
const RULES_VERSION = 1;
const PLAYER_START = { x: 30, y: 59 };
const EMPTY = 0;
const CLAIMED = 1;
const TRAIL = 2;

const LEVEL_ERRORS = {
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

const hex = (bytes) => "0x" + Buffer.from(bytes).toString("hex");
const readU16 = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1];
const readU32 = (bytes, offset) => readU16(bytes, offset) * 0x10000 + readU16(bytes, offset + 2);
const u16 = (value) => [value >> 8, value & 0xff];
const isBorder = (x, y) => x === 0 || y === 0 || x === WIDTH - 1 || y === WIDTH - 1;
const index = (x, y) => y * WIDTH + x;

function encodeLevel(level) {
  const bytes = new Uint8Array(LEVEL_LENGTH);
  bytes[0] = 1;
  for (const { x, y } of level.obstacles) {
    const cell = index(x, y);
    bytes[BITMAP_OFFSET + (cell >> 3)] |= 0x80 >> (cell & 7);
  }
  bytes.set([level.bossSize, ...level.spawnRect, level.bossPeriod, level.minions.length], 451);
  level.minions.forEach(({ x, y }, slot) => bytes.set([x, y], 458 + 2 * slot));
  bytes.set([level.minionPeriod, ...u16(level.respawnDelay), ...u16(level.timeLimit), level.lives, ...u16(level.target)], 464);
  return bytes;
}

function startGrid(levelBytes) {
  const grid = new Uint8Array(CELLS);
  for (let cell = 0; cell < CELLS; cell++) {
    const obstacle = (levelBytes[BITMAP_OFFSET + (cell >> 3)] >> (7 - (cell & 7))) & 1;
    grid[cell] = isBorder(cell % WIDTH, Math.floor(cell / WIDTH)) || obstacle ? CLAIMED : EMPTY;
  }
  return grid;
}

function isRail(grid, x, y) {
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

function openArea(grid) {
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

function validateLevel(bytes) {
  const e = LEVEL_ERRORS;
  if (bytes.length !== LEVEL_LENGTH) return e.length;
  if (bytes[0] !== 1) return e.version;
  const grid = startGrid(bytes);
  for (let cell = 0; cell < CELLS; cell++) {
    const x = cell % WIDTH;
    const y = Math.floor(cell / WIDTH);
    if (isBorder(x, y) && (bytes[BITMAP_OFFSET + (cell >> 3)] >> (7 - (cell & 7))) & 1) return e.borderObstacle;
  }
  const size = bytes[451];
  if (size < 2 || size > 8) return e.bossSize;
  const [x0, y0, x1, y1] = bytes.subarray(452, 456);
  if (x0 > x1 || y0 > y1) return e.spawnOrder;
  if (x0 < 1 || y0 < 1 || x1 > 59 - size || y1 > 59 - size) return e.spawnBounds;
  if (bytes[456] === 0) return e.bossPeriod;
  const minionCount = bytes[457];
  if (minionCount > 3) return e.minionCount;
  for (let slot = 0; slot < minionCount; slot++) {
    if (bytes[458 + 2 * slot] >= WIDTH || bytes[459 + 2 * slot] >= WIDTH) return e.minionSpawn;
  }
  for (let slot = minionCount; slot < 3; slot++) {
    if (bytes[458 + 2 * slot] || bytes[459 + 2 * slot]) return e.minionSlot;
  }
  if (bytes[464] > 0 !== minionCount > 0) return e.minionPeriod;
  if (readU16(bytes, 465) > 0 !== minionCount > 0) return e.respawnDelay;
  const timeLimit = readU16(bytes, 467);
  if (timeLimit < 1 || timeLimit > MAX_TICKS) return e.timeLimit;
  if (bytes[469] === 0) return e.lives;
  const target = readU16(bytes, 470);
  if (target < 1 || target > 10000) return e.target;

  const area = openArea(grid);
  if (!area.connected) return e.openAreaSplit;
  if (area.size < MIN_OPEN_AREA) return e.openAreaSmall;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) if (grid[index(x + dx, y + dy)] !== EMPTY) return e.bossSpawn;
      }
    }
  }
  for (let slot = 0; slot < minionCount; slot++) {
    if (!isRail(grid, bytes[458 + 2 * slot], bytes[459 + 2 * slot])) return e.minionSpawnRail;
  }
  if (!isRail(grid, PLAYER_START.x, PLAYER_START.y)) return e.playerStartRail;
  return 0;
}

const levelSeed = (runNonce, levelIndex) =>
  getBytes(keccak256(concat([toUtf8Bytes("jiro.level"), runNonce, new Uint8Array([levelIndex])])));

function bossStart(levelBytes, seed) {
  const [x0, y0, x1, y1] = levelBytes.subarray(452, 456);
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

function draw(runNonce) {
  const deck = Array.from({ length: 16 }, (_, slot) => slot);
  const swaps = [];
  for (let i = 0; i < 6; i++) {
    const hash = BigInt(keccak256(concat([toUtf8Bytes("jiro.draw"), runNonce, new Uint8Array([i])])));
    const j = i + Number(hash % BigInt(16 - i));
    swaps.push(j);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { swaps, slots: deck.slice(0, 6) };
}

function moveBoss(grid, boss) {
  const blocked = (cells) => cells.some((cell) => grid[cell] === CLAIMED || grid[cell] === TRAIL);
  const column = boss.vx > 0 ? boss.x + boss.size : boss.x - 1;
  const xEdge = Array.from({ length: boss.size }, (_, k) => index(column, boss.y + k));
  if (blocked(xEdge)) boss.vx = -boss.vx;
  else boss.x += boss.vx;
  const row = boss.vy > 0 ? boss.y + boss.size : boss.y - 1;
  const yEdge = Array.from({ length: boss.size }, (_, k) => index(boss.x + k, row));
  if (blocked(yEdge)) boss.vy = -boss.vy;
  else boss.y += boss.vy;
}

function statePreimage({ tick, mask, grid, player, boss, captured, claimable, nextEvent }) {
  const packedGrid = new Uint8Array(CELLS / 4);
  for (let cell = 0; cell < CELLS; cell++) packedGrid[cell >> 2] |= grid[cell] << (6 - 2 * (cell & 3));
  const playerBytes = [
    player.x, player.y, player.cutting, player.cutStart.x, player.cutStart.y,
    player.lives, player.shield, player.invulnerable, player.previousDirection, ...u16(player.pressTick),
  ];
  const bossBytes = [boss.x, boss.y, boss.size, boss.vx & 0xff, boss.vy & 0xff, boss.period];
  const minionSlots = new Uint8Array(3 * 7);
  return getBytes(concat([
    new Uint8Array([1, ...u16(tick), mask]),
    packedGrid,
    new Uint8Array(playerBytes),
    new Uint8Array(bossBytes),
    minionSlots,
    new Uint8Array([...u16(captured), ...u16(claimable), ...u16(nextEvent)]),
  ]));
}

function encodeJournal({ mode, runNonce, levelId, levelIndex, events }) {
  return getBytes(concat([
    new Uint8Array([1, ...u16(RULES_VERSION), mode]),
    runNonce,
    levelId,
    new Uint8Array([levelIndex, ...u16(events.length)]),
    ...events.map(({ tick, mask }) => new Uint8Array([...u16(tick), mask])),
  ]));
}

const openField = {
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
const blockedStart = { ...openField, obstacles: [{ x: 29, y: 58 }, { x: 30, y: 58 }, { x: 31, y: 58 }] };

const runNonce = getBytes(keccak256(toUtf8Bytes("jiro.example.9")));
const levelBytes = encodeLevel(openField);
const levelId = getBytes(keccak256(levelBytes));
const blockedBytes = encodeLevel(blockedStart);
const blockedByte = 3509 >> 3;
const seed = levelSeed(runNonce, 0);
const start = bossStart(levelBytes, seed);
const drawn = draw(runNonce);

const grid = startGrid(levelBytes);
const boss = { x: start.x, y: start.y, size: 5, vx: start.vx, vy: start.vy, period: 2 };
if (0 % boss.period === 0) moveBoss(grid, boss);
const preimage = statePreimage({
  tick: 0,
  mask: 0,
  grid,
  player: { ...PLAYER_START, cutting: 0, cutStart: PLAYER_START, lives: 3, shield: 1, invulnerable: 0, previousDirection: 0, pressTick: 0 },
  boss,
  captured: 0,
  claimable: openArea(grid).size,
  nextEvent: 0,
});
const journal = encodeJournal({ mode: 0, runNonce, levelId, levelIndex: 0, events: [] });
const sign = (v) => (v > 0 ? "+1" : "-1");

const lines = [
  `open-field level bytes 451-471: ${hex(levelBytes.subarray(451))}`,
  `open-field level_id: ${hex(levelId)}`,
  `open-field validity: ${validateLevel(levelBytes)}`,
  `blocked-start bitmap byte ${blockedByte}: ${hex(blockedBytes.subarray(BITMAP_OFFSET + blockedByte, BITMAP_OFFSET + blockedByte + 1))}`,
  `blocked-start validity: ${validateLevel(blockedBytes)}`,
  `runNonce: ${hex(runNonce)}`,
  `level seed (levelIndex 0): ${hex(seed)}`,
  `boss start: candidates ${start.candidates}, index ${start.pick}, top-left (${start.x}, ${start.y}), vx ${sign(start.vx)}, vy ${sign(start.vy)}`,
  `draw j: ${drawn.swaps.join(", ")}`,
  `draw slots: ${drawn.slots.join(", ")}`,
  `open-field-empty journal: ${hex(journal)}`,
  `open-field-empty tick 0 boss: top-left (${boss.x}, ${boss.y}), vx ${sign(boss.vx)}, vy ${sign(boss.vy)}`,
  `open-field-empty tick 0 preimage length: ${preimage.length}`,
  `open-field-empty tick 0 state hash: ${keccak256(preimage)}`,
];

const checkIndex = process.argv.indexOf("--check");
if (checkIndex === -1) {
  console.log(lines.join("\n"));
} else {
  const readmePath = process.argv[checkIndex + 1];
  if (!readmePath) throw new Error("usage: worked-examples.mjs --check <README.md>");
  const readme = readFileSync(readmePath, "utf8");
  const missing = lines.filter((line) => !readme.includes(line));
  for (const line of missing) console.log(`missing from ${readmePath}: ${line}`);
  process.exit(missing.length ? 1 : 0);
}
