// The chain module's smoke run on a local chain (plan M5.1): web/src/chain, loaded through Vite
// as the page loads it, reads the newest generation of the build's deployments/<network>.json,
// connects an EIP-1193 wallet, checks its network, reads its balance, finds the season accepting
// runs, and calls startRun for it with its number and fee. It then checks the run onchain.
// The wallet is the node itself, whose development accounts are unlocked (anvil), behind an
// EIP-1193 request function that shares only the chosen account.
// Usage: node scripts/contracts/localnet.mjs --up, then
//        node web/scripts/chain-smoke.mjs --rpc http://127.0.0.1:8545 [--network local] [--account 2]
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createServer } from "vite";

const WEB_ROOT = fileURLToPath(new URL("../", import.meta.url));

function check(what, actual, expected) {
  if (String(actual) !== String(expected)) throw new Error(`chain-smoke: ${what} is ${actual}, expected ${expected}`);
}

/** An EIP-1193 wallet backed by the node at `rpc`, sharing the node's account number `accountIndex`. */
async function nodeWallet(rpc, accountIndex) {
  let id = 0;
  const send = async (method, params) => {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    if (!response.ok) throw new Error(`chain-smoke: ${rpc} answered ${method} with HTTP ${response.status}`);
    const { result, error } = await response.json();
    if (error) throw Object.assign(new Error(`${method}: ${error.message}`), { code: error.code, data: error.data });
    return result;
  };
  const account = (await send("eth_accounts", []))[accountIndex];
  if (account === undefined) throw new Error(`chain-smoke: ${rpc} has no unlocked account ${accountIndex}`);
  return {
    request: ({ method, params = [] }) =>
      method === "eth_requestAccounts" || method === "eth_accounts" ? [account] : send(method, params),
  };
}

async function smoke(load, rpc, networkName, accountIndex) {
  const { networkNamed } = await load("/src/chain/networks.ts");
  const { bundledDeployment } = await load("/src/chain/deployments.ts");
  const { connect, formatEth, onNetwork, signerOf } = await load("/src/chain/wallet.ts");
  const { acceptingSeason, connectContracts, startRun } = await load("/src/chain/contracts.ts");

  const network = networkNamed(networkName);
  const deployment = bundledDeployment(network);
  const { deployedAt, backend, addresses } = deployment;
  console.log(`chain-smoke: deployments/${network.name}.json, generation of ${deployedAt} (${backend} referee), Challenge ${addresses.Challenge}`);

  const wallet = await nodeWallet(rpc, accountIndex);
  const connection = await connect(wallet);
  if (!onNetwork(connection, network)) {
    throw new Error(`chain-smoke: ${rpc} serves chain ${connection.chainId}, not ${network.chainName} (${network.chainId})`);
  }
  const signer = await signerOf(wallet, connection, network);
  const provider = signer.provider;
  const balanceBefore = await provider.getBalance(connection.account);
  console.log(`chain-smoke: wallet ${connection.account} on chain ${connection.chainId}, balance ${formatEth(balanceBefore)}`);

  const contracts = connectContracts(deployment, signer);
  const accepting = await acceptingSeason(contracts.season, provider);
  const feesBefore = (await contracts.season.seasons(accepting.number)).fees;
  console.log(`chain-smoke: season ${accepting.number} accepts runs until ${accepting.end}, fee ${formatEth(accepting.runFee)}`);

  const run = await startRun(contracts, accepting);
  const receipt = await provider.getTransactionReceipt(run.transaction);
  console.log(`chain-smoke: startRun(${accepting.number}) with ${accepting.runFee} wei: run ${run.runId}, entropy id ${run.entropyId}`);
  console.log(`chain-smoke: transaction ${run.transaction}, gas ${receipt.gasUsed}`);

  const stored = await contracts.challenge.runs(run.runId);
  check(`run ${run.runId}'s player`, stored.player, connection.account);
  check(`run ${run.runId}'s season`, stored.season, accepting.number);
  check(`run ${run.runId}'s entropy id`, await contracts.challenge.entropyIdOf(run.runId), run.entropyId);
  check(`season ${accepting.number}'s fees`, (await contracts.season.seasons(accepting.number)).fees, feesBefore + accepting.runFee);
  const spent = balanceBefore - (await provider.getBalance(connection.account));
  check("the wallet's spending", spent, accepting.runFee + receipt.gasUsed * receipt.gasPrice);
  console.log(`chain-smoke: run ${run.runId} belongs to ${stored.player} in season ${stored.season}`);
  console.log(`chain-smoke: the season's fees grew by ${accepting.runFee} wei, and the wallet paid the fee and the gas`);
  provider.destroy();
}

const { values } = parseArgs({
  options: { rpc: { type: "string" }, network: { type: "string", default: "local" }, account: { type: "string", default: "2" } },
});
if (values.rpc === undefined) throw new Error("usage: node web/scripts/chain-smoke.mjs --rpc <url> [--network local] [--account <index>]");

const server = await createServer({ root: WEB_ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  await smoke((path) => server.ssrLoadModule(path), values.rpc, values.network, Number(values.account));
} finally {
  await server.close();
}
