import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { REPO_ROOT } from "./deploy.mjs";
import { proofOf, runInputs, vectorInputs } from "./verify-proof.mjs";

const RUN_FILE = join(REPO_ROOT, "seasons", "testnet-0", "runs", "run-1.json");
const SEASON_FILE = join(REPO_ROOT, "seasons", "testnet-0.json");
const PROOF_FILE = join(REPO_ROOT, "seasons", "testnet-0", "runs", "run-1.proof.json");
const vectorFile = (name) => join(REPO_ROOT, "vectors", "levels", `${name}.json`);

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "verify-proof-test-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("a run file's levels are scored with its season's weights of their drawn slots", () => {
  const { drawSlots } = JSON.parse(readFileSync(RUN_FILE, "utf8"));
  const { weightsBp } = JSON.parse(readFileSync(SEASON_FILE, "utf8"));
  assert.deepEqual(runInputs(RUN_FILE, SEASON_FILE).weightsBp, drawSlots.map((slot) => weightsBp[slot]));
});

test("six game vectors give their own levels, journals and weights, in order", () => {
  const names = ["10-worst", "16-worst", "04-worst", "08-worst", "03-worst", "14-synthetic"];
  const vectors = names.map((name) => JSON.parse(readFileSync(vectorFile(name), "utf8")));
  assert.deepEqual(vectorInputs(names.map(vectorFile)), {
    levels: vectors.map(({ level }) => level),
    journals: vectors.map(({ journal }) => journal),
    weightsBp: vectors.map(({ weightBp }) => weightBp),
  });
});

test("five game vectors are refused: a run is six", () => {
  assert.throws(() => vectorInputs(["10-worst", "16-worst", "04-worst", "08-worst", "03-worst"].map(vectorFile)), /a run is 6 game vectors, not 5/);
});

test("a proof is read from zk-host prove's output as from realProof's file", () => {
  const proof = JSON.parse(readFileSync(PROOF_FILE, "utf8"));
  const output = join(dir, "prove.log");
  writeFileSync(output, `segments: 13\n=== BEGIN zk-fixture ===\n${JSON.stringify(proof)}\n=== END zk-fixture ===\n`);
  assert.deepEqual(proofOf(output), proofOf(PROOF_FILE));
});
