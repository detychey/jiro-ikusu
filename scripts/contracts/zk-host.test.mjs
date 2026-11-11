import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { REPO_ROOT } from "./deploy.mjs";
import { encodeProof, realProof } from "./zk-host.mjs";

const RUN_PROOF = JSON.parse(readFileSync(join(REPO_ROOT, "contracts", "test", "fixtures", "zk-proofs.json"), "utf8")).challengeRun;
const SEASON_FILE = join(REPO_ROOT, "seasons", "testnet-0.json");

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
