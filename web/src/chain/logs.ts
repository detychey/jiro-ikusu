// Past events without an indexer (plan M5.3): eth_getLogs over a range of blocks, in chunks, as
// public RPCs cap the blocks one call may span, and the first block at a block.timestamp, by
// binary search, so that a season's or a commit's logs are read from their first block on.

import type { BaseContract, Log, LogDescription, Provider } from "ethers";
import { chainErrorMessage } from "./contracts";

/** The blocks one eth_getLogs call spans at most. */
export const LOG_CHUNK_BLOCKS = 10_000;

/** The first block whose timestamp is at or after `timestamp`; the latest block's number plus one
 *  if there is none yet. Block timestamps never decrease, so a binary search finds it. */
export async function firstBlockAt(provider: Provider, timestamp: bigint): Promise<number> {
  let low = 0;
  let high = (await provider.getBlockNumber()) + 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const block = await provider.getBlock(middle);
    if (block === null) throw new Error(`the node returned no block ${middle}`);
    if (BigInt(block.timestamp) < timestamp) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The `contract`'s `event` logs whose indexed arguments are `args`, from block `from` to `to`
 *  inclusive, oldest first, read in calls of at most `chunk` blocks. */
export async function eventLogs(
  provider: Provider,
  contract: BaseContract,
  event: string,
  args: unknown[],
  from: number,
  to: number,
  chunk = LOG_CHUNK_BLOCKS,
): Promise<{ log: Log; event: LogDescription }[]> {
  const address = await contract.getAddress();
  const topics = contract.interface.encodeFilterTopics(event, args);
  const found: { log: Log; event: LogDescription }[] = [];
  for (let start = from; start <= to; start += chunk) {
    const end = Math.min(start + chunk - 1, to);
    let logs: Log[];
    try {
      logs = await provider.getLogs({ address, topics, fromBlock: start, toBlock: end });
    } catch (error) {
      throw new Error(`eth_getLogs of ${event} in blocks ${start} to ${end}: ${chainErrorMessage(error, [])}`, { cause: error });
    }
    for (const log of logs) {
      const parsed = contract.interface.parseLog(log);
      if (parsed === null) throw new Error(`log ${log.index} of transaction ${log.transactionHash} is not ${event}`);
      found.push({ log, event: parsed });
    }
  }
  return found;
}
