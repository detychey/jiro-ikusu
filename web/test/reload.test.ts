// The run's levels in the browser (plan M5.2): back to back in mode 1, written to the run store,
// and closed after a reload as README §7.2 specifies.

import { describe, expect, it } from "vitest";
import { type Core, fromHex, hex, type Outcome } from "../src/core";
import type { Control } from "../src/input";
import { journalEvents } from "../src/journal";
import { continueRun } from "../src/run/flow";
import { closeLevel, playLevels, X_ALONE } from "../src/run/play";
import { openRunStore, type RunRecord } from "../src/run/store";
import { freshStore, playEnv, Reload, revealedRun, RUN_NONCE, runEnv, type Script, shippedLevels } from "./challenge";
import { loadEngine } from "./drive";

const LEVELS = shippedLevels();
/** On every level: up for 20 ticks, release, then X at tick 30, which commits the level. */
const STEPS: [number, Control[]][] = [
  [0, ["up"]],
  [20, []],
  [30, ["x"]],
];
const commitAt30 = (_levelIndex: number, tick: number) => STEPS.find(([at]) => at === tick)?.[1];

function outcomes(core: Core, record: RunRecord): Outcome[] {
  return record.journals.map((journal, i) => {
    const replayed = core.replay(LEVELS[record.reveal?.drawSlots[i] ?? -1] ?? new Uint8Array(), fromHex(journal), 10_000);
    if ("code" in replayed) throw new Error(`journal ${i} is rejected with code ${replayed.code}`);
    return replayed.outcome;
  });
}

/** Plays the run with `script` until it throws Reload, then reloads: a new engine and a new
 *  connection to the same store resume the run with `commitAt30`. */
async function playWithReload(script: Script) {
  const { factory, store } = await freshStore();
  const record = revealedRun(await loadEngine());
  await expect(playLevels(playEnv(await loadEngine(), store, LEVELS, script), record)).rejects.toThrow(Reload);
  const reloadedStore = await openRunStore(factory);
  const stored = await reloadedStore.get(record.key);
  if (stored === undefined) throw new Error("the run is not in the store");
  const interrupted = structuredClone(stored);
  const core = await loadEngine();
  const resumed = await playLevels(playEnv(core, reloadedStore, LEVELS, { controls: commitAt30 }), stored);
  return { core, interrupted, resumed, reloadedStore };
}

async function uninterrupted() {
  const core = await loadEngine();
  const { store } = await freshStore();
  return { core, store, record: await playLevels(playEnv(core, store, LEVELS, { controls: commitAt30 }), revealedRun(core)) };
}

describe("a run's six levels", () => {
  it("are played back to back as mode-1 journals of the drawn levels at their level index", async () => {
    const { core, record } = await uninterrupted();
    const slots = record.reveal?.drawSlots;
    expect(outcomes(core, record).map(({ mode, levelIndex, drawSlot, runNonce }) => [mode, levelIndex, drawSlot, runNonce])).toEqual(
      [0, 1, 2, 3, 4, 5].map((i) => [1, i, slots?.[i], RUN_NONCE]),
    );
  });

  it("end as the player's inputs ended them", async () => {
    const { core, record } = await uninterrupted();
    expect(outcomes(core, record).map(({ endReason, ticksUsed }) => [endReason, ticksUsed])).toEqual(Array(6).fill(["Committed", 31]));
  });

  it("are stored once the run has its six journals, with no level left in play", async () => {
    const { store, record } = await uninterrupted();
    const stored = await store.get(record.key);
    expect([stored?.journals, stored?.live]).toEqual([record.journals, undefined]);
  });
});

describe("a reload in the middle of the third level", () => {
  const script: Script = {
    controls: commitAt30,
    beforeFrame: ({ levelIndex, ticksRun }) => {
      if (levelIndex === 2 && ticksRun === 25) throw new Reload();
    },
  };

  it("leaves the level in play stored, with the ticks of the last write", async () => {
    const { interrupted } = await playWithReload(script);
    expect([interrupted.journals.length, interrupted.live?.levelIndex, interrupted.live?.ticks]).toEqual([2, 2, 16]);
  });

  it("closes the level with an X alone at tick c, after the stored events", async () => {
    const { interrupted, resumed } = await playWithReload(script);
    const live = interrupted.live;
    if (live === undefined) throw new Error("no level was stored in play");
    expect(journalEvents(fromHex(resumed.journals[2] ?? "0x"))).toEqual([...live.events, { tick: live.ticks, mask: X_ALONE }]);
  });

  it("resumes the run at the next level, and its six journals replay", async () => {
    const { core, resumed } = await playWithReload(script);
    expect(outcomes(core, resumed).map(({ endReason, ticksUsed }) => [endReason, ticksUsed])).toEqual([
      ["Committed", 31],
      ["Committed", 31],
      ["Committed", 17],
      ["Committed", 31],
      ["Committed", 31],
      ["Committed", 31],
    ]);
  });
});

describe("a reload right after a level ended, before the next level is stored", () => {
  let transitions = 0;
  const script: Script = {
    controls: commitAt30,
    onSleep: () => {
      transitions += 1;
      if (transitions === 1) throw new Reload();
    },
  };

  it("leaves the ended level stored in play, with all its ticks", async () => {
    transitions = 0;
    const { interrupted } = await playWithReload(script);
    expect([interrupted.journals.length, interrupted.live?.levelIndex, interrupted.live?.ticks]).toEqual([0, 0, 31]);
  });

  it("keeps the level's journal as it was played", async () => {
    transitions = 0;
    const { resumed } = await playWithReload(script);
    const { record } = await uninterrupted();
    expect(resumed.journals).toEqual(record.journals);
  });
});

describe("a run the player stops", () => {
  const stopAt = (levelIndex: number, ticksRun: number) => levelIndex > 3 || (levelIndex === 3 && ticksRun >= 10);

  async function stopped() {
    const core = await loadEngine();
    const { store } = await freshStore();
    const env = playEnv(core, store, LEVELS, { controls: commitAt30, stop: ({ levelIndex, ticksRun }) => stopAt(levelIndex, ticksRun) });
    return { core, record: await playLevels(env, revealedRun(core)) };
  }

  it("closes the level in play at its next tick", async () => {
    const { record } = await stopped();
    expect(journalEvents(fromHex(record.journals[3] ?? "0x")).at(-1)).toEqual({ tick: 10, mask: X_ALONE });
  });

  it("gives each unplayed level an X at tick 0", async () => {
    const { record } = await stopped();
    expect(record.journals.slice(4).map((journal) => journalEvents(fromHex(journal)))).toEqual([
      [{ tick: 0, mask: X_ALONE }],
      [{ tick: 0, mask: X_ALONE }],
    ]);
  });

  it("commits the unplayed levels with claim 0 after one tick", async () => {
    const { core, record } = await stopped();
    expect(outcomes(core, record).slice(4).map(({ endReason, claimBp, ticksUsed }) => [endReason, claimBp, ticksUsed])).toEqual([
      ["Committed", 0, 1],
      ["Committed", 0, 1],
    ]);
  });
});

describe("closing a level", () => {
  const level = LEVELS[0] as Uint8Array;
  const nonce = fromHex(RUN_NONCE);

  it("closes at the tick after the last event when the event is past the stored tick count", async () => {
    const journal = closeLevel(await loadEngine(), level, nonce, { levelIndex: 0, events: [{ tick: 5, mask: 1 }], ticks: 3 });
    expect(journalEvents(journal)).toEqual([
      { tick: 5, mask: 1 },
      { tick: 6, mask: X_ALONE },
    ]);
  });

  it("appends nothing to a level that ends by its time limit", async () => {
    const core = await loadEngine();
    const journal = closeLevel(core, level, nonce, { levelIndex: 0, events: [], ticks: 2_700 });
    expect([hex(journal), core.endReason()]).toEqual([hex(journal.subarray(0, 71)), "Time limit"]);
  });
});

describe("a run resumed after commitRun's bound", () => {
  async function resumedLate() {
    const core = await loadEngine();
    const { store } = await freshStore();
    // Revealed at 1,000 s with a slack of 120 s; the page's clock reads 2,201 s on the chain.
    const record = { ...revealedRun(core), live: { levelIndex: 0, events: [], ticks: 40 } };
    const env = { ...runEnv(core, store, LEVELS, {}), now: () => 2_201_000 };
    return { store, record: await continueRun(env, record) };
  }

  it("is forfeited, and stored so", async () => {
    const { store, record } = await resumedLate();
    expect((await store.get(record.key))?.forfeited).toBe("commitRun refuses it after 2200, when no run can be on time any more");
  });

  it("is not played on", async () => {
    const { record } = await resumedLate();
    expect([record.journals.length, record.live?.ticks]).toEqual([0, 40]);
  });
});
