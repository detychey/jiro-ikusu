// The player's injected wallet (EIP-1193, window.ethereum): connecting, the network check and
// switch (EIP-3326, with EIP-3085 when the wallet does not know the network), the signer, and
// ETH amounts. Adapted from ethblockdigger's src/onchain/testnetWallet.ts.

import { BrowserProvider, type Eip1193Provider, formatEther, getAddress, type JsonRpcSigner } from "ethers";
import type { Network } from "./networks";

const USER_REJECTED = 4001;
const UNRECOGNIZED_CHAIN = 4902;
export const WALLET_EVENTS = ["accountsChanged", "chainChanged"] as const;

export interface Wallet extends Eip1193Provider {
  on?(event: string, listener: () => void): void;
  removeListener?(event: string, listener: () => void): void;
}

export interface Connection {
  account: string;
  chainId: number;
}

export function injectedWallet(page: { ethereum?: Wallet }): Wallet {
  if (page.ethereum === undefined) throw new Error("no wallet found: install a browser wallet, such as MetaMask, to play Challenge runs");
  return page.ethereum;
}

function rpcErrorCode(error: unknown): unknown {
  if (error === null || typeof error !== "object") return undefined;
  const { code, data } = error as { code?: unknown; data?: { originalError?: { code?: unknown } } };
  // Some wallets (MetaMask mobile) nest the provider's error code.
  return data?.originalError?.code ?? code;
}

async function walletRequest(wallet: Wallet, method: string, params: unknown[], what: string): Promise<unknown> {
  try {
    return await wallet.request({ method, params });
  } catch (error) {
    if (rpcErrorCode(error) === USER_REJECTED) throw new Error(`${what} was rejected in the wallet`, { cause: error });
    throw error;
  }
}

export async function chainIdOf(wallet: Wallet): Promise<number> {
  return Number(await walletRequest(wallet, "eth_chainId", [], "the chain id request"));
}

function firstAccount(accounts: unknown): string | undefined {
  const account = Array.isArray(accounts) ? accounts[0] : undefined;
  return typeof account === "string" ? getAddress(account) : undefined;
}

/** Asks the wallet for an account, checksummed (EIP-55). The connection names the chain the wallet
 *  is on, which may be another network's. */
export async function connect(wallet: Wallet): Promise<Connection> {
  const account = firstAccount(await walletRequest(wallet, "eth_requestAccounts", [], "the connection request"));
  if (account === undefined) throw new Error("the wallet shared no account");
  return { account, chainId: await chainIdOf(wallet) };
}

/** The connection the wallet already shares, without prompting: undefined once the wallet is locked
 *  or the page disconnected in it. */
export async function sharedConnection(wallet: Wallet): Promise<Connection | undefined> {
  const account = firstAccount(await walletRequest(wallet, "eth_accounts", [], "the accounts request"));
  return account === undefined ? undefined : { account, chainId: await chainIdOf(wallet) };
}

export function onNetwork(connection: Connection, network: Network): boolean {
  return connection.chainId === network.chainId;
}

/** Switches the wallet to `network`, adding the network first if the wallet does not know it. */
export async function switchNetwork(wallet: Wallet, network: Network): Promise<void> {
  const chainId = `0x${network.chainId.toString(16)}`;
  try {
    await walletRequest(wallet, "wallet_switchEthereumChain", [{ chainId }], `the switch to ${network.chainName}`);
  } catch (error) {
    if (rpcErrorCode(error) !== UNRECOGNIZED_CHAIN) throw error;
    const { chainName, rpcUrls, blockExplorerUrls } = network;
    const nativeCurrency = { name: "Ether", symbol: "ETH", decimals: 18 };
    const added = { chainId, chainName, nativeCurrency, rpcUrls, blockExplorerUrls };
    await walletRequest(wallet, "wallet_addEthereumChain", [added], `adding ${chainName}`);
    // EIP-3085 lets a wallet add a network without switching to it.
    await walletRequest(wallet, "wallet_switchEthereumChain", [{ chainId }], `the switch to ${network.chainName}`);
  }
  const actual = await chainIdOf(wallet);
  if (actual !== network.chainId) {
    throw new Error(`the wallet is still on chain ${actual}: switch it to ${network.chainName} (${network.chainId})`);
  }
}

/**
 * The signer of `connection.account` on `network`. It refuses a wallet on another chain, and is
 * created after any switch: an ethers provider that saw one network refuses to run on another.
 */
export async function signerOf(wallet: Wallet, connection: Connection, network: Network): Promise<JsonRpcSigner> {
  const chainId = await chainIdOf(wallet);
  if (chainId !== network.chainId) {
    throw new Error(`wrong network: the wallet is on chain ${chainId}; switch it to ${network.chainName} (${network.chainId})`);
  }
  const provider = new BrowserProvider(wallet, network.chainId, { cacheTimeout: -1, pollingInterval: 1_000 });
  return provider.getSigner(connection.account);
}

export function formatEth(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}
