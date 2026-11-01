// The deployment records of deployments/README.md: the web app plays on a record's newest
// generation, generations[0]. deploy.mjs and localnet.mjs check every record against the full
// schema when they write it; this loader checks what the app relies on.

import { getAddress } from "ethers";
import type { Network } from "./networks";

export const CONTRACT_KEYS = ["ArbSys", "ArbBlockhashEntropy", "Referee", "Season", "Challenge"] as const;
export type ContractKey = (typeof CONTRACT_KEYS)[number];
const BACKENDS = ["mock", "stylus"] as const;

export interface Deployment {
  network: Network;
  deployedAt: string;
  sourceCommit: string;
  backend: (typeof BACKENDS)[number];
  addresses: Record<ContractKey, string>;
  /** Season numbers by label, as `open` assigned them. */
  seasons: Record<string, number>;
}

// The records in the repository when the site was built: committed ones, and a local chain's
// record if one exists (it is not committed).
const BUNDLED: Record<string, unknown> = import.meta.glob("../../../deployments/*.json", { eager: true, import: "default" });

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The newest generation of `record`, a parsed deployments/<network>.json, which must be `network`'s. */
export function newestGeneration(record: unknown, network: Network): Deployment {
  const where = `deployments/${network.name}.json`;
  if (!isObject(record)) throw new Error(`${where} is not a deployment record`);
  if (record.network !== network.name) {
    throw new Error(`${where} records the network ${JSON.stringify(record.network)}, not ${network.name}`);
  }
  if (record.chainId !== network.chainId) {
    throw new Error(`${where} records chain ${String(record.chainId)}, not ${network.chainName} (${network.chainId})`);
  }
  const generations = record.generations;
  if (!Array.isArray(generations) || !isObject(generations[0])) throw new Error(`${where} has no generation`);
  const newest = generations[0];
  const { deployedAt, sourceCommit, backend, seasons } = newest;
  if (typeof deployedAt !== "string" || typeof sourceCommit !== "string") {
    throw new Error(`${where}: the newest generation misses deployedAt or sourceCommit`);
  }
  if (!BACKENDS.some((known) => known === backend)) throw new Error(`${where}: unknown backend ${JSON.stringify(backend)}`);
  if (!isObject(seasons) || !Object.values(seasons).every((number) => Number.isSafeInteger(number))) {
    throw new Error(`${where}: the newest generation's seasons are not season numbers`);
  }
  const addresses = Object.fromEntries(
    CONTRACT_KEYS.map((key) => {
      try {
        return [key, getAddress(String(newest[key]))];
      } catch (error) {
        throw new Error(`${where}: the newest generation's ${key} is not an address`, { cause: error });
      }
    }),
  ) as Record<ContractKey, string>;
  return {
    network,
    deployedAt,
    sourceCommit,
    backend: backend as Deployment["backend"],
    addresses,
    seasons: seasons as Record<string, number>,
  };
}

/** The newest generation on `network` of the records the site was built with. */
export function bundledDeployment(network: Network): Deployment {
  const record = BUNDLED[`../../../deployments/${network.name}.json`];
  if (record === undefined) {
    throw new Error(`this build has no deployment on ${network.chainName}: deployments/${network.name}.json is missing`);
  }
  return newestGeneration(record, network);
}
