// The zk host of referee/zk (plan M4.8, M4.10): the binary `cargo build --release` writes into
// referee/zk/target, or $CARGO_TARGET_DIR, and the proofs it prints, encoded as settlement takes
// them.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AbiCoder } from "ethers";
import { REPO_ROOT } from "./deploy.mjs";

export const ZK_HOST = join(process.env.CARGO_TARGET_DIR ?? join(REPO_ROOT, "referee", "zk", "target"), "release", "zk-host");

/** zk-host's output for `args`; throws with its stderr when it fails. */
export function zkHost(args, env = process.env) {
  const result = spawnSync(ZK_HOST, args, { cwd: REPO_ROOT, encoding: "utf8", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`zk-host ${args.join(" ")} failed:\n${result.stderr}`);
  return result.stdout;
}

/** The seal and public values that `zk-host prove` prints between its zk-fixture markers. */
export function fixtureOf(output) {
  const fixture = output.match(/=== BEGIN zk-fixture ===\n(.*)\n=== END zk-fixture ===/)?.[1];
  if (fixture === undefined) throw new Error(`zk-host prove printed no fixture:\n${output}`);
  return JSON.parse(fixture);
}

/** A proof as settlement takes it: abi.encode(seal, publicValues). */
export function encodeProof({ seal, publicValues }) {
  return AbiCoder.defaultAbiCoder().encode(["bytes", "bytes"], [seal, publicValues]);
}

/** Where realProof keeps the proof of `runFile`: <run file>.proof.json, beside it. */
export function proofFileOf(runFile) {
  return runFile.replace(/\.json$/, ".proof.json");
}

/** zk-host's arguments to prove a run file with the weights of `seasonFile`, in segments of 2^`segmentPo2` cycles when given. */
export function proveRunArgs(runFile, seasonFile, segmentPo2) {
  return ["prove", "--run", runFile, "--season", seasonFile, ...(segmentPo2 === undefined ? [] : ["--segment-po2", String(segmentPo2)])];
}

/**
 * The real Groth16 proof of a run file, scored with the weights of `seasonFile`, kept next to the
 * run file as <run file>.proof.json so that a later session reuses it. A whole run takes hours to
 * prove on 4 CPUs (docs/DEPLOYMENT.md), and minutes on a GPU, whose memory may need segments
 * smaller than the default (plan M5.9).
 */
export function realProof(runFile, seasonFile, segmentPo2) {
  const proofFile = proofFileOf(runFile);
  if (!existsSync(proofFile)) {
    if (process.env.RISC0_DEV_MODE) throw new Error("RISC0_DEV_MODE is set: a dev-mode seal never verifies through RISC Zero's Groth16 verifier");
    console.log(`proving ${runFile} with zk-host, which takes hours on 4 CPUs (docs/DEPLOYMENT.md)`);
    const proved = spawnSync(ZK_HOST, proveRunArgs(runFile, seasonFile, segmentPo2), { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
    if (proved.error) throw proved.error;
    if (proved.status !== 0) throw new Error(`zk-host prove --run ${runFile} exited ${proved.status ?? proved.signal}`);
    process.stdout.write(proved.stdout);
    writeFileSync(proofFile, `${JSON.stringify(fixtureOf(proved.stdout), null, 2)}\n`);
  }
  return encodeProof(JSON.parse(readFileSync(proofFile, "utf8")));
}
