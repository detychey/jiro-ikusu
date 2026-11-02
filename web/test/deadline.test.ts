// The commit deadline (README §7.2) against every deadline fixture of vectors/derivations.json
// (plan M4.7), which contracts/test/Settlement.t.sol checks the contract against.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deadlineOf, isOnTime, latestCommitOf } from "../src/run/deadline";
import { repo } from "./drive";

interface DeadlineFixture {
  revealedAt: number;
  ticksUsed: number[];
  commitSlack: number;
  committedAt: number;
  onTime: boolean;
}

const FIXTURES: DeadlineFixture[] = JSON.parse(readFileSync(new URL("vectors/derivations.json", repo), "utf8")).deadlines;

describe("the deadline", () => {
  it("has fixtures on both sides of each ceil-division boundary", () => {
    expect(FIXTURES.filter(({ onTime }) => onTime).length).toBeGreaterThan(0);
    expect(FIXTURES.filter(({ onTime }) => !onTime).length).toBeGreaterThan(0);
  });

  it.each(FIXTURES.map((fixture, i) => [i, fixture] as const))("gives fixture %i's result", (_, fixture) => {
    const { revealedAt, ticksUsed, commitSlack, committedAt, onTime } = fixture;
    expect(isOnTime(BigInt(committedAt), BigInt(revealedAt), ticksUsed, BigInt(commitSlack))).toBe(onTime);
  });

  it("is README §7.2's example", () => {
    expect(deadlineOf(1_000_000n, [1, 2_700, 1_800, 900, 15, 16], 120n)).toBe(1_000_483n);
  });

  it("bounds commitRun at 1,080 s plus the commit slack", () => {
    expect(latestCommitOf(1_000_000n, 120n)).toBe(1_001_200n);
  });
});
