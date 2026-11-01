// The networks the web app plays on, each with the parameters a wallet needs to add it
// (EIP-3085), by the name of its record in deployments/ (deployments/README.md).

export interface Network {
  name: string;
  chainId: number;
  chainName: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  /** Where testers get the network's ETH; none on a local chain, whose accounts start funded. */
  faucetUrl?: string;
}

export const ARBITRUM_SEPOLIA: Network = {
  name: "arbitrum-sepolia",
  chainId: 421614,
  chainName: "Arbitrum Sepolia",
  rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
  blockExplorerUrls: ["https://sepolia.arbiscan.io"],
  // Arbitrum's own list of faucets, which stays current as single faucets come and go.
  faucetUrl: "https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info#faucet-list",
};

/** The anvil chain of scripts/contracts/localnet.mjs, on its default port. */
export const LOCAL: Network = {
  name: "local",
  chainId: 31337,
  chainName: "Jiro-ikusu local chain",
  rpcUrls: ["http://127.0.0.1:8545"],
  blockExplorerUrls: [],
};

const NETWORKS = [ARBITRUM_SEPOLIA, LOCAL];

export function networkNamed(name: string): Network {
  const network = NETWORKS.find((known) => known.name === name);
  if (network === undefined) {
    throw new Error(`unknown network ${JSON.stringify(name)}: expected one of ${NETWORKS.map((known) => known.name).join(", ")}`);
  }
  return network;
}

/** The page's network: `?network=<name>`, Arbitrum Sepolia by default. */
export function networkOfPage(search: string): Network {
  return networkNamed(new URLSearchParams(search).get("network") ?? ARBITRUM_SEPOLIA.name);
}
