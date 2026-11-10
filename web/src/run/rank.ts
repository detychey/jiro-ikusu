// A run as settlement scores and ranks it (README §8.4, D10): its six Outcomes, replayed on its
// levels with its season's weights, their sums, and the order that keeps each player's best run.

import type { Core, Outcome } from "../core";
import { type RunFile, replayRunFile } from "./runfile";

export interface RunScore {
  outcomes: Outcome[];
  score: number;
  ticks: number;
  clears: number;
  qualified: boolean;
}

/** The run of `file` replayed with its season's weights (`weightsBp`, in draw-slot order), as
 *  settlement scores it: a run qualifies with at least `minClears` cleared levels. */
export function scoreRun(core: Core, file: RunFile, weightsBp: readonly number[], minClears: number): RunScore {
  const outcomes = replayRunFile(core, file, weightsBp);
  const clears = outcomes.filter(({ endReason }) => endReason === "Cleared").length;
  return {
    outcomes,
    score: outcomes.reduce((sum, { levelScore }) => sum + levelScore, 0),
    ticks: outcomes.reduce((sum, { ticksUsed }) => sum + ticksUsed, 0),
    clears,
    qualified: clears >= minClears,
  };
}

/** D10's order (README §8.4): a qualifying run ranks above one that does not, then the higher
 *  score, then fewer ticks. */
export function ranksAbove(run: Pick<RunScore, "qualified" | "score" | "ticks">, other: Pick<RunScore, "qualified" | "score" | "ticks">): boolean {
  if (run.qualified !== other.qualified) return run.qualified;
  if (run.score !== other.score) return run.score > other.score;
  return run.ticks < other.ticks;
}
