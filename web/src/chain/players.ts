// A season's players without an indexer (plan M5.3, M5.15): Challenge's RunStarted events for the
// players and the runs each bought, Season's tally of each player's games and tickets and the
// prize of their games under the v1 payout (README §8.4), and Season's Claimed events for what
// each claimed. There is no ranking: players are listed by prize, the highest first.

import { getAddress, type Provider } from "ethers";
import type { Contracts } from "./contracts";
import { eventLogs, firstBlockAt, LOG_CHUNK_BLOCKS } from "./logs";

/** The games of a run (README §8.2). */
const GAMES_PER_RUN = 6n;

export interface PlayerRow {
  player: string;
  /** The runs the player bought in the season. */
  runs: number;
  games: bigint;
  /** The sum of the tickets of their on-time settled runs, in basis points. */
  tickets: bigint;
  /** Season.prizeOf: what their claim pays, or would pay if the season closed now. */
  prize: bigint;
  /** What the player claimed, once they have. */
  claimed?: bigint;
}

/** The players of `started`, each RunStarted's player in log order, checksummed, with the runs each bought. */
export function runsByPlayer(started: readonly string[]): Map<string, number> {
  const runs = new Map<string, number>();
  for (const player of started.map((address) => getAddress(address))) runs.set(player, (runs.get(player) ?? 0) + 1);
  return runs;
}

/** `rows` by prize, the highest first; on a tie, in the order of their first run. */
export function byPrize(rows: readonly PlayerRow[]): PlayerRow[] {
  return [...rows].sort((a, b) => (a.prize === b.prize ? 0 : a.prize > b.prize ? -1 : 1));
}

/**
 * Season `number`'s players, read from the season's first block to block `latest` (by default the
 * newest), with Season's state read at that same block. Their runs must account for the season's
 * games, and their tickets for its tickets, or a log is missing: it throws then.
 */
export async function seasonPlayers(
  { season, challenge }: Pick<Contracts, "season" | "challenge">,
  provider: Provider,
  number: bigint,
  { latest, chunk = LOG_CHUNK_BLOCKS }: { latest?: number; chunk?: number } = {},
): Promise<PlayerRow[]> {
  latest ??= await provider.getBlockNumber();
  const at = { blockTag: latest };
  const state = await season.seasons(number, at);
  if (state.start === 0n) throw new Error(`season ${number} has not opened`);
  const from = await firstBlockAt(provider, state.start);
  const [started, claimedLogs] = await Promise.all([
    eventLogs(provider, challenge, "RunStarted", [null, null, number], from, latest, chunk),
    eventLogs(provider, season, "Claimed", [number], from, latest, chunk),
  ]);
  const runs = runsByPlayer(started.map(({ event }) => String(event.args.player)));
  const claims = new Map(claimedLogs.map(({ event }) => [getAddress(String(event.args.player)), BigInt(event.args.amount)]));
  const rows = await Promise.all(
    [...runs].map(async ([player, count]): Promise<PlayerRow> => {
      const [tally, prize] = await Promise.all([season.tallyOf(number, player, at), season.prizeOf(number, player, at)]);
      const claimed = claims.get(player);
      return { player, runs: count, games: tally.games, tickets: tally.tickets, prize, ...(claimed === undefined ? {} : { claimed }) };
    }),
  );
  const games = BigInt(started.length) * GAMES_PER_RUN;
  const tickets = rows.reduce((sum, row) => sum + row.tickets, 0n);
  if (games !== state.games || tickets !== state.tickets) {
    throw new Error(`the logs' runs give ${games} games and ${tickets} tickets, and Season holds ${state.games} and ${state.tickets}: the RPC left out logs`);
  }
  return byPrize(rows);
}
