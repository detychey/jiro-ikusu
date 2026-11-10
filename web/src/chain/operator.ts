// The operator's settlement of a season (plan M5.5, README §7.5): each run of the season that is
// committed and not yet settled, read from chain data as the replay viewer reads it (calldata.ts)
// and replayed by the core with the season's weights; then each player's best on-time run in
// D10's order, unless Season already holds that run or one that ranks as high. Players hand
// nothing off.

import type { Core } from "../core";
import { isOnTime } from "../run/deadline";
import { ranksAbove, type RunScore, scoreRun } from "../run/rank";
import type { RunFile } from "../run/runfile";
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
  /** The committed, unsettled runs that could not be read or replayed, with the error. */
  unread: { runId: bigint; error: unknown }[];
}

/** The runs the operator settles in season `season`, from the runs `read` reads. */
export async function runsToSettle(contracts: Pick<Contracts, "challenge" | "season">, core: Core, season: bigint, read: CommittedReader): Promise<Selection> {
  const { challenge, season: seasons } = contracts;
  const { minClears, commitSlack } = await seasons.paramsOf(season);
  const runCount = await challenge.runCount();
  const best = new Map<string, OperatorRun>();
  const unread: Selection["unread"] = [];
  for (let runId = 1n; runId <= runCount; runId++) {
    const run = await challenge.runs(runId);
    if (run.season !== season || run.committedAt === 0n) continue;
    if ((await challenge.settlements(runId)).status !== UNSETTLED) continue;
    let candidate: OperatorRun;
    try {
      const { file, weightsBp } = await read(runId);
      candidate = { runId, player: run.player, file, ...scoreRun(core, file, weightsBp, Number(minClears)) };
    } catch (error) {
      unread.push({ runId, error });
      continue;
    }
    const ticksUsed = candidate.outcomes.map(({ ticksUsed }) => ticksUsed);
    if (!isOnTime(run.committedAt, run.revealedAt, ticksUsed, commitSlack)) continue;
    const held = best.get(run.player);
    if (held === undefined || ranksAbove(candidate, held)) best.set(run.player, candidate);
  }
  const runs: OperatorRun[] = [];
  for (const candidate of best.values()) {
    const recorded = await seasons.bestRunOf(season, candidate.player);
    const recordedRank = { qualified: recorded.qualified, score: Number(recorded.score), ticks: Number(recorded.ticks) };
    if (recorded.runId === 0n || ranksAbove(candidate, recordedRank)) runs.push(candidate);
  }
  return { runs: runs.sort((a, b) => (a.runId < b.runId ? -1 : 1)), unread };
}
