import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { REPO_ROOT } from "./deploy.mjs";
import { encodeProof, liveContext, realProof } from "./e2e.mjs";

const E2E = fileURLToPath(new URL("./e2e.mjs", import.meta.url));
const RUN_PROOF = JSON.parse(readFileSync(join(REPO_ROOT, "contracts", "test", "fixtures", "zk-proofs.json"), "utf8")).challengeRun;
const ZK_GENERATION = {
  deployedAt: "2026-11-03T10:00:00.000Z",
  sourceCommit: "7023fee140515953c989b5394a54242423d543db",
  backend: "zk",
  operator: "0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496",
  treasury: "0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496",
  ArbSys: "0x0000000000000000000000000000000000000064",
  ArbBlockhashEntropy: "0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f",
  Referee: "0x2e234DAe75C793f67A35089C9d99245E1C58470b",
  Season: "0xF62849F9A0B5Bf2913b396098F7c7019b51A820a",
  Challenge: "0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9",
  seasons: {},
};

let dir;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "e2e-test-"))));
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.RISC0_DEV_MODE;
});

function recordFileWith(generation) {
  const file = join(dir, "arbitrum-sepolia.json");
  writeFileSync(file, JSON.stringify({ network: "arbitrum-sepolia", chainId: 421614, generations: [generation] }));
  return file;
}

const e2e = (...args) => spawnSync(process.execPath, [E2E, ...args], { encoding: "utf8" });

test("arbitrum-sepolia without --cases is refused before anything builds", () => {
  assert.match(e2e("--network", "arbitrum-sepolia").stderr, /usage: .*--network arbitrum-sepolia --cases/s);
});

test("an unknown live case is refused", () => {
  assert.match(e2e("--network", "arbitrum-sepolia", "--cases", "happy-path,settle-level").stderr, /usage:/);
});

test("--cases is refused on the local chains, which run the whole suite", () => {
  assert.match(e2e("--network", "local", "--cases", "happy-path").stderr, /usage:/);
});

test("the live cases refuse a generation where testnet-0 is not open", async () => {
  await assert.rejects(liveContext({ recordFile: recordFileWith(ZK_GENERATION), seasonLabel: "testnet-0" }), /no season testnet-0: open it with season.mjs open/);
});

test("the live cases refuse a generation whose referee takes no zk proof", async () => {
  const stylus = { ...ZK_GENERATION, backend: "stylus", seasons: { "testnet-0": 1 } };
  await assert.rejects(liveContext({ recordFile: recordFileWith(stylus), seasonLabel: "testnet-0" }), /backend is stylus/);
});

test("a proof made earlier is reused from <run file>.proof.json", () => {
  const runFile = join(dir, "run-1.json");
  writeFileSync(join(dir, "run-1.proof.json"), JSON.stringify({ seal: RUN_PROOF.seal, publicValues: RUN_PROOF.publicValues }));
  assert.equal(realProof(runFile), encodeProof(RUN_PROOF));
});

test("a real proof is refused under RISC0_DEV_MODE, whose seals never verify on Arbitrum Sepolia", () => {
  process.env.RISC0_DEV_MODE = "1";
  assert.throws(() => realProof(join(dir, "run-1.json")), /RISC0_DEV_MODE is set/);
});
