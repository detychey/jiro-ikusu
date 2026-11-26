import assert from "node:assert/strict";
import { test } from "node:test";
import { AbiCoder, Interface, getAddress } from "ethers";
import { RISC_ZERO_GROTH16_VERIFIER, checkRiscZeroVerifier } from "./deploy.mjs";
import { checkAccounts, checkBackend, checkChain, isReady, preflight } from "./preflight.mjs";

const DEPLOYER = "0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E";
const TESTER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const OTHER_CHAINS = [1n, 42161n, 42170n, 11155111n, 31338n, 412345n];

const ESTOP = "0xA1DCB16cb765b3CA71605339F0C37Bfe0F60bA29";
const REFEREE = "0x1097BDED737146D4A83Cf969a357e504FA028c5a";
const VIEWS = new Interface(["function paused() view returns (bool)", "function verifier() view returns (address)", "function SELECTOR() view returns (bytes4)"]);

/**
 * A provider whose eth_calls answer the ZkReferee's, the emergency stop's and the Groth16 verifier's
 * views from `views`: `verifier()` is `refereeVerifier` at REFEREE, `verifier` elsewhere.
 */
function stubProvider(chainId, balances = {}, views = {}) {
  const answers = { paused: false, verifier: RISC_ZERO_GROTH16_VERIFIER, refereeVerifier: ESTOP, SELECTOR: "0xe71e6620", code: "0x6080", ...views };
  return {
    getNetwork: async () => ({ chainId }),
    getBalance: async (address) => balances[address] ?? 1n,
    getCode: async () => answers.code,
    call: async ({ to, data }) => {
      const { name, outputs } = VIEWS.getFunction(data.slice(0, 10));
      const answer = name === "verifier" && getAddress(to) === REFEREE ? answers.refereeVerifier : answers[name];
      return AbiCoder.defaultAbiCoder().encode(outputs, [answer]);
    },
  };
}

for (const chainId of OTHER_CHAINS) {
  test(`checkChain refuses chain ${chainId}`, async () => {
    await assert.rejects(checkChain(stubProvider(chainId)), /is not an allowed chain/);
  });
}

for (const [chainId, network] of [[421614n, "arbitrum-sepolia"], [412346n, "nitro-devnode"], [31337n, "local"]]) {
  test(`checkChain accepts chain ${chainId} as ${network}`, async () => {
    assert.deepEqual(await checkChain(stubProvider(chainId)), { chainId: Number(chainId), network });
  });
}

test("the preflight is not ready on a refused chain, and runs no chain-bound check there", async () => {
  const rows = await preflight({
    provider: stubProvider(1n),
    deployer: DEPLOYER,
    tester: TESTER,
    backend: "zk",
    run: () => assert.fail("no command runs on a refused chain"),
  });
  assert.equal(isReady(rows), false);
  assert.ok(rows.every((row) => row.status === "FAIL"));
});

test("checkAccounts refuses a deployer that is also the tester", async () => {
  await assert.rejects(checkAccounts(stubProvider(421614n), DEPLOYER, DEPLOYER.toLowerCase()), /the same account/);
});

test("checkAccounts refuses a tester with no ETH", async () => {
  await assert.rejects(checkAccounts(stubProvider(421614n, { [TESTER]: 0n }), DEPLOYER, TESTER), /tester .* holds no ETH/);
});

test("the preflight skips the Stylus rows on anvil", async () => {
  const rows = await preflight({
    provider: stubProvider(31337n),
    deployer: DEPLOYER,
    tester: TESTER,
    backend: "stylus",
    run: () => assert.fail("anvil needs no cargo-stylus and no referee build"),
  });
  assert.deepEqual(
    rows.map(({ check, status }) => [check, status]),
    [["chain", "PASS"], ["backend", "PASS"], ["accounts", "PASS"], ["cargo-stylus", "SKIP"], ["Stylus activations", "SKIP"], ["referee/ clean", "SKIP"]],
  );
});

test("checkBackend refuses the mock backend on Arbitrum Sepolia", () => {
  assert.throws(() => checkBackend(421614, "mock"), /arbitrum-sepolia refuses the mock backend/);
});

test("the zk preflight on Arbitrum Sepolia skips the Stylus rows and checks the RISC Zero verifier", async () => {
  const rows = await preflight({
    provider: stubProvider(421614n),
    deployer: DEPLOYER,
    tester: TESTER,
    backend: "zk",
    run: () => assert.fail("the zk backend needs no cargo-stylus and no referee build"),
  });
  assert.deepEqual(
    rows.map(({ check, status }) => [check, status]),
    [["chain", "PASS"], ["backend", "PASS"], ["accounts", "PASS"], ["cargo-stylus", "SKIP"], ["Stylus activations", "SKIP"], ["referee/ clean", "SKIP"], ["RISC Zero verifier", "PASS"]],
  );
});

test("checkRiscZeroVerifier names the pinned emergency stop over the 3.1 Groth16 verifier", async () => {
  assert.match(await checkRiscZeroVerifier(stubProvider(421614n), 421614), new RegExp(`emergency stop ${ESTOP}, not paused, over ${RISC_ZERO_GROTH16_VERIFIER}`));
});

test("checkRiscZeroVerifier refuses a paused emergency stop", async () => {
  await assert.rejects(checkRiscZeroVerifier(stubProvider(421614n, {}, { paused: true }), 421614), /is paused/);
});

test("checkRiscZeroVerifier refuses an emergency stop over another verifier", async () => {
  await assert.rejects(checkRiscZeroVerifier(stubProvider(421614n, {}, { verifier: TESTER }), 421614), /not RISC Zero's 3.1 Groth16 verifier/);
});

test("checkRiscZeroVerifier refuses an emergency stop with no code", async () => {
  await assert.rejects(checkRiscZeroVerifier(stubProvider(421614n, {}, { code: "0x" }), 421614), /has no code/);
});

test("checkRiscZeroVerifier refuses a Groth16 verifier of another selector", async () => {
  await assert.rejects(checkRiscZeroVerifier(stubProvider(421614n, {}, { SELECTOR: "0x73c457ba" }), 421614), /has selector 0x73c457ba, not 0xe71e6620/);
});

test("checkRiscZeroVerifier names a ZkReferee that calls the pinned emergency stop", async () => {
  assert.match(await checkRiscZeroVerifier(stubProvider(421614n), 421614, REFEREE), new RegExp(`ZkReferee ${REFEREE} calls the emergency stop ${ESTOP}, not paused`));
});

test("checkRiscZeroVerifier refuses a ZkReferee that calls another emergency stop", async () => {
  const views = { refereeVerifier: "0x724d375B5b622e15f0E64e9Deb76a4cB17877797" };
  await assert.rejects(checkRiscZeroVerifier(stubProvider(421614n, {}, views), 421614, REFEREE), /calls 0x724d.*, not the pinned emergency stop/);
});
