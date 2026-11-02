// Settlement from the dApp (plan M5.3): the player's best run in D10's order, settled with one
// settleRun, or level by level when settleRun does not fit in one transaction, with retries and
// decoded reverts; on zk, the operator settles, and the page shows the cutoff.

import { Interface, makeError } from "ethers";
import { describe, expect, it } from "vitest";
import { CHALLENGE_ABI } from "../src/chain/bindings/Challenge";
import type { Contracts } from "../src/chain/contracts";
import type { Deployment } from "../src/chain/deployments";
import type { Control } from "../src/input";
import { bestRun, operatorHandoff, ranksAbove, settleOnchain, settlesInBrowser } from "../src/pages/settle";
import { playLevels } from "../src/run/play";
import { runFileOf } from "../src/run/runfile";
import type { RunRecord } from "../src/run/store";
import { closedRun, freshStore, playEnv, revealedRun, shippedLevels } from "./challenge";
import { loadEngine } from "./drive";

const CHALLENGE = new Interface(CHALLENGE_ABI);
const LEVELS = shippedLevels();
const core = await loadEngine();
const STEPS: [number, Control[]][] = [
  [0, ["up"]],
  [40, ["right"]],
  [60, ["x"]],
];

function committed(record: RunRecord, runId: string, committedAt = 1_100): RunRecord {
  return { ...record, runId, commit: { committedAt } };
}

async function playedRun(): Promise<RunRecord> {
  const env = playEnv(core, (await freshStore()).store, LEVELS, { controls: (_, tick) => STEPS.find(([at]) => at === tick)?.[1] });
  return playLevels(env, revealedRun(core));
}

describe("the best run", () => {
  it("ranks a qualifying run above a higher score that does not qualify", () => {
    expect(ranksAbove({ qualified: true, score: 1, ticks: 9 }, { qualified: false, score: 9, ticks: 1 })).toBe(true);
  });

  it("ranks fewer ticks above more on the same score", () => {
    expect(ranksAbove({ qualified: true, score: 5, ticks: 8 }, { qualified: true, score: 5, ticks: 9 })).toBe(true);
  });

  it("does not rank a full tie above", () => {
    expect(ranksAbove({ qualified: true, score: 5, ticks: 8 }, { qualified: true, score: 5, ticks: 8 })).toBe(false);
  });

  it("is the season's committed run with the highest score", async () => {
    const records = [committed(closedRun(core, LEVELS), "1"), committed(await playedRun(), "2")];
    expect(bestRun(core, LEVELS, records, 1n, 6)?.record.runId).toBe("2");
  });

  it("leaves out a run of another season", async () => {
    const records = [committed(closedRun(core, LEVELS), "1"), { ...committed(await playedRun(), "2"), season: "2" }];
    expect(bestRun(core, LEVELS, records, 1n, 6)?.record.runId).toBe("1");
  });

  it("leaves out a run that is not committed", async () => {
    expect(bestRun(core, LEVELS, [closedRun(core, LEVELS)], 1n, 1)).toBeUndefined();
  });

  it("leaves out a run committed after its deadline", async () => {
    const records = [committed(closedRun(core, LEVELS), "1"), committed(await playedRun(), "2", 1_000_000)];
    expect(bestRun(core, LEVELS, records, 1n, 6)?.record.runId).toBe("1");
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

  it("settles level by level when settleRun needs more than the gas cap", async () => {
    const { contracts, calls } = fakeContracts({ estimate: async () => 40_000_000n });
    await settleOnchain(contracts, FILE, ignore);
    expect(calls).toEqual([0, 1, 2, 3, 4, 5].map((i) => `settleLevel(7, ${i})`));
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
});
