// The deployed contracts, through the generated bindings: the season accepting runs, and
// `startRun` (README §7.2, §8.4). Errors are decoded with the contracts' custom errors.

import {
  type BaseContract,
  type ContractRunner,
  type ContractTransactionReceipt,
  type ContractTransactionResponse,
  isError,
  type Provider,
} from "ethers";
import { type Challenge, type ChallengeEvents, connectChallenge } from "./bindings/Challenge";
import { connectSeason, type Season } from "./bindings/Season";
import type { Deployment } from "./deployments";

export interface Contracts {
  season: Season;
  challenge: Challenge;
}

export interface AcceptingSeason {
  number: bigint;
  runFee: bigint;
  /** The season stops accepting runs at this block timestamp. */
  end: bigint;
}

export interface StartedRun {
  runId: bigint;
  entropyId: string;
  transaction: string;
}

export function connectContracts(deployment: Deployment, runner: ContractRunner): Contracts {
  return {
    season: connectSeason(deployment.addresses.Season, runner),
    challenge: connectChallenge(deployment.addresses.Challenge, runner),
  };
}

/**
 * The season accepting runs: the newest, until its end (README §8.4). The check uses the latest
 * block's timestamp; `startRun` still reverts if the season ends before its own block.
 */
export async function acceptingSeason(season: Season, provider: Provider): Promise<AcceptingSeason> {
  const number = await season.currentSeason();
  if (number === 0n) throw new Error("no season has opened yet");
  const [params, end, latest] = await Promise.all([season.paramsOf(number), season.endOf(number), provider.getBlock("latest")]);
  if (latest === null) throw new Error("the node returned no latest block");
  if (BigInt(latest.timestamp) >= end) {
    throw new Error(`season ${number} ended at ${end}, and no later season has opened: no season accepts runs`);
  }
  return { number, runFee: params.runFee, end };
}

/** A human-readable reason for a failed call or transaction, decoded with `contracts`' custom errors. */
export function chainErrorMessage(error: unknown, contracts: BaseContract[]): string {
  if (isError(error, "ACTION_REJECTED")) return "the transaction was rejected in the wallet";
  if (isError(error, "CALL_EXCEPTION") && error.data) {
    for (const contract of contracts) {
      const reason = contract.interface.parseError(error.data);
      if (reason) return `reverts with ${reason.name}(${reason.args.join(", ")})`;
    }
  }
  const { shortMessage } = (error ?? {}) as { shortMessage?: unknown };
  if (typeof shortMessage === "string") return shortMessage;
  return error instanceof Error ? error.message : String(error);
}

async function confirmed(
  label: string,
  sent: Promise<ContractTransactionResponse>,
  contracts: BaseContract[],
): Promise<ContractTransactionReceipt> {
  let receipt: ContractTransactionReceipt | null;
  try {
    receipt = await (await sent).wait();
  } catch (error) {
    throw new Error(`${label}: ${chainErrorMessage(error, contracts)}`, { cause: error });
  }
  if (receipt === null || receipt.status !== 1) throw new Error(`${label}: the transaction reverted`);
  return receipt;
}

function eventOf<Events, Name extends keyof Events & string>(
  contract: BaseContract,
  receipt: ContractTransactionReceipt,
  name: Name,
): Events[Name] {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== String(contract.target).toLowerCase()) continue;
    const parsed = contract.interface.parseLog(log);
    if (parsed?.name === name) return parsed.args.toObject() as Events[Name];
  }
  throw new Error(`transaction ${receipt.hash} emitted no ${name}`);
}

/** Buys a run in `season`, sending its fee, and returns the run that `RunStarted` names. */
export async function startRun({ challenge, season }: Contracts, accepting: AcceptingSeason): Promise<StartedRun> {
  const receipt = await confirmed(
    `startRun(${accepting.number})`,
    challenge.startRun(accepting.number, { value: accepting.runFee }),
    [challenge, season],
  );
  const { runId, entropyId } = eventOf<ChallengeEvents, "RunStarted">(challenge, receipt, "RunStarted");
  return { runId, entropyId, transaction: receipt.hash };
}
