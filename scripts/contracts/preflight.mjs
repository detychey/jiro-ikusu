// Read-only checks before a deployment or an end-to-end run (plan M4.16), adapted from
// ethblockdigger's scripts/contracts/preflight.ts at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce:
// a PASS, SKIP or FAIL row per check, then a verdict. It sends no transaction, and prints addresses,
// never keys.
//   - the chain: Arbitrum Sepolia (421614) or a local node (nitro-devnode 412346, anvil 31337) only;
//   - the deployer's and the tester's balances, and that the deployer is not the tester;
//   - cargo-stylus at the pinned version, new Stylus activations open (activation.mjs) and a clean
//     referee/ tree, which deploy.mjs's stylus backend needs. Anvil runs no Stylus program, so
//     these rows are skipped there;
//   - with --check-solvent, Season.isSolvent() on the newest generation of deployments/<network>.json.
// Usage: DEPLOYER_KEY=0x… TESTER_KEY=0x… node preflight.mjs --rpc <url> [--check-solvent]
// Exits 1 if any row fails.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Contract, JsonRpcProvider, Wallet, formatEther, getAddress } from "ethers";
import { activationsOpen, readActivationGas } from "./activation.mjs";
import { REPO_ROOT, assertPrivateKey, deploymentFileOf } from "./deploy.mjs";
import { isEntryPoint, readDeploymentRecord } from "./deployments.mjs";

export const NETWORK_OF_CHAIN = { 421614: "arbitrum-sepolia", 412346: "nitro-devnode", 31337: "local" };
// docs/TOOLING.md's pin, which stylus-gas.yml and e2e.yml install.
export const CARGO_STYLUS_VERSION = "0.10.10";
const ANVIL_CHAIN_ID = 31337;
const SEASON_ABI = JSON.parse(readFileSync(join(REPO_ROOT, "contracts", "abi", "Season.json"), "utf8"));

/** The network name of the provider's chain; throws on any chain but Arbitrum Sepolia and the local nodes. */
export async function checkChain(provider) {
  const chainId = Number((await provider.getNetwork()).chainId);
  const network = NETWORK_OF_CHAIN[chainId];
  if (!network) {
    const allowed = Object.entries(NETWORK_OF_CHAIN).map(([id, name]) => `${name} ${id}`);
    throw new Error(`chain ${chainId} is not an allowed chain (${allowed.join(", ")})`);
  }
  return { chainId, network };
}

export async function checkAccounts(provider, deployer, tester) {
  if (getAddress(deployer) === getAddress(tester)) {
    throw new Error(`the deployer and the tester are the same account, ${getAddress(deployer)}: use a separate tester key`);
  }
  const balances = [];
  for (const [role, address] of [["deployer", deployer], ["tester", tester]]) {
    const balance = await provider.getBalance(address);
    if (balance === 0n) throw new Error(`the ${role} ${getAddress(address)} holds no ETH`);
    balances.push(`${role} ${getAddress(address)} ${formatEther(balance)} ETH`);
  }
  return balances.join("; ");
}

export function checkCargoStylus(versionOutput) {
  if (versionOutput.trim() !== `stylus ${CARGO_STYLUS_VERSION}`) {
    throw new Error(
      `need cargo-stylus ${CARGO_STYLUS_VERSION} (cargo install --locked cargo-stylus --version ${CARGO_STYLUS_VERSION}), got: ${versionOutput.trim()}`,
    );
  }
  return versionOutput.trim();
}

export async function checkActivations(provider) {
  const activationGas = await readActivationGas(provider, "latest");
  if (!activationsOpen(activationGas)) throw new Error(`activationGas ${activationGas}: new Stylus activations are paused`);
  return `activationGas ${activationGas}: open`;
}

export function checkRefereeClean(porcelainStatus) {
  if (porcelainStatus.trim() !== "") {
    throw new Error(`referee/ has uncommitted changes, which deploy.mjs refuses to build:\n${porcelainStatus.trim()}`);
  }
  return "no uncommitted changes";
}

export async function checkSolvent(provider, seasonAddress) {
  const season = new Contract(seasonAddress, SEASON_ABI, provider);
  if (!(await season.isSolvent())) throw new Error(`Season ${seasonAddress} is not solvent`);
  return `Season ${seasonAddress} is solvent`;
}

function command(file, args) {
  return execFileSync(file, args, { cwd: REPO_ROOT, encoding: "utf8" });
}

/**
 * The preflight rows. `seasonAddress`, when given, adds the solvency row. The chain row comes
 * first: every other chain-bound row fails unrun on a refused chain.
 */
export async function preflight({ provider, deployer, tester, seasonAddress, run = command }) {
  const rows = [];
  async function check(name, evaluate) {
    try {
      const outcome = await evaluate();
      rows.push(typeof outcome === "string" ? { check: name, status: "PASS", detail: outcome } : { check: name, ...outcome });
    } catch (error) {
      rows.push({ check: name, status: "FAIL", detail: error.shortMessage ?? error.message });
    }
  }
  let chain;
  await check("chain", async () => {
    chain = await checkChain(provider);
    return `${chain.network} (chain ${chain.chainId})`;
  });
  const onAllowedChain = (evaluate) => () => {
    if (!chain) throw new Error("not run: needs an allowed chain");
    return evaluate();
  };
  const stylusOnly = (evaluate) =>
    onAllowedChain(() => (chain.chainId === ANVIL_CHAIN_ID ? { status: "SKIP", detail: "anvil runs no Stylus program" } : evaluate()));
  await check("accounts", onAllowedChain(() => checkAccounts(provider, deployer, tester)));
  await check("cargo-stylus", stylusOnly(() => checkCargoStylus(run("cargo", ["stylus", "--version"]))));
  await check("Stylus activations", stylusOnly(() => checkActivations(provider)));
  await check("referee/ clean", stylusOnly(() => checkRefereeClean(run("git", ["status", "--porcelain", "--", "referee"]))));
  if (seasonAddress) await check("solvency", onAllowedChain(() => checkSolvent(provider, seasonAddress)));
  return rows;
}

export function isReady(rows) {
  return rows.every((row) => row.status !== "FAIL");
}

export function renderRows(rows) {
  const width = Math.max(...rows.map((row) => row.check.length));
  const lines = rows.map((row) => `${row.check.padEnd(width)}  ${row.status.padEnd(4)}  ${row.detail.split("\n").join(`\n${" ".repeat(width + 8)}`)}`);
  return [...lines, `ready: ${isReady(rows) ? "yes" : "no"}`].join("\n");
}

async function main() {
  const { values } = parseArgs({ options: { rpc: { type: "string" }, "check-solvent": { type: "boolean" } } });
  if (!values.rpc) throw new Error("usage: DEPLOYER_KEY=0x… TESTER_KEY=0x… node preflight.mjs --rpc <url> [--check-solvent]");
  const keys = { DEPLOYER_KEY: process.env.DEPLOYER_KEY, TESTER_KEY: process.env.TESTER_KEY };
  // No child needs them: the checks run cargo and git.
  delete process.env.DEPLOYER_KEY;
  delete process.env.TESTER_KEY;
  for (const [name, key] of Object.entries(keys)) assertPrivateKey(name, key, values.rpc);
  const provider = new JsonRpcProvider(values.rpc, undefined, { staticNetwork: true });
  let seasonAddress;
  if (values["check-solvent"]) {
    const { network } = await checkChain(provider);
    [{ Season: seasonAddress }] = readDeploymentRecord(deploymentFileOf(network)).generations;
  }
  const rows = await preflight({
    provider,
    deployer: new Wallet(keys.DEPLOYER_KEY).address,
    tester: new Wallet(keys.TESTER_KEY).address,
    seasonAddress,
  });
  console.log(renderRows(rows));
  provider.destroy();
  if (!isReady(rows)) process.exitCode = 1;
}

if (isEntryPoint(import.meta.url)) await main();
