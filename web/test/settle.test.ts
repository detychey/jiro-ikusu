// Settlement from the dApp (plan M5.3, M5.15): the player's scoring runs, cheapest first, each
// settled with one settleRun, or level by level when settleRun does not fit in one transaction,
// with retries and decoded reverts; on zk, the operator settles, and the page shows the cutoff.
// Tickets and the order of settlement (README §8.4).

import { Interface, makeError } from "ethers";
import { describe, expect, it } from "vitest";
import { CHALLENGE_ABI } from "../src/chain/bindings/Challenge";
import type { Contracts } from "../src/chain/contracts";
import type { Deployment } from "../src/chain/deployments";
import { operatorHandoff, scoringRuns, settleOnchain, settlesInBrowser } from "../src/pages/settle";
import { cheaperFirst, ticketOf } from "../src/run/score";
import { runFileOf } from "../src/run/runfile";
import type { RunRecord } from "../src/run/store";
import { closedRun, playedRun, shippedLevels } from "./challenge";
import { loadEngine } from "./drive";

const CHALLENGE = new Interface(CHALLENGE_ABI);
const LEVELS = shippedLevels();
const core = await loadEngine();

function committed(record: RunRecord, runId: string, committedAt = 1_100): RunRecord {
  return { ...record, runId, commit: { committedAt } };
}


/** Level bytes v1 that carry only a target, at offset 470 (README §5). */
function levelWithTarget(target: number): Uint8Array {
  const level = new Uint8Array(472);
  level[470] = target >> 8;
  level[471] = target & 0xff;
  return level;
}

describe("a game's ticket", () => {
  it("is the claim over the target, rounded down", () => {
    expect(ticketOf({ endReason: "Time limit", claimBp: 7_499 }, levelWithTarget(7_500))).toBe(9_998);
  });

  it("is capped at a full ticket above the target", () => {
    expect(ticketOf({ endReason: "Committed", claimBp: 9_000 }, levelWithTarget(5_000))).toBe(10_000);
  });

  it("is 0 when the lives ran out", () => {
    expect(ticketOf({ endReason: "Out of lives", claimBp: 9_000 }, levelWithTarget(5_000))).toBe(0);
  });

  it("refuses bytes with no target", () => {
    expect(() => ticketOf({ endReason: "Cleared", claimBp: 9_000 }, new Uint8Array(472))).toThrow("no target at offset 470");
  });
});

describe("the order of settlement", () => {
  it("settles the run of fewer ticks first", () => {
    expect([{ ticks: 900, runId: 1n }, { ticks: 30, runId: 2n }].sort(cheaperFirst).map(({ runId }) => runId)).toEqual([2n, 1n]);
  });

  it("settles the run committed first on a tie", () => {
    expect([{ ticks: 30, runId: 2n }, { ticks: 30, runId: 1n }].sort(cheaperFirst).map(({ runId }) => runId)).toEqual([1n, 2n]);
  });
});

describe("the scoring runs", () => {
  it("are the season's committed runs with a ticket above 0", async () => {
    const records = [committed(closedRun(core, LEVELS), "1"), committed(await playedRun(core, LEVELS), "2")];
    expect(scoringRuns(core, LEVELS, records, 1n).map(({ runId }) => runId)).toEqual([2n]);
  });

  it("are all of them, cheapest first", async () => {
    const played = await playedRun(core, LEVELS);
    const records = [committed(played, "2"), committed(played, "1")];
    expect(scoringRuns(core, LEVELS, records, 1n).map(({ runId }) => runId)).toEqual([1n, 2n]);
  });

  it("leave out a run of another season", async () => {
    const records = [{ ...committed(await playedRun(core, LEVELS), "2"), season: "2" }];
    expect(scoringRuns(core, LEVELS, records, 1n)).toEqual([]);
  });

  it("leave out a run that is not committed", async () => {
    expect(scoringRuns(core, LEVELS, [await playedRun(core, LEVELS)], 1n)).toEqual([]);
  });

  it("leave out a run committed after its deadline", async () => {
    const records = [committed(await playedRun(core, LEVELS), "2", 1_000_000)];
    expect(scoringRuns(core, LEVELS, records, 1n)).toEqual([]);
  });
});

/** A transaction that records its function and its first `shown` arguments. */
const sent = (calls: string[], name: string, shown: number) => async (...args: unknown[]) => {
  calls.push(`${name}(${args.slice(0, shown).map(String).join(", ")})`);
  return { wait: async () => ({ status: 1, logs: [], hash: `0x${"00".repeat(32)}` }) };
};

interface ChallengeScript {
  estimate?: () => Promise<bigint>;
  settledLevels?: bigint;
  status?: bigint;
  /** Failures of settleRun's transaction, thrown in order before it goes through. */
  failures?: Error[];
}

/** A Challenge stand-in that records the settlement transactions sent. */
function fakeContracts(script: ChallengeScript) {
  const calls: string[] = [];
  const failures = [...(script.failures ?? [])];
  const settleRun = Object.assign(
    async (...args: unknown[]) => {
      const failure = failures.shift();
      if (failure !== undefined) throw failure;
      return sent(calls, "settleRun", 1)(...args);
    },
    { estimateGas: script.estimate ?? (async () => 400_000n) },
  );
  const challenge = {
    interface: CHALLENGE,
    settlements: async () => ({ status: script.status ?? 0n, settledLevels: script.settledLevels ?? 0n }),
    settleRun,
    settleLevel: sent(calls, "settleLevel", 2),
  };
  const season = { interface: new Interface([]) };
  return { contracts: { challenge, season } as unknown as Contracts, calls };
}

const FILE = runFileOf(committed(closedRun(core, LEVELS), "7"), LEVELS);
const ignore = () => {};
const outOfGas = () =>
  makeError("out of gas", "CALL_EXCEPTION", { action: "estimateGas", data: null, reason: null, transaction: { to: null, data: "0x" }, invocation: null, revert: null });

describe("settling a run in the browser", () => {
  it("sends one settleRun when it fits in a transaction", async () => {
    const { contracts, calls } = fakeContracts({});
    await settleOnchain(contracts, FILE, ignore);
    expect(calls).toEqual(["settleRun(7)"]);
  });

  it("settles level by level when settleRun needs more than the caller's gas cap", async () => {
    const { contracts, calls } = fakeContracts({ estimate: async () => 400_000n });
    await settleOnchain(contracts, FILE, ignore, 1n);
    expect(calls).toEqual([0, 1, 2, 3, 4, 5].map((i) => `settleLevel(7, ${i})`));
  });

  it("sends settleRun when its estimate, L1 data cost included, is above 32M but the estimate succeeds", async () => {
    const { contracts, calls } = fakeContracts({ estimate: async () => 34_000_000n });
    await settleOnchain(contracts, FILE, ignore);
    expect(calls).toEqual(["settleRun(7)"]);
  });

  it("settles level by level when settleRun runs out of gas in the estimate", async () => {
    const { contracts, calls } = fakeContracts({
      estimate: async () => {
        throw outOfGas();
      },
    });
    await settleOnchain(contracts, FILE, ignore);
    expect(calls).toHaveLength(6);
  });

  it("goes on from the levels already settled", async () => {
    const { contracts, calls } = fakeContracts({ settledLevels: 0b000111n });
    await settleOnchain(contracts, FILE, ignore);
    expect(calls).toEqual([3, 4, 5].map((i) => `settleLevel(7, ${i})`));
  });

  it("sends nothing for a run already settled", async () => {
    const { contracts, calls } = fakeContracts({ status: 1n });
    await settleOnchain(contracts, FILE, ignore);
    expect(calls).toEqual([]);
  });

  it("reports a revert decoded, without settling level by level", async () => {
    const data = CHALLENGE.encodeErrorResult("WrongCommitment", [7n]);
    const revert = makeError("execution reverted", "CALL_EXCEPTION", { action: "estimateGas", data, reason: null, transaction: { to: null, data: "0x" }, invocation: null, revert: null });
    const { contracts, calls } = fakeContracts({
      estimate: async () => {
        throw revert;
      },
    });
    await expect(settleOnchain(contracts, FILE, ignore)).rejects.toThrow("settleRun(7): reverts with WrongCommitment(7)");
    expect(calls).toEqual([]);
  });

  it("tries again after a network failure", async () => {
    const { contracts, calls } = fakeContracts({ failures: [makeError("the network dropped", "NETWORK_ERROR", { event: "request" })] });
    const progress: string[] = [];
    await settleOnchain(contracts, FILE, (text) => progress.push(text));
    expect([calls.length, progress.some((text) => text.includes("trying again, 2 of 3"))]).toEqual([1, true]);
  });

  it("gives up after three network failures", async () => {
    const failure = () => makeError("the network dropped", "NETWORK_ERROR", { event: "request" });
    const { contracts } = fakeContracts({ failures: [failure(), failure(), failure()] });
    await expect(settleOnchain(contracts, FILE, ignore)).rejects.toThrow("the network dropped");
  });
});

describe("the zk backend", () => {
  it("leaves settlement to the operator", () => {
    expect(settlesInBrowser({ backend: "zk" } as Deployment)).toBe(false);
  });

  it("shows the cutoff", () => {
    expect(operatorHandoff("Arbitrum Sepolia", 1_800_000_000n)).toContain("the season's settlement closes at 2027-01-15T08:00:00.000Z (block time 1800000000)");
  });

  it("asks the player for nothing", () => {
    expect(operatorHandoff("Arbitrum Sepolia", 1_800_000_000n)).toContain("the operator settles every scoring run from the chain's data, so you have nothing to send");
  });
});
