// The operator's settlement of a season (plan M5.5, M5.15): which committed runs it settles, from
// chain state faked here and run files the core replays.

import { describe, expect, it } from "vitest";
import type { Contracts } from "../src/chain/contracts";
import { type CommittedReader, runsToSettle, stillToSettle } from "../src/chain/operator";
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

/** Challenge and Season as the operator reads them, holding `runs` as run ids 1, 2, … */
function chainOf(runs: ChainRun[]): Pick<Contracts, "challenge" | "season"> {
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
    season: { paramsOf: async () => ({ commitSlack: 120n }) },
  } as unknown as Pick<Contracts, "challenge" | "season">;
}

/** The journal header's mode byte (README §6.3). */
const MODE_OFFSET = 3;

/** `record` with level `levelIndex`'s journal in Training mode: the core replays it, and Challenge refuses its Outcome. */
function inTrainingMode(record: RunRecord, levelIndex: number): RunRecord {
  const journals = [...record.journals];
  const journal = journals[levelIndex] as string;
  const at = 2 + 2 * MODE_OFFSET;
  journals[levelIndex] = `${journal.slice(0, at)}00${journal.slice(at + 2)}`;
  return { ...record, journals };
}

/** Reads each run's file from its record, as committedRun reads it from chain data. */
function readerOf(runs: ChainRun[]): CommittedReader {
  return async (runId) => {
    const { record } = runs[Number(runId) - 1] as ChainRun;
    return { file: runFileOf(record, LEVELS), weightsBp: record.weightsBp };
  };
}

async function selected(runs: ChainRun[]): Promise<bigint[]> {
  return (await runsToSettle(chainOf(runs), core, SEASON, readerOf(runs))).runs.map(({ runId }) => runId);
}

describe("the operator's settlement", () => {
  it("settles every on-time scoring run, of every player", async () => {
    const played = await playedRun(core, LEVELS);
    const runs = [{ record: played }, { record: played }, { record: played, player: OTHER }];
    expect(await selected(runs)).toEqual([1n, 2n, 3n]);
  });

  it("leaves out a run whose tickets are all 0, which earns the same settled or not", async () => {
    const runs = [{ record: closedRun(core, LEVELS) }, { record: await playedRun(core, LEVELS) }];
    expect(await selected(runs)).toEqual([2n]);
  });

  it("leaves out a run committed after its deadline", async () => {
    const played = await playedRun(core, LEVELS);
    const runs = [{ record: played }, { record: played, committedAt: 2_000n }];
    expect(await selected(runs)).toEqual([1n]);
  });

  it("leaves out settled runs, runs of other seasons and uncommitted runs", async () => {
    const played = await playedRun(core, LEVELS);
    const runs = [{ record: played, status: 1n }, { record: played, season: 2n }, { record: played, committedAt: 0n }];
    expect(await selected(runs)).toEqual([]);
  });

  it("reports a run whose journals the core rejects as one that never settles", async () => {
    const closed = closedRun(core, LEVELS);
    const swapped = { ...closed, journals: [closed.journals[1], closed.journals[0], ...closed.journals.slice(2)] as string[] };
    const { runs, unread, rejected } = await runsToSettle(chainOf([{ record: swapped }]), core, SEASON, readerOf([{ record: swapped }]));
    expect([runs.length, unread.length, rejected.map(({ runId }) => runId)]).toEqual([0, 0, [1n]]);
  });

  it("reports a run whose Outcomes Challenge refuses, and settles the scoring run it accepts", async () => {
    const played = await playedRun(core, LEVELS);
    const runs = [{ record: played }, { record: inTrainingMode(played, 0) }];
    const { runs: settled, rejected } = await runsToSettle(chainOf(runs), core, SEASON, readerOf(runs));
    expect([settled.map(({ runId }) => runId), rejected]).toEqual([[1n], [{ runId: 2n, reason: "Challenge refuses its Outcomes: level 0's journal is of mode 0, not a Challenge's" }]]);
  });

  it("no longer settles a run settled since the selection", async () => {
    const runs: ChainRun[] = [{ record: await playedRun(core, LEVELS) }];
    const [run] = (await runsToSettle(chainOf(runs), core, SEASON, readerOf(runs))).runs;
    expect(await stillToSettle(chainOf([{ ...runs[0], status: 1n } as ChainRun]), run as NonNullable<typeof run>)).toBe(false);
  });

  it("reports a run it cannot read, and still settles the others", async () => {
    const played = await playedRun(core, LEVELS);
    const runs = [{ record: played }, { record: played, player: OTHER }];
    const read: CommittedReader = async (runId) => {
      if (runId === 1n) throw new Error("no RunCommitted log");
      return readerOf(runs)(runId);
    };
    const { runs: settled, unread } = await runsToSettle(chainOf(runs), core, SEASON, read);
    expect([settled.map(({ runId }) => runId), unread.map(({ runId }) => runId)]).toEqual([[2n], [1n]]);
  });
});
