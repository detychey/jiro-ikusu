// A Challenge run from purchase to commit (README §7.2): the season check before startRun, the
// wait for the entropy block and the reveal, the six levels, and one commitRun with the six
// journals. Every step is written to the run store first, so a reload continues the run from the
// step it reached, reading the chain for a transaction whose receipt the page did not see; a run
// whose startRun receipt the page did not see is found onchain.

import type { Provider } from "ethers";
import { type Core, fromHex, hex, RUN_LEVELS } from "../core";
import type { SeasonParams } from "../chain/bindings/Season";
import {
  type AcceptingSeason,
  acceptingSeason,
  commitRun,
  type Contracts,
  entropyState,
  revealRun,
  startRun,
} from "../chain/contracts";
import { deadlineOf, latestCommitOf } from "./deadline";
import { closedTicksOf, type PlayEnv, playLevels, type PlayView, revealOf, runLevels } from "./play";
import { checkSeason } from "./season";
import { type RunRecord, runKey } from "./store";

export const REVEAL_POLL_MS = 1_000;

export interface RunView extends PlayView {
  status(text: string): void;
}

export interface RunEnv extends PlayEnv {
  contracts: Contracts;
  provider: Provider;
  chainId: number;
  /** The ids of the 16 shipped levels, in draw-slot order. */
  levelIds: readonly string[];
  view: RunView;
}

/** The season accepting runs is not the one the player was shown. */
export class SeasonChanged extends Error {
  constructor(shown: AcceptingSeason, accepting: AcceptingSeason) {
    super(
      `season ${accepting.number} accepts runs now, for ${accepting.runFee} wei, and the page showed season ${shown.number} for ${shown.runFee} wei: check the season shown, and buy again`,
    );
  }
}

function recordOf(env: RunEnv, challenge: string, runId: bigint, season: bigint, params: SeasonParams, player: string): RunRecord {
  return {
    key: runKey(env.chainId, challenge, runId),
    chainId: env.chainId,
    challenge,
    player,
    runId: String(runId),
    season: String(season),
    commitSlack: Number(params.commitSlack),
    weightsBp: params.weightsBp.map(Number),
    journals: [],
  };
}

/** Buys a run in `shown`, the season the player was shown, which must pass the season check and
 *  still be the season accepting runs, at the same fee. */
export async function buyRun(env: RunEnv, shown: AcceptingSeason, player: string): Promise<RunRecord> {
  checkSeason(env.core.rulesVersion, env.levelIds, shown.params);
  const accepting = await acceptingSeason(env.contracts.season, env.provider);
  if (accepting.number !== shown.number || accepting.runFee !== shown.runFee) throw new SeasonChanged(shown, accepting);
  env.view.status(`Buying a run in season ${shown.number}…`);
  const { runId } = await startRun(env.contracts, shown);
  const record = recordOf(env, await env.contracts.challenge.getAddress(), runId, shown.number, shown.params, player);
  await env.store.put(record);
  return record;
}

/** Takes a stored run from the step it reached to its commit, unless it is forfeited. */
export async function continueRun(env: RunEnv, record: RunRecord): Promise<RunRecord> {
  if (record.commit !== undefined || record.forfeited !== undefined) return record;
  if (record.reveal === undefined) await reveal(env, record);
  if (record.forfeited !== undefined || (await forfeitIfCommitClosed(env, record))) return record;
  if (record.journals.length < RUN_LEVELS) await playLevels(env, record);
  if (await forfeitIfCommitClosed(env, record)) return record;
  return commit(env, record);
}

/** block.timestamp of the latest block, in seconds. */
async function chainTime(provider: Provider): Promise<number> {
  const latest = await provider.getBlock("latest");
  if (latest === null) throw new Error("the node returned no latest block");
  return latest.timestamp;
}

/** Marks the run forfeited once commitRun would refuse it (README §7.2), as after a long reload.
 *  The chain's latest block decides: the page's clock may have moved since the reveal. */
async function forfeitIfCommitClosed(env: RunEnv, record: RunRecord): Promise<boolean> {
  const bound = latestCommitOf(BigInt(revealOf(record).revealedAt), BigInt(record.commitSlack));
  if (BigInt(await chainTime(env.provider)) <= bound) return false;
  record.forfeited = `commitRun refuses it after ${bound}, when no run can be on time any more`;
  await env.store.put(record);
  env.view.status(`Run ${record.runId} is forfeited: ${record.forfeited}.`);
  return true;
}

/** Polls the entropy source until the run's entropy block exists, then reveals the run at once. */
async function reveal(env: RunEnv, record: RunRecord): Promise<void> {
  const { contracts, view } = env;
  const runId = BigInt(record.runId);
  if ((await contracts.challenge.runs(runId)).revealedAt === 0n) {
    for (let state = await entropyState(contracts, runId); state !== "revealable"; state = await entropyState(contracts, runId)) {
      if (state === "lapsed") {
        record.forfeited = "its entropy block is past its read window: the reveal lapsed, and the fee stays in the pot (README §7.2)";
        await env.store.put(record);
        view.status(`Run ${runId} is forfeited: ${record.forfeited}.`);
        return;
      }
      view.status(`Run ${runId}: waiting for its entropy block, usually 10 to 20 s…`);
      await env.sleep(REVEAL_POLL_MS);
    }
    view.status(`Run ${runId}: revealing…`);
    await revealRun(contracts, runId);
  }
  const [onchain, latest] = await Promise.all([contracts.challenge.runs(runId), chainTime(env.provider)]);
  record.reveal = {
    runNonce: onchain.runNonce,
    revealedAt: Number(onchain.revealedAt),
    chainOffsetMs: latest * 1000 - env.now(),
    drawSlots: env.core.draw(fromHex(onchain.runNonce)),
  };
  await env.store.put(record);
}

/** The deadline of a run with six journals (README §7.2). */
export function runDeadline(core: Core, record: RunRecord, levels: readonly Uint8Array[]): bigint {
  const ticksUsed = closedTicksOf(core, record, runLevels(record, levels));
  return deadlineOf(BigInt(revealOf(record).revealedAt), ticksUsed, BigInt(record.commitSlack));
}

/** One commitRun with the six journals; the commitment onchain must be the core's of them. A
 *  commit of other journals, by another tab or browser, leaves the run forfeited here. */
async function commit(env: RunEnv, record: RunRecord): Promise<RunRecord> {
  const { contracts, core, view } = env;
  const runId = BigInt(record.runId);
  const deadline = runDeadline(core, record, env.levels);
  const chainNow = BigInt(Math.floor((env.now() + revealOf(record).chainOffsetMs) / 1000));
  view.status(`Committing run ${runId}, ${deadline - chainNow} s before its deadline…`);
  let transaction: string | undefined;
  if ((await contracts.challenge.runs(runId)).committedAt === 0n) {
    transaction = (await commitRun(contracts, runId, record.journals)).transaction;
  }
  const onchain = await contracts.challenge.runs(runId);
  const commitment = hex(core.runCommitment(record.journals.map(fromHex)));
  if (onchain.commitment !== commitment) {
    const mismatch = `the commitment onchain is ${onchain.commitment}, and the core's of the stored journals is ${commitment}`;
    if (transaction !== undefined) throw new Error(`run ${runId}: ${mismatch}`);
    record.forfeited = `${mismatch}: other journals were committed`;
    await env.store.put(record);
    view.status(`Run ${runId} is forfeited: ${record.forfeited}.`);
    return record;
  }
  record.commit = { committedAt: Number(onchain.committedAt), ...(transaction === undefined ? {} : { transaction }) };
  await env.store.put(record);
  view.status(`Run ${runId} committed, ${deadline - onchain.committedAt} s before its deadline.`);
  return record;
}

/**
 * Stores the player's runs that the chain holds and the store lacks, as after a reload while
 * startRun was confirming: runs not yet revealed whose entropy block is still readable (README
 * §7.2). It walks down from the newest run to the first whose read window has lapsed: an older
 * run's entropy block comes no later, so its window has lapsed too.
 */
async function recoverRuns(env: RunEnv, challenge: string, player: string): Promise<void> {
  const { contracts } = env;
  for (let runId = await contracts.challenge.runCount(); runId > 0n; runId -= 1n) {
    if ((await entropyState(contracts, runId)) === "lapsed") return;
    const run = await contracts.challenge.runs(runId);
    const key = runKey(env.chainId, challenge, runId);
    if (run.player.toLowerCase() !== player.toLowerCase() || run.revealedAt !== 0n || (await env.store.get(key)) !== undefined) continue;
    const params = await contracts.season.paramsOf(run.season);
    checkSeason(env.core.rulesVersion, env.levelIds, params);
    await env.store.put(recordOf(env, challenge, runId, run.season, params, player));
    env.view.status(`Run ${runId}: found onchain, bought without its receipt reaching the page.`);
  }
}

/** The player's runs on this Challenge that are neither committed nor forfeited, oldest first,
 *  whose commit bound ends first, with the unrevealed runs that the chain holds and the store
 *  lacked. */
export async function unfinishedRuns(env: RunEnv, player: string): Promise<RunRecord[]> {
  const challenge = await env.contracts.challenge.getAddress();
  await recoverRuns(env, challenge, player);
  const runs = await env.store.runsOf(env.chainId, challenge, player);
  return runs.filter((record) => record.commit === undefined && record.forfeited === undefined);
}

/**
 * Plays the player's unfinished runs through `play`, oldest first, reading them again after
 * each, as a reload can leave several: until none is left, or `play` returns false to stop. A run
 * that `play` returns from unfinished, as one another tab plays, is not tried again.
 */
export async function playUnfinished(env: RunEnv, player: string, play: (record: RunRecord) => Promise<boolean>): Promise<void> {
  const tried = new Set<string>();
  for (;;) {
    const next = (await unfinishedRuns(env, player)).find(({ key }) => !tried.has(key));
    if (next === undefined || !(await play(next))) return;
    tried.add(next.key);
  }
}
