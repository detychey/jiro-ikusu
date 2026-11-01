// The commit deadline of a Challenge run, with the contract's formula (README §7.2): a run is on
// time if committedAt ≤ revealedAt + (Σ ticksUsed + 14) / 15 + commitSlack, in uint64 seconds of
// block.timestamp with integer division. commitRun itself reverts past revealedAt + 1,080 +
// commitSlack, when no run can be on time any more.

/** Six levels of at most 2,700 ticks at 15 Hz: Challenge.MAX_PLAY_SECONDS. */
export const MAX_PLAY_SECONDS = 1_080n;
const TICKS_PER_SECOND = 15n;

/** The latest on-time committedAt of a run whose six levels used `ticksUsed`. */
export function deadlineOf(revealedAt: bigint, ticksUsed: readonly number[], commitSlack: bigint): bigint {
  const ticks = BigInt(ticksUsed.reduce((sum, ticks) => sum + ticks, 0));
  return revealedAt + (ticks + TICKS_PER_SECOND - 1n) / TICKS_PER_SECOND + commitSlack;
}

export function isOnTime(committedAt: bigint, revealedAt: bigint, ticksUsed: readonly number[], commitSlack: bigint): boolean {
  return committedAt <= deadlineOf(revealedAt, ticksUsed, commitSlack);
}

/** The last block.timestamp at which commitRun accepts the run. */
export function latestCommitOf(revealedAt: bigint, commitSlack: bigint): bigint {
  return revealedAt + MAX_PLAY_SECONDS + commitSlack;
}
