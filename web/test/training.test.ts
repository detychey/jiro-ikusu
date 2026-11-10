import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import calibration from "../../seasons/calibration-1.json";
import { fromHex, hex } from "../src/core";
import { DEFAULT_BINDINGS } from "../src/input";
import { attemptScore, beats, bestKey, loadBests, mergeBests, saveBests, scoreLine } from "../src/pages/training";
import { type TrainingLevel, trainingLevels } from "../src/shipped";
import { bundled, loadEngine, play, repo, schedule } from "./drive";

interface GateVector {
  level: string;
  runNonce: string;
  journal: string;
  weightBp: number;
  outcome: { levelScore: number };
}

/** The bot journal of each level's gate set (plan M2.9): its longest bot run. */
function worst(index: number): GateVector {
  const name = `${String(index).padStart(2, "0")}-worst.json`;
  return JSON.parse(readFileSync(new URL(`vectors/levels/${name}`, repo), "utf8"));
}

/** A storage of its own, in memory. */
function memory() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const FIRST_ID = calibration.levelIds[0] as string;

const throwing = () => {
  throw new Error("denied");
};

describe("training", () => {
  it.each(Array.from({ length: 16 }, (_, i) => i + 1))(
    "plays level %i to the end and scores its bot journal at the level_score of its gate-set vector",
    async (index) => {
      const core = await loadEngine();
      const levels = trainingLevels(core, calibration, bundled);
      const { name, level, weightBp } = levels[index - 1] as TrainingLevel;
      const vector = worst(index);
      expect([name.slice(0, 2), hex(level), weightBp]).toEqual([String(index).padStart(2, "0"), vector.level, vector.weightBp]);
      const events = schedule(fromHex(vector.journal));
      const { journal } = play(core, level, fromHex(vector.runNonce), DEFAULT_BINDINGS, (tick) => events.get(tick));
      expect(hex(journal)).toBe(vector.journal);
      expect(attemptScore(core, level, journal, weightBp)).toBe(vector.outcome.levelScore);
    },
  );

  it("refuses levels that are not the calibration's", async () => {
    const core = await loadEngine();
    const swapped = [bundled[1], bundled[0], ...bundled.slice(2)] as [string, Uint8Array][];
    expect(() => trainingLevels(core, calibration, swapped)).toThrow("the bundled levels are not the calibration's 16 levels");
  });

  it("refuses a calibration for another rules version", async () => {
    const core = await loadEngine();
    expect(() => trainingLevels(core, { ...calibration, rulesVersion: core.rulesVersion + 1 }, bundled)).toThrow(
      `the calibration is for rules version ${core.rulesVersion + 1}`,
    );
  });

  it("shows the score as it is, and whether it is a new best", () => {
    expect([scoreLine(11_999, undefined), scoreLine(12_500, 11_999), scoreLine(9_000, 11_999)]).toEqual([
      "Score 11999, the first on this level.",
      "Score 12500, a new best (was 11999).",
      "Score 9000. Best 11999.",
    ]);
  });

  it("counts a first score, even 0, as a best, and a tie as no new best", () => {
    expect([beats(0, undefined), beats(5, 5), beats(6, 5)]).toEqual([true, false, true]);
  });

  it("keeps a best per rules version, level id and weight", () => {
    const keys = [bestKey(2, FIRST_ID, 15_503), bestKey(3, FIRST_ID, 15_503), bestKey(2, FIRST_ID, 15_504)];
    expect(new Set(keys).size).toBe(3);
  });

  it("merges the bests of another tab, keeping the higher score of each level", () => {
    expect(mergeBests({ a: 10, b: 5 }, { b: 7, c: 0, a: 3 })).toEqual({ a: 10, b: 7, c: 0 });
  });

  it("restores the bests it stored", () => {
    const storage = memory();
    const bests = { [bestKey(2, FIRST_ID, 15_503)]: 11_999 };
    expect([saveBests(storage, bests), loadBests(storage)]).toEqual([true, bests]);
  });

  it("starts with no bests when reading storage throws", () => {
    expect(loadBests({ getItem: throwing, setItem: () => undefined })).toEqual({});
  });

  it("reports that the bests were not stored when writing storage throws", () => {
    expect(saveBests({ getItem: () => null, setItem: throwing }, {})).toBe(false);
  });

  it("starts with no bests, and keeps none, without storage", () => {
    expect([loadBests(undefined), saveBests(undefined, {})]).toEqual([{}, false]);
  });

  it("ignores stored bests that are not scores", () => {
    const storage = memory();
    storage.setItem("jiro-ikusu.training-bests", JSON.stringify({ a: -1 }));
    expect(loadBests(storage)).toEqual({});
  });
});
