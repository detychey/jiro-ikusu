import { describe, expect, it } from "vitest";
import { Interface, JsonRpcProvider, makeError, toBeHex } from "ethers";
import { SEASON_ABI } from "../src/chain/bindings/Season";
import { acceptingSeason, chainErrorMessage, connectContracts } from "../src/chain/contracts";
import { bundledDeployment, type Deployment, newestGeneration } from "../src/chain/deployments";
import { footerEntries } from "../src/chain/footer";
import { ARBITRUM_SEPOLIA, LOCAL, networkOfPage } from "../src/chain/networks";
import { connect, formatEth, injectedWallet, onNetwork, signerOf, switchNetwork, type Wallet } from "../src/chain/wallet";

const ACCOUNT = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const MAINNET = 1;
const SEASON = new Interface(SEASON_ABI);

const OLDER = {
  deployedAt: "2026-11-01T10:00:00.000Z",
  sourceCommit: "5fdebf579c9e2dfed08edf11bc21136bd89575bd",
  backend: "mock",
  operator: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  treasury: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  ArbSys: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  ArbBlockhashEntropy: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  Referee: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  Season: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  Challenge: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  seasons: { local: 1 },
};
const NEWER = {
  ...OLDER,
  deployedAt: "2026-11-01T11:00:00.000Z",
  backend: "stylus",
  Season: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
  Challenge: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
};

function recordOf(network: string, chainId: number, generations: object[] = [NEWER, OLDER]) {
  return { network, chainId, generations };
}

const SEPOLIA_DEPLOYMENT: Deployment = newestGeneration(recordOf("arbitrum-sepolia", ARBITRUM_SEPOLIA.chainId), ARBITRUM_SEPOLIA);

interface Request {
  method: string;
  params?: unknown;
}

function rpcError(code: number): Error {
  return Object.assign(new Error(`rpc error ${code}`), { code });
}

/**
 * A scripted EIP-1193 wallet on `chainId`, which knows the chains in `knows`. Methods in `rejects`
 * fail as the user's rejection (4001), and `call` answers eth_call.
 */
interface MockOptions {
  chainId: number;
  knows?: number[];
  balance?: bigint;
  rejects?: string[];
  call?: (data: string) => string;
  timestamp?: number;
}

function mockWallet(options: MockOptions) {
  const state = { chainId: options.chainId, knows: new Set([options.chainId, ...(options.knows ?? [])]) };
  const requests: Request[] = [];
  const wallet: Wallet = {
    request: async (request: Request) => {
      requests.push(request);
      if (options.rejects?.includes(request.method)) throw rpcError(4001);
      const params = (request.params ?? []) as Record<string, string>[];
      switch (request.method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [ACCOUNT];
        case "eth_chainId":
          return toBeHex(state.chainId);
        case "wallet_switchEthereumChain": {
          const chainId = Number(params[0]?.chainId);
          if (!state.knows.has(chainId)) throw rpcError(4902);
          state.chainId = chainId;
          return null;
        }
        case "wallet_addEthereumChain":
          // EIP-3085 lets a wallet add a chain without switching to it, as this one does.
          state.knows.add(Number(params[0]?.chainId));
          return null;
        case "eth_getBalance":
          return toBeHex(options.balance ?? 0n);
        case "eth_blockNumber":
          return "0x10";
        case "eth_getBlockByNumber":
          return blockAt(options.timestamp ?? 0);
        case "eth_call":
          if (options.call === undefined) break;
          return options.call(params[0]?.data ?? "0x");
      }
      throw new Error(`mock wallet: unexpected ${request.method}`);
    },
  };
  return { wallet, requests, state };
}

function blockAt(timestamp: number) {
  const hash = `0x${"11".repeat(32)}`;
  return {
    hash,
    parentHash: `0x${"22".repeat(32)}`,
    number: "0x10",
    timestamp: toBeHex(timestamp),
    nonce: "0x0000000000000000",
    difficulty: "0x0",
    gasLimit: "0x1c9c380",
    gasUsed: "0x0",
    miner: "0x0000000000000000000000000000000000000000",
    extraData: "0x",
    baseFeePerGas: "0x1",
    transactions: [],
  };
}

/** An eth_call answer for Season: currentSeason is `current`, and its params have `runFee` and `end`. */
function seasonCalls(current: bigint, runFee: bigint, end: bigint) {
  return (data: string): string => {
    const call = SEASON.parseTransaction({ data });
    if (call?.name === "currentSeason") return SEASON.encodeFunctionResult("currentSeason", [current]);
    if (call?.name === "endOf") return SEASON.encodeFunctionResult("endOf", [end]);
    if (call?.name === "paramsOf") {
      const params = [OLDER.Referee, 3, Array(16).fill(`0x${"01".repeat(32)}`), Array(16).fill(1), runFee, 1000, 1, 1, 1, 1];
      return SEASON.encodeFunctionResult("paramsOf", [params]);
    }
    throw new Error(`mock Season: unexpected call ${call?.name}`);
  };
}

async function localSigner(wallet: Wallet) {
  return signerOf(wallet, await connect(wallet), LOCAL);
}

describe("connecting", () => {
  it("returns the wallet's account and chain", async () => {
    const { wallet } = mockWallet({ chainId: ARBITRUM_SEPOLIA.chainId });
    expect(await connect(wallet)).toEqual({ account: ACCOUNT, chainId: ARBITRUM_SEPOLIA.chainId });
  });

  it("reports a connection the user rejected", async () => {
    const { wallet } = mockWallet({ chainId: ARBITRUM_SEPOLIA.chainId, rejects: ["eth_requestAccounts"] });
    await expect(connect(wallet)).rejects.toThrow("the connection request was rejected in the wallet");
  });

  it("refuses a page without an injected wallet", () => {
    expect(() => injectedWallet({})).toThrow("no wallet found");
  });

  it("gives the signer of the account on the network", async () => {
    const { wallet } = mockWallet({ chainId: ARBITRUM_SEPOLIA.chainId });
    const signer = await signerOf(wallet, await connect(wallet), ARBITRUM_SEPOLIA);
    expect(signer.address).toBe(ACCOUNT);
  });
});

describe("the wrong network", () => {
  it("is detected on connecting", async () => {
    const { wallet } = mockWallet({ chainId: MAINNET });
    expect(onNetwork(await connect(wallet), ARBITRUM_SEPOLIA)).toBe(false);
  });

  it("gives no signer", async () => {
    const { wallet } = mockWallet({ chainId: MAINNET });
    await expect(signerOf(wallet, await connect(wallet), ARBITRUM_SEPOLIA)).rejects.toThrow(
      "wrong network: the wallet is on chain 1; switch it to Arbitrum Sepolia (421614)",
    );
  });

  it("switches to Arbitrum Sepolia when the wallet knows it", async () => {
    const { wallet, requests, state } = mockWallet({ chainId: MAINNET, knows: [ARBITRUM_SEPOLIA.chainId] });
    await switchNetwork(wallet, ARBITRUM_SEPOLIA);
    expect(state.chainId).toBe(ARBITRUM_SEPOLIA.chainId);
    expect(requests.map(({ method }) => method)).not.toContain("wallet_addEthereumChain");
  });

  it("adds Arbitrum Sepolia when the wallet does not know it", async () => {
    const { wallet, requests, state } = mockWallet({ chainId: MAINNET });
    await switchNetwork(wallet, ARBITRUM_SEPOLIA);
    expect(state.chainId).toBe(ARBITRUM_SEPOLIA.chainId);
    expect(requests.find(({ method }) => method === "wallet_addEthereumChain")?.params).toEqual([
      {
        chainId: "0x66eee",
        chainName: "Arbitrum Sepolia",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
        blockExplorerUrls: ["https://sepolia.arbiscan.io"],
      },
    ]);
  });

  it("reports a switch the user rejected", async () => {
    const { wallet } = mockWallet({ chainId: MAINNET, knows: [ARBITRUM_SEPOLIA.chainId], rejects: ["wallet_switchEthereumChain"] });
    await expect(switchNetwork(wallet, ARBITRUM_SEPOLIA)).rejects.toThrow("the switch to Arbitrum Sepolia was rejected in the wallet");
  });
});

describe("the balance", () => {
  it("reads the account's balance in wei", async () => {
    const { wallet } = mockWallet({ chainId: LOCAL.chainId, balance: 123_456_789_000_000_000n });
    const signer = await localSigner(wallet);
    expect(await signer.provider.getBalance(ACCOUNT)).toBe(123_456_789_000_000_000n);
  });

  it("shows in ETH", () => {
    expect(formatEth(50_000_000_000_000n)).toBe("0.00005 ETH");
  });

  it("links to a faucet on Arbitrum Sepolia", () => {
    expect(ARBITRUM_SEPOLIA.faucetUrl).toBe("https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info#faucet-list");
  });
});

describe("the deployment record", () => {
  it("gives its newest generation", () => {
    const deployment = newestGeneration(recordOf("local", LOCAL.chainId), LOCAL);
    expect(deployment.addresses.Challenge).toBe(NEWER.Challenge);
  });

  it("gives the newest generation's backend", () => {
    expect(newestGeneration(recordOf("local", LOCAL.chainId), LOCAL).backend).toBe("stylus");
  });

  it("refuses another network's record", () => {
    expect(() => newestGeneration(recordOf("local", LOCAL.chainId), ARBITRUM_SEPOLIA)).toThrow(
      'deployments/arbitrum-sepolia.json records the network "local", not arbitrum-sepolia',
    );
  });

  it("refuses a record of another chain", () => {
    expect(() => newestGeneration(recordOf("local", MAINNET), LOCAL)).toThrow("records chain 1, not Jiro-ikusu local chain (31337)");
  });

  it("refuses a record with no generation", () => {
    expect(() => newestGeneration(recordOf("local", LOCAL.chainId, []), LOCAL)).toThrow("has no generation");
  });

  it("refuses a generation whose contract is not an address", () => {
    expect(() => newestGeneration(recordOf("local", LOCAL.chainId, [{ ...NEWER, Season: "0x1234" }]), LOCAL)).toThrow(
      "the newest generation's Season is not an address",
    );
  });

  it("refuses a network the build has no record of", () => {
    expect(() => bundledDeployment({ ...LOCAL, name: "nowhere" })).toThrow("deployments/nowhere.json is missing");
  });
});

describe("the page's network", () => {
  it("is Arbitrum Sepolia by default", () => {
    expect(networkOfPage("")).toBe(ARBITRUM_SEPOLIA);
  });

  it("is the local chain with ?network=local", () => {
    expect(networkOfPage("?network=local")).toBe(LOCAL);
  });

  it("refuses an unknown network", () => {
    expect(() => networkOfPage("?network=mainnet")).toThrow('unknown network "mainnet"');
  });
});

describe("the footer", () => {
  it("links every contract address to the explorer", () => {
    const entries = footerEntries(SEPOLIA_DEPLOYMENT, "abc123");
    expect(entries.find(({ label }) => label === "Challenge")).toEqual({
      label: "Challenge",
      text: NEWER.Challenge,
      href: `https://sepolia.arbiscan.io/address/${NEWER.Challenge}`,
    });
  });

  it("lists the five contracts, then the build", () => {
    const labels = footerEntries(SEPOLIA_DEPLOYMENT, "abc123").map(({ label }) => label);
    expect(labels).toEqual(["Network", "ArbSys", "ArbBlockhashEntropy", "Referee", "Season", "Challenge", "Build"]);
  });

  it("shows the build's git sha", () => {
    expect(footerEntries(SEPOLIA_DEPLOYMENT, "abc123").at(-1)).toEqual({ label: "Build", text: "abc123" });
  });

  it("shows the build alone without a deployment", () => {
    expect(footerEntries(undefined, "abc123")).toEqual([{ label: "Build", text: "abc123" }]);
  });
});

describe("the season accepting runs", () => {
  async function seasonOn(call: (data: string) => string, timestamp: number) {
    const { wallet } = mockWallet({ chainId: LOCAL.chainId, call, timestamp });
    const signer = await localSigner(wallet);
    return { season: connectContracts(SEPOLIA_DEPLOYMENT, signer).season, provider: signer.provider };
  }

  it("gives the newest season's number and fee", async () => {
    const { season, provider } = await seasonOn(seasonCalls(2n, 50_000_000_000_000n, 2_000n), 1_000);
    expect(await acceptingSeason(season, provider)).toEqual({ number: 2n, runFee: 50_000_000_000_000n, end: 2_000n });
  });

  it("refuses when no season has opened", async () => {
    const { season, provider } = await seasonOn(seasonCalls(0n, 0n, 0n), 1_000);
    await expect(acceptingSeason(season, provider)).rejects.toThrow("no season has opened yet");
  });

  it("refuses when the newest season has ended", async () => {
    const { season, provider } = await seasonOn(seasonCalls(2n, 50_000_000_000_000n, 2_000n), 2_000);
    await expect(acceptingSeason(season, provider)).rejects.toThrow("season 2 ended at 2000");
  });
});

describe("chain errors", () => {
  const contracts = () => {
    const runner = new JsonRpcProvider("http://127.0.0.1:1", LOCAL.chainId, { staticNetwork: true });
    const { season, challenge } = connectContracts(SEPOLIA_DEPLOYMENT, runner);
    return [challenge, season];
  };

  it("decode a revert with the contracts' custom errors", () => {
    const data = SEASON.encodeErrorResult("WrongFee", [1n, 50_000_000_000_000n]);
    const transaction = { to: null, data: "0x" };
    const error = makeError("execution reverted", "CALL_EXCEPTION", {
      action: "estimateGas",
      data,
      reason: null,
      transaction,
      invocation: null,
      revert: null,
    });
    expect(chainErrorMessage(error, contracts())).toBe("reverts with WrongFee(1, 50000000000000)");
  });

  it("say when the user rejected the transaction", () => {
    const error = makeError("user rejected action", "ACTION_REJECTED", { action: "sendTransaction", reason: "rejected" });
    expect(chainErrorMessage(error, contracts())).toBe("the transaction was rejected in the wallet");
  });
});
