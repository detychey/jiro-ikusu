import assert from "node:assert/strict";
import { test } from "node:test";
import { NETWORKS, deployContracts, parseStylusDeploy, privateKeyOf, riscZeroVerifierOf } from "./deploy.mjs";

const ADDRESS = "0xA6E41fFD769491a42A6e5Ce453259b93983a22EF";
const DEPLOY_TX = `0x${"11".repeat(32)}`;
const ACTIVATE_TX = `0x${"22".repeat(32)}`;
const DEPLOYED = `deployed code at address: ${ADDRESS}\ndeployment tx hash: ${DEPLOY_TX}\n`;

test("a malformed DEPLOYER_KEY is refused without quoting it", () => {
  const key = `0x${"ab".repeat(31)}c\r`;
  assert.throws(
    () => privateKeyOf("DEPLOYER_KEY", key, "nitro-devnode"),
    (error) => /64 hex digits, with or without 0x/.test(error.message) && !error.message.includes(key.slice(2, 20)),
  );
});

test("a key without 0x is returned with it", () => {
  assert.equal(privateKeyOf("TESTER_KEY", "ab".repeat(32), "arbitrum-sepolia"), `0x${"ab".repeat(32)}`);
});

test("a key with 0x is returned as it is", () => {
  assert.equal(privateKeyOf("TESTER_KEY", `0x${"ab".repeat(32)}`, "arbitrum-sepolia"), `0x${"ab".repeat(32)}`);
});

test("a first deployment's output gives the referee's deployment and activation", () => {
  const output = `${DEPLOYED}successfully activated contract ${ADDRESS} with tx ${ACTIVATE_TX}\n`;
  assert.deepEqual(parseStylusDeploy(output), { address: ADDRESS, deployTx: DEPLOY_TX, activateTx: ACTIVATE_TX });
});

test("a deployment of an already activated wasm gives no activation transaction", () => {
  const output = `${DEPLOYED}wasm already activated!\n`;
  assert.deepEqual(parseStylusDeploy(output), { address: ADDRESS, deployTx: DEPLOY_TX, activateTx: null });
});

test("a deployment that neither activated nor found the wasm activated is refused", () => {
  assert.throws(() => parseStylusDeploy(DEPLOYED), /did not activate the referee/);
});

test("the zk backend is refused without the verify program's image id", async () => {
  await assert.rejects(deployContracts({ network: "local", backend: "zk", rulesVersion: 2 }), /needs the verify program's image id/);
});

test("a chain with no pinned RISC Zero verifier is refused", () => {
  assert.throws(() => riscZeroVerifierOf(412346), /no RISC Zero verifier is pinned for chain 412346/);
});

test("the mock backend is refused on arbitrum-sepolia", async () => {
  await assert.rejects(deployContracts({ network: "arbitrum-sepolia", backend: "mock", rulesVersion: 2 }), /arbitrum-sepolia refuses the mock backend/);
});

test("ZkReferee on arbitrum-sepolia calls RISC Zero's emergency stop over its 3.0 Groth16 verifier", () => {
  assert.equal(riscZeroVerifierOf(NETWORKS["arbitrum-sepolia"].chainId), "0x724d375B5b622e15f0E64e9Deb76a4cB17877797");
});
