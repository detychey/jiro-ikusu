// A season's leaderboard without an indexer (plan M5.3), from the season's events: Season's
// BestRunRecorded, which it emits each time a player's best settled run changes, so a player's
// last one is their best run (README §8.4), Challenge's RunStarted for the runs each player
// bought, and Season's Claimed. Players rank in D10's order: qualifying runs first, then the
// higher score, then fewer ticks, and on a full tie the run recorded first.

import type { Provider } from "ethers";
import type { Contracts } from "./contracts";
import { eventLogs, firstBlockAt, LOG_CHUNK_BLOCKS } from "./logs";

export interface LeaderboardRow {
  rank: number;
  player: string;
  runId: bigint;
  score: bigint;
  ticks: bigint;
  qualified: boolean;
  /** The runs the player bought in the season. */
  runs: number;
  /** What the player claimed, once they have. */
  claimed?: bigint;
}

/** A qualified player's claim: their best score's pro-rata share of the players' pot, rounded
 *  down (README §8.4); nothing for a player who did not qualify or a pot with no qualified points. */
export function claimOf(row: LeaderboardRow, playersPot: bigint, totalQualifiedPoints: bigint): bigint {
  if (!row.qualified || totalQualifiedPoints === 0n) return 0n;
  return (row.score * playersPot) / totalQualifiedPoints;
}

type Ranked = Pick<LeaderboardRow, "player" | "runId" | "score" | "ticks" | "qualified">;

/** The rows of `best`, each player's BestRunRecorded events oldest first, ranked. */
export function rankRows(best: Ranked[], runsBought: Map<string, number>, claims: Map<string, bigint>): LeaderboardRow[] {
  const latest = new Map<string, { run: Ranked; recorded: number }>();
  best.forEach((run, recorded) => latest.set(run.player.toLowerCase(), { run, recorded }));
  const order = (a: { run: Ranked; recorded: number }, b: { run: Ranked; recorded: number }): number => {
    if (a.run.qualified !== b.run.qualified) return a.run.qualified ? -1 : 1;
    if (a.run.score !== b.run.score) return a.run.score > b.run.score ? -1 : 1;
    if (a.run.ticks !== b.run.ticks) return a.run.ticks < b.run.ticks ? -1 : 1;
    return a.recorded - b.recorded;
  };
  return [...latest.values()].sort(order).map(({ run }, i) => {
    const player = run.player.toLowerCase();
    const claimed = claims.get(player);
    return { rank: i + 1, ...run, runs: runsBought.get(player) ?? 0, ...(claimed === undefined ? {} : { claimed }) };
  });
}

function countBy(players: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const player of players) counts.set(player.toLowerCase(), (counts.get(player.toLowerCase()) ?? 0) + 1);
  return counts;
}

/**
 * Season `number`'s leaderboard, read from the season's first block to block `latest` (by default
 * the newest), with Season's state read at that same block. Its qualified players' scores must sum
 * to that state's totalQualifiedPoints, or a log is missing: it throws then.
 */
export async function seasonLeaderboard(
  { season, challenge }: Pick<Contracts, "season" | "challenge">,
  provider: Provider,
  number: bigint,
  { latest, chunk = LOG_CHUNK_BLOCKS }: { latest?: number; chunk?: number } = {},
): Promise<LeaderboardRow[]> {
  latest ??= await provider.getBlockNumber();
  const state = await season.seasons(number, { blockTag: latest });
  if (state.start === 0n) throw new Error(`season ${number} has not opened`);
  const from = await firstBlockAt(provider, state.start);
  const [best, started, claimed] = await Promise.all([
    eventLogs(provider, season, "BestRunRecorded", [number], from, latest, chunk),
    eventLogs(provider, challenge, "RunStarted", [null, null, number], from, latest, chunk),
    eventLogs(provider, season, "Claimed", [number], from, latest, chunk),
  ]);
  const rows = rankRows(
    best.map(({ event }) => {
      const { player, runId, score, ticks, qualified } = event.args.toObject() as Ranked;
      return { player, runId, score, ticks, qualified };
    }),
    countBy(started.map(({ event }) => String(event.args.player))),
    new Map(claimed.map(({ event }) => [String(event.args.player).toLowerCase(), BigInt(event.args.amount)])),
  );
  const points = rows.filter(({ qualified }) => qualified).reduce((sum, { score }) => sum + score, 0n);
  if (points !== state.totalQualifiedPoints) {
    throw new Error(`the leaderboard's qualified points, ${points}, are not Season's ${state.totalQualifiedPoints}: the RPC left out logs`);
  }
  return rows;
}
