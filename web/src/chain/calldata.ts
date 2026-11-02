// A committed run's journals, read from its commit transaction (README §7.2, P5), and the run
// file they make, which the replay viewer replays. The transaction is the one whose RunCommitted
// log names the run, among the blocks of its committedAt. A direct call's input is the commitRun
// call; a smart-account wallet embeds it in its own call, where it is found by its selector and
// run id; otherwise the call is looked for in the transaction's trace, on an RPC that serves
// debug_traceTransaction. Journals are kept only if they match the commitment Challenge stored.

import { getAddress, type JsonRpcApiProvider, toBeHex, zeroPadValue } from "ethers";
import { type Core, fromHex, hex, RUN_LEVELS } from "../core";
import { RUN_FILE_VERSION, type RunFile } from "../run/runfile";
import { checkSeason } from "../run/season";
import type { Contracts } from "./contracts";
import { eventLogs, firstBlockAt } from "./logs";

export type JournalSource = "its commitRun call" | "a commitRun call embedded in it" | "its trace";

export interface CommittedJournals {
  transaction: string;
  source: JournalSource;
  journals: string[];
}

/** A call frame of debug_traceTransaction's callTracer. */
export interface CallFrame {
  to?: string;
  input?: string;
  calls?: CallFrame[];
}

type ChallengeOf = Pick<Contracts, "challenge">;

/** The journals of each commitRun(runId, …) call that starts in `data` at a byte boundary: the
 *  call's selector, then the run id as its first argument. */
export function commitRunCalls({ challenge }: ChallengeOf, data: string, runId: bigint): string[][] {
  const commitRun = challenge.interface.getFunction("commitRun");
  if (commitRun === null) throw new Error("the Challenge ABI has no commitRun");
  const callStart = `${commitRun.selector.slice(2)}${zeroPadValue(toBeHex(runId), 32).slice(2)}`;
  const input = data.toLowerCase().slice(2);
  const calls: string[][] = [];
  for (let at = input.indexOf(callStart); at >= 0; at = input.indexOf(callStart, at + 1)) {
    if (at % 2 !== 0) continue;
    try {
      const [, journals] = challenge.interface.decodeFunctionData(commitRun, `0x${input.slice(at)}`);
      calls.push([...(journals as string[])]);
    } catch {
      // Bytes that only start like the call, and do not decode as one, are no call.
      continue;
    }
  }
  return calls;
}

/** The journals of each commitRun(runId, …) call to the address `challenge` in a callTracer trace. */
export function tracedCommitRunCalls(contracts: ChallengeOf, challenge: string, trace: CallFrame, runId: bigint): string[][] {
  const calls: string[][] = [];
  const visit = (frame: CallFrame): void => {
    if (frame.to !== undefined && frame.input !== undefined && getAddress(frame.to) === getAddress(challenge)) {
      calls.push(...commitRunCalls(contracts, frame.input, runId));
    }
    for (const inner of frame.calls ?? []) visit(inner);
  };
  visit(trace);
  return calls;
}

/** Run `runId`'s journals, read from its commit transaction. */
export async function committedJournals(contracts: ChallengeOf, provider: JsonRpcApiProvider, core: Core, runId: bigint): Promise<CommittedJournals> {
  const { challenge } = contracts;
  const run = await challenge.runs(runId);
  if (run.committedAt === 0n) throw new Error(`run ${runId} is not committed`);
  const from = await firstBlockAt(provider, run.committedAt);
  const to = (await firstBlockAt(provider, run.committedAt + 1n)) - 1;
  const [committed] = await eventLogs(provider, challenge, "RunCommitted", [runId], from, to);
  if (committed === undefined) throw new Error(`no RunCommitted log of run ${runId} in blocks ${from} to ${to}, those of its committedAt`);
  const transaction = committed.log.transactionHash;
  const matches = (journals: string[]): boolean =>
    journals.length === RUN_LEVELS && hex(core.runCommitment(journals.map(fromHex))) === run.commitment.toLowerCase();

  const sent = await provider.getTransaction(transaction);
  if (sent === null) throw new Error(`the node returned no transaction ${transaction}`);
  const address = await challenge.getAddress();
  const fromInput = commitRunCalls(contracts, sent.data, runId).find(matches);
  if (fromInput !== undefined) {
    const direct = sent.to !== null && getAddress(sent.to) === getAddress(address);
    return { transaction, source: direct ? "its commitRun call" : "a commitRun call embedded in it", journals: fromInput };
  }
  let trace: CallFrame;
  try {
    trace = await provider.send("debug_traceTransaction", [transaction, { tracer: "callTracer" }]);
  } catch (error) {
    throw new Error(
      `run ${runId} was committed by a contract, in transaction ${transaction}, whose input does not carry the commitRun call, and this RPC serves no debug_traceTransaction: load the run through an RPC that serves traces`,
      { cause: error },
    );
  }
  const fromTrace = tracedCommitRunCalls(contracts, address, trace, runId).find(matches);
  if (fromTrace === undefined) throw new Error(`the trace of transaction ${transaction} has no commitRun call of run ${runId} that matches its commitment`);
  return { transaction, source: "its trace", journals: fromTrace };
}

export interface CommittedRun extends CommittedJournals {
  file: RunFile;
  /** The weights of the run's season, in draw-slot order. */
  weightsBp: number[];
}

/**
 * Run `runId` as a run file, with its season's weights: its journals from its commit transaction,
 * and its levels from its draw, which must be among `levels`, the 16 shipped levels, as the
 * season's levels.
 */
export async function committedRun(
  contracts: Pick<Contracts, "challenge" | "season">,
  provider: JsonRpcApiProvider,
  core: Core,
  levels: readonly Uint8Array[],
  runId: bigint,
): Promise<CommittedRun> {
  const committed = await committedJournals(contracts, provider, core, runId);
  const run = await contracts.challenge.runs(runId);
  const params = await contracts.season.paramsOf(run.season);
  checkSeason(core.rulesVersion, levels.map((level) => hex(core.levelId(level))), params);
  const drawSlots = core.draw(fromHex(run.runNonce));
  const file: RunFile = {
    version: RUN_FILE_VERSION,
    chainId: Number((await provider.getNetwork()).chainId),
    challenge: await contracts.challenge.getAddress(),
    runId: String(runId),
    runNonce: run.runNonce,
    levels: drawSlots.map((slot) => hex(levels[slot] as Uint8Array)),
    drawSlots,
    journals: committed.journals,
  };
  return { ...committed, file, weightsBp: params.weightsBp.map(Number) };
}
