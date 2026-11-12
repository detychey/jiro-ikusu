// Checks a run proof of zk-host through the deployed ZkReferee, with an eth_call of verifyRun
// (plan M5.9): a proof made on a GPU must verify exactly as one made on a CPU does. The six
// levels come from a run file, scored with its season file's weights, as settle.mjs proves it,
// or from six game vector files, as `zk-host prove --run <six files>` proves them. The proof is
// the JSON of a seal and its public values, as realProof keeps it next to a run file, or the
// output of `zk-host prove`, which prints it between its zk-fixture markers. It prints the image
// id, each level's Outcome and the call's gas, and exits 1 when verifyRun reverts.
// Usage: node verify-proof.mjs --network <network> --proof <file> --run <run file> --season <season file>
//        node verify-proof.mjs --network <network> --proof <file> --vectors <six game vector files>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Contract } from "ethers";
import { NETWORKS, REPO_ROOT, connect, deploymentFileOf } from "./deploy.mjs";
import { isEntryPoint, readDeploymentRecord } from "./deployments.mjs";
import { encodeProof, fixtureOf } from "./zk-host.mjs";

const USAGE = [
  "usage: node verify-proof.mjs --network <network> --proof <file> --run <run file> --season <season file>",
  "       node verify-proof.mjs --network <network> --proof <file> --vectors <six game vector files>",
].join("\n");
const ZK_REFEREE_ABI = JSON.parse(readFileSync(join(REPO_ROOT, "contracts", "abi", "ZkReferee.json"), "utf8"));
const RUN_LEVELS = 6;
// The Outcome's endReason (README §4.10).
const END_REASONS = ["none", "committed", "cleared", "out of lives", "time limit"];

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** verifyRun's levels, journals and weights for a run file, scored with the weights of `seasonFile`. */
export function runInputs(runFile, seasonFile) {
  const { levels, journals, drawSlots } = readJson(runFile);
  const { weightsBp } = readJson(seasonFile);
  return { levels, journals, weightsBp: drawSlots.map((slot) => weightsBp[slot]) };
}

/** verifyRun's levels, journals and weights for six game vector files, in that order. */
export function vectorInputs(files) {
  if (files.length !== RUN_LEVELS) throw new Error(`a run is ${RUN_LEVELS} game vectors, not ${files.length}`);
  const vectors = files.map(readJson);
  return { levels: vectors.map(({ level }) => level), journals: vectors.map(({ journal }) => journal), weightsBp: vectors.map(({ weightBp }) => weightBp) };
}

/** The seal and public values of a proof file: realProof's JSON, or zk-host prove's output. */
export function proofOf(file) {
  const text = readFileSync(file, "utf8");
  return text.includes("=== BEGIN zk-fixture ===") ? fixtureOf(text) : JSON.parse(text);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { network: { type: "string" }, proof: { type: "string" }, run: { type: "string" }, season: { type: "string" }, vectors: { type: "boolean", default: false } },
  });
  const byRun = values.run !== undefined && values.season !== undefined && !values.vectors && positionals.length === 0;
  const byVectors = values.vectors && values.run === undefined && values.season === undefined;
  if (!NETWORKS[values.network] || values.proof === undefined || byRun === byVectors) throw new Error(USAGE);
  const { levels, journals, weightsBp } = byRun ? runInputs(values.run, values.season) : vectorInputs(positionals);
  const proof = encodeProof(proofOf(values.proof));
  const provider = await connect(values.network, NETWORKS[values.network].rpc);
  try {
    const [generation] = readDeploymentRecord(deploymentFileOf(values.network)).generations;
    if (generation.backend !== "zk") throw new Error(`the newest generation's backend is ${generation.backend}, which takes no zk proof`);
    const referee = new Contract(generation.Referee, ZK_REFEREE_ABI, provider);
    console.log(`ZkReferee ${generation.Referee}, image id ${await referee.imageId()}`);
    const outcomes = await referee.verifyRun(levels, journals, weightsBp, proof);
    const gas = await referee.verifyRun.estimateGas(levels, journals, weightsBp, proof);
    for (const [i, { levelId, endReason, claimBp, ticksUsed, levelScore }] of outcomes.entries()) {
      console.log(`  level ${i}: ${levelId}, ${END_REASONS[Number(endReason)]}, claim ${claimBp} bp, ${ticksUsed} ticks, score ${levelScore}`);
    }
    const score = outcomes.reduce((sum, { levelScore }) => sum + levelScore, 0n);
    console.log(`verifyRun accepts the proof: run score ${score}, ${gas.toLocaleString("en-US")} gas (eth_estimateGas)`);
  } finally {
    provider.destroy();
  }
}

if (isEntryPoint(import.meta.url)) await main();
