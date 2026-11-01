import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAccounts, checkChain, isReady, preflight } from "./preflight.mjs";

const DEPLOYER = "0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E";
const TESTER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const OTHER_CHAINS = [1n, 42161n, 42170n, 11155111n, 31338n, 412345n];

function stubProvider(chainId, balances = {}) {
  return {
    getNetwork: async () => ({ chainId }),
    getBalance: async (address) => balances[address] ?? 1n,
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
    run: () => assert.fail("anvil needs no cargo-stylus and no referee build"),
  });
  assert.deepEqual(
    rows.map(({ check, status }) => [check, status]),
    [["chain", "PASS"], ["accounts", "PASS"], ["cargo-stylus", "SKIP"], ["Stylus activations", "SKIP"], ["referee/ clean", "SKIP"]],
  );
});
