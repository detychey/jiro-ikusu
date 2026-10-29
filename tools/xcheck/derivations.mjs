// Writes vectors/derivations.json (README §6.6): level seeds and deflection keys, level ids,
// boss starts, draws and run commitments, computed with ethers independently of the core.
// Usage: node derivations.mjs [--write]; without --write, prints the fixture.
import { writeFileSync } from "node:fs";
import { getBytes, keccak256, solidityPackedKeccak256, toUtf8Bytes } from "ethers";
import { bossStart, deflectionKey, draw, encodeJournal, encodeLevel, hex, levelSeed } from "./lib.mjs";

const FIXTURE = new URL("../../vectors/derivations.json", import.meta.url);

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
const levels = {
  "open-field": openField,
  "blocked-start": { ...openField, obstacles: [{ x: 29, y: 58 }, { x: 30, y: 58 }, { x: 31, y: 58 }] },
  "wide-spawn": { ...openField, spawnRect: [20, 20, 34, 25] },
  "walls-and-minions": {
    ...openField,
    obstacles: [...Array(20).keys()].map((k) => ({ x: 10 + k, y: 15 })).concat([{ x: 45, y: 40 }, { x: 46, y: 40 }]),
    bossSize: 8,
    spawnRect: [30, 25, 40, 31],
    bossPeriod: 3,
    minions: [{ x: 0, y: 0 }, { x: 59, y: 30 }, { x: 12, y: 0 }],
    minionPeriod: 2,
    respawnDelay: 300,
    timeLimit: 1800,
    lives: 5,
    target: 8000,
  },
};

const exampleNonce = getBytes(keccak256(toUtf8Bytes("jiro.example.9")));
const fixtureNonce = (k) => getBytes(solidityPackedKeccak256(["string", "uint16"], ["jiro.fixture.nonce", k]));
const nonces = [exampleNonce, ...[...Array(99).keys()].map(fixtureNonce)];

const levelSeeds = nonces.slice(0, 10).flatMap((runNonce) =>
  [0, 1, 2, 3, 4, 5].map((levelIndex) => {
    const seed = levelSeed(runNonce, levelIndex);
    return { runNonce: hex(runNonce), levelIndex, seed: hex(seed), deflectionKey: deflectionKey(seed) };
  }),
);

const levelIds = Object.entries(levels).map(([name, level]) => {
  const bytes = encodeLevel(level);
  return { name, level: hex(bytes), levelId: keccak256(bytes) };
});

const rectangles = [
  [20, 20, 34, 34],
  [20, 20, 34, 25],
  [30, 30, 30, 30],
  [10, 20, 12, 40],
  [1, 1, 57, 57],
  [1, 1, 51, 51],
  [21, 20, 20, 34],
];
// Each rectangle gets the worked example's seeds for levelIndex 0 and 2, then 8 more.
const seedsFor = (r) => [0, 2, ...[...Array(8).keys()].map((k) => (10 + 8 * r + k) % levelSeeds.length)];
const bossStarts = rectangles.flatMap(([x0, y0, x1, y1], r) =>
  seedsFor(r).map((s) => levelSeeds[s]).map(({ seed }) => {
    const spawn = { x0, y0, x1, y1 };
    if (x0 > x1 || y0 > y1) return { spawn, seed, start: null };
    const level = encodeLevel({ ...openField, spawnRect: [x0, y0, x1, y1] });
    const { candidates, pick, x, y, vx, vy } = bossStart(level, getBytes(seed));
    return { spawn, seed, start: { candidates, index: pick, x, y, vx, vy } };
  }),
);

const draws = nonces.map((runNonce) => {
  const { swaps, slots } = draw(runNonce);
  return { runNonce: hex(runNonce), j: swaps, slots };
});

const openFieldId = getBytes(levelIds[0].levelId);
const runs = [
  { runNonce: exampleNonce, mode: 1, events: () => [] },
  { runNonce: nonces[1], mode: 1, events: (k) => [{ tick: k, mask: 0x01 }, { tick: 100 + k, mask: 0x11 }] },
  { runNonce: nonces[2], mode: 0, events: (k) => (k % 2 ? [{ tick: 0, mask: 0x40 }] : []) },
];
const runCommitments = runs.map(({ runNonce, mode, events }) => {
  const journals = [0, 1, 2, 3, 4, 5].map((levelIndex) =>
    encodeJournal({ mode, runNonce, levelId: openFieldId, levelIndex, events: events(levelIndex) }),
  );
  const journalHashes = journals.map((journal) => keccak256(journal));
  const runCommitment = solidityPackedKeccak256(Array(6).fill("bytes32"), journalHashes);
  return { journals: journals.map(hex), journalHashes, runCommitment };
});

const fixture = JSON.stringify({ levelSeeds, levelIds, bossStarts, draws, runCommitments }, null, 2) + "\n";
if (process.argv[2] === "--write") writeFileSync(FIXTURE, fixture);
else if (process.argv.length > 2) throw new Error("usage: derivations.mjs [--write]");
else process.stdout.write(fixture);
