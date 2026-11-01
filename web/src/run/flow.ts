// A Challenge run from purchase to commit (README §7.2): the season check before startRun, the
// wait for the entropy block and the reveal, the six levels, and one commitRun with the six
// journals. Every step is written to the run store first, so a reload continues the run from the
// step it reached, reading the chain for a transaction whose receipt the page did not see.

import type { Provider } from "ethers";
import { type Core, fromHex, hex, RUN_LEVELS } from "../core";
import {
  type AcceptingSeason,
  commitRun,
  type Contracts,
  entropyState,
  revealRun,
  startRun,
} from "../chain/contracts";
import { deadlineOf, latestCommitOf } from "./deadline";
import { closedTicksOf, type PlayEnv, playLevels, type PlayView, revealOf, runLevels } from "./play";
import { checkSeason } from "./season";
import { type RunRecord, type RunStore, runKey } from "./store";

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

/** Buys a run in the accepting season, which must pass the season check first. */
export async function buyRun(env: RunEnv, accepting: AcceptingSeason, player: string): Promise<RunRecord> {
  const { params } = accepting;
  checkSeason(env.core.rulesVersion, env.levelIds, params);
  env.view.status(`Buying a run in season ${accepting.number}…`);
  const { runId } = await startRun(env.contracts, accepting);
  const challenge = await env.contracts.challenge.getAddress();
  const record: RunRecord = {
    key: runKey(env.chainId, challenge, runId),
    chainId: env.chainId,
    challenge,
    player,
    runId: String(runId),
    season: String(accepting.number),
    commitSlack: Number(params.commitSlack),
    weightsBp: params.weightsBp.map(Number),
    journals: [],
  };
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

/** Marks the run forfeited once commitRun would refuse it (README §7.2), as after a long reload. */
async function forfeitIfCommitClosed(env: RunEnv, record: RunRecord): Promise<boolean> {
  const chainNow = BigInt(Math.floor((env.now() + revealOf(record).chainOffsetMs) / 1000));
  const bound = latestCommitOf(BigInt(revealOf(record).revealedAt), BigInt(record.commitSlack));
  if (chainNow <= bound) return false;
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
  const [onchain, latest] = await Promise.all([contracts.challenge.runs(runId), env.provider.getBlock("latest")]);
  if (latest === null) throw new Error("the node returned no latest block");
  record.reveal = {
    runNonce: onchain.runNonce,
    revealedAt: Number(onchain.revealedAt),
    chainOffsetMs: latest.timestamp * 1000 - env.now(),
    drawSlots: env.core.draw(fromHex(onchain.runNonce)),
  };
  await env.store.put(record);
}

/** The deadline of a run with six journals (README §7.2). */
export function runDeadline(core: Core, record: RunRecord, levels: readonly Uint8Array[]): bigint {
  const ticksUsed = closedTicksOf(core, record, runLevels(record, levels));
  return deadlineOf(BigInt(revealOf(record).revealedAt), ticksUsed, BigInt(record.commitSlack));
}

/** One commitRun with the six journals; the commitment onchain must be the core's of them. */
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
    throw new Error(`run ${runId}: the commitment onchain is ${onchain.commitment}, and the core's of the stored journals is ${commitment}`);
  }
  record.commit = { committedAt: Number(onchain.committedAt), ...(transaction === undefined ? {} : { transaction }) };
  await env.store.put(record);
  view.status(`Run ${runId} committed, ${deadline - onchain.committedAt} s before its deadline.`);
  return record;
}

/** The oldest of the player's runs on this Challenge that the browser holds and has neither
 *  committed nor forfeited: the run a reload interrupted, whose deadline ends first. */
export async function unfinishedRun(store: RunStore, chainId: number, challenge: string, player: string): Promise<RunRecord | undefined> {
  const runs = await store.runsOf(chainId, challenge, player);
  return runs.find((record) => record.commit === undefined && record.forfeited === undefined);
}
