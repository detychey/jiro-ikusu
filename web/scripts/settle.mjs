// The operator's settlement of a season (plan M5.5, README §7.5). src/chain/operator.ts picks,
// from chain data, each player's best on-time run that Season does not already hold or beat; this
// script settles each with one settleRun. On zk it first proves the run on this machine with
// zk-host, in minutes on a GPU and hours on 4 CPUs (docs/SEASON_RUNBOOK.md), and keeps the run
// file and its proof under seasons/<label>/runs/, so that a settlement cut short resumes without
// proving again. On Stylus, and on the local chain, whose MockReferee takes any proof, it settles
// the run as the dApp does (src/pages/settle.ts). Before each run it checks that settlement is
// still open and that the run is still to settle. A run that never settles is reported, with the
// reason. A run it cannot read or settle is reported, the others still settle, and the script
// exits 1. --dry-run lists the runs and sends nothing. --export writes their run files and sends
// nothing either, for a GPU machine that holds no key: referee/zk/prove-runs.sh proves them there,
// and this script, given the proofs, settles without zk-host (docs/SEASON_RUNBOOK.md).
// Usage: [DEPLOYER_KEY=…] node web/scripts/settle.mjs --network <network> --season <label> [--rpc <url>] [--dry-run | --export]
//          [--segment-po2 <n>], for a GPU whose memory needs segments of 2^n cycles (plan M5.9)
// Anyone may settle a run (README §7.2); the operator does, with DEPLOYER_KEY (docs/DEPLOYMENT.md),
// so that it never shares a signer with season-ops.yml's TESTER_KEY. On the local chain the
// settler is anvil's account 0.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { createServer } from "vite";
import { privateKeyOf } from "../../scripts/contracts/deploy.mjs";
import { isEntryPoint } from "../../scripts/contracts/deployments.mjs";
import { ZK_HOST, proofFileOf, realProof, zkHost } from "../../scripts/contracts/zk-host.mjs";

const WEB_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const WASM = join(process.env.CARGO_TARGET_DIR ?? join(REPO_ROOT, "target"), "wasm32-unknown-unknown", "release", "jiro_wasm.wasm");
const LEVELS_DIR = join(REPO_ROOT, "levels");
const USAGE = "usage: [DEPLOYER_KEY=…] node web/scripts/settle.mjs --network <network> --season <label> [--rpc <url>] [--dry-run | --export] [--segment-po2 <n>]";

const messageOf = (error) => (error instanceof Error ? error.message : String(error));

/** The 16 shipped levels, in index order, as the season's draw slots name them. */
function shippedLevels() {
  return readdirSync(LEVELS_DIR)
    .filter((name) => name.endsWith(".bin"))
    .sort()
    .map((name) => new Uint8Array(readFileSync(join(LEVELS_DIR, name))));
}

/** Throws unless zk-host proves the image that the ZkReferee at `referee` pins: no other image's proof verifies. */
export async function checkProverImage(referee, provider) {
  const pinned = await new Contract(referee, ["function imageId() view returns (bytes32)"], provider).imageId();
  const built = zkHost(["image-id"]).trim();
  if (built !== pinned) throw new Error(`zk-host proves the image ${built}, and the ZkReferee ${referee} takes ${pinned}: build zk-host from the deployed source`);
}

/** Writes `run`'s file (docs/VERIFICATION.md, Run file v1) into `runsDir` as run-<id>.json; returns its path. */
function writeRunFile(runsDir, run) {
  mkdirSync(runsDir, { recursive: true });
  const runFile = join(runsDir, `run-${run.runId}.json`);
  writeFileSync(runFile, `${JSON.stringify(run.file, null, 2)}\n`);
  return runFile;
}

/**
 * Settles season `season`, a label of the newest generation of deployments/<network>.json, with
 * the web modules that `load` loads. `signer` sends the settlements; it is needed unless `dryRun`.
 * zk-host proves in segments of 2^`segmentPo2` cycles when it is given. With `exportOnly`, it writes
 * the run files under seasons/<label>/runs/ and settles nothing.
 * Returns the runs it settled, or would settle, and those it could not.
 */
export async function settleBestRuns(load, { network: name, season: label, rpc, dryRun, exportOnly, signer, segmentPo2, log = console.log }) {
  const { networkNamed } = await load("/src/chain/networks.ts");
  const { bundledDeployment } = await load("/src/chain/deployments.ts");
  const { confirmed, connectContracts } = await load("/src/chain/contracts.ts");
  const { committedRun } = await load("/src/chain/calldata.ts");
  const { runsToSettle, stillToSettle } = await load("/src/chain/operator.ts");
  const { Core } = await load("/src/core.ts");
  const { settleOnchain } = await load("/src/pages/settle.ts");

  const network = networkNamed(name);
  const deployment = bundledDeployment(network);
  const number = deployment.seasons[label];
  if (number === undefined) throw new Error(`the newest generation of deployments/${name}.json holds no season ${label}`);
  const url = rpc ?? network.rpcUrls[0];
  const provider = new JsonRpcProvider(url, network.chainId, { staticNetwork: true, cacheTimeout: -1 });
  try {
    const chainId = Number(await provider.send("eth_chainId", []));
    if (chainId !== network.chainId) throw new Error(`${url} serves chain ${chainId}, not ${network.chainName} (${network.chainId})`);
    const core = await Core.load(readFileSync(WASM));
    const levels = shippedLevels();
    const reader = connectContracts(deployment, provider);
    const { runs, unread, rejected } = await runsToSettle(reader, core, BigInt(number), (runId) => committedRun(reader, provider, core, levels, runId));
    log(`${label}, season ${number} on ${network.chainName}: ${runs.length} run(s) to settle`);
    for (const run of runs) {
      const rank = run.qualified ? "qualifies" : "does not qualify";
      log(`  run ${run.runId} of ${run.player}: score ${run.score}, ${run.ticks} ticks, ${run.clears} cleared, ${rank}`);
    }
    for (const { runId, reason } of rejected) log(`  run ${runId} never settles: ${reason}`);
    const failed = unread.map(({ runId, error }) => ({ runId, error: new Error(`cannot be read: ${messageOf(error)}`, { cause: error }) }));
    if (dryRun) return { runs, rejected, failed };
    const runsDir = join(REPO_ROOT, "seasons", label, "runs");
    if (exportOnly) {
      for (const run of runs) log(`  run ${run.runId}: ${writeRunFile(runsDir, run)}`);
      return { runs, rejected, failed };
    }

    const contracts = connectContracts(deployment, signer);
    // MockReferee stands in for ZkReferee on the local chain, and takes any proof.
    const proves = deployment.backend === "zk" && network.name !== "local";
    let proverChecked = false;
    // Only a run without a proof needs zk-host: proofs made on a GPU machine settle from anywhere.
    const checkProver = async (runId, proofFile) => {
      if (proverChecked) return;
      if (!existsSync(ZK_HOST)) throw new Error(`no proof at ${proofFile}, and no zk-host at ${ZK_HOST} to make one: prove run ${runId} on the GPU machine (referee/zk/prove-runs.sh)`);
      await checkProverImage((await reader.season.paramsOf(BigInt(number))).referee, provider);
      proverChecked = true;
    };
    const settlementEnd = await reader.season.settlementEndOf(BigInt(number));
    for (const run of runs) {
      try {
        // A proof can take hours: the season's settlement may end, or the run be settled or beaten, meanwhile.
        if (BigInt((await provider.getBlock("latest")).timestamp) > settlementEnd) {
          throw new Error(`the season's settlement ended at ${new Date(Number(settlementEnd) * 1000).toISOString()}`);
        }
        if (!(await stillToSettle(reader, BigInt(number), run))) {
          log(`  run ${run.runId} was settled, or beaten by the best run Season holds, since the selection: skipped`);
          continue;
        }
        if (!proves) {
          await settleOnchain(contracts, run.file, (text) => log(`  ${text}`));
          continue;
        }
        const runFile = writeRunFile(runsDir, run);
        if (!existsSync(proofFileOf(runFile))) await checkProver(run.runId, proofFileOf(runFile));
        const proof = realProof(runFile, join(REPO_ROOT, "seasons", `${label}.json`), segmentPo2);
        const { challenge, season } = contracts;
        await confirmed(`settleRun(${run.runId})`, challenge.settleRun(run.runId, run.file.levels, run.file.journals, proof), [challenge, season]);
        log(`  run ${run.runId} settled`);
      } catch (error) {
        failed.push({ runId: run.runId, error });
      }
    }
    return { runs, rejected, failed };
  } finally {
    provider.destroy();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      network: { type: "string" },
      season: { type: "string" },
      rpc: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      export: { type: "boolean", default: false },
      "segment-po2": { type: "string" },
    },
  });
  const segmentPo2 = values["segment-po2"];
  const dryRun = values["dry-run"];
  const exportOnly = values.export;
  if (values.network === undefined || values.season === undefined || (dryRun && exportOnly) || (segmentPo2 !== undefined && !/^[0-9]+$/.test(segmentPo2))) throw new Error(USAGE);
  const sends = !dryRun && !exportOnly;
  const key = !sends || values.network === "local" ? undefined : privateKeyOf("DEPLOYER_KEY", process.env.DEPLOYER_KEY, values.network);
  // No child needs them: zk-host runs from here.
  delete process.env.DEPLOYER_KEY;
  delete process.env.TESTER_KEY;
  const server = await createServer({ root: WEB_ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom" });
  let signerProvider;
  try {
    const load = (path) => server.ssrLoadModule(path);
    const { networkNamed } = await load("/src/chain/networks.ts");
    const network = networkNamed(values.network);
    let signer;
    if (sends) {
      signerProvider = new JsonRpcProvider(values.rpc ?? network.rpcUrls[0], network.chainId, { staticNetwork: true, cacheTimeout: -1 });
      signer = key === undefined ? await signerProvider.getSigner(0) : new Wallet(key, signerProvider);
    }
    const { failed } = await settleBestRuns(load, {
      network: values.network,
      season: values.season,
      rpc: values.rpc,
      dryRun,
      exportOnly,
      signer,
      segmentPo2: segmentPo2 === undefined ? undefined : Number(segmentPo2),
    });
    for (const { runId, error } of failed) console.error(`run ${runId}: ${messageOf(error)}`);
    if (failed.length > 0) throw new Error(`${failed.length} run(s) not settled`);
  } finally {
    signerProvider?.destroy();
    await server.close();
  }
}

if (isEntryPoint(import.meta.url)) await main();
