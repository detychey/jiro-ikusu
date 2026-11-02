// Settlement from the dApp (README §7.2, §7.3; plan M5.3), verified by exception: the player's
// best run of the season, among the committed runs this browser holds, replayed by the core and
// ranked in D10's order. The deployment's backend decides who settles it:
// - Stylus, and the local chain's MockReferee: the page, with one settleRun, or six settleLevel
//   when settleRun does not fit in one transaction, with progress, retries and decoded reverts;
// - zk: the operator (D2), because proving needs credentials that cannot live in a browser, so
//   the page exports the run file and shows the cutoff, the season's end plus grace. Challenge
//   still takes a settlement from anyone (README §7.2).

import { isError, keccak256 } from "ethers";
import { chainErrorMessage, confirmed, type Contracts } from "../chain/contracts";
import type { Deployment } from "../chain/deployments";
import { type Core, type Outcome, RUN_LEVELS } from "../core";
import { downloadJson, element, messageOf } from "../page";
import { isOnTime } from "../run/deadline";
import { type RunFile, replayRunFile, runFileOf } from "../run/runfile";
import type { RunRecord, RunStore } from "../run/store";

/** Tries of a settlement that fails for the network, not for a revert. */
export const SETTLE_ATTEMPTS = 3;
/** Challenge's SettlementStatus. */
export const SETTLEMENT_STATUS = ["unsettled", "settled", "late"] as const;

export interface RankedRun {
  record: RunRecord;
  file: RunFile;
  outcomes: Outcome[];
  score: number;
  ticks: number;
  clears: number;
  qualified: boolean;
}

/** D10's order (README §8.4): a qualifying run ranks above one that does not, then the higher
 *  score, then fewer ticks. */
export function ranksAbove(run: Pick<RankedRun, "qualified" | "score" | "ticks">, other: Pick<RankedRun, "qualified" | "score" | "ticks">): boolean {
  if (run.qualified !== other.qualified) return run.qualified;
  if (run.score !== other.score) return run.score > other.score;
  return run.ticks < other.ticks;
}

/** A committed run, replayed with its season's weights, as settlement would score it. */
export function rankedRun(core: Core, levels: readonly Uint8Array[], record: RunRecord, minClears: number): RankedRun {
  const file = runFileOf(record, levels);
  const outcomes = replayRunFile(core, file, record.weightsBp);
  const clears = outcomes.filter(({ endReason }) => endReason === "Cleared").length;
  return {
    record,
    file,
    outcomes,
    score: outcomes.reduce((sum, { levelScore }) => sum + levelScore, 0),
    ticks: outcomes.reduce((sum, { ticksUsed }) => sum + ticksUsed, 0),
    clears,
    qualified: clears >= minClears,
  };
}

/** The best of `records` in season `season`: committed, on time by the contract's deadline, and
 *  first in D10's order; on a full tie, the run committed first. */
export function bestRun(core: Core, levels: readonly Uint8Array[], records: readonly RunRecord[], season: bigint, minClears: number): RankedRun | undefined {
  let best: RankedRun | undefined;
  for (const record of records) {
    if (record.season !== String(season) || record.commit === undefined || record.reveal === undefined) continue;
    const run = rankedRun(core, levels, record, minClears);
    const ticksUsed = run.outcomes.map(({ ticksUsed }) => ticksUsed);
    if (!isOnTime(BigInt(record.commit.committedAt), BigInt(record.reveal.revealedAt), ticksUsed, BigInt(record.commitSlack))) continue;
    if (best === undefined || ranksAbove(run, best)) best = run;
  }
  return best;
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
  minClears: number;
  /** Called once a settlement went through, as the leaderboard changes. */
  settled(): Promise<void>;
}

/** What the page says on zk, where the operator settles: the cutoff, from `settlementCutoff`. */
export function operatorHandoff(chainName: string, cutoff: bigint): string {
  const at = new Date(Number(cutoff) * 1000).toISOString();
  return `On ${chainName}, the operator proves and settles runs: proving needs credentials that cannot live in a browser. Send the operator the run file; the season's settlement closes at ${at} (block time ${cutoff}).`;
}

function runSummary({ record, score, ticks, clears, qualified }: RankedRun): string {
  const qualifies = qualified ? "it qualifies" : "it does not qualify";
  return `Your best run of the season in this browser is run ${record.runId}: score ${score}, ${ticks} ticks, ${clears} cleared, so ${qualifies}.`;
}

/** Shows the settlement section of the season page for the player's best run. */
export async function showSettlement(env: SettleEnv): Promise<void> {
  const { core, levels, store, contracts, deployment, player, season, minClears } = env;
  const status = element("settle-status");
  const button = element<HTMLButtonElement>("settle");
  const download = element<HTMLButtonElement>("settle-file");
  const error = element("settle-error");
  element("settle-section").hidden = false;
  const challenge = await contracts.challenge.getAddress();
  const best = bestRun(core, levels, await store.runsOf(deployment.network.chainId, challenge, player), season, minClears);
  button.hidden = download.hidden = true;
  if (best === undefined) {
    status.textContent = `This browser holds no on-time committed run of yours in season ${season}.`;
    return;
  }
  const onchain = await contracts.challenge.settlements(BigInt(best.record.runId));
  if (onchain.status !== 0n) {
    status.textContent = `${runSummary(best)} It is ${SETTLEMENT_STATUS[Number(onchain.status)]}.`;
    return;
  }
  if (!settlesInBrowser(deployment)) {
    const cutoff = await settlementCutoff(contracts, season);
    status.textContent = `${runSummary(best)} ${operatorHandoff(deployment.network.chainName, cutoff)}`;
    download.hidden = false;
    download.onclick = () => downloadJson(`jiro-run-${best.file.chainId}-${best.file.runId}.json`, best.file);
    return;
  }
  status.textContent = runSummary(best);
  button.hidden = false;
  button.onclick = () => {
    button.disabled = true;
    error.textContent = "";
    settleOnchain(contracts, best.file, (text) => (status.textContent = text))
      .then(async () => {
        await env.settled();
        await showSettlement(env);
      })
      .catch((failure: unknown) => {
        error.textContent = `${messageOf(failure)}. Settle again to continue from the levels already settled.`;
      })
      .finally(() => (button.disabled = false));
  };
}

