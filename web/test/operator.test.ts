// The operator's settlement of a season (plan M5.5): which committed runs it settles, from chain
// state faked here and run files the core replays.

import { describe, expect, it } from "vitest";
import type { Contracts } from "../src/chain/contracts";
import { type CommittedReader, runsToSettle } from "../src/chain/operator";
import { runFileOf } from "../src/run/runfile";
import type { RunRecord } from "../src/run/store";
import { closedRun, playedRun, shippedLevels } from "./challenge";
import { loadEngine } from "./drive";

const LEVELS = shippedLevels();
const core = await loadEngine();
const PLAYER = "0x0000000000000000000000000000000000000002";
const OTHER = "0x0000000000000000000000000000000000000003";
const SEASON = 1n;
/** The commit time of an on-time run of the fixtures: they reveal at 1,000 with a 120-s slack. */
const ON_TIME = 1_100n;

interface ChainRun {
  record: RunRecord;
  player?: string;
  season?: bigint;
  committedAt?: bigint;
  status?: bigint;
}

interface Recorded {
  runId: bigint;
  score: bigint;
  ticks: bigint;
  qualified: boolean;
}

const NONE: Recorded = { runId: 0n, score: 0n, ticks: 0n, qualified: false };

/** Challenge and Season as the operator reads them, holding `runs` as run ids 1, 2, … */
function chainOf(runs: ChainRun[], recorded: Record<string, Recorded> = {}): Pick<Contracts, "challenge" | "season"> {
  const at = (runId: bigint) => runs[Number(runId) - 1] as ChainRun;
  return {
    challenge: {
      runCount: async () => BigInt(runs.length),
      runs: async (runId: bigint) => {
        const run = at(runId);
        return { player: run.player ?? PLAYER, season: run.season ?? SEASON, revealedAt: BigInt(run.record.reveal?.revealedAt ?? 0), committedAt: run.committedAt ?? ON_TIME };
      },
      settlements: async (runId: bigint) => ({ status: at(runId).status ?? 0n }),
    },
    season: {
      paramsOf: async () => ({ minClears: 1n, commitSlack: 120n }),
      bestRunOf: async (_: bigint, player: string) => recorded[player] ?? NONE,
    },
  } as unknown as Pick<Contracts, "challenge" | "season">;
}

/** Reads each run's file from its record, as committedRun reads it from chain data. */
function readerOf(runs: ChainRun[]): CommittedReader {
  return async (runId) => {
    const { record } = runs[Number(runId) - 1] as ChainRun;
    return { file: runFileOf(record, LEVELS), weightsBp: record.weightsBp };
  };
}

async function selected(runs: ChainRun[], recorded?: Record<string, Recorded>): Promise<bigint[]> {
  return (await runsToSettle(chainOf(runs, recorded), core, SEASON, readerOf(runs))).runs.map(({ runId }) => runId);
}

describe("the operator's settlement", () => {
  it("settles each player's best on-time run", async () => {
    const runs = [{ record: closedRun(core, LEVELS) }, { record: await playedRun(core, LEVELS) }, { record: closedRun(core, LEVELS), player: OTHER }];
    expect(await selected(runs)).toEqual([2n, 3n]);
  });

  it("leaves out a run committed after its deadline", async () => {
    const runs = [{ record: closedRun(core, LEVELS) }, { record: await playedRun(core, LEVELS), committedAt: 2_000n }];
    expect(await selected(runs)).toEqual([1n]);
  });

  it("leaves out settled runs, runs of other seasons and uncommitted runs", async () => {
    const played = await playedRun(core, LEVELS);
    const runs = [{ record: played, status: 1n }, { record: played, season: 2n }, { record: played, committedAt: 0n }];
    expect(await selected(runs)).toEqual([]);
  });

  it("leaves out a run that ranks no higher than the best Season holds", async () => {
    const played = await playedRun(core, LEVELS);
    const [best] = (await runsToSettle(chainOf([{ record: played }]), core, SEASON, readerOf([{ record: played }]))).runs;
    const recorded = { [PLAYER]: { runId: 9n, score: BigInt(best?.score ?? 0), ticks: BigInt(best?.ticks ?? 0), qualified: best?.qualified ?? false } };
    expect(await selected([{ record: played }], recorded)).toEqual([]);
  });

  it("settles a run that ranks above the best Season holds", async () => {
    const recorded = { [PLAYER]: { runId: 9n, score: 0n, ticks: 6n, qualified: false } };
    expect(await selected([{ record: await playedRun(core, LEVELS) }], recorded)).toEqual([1n]);
  });

  it("reports a run it cannot read, and still settles the others", async () => {
    const runs = [{ record: closedRun(core, LEVELS) }, { record: closedRun(core, LEVELS), player: OTHER }];
    const read: CommittedReader = async (runId) => {
      if (runId === 1n) throw new Error("no RunCommitted log");
      return readerOf(runs)(runId);
    };
    const { runs: settled, unread } = await runsToSettle(chainOf(runs), core, SEASON, read);
    expect([settled.map(({ runId }) => runId), unread.map(({ runId }) => runId)]).toEqual([[2n], [1n]]);
  });
});
