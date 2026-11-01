import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, test } from "node:test";
import { assertDeploymentRecord, prependGeneration, readDeploymentRecord } from "./deployments.mjs";

const OLDER = {
  deployedAt: "2026-11-01T10:00:00.000Z",
  sourceCommit: "5fdebf579c9e2dfed08edf11bc21136bd89575bd",
  backend: "mock",
  operator: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  treasury: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  ArbSys: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  ArbBlockhashEntropy: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  Referee: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  Season: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  Challenge: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  seasons: { local: 1 },
};
const NEWER = {
  ...OLDER,
  deployedAt: "2026-11-01T11:00:00.000Z",
  ArbSys: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  ArbBlockhashEntropy: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
  Referee: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
  Season: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
  Challenge: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
  seasons: {},
};
const recordOf = (...generations) => ({ network: "local", chainId: 31337, generations });

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "deployments-test-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("a record of two generations, newest first, matches the schema", () => {
  assert.doesNotThrow(() => assertDeploymentRecord(recordOf(NEWER, OLDER)));
});

test("generations listed oldest first are refused", () => {
  assert.throws(() => assertDeploymentRecord(recordOf(OLDER, NEWER)), /newest first/);
});

test("a record with no generation is refused", () => {
  assert.throws(() => assertDeploymentRecord(recordOf()), /non-empty list/);
});

test("a generation missing a contract is refused", () => {
  const { Challenge, ...withoutChallenge } = NEWER;
  assert.throws(() => assertDeploymentRecord(recordOf(withoutChallenge)), /misses Challenge/);
});

test("a generation with an unknown key is refused", () => {
  assert.throws(() => assertDeploymentRecord(recordOf({ ...NEWER, MockUSDC: NEWER.Season })), /unknown keys MockUSDC/);
});

test("an address that is not checksummed is refused", () => {
  assert.throws(() => assertDeploymentRecord(recordOf({ ...NEWER, Season: NEWER.Season.toLowerCase() })), /not checksummed/);
});

test("an unknown backend is refused", () => {
  assert.throws(() => assertDeploymentRecord(recordOf({ ...NEWER, backend: "zkvm" })), /backend/);
});

test("a season number below 1 is refused", () => {
  assert.throws(() => assertDeploymentRecord(recordOf({ ...NEWER, seasons: { local: 0 } })), /not a season number/);
});

test("prependGeneration keeps the earlier generations as they were", () => {
  const file = join(dir, "local.json");
  writeFileSync(file, JSON.stringify(recordOf(OLDER)));
  prependGeneration(file, "local", 31337, NEWER);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), recordOf(NEWER, OLDER));
});

test("prependGeneration refuses a record of another chain", () => {
  const file = join(dir, "local.json");
  writeFileSync(file, JSON.stringify(recordOf(OLDER)));
  assert.throws(() => prependGeneration(file, "local", 412346, NEWER), /records chain 31337/);
});

test("a record whose network does not name its file is refused", () => {
  const file = join(dir, "nitro-devnode.json");
  writeFileSync(file, JSON.stringify(recordOf(OLDER)));
  assert.throws(() => readDeploymentRecord(file), /does not name the file/);
});

test("the CLI started through a symlinked directory still runs", () => {
  const link = join(dir, "contracts");
  symlinkSync(dirname(fileURLToPath(import.meta.url)), link);
  const run = spawnSync(process.execPath, [join(link, "deployments.mjs")], { encoding: "utf8" });
  assert.match(run.stderr, /usage: node deployments.mjs/);
});
