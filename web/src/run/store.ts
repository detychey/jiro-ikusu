// The Challenge runs this browser holds, in IndexedDB (plan M5.2): one record per run, keyed by
// chain, Challenge address and run id. While a level is in play, the page writes its live events
// and tick count every second, so a reload can close the level as README §7.2 specifies; the
// closed journals stay after the commit, for the run file.

import type { JournalEvent } from "../journal";

export const DATABASE = "jiro-ikusu";
const RUNS = "runs";

/** What the reveal gave the run (README §6.4, §8.2), and the chain's clock as the page saw it. */
export interface Reveal {
  runNonce: string;
  /** block.timestamp of the reveal, in seconds. */
  revealedAt: number;
  /** The chain's clock minus the page's, in milliseconds, measured when the reveal's receipt
   *  arrived: the countdown reads the chain's time as the page's time plus this. */
  chainOffsetMs: number;
  drawSlots: number[];
}

/** The level in play at the last write: the events and the number of ticks processed. */
export interface LiveLevel {
  levelIndex: number;
  events: JournalEvent[];
  ticks: number;
}

export interface Commit {
  /** The commitRun transaction, unless a reload lost its receipt: the chain then had the commit. */
  transaction?: string;
  /** block.timestamp of the commit, in seconds. */
  committedAt: number;
}

export interface RunRecord {
  key: string;
  chainId: number;
  challenge: string;
  player: string;
  runId: string;
  season: string;
  /** The season's commitSlack, in seconds. */
  commitSlack: number;
  /** The season's 16 weights, in draw-slot order, which score the run (README §8.4). */
  weightsBp: number[];
  reveal?: Reveal;
  /** The closed journals, in levelIndex order, in hex. */
  journals: string[];
  live?: LiveLevel;
  commit?: Commit;
  /** Why the run can never be committed, such as a lapsed reveal. */
  forfeited?: string;
}

export interface RunStore {
  get(key: string): Promise<RunRecord | undefined>;
  put(record: RunRecord): Promise<void>;
  /** The player's runs on this Challenge contract, oldest first. */
  runsOf(chainId: number, challenge: string, player: string): Promise<RunRecord[]>;
}

export function runKey(chainId: number, challenge: string, runId: bigint | string): string {
  return `${chainId}/${challenge.toLowerCase()}/${runId}`;
}

function done<T>(request: IDBRequest<T>, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`IndexedDB: ${what} failed`, { cause: request.error }));
  });
}

export async function openRunStore(factory: IDBFactory): Promise<RunStore> {
  const opening = factory.open(DATABASE, 1);
  opening.onupgradeneeded = () => opening.result.createObjectStore(RUNS, { keyPath: "key" });
  const database = await done(opening, "opening the run store");
  const runs = (mode: IDBTransactionMode) => database.transaction(RUNS, mode).objectStore(RUNS);
  return {
    get: async (key) => (await done(runs("readonly").get(key), `reading run ${key}`)) as RunRecord | undefined,
    put: async (record) => {
      const transaction = database.transaction(RUNS, "readwrite");
      transaction.objectStore(RUNS).put(record);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = transaction.onabort = () =>
          reject(new Error(`IndexedDB: writing run ${record.key} failed`, { cause: transaction.error }));
      });
    },
    runsOf: async (chainId, challenge, player) => {
      const all = (await done(runs("readonly").getAll(), "listing the runs")) as RunRecord[];
      return all
        .filter((record) => record.chainId === chainId && record.challenge.toLowerCase() === challenge.toLowerCase())
        .filter((record) => record.player.toLowerCase() === player.toLowerCase())
        .sort((a, b) => (BigInt(a.runId) < BigInt(b.runId) ? -1 : 1));
    },
  };
}
