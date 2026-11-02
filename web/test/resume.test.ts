// What a reload resumes (plans M5.2 and M5.7): the runs whose startRun receipt the page did not
// see, every unfinished run of the player in turn, and not a run committed elsewhere with other
// journals.

import { describe, expect, it } from "vitest";
import { continueRun, playUnfinished, unfinishedRuns } from "../src/run/flow";
import { type RunRecord, runKey } from "../src/run/store";
import { chainEnv, closedRun, freshStore, revealedRun, shippedLevels } from "./challenge";
import { loadEngine } from "./drive";

const LEVELS = shippedLevels();
const core = await loadEngine();
const PLAYER = revealedRun(core).player;
const OTHER = "0x0000000000000000000000000000000000000003";

function runOf(runId: string, fields: Partial<RunRecord> = {}): RunRecord {
  const record = revealedRun(core);
  return { ...record, ...fields, runId, key: runKey(record.chainId, record.challenge, runId) };
}

describe("a reload while startRun was confirming", () => {
  it("finds the player's unrevealed run onchain, down to the first run whose reveal lapsed", async () => {
    const { store } = await freshStore();
    const runs = [
      { player: PLAYER, target: 10n },
      { player: OTHER, target: 400n },
      { player: PLAYER, target: 400n },
    ];
    const env = chainEnv(core, store, LEVELS, runs, { block: 420n, timestamp: 2_000 });
    const found = await unfinishedRuns(env, PLAYER);
    expect(found.map(({ runId, season, commitSlack, journals }) => [runId, season, commitSlack, journals])).toEqual([["3", "1", 120, []]]);
  });
});

describe("a reload that leaves several runs unfinished", () => {
  async function stored() {
    const { store } = await freshStore();
    await store.put(runOf("4", { commit: { committedAt: 1_100 } }));
    await store.put(runOf("6", { live: { levelIndex: 2, events: [], ticks: 40 } }));
    await store.put(runOf("5"));
    return chainEnv(core, store, LEVELS, [], { block: 0n, timestamp: 1_100 });
  }

  it("plays each of them, oldest first", async () => {
    const env = await stored();
    const played: string[] = [];
    await playUnfinished(env, PLAYER, async (record) => {
      played.push(record.runId);
      await env.store.put({ ...record, commit: { committedAt: 1_200 } });
      return true;
    });
    expect(played).toEqual(["5", "6"]);
  });

  it("tries a run left unfinished, as one another tab plays, once", async () => {
    const env = await stored();
    const played: string[] = [];
    await playUnfinished(env, PLAYER, async (record) => {
      played.push(record.runId);
      return true;
    });
    expect(played).toEqual(["5", "6"]);
  });
});

describe("a run committed onchain with other journals", () => {
  it("is forfeited, and no longer unfinished", async () => {
    const { store } = await freshStore();
    const record = closedRun(core, LEVELS);
    const runs = [{ player: PLAYER, target: 1n, revealedAt: 1_000n, committedAt: 1_100n, commitment: `0x${"ab".repeat(32)}` }];
    const env = chainEnv(core, store, LEVELS, runs, { block: 1_000n, timestamp: 1_200 });
    await continueRun(env, record);
    expect(await unfinishedRuns(env, PLAYER)).toEqual([]);
  });
});
