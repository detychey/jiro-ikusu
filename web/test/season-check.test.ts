// The season check (plan M5.2): the page refuses to buy a run in a season whose rules version or
// level ids are not the page's, before any startRun.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { AcceptingSeason } from "../src/chain/contracts";
import type { SeasonParams } from "../src/chain/bindings/Season";
import { hex } from "../src/core";
import { buyRun, type RunEnv, SeasonChanged } from "../src/run/flow";
import { checkSeason, seasonEntries } from "../src/run/season";
import { freshStore, runEnv, shippedLevels } from "./challenge";
import { loadEngine, repo } from "./drive";

const CALIBRATION = JSON.parse(readFileSync(new URL("seasons/calibration-1.json", repo), "utf8"));
const core = await loadEngine();
const LEVELS = shippedLevels();
const SHIPPED_IDS = LEVELS.map((level) => hex(core.levelId(level)));
const OTHER_ID = `0x${"ab".repeat(32)}`;

function seasonWith(rulesVersion: number, levelIds: string[]): AcceptingSeason {
  const params = { rulesVersion: BigInt(rulesVersion), levelIds, weightsBp: CALIBRATION.weightsBp.map(BigInt), commitSlack: 120n };
  return { number: 1n, runFee: 50_000_000_000_000n, end: 2_000_000_000n, params: params as unknown as SeasonParams };
}

const withOtherLevel = (slot: number) => CALIBRATION.levelIds.map((id: string, i: number) => (i === slot ? OTHER_ID : id));

/** A run env whose Challenge counts the startRun calls, which these tests never let through. */
async function envWithStartRun() {
  const startRun = vi.fn();
  const env = runEnv(core, (await freshStore()).store, LEVELS, { challenge: { startRun } });
  return { env: { ...env, levelIds: SHIPPED_IDS }, startRun };
}

describe("the season check", () => {
  it("passes the season of seasons/calibration-1.json, whose 16 levels the page ships", () => {
    expect(() => checkSeason(core.rulesVersion, SHIPPED_IDS, seasonWith(CALIBRATION.rulesVersion, CALIBRATION.levelIds).params)).not.toThrow();
  });

  it("refuses a season with another rules version", () => {
    expect(() => checkSeason(core.rulesVersion, SHIPPED_IDS, seasonWith(core.rulesVersion + 1, CALIBRATION.levelIds).params)).toThrow(
      `it accepts rules version ${core.rulesVersion + 1}, and the page plays rules version ${core.rulesVersion}`,
    );
  });

  it("refuses a season with another level id", () => {
    expect(() => checkSeason(core.rulesVersion, SHIPPED_IDS, seasonWith(core.rulesVersion, withOtherLevel(7)).params)).toThrow(
      `its level in slot 7 is ${OTHER_ID}`,
    );
  });

  it("refuses a season drawing from another number of levels", () => {
    expect(() => checkSeason(core.rulesVersion, SHIPPED_IDS, seasonWith(core.rulesVersion, CALIBRATION.levelIds.slice(1)).params)).toThrow(
      "it draws from 15 levels, and the page ships 16",
    );
  });
});

describe("buying a run", () => {
  it("never calls startRun in a season with another rules version", async () => {
    const { env, startRun } = await envWithStartRun();
    await expect(buyRun(env, seasonWith(core.rulesVersion + 1, CALIBRATION.levelIds), "0x0000000000000000000000000000000000000002")).rejects.toThrow(
      "this page cannot play the season",
    );
    expect(startRun).not.toHaveBeenCalled();
  });

  it("never calls startRun in a season with another level id", async () => {
    const { env, startRun } = await envWithStartRun();
    await expect(buyRun(env, seasonWith(core.rulesVersion, withOtherLevel(0)), "0x0000000000000000000000000000000000000002")).rejects.toThrow(
      "this page cannot play the season",
    );
    expect(startRun).not.toHaveBeenCalled();
  });
});

describe("buying a run in the season shown", () => {
  it("never calls startRun once another season accepts runs", async () => {
    const { env, startRun } = await envWithStartRun();
    const accepting = seasonWith(CALIBRATION.rulesVersion, CALIBRATION.levelIds);
    const season = {
      currentSeason: async () => 2n,
      paramsOf: async () => ({ ...accepting.params, runFee: accepting.runFee }),
      endOf: async () => accepting.end,
    };
    const changed = {
      ...env,
      contracts: { ...env.contracts, season } as unknown as RunEnv["contracts"],
      provider: { getBlock: async () => ({ timestamp: 1_000 }) } as unknown as RunEnv["provider"],
    };
    await expect(buyRun(changed, accepting, "0x0000000000000000000000000000000000000002")).rejects.toThrow(SeasonChanged);
    expect(startRun).not.toHaveBeenCalled();
  });
});

describe("the season view", () => {
  const facts = {
    number: 1n,
    runFee: 50_000_000_000_000n,
    end: 1_800_000_000n,
    rulesVersion: 2n,
    rakeBp: 1_000n,
    grace: 172_800n,
    commitSlack: 120n,
    minClears: 1n,
    fees: 150_000_000_000_000n,
    rollover: 0n,
  };
  const formatEth = (wei: bigint) => `${wei} wei`;

  it("shows the price", () => {
    expect(seasonEntries(facts, formatEth)).toContainEqual(["Run fee", "50000000000000 wei"]);
  });

  it("shows the players' pot: the fees less the rake, plus the rollover", () => {
    expect(seasonEntries({ ...facts, rollover: 7n }, formatEth)).toContainEqual([
      "Players' pot",
      "135000000000007 wei: 150000000000000 wei of fees less the 10 % rake, with 7 wei rolled over",
    ]);
  });

  it("shows the commit slack and the qualification", () => {
    const entries = seasonEntries(facts, formatEth);
    expect([entries.find(([label]) => label === "Commit slack"), entries.find(([label]) => label === "Qualifies with")]).toEqual([
      ["Commit slack", "120 s"],
      ["Qualifies with", "1 cleared level"],
    ]);
  });
});
