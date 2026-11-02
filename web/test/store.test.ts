// The run store in IndexedDB (plan M5.2).

import { describe, expect, it } from "vitest";
import { openRunStore, runKey } from "../src/run/store";
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
