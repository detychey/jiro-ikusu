// JSON-RPC to a development node, and an EIP-1193 wallet backed by it: the node's development
// accounts are unlocked (anvil), and the wallet shares only the chosen account. The web scripts
// that run src/chain on a local chain use them.

/** A function that sends a JSON-RPC request to `rpc` and returns its result, or throws its error. */
export function rpcClient(rpc) {
  let id = 0;
  return async (method, params = []) => {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    if (!response.ok) throw new Error(`${rpc} answered ${method} with HTTP ${response.status}`);
    const { result, error } = await response.json();
    if (error) throw Object.assign(new Error(`${method}: ${error.message}`), { code: error.code, data: error.data });
    return result;
  };
}

const RECEIPT_POLL_MS = 50;

/**
 * A wallet sharing the node's account `account`; `beforeTransaction` runs before each one is sent.
 * It answers a transaction once its receipt exists: anvil may answer before it has mined the
 * transaction's block, and on a chain with no later block ethers would then wait for one forever.
 */
export function nodeWallet(send, account, beforeTransaction = async () => {}) {
  return {
    request: async ({ method, params = [] }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
      if (method !== "eth_sendTransaction") return send(method, params);
      await beforeTransaction();
      const hash = await send(method, params);
      while ((await send("eth_getTransactionReceipt", [hash])) === null) {
        await new Promise((resolve) => setTimeout(resolve, RECEIPT_POLL_MS));
      }
      return hash;
    },
  };
}
