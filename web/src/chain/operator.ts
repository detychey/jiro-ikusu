// The operator's settlement of a season (plan M5.5, README §7.5): each run of the season that is
// committed and not yet settled, read from chain data as the replay viewer reads it (calldata.ts),
// replayed by the core with the season's weights, and checked as Challenge checks its Outcomes;
// then each player's best on-time run in D10's order, unless Season already holds that run or one
// that ranks as high. Players hand nothing off.

import { type Core, CoreError, type Outcome } from "../core";
import { describeError } from "../errors";
import { isOnTime } from "../run/deadline";
import { ranksAbove, type RunScore, scoreRun } from "../run/rank";
import type { RunFile } from "../run/runfile";
import { CHALLENGE } from "../session";
import type { Contracts } from "./contracts";

/** Challenge's SettlementStatus of a run not yet settled. */
const UNSETTLED = 0n;

/** A committed run's file and its season's weights, in draw-slot order: committedRun's, from chain data. */
export type CommittedReader = (runId: bigint) => Promise<{ file: RunFile; weightsBp: number[] }>;

export interface OperatorRun extends RunScore {
  runId: bigint;
  player: string;
  file: RunFile;
}

export interface Selection {
  /** The runs to settle, one per player at most, in run id order. */
  runs: OperatorRun[];
  /** The committed, unsettled runs that could not be read, with the error: the operator fixes
   *  their cause, such as an RPC that serves no traces, and settles again. */
  unread: { runId: bigint; error: unknown }[];
  /** The committed runs that never settle, and why: the core rejects their journals, as the
   *  referee would, or Challenge refuses their Outcomes. */
  rejected: { runId: bigint; reason: string }[];
}

type SeasonReader = Pick<Contracts, "challenge" | "season">;

/**
 * Why Challenge refuses the Outcomes of `file`'s journals although the core replays them: each
 * must be a Challenge journal of the run's nonce, at its level index, playing its drawn slot
 * (README §7.2, settlement's check 5). Undefined when all six match.
 */
export function outcomeMismatch(file: RunFile, outcomes: readonly Outcome[]): string | undefined {
  for (const [i, outcome] of outcomes.entries()) {
    if (outcome.mode !== CHALLENGE) return `level ${i}'s journal is of mode ${outcome.mode}, not a Challenge's`;
    if (outcome.runNonce.toLowerCase() !== file.runNonce.toLowerCase()) return `level ${i}'s journal names another run's nonce, ${outcome.runNonce}`;
    if (outcome.levelIndex !== i) return `level ${i}'s journal names level index ${outcome.levelIndex}`;
    if (outcome.drawSlot !== file.drawSlots[i]) return `level ${i}'s journal plays draw slot ${outcome.drawSlot}, and the run draws ${file.drawSlots[i]}`;
  }
  return undefined;
}

/** Whether `run` ranks above `recorded`, the best run Season holds for its player (none when its runId is 0). */
function ranksAboveRecorded(run: RunScore, recorded: { runId: bigint; qualified: boolean; score: bigint; ticks: bigint }): boolean {
  return recorded.runId === 0n || ranksAbove(run, { qualified: recorded.qualified, score: Number(recorded.score), ticks: Number(recorded.ticks) });
}

/** Whether `run`, selected earlier, is still to settle: not settled since, and above the best run Season holds. */
export async function stillToSettle({ challenge, season: seasons }: SeasonReader, season: bigint, run: OperatorRun): Promise<boolean> {
  if ((await challenge.settlements(run.runId)).status !== UNSETTLED) return false;
  return ranksAboveRecorded(run, await seasons.bestRunOf(season, run.player));
}

/** The runs the operator settles in season `season`, from the runs `read` reads. */
export async function runsToSettle(contracts: SeasonReader, core: Core, season: bigint, read: CommittedReader): Promise<Selection> {
  const { challenge, season: seasons } = contracts;
  const { minClears, commitSlack } = await seasons.paramsOf(season);
  const runCount = await challenge.runCount();
  const best = new Map<string, OperatorRun>();
  const unread: Selection["unread"] = [];
  const rejected: Selection["rejected"] = [];
  for (let runId = 1n; runId <= runCount; runId++) {
    const run = await challenge.runs(runId);
    if (run.season !== season || run.committedAt === 0n) continue;
    if ((await challenge.settlements(runId)).status !== UNSETTLED) continue;
    let committed: Awaited<ReturnType<CommittedReader>>;
    try {
      committed = await read(runId);
    } catch (error) {
      unread.push({ runId, error });
      continue;
    }
    let candidate: OperatorRun;
    try {
      candidate = { runId, player: run.player, file: committed.file, ...scoreRun(core, committed.file, committed.weightsBp, Number(minClears)) };
    } catch (error) {
      if (!(error instanceof CoreError)) throw error;
      rejected.push({ runId, reason: `the core rejects it, as the referee would: ${error.call}, ${describeError(error.code)}` });
      continue;
    }
    const mismatch = outcomeMismatch(committed.file, candidate.outcomes);
    if (mismatch !== undefined) {
      rejected.push({ runId, reason: `Challenge refuses its Outcomes: ${mismatch}` });
      continue;
    }
    const ticksUsed = candidate.outcomes.map(({ ticksUsed }) => ticksUsed);
    if (!isOnTime(run.committedAt, run.revealedAt, ticksUsed, commitSlack)) continue;
    const held = best.get(run.player);
    if (held === undefined || ranksAbove(candidate, held)) best.set(run.player, candidate);
  }
  const runs: OperatorRun[] = [];
  for (const candidate of best.values()) {
    if (ranksAboveRecorded(candidate, await seasons.bestRunOf(season, candidate.player))) runs.push(candidate);
  }
  return { runs: runs.sort((a, b) => (a.runId < b.runId ? -1 : 1)), unread, rejected };
}
