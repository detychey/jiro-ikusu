// The operator's settlement of a season (plan M5.5, M5.15, README §7.5): each run of the season
// that is committed and not yet settled, read from chain data as the replay viewer reads it
// (calldata.ts), replayed by the core with the season's weights, and checked as Challenge checks
// its Outcomes; then every on-time scoring run, one with a ticket above 0 (README §7.3), cheapest
// first. Players hand nothing off.

import { type Core, CoreError, type Outcome } from "../core";
import { describeError } from "../errors";
import { isOnTime } from "../run/deadline";
import { cheaperFirst, isScoring, type RunScore, scoreRun } from "../run/score";
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
  /** The runs to settle: every on-time scoring run, cheapest first. */
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

/** Whether `run`, selected earlier, is still to settle: not settled since. */
export async function stillToSettle({ challenge }: Pick<SeasonReader, "challenge">, run: OperatorRun): Promise<boolean> {
  return (await challenge.settlements(run.runId)).status === UNSETTLED;
}

/** The runs the operator settles in season `season`, from the runs `read` reads. */
export async function runsToSettle(contracts: SeasonReader, core: Core, season: bigint, read: CommittedReader): Promise<Selection> {
  const { challenge, season: seasons } = contracts;
  const { commitSlack } = await seasons.paramsOf(season);
  const runCount = await challenge.runCount();
  const runs: OperatorRun[] = [];
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
      candidate = { runId, player: run.player, file: committed.file, ...scoreRun(core, committed.file, committed.weightsBp) };
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
    if (isScoring(candidate) && isOnTime(run.committedAt, run.revealedAt, ticksUsed, commitSlack)) runs.push(candidate);
  }
  return { runs: runs.sort(cheaperFirst), unread, rejected };
}
