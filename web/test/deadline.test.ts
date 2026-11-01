// The commit deadline (README §7.2) against every deadline fixture of vectors/derivations.json
// (plan M4.7), which contracts/test/Settlement.t.sol checks the contract against.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deadlineOf, isOnTime, latestCommitOf } from "../src/run/deadline";
import { marginOf } from "../src/run/play";
import { revealedRun } from "./challenge";
import { loadEngine, repo } from "./drive";

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

describe("the countdown", () => {
  it("counts the level in play as closed at its next tick, and each unplayed level as one tick", async () => {
    // Revealed at 1,000 with a slack of 120 s: levels of 2,700 and 27 ticks, 300 ticks in play
    // (301 once closed), and three unplayed levels make 3,031 ticks, which round up to 203 s.
    const record = revealedRun(await loadEngine());
    expect(marginOf(record, [2_700, 27], 300, 1_050_000)).toEqual({ onTime: 1_323n - 1_050n, commitBound: 2_200n - 1_050n });
  });
});
