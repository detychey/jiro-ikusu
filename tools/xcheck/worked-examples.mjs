// Computes the worked examples of README §5, §6.3, §6.4, §7.2 and §8.2 independently of
// the Rust core. With --check <README>, exits 1 unless each printed line's label starts
// exactly one README line, and that line equals the printed one.
import { readFileSync } from "node:fs";
import { keccak256, getBytes } from "ethers";
import {
  PLAYER_START,
  LEVEL,
  hex,
  index,
  spawnRect,
  encodeLevel,
  startGrid,
  openArea,
  validateLevel,
  runNonceOf,
  deadline,
  levelSeed,
  bossStart,
  draw,
  fmix32,
  deflectionKey,
  deflectionDraw,
  moveBoss,
  playBoss,
  statePreimage,
  encodeJournal,
  openField,
  blockedStart,
  wideSpawn,
  exampleRunNonce,
  exampleEntropy,
} from "./lib.mjs";

const runNonce = exampleRunNonce;
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
  `run nonce entropy: ${hex(exampleEntropy)}`,
  `run nonce (runId 1): ${hex(runNonceOf(exampleEntropy, 1))}`,
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
