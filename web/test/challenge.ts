// Plays the levels of a revealed Challenge run without a chain, on a fake clock, with the
// controls of a script fed through the held keys (README §6.2), and the run store on an
// in-memory IndexedDB. A script step may throw `Reload` to drop the page as a reload would.

import { readdirSync, readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import type { Contracts } from "../src/chain/contracts";
import type { Core } from "../src/core";
import { type Control, DEFAULT_BINDINGS, HeldKeys } from "../src/input";
import type { RunEnv } from "../src/run/flow";
import type { PlayEnv, PlayState } from "../src/run/play";
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
    keys,
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
