// The fork rehearsal of plan M4.14's deployment (docs/DEPLOYMENT.md, Fork rehearsal): anvil
// forking Arbitrum Sepolia, chain 421614, through the same functions as the real steps, with no
// key and no testnet transaction. Its numbers are rehearsal numbers, not testnet results.
//   1. the preflight, zk backend, with the RISC Zero verifier row read from the fork;
//   2-5. deployContracts: ArbBlockhashEntropy, ZkReferee wired to the forked emergency stop
//      0x724d…7797 (the real verifier contracts, not a mock), Season, Challenge; then season.mjs's
//      openSeason with seasons/testnet-0.json, level tool check included;
//   7. the happy path, settled with M4.10's real Groth16 run proof (contracts/test/fixtures);
//   8. the full six-journal commit;
//   then isSolvent and the preflight's solvency row, the gas table and the measurements.
// What differs from the real deployment:
//   - anvil's ArbSys at 0x64 on an Arbitrum chain answers arbBlockNumber but reverts on
//     arbBlockHash (PrecompileError), and shadows code etched there. So ArbBlockhashEntropy reads a
//     MockArbSys that anvil's account 0 deploys, starting at block 1,000; the clock moves it. The
//     real deployment reads the real precompile at 0x64;
//   - the fixture proves run 1 of a Challenge at 0x5991A2dF…76A9, deployed at nonce 4 by forge's
//     test contract 0x7FA9…1496, whose run nonce follows from MockArbSys's block 1,040. So the
//     deployer is that address, impersonated, at the nonce that puts Challenge there, and the
//     treasury is it too (step 4: the deployer's address); the tester is anvil's account 1. The
//     happy path commits the fixture's journals, not a bot run;
//   - anvil charges no L1 data gas; Arbitrum Sepolia's ArbGasInfo prices L1 calldata at 0 wei today.
// The records go to a temporary directory: deployments/ and seasons/ stay as they are.
// Usage: node fork-rehearsal.mjs [--port <anvil port>] [--fork-url <Arbitrum Sepolia RPC>]
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Contract, ContractFactory, getAddress, sha256, toBeHex } from "ethers";
import { NETWORKS, REPO_ROOT, SENT_TRANSACTIONS, buildContracts, connect, deployContracts } from "./deploy.mjs";
import { isEntryPoint, prependGeneration, readDeploymentRecord } from "./deployments.mjs";
import {
  chainClockOf,
  encodeProof,
  levelsOfRunFile,
  liveContext,
  liveFullCommit,
  liveHappyPath,
  measurements,
  printResults,
  rowOf,
  transactions,
} from "./e2e.mjs";
import { CALIBRATION, assertEqual, startAnvil } from "./localnet.mjs";
import { RISC_ZERO_GROTH16_VERIFIER, isReady, preflight, renderRows } from "./preflight.mjs";
import { openSeason } from "./season.mjs";

const NETWORK = "arbitrum-sepolia";
const FIXTURE_DEPLOYER = "0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496";
const FIXTURE_CHALLENGE = "0x5991A2dF15A8F6A256D3Ec51E99254Cd3fb576A9";
// deployContracts sends ArbBlockhashEntropy, ZkReferee, Season, then Challenge, at FIXTURE_CHALLENGE's nonce 4.
const FIXTURE_DEPLOYER_NONCE = 1;
const FIXTURES = join(REPO_ROOT, "contracts", "test", "fixtures");
const VERIFIER_ABI = ["function verify(bytes seal, bytes32 imageId, bytes32 journalDigest) view"];

/** The fixture's deployer, impersonated and funded, and a MockArbSys at block 1,000 from anvil's account 0. */
async function prepareFork(provider, artifacts) {
  await provider.send("anvil_impersonateAccount", [FIXTURE_DEPLOYER]);
  await provider.send("anvil_setBalance", [FIXTURE_DEPLOYER, toBeHex(10n ** 18n)]);
  await provider.send("anvil_setNonce", [FIXTURE_DEPLOYER, toBeHex(FIXTURE_DEPLOYER_NONCE)]);
  const { abi, bytecode } = artifacts.MockArbSys;
  const arbSys = await new ContractFactory(abi, bytecode, await provider.getSigner(0)).deploy();
  await arbSys.waitForDeployment();
  console.log(`[fork] deployer ${FIXTURE_DEPLOYER} impersonated at nonce ${FIXTURE_DEPLOYER_NONCE}; MockArbSys at ${await arbSys.getAddress()}, for the rehearsal only`);
  return getAddress(await arbSys.getAddress());
}

/** The emergency stop's own gas: the fixture run proof verified through it, and directly on the Groth16 verifier. */
async function measureEmergencyStop(provider, verifier, imageId, run) {
  const digest = sha256(run.publicValues);
  const [throughStop, direct] = await Promise.all(
    [verifier, RISC_ZERO_GROTH16_VERIFIER].map((address) => new Contract(address, VERIFIER_ABI, provider).verify.estimateGas(run.seal, imageId, digest)),
  );
  measurements.push(`the run proof's verify: ${throughStop} gas through the emergency stop, ${direct} on the Groth16 verifier, ${throughStop - direct} more (eth_estimateGas)`);
}

async function rehearse(rpc, workDir) {
  const provider = await connect(NETWORK, rpc);
  console.log(`[fork] Arbitrum Sepolia forked at block ${await provider.getBlockNumber()}`);
  const proofs = JSON.parse(readFileSync(join(FIXTURES, "zk-proofs.json"), "utf8"));
  const fixtureRun = JSON.parse(readFileSync(join(FIXTURES, "zk-run.json"), "utf8"));
  const artifacts = buildContracts();
  const arbSys = await prepareFork(provider, artifacts);
  const deployer = await provider.getSigner(FIXTURE_DEPLOYER);
  const tester = await provider.getSigner(1);

  const rows = await preflight({ provider, deployer: FIXTURE_DEPLOYER, tester: await tester.getAddress(), backend: "zk" });
  console.log(renderRows(rows));
  if (!isReady(rows)) throw new Error("the preflight fails");

  const recordFile = join(workDir, `${NETWORK}.json`);
  const generation = await deployContracts({
    artifacts,
    provider,
    rpc,
    network: NETWORK,
    deployer,
    backend: "zk",
    treasury: FIXTURE_DEPLOYER,
    rulesVersion: CALIBRATION.rulesVersion,
    imageId: proofs.challengeRun.imageId,
    arbSys,
  });
  assertEqual("the rehearsal's Challenge", generation.Challenge, FIXTURE_CHALLENGE);
  prependGeneration(recordFile, NETWORK, NETWORKS[NETWORK].chainId, generation);
  const seasonFile = join(workDir, "testnet-0.json");
  copyFileSync(join(REPO_ROOT, "seasons", "testnet-0.json"), seasonFile);
  await openSeason({ provider, operator: deployer, seasonFile, recordFile });
  assertEqual("the season file's referee after open", JSON.parse(readFileSync(seasonFile, "utf8")).referee, generation.Referee);
  for (const { label, receipt } of SENT_TRANSACTIONS) transactions.push(await rowOf("deploy", label, receipt));

  const context = await liveContext({
    network: NETWORK,
    provider,
    player: tester,
    settler: deployer,
    artifacts,
    recordFile,
    seasonLabel: "testnet-0",
    runsDir: workDir,
    clockOf: (_, ...rest) => chainClockOf("local", ...rest),
  });
  try {
    const run = await liveHappyPath(context, {
      play: (_, runNonce) => {
        assertEqual("the revealed run nonce, the fixture run's", runNonce, fixtureRun.runNonce);
        return levelsOfRunFile(context, fixtureRun);
      },
      prove: () => encodeProof(proofs.challengeRun),
    });
    const written = JSON.parse(readFileSync(run.file, "utf8"));
    assertEqual("the written run file, but its chain id, as the fixture's", JSON.stringify({ ...written, chainId: fixtureRun.chainId }), JSON.stringify(fixtureRun));
    await measureEmergencyStop(provider, await context.referee.verifier(), proofs.challengeRun.imageId, proofs.challengeRun);
    await liveFullCommit(context);
    const finalRows = await preflight({ provider, deployer: FIXTURE_DEPLOYER, tester: await tester.getAddress(), backend: "zk", seasonAddress: generation.Season });
    console.log(renderRows(finalRows));
    if (!isReady(finalRows)) throw new Error("the preflight fails after the rehearsal");
    const record = readDeploymentRecord(recordFile);
    console.log(`[fork] record ${JSON.stringify(record.generations[0], null, 2)}`);
    console.log(`[fork] Season ${getAddress(generation.Season)}: isSolvent() ${await context.season.isSolvent()}`);
  } finally {
    rmSync(context.workDir, { recursive: true, force: true });
    provider.destroy();
  }
  printResults(NETWORK, "zk");
}

if (isEntryPoint(import.meta.url)) {
  const { values } = parseArgs({ options: { port: { type: "string", default: "8545" }, "fork-url": { type: "string", default: NETWORKS[NETWORK].rpc } } });
  const { anvil, rpc } = await startAnvil(values.port, false, { chainId: NETWORKS[NETWORK].chainId, forkUrl: values["fork-url"] });
  const workDir = mkdtempSync(join(tmpdir(), "jiro-fork-rehearsal-"));
  try {
    await rehearse(rpc, workDir);
  } finally {
    anvil.kill();
    rmSync(workDir, { recursive: true, force: true });
  }
}
