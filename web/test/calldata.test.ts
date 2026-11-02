// A committed run's journals from its commit transaction (plan M5.3, P5): a direct commitRun
// call, a call a smart-account wallet embeds in its own, or the transaction's trace, kept only
// when they match the commitment Challenge stored.

import { Interface, type Log } from "ethers";
import { describe, expect, it } from "vitest";
import { CHALLENGE_ABI } from "../src/chain/bindings/Challenge";
import { MOCKFORWARDER_ABI } from "../src/chain/bindings/MockForwarder";
import { type CallFrame, commitRunCalls, committedJournals, tracedCommitRunCalls } from "../src/chain/calldata";
import type { Contracts } from "../src/chain/contracts";
import { fromHex, hex } from "../src/core";
import { closedRun, shippedLevels } from "./challenge";
import { loadEngine } from "./drive";

const CHALLENGE = new Interface(CHALLENGE_ABI);
const FORWARDER = new Interface(MOCKFORWARDER_ABI);
const CHALLENGE_ADDRESS = "0x0000000000000000000000000000000000000006";
const FORWARDER_ADDRESS = "0x0000000000000000000000000000000000000007";
const COMMIT_HASH = `0x${"c0".repeat(32)}`;
const COMMITTED_AT = 1_050n;
const core = await loadEngine();
const JOURNALS = closedRun(core, shippedLevels()).journals;
const COMMITMENT = hex(core.runCommitment(JOURNALS.map(fromHex)));
const commitRun = (runId: bigint, journals = JOURNALS) => CHALLENGE.encodeFunctionData("commitRun", [runId, journals]);
const execute = (data: string) => FORWARDER.encodeFunctionData("execute", [CHALLENGE_ADDRESS, 0n, data]);
const contracts = { challenge: { interface: CHALLENGE } } as unknown as Pick<Contracts, "challenge">;

/** Run 7, committed at block 5 by a transaction to `to` with input `data`, on a node that serves
 *  `trace`, or no trace at all. */
function chain(to: string, data: string, trace?: CallFrame) {
  const challenge = {
    interface: CHALLENGE,
    getAddress: async () => CHALLENGE_ADDRESS,
    runs: async () => ({ committedAt: COMMITTED_AT, commitment: COMMITMENT }),
  };
  const committed = { address: CHALLENGE_ADDRESS, blockNumber: 5, index: 0, transactionHash: COMMIT_HASH, ...CHALLENGE.encodeEventLog("RunCommitted", [7n, COMMITMENT, COMMITTED_AT]) };
  const provider = {
    getBlockNumber: async () => 9,
    getBlock: async (n: number) => ({ timestamp: 1_000 + 10 * n }),
    getLogs: async ({ fromBlock, toBlock }: { fromBlock: number; toBlock: number }) => (fromBlock <= 5 && toBlock >= 5 ? [committed as unknown as Log] : []),
    getTransaction: async () => ({ to, data }),
    send: async () => {
      if (trace === undefined) throw new Error("the method debug_traceTransaction does not exist");
      return trace;
    },
  };
  return { contracts: { challenge } as unknown as Pick<Contracts, "challenge">, provider: provider as never };
}

describe("commitRun calls in calldata", () => {
  it("decode a direct call", () => {
    expect(commitRunCalls(contracts, commitRun(7n), 7n)).toEqual([JOURNALS]);
  });

  it("are found embedded in a smart account's call", () => {
    expect(commitRunCalls(contracts, execute(commitRun(7n)), 7n)).toEqual([JOURNALS]);
  });

  it("leave out another run's call", () => {
    expect(commitRunCalls(contracts, execute(commitRun(8n)), 7n)).toEqual([]);
  });

  it("are found in a nested trace frame", () => {
    const trace = { to: FORWARDER_ADDRESS, input: "0x", calls: [{ to: CHALLENGE_ADDRESS, input: commitRun(7n) }] };
    expect(tracedCommitRunCalls(contracts, CHALLENGE_ADDRESS, trace, 7n)).toEqual([JOURNALS]);
  });

  it("are not taken from a trace frame to another contract", () => {
    const trace = { to: FORWARDER_ADDRESS, input: commitRun(7n) };
    expect(tracedCommitRunCalls(contracts, CHALLENGE_ADDRESS, trace, 7n)).toEqual([]);
  });
});

describe("a committed run's journals", () => {
  it("come from a direct commit's input", async () => {
    const { contracts, provider } = chain(CHALLENGE_ADDRESS, commitRun(7n));
    expect(await committedJournals(contracts, provider, core, 7n)).toEqual({ transaction: COMMIT_HASH, source: "its commitRun call", journals: JOURNALS });
  });

  it("come from the call a smart account embeds", async () => {
    const { contracts, provider } = chain(FORWARDER_ADDRESS, execute(commitRun(7n)));
    expect((await committedJournals(contracts, provider, core, 7n)).source).toBe("a commitRun call embedded in it");
  });

  it("come from the trace when the input does not carry the call", async () => {
    const trace = { to: FORWARDER_ADDRESS, input: "0x12345678", calls: [{ to: CHALLENGE_ADDRESS, input: commitRun(7n) }] };
    const { contracts, provider } = chain(FORWARDER_ADDRESS, "0x12345678", trace);
    expect((await committedJournals(contracts, provider, core, 7n)).source).toBe("its trace");
  });

  it("need a trace RPC when the input does not carry the call", async () => {
    const { contracts, provider } = chain(FORWARDER_ADDRESS, "0x12345678");
    await expect(committedJournals(contracts, provider, core, 7n)).rejects.toThrow("load the run through an RPC that serves traces");
  });

  it("are refused when they do not match the stored commitment", async () => {
    const other = [...JOURNALS.slice(1), JOURNALS[0] as string];
    const trace = { to: CHALLENGE_ADDRESS, input: commitRun(7n, other) };
    const { contracts, provider } = chain(CHALLENGE_ADDRESS, commitRun(7n, other), trace);
    await expect(committedJournals(contracts, provider, core, 7n)).rejects.toThrow("has no commitRun call of run 7 that matches its commitment");
  });
});
