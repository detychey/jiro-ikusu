import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { REPO_ROOT } from "./deploy.mjs";
import { encodeProof, proveRunArgs, realProof } from "./zk-host.mjs";

const FIXTURES = JSON.parse(readFileSync(join(REPO_ROOT, "contracts", "test", "fixtures", "zk-proofs.json"), "utf8"));
const RUN_PROOF = FIXTURES.challengeRun;
const SEASON_FILE = join(REPO_ROOT, "seasons", "testnet-0.json");
const RUNS_DIR = join(REPO_ROOT, "seasons", "testnet-0", "runs");
const RUN_1_PROOF_OF_RECORD = JSON.parse(readFileSync(join(RUNS_DIR, "run-1.proof.json"), "utf8"));
const RUN_1_RISC0_31_PROOF = JSON.parse(readFileSync(join(RUNS_DIR, "run-1.risc0-3.1.proof.json"), "utf8"));

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "zk-host-test-"))));
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.RISC0_DEV_MODE;
});

test("a proof made earlier is reused from <run file>.proof.json", () => {
  const runFile = join(dir, "run-1.json");
  writeFileSync(join(dir, "run-1.proof.json"), JSON.stringify({ seal: RUN_PROOF.seal, publicValues: RUN_PROOF.publicValues }));
  assert.equal(realProof(runFile, SEASON_FILE), encodeProof(RUN_PROOF));
});

test("a real proof is refused under RISC0_DEV_MODE, whose seals never verify on Arbitrum Sepolia", () => {
  process.env.RISC0_DEV_MODE = "1";
  assert.throws(() => realProof(join(dir, "run-1.json"), SEASON_FILE), /RISC0_DEV_MODE is set/);
});

test("a run is proven in zk-host's default segments unless a size is given", () => {
  assert.deepEqual(proveRunArgs("run-1.json", "testnet-1.json"), ["prove", "--run", "run-1.json", "--season", "testnet-1.json"]);
});

test("a run is proven in segments of 2^n cycles with --segment-po2 n", () => {
  assert.deepEqual(proveRunArgs("run-1.json", "testnet-1.json", 19).slice(-2), ["--segment-po2", "19"]);
});

test("every committed real proof is a 3.1.0 Groth16 proof", () => {
  for (const { seal } of [...Object.values(FIXTURES), RUN_1_RISC0_31_PROOF]) assert.match(seal, /^0xe71e6620[0-9a-f]{512}$/);
});

// The fixtures share the image id they were proven with. Run 1, a rules-version-2 run of
// testnet-0, keeps generation 2's image id, since no later image proves rules version 2.
test("the proof fixtures share one image id", () => {
  assert.equal(new Set(Object.values(FIXTURES).map(({ imageId }) => imageId)).size, 1);
});

test("run 1's proof keeps the image id of generation 2, which proved it", () => {
  assert.equal(RUN_1_RISC0_31_PROOF.imageId, "0xc9634ada0eab5e9a7bb0a9ddce14df5634f7dddd2caac79416ae3cd8eda915a8");
});

test("run 1's 3.1.0 proof commits the public values of its 3.0 proof of record", () => {
  assert.equal(RUN_1_RISC0_31_PROOF.publicValues, RUN_1_PROOF_OF_RECORD.publicValues);
});
