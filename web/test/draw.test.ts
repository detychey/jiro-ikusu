// jiro-wasm's draw and run commitment (README §6.4, §8.2) against the derivation fixtures of
// vectors/derivations.json, which the contracts and tools/xcheck check too.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromHex, hex } from "../src/core";
import { loadEngine, repo } from "./drive";

interface Derivations {
  draws: { runNonce: string; slots: number[] }[];
  runCommitments: { journals: string[]; journalHashes: string[]; runCommitment: string }[];
}

const DERIVATIONS: Derivations = JSON.parse(readFileSync(new URL("vectors/derivations.json", repo), "utf8"));
const COMMITMENTS = DERIVATIONS.runCommitments.map((fixture, i) => [i, fixture] as const);
const core = await loadEngine();

describe("the core's draw", () => {
  it.each(DERIVATIONS.draws.map(({ runNonce, slots }) => [runNonce, slots] as const))("of %s is %j", (runNonce, slots) => {
    expect(core.draw(fromHex(runNonce))).toEqual(slots);
  });
});

describe("the core's run commitment", () => {
  it.each(COMMITMENTS)("of fixture %i", (_, { journals, runCommitment }) => {
    expect(hex(core.runCommitment(journals.map(fromHex)))).toBe(runCommitment);
  });

  it.each(COMMITMENTS)("hashes the journals of fixture %i", (_, { journals, journalHashes }) => {
    expect(journals.map((journal) => hex(core.journalHash(fromHex(journal))))).toEqual(journalHashes);
  });
});
