// The run file v1 of docs/VERIFICATION.md (plan M4.7, M5.2): written from a stored run, it reloads
// and reproduces the run's six Outcomes.

import { describe, expect, it } from "vitest";
import { fromHex } from "../src/core";
import type { Control } from "../src/input";
import { playLevels } from "../src/run/play";
import { parseRunFile, replayRunFile, runFileOf } from "../src/run/runfile";
import { freshStore, playEnv, revealedRun, shippedLevels } from "./challenge";
import { loadEngine } from "./drive";

const LEVELS = shippedLevels();
const STEPS: [number, Control[]][] = [
  [0, ["up"]],
  [40, ["right"]],
  [60, ["x"]],
];

async function playedRun() {
  const core = await loadEngine();
  const { store } = await freshStore();
  const env = playEnv(core, store, LEVELS, { controls: (_, tick) => STEPS.find(([at]) => at === tick)?.[1] });
  return { core, record: await playLevels(env, revealedRun(core)) };
}

describe("a run file", () => {
  it("reloads and reproduces the run's six outcomes", async () => {
    const { core, record } = await playedRun();
    const file = runFileOf(record, LEVELS);
    const expected = record.journals.map((journal, i) => {
      const slot = record.reveal?.drawSlots[i] ?? -1;
      const replayed = core.replay(LEVELS[slot] ?? new Uint8Array(), fromHex(journal), record.weightsBp[slot] ?? 0);
      return "outcome" in replayed ? replayed.outcome : replayed;
    });
    expect(replayRunFile(core, parseRunFile(JSON.stringify(file)), record.weightsBp)).toEqual(expected);
  });

  it("holds the fields of docs/VERIFICATION.md", async () => {
    const { record } = await playedRun();
    expect(Object.keys(runFileOf(record, LEVELS))).toEqual(["version", "chainId", "challenge", "runId", "runNonce", "levels", "drawSlots", "journals"]);
  });

  it("is refused in another version", async () => {
    const { record } = await playedRun();
    expect(() => parseRunFile(JSON.stringify({ ...runFileOf(record, LEVELS), version: 2 }))).toThrow("not a run file v1: version 2");
  });

  it("is refused with five journals", async () => {
    const { record } = await playedRun();
    const file = runFileOf(record, LEVELS);
    expect(() => parseRunFile(JSON.stringify({ ...file, journals: file.journals.slice(1) }))).toThrow("journals are not six byte strings");
  });

  it("is not written before the run has six journals", async () => {
    const core = await loadEngine();
    expect(() => runFileOf(revealedRun(core), LEVELS)).toThrow("has no six journals yet");
  });
});
