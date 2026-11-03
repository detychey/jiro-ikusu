import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { REPO_ROOT } from "./deploy.mjs";
import { checkLevels, readSeasonFile, seasonParamsOf } from "./season.mjs";

const TESTNET_0 = join(REPO_ROOT, "seasons", "testnet-0.json");
const testnet0 = () => JSON.parse(readFileSync(TESTNET_0, "utf8"));

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "season-test-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function seasonFileWith(changes) {
  const file = join(dir, "testnet-0.json");
  writeFileSync(file, JSON.stringify({ ...testnet0(), ...changes }));
  return file;
}

test("seasons/testnet-0.json holds plan M4.14's provisional season, its referee left to the deployment", () => {
  const { network, referee, runFee, length, grace, commitSlack, minClears } = readSeasonFile(TESTNET_0);
  assert.deepEqual(
    { network, referee, runFee, length, grace, commitSlack, minClears },
    { network: "arbitrum-sepolia", referee: null, runFee: "50000000000000", length: 86_400, grace: 86_400, commitSlack: 120, minClears: 1 },
  );
});

test("a season file with weights other than its calibration file's is refused", () => {
  const weightsBp = testnet0().weightsBp.map((weight, slot) => (slot === 3 ? weight + 1 : weight));
  assert.throws(() => readSeasonFile(seasonFileWith({ weightsBp })), /its weightsBp are not those of seasons\/calibration-1.json/);
});

test("a season file with an unknown key is refused", () => {
  assert.throws(() => readSeasonFile(seasonFileWith({ season: 1 })), /unknown keys season/);
});

test("a season file whose runFee is a number is refused", () => {
  assert.throws(() => readSeasonFile(seasonFileWith({ runFee: 50_000_000_000_000 })), /not a decimal string of wei/);
});

test("Season.open's parameters take the deployed referee and the fee in wei", () => {
  const referee = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const params = seasonParamsOf(readSeasonFile(TESTNET_0), referee);
  assert.deepEqual([params.referee, params.runFee, params.length, params.minClears], [referee, 50_000_000_000_000n, 86_400n, 1]);
});

test("checkLevels refuses a level id that no level of levels/ has", () => {
  const ids = testnet0().levelIds;
  const run = ([command]) => (command === "level" ? ids.slice(1).map((id, i) => `${id} levels/${i}.bin`).join("\n") : "");
  assert.throws(() => checkLevels(ids, run), new RegExp(`no valid level of levels/ has the id ${ids[0]}`));
});
