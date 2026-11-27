// A run as settlement scores it (README §8.4, D10): its six Outcomes, replayed on its levels with
// its season's weights, their sums, and its tickets, which the v1 payout pays.

import { type Core, fromHex, type Outcome } from "../core";
import { type RunFile, replayRunFile } from "./runfile";

/** Level bytes v1 (README §5): the target claim, a big-endian u16. */
const LEVEL_TARGET_OFFSET = 470;

export interface RunScore {
  outcomes: Outcome[];
  score: number;
  ticks: number;
  clears: number;
  /** The sum of the six games' tickets, in basis points. */
  tickets: number;
}

/** README §8.4: a game's ticket in basis points, min(claimBp, target) × 10,000 / target rounded
 *  down, or 0 when the lives ran out, with the target read from the game's level bytes. */
export function ticketOf(outcome: Pick<Outcome, "endReason" | "claimBp">, level: Uint8Array): number {
  if (outcome.endReason === "Out of lives") return 0;
  const target = ((level[LEVEL_TARGET_OFFSET] ?? 0) << 8) | (level[LEVEL_TARGET_OFFSET + 1] ?? 0);
  if (target === 0) throw new Error("the level has no target at offset 470: it is not level bytes v1");
  return Math.floor((Math.min(outcome.claimBp, target) * 10_000) / target);
}

/** The run of `file` replayed with its season's weights (`weightsBp`, in draw-slot order), as
 *  settlement scores it. */
export function scoreRun(core: Core, file: RunFile, weightsBp: readonly number[]): RunScore {
  const outcomes = replayRunFile(core, file, weightsBp);
  return {
    outcomes,
    score: outcomes.reduce((sum, { levelScore }) => sum + levelScore, 0),
    ticks: outcomes.reduce((sum, { ticksUsed }) => sum + ticksUsed, 0),
    clears: outcomes.filter(({ endReason }) => endReason === "Cleared").length,
    tickets: outcomes.reduce((sum, outcome, i) => sum + ticketOf(outcome, fromHex(file.levels[i] as string)), 0),
  };
}

/** Whether settling the run changes any prize: a scoring run has a ticket above 0 (README §7.3). */
export function isScoring(run: Pick<RunScore, "tickets">): boolean {
  return run.tickets > 0;
}

/** The order runs are settled in, cheapest first: proving cost grows with the ticks replayed, then
 *  the run committed first. */
export function cheaperFirst(a: { ticks: number; runId: bigint }, b: { ticks: number; runId: bigint }): number {
  if (a.ticks !== b.ticks) return a.ticks - b.ticks;
  return a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0;
}
