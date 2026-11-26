// Plays the levels of a revealed Challenge run without a chain, on a fake clock, with the
// controls of a script fed through the held keys (README §6.2), and the run store on an
// in-memory IndexedDB. A script step may throw `Reload` to drop the page as a reload would.

import { readdirSync, readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import type { Contracts } from "../src/chain/contracts";
import { type Core, fromHex, hex } from "../src/core";
import { type Control, DEFAULT_BINDINGS, HeldKeys } from "../src/input";
import type { RunEnv } from "../src/run/flow";
import { closeLevel, type PlayEnv, type PlayState, playLevels, runLevels } from "../src/run/play";
import { openRunStore, type RunRecord, type RunStore } from "../src/run/store";
import { repo } from "./drive";

export const RUN_NONCE = "0x277b9e3cebd776c6d46a8b4eb9b83ac165961f4b46a79baef5df1514bb5219cd";
/** The page's frames, shorter than a tick, so that no tick runs before its keys are down. */
const FRAME_MS = 10;

export class Reload extends Error {}

export function shippedLevels(): Uint8Array[] {
  const directory = new URL("levels/", repo);
  return readdirSync(directory)
    .filter((name) => name.endsWith(".bin"))
    .sort()
    .map((name) => new Uint8Array(readFileSync(new URL(name, directory))));
}

export function revealedRun(core: Core): RunRecord {
  return {
    key: "31337/0x0000000000000000000000000000000000000001/1",
    chainId: 31337,
    challenge: "0x0000000000000000000000000000000000000001",
    player: "0x0000000000000000000000000000000000000002",
    runId: "1",
    season: "1",
    commitSlack: 120,
    weightsBp: Array(16).fill(10_000),
    reveal: { runNonce: RUN_NONCE, revealedAt: 1_000, chainOffsetMs: 0, drawSlots: core.draw(Buffer.from(RUN_NONCE.slice(2), "hex")) },
    journals: [],
  };
}

/** `revealedRun` with six journals of an X alone at tick 0, ready for its commit. */
export function closedRun(core: Core, levels: Uint8Array[]): RunRecord {
  const record = revealedRun(core);
  const closed = (level: Uint8Array, levelIndex: number) => closeLevel(core, level, fromHex(RUN_NONCE), { levelIndex, events: [], ticks: 0 });
  return { ...record, journals: runLevels(record, levels).map((level, levelIndex) => hex(closed(level, levelIndex))) };
}

/** Controls that claim a little of each level, then commit it at tick 60. */
const CLAIM_STEPS: [number, Control[]][] = [
  [0, ["up"]],
  [40, ["right"]],
  [60, ["x"]],
];

/** `revealedRun` with its six levels played by CLAIM_STEPS. */
export async function playedRun(core: Core, levels: Uint8Array[]): Promise<RunRecord> {
  const env = playEnv(core, (await freshStore()).store, levels, { controls: (_, tick) => CLAIM_STEPS.find(([at]) => at === tick)?.[1] });
  return playLevels(env, revealedRun(core));
}

export async function freshStore(): Promise<{ factory: IDBFactory; store: RunStore }> {
  const factory = new IDBFactory();
  return { factory, store: await openRunStore(factory) };
}

export interface Script {
  /** The controls held from `tick` of level `levelIndex` on, if they change there. */
  controls(levelIndex: number, tick: number): Control[] | undefined;
  /** Called before each frame; may throw Reload. */
  beforeFrame?(state: PlayState): void;
  /** Called on each wait between levels; may throw Reload. */
  onSleep?(): void;
  stop?(state: PlayState): boolean;
}

export function playEnv(core: Core, store: RunStore, levels: Uint8Array[], script: Script): PlayEnv {
  const keys = new HeldKeys(DEFAULT_BINDINGS);
  let time = 1_000_000;
  let state: PlayState = { levelIndex: 0, ticksRun: 0 };
  return {
    core,
    store,
    input: keys,
    levels,
    now: () => time,
    sleep: async (ms) => {
      script.onSleep?.();
      time += ms;
    },
    frame: async (next) => {
      state = next;
      script.beforeFrame?.(state);
      const controls = script.controls(state.levelIndex, state.ticksRun);
      if (controls !== undefined) {
        keys.clear();
        for (const control of controls) keys.down(DEFAULT_BINDINGS[control]);
      }
      time += FRAME_MS;
    },
    stopRequested: () => script.stop?.(state) ?? false,
    view: { levelStarted: () => {}, ticked: () => {}, levelEnded: () => {}, margin: () => {} },
  };
}

/** A run env on `contracts`, a stand-in that each test fills with the calls it allows. */
export function runEnv(core: Core, store: RunStore, levels: Uint8Array[], contracts: object): RunEnv {
  return {
    ...playEnv(core, store, levels, { controls: () => undefined }),
    contracts: contracts as Contracts,
    provider: {} as RunEnv["provider"],
    chainId: 31337,
    levelIds: [],
    view: { status: () => {}, levelStarted: () => {}, ticked: () => {}, levelEnded: () => {}, margin: () => {} },
  };
}

/** A run onchain, for `chainEnv`: its player, its entropy block, and its reveal and commit. */
export interface OnchainRun {
  player: string;
  target: bigint;
  revealedAt?: bigint;
  committedAt?: bigint;
  commitment?: string;
}

/** What `chainEnv`'s node reads: MockArbSys's block, and the latest block's timestamp in seconds. */
export interface ChainState {
  block: bigint;
  timestamp: number;
}

/** A run env on a stand-in chain of season 1, whose levels are the shipped ones: `runs` are runs
 *  1, 2 and on, the latest block is `state`'s, and every other call is refused. */
export function chainEnv(core: Core, store: RunStore, levels: Uint8Array[], runs: OnchainRun[], state: ChainState): RunEnv {
  const runAt = (runId: bigint): OnchainRun => {
    const run = runs[Number(runId) - 1];
    if (run === undefined) throw new Error(`no run ${runId} onchain`);
    return run;
  };
  const levelIds = levels.map((level) => hex(core.levelId(level)));
  const params = { rulesVersion: BigInt(core.rulesVersion), levelIds, weightsBp: Array(16).fill(10_000n), commitSlack: 120n };
  const contracts = {
    challenge: {
      getAddress: async () => "0x0000000000000000000000000000000000000001",
      runCount: async () => BigInt(runs.length),
      entropyIdOf: async (runId: bigint) => runId,
      runs: async (runId: bigint) => {
        const { player, revealedAt = 0n, committedAt = 0n, commitment = `0x${"00".repeat(32)}` } = runAt(runId);
        return { player, revealedAt, committedAt, commitment, season: 1n, runNonce: RUN_NONCE };
      },
    },
    entropy: {
      READ_WINDOW: async () => 256n,
      targetBlock: async (_owner: string, runId: bigint) => runAt(runId).target,
      isRevealable: async (_owner: string, runId: bigint) => state.block > runAt(runId).target && state.block <= runAt(runId).target + 256n,
    },
    arbSys: { arbBlockNumber: async () => state.block },
    season: { paramsOf: async () => params },
  };
  const provider = { getBlock: async () => ({ timestamp: state.timestamp }) };
  return { ...runEnv(core, store, levels, contracts), provider: provider as unknown as RunEnv["provider"], levelIds };
}
