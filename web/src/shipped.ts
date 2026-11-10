// The levels the site ships: the 16 of levels/*.bin, by name in index order, which Training
// scores and a season's draw slots name (README §5, §8.2), and Training's two unscored test levels.

import openField from "../../vectors/format/level-open-field.json";
import wallsAndMinions from "../../vectors/format/level-walls-and-minions.json";
import { type Core, hex } from "./core";

/** Training's unscored test levels, the levels of two format vectors (README §6.6), by name, in hex. */
export const TEST_LEVELS: [string, string][] = [
  ["Open field", openField.input],
  ["Walls and minions", wallsAndMinions.input],
];

const SHIPPED_LEVELS: Record<string, string> = import.meta.glob("../../levels/*.bin", {
  query: "?url",
  import: "default",
  eager: true,
});

async function fetchLevel(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not load the level ${url} (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

export function shippedLevels(): Promise<[string, Uint8Array][]> {
  return Promise.all(
    Object.entries(SHIPPED_LEVELS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([path, url]): Promise<[string, Uint8Array]> => [path.replace(/^.*\//, "").replace(/\.bin$/, ""), await fetchLevel(url)]),
  );
}

/** The scoring of a calibration file (README §8.4): its rules version, and the level ids and
 *  weights of the 16 levels in index order. */
export interface Calibration {
  rulesVersion: number;
  levelIds: string[];
  weightsBp: number[];
}

/** One of the 16 levels: its name, its bytes, its level id and its weight. */
export interface TrainingLevel {
  name: string;
  level: Uint8Array;
  levelId: string;
  weightBp: number;
}

/** The 16 levels with their weights. `bundled` are the page's levels by name, in index order,
 *  and must be the calibration's under the engine's rules version: otherwise the page would show
 *  scores that no season gives, so it throws. */
export function trainingLevels(core: Core, scoring: Calibration, bundled: [string, Uint8Array][]): TrainingLevel[] {
  if (scoring.rulesVersion !== core.rulesVersion) {
    throw new Error(`the calibration is for rules version ${scoring.rulesVersion}, the engine runs ${core.rulesVersion}`);
  }
  const levels = bundled.map(([name, level], i) => ({
    name,
    level,
    levelId: hex(core.levelId(level)),
    weightBp: scoring.weightsBp[i],
  }));
  const ids = scoring.levelIds;
  if (levels.length !== ids.length || levels.some(({ levelId, weightBp }, i) => levelId !== ids[i] || weightBp === undefined)) {
    throw new Error("the bundled levels are not the calibration's 16 levels");
  }
  return levels as TrainingLevel[];
}
