// The season page (plan M5.3): where the season stands with its countdown, when anyone may close
// it, and the players' pot its claims share.

import { Interface } from "ethers";
import { describe, expect, it } from "vitest";
import { CHALLENGE_ABI } from "../src/chain/bindings/Challenge";
import { SEASON_ABI } from "../src/chain/bindings/Season";
import type { Contracts } from "../src/chain/contracts";
import { closable, formatDuration, readSeason, seasonPhase } from "../src/pages/season";

const END = 2_000_000n;
const SETTLEMENT_END = END + 172_800n;

function phaseView(closed = false, totalQualifiedPoints = 10n) {
  return { facts: { end: END } as never, settlementEnd: SETTLEMENT_END, closed, totalQualifiedPoints, closesNext: true };
}

describe("the season's phase", () => {
  it("counts down to the end while the season accepts runs", () => {
    expect(seasonPhase(phaseView(), END - 90_061n)).toBe("Accepting runs: it ends in 1 d 01 h 01 min 01 s.");
  });

  it("counts down to the end of the settlement once the season has ended", () => {
    expect(seasonPhase(phaseView(), END)).toBe("Ended: its runs settle for 2 d 00 h 00 min 01 s more.");
  });

  it("offers the close once the settlement has ended", () => {
    expect(seasonPhase(phaseView(), SETTLEMENT_END + 1n)).toBe("Its settlement has ended: anyone may close it.");
  });

  it("says a closed season with no qualified run rolled over", () => {
    expect(seasonPhase(phaseView(true, 0n), SETTLEMENT_END + 1n)).toContain("rolled over");
  });

  it("formats a duration", () => {
    expect(formatDuration(3_661n)).toBe("0 d 01 h 01 min 01 s");
  });
});

describe("the close", () => {
  it("is not offered at the last second of the settlement", () => {
    expect(closable(phaseView(), SETTLEMENT_END)).toBe(false);
  });

  it("is offered once the settlement has ended", () => {
    expect(closable(phaseView(), SETTLEMENT_END + 1n)).toBe(true);
  });

  it("is not offered while an earlier season is still open", () => {
    expect(closable({ ...phaseView(), closesNext: false }, SETTLEMENT_END + 1n)).toBe(false);
  });
});

/** Season 1 with fees of 1,000 wei, a 10 % rake, 7 wei rolled over, and no settled run; closed,
 *  its players' pot is 500 wei. */
function seasonOne(closed: boolean) {
  const season = {
    interface: new Interface(SEASON_ABI),
    getAddress: async () => "0x0000000000000000000000000000000000000005",
    paramsOf: async () => ({ runFee: 50n, rulesVersion: 2n, rakeBp: 1_000n, grace: 172_800n, commitSlack: 120n, minClears: 1n }),
    seasons: async () => ({ start: 1n, closed, fees: 1_000n, playersPot: closed ? 500n : 0n, totalQualifiedPoints: 0n }),
    endOf: async () => END,
    settlementEndOf: async () => SETTLEMENT_END,
    pendingRollover: async () => 7n,
    lastClosedSeason: async () => (closed ? 1n : 0n),
  };
  const challenge = { interface: new Interface(CHALLENGE_ABI), getAddress: async () => "0x0000000000000000000000000000000000000006" };
  const provider = { getBlockNumber: async () => 0, getBlock: async () => ({ timestamp: 1 }), getLogs: async () => [] };
  return { contracts: { season, challenge } as unknown as Contracts, provider: provider as never };
}

describe("the players' pot of the claims", () => {
  it("is projected from the fees, the rake and the rollover while the season is open", async () => {
    const { contracts, provider } = seasonOne(false);
    expect((await readSeason(contracts, provider, 1n)).playersPot).toBe(907n);
  });

  it("leaves out the rollover while an earlier season is still to close", async () => {
    const { contracts, provider } = seasonOne(false);
    expect((await readSeason(contracts, provider, 2n)).playersPot).toBe(900n);
  });

  it("is the contract's once the season has closed", async () => {
    const { contracts, provider } = seasonOne(true);
    expect((await readSeason(contracts, provider, 1n)).playersPot).toBe(500n);
  });
});
