// Deploys a contract generation (plan M4.11), adapted from ethblockdigger's
// scripts/contracts/deploy.ts at commit 15f9d73405a8c9940870a6375b950c6c7bd5f4ce, without its
// MockUSDC: ArbBlockhashEntropy on ArbSys (MockArbSys on the local chain, which has no precompile),
// the referee (MockReferee, the Stylus referee through cargo-stylus, or ZkReferee over a RISC Zero
// verifier), Season with the treasury and the deployer as its operator, then Challenge, bound to
// Season. The generation is written as
// the newest of deployments/<network>.json (deployments/README.md). It opens no season.
// Contracts are immutable, so every run deploys a new generation; it never resumes an earlier one.
// Usage: node deploy.mjs --network <local|nitro-devnode|arbitrum-sepolia> --backend <mock|stylus|zk>
//          --treasury <address> [--rules-version <n>, for mock and zk] [--image-id <bytes32>, for zk] [--rpc <url>]
// The local chain's deployer is the node's first unlocked account (anvil's development account 0).
// On nitro-devnode and arbitrum-sepolia, DEPLOYER_KEY holds the deployer's key. Arbitrum Sepolia
// refuses the mock backend and RISC Zero's mock verifier: there, ZkReferee calls the pinned
// emergency stop (plan M4.12, M4.14).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, stripVTControlCharacters } from "node:util";
import { Contract, ContractFactory, JsonRpcProvider, Wallet, getAddress } from "ethers";
import { readProgramVersion } from "./activation.mjs";
import { BACKENDS, isEntryPoint, prependGeneration } from "./deployments.mjs";

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
// nitro-devnode seals a block per transaction within milliseconds; ethers polls receipts every 4 s
// by default. Arbitrum Sepolia's public RPC is polled once a second.
export const NETWORKS = {
  local: { chainId: 31337, rpc: "http://127.0.0.1:8545", pollingMs: 100 },
  "nitro-devnode": { chainId: 412346, rpc: "http://127.0.0.1:8547", pollingMs: 100 },
  "arbitrum-sepolia": { chainId: 421614, rpc: "https://sepolia-rollup.arbitrum.io/rpc", pollingMs: 1_000 },
};
// The chains that exist only while their node runs: the only ones for mocks.
export const LOCAL_NETWORKS = ["local", "nitro-devnode"];
const ARB_SYS_PRECOMPILE = "0x0000000000000000000000000000000000000064";
// Where referee/build-wasm.sh writes the module: $CARGO_TARGET_DIR, by default target/.
const STYLUS_WASM = join(process.env.CARGO_TARGET_DIR ?? join(REPO_ROOT, "target"), "jiro_referee_stylus.opt.wasm");
// `cargo build --release --locked -p jiro-tools` writes it.
export const JIRO_TOOLS = join(process.env.CARGO_TARGET_DIR ?? join(REPO_ROOT, "target"), "release", "jiro-tools");
// RISC Zero's emergency stop over its 3.0 Groth16 verifier, by chain id, from
// contracts/lib/risc0-ethereum/contracts/deployment.toml. ZkReferee holds it and calls it directly,
// never RISC Zero's upgradeable router: the stop's owner can only pause it for good, never add a
// route (README §7.3, docs/ECONOMY.md).
const RISC_ZERO_VERIFIER_ESTOPS = {
  42161: "0x9F9994Eb4Cb5200198FEfb470f8b50301662e696",
  421614: "0x724d375B5b622e15f0E64e9Deb76a4cB17877797",
};
// The selector of the dev-mode seals of `RISC0_DEV_MODE=1 zk-host prove`, followed by the claim's
// digest, which RISC Zero's mock verifier accepts when deployed with it.
const MOCK_VERIFIER_SELECTOR = "0xffffffff";

export function deploymentFileOf(network) {
  return join(REPO_ROOT, "deployments", `${network}.json`);
}

/** The ABI and creation bytecode of each contract under contracts/src, built by forge. */
export function buildContracts() {
  const contractsDir = join(REPO_ROOT, "contracts");
  execFileSync("forge", ["build", "--skip", "test"], { cwd: contractsDir, stdio: ["ignore", "inherit", "inherit"] });
  const artifactOf = (name) => {
    const { abi, bytecode } = JSON.parse(readFileSync(join(contractsDir, "out", `${name}.sol`, `${name}.json`), "utf8"));
    return { abi, bytecode: bytecode.object };
  };
  return Object.fromEntries(
    ["MockArbSys", "ArbBlockhashEntropy", "MockReferee", "MockForwarder", "RiscZeroMockVerifier", "ZkReferee", "Season", "Challenge"].map((name) => [
      name,
      artifactOf(name),
    ]),
  );
}

/** A provider that refuses any chain but the network's, with no read cache between transactions. */
export async function connect(network, rpc) {
  const expected = NETWORKS[network];
  if (!expected) throw new Error(`unknown network ${network}: expected one of ${Object.keys(NETWORKS).join(", ")}`);
  const provider = new JsonRpcProvider(rpc, undefined, { staticNetwork: true, cacheTimeout: -1, pollingInterval: expected.pollingMs });
  const chainId = Number((await provider.getNetwork()).chainId);
  if (chainId !== expected.chainId) throw new Error(`${rpc} serves chain ${chainId}, not ${network} (${expected.chainId})`);
  return provider;
}

// Every transaction sendTransaction waited for, in order, as { label, receipt }.
export const SENT_TRANSACTIONS = [];

/** Waits for `transaction`, decoding a revert with `contract`'s custom errors, if a contract is given. */
export async function sendTransaction(label, transaction, contract) {
  let receipt;
  try {
    receipt = await (await transaction).wait();
  } catch (error) {
    // Revert data shorter than a selector, such as a precompile's empty revert, names no custom error.
    const reason = error.data?.length >= 10 && contract ? contract.interface.parseError(error.data) : null;
    if (!reason) throw error;
    throw new Error(`${label} reverts with ${reason.name}(${reason.args.join(", ")})`, { cause: error });
  }
  if (receipt.status !== 1) throw new Error(`${label}: transaction ${receipt.hash} reverted`);
  console.log(`${label}: gas ${receipt.gasUsed}, tx ${receipt.hash}`);
  SENT_TRANSACTIONS.push({ label, receipt });
  return receipt;
}

async function deployContract(artifact, name, deployer, args) {
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, deployer).deploy(...args);
  await sendTransaction(`deploy ${name}`, contract.deploymentTransaction(), contract);
  const address = getAddress(await contract.getAddress());
  console.log(`${name}: ${address}`);
  return new Contract(address, artifact.abi, deployer);
}

function gitOutput(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/**
 * The referee's address and transactions in `cargo stylus deploy`'s output. `activateTx` is null
 * when the wasm's codehash was already activated on the chain: cargo-stylus then deploys the code
 * and sends no activation, as for any later deployment of an unchanged referee.
 */
export function parseStylusDeploy(output) {
  const address = output.match(/deployed code at address:?\s*(0x[0-9a-fA-F]{40})/i)?.[1];
  const deployTx = output.match(/deployment tx hash:?\s*(0x[0-9a-fA-F]{64})/i)?.[1];
  if (!address || !deployTx) throw new Error(`cargo stylus printed no deployed address and deployment tx hash:\n${output}`);
  const activated = output.match(new RegExp(`successfully activated contract ${address} with tx "?(?:0x)?([0-9a-fA-F]{64})`, "i"))?.[1];
  if (activated) return { address: getAddress(address), deployTx, activateTx: `0x${activated}` };
  if (output.includes("wasm already activated!")) return { address: getAddress(address), deployTx, activateTx: null };
  throw new Error(`cargo stylus did not activate the referee:\n${output}`);
}

/** Builds referee/ and deploys and activates it through cargo-stylus, as stylus-gas.yml does. */
async function deployStylusReferee(provider, rpc, deployerKey) {
  const uncommitted = gitOutput(["status", "--porcelain", "--", "referee"]);
  if (uncommitted) throw new Error(`referee/ has uncommitted changes, so sourceCommit would not describe the deployed wasm:\n${uncommitted}`);
  execFileSync("bash", [join(REPO_ROOT, "referee", "build-wasm.sh")], { stdio: ["ignore", "inherit", "inherit"] });
  // The key goes through a private temp file: argv is visible in ps and is echoed by execFileSync's errors.
  const keyDir = mkdtempSync(join(tmpdir(), "stylus-deploy-"));
  let deployed;
  try {
    writeFileSync(join(keyDir, "key"), deployerKey, { mode: 0o600 });
    deployed = spawnSync(
      "cargo",
      ["stylus", "deploy", "--wasm-file", STYLUS_WASM, "--endpoint", rpc, "--private-key-path", join(keyDir, "key"), "--no-verify"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
  } finally {
    rmSync(keyDir, { recursive: true, force: true });
  }
  if (deployed.error) throw deployed.error;
  // cargo-stylus reports the deployment and the activation on stderr.
  const output = stripVTControlCharacters(deployed.stdout + deployed.stderr);
  console.log(output.trim());
  if (deployed.status !== 0) throw new Error(`cargo stylus deploy exited ${deployed.status ?? deployed.signal}`);
  const { address, deployTx, activateTx } = parseStylusDeploy(output);
  if ((await provider.getCode(address)) === "0x") throw new Error(`the Stylus referee at ${address} has no code on ${rpc}`);
  if (activateTx === null) console.log("activate Referee (Stylus): its codehash was already activated on this chain, no transaction");
  const transactions = { "deploy Referee (Stylus)": deployTx, "activate Referee (Stylus)": activateTx };
  for (const [label, hash] of Object.entries(transactions).filter(([, hash]) => hash !== null)) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt?.status !== 1) throw new Error(`${label}: transaction ${hash} is not a successful transaction on ${rpc}`);
    console.log(`${label}: gas ${receipt.gasUsed}`);
  }
  const version = await readProgramVersion(provider, address);
  console.log(`Referee (Stylus): ${address}, activated at Stylus version ${version}`);
  return address;
}

export function riscZeroVerifierOf(chainId) {
  const verifier = RISC_ZERO_VERIFIER_ESTOPS[chainId];
  if (!verifier) throw new Error(`no RISC Zero verifier is pinned for chain ${chainId}`);
  return verifier;
}

/**
 * ZkReferee for the verify program `imageId`. The local chains have no RISC Zero verifier: there it
 * calls RISC Zero's mock verifier, which accepts the dev-mode seals of `RISC0_DEV_MODE=1 zk-host prove`.
 */
async function deployZkReferee({ artifacts, provider, network, deployer, imageId, rulesVersion }) {
  const verifier = LOCAL_NETWORKS.includes(network)
    ? await (await deployContract(artifacts.RiscZeroMockVerifier, "RiscZeroMockVerifier", deployer, [MOCK_VERIFIER_SELECTOR])).getAddress()
    : riscZeroVerifierOf(NETWORKS[network].chainId);
  if ((await provider.getCode(verifier)) === "0x") throw new Error(`the RISC Zero verifier at ${verifier} has no code on ${network}`);
  return (await deployContract(artifacts.ZkReferee, "ZkReferee", deployer, [verifier, imageId, rulesVersion])).getAddress();
}

/**
 * Deploys the full set and returns the generation to record. `deployerKey` is the Stylus
 * backend's only, which cargo-stylus needs; `rulesVersion` is MockReferee's and ZkReferee's, and
 * `imageId`, the verify program's (`zk-host image-id`), ZkReferee's. `arbSys`, the fork
 * rehearsal's only, replaces the ArbSys that ArbBlockhashEntropy reads: anvil's ArbSys has no arbBlockHash.
 */
export async function deployContracts({ artifacts, provider, rpc, network, deployer, deployerKey, backend, treasury, rulesVersion, imageId, arbSys: arbSysOverride }) {
  if (!BACKENDS.includes(backend)) throw new Error(`unknown backend ${backend}: expected one of ${BACKENDS.join(", ")}`);
  if (backend === "mock" && !LOCAL_NETWORKS.includes(network)) {
    throw new Error(`${network} refuses the mock backend: MockReferee returns whatever Outcome it is given`);
  }
  if (backend === "stylus" && network === "local") throw new Error("anvil runs no Stylus program: deploy the stylus backend on nitro-devnode");
  if (backend !== "stylus" && !Number.isInteger(rulesVersion)) throw new Error(`the ${backend} backend needs the rules version its referee returns`);
  if (backend === "zk" && !/^0x[0-9a-fA-F]{64}$/.test(imageId ?? "")) throw new Error("the zk backend needs the verify program's image id, 32 bytes in hex");
  const operator = getAddress(await deployer.getAddress());
  console.log(`network ${network}, backend ${backend}, operator ${operator}, treasury ${getAddress(treasury)}`);

  const arbSys =
    arbSysOverride ??
    (network === "local" ? await (await deployContract(artifacts.MockArbSys, "MockArbSys", deployer, [])).getAddress() : ARB_SYS_PRECOMPILE);
  const entropy = await deployContract(artifacts.ArbBlockhashEntropy, "ArbBlockhashEntropy", deployer, [arbSys]);
  const deployReferee = {
    mock: async () => (await deployContract(artifacts.MockReferee, "MockReferee", deployer, [rulesVersion])).getAddress(),
    stylus: () => deployStylusReferee(provider, rpc, deployerKey),
    zk: () => deployZkReferee({ artifacts, provider, network, deployer, imageId, rulesVersion }),
  };
  const referee = await deployReferee[backend]();
  const season = await deployContract(artifacts.Season, "Season", deployer, [treasury, operator]);
  const challenge = await deployContract(artifacts.Challenge, "Challenge", deployer, [await entropy.getAddress(), await season.getAddress()]);
  await sendTransaction("Season.bindChallenge", season.bindChallenge(await challenge.getAddress()), season);

  return {
    deployedAt: new Date().toISOString(),
    sourceCommit: gitOutput(["rev-parse", "HEAD"]),
    backend,
    operator,
    treasury: getAddress(treasury),
    ArbSys: getAddress(arbSys),
    ArbBlockhashEntropy: getAddress(await entropy.getAddress()),
    Referee: getAddress(referee),
    Season: getAddress(await season.getAddress()),
    Challenge: getAddress(await challenge.getAddress()),
    seasons: {},
  };
}

// Checked before ethers sees the key: ethers quotes a malformed key in full in its error.
export function assertPrivateKey(envName, key, network) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(key ?? "")) {
    throw new Error(`${envName} must hold a key on ${network}, as 0x and 64 hex digits`);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      network: { type: "string" },
      backend: { type: "string" },
      treasury: { type: "string" },
      "rules-version": { type: "string" },
      "image-id": { type: "string" },
      rpc: { type: "string" },
    },
  });
  if (!values.network || !values.backend || !values.treasury) {
    throw new Error(
      "usage: node deploy.mjs --network <local|nitro-devnode|arbitrum-sepolia> --backend <mock|stylus|zk> --treasury <address> [--rules-version <n>] [--image-id <bytes32>] [--rpc <url>]",
    );
  }
  const network = values.network;
  const rpc = values.rpc ?? NETWORKS[network]?.rpc;
  const provider = await connect(network, rpc);
  const deployerKey = process.env.DEPLOYER_KEY;
  // No child needs it from the environment: the Stylus build runs third-party build scripts.
  delete process.env.DEPLOYER_KEY;
  if (network !== "local") assertPrivateKey("DEPLOYER_KEY", deployerKey, network);
  const deployer = network === "local" ? await provider.getSigner(0) : new Wallet(deployerKey, provider);
  const generation = await deployContracts({
    artifacts: buildContracts(),
    provider,
    rpc,
    network,
    deployer,
    deployerKey,
    backend: values.backend,
    treasury: values.treasury,
    rulesVersion: values["rules-version"] === undefined ? undefined : Number(values["rules-version"]),
    imageId: values["image-id"],
  });
  const file = deploymentFileOf(network);
  prependGeneration(file, network, NETWORKS[network].chainId, generation);
  console.log(`generation written to ${file}`);
  provider.destroy();
}

if (isEntryPoint(import.meta.url)) await main();
