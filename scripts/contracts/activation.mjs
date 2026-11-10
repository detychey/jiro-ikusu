// Reads ArbWasm.activationGas() and says whether new Stylus activations are open: at or below
// cargo-stylus 0.10.10's threshold of 30,000,000, as ethblockdigger's scripts/contracts/checks.ts
// checks. The chain owner pauses activations by raising activationGas above it (README §7.3).
// Usage: node activation.mjs --rpc <url>
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { Contract, JsonRpcProvider } from "ethers";

export const ARB_WASM = "0x0000000000000000000000000000000000000071";
export const MAX_OPEN_ACTIVATION_GAS = 30_000_000n;
const ARB_WASM_ABI = [
  "function activationGas() view returns (uint64)",
  "function programVersion(address program) view returns (uint16)",
  "function programTimeLeft(address program) view returns (uint64)",
];

export async function readActivationGas(provider, blockTag) {
  return new Contract(ARB_WASM, ARB_WASM_ABI, provider).activationGas({ blockTag });
}

/** The Stylus version `program` is activated at; ArbWasm reverts when its code is not activated. */
export async function readProgramVersion(provider, program) {
  return new Contract(ARB_WASM, ARB_WASM_ABI, provider).programVersion(program);
}

/** The seconds until `program`'s activation expires; ArbWasm reverts when its code is not activated. */
export async function readProgramTimeLeft(provider, program) {
  return new Contract(ARB_WASM, ARB_WASM_ABI, provider).programTimeLeft(program);
}

export function activationsOpen(activationGas) {
  return activationGas <= MAX_OPEN_ACTIVATION_GAS;
}

async function main() {
  const { values } = parseArgs({ options: { rpc: { type: "string" } } });
  if (!values.rpc) throw new Error("usage: node activation.mjs --rpc <url>");
  const provider = new JsonRpcProvider(values.rpc, undefined, { staticNetwork: true });
  // getNetwork() first: it throws on an unreachable RPC, where other calls retry forever.
  const { chainId } = await provider.getNetwork();
  const block = await provider.getBlock("latest");
  const activationGas = await readActivationGas(provider, block.number);
  const date = new Date(block.timestamp * 1000).toISOString();
  const status = activationsOpen(activationGas)
    ? `at or below ${MAX_OPEN_ACTIVATION_GAS}: activations open`
    : `above ${MAX_OPEN_ACTIVATION_GAS}: activations paused`;
  console.log(`chainId ${chainId}, block ${block.number} (${date}): activationGas ${activationGas}, ${status}`);
  provider.destroy();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
