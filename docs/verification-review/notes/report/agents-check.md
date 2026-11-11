# Fact-check of agents.md (MCP and x402 for proving)

Checked 2026-11-10. Pages and RPC endpoints were read on that date. Tags: [P] primary source, [S] secondary source, [I] inference.

## Verdicts

| Id | Verdict | What I opened |
|---|---|---|
| F1 | confirmed | x402 spec v2 version history: v2.0 "2025-12-9". npm registry: @x402/core, @x402/evm and @x402/mcp 2.30.0, published 2026-11-04 20:04-20:13 UTC. @modelcontextprotocol/sdk 1.32.2, published 2026-10-23 [P] |
| F2 | confirmed | spec v2 §6.1: authorization "verify → resource → settle → respond"; upfront "settle → resource → respond"; escrow "settle → resource → settle → respond"; "clients SHOULD prefer `authorization`" [P] |
| F3 | confirmed | docs.cdp.coinbase.com/x402/network-support.md: Arbitrum eip155:42161 with exact, upto and batch-settlement. Testnets are Base Sepolia, World Sepolia and Solana Devnet [P] |
| F4 | confirmed | same page: up to 1,000 onchain transactions a month at 0 USD, then 0.001 USD each; "Payment verification is always free" [P] |
| F5 | confirmed, with a nuance | docs.x402.org network page: native assets only for Hedera, Cardano, Canton, Concordium and XRPL. EVM uses EIP-3009, with Permit2 as the fallback. The SDK's default-asset table also lists Arbitrum Sepolia (eip155:421614) USDC, so the SDK supports that chain. Only the hosted facilitators leave it out [P] |
| F6 | confirmed | AuthCaptureEscrow v1.1 0xf968…B19c and v1.0 0xBdEA…0cff, and both EIP-3009 collectors: `eth_getCode` returns `0x` on Arbitrum One and Arbitrum Sepolia, and returns code on Base. Small date error: the report gives v1.1 as 2026-08-18, but the EVM binding's version history says v1.1 is dated 2026-08-26 (v1.0 is dated 2026-05-13) [P] |
| F7 | corrected (detail) | `TRANSFER_WITH_AUTHORIZATION_TYPEHASH()` (selector 0xa0cc6a68) returns 0x7c7c6cdb…2267 on both USDC contracts, and `version()` returns "2". The report gives 0xd099cc98…3de8, which is the ReceiveWithAuthorization typehash. The conclusion (EIP-3009 is present) still holds [P, RPC + cast keccak] |
| F8 | confirmed, but incomplete | @x402/mcp 2.30.0 tarball: dist/esm/index.mjs:1037-1038 `if (result.isError) { … cancel({ reason: "handler_failed" })`. The README gives the default cap as "$1 per payment". Missed: the README also gives `maxTimeoutSeconds` a default of 60 s and `maxRequestTimeoutSeconds` a default cap of 600 s on derived MCP waits. A 2 to 15 minute synchronous paid proof does not fit those defaults. The package depends on @modelcontextprotocol/sdk ^1.32.0 [P] |
| F9 | confirmed | MCP versioning page: current version 2026-07-28. Changelog items 1, 2, 3 and 9: sessions removed, "server-minted handles", no initialize handshake, server/discover is a MUST, "A broken response stream loses the in-flight request" [P] |
| F10 | confirmed | Tasks overview: CreateTaskResult with taskId, ttlMs and pollIntervalMs; polling with tasks/get; "Cancellation is cooperative"; "Task support requires explicit opt-in from both client and server" [P] |
| F11 | confirmed | 2026-07-28 authorization page: "OPTIONAL"; OAuth 2.1; RFC 9728 MUST; RFC 8707 MUST; "STDIO … SHOULD NOT … retrieve credentials from the environment" [P] |
| F12 | confirmed | erc-8004-contracts README lists the addresses. `eth_getCode` returns 298 characters (a proxy) at A169/BAa1 on Arbitrum One and at A818/B663 on Arbitrum Sepolia, and `0x` on the swapped pairs. The EIP is Draft, created 2025-08-13. The Validation address 0x8004Cb1B… has code only on Arbitrum Sepolia [P] |
| F13 | confirmed | TRM blog, 2026-09-09: about 52.7 M USD; about 198.9 M settlement transactions; Base, Solana and Polygon; since May 2025; 25.62 M likely commerce; 0.6-7.5 % agentic; USDC 99.6 %. 52.7/198.9 = 0.265 USD per transaction [S] |
| F14 | confirmed (arithmetic), estimate basis | 0.0000123/588,700 = 2.089e-11 and 0.0000136/588,700 = 2.310e-11 ETH per gas. Post: 97,436 × those = 2.04e-6 to 2.25e-6 ETH, × 2,064.61 = 0.0042 to 0.0046 USD. Withdraw: 37,949 → 0.0016 to 0.0018 USD. Claim: 0.0254 to 0.0281 USD. The 588,700 is itself an estimate in final.md §2 ("+223,800 [est]") [I] |
| F15 | confirmed | 0x1341330 = 20,190,000 wei = 0.02019 gwei. My read: 0x1315410 = 0.02001 gwei at block 523,108,908 [P] |
| F16 | confirmed (arithmetic), weak model | 18×0.9+2 = 18.2 s, × 0.69/3600 = 0.00349 USD. 131×0.9+2 = 119.9 s → 0.0230 USD. 2,766×0.9+2 = 2,491 s → 0.477 USD. Cap: 4 × 0.00005 × 2,064.61 = 0.413 USD. Flaws are listed below [I] |
| F17 | confirmed, nuance | EIP-8183: Draft, created 2026-02-25; six states (the abstract says four); "Payment SHALL use a single ERC-20 token"; the provider "MAY be zero at creation" but only the client sets it, before funding. So it is still client-chosen [P] |
| F18 | confirmed | x402.org/facilitator/supported: v2 exact/upto/batch-settlement on eip155:84532, plus non-EVM testnets, plus v1 base-sepolia and solana-devnet. No Arbitrum entry [P] |
| x402 self-hosted row | corrected | I measured real direct USDC `transferWithAuthorization` calls (selector 0xe3ee160e) on Arbitrum One, six transactions from about the last 100k blocks: gasUsed 81,734 to 103,907, mostly 82-87k; fee 1.64e-6 to 2.11e-6 ETH = 0.0034 to 0.0044 USD at 2,064.61 USD. The report's 70,000 gas (0.0030-0.0033 USD) estimate is about 15-30 % low [P, RPC] |
| Facilitator directory | confirmed | docs.x402.org/dev-tools/facilitators names no Arbitrum network. Corbits, Dexter and Solvador say only "EVM" [P] |
| RunPod prices | confirmed | runpod.io/pricing: 5090 at 0.69 (community), 1.19 (secure) and 1.79 (serverless); 4090 at 0.34, 0.89 and 1.34 USD/h. The page does not state per-second billing for these cards [P] |
| GCP g2 price | unsupported here | The pricing page did not render for me. The 0.7068 figure comes from the earlier research and was not re-read [—] |
| README §7.5 quotes | confirmed | README.md:673, 679, 680 [P] |

## Reasoning flaws
1. The minimum-bounty model ignores the race. With N provers racing and a first-claim-wins rule, losers lose their GPU time. The expected GPU cost per bounty won is about N × the GPU cost. With N = 3 on a bot run, that is 3 × 0.023 = 0.069 USD of GPU alone, before 0.027-0.030 of claim and withdraw gas, so about 0.10 USD. The floor applies only to a single uncontested prover.
2. Each claim gas uses the claim's all-in price. That is fine (the L1 share is tiny at about 0.02 gwei), but the self-hosted x402 gas was an estimate. Real is 82-104k gas, so 0.0034-0.0044 USD.
3. Segment count: 18 M cycles / 2^20 = 17.2 → 18 assumes perfectly packed segments. Real segment counts depend on total cycles including paging, and on po2 padding. With 2^19 segments on an 8-12 GB card, there are twice as many segments. That matters for the RTX 3060 12 GB: Boundless says 9-10 GB for 2^20, so 2^20 may fit or not.
4. "Rented GPU kept busy" ignores the cold start: loading the 2.34 GB Groth16 component and the image, the instance boot, and the GCP 1-minute minimum. For one 18 s human run, cold-start overhead can dominate.
5. A paid x402 tool over MCP has a default 60 s payment timeout and a 600 s wait cap in @x402/mcp. The report says only that "the call must stay open". The bot runs (120 s on a 5090, about 200-220 s on an L4) and the human runs fit 600 s. A worst case does not, and the 60 s default must be raised.

## Missed
- @x402/mcp defaults: `maxTimeoutSeconds` 60 s and `maxRequestTimeoutSeconds` 600 s (README in the 2.30.0 tarball).
- The x402 SDK default-asset table includes Arbitrum Sepolia USDC (eip155:421614), so a self-hosted facilitator on Sepolia is supported by the SDK, not only by inference (docs.x402.org network-and-token-support).
- Real EIP-3009 gas on Arbitrum One: 82-104k (RPC receipts). About 2,600 AuthorizationUsed events on Arbitrum USDC in about 100k blocks, so EIP-3009 use on Arbitrum is active.
- The Tasks page says Tasks give crash resilience and that "many clients … impose timeouts that make this impractical beyond a few seconds". That argues more strongly for job_id plus status.
- @x402/mcp depends on @modelcontextprotocol/sdk ^1.32.0, and its README talks of "MCP TypeScript SDK v1" behaviour. Compatibility with the stateless 2026-07-28 revision is unverified, which is a risk for combining x402 with a 2026-07-28 server.
