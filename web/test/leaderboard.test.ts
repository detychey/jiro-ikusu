// The leaderboard without an indexer (plan M5.3): Season's and Challenge's events, read in chunks
// of blocks from the season's first block, ranked in D10's order, and checked against Season.

import { getAddress, Interface, type Log } from "ethers";
import { describe, expect, it } from "vitest";
import { CHALLENGE_ABI } from "../src/chain/bindings/Challenge";
import { SEASON_ABI } from "../src/chain/bindings/Season";
import type { Contracts } from "../src/chain/contracts";
import { claimOf, type LeaderboardRow, rankRows, seasonLeaderboard } from "../src/chain/leaderboard";
import { eventLogs, firstBlockAt } from "../src/chain/logs";

const SEASON = new Interface(SEASON_ABI);
const CHALLENGE = new Interface(CHALLENGE_ABI);
const SEASON_ADDRESS = "0x0000000000000000000000000000000000000005";
const CHALLENGE_ADDRESS = "0x0000000000000000000000000000000000000006";
const [ALICE, BOB, CAROL] = ["a1", "b2", "c3"].map((byte) => getAddress(`0x${byte.padStart(40, "0")}`)) as [string, string, string];

/** Block n has timestamp 1,000 + 10 n, up to block 99. */
const TIMESTAMPS = Array.from({ length: 100 }, (_, n) => 1_000 + 10 * n);

interface Logged {
  address: string;
  blockNumber: number;
  topics: string[];
  data: string;
}

/** A node with TIMESTAMPS' blocks and `logs`, which records the block range of each eth_getLogs. */
function fakeNode(logs: Logged[] = []) {
  const ranges: [number, number][] = [];
  const provider = {
    getBlockNumber: async () => TIMESTAMPS.length - 1,
    getBlock: async (n: number) => (TIMESTAMPS[n] === undefined ? null : { timestamp: TIMESTAMPS[n] }),
    getLogs: async ({ address, topics, fromBlock, toBlock }: { address: string; topics: (string | null)[]; fromBlock: number; toBlock: number }) => {
      ranges.push([fromBlock, toBlock]);
      return logs
        .filter((log) => log.address === address && log.blockNumber >= fromBlock && log.blockNumber <= toBlock)
        .filter((log) => topics.every((topic, i) => topic === null || topic === log.topics[i]))
        .map((log, index) => ({ ...log, index, transactionHash: `0x${"00".repeat(32)}` }) as unknown as Log);
    },
  };
  return { provider, ranges };
}

function seasonLog(blockNumber: number, name: string, args: unknown[]): Logged {
  return { address: SEASON_ADDRESS, blockNumber, ...SEASON.encodeEventLog(name, args) };
}

function startedLog(blockNumber: number, runId: bigint, player: string, season: bigint): Logged {
  return { address: CHALLENGE_ADDRESS, blockNumber, ...CHALLENGE.encodeEventLog("RunStarted", [runId, player, season, `0x${"00".repeat(32)}`]) };
}

/** Season and Challenge stand-ins: season 1 started at block 20, with `totalQualifiedPoints`;
 *  `stateReads` records the overrides of each Season.seasons call. */
function fakeContracts(totalQualifiedPoints: bigint, stateReads: unknown[] = []): Pick<Contracts, "season" | "challenge"> {
  const season = {
    interface: SEASON,
    getAddress: async () => SEASON_ADDRESS,
    seasons: async (_number: bigint, overrides?: unknown) => {
      stateReads.push(overrides);
      return { start: BigInt(TIMESTAMPS[20] ?? 0), totalQualifiedPoints };
    },
  };
  const challenge = { interface: CHALLENGE, getAddress: async () => CHALLENGE_ADDRESS };
  return { season, challenge } as unknown as Pick<Contracts, "season" | "challenge">;
}

const run = (player: string, runId: bigint, score: bigint, ticks: bigint, qualified: boolean) => ({ player, runId, score, ticks, qualified });

describe("blocks and logs", () => {
  it("finds the first block at a timestamp", async () => {
    expect(await firstBlockAt(fakeNode().provider as never, 1_205n)).toBe(21);
  });

  it("finds the block of an exact timestamp", async () => {
    expect(await firstBlockAt(fakeNode().provider as never, 1_200n)).toBe(20);
  });

  it("reads logs in chunks of blocks", async () => {
    const { provider, ranges } = fakeNode();
    await eventLogs(provider as never, fakeContracts(0n).season, "Claimed", [1n], 10, 34, 10);
    expect(ranges).toEqual([
      [10, 19],
      [20, 29],
      [30, 34],
    ]);
  });
});

describe("the ranking", () => {
  it("puts a qualifying run above a higher score that does not qualify", () => {
    const rows = rankRows([run(ALICE, 1n, 900n, 10n, false), run(BOB, 2n, 100n, 10n, true)], new Map(), new Map());
    expect(rows.map(({ player }) => player)).toEqual([BOB, ALICE]);
  });

  it("puts the higher score first", () => {
    const rows = rankRows([run(ALICE, 1n, 100n, 10n, true), run(BOB, 2n, 200n, 10n, true)], new Map(), new Map());
    expect(rows.map(({ player }) => player)).toEqual([BOB, ALICE]);
  });

  it("breaks a tie on score with fewer ticks", () => {
    const rows = rankRows([run(ALICE, 1n, 100n, 20n, true), run(BOB, 2n, 100n, 10n, true)], new Map(), new Map());
    expect(rows.map(({ player }) => player)).toEqual([BOB, ALICE]);
  });

  it("breaks a full tie with the run recorded first", () => {
    const rows = rankRows([run(ALICE, 1n, 100n, 10n, true), run(BOB, 2n, 100n, 10n, true)], new Map(), new Map());
    expect(rows.map(({ player }) => player)).toEqual([ALICE, BOB]);
  });

  it("keeps a player's last recorded best run", () => {
    const rows = rankRows([run(ALICE, 1n, 100n, 10n, true), run(ALICE, 3n, 300n, 10n, true)], new Map(), new Map());
    expect(rows).toEqual([{ rank: 1, ...run(ALICE, 3n, 300n, 10n, true), runs: 0 }]);
  });
});

describe("claims", () => {
  const row = (score: bigint, qualified: boolean): LeaderboardRow => ({ rank: 1, ...run(ALICE, 1n, score, 10n, qualified), runs: 1 });

  it("share the players' pot pro rata, rounded down", () => {
    expect(claimOf(row(1n, true), 100n, 3n)).toBe(33n);
  });

  it("give nothing to a player who did not qualify", () => {
    expect(claimOf(row(1n, false), 100n, 3n)).toBe(0n);
  });
});

describe("a season's leaderboard", () => {
  const logs = [
    startedLog(19, 9n, CAROL, 1n),
    startedLog(21, 1n, ALICE, 1n),
    startedLog(22, 2n, BOB, 1n),
    startedLog(23, 3n, ALICE, 1n),
    seasonLog(30, "BestRunRecorded", [1n, ALICE, 1n, 100n, 50n, true]),
    seasonLog(31, "BestRunRecorded", [1n, BOB, 2n, 200n, 60n, true]),
    seasonLog(32, "BestRunRecorded", [2n, CAROL, 9n, 900n, 60n, true]),
    seasonLog(40, "Claimed", [1n, BOB, 5n]),
  ];

  it("ranks the season's players from its events, with their runs and claims", async () => {
    const rows = await seasonLeaderboard(fakeContracts(300n), fakeNode(logs).provider as never, 1n, { chunk: 7 });
    expect(rows).toEqual([
      { rank: 1, ...run(BOB, 2n, 200n, 60n, true), runs: 1, claimed: 5n },
      { rank: 2, ...run(ALICE, 1n, 100n, 50n, true), runs: 2 },
    ]);
  });

  it("reads from the season's first block", async () => {
    const { provider, ranges } = fakeNode(logs);
    await seasonLeaderboard(fakeContracts(300n), provider as never, 1n);
    expect(Math.min(...ranges.map(([from]) => from))).toBe(20);
  });

  it("reads Season's state at the block its logs stop at", async () => {
    const stateReads: unknown[] = [];
    const { provider, ranges } = fakeNode(logs);
    await seasonLeaderboard(fakeContracts(300n, stateReads), provider as never, 1n, { latest: 45 });
    expect([stateReads, Math.max(...ranges.map(([, to]) => to))]).toEqual([[{ blockTag: 45 }], 45]);
  });

  it("refuses logs whose qualified points are not Season's", async () => {
    await expect(seasonLeaderboard(fakeContracts(301n), fakeNode(logs).provider as never, 1n)).rejects.toThrow(
      "the leaderboard's qualified points, 300, are not Season's 301: the RPC left out logs",
    );
  });
});
