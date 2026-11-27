// Settlement from the dApp (README §7.2, §7.3; plan M5.3, M5.15), verified by exception: the
// player's scoring runs of the season, those with a ticket above 0, among the committed runs this
// browser holds, replayed by the core, cheapest first. The deployment's backend decides who
// settles them:
// - Stylus, and the local chain's MockReferee: the page, each with one settleRun, or six
//   settleLevel when settleRun does not fit in one transaction, with progress, retries and decoded
//   reverts;
// - zk: the operator (D2, README §7.5), which settles every scoring run from chain data
//   (src/chain/operator.ts, scripts/settle.mjs): a proof takes hours and gigabytes that a browser
//   does not have. The page shows the cutoff, the season's end plus grace, and exports the run
//   files for a player who proves their own: Challenge takes a settlement from anyone (README §7.2).

import { isError, keccak256 } from "ethers";
import { chainErrorMessage, confirmed, type Contracts } from "../chain/contracts";
import type { Deployment } from "../chain/deployments";
import { type Core, RUN_LEVELS } from "../core";
import { downloadJson, element, messageOf } from "../page";
import { isOnTime } from "../run/deadline";
import { cheaperFirst, isScoring, type RunScore, scoreRun } from "../run/score";
import { type RunFile, runFileOf } from "../run/runfile";
import type { RunRecord, RunStore } from "../run/store";

/** Tries of a settlement that fails for the network, not for a revert. */
export const SETTLE_ATTEMPTS = 3;
/** Challenge's SettlementStatus. */
export const SETTLEMENT_STATUS = ["unsettled", "settled", "late"] as const;

export interface ScoredRun extends RunScore {
  runId: bigint;
  record: RunRecord;
  file: RunFile;
}

/** A committed run, replayed with its season's weights, as settlement would score it. */
export function scoredRun(core: Core, levels: readonly Uint8Array[], record: RunRecord): ScoredRun {
  const file = runFileOf(record, levels);
  return { runId: BigInt(record.runId), record, file, ...scoreRun(core, file, record.weightsBp) };
}

/** The scoring runs of `records` in season `season`, cheapest first: committed, on time by the
 *  contract's deadline, and with a ticket above 0. A run whose tickets are all 0 earns the same
 *  settled or not (README §7.3). */
export function scoringRuns(core: Core, levels: readonly Uint8Array[], records: readonly RunRecord[], season: bigint): ScoredRun[] {
  const runs: ScoredRun[] = [];
  for (const record of records) {
    if (record.season !== String(season) || record.commit === undefined || record.reveal === undefined) continue;
    const run = scoredRun(core, levels, record);
    const ticksUsed = run.outcomes.map(({ ticksUsed }) => ticksUsed);
    if (!isScoring(run) || !isOnTime(BigInt(record.commit.committedAt), BigInt(record.reveal.revealedAt), ticksUsed, BigInt(record.commitSlack))) continue;
    runs.push(run);
  }
  return runs.sort(cheaperFirst);
}

export type Progress = (text: string) => void;

/** A failure of the network rather than of the transaction, which a retry may get past. */
function isTransient(error: unknown): boolean {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;
  return isError(cause, "NETWORK_ERROR") || isError(cause, "TIMEOUT") || isError(cause, "SERVER_ERROR");
}

/**
 * settleRun's gas, or undefined when it does not fit in one transaction: an estimate that fails
 * with no revert data, which is how a node reports that no gas limit up to the block's, or above
 * Arbitrum's 32M of L2 gas per transaction (README §7.3), lets the call finish; or, when the
 * caller sets `gasCap`, an estimate above it. The estimate is not compared with the 32M itself:
 * on Arbitrum it adds the L1 data cost in L2 gas units, which the cap leaves out. A revert with
 * data is the settlement's own failure, and throws.
 */
async function settleRunGas({ challenge, season }: Contracts, file: RunFile, gasCap: bigint | undefined): Promise<bigint | undefined> {
  const runId = BigInt(file.runId);
  let gas: bigint;
  try {
    gas = await challenge.settleRun.estimateGas(runId, file.levels, file.journals, "0x");
  } catch (error) {
    const reverted = isError(error, "CALL_EXCEPTION") && error.data !== null && error.data !== "0x";
    if (reverted || isTransient(error) || isError(error, "ACTION_REJECTED")) {
      throw new Error(`settleRun(${runId}): ${chainErrorMessage(error, [challenge, season])}`, { cause: error });
    }
    return undefined;
  }
  return gasCap === undefined || gas <= gasCap ? gas : undefined;
}

/** One pass of the settlement, from the levels already settled onchain. */
async function settleOnce(contracts: Contracts, file: RunFile, progress: Progress, gasCap: bigint | undefined): Promise<void> {
  const { challenge, season } = contracts;
  const runId = BigInt(file.runId);
  const { status, settledLevels } = await challenge.settlements(runId);
  if (status !== 0n) {
    progress(`Run ${runId} is already ${SETTLEMENT_STATUS[Number(status)] ?? `in settlement status ${status}`}.`);
    return;
  }
  if (settledLevels === 0n) {
    const gas = await settleRunGas(contracts, file, gasCap);
    if (gas !== undefined) {
      progress(`Run ${runId}: settleRun, ${gas} gas…`);
      await confirmed(`settleRun(${runId})`, challenge.settleRun(runId, file.levels, file.journals, "0x"), [challenge, season]);
      return;
    }
    progress(`Run ${runId}: settleRun does not fit in one transaction, so the run settles level by level.`);
  }
  const journalHashes = file.journals.map((journal) => keccak256(journal));
  for (let i = 0; i < RUN_LEVELS; i += 1) {
    if ((settledLevels >> BigInt(i)) & 1n) continue;
    progress(`Run ${runId}: settleLevel, level ${i + 1} of ${RUN_LEVELS}…`);
    const level = file.levels[i] as string;
    const journal = file.journals[i] as string;
    await confirmed(`settleLevel(${runId}, ${i})`, challenge.settleLevel(runId, i, journalHashes, level, journal, "0x"), [challenge, season]);
  }
}

/**
 * Settles the run of `file` with an empty proof, as the Stylus referee and MockReferee take it:
 * settleRun, or settleLevel for each level not yet settled when settleRun does not fit in one
 * transaction. A pass that fails for the network is tried again, from what the chain then holds,
 * up to SETTLE_ATTEMPTS times; a revert throws at once, decoded. `gasCap`, when set, also sends
 * settleLevel for a settleRun estimated above it.
 */
export async function settleOnchain(contracts: Contracts, file: RunFile, progress: Progress, gasCap?: bigint): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await settleOnce(contracts, file, progress, gasCap);
      return;
    } catch (error) {
      if (attempt === SETTLE_ATTEMPTS || !isTransient(error)) throw error;
      progress(`Run ${file.runId}: ${messageOf(error)}; trying again, ${attempt + 1} of ${SETTLE_ATTEMPTS}…`);
    }
  }
}

/** Whether the page settles runs itself, or hands them to the operator (README §7.5, D2). */
export function settlesInBrowser(deployment: Deployment): boolean {
  return deployment.backend !== "zk";
}

/** The last block.timestamp at which season `number`'s runs settle: its end plus grace, from Season. */
export function settlementCutoff({ season }: Pick<Contracts, "season">, number: bigint): Promise<bigint> {
  return season.settlementEndOf(number);
}

export interface SettleEnv {
  core: Core;
  levels: readonly Uint8Array[];
  store: RunStore;
  /** Connected through the player's wallet. */
  contracts: Contracts;
  deployment: Deployment;
  player: string;
  season: bigint;
  /** Called once the settlements went through, as the players' tickets and prizes change. */
  settled(): Promise<void>;
}

/** What the page says on zk, where the operator settles: the cutoff, from `settlementCutoff`. */
export function operatorHandoff(chainName: string, cutoff: bigint): string {
  const at = new Date(Number(cutoff) * 1000).toISOString();
  return `On ${chainName}, the operator settles every scoring run from the chain's data, so you have nothing to send: the season's settlement closes at ${at} (block time ${cutoff}). To prove and settle these runs yourself before then, download their run files.`;
}

/** Tickets in basis points, as tickets: 49,692 bp is 4.9692. */
export function formatTickets(tickets: number | bigint): string {
  return (Number(tickets) / 10_000).toFixed(4);
}

function runsSummary(runs: readonly ScoredRun[], statuses: readonly bigint[]): string {
  const listed = runs.map(({ runId, tickets }, i) => `run ${runId}, tickets ${formatTickets(tickets)}, ${SETTLEMENT_STATUS[Number(statuses[i])]}`);
  return `Your scoring runs of the season in this browser, cheapest to settle first: ${listed.join("; ")}.`;
}

/** Shows the settlement section of the season page for the player's scoring runs. */
export async function showSettlement(env: SettleEnv): Promise<void> {
  const { core, levels, store, contracts, deployment, player, season } = env;
  const status = element("settle-status");
  const button = element<HTMLButtonElement>("settle");
  const download = element<HTMLButtonElement>("settle-file");
  const error = element("settle-error");
  element("settle-section").hidden = false;
  const challenge = await contracts.challenge.getAddress();
  const runs = scoringRuns(core, levels, await store.runsOf(deployment.network.chainId, challenge, player), season);
  button.hidden = download.hidden = true;
  if (runs.length === 0) {
    status.textContent = `This browser holds no on-time committed run of yours in season ${season} with a ticket above 0: a run whose tickets are all 0 earns the same settled or not.`;
    return;
  }
  const statuses = await Promise.all(runs.map(async ({ runId }) => (await contracts.challenge.settlements(runId)).status));
  const unsettled = runs.filter((_, i) => statuses[i] === 0n);
  if (unsettled.length === 0) {
    status.textContent = runsSummary(runs, statuses);
    return;
  }
  if (!settlesInBrowser(deployment)) {
    const cutoff = await settlementCutoff(contracts, season);
    status.textContent = `${runsSummary(runs, statuses)} ${operatorHandoff(deployment.network.chainName, cutoff)}`;
    download.hidden = false;
    download.onclick = () => {
      for (const { file } of unsettled) downloadJson(`jiro-run-${file.chainId}-${file.runId}.json`, file);
    };
    return;
  }
  status.textContent = runsSummary(runs, statuses);
  button.hidden = false;
  button.textContent = `Settle ${unsettled.length} run${unsettled.length === 1 ? "" : "s"}`;
  button.onclick = () => {
    button.disabled = true;
    error.textContent = "";
    settleInOrder(contracts, unsettled, (text) => (status.textContent = text))
      .then(async () => {
        await env.settled();
        await showSettlement(env);
      })
      .catch((failure: unknown) => {
        error.textContent = `${messageOf(failure)}. Settle again to continue from what is already settled.`;
      })
      .finally(() => (button.disabled = false));
  };
}

/** Settles `runs` one after another, in their order. */
export async function settleInOrder(contracts: Contracts, runs: readonly ScoredRun[], progress: Progress): Promise<void> {
  for (const { file } of runs) await settleOnchain(contracts, file, progress);
}
