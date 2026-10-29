// Computes the worked examples of README §5, §6.3, §6.4, §7.2 and §8.2 independently of
// the Rust core. With --check <README>, exits 1 unless each printed line's label starts
// exactly one README line, and that line equals the printed one.
import { readFileSync } from "node:fs";
import { concat, keccak256, toUtf8Bytes, getBytes, toBeHex, zeroPadValue } from "ethers";

const WIDTH = 60;
const CELLS = WIDTH * WIDTH;
const MIN_OPEN_AREA = 1682;
const MAX_TICKS = 2700;
const TICKS_PER_SECOND = 15;
const RULES_VERSION = 1;
const LEVEL_VERSION = 1;
const JOURNAL_VERSION = 1;
const STATE_HASH_VERSION = 1;
const PLAYER_START = { x: 30, y: 59 };
const EMPTY = 0;
const CLAIMED = 1;
const TRAIL = 2;

const LEVEL = {
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
const isObstacle = (levelBytes, cell) => (levelBytes[LEVEL.bitmap + (cell >> 3)] >> (7 - (cell & 7))) & 1;
const spawnRect = (levelBytes) => levelBytes.subarray(LEVEL.spawnRect, LEVEL.spawnRect + 4);
const minionSpawn = (levelBytes, slot) => ({
  x: levelBytes[LEVEL.minionSpawns + 2 * slot],
  y: levelBytes[LEVEL.minionSpawns + 2 * slot + 1],
});

function encodeLevel(level) {
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

function startGrid(levelBytes) {
  const grid = new Uint8Array(CELLS);
  for (let cell = 0; cell < CELLS; cell++) {
    const border = isBorder(cell % WIDTH, Math.floor(cell / WIDTH));
    grid[cell] = border || isObstacle(levelBytes, cell) ? CLAIMED : EMPTY;
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

const u256 = (value) => getBytes(zeroPadValue(toBeHex(value), 32));
const runNonceOf = (entropy, runId) => getBytes(keccak256(concat([toUtf8Bytes("jiro.run"), entropy, u256(runId)])));
const deadline = (revealedAt, ticksUsed, commitSlack) => {
  const ticks = ticksUsed.reduce((sum, used) => sum + used, 0);
  return revealedAt + Math.floor((ticks + TICKS_PER_SECOND - 1) / TICKS_PER_SECOND) + commitSlack;
};

const levelSeed = (runNonce, levelIndex) =>
  getBytes(keccak256(concat([toUtf8Bytes("jiro.level"), runNonce, new Uint8Array([levelIndex])])));

function bossStart(levelBytes, seed) {
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

function fmix32(h) {
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const deflectionKey = (seed) => readU32(seed, 5);
const deflectionDraw = (key, tick) => fmix32((key ^ tick) >>> 0) >>> 26;

function moveBoss(grid, boss, key, tick) {
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

function playBoss(grid, boss, key, timeLimit) {
  const deflections = [];
  for (let tick = 0; tick < timeLimit; tick++) {
    if (tick % boss.period !== 0) continue;
    const draw = moveBoss(grid, boss, key, tick);
    if (draw < 2) deflections.push({ tick, draw, x: boss.x, y: boss.y, vx: boss.vx, vy: boss.vy });
  }
  return deflections;
}

function statePreimage({ tick, mask, grid, player, boss, captured, claimable, nextEvent }) {
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

function encodeJournal({ mode, runNonce, levelId, levelIndex, events }) {
  return getBytes(concat([
    new Uint8Array([JOURNAL_VERSION, ...u16(RULES_VERSION), mode]),
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
const wideSpawn = { ...openField, spawnRect: [20, 20, 34, 25] };

const runNonce = getBytes(keccak256(toUtf8Bytes("jiro.example.9")));
const levelBytes = encodeLevel(openField);
const levelId = getBytes(keccak256(levelBytes));
const blockedBytes = encodeLevel(blockedStart);
const blockedByte = index(blockedStart.obstacles[0].x, blockedStart.obstacles[0].y) >> 3;
const seed = levelSeed(runNonce, 0);
const start = bossStart(levelBytes, seed);
const startLevel2 = bossStart(levelBytes, levelSeed(runNonce, 2));
const startWide = bossStart(encodeLevel(wideSpawn), seed);
const drawn = draw(runNonce);

const tick = 0;
const grid = startGrid(levelBytes);
const key = deflectionKey(seed);
const bossAtStart = { x: start.x, y: start.y, size: openField.bossSize, vx: start.vx, vy: start.vy, period: openField.bossPeriod };
const boss = { ...bossAtStart };
if (tick % boss.period === 0) moveBoss(grid, boss, key, tick);
const bossAtEnd = { ...bossAtStart };
const deflections = playBoss(grid, bossAtEnd, key, openField.timeLimit);
const preimage = statePreimage({
  tick,
  mask: 0,
  grid,
  player: {
    ...PLAYER_START,
    cutting: 0,
    cutStart: PLAYER_START,
    lives: openField.lives,
    shield: 1,
    invulnerable: 0,
    previousDirection: 0,
    pressTick: 0,
  },
  boss,
  captured: 0,
  claimable: openArea(grid).size,
  nextEvent: 0,
});
const journal = encodeJournal({ mode: 0, runNonce, levelId, levelIndex: 0, events: [] });
const entropy = getBytes(keccak256(toUtf8Bytes("jiro.example.entropy")));
const deadlineExample = { revealedAt: 1_000_000, ticksUsed: [1, 2700, 1800, 900, 15, 16], commitSlack: 120 };
const number = (value) => value.toLocaleString("en-US");
const sign = (value) => (value > 0 ? "+1" : "-1");
const describeStart = ({ candidates, pick, x, y, vx, vy }) =>
  `candidates ${candidates}, index ${pick}, top-left (${x}, ${y}), vx ${sign(vx)}, vy ${sign(vy)}`;
const hex32 = (value) => "0x" + value.toString(16).padStart(8, "0");
const describeBoss = ({ x, y, vx, vy }) => `top-left (${x}, ${y}), vx ${sign(vx)}, vy ${sign(vy)}`;
const describeDeflection = ({ tick, draw, ...after }) =>
  `tick ${tick}, r ${draw} inverts ${draw === 0 ? "vx" : "vy"}; boss after the move: ${describeBoss(after)}`;
const tick0Draw = deflectionDraw(key, 0);

const lines = [
  `open-field level bytes 451-471: ${hex(levelBytes.subarray(LEVEL.bossSize))}`,
  `open-field level_id: ${hex(levelId)}`,
  `open-field validity: ${validateLevel(levelBytes)}`,
  `blocked-start bitmap byte ${blockedByte}: ${hex(blockedBytes.subarray(LEVEL.bitmap + blockedByte, LEVEL.bitmap + blockedByte + 1))}`,
  `blocked-start validity: ${validateLevel(blockedBytes)}`,
  `runNonce: ${hex(runNonce)}`,
  `level seed (levelIndex 0): ${hex(seed)}`,
  `boss start: ${describeStart(start)}`,
  `boss start (levelIndex 2): ${describeStart(startLevel2)}`,
  `boss start (spawn rectangle (20, 20) to (34, 25)): ${describeStart(startWide)}`,
  `deflection key (levelIndex 0): ${hex32(key)}`,
  `fmix32 test values: fmix32(0x00000000) ${hex32(fmix32(0))}, fmix32(0x00000001) ${hex32(fmix32(1))}, fmix32(0xffffffff) ${hex32(fmix32(0xffffffff))}`,
  `draw j: ${drawn.swaps.join(", ")}`,
  `draw slots: ${drawn.slots.join(", ")}`,
  `open-field-empty journal: ${hex(journal)}`,
  `open-field-empty tick 0 boss: top-left (${boss.x}, ${boss.y}), vx ${sign(boss.vx)}, vy ${sign(boss.vy)}`,
  `open-field-empty tick 0 preimage length: ${preimage.length}`,
  `open-field-empty tick 0 state hash: ${keccak256(preimage)}`,
  `open-field-empty tick 0 deflection draw: fmix32(${hex32(key)}) ${hex32(fmix32(key))}, r ${tick0Draw}, ${tick0Draw < 2 ? "deflection" : "no deflection"}`,
  `open-field-empty first deflection: ${describeDeflection(deflections[0])}`,
  `open-field-empty second deflection: ${describeDeflection(deflections[1])}`,
  `open-field-empty boss after tick ${openField.timeLimit - 1}: ${describeBoss(bossAtEnd)}, after ${deflections.length} deflections`,
  `run nonce entropy: ${hex(entropy)}`,
  `run nonce (runId 1): ${hex(runNonceOf(entropy, 1))}`,
  `deadline (revealedAt ${number(deadlineExample.revealedAt)}, ticks used ${deadlineExample.ticksUsed.map(number).join(" + ")}, commitSlack ${deadlineExample.commitSlack}): ${number(deadline(deadlineExample.revealedAt, deadlineExample.ticksUsed, deadlineExample.commitSlack))}`,
];

const [flag, readmePath, ...extra] = process.argv.slice(2);
if (flag === undefined) {
  console.log(lines.join("\n"));
} else {
  if (flag !== "--check" || !readmePath || extra.length) throw new Error("usage: worked-examples.mjs [--check <README.md>]");
  const readmeLines = readFileSync(readmePath, "utf8").split("\n").map((line) => line.trim());
  const mismatched = lines.filter((line) => {
    const label = line.slice(0, line.indexOf(": ") + 2);
    const found = readmeLines.filter((readmeLine) => readmeLine.startsWith(label));
    return found.length !== 1 || found[0] !== line;
  });
  for (const line of mismatched) console.log(`not exactly once in ${readmePath}: ${line}`);
  process.exit(mismatched.length ? 1 : 0);
}
