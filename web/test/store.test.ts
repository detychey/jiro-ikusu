// The run store in IndexedDB (plan M5.2).

import { describe, expect, it, vi } from "vitest";
import { openRunStore, runKey, withRunLock } from "../src/run/store";
import { freshStore, revealedRun } from "./challenge";
import { loadEngine } from "./drive";

describe("the run store", () => {
  it("keeps a run across connections, as across a reload", async () => {
    const { factory, store } = await freshStore();
    const record = revealedRun(await loadEngine());
    await store.put(record);
    expect(await (await openRunStore(factory)).get(record.key)).toEqual(record);
  });

  it("lists the player's runs on a Challenge contract, in run order, whatever the address case", async () => {
    const { store } = await freshStore();
    const run = revealedRun(await loadEngine());
    const at = (runId: string, player = run.player) => ({ ...run, runId, player, key: runKey(run.chainId, run.challenge, runId) });
    await Promise.all([store.put(at("10")), store.put(at("9")), store.put(at("11", "0x0000000000000000000000000000000000000003"))]);
    const runs = await store.runsOf(run.chainId, run.challenge.toUpperCase().replace("0X", "0x"), run.player);
    expect(runs.map(({ runId }) => runId)).toEqual(["9", "10"]);
  });
});

/** The Web Locks of the page's tabs, which share them: a lock asked for with ifAvailable while
 *  another tab holds it is not granted. */
function tabLocks(): LockManager {
  const held = new Set<string>();
  const request = async (name: string, _options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
    if (held.has(name)) return callback(null);
    held.add(name);
    try {
      return await callback({ name, mode: "exclusive" });
    } finally {
      held.delete(name);
    }
  };
  return { request } as unknown as LockManager;
}

describe("a run's lock", () => {
  it("keeps a second tab from playing a run the first plays", async () => {
    const locks = tabLocks();
    const record = revealedRun(await loadEngine());
    let release = () => {};
    const first = withRunLock(locks, record.key, () => new Promise<void>((resolve) => (release = resolve)));
    const secondPlay = vi.fn(async () => {});
    const second = await withRunLock(locks, record.key, secondPlay);
    release();
    expect([second, secondPlay.mock.calls.length, await first]).toEqual([false, 0, true]);
  });
});
