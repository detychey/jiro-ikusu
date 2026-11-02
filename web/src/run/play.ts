// The six levels of a revealed Challenge run (README §7.2, §8.2), back to back in mode 1, with no
// pause between them but a short transition. The level in play is written to the run store every
// second, at its start and at its end; a level the page will not play on (after a reload, or
// when the player stops the run) is closed by README §7.2's rule, and so is every unplayed level,
// which gets an X at tick 0.

import { type Core, CoreError, type EndReason, fromHex, hex, RUN_LEVELS } from "../core";
import { CONTROL_BITS, type HeldKeys } from "../input";
import { journalEvents } from "../journal";
import { CHALLENGE, startSession } from "../session";
import { deadlineOf, latestCommitOf } from "./deadline";
import type { LiveLevel, RunRecord, RunStore } from "./store";

/** The mask a closing event holds: X alone (README §7.2). */
export const X_ALONE = CONTROL_BITS.x;
export const SAVE_INTERVAL_MS = 1_000;
/** The time between two levels, for the player to see how the level ended. */
export const TRANSITION_MS = 3_000;

export interface PlayState {
  levelIndex: number;
  ticksRun: number;
}

/** The seconds left before the run's deadline and before commitRun's bound, if it were closed now. */
export interface Margin {
  onTime: bigint;
  commitBound: bigint;
}

export interface PlayView {
  levelStarted(levelIndex: number, drawSlot: number): void;
  /** The level in play processed ticks since the last call. */
  ticked(core: Core): void;
  levelEnded(levelIndex: number, end: EndReason): void;
  margin(margin: Margin): void;
}

export interface PlayEnv {
  core: Core;
  store: RunStore;
  keys: HeldKeys;
  /** The season's 16 levels, in draw-slot order. */
  levels: readonly Uint8Array[];
  /** The page's clock, in milliseconds. */
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Resolves when the page may run the ticks due by now: on its next animation frame. */
  frame(state: PlayState): Promise<void>;
  /** Whether the player asked to stop the run and commit it as it stands. */
  stopRequested(): boolean;
  view: PlayView;
}

/**
 * Closes a level that has not ended but will not be played on (README §7.2): with n the ticks
 * known to be processed and e the last event's tick (−1 without one), c = max(n, e + 1). The
 * core's Recorder replays the events through tick c − 1; if the level has not ended by then, it
 * plays an X alone at tick c. Returns the journal.
 */
export function closeLevel(core: Core, level: Uint8Array, runNonce: Uint8Array, live: LiveLevel): Uint8Array {
  const lastTick = live.events.at(-1)?.tick ?? -1;
  const close = Math.max(live.ticks, lastTick + 1);
  const code = core.loadLevel(level);
  if (code !== 0) throw new CoreError("load_level", code);
  core.start(runNonce, CHALLENGE, live.levelIndex);
  let mask = 0;
  let next = 0;
  for (let tick = 0; tick < close && core.endReason() === undefined; tick += 1) {
    const event = live.events[next];
    if (event?.tick === tick) {
      mask = event.mask;
      next += 1;
    }
    core.tick(mask);
  }
  if (core.endReason() === undefined) core.tick(X_ALONE);
  return core.journal();
}

/** The ticks used of a journal the page recorded (README §4.10); a rejection throws. */
export function ticksUsedOf(core: Core, level: Uint8Array, journal: Uint8Array): number {
  const replayed = core.replay(level, journal, 0);
  if ("code" in replayed) throw new CoreError("replay", replayed.code);
  return replayed.outcome.ticksUsed;
}

/** The ticks used of each closed journal of the run. */
export function closedTicksOf(core: Core, record: RunRecord, levels: readonly Uint8Array[]): number[] {
  return record.journals.map((journal, i) => ticksUsedOf(core, levels[i] as Uint8Array, fromHex(journal)));
}

export function revealOf(record: RunRecord) {
  if (record.reveal === undefined) throw new Error(`run ${record.runId} is not revealed`);
  return record.reveal;
}

/** The level bytes at each levelIndex of the run. */
export function runLevels(record: RunRecord, levels: readonly Uint8Array[]): Uint8Array[] {
  return revealOf(record).drawSlots.map((slot) => {
    const level = levels[slot];
    if (level === undefined) throw new Error(`the run draws slot ${slot}, which the page does not ship`);
    return level;
  });
}

/** The margin of a run closed now (README §7.2): the live level closes at its next tick, and
 *  each unplayed level uses one tick. */
export function marginOf(record: RunRecord, closedTicks: readonly number[], liveTicks: number | undefined, chainNowMs: number): Margin {
  const revealedAt = BigInt(revealOf(record).revealedAt);
  const slack = BigInt(record.commitSlack);
  const ticks = [...closedTicks, ...(liveTicks === undefined ? [] : [liveTicks + 1])];
  while (ticks.length < RUN_LEVELS) ticks.push(1);
  const now = BigInt(Math.floor(chainNowMs / 1000));
  return { onTime: deadlineOf(revealedAt, ticks, slack) - now, commitBound: latestCommitOf(revealedAt, slack) - now };
}

/**
 * Plays the run's levels from where `record` stopped, and returns it with its six journals. A
 * stored live level is the one a reload interrupted: it is closed first, and the run resumes at
 * the next level.
 */
export async function playLevels(env: PlayEnv, record: RunRecord): Promise<RunRecord> {
  const { core, store, view } = env;
  const reveal = revealOf(record);
  const runNonce = fromHex(reveal.runNonce);
  const levels = runLevels(record, env.levels);
  const closedTicks = closedTicksOf(core, record, levels);
  const chainNow = () => env.now() + reveal.chainOffsetMs;

  const closeAt = async (live: LiveLevel): Promise<void> => {
    if (live.levelIndex !== record.journals.length) {
      throw new Error(`run ${record.runId}: the stored level ${live.levelIndex} follows ${record.journals.length} closed journals`);
    }
    const level = levels[live.levelIndex] as Uint8Array;
    const journal = closeLevel(core, level, runNonce, live);
    record.journals.push(hex(journal));
    closedTicks.push(ticksUsedOf(core, level, journal));
    delete record.live;
    await store.put(record);
  };

  if (record.live !== undefined) await closeAt(record.live);
  while (record.journals.length < RUN_LEVELS) {
    const levelIndex = record.journals.length;
    if (env.stopRequested()) {
      await closeAt({ levelIndex, events: [], ticks: 0 });
      continue;
    }
    const level = levels[levelIndex] as Uint8Array;
    env.keys.clear();
    const loop = startSession(core, level, runNonce, env.keys, env.now, CHALLENGE, levelIndex);
    const live = (): LiveLevel => ({ levelIndex, events: journalEvents(core.journal()), ticks: loop.ticksRun });
    record.live = live();
    await store.put(record);
    view.levelStarted(levelIndex, reveal.drawSlots[levelIndex] as number);
    let savedAt = env.now();
    let end: EndReason | undefined;
    while (end === undefined && !env.stopRequested()) {
      await env.frame({ levelIndex, ticksRun: loop.ticksRun });
      const ranBefore = loop.ticksRun;
      end = loop.pump();
      if (loop.ticksRun !== ranBefore) view.ticked(core);
      view.margin(marginOf(record, closedTicks, loop.ticksRun, chainNow()));
      if (env.now() - savedAt >= SAVE_INTERVAL_MS) {
        record.live = live();
        await store.put(record);
        savedAt = env.now();
      }
    }
    record.live = live();
    await store.put(record);
    if (end === undefined) {
      await closeAt(record.live);
      continue;
    }
    view.levelEnded(levelIndex, end);
    const journal = core.journal();
    for (let waited = 0; waited < TRANSITION_MS && levelIndex + 1 < RUN_LEVELS; waited += SAVE_INTERVAL_MS) {
      view.margin(marginOf(record, [...closedTicks, loop.ticksRun], undefined, chainNow()));
      await env.sleep(SAVE_INTERVAL_MS);
    }
    record.journals.push(hex(journal));
    closedTicks.push(loop.ticksRun);
    delete record.live;
  }
  await store.put(record);
  return record;
}
