import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPrivateKey, parseStylusDeploy } from "./deploy.mjs";

const ADDRESS = "0xA6E41fFD769491a42A6e5Ce453259b93983a22EF";
const DEPLOY_TX = `0x${"11".repeat(32)}`;
const ACTIVATE_TX = `0x${"22".repeat(32)}`;
const DEPLOYED = `deployed code at address: ${ADDRESS}\ndeployment tx hash: ${DEPLOY_TX}\n`;

test("a malformed DEPLOYER_KEY is refused without quoting it", () => {
  const key = `0x${"ab".repeat(31)}c\r`;
  assert.throws(
    () => assertPrivateKey("DEPLOYER_KEY", key, "nitro-devnode"),
    (error) => /0x and 64 hex digits/.test(error.message) && !error.message.includes(key.slice(2, 20)),
  );
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
