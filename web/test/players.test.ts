// A season's players without an indexer (plan M5.3, M5.15): Challenge's and Season's events, read
// in chunks of blocks from the season's first block, with Season's tallies and prizes, listed by
// prize and checked against Season's games and tickets.

import { getAddress, Interface, type Log } from "ethers";
import { describe, expect, it } from "vitest";
import { CHALLENGE_ABI } from "../src/chain/bindings/Challenge";
import { SEASON_ABI } from "../src/chain/bindings/Season";
import type { Contracts } from "../src/chain/contracts";
import { byPrize, type PlayerRow, runsByPlayer, seasonPlayers } from "../src/chain/players";
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

interface Tally {
  games: bigint;
  tickets: bigint;
  prize: bigint;
}

/** Season and Challenge stand-ins: season 1 started at block 20, with `tallies` by player, and
 *  `games` and `tickets` as Season's sums; `stateReads` records the overrides of each Season.seasons call. */
function fakeContracts(tallies: Record<string, Tally>, games: bigint, tickets: bigint, stateReads: unknown[] = []): Pick<Contracts, "season" | "challenge"> {
  const tallyOf = (player: string) => tallies[player] ?? { games: 0n, tickets: 0n, prize: 0n };
  const season = {
    interface: SEASON,
    getAddress: async () => SEASON_ADDRESS,
    seasons: async (_number: bigint, overrides?: unknown) => {
      stateReads.push(overrides);
      return { start: BigInt(TIMESTAMPS[20] ?? 0), games, tickets };
    },
    tallyOf: async (_number: bigint, player: string) => ({ ...tallyOf(player), claimed: false }),
    prizeOf: async (_number: bigint, player: string) => tallyOf(player).prize,
  };
  const challenge = { interface: CHALLENGE, getAddress: async () => CHALLENGE_ADDRESS };
  return { season, challenge } as unknown as Pick<Contracts, "season" | "challenge">;
}

describe("blocks and logs", () => {
  it("finds the first block at a timestamp", async () => {
    expect(await firstBlockAt(fakeNode().provider as never, 1_205n)).toBe(21);
  });

  it("finds the block of an exact timestamp", async () => {
    expect(await firstBlockAt(fakeNode().provider as never, 1_200n)).toBe(20);
  });

  it("reads logs in chunks of blocks", async () => {
    const { provider, ranges } = fakeNode();
    await eventLogs(provider as never, fakeContracts({}, 0n, 0n).season, "Claimed", [1n], 10, 34, 10);
    expect(ranges).toEqual([
      [10, 19],
      [20, 29],
      [30, 34],
    ]);
  });
});

describe("the players' rows", () => {
  const row = (player: string, prize: bigint): PlayerRow => ({ player, runs: 1, games: 6n, tickets: 0n, prize });

  it("count each player's runs, checksummed", () => {
    expect([...runsByPlayer([ALICE.toLowerCase(), BOB, ALICE])]).toEqual([
      [ALICE, 2],
      [BOB, 1],
    ]);
  });

  it("list the highest prize first", () => {
    expect(byPrize([row(ALICE, 5n), row(BOB, 9n)]).map(({ player }) => player)).toEqual([BOB, ALICE]);
  });

  it("keep the order of the first run on a tied prize", () => {
    expect(byPrize([row(ALICE, 5n), row(BOB, 5n)]).map(({ player }) => player)).toEqual([ALICE, BOB]);
  });
});

describe("a season's players", () => {
  const logs = [
    startedLog(19, 9n, CAROL, 2n),
    startedLog(21, 1n, ALICE, 1n),
    startedLog(22, 2n, BOB, 1n),
    startedLog(23, 3n, ALICE, 1n),
    seasonLog(40, "Claimed", [1n, BOB, 5n]),
  ];
  const tallies = { [ALICE]: { games: 12n, tickets: 50_000n, prize: 30n }, [BOB]: { games: 6n, tickets: 60_000n, prize: 40n } };

  it("lists the season's players from its events, with their runs, tallies, prizes and claims", async () => {
    const rows = await seasonPlayers(fakeContracts(tallies, 18n, 110_000n), fakeNode(logs).provider as never, 1n, { chunk: 7 });
    expect(rows).toEqual([
      { player: BOB, runs: 1, games: 6n, tickets: 60_000n, prize: 40n, claimed: 5n },
      { player: ALICE, runs: 2, games: 12n, tickets: 50_000n, prize: 30n },
    ]);
  });

  it("reads from the season's first block", async () => {
    const { provider, ranges } = fakeNode(logs);
    await seasonPlayers(fakeContracts(tallies, 18n, 110_000n), provider as never, 1n);
    expect(Math.min(...ranges.map(([from]) => from))).toBe(20);
  });

  it("reads Season's state at the block its logs stop at", async () => {
    const stateReads: unknown[] = [];
    const { provider, ranges } = fakeNode(logs);
    await seasonPlayers(fakeContracts(tallies, 18n, 110_000n, stateReads), provider as never, 1n, { latest: 45 });
    expect([stateReads, Math.max(...ranges.map(([, to]) => to))]).toEqual([[{ blockTag: 45 }], 45]);
  });

  it("refuses logs whose runs are not Season's games", async () => {
    await expect(seasonPlayers(fakeContracts(tallies, 24n, 110_000n), fakeNode(logs).provider as never, 1n)).rejects.toThrow(
      "the logs' runs give 18 games and 110000 tickets, and Season holds 24 and 110000: the RPC left out logs",
    );
  });
});
