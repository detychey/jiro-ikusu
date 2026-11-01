// The run file v1 of docs/VERIFICATION.md: everything needed to replay, prove and settle one
// committed Challenge run. The page writes it from the stored run, and reading one back replays
// its six journals with the core.

import { type Core, CoreError, fromHex, hex, type Outcome, RUN_LEVELS } from "../core";
import { runLevels } from "./play";
import type { RunRecord } from "./store";

export const RUN_FILE_VERSION = 1;

export interface RunFile {
  version: number;
  chainId: number;
  challenge: string;
  runId: string;
  runNonce: string;
  levels: string[];
  drawSlots: number[];
  journals: string[];
}

export function runFileOf(record: RunRecord, levels: readonly Uint8Array[]): RunFile {
  if (record.reveal === undefined || record.journals.length !== RUN_LEVELS) {
    throw new Error(`run ${record.runId} has no six journals yet`);
  }
  return {
    version: RUN_FILE_VERSION,
    chainId: record.chainId,
    challenge: record.challenge,
    runId: record.runId,
    runNonce: record.reveal.runNonce,
    levels: runLevels(record, levels).map((level) => hex(level)),
    drawSlots: [...record.reveal.drawSlots],
    journals: [...record.journals],
  };
}

const HEX = /^0x([0-9a-f]{2})*$/;

function isHexList(value: unknown, byteLength?: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === RUN_LEVELS &&
    value.every((item) => typeof item === "string" && HEX.test(item) && (byteLength === undefined || item.length === 2 + 2 * byteLength))
  );
}

/** Parses the text of a run file, refusing anything that is not a run file v1. */
export function parseRunFile(text: string): RunFile {
  const file: unknown = JSON.parse(text);
  const refuse = (what: string): never => {
    throw new Error(`not a run file v${RUN_FILE_VERSION}: ${what}`);
  };
  if (file === null || typeof file !== "object" || Array.isArray(file)) return refuse("not a JSON object");
  const { version, chainId, challenge, runId, runNonce, levels, drawSlots, journals } = file as Record<string, unknown>;
  if (version !== RUN_FILE_VERSION) refuse(`version ${JSON.stringify(version)}`);
  if (!Number.isSafeInteger(chainId) || (chainId as number) <= 0) refuse("chainId is not a chain id");
  if (typeof challenge !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(challenge)) refuse("challenge is not an address");
  if (typeof runId !== "string" || !/^[1-9][0-9]*$/.test(runId)) refuse("runId is not a decimal run id");
  if (typeof runNonce !== "string" || !HEX.test(runNonce) || runNonce.length !== 66) refuse("runNonce is not 32 bytes of hex");
  if (!isHexList(levels)) refuse("levels are not six byte strings");
  if (!isHexList(journals)) refuse("journals are not six byte strings");
  const slots = drawSlots as unknown[];
  if (!Array.isArray(drawSlots) || slots.length !== RUN_LEVELS || !slots.every((slot) => Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < 16)) {
    refuse("drawSlots are not six slots");
  }
  return file as RunFile;
}

/**
 * The six Outcomes of a run file's journals, replayed on its levels with the season's weights
 * (`weightsBp`, in draw-slot order), as settlement replays them. A journal the core rejects
 * throws with its code.
 */
export function replayRunFile(core: Core, file: RunFile, weightsBp: readonly number[]): Outcome[] {
  return file.journals.map((journal, i) => {
    const slot = file.drawSlots[i] as number;
    const weightBp = weightsBp[slot];
    if (weightBp === undefined) throw new Error(`the season has no weight for slot ${slot}`);
    const replayed = core.replay(fromHex(file.levels[i] as string), fromHex(journal), weightBp);
    if ("code" in replayed) throw new CoreError(`replay of level ${i}`, replayed.code);
    return replayed.outcome;
  });
}
