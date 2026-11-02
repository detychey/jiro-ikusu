// What a reload resumes (plan M5.2): the runs whose startRun receipt the page did not see, and
// not a run committed elsewhere with other journals.

import { describe, expect, it } from "vitest";
import { continueRun, unfinishedRuns } from "../src/run/flow";
import { chainEnv, closedRun, freshStore, revealedRun, shippedLevels } from "./challenge";
import { loadEngine } from "./drive";

const LEVELS = shippedLevels();
const core = await loadEngine();
const PLAYER = revealedRun(core).player;
const OTHER = "0x0000000000000000000000000000000000000003";

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
