// The deployed contracts, through the generated bindings: the season accepting runs, the run's
// `startRun`, reveal and `commitRun`, and the season's close and claims (README §7.2, §8.4).
// Errors are decoded with the contracts' custom errors.

import {
  type BaseContract,
  type ContractRunner,
  type ContractTransactionReceipt,
  type ContractTransactionResponse,
  isError,
  type Provider,
} from "ethers";
import { type ArbBlockhashEntropy, connectArbBlockhashEntropy } from "./bindings/ArbBlockhashEntropy";
import { type Challenge, type ChallengeEvents, connectChallenge } from "./bindings/Challenge";
import { connectIArbSys, type IArbSys } from "./bindings/IArbSys";
import { connectSeason, type Season, type SeasonEvents, type SeasonParams } from "./bindings/Season";
import type { Deployment } from "./deployments";

export interface Contracts {
  season: Season;
  challenge: Challenge;
  entropy: ArbBlockhashEntropy;
  arbSys: IArbSys;
}

export interface AcceptingSeason {
  number: bigint;
  runFee: bigint;
  /** The season stops accepting runs at this block timestamp. */
  end: bigint;
  params: SeasonParams;
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
    entropy: connectArbBlockhashEntropy(deployment.addresses.ArbBlockhashEntropy, runner),
    arbSys: connectIArbSys(deployment.addresses.ArbSys, runner),
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
  return { number, runFee: params.runFee, end, params };
}

/** A human-readable reason for a failed call or transaction, decoded with `contracts`' custom errors. */
export function chainErrorMessage(error: unknown, contracts: BaseContract[]): string {
  if (isError(error, "ACTION_REJECTED")) return "the transaction was rejected in the wallet";
  if (isError(error, "CALL_EXCEPTION") && error.data) {
    for (const contract of contracts) {
      const reason = contract.interface.parseError(error.data);
      if (reason) return `reverts with ${reason.name}(${reason.args.join(", ")})`;
    }
    // A Stylus referee reverts with replay's error code as raw bytes, which ethers gives no reason for.
    if (error.reason === null) return `reverts with the error data ${error.data}`;
  }
  const { shortMessage } = (error ?? {}) as { shortMessage?: unknown };
  if (typeof shortMessage === "string") return shortMessage;
  return error instanceof Error ? error.message : String(error);
}

export async function confirmed(
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

export function eventOf<Events, Name extends keyof Events & string>(
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

/** Where a run's entropy block stands (README §7.2): not yet readable, readable, or past its
 *  read window, which forfeits the run. */
export type EntropyState = "waiting" | "revealable" | "lapsed";

export async function entropyState({ challenge, entropy, arbSys }: Contracts, runId: bigint): Promise<EntropyState> {
  const owner = await challenge.getAddress();
  const id = await challenge.entropyIdOf(runId);
  const [revealable, target, current, window] = await Promise.all([
    entropy.isRevealable(owner, id),
    entropy.targetBlock(owner, id),
    arbSys.arbBlockNumber(),
    entropy.READ_WINDOW(),
  ]);
  if (revealable) return "revealable";
  if (target === 0n) throw new Error(`run ${runId} committed to no entropy block`);
  return current > target + window ? "lapsed" : "waiting";
}

export interface RevealedRun {
  runNonce: string;
  revealedAt: bigint;
  transaction: string;
}

/** Reveals the run, which derives its run nonce onchain and starts its deadline clock. */
export async function revealRun({ challenge, season }: Contracts, runId: bigint): Promise<RevealedRun> {
  const receipt = await confirmed(`revealRun(${runId})`, challenge.revealRun(runId), [challenge, season]);
  const { runNonce, revealedAt } = eventOf<ChallengeEvents, "RunRevealed">(challenge, receipt, "RunRevealed");
  return { runNonce, revealedAt, transaction: receipt.hash };
}

export interface CommittedRun {
  commitment: string;
  committedAt: bigint;
  transaction: string;
}

/** Commits the run's six journals, in levelIndex order (README §7.2, P5). */
export async function commitRun({ challenge, season }: Contracts, runId: bigint, journals: readonly string[]): Promise<CommittedRun> {
  const receipt = await confirmed(`commitRun(${runId})`, challenge.commitRun(runId, [...journals]), [challenge, season]);
  const { commitment, committedAt } = eventOf<ChallengeEvents, "RunCommitted">(challenge, receipt, "RunCommitted");
  return { commitment, committedAt, transaction: receipt.hash };
}

/** Closes the oldest season not yet closed, which anyone may do once its settlement has ended
 *  (README §8.4); returns what `SeasonClosed` names. */
export async function closeSeason({ season }: Contracts): Promise<SeasonEvents["SeasonClosed"]> {
  const receipt = await confirmed("closeSeason()", season.closeSeason(), [season]);
  return eventOf<SeasonEvents, "SeasonClosed">(season, receipt, "SeasonClosed");
}

/** Claims the caller's share of a closed season's players' pot; returns the amount paid. */
export async function claim({ season }: Contracts, number: bigint): Promise<bigint> {
  const receipt = await confirmed(`claim(${number})`, season.claim(number), [season]);
  return eventOf<SeasonEvents, "Claimed">(season, receipt, "Claimed").amount;
}
