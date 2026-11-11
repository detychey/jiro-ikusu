# Proving through agents: an MCP server, and bounties for autonomous agents paid with x402

Design-review report, written 2026-11-10. Every web page and RPC endpoint below was read on 2026-11-10 between about 15:00 and 16:30 UTC. The repository was read only, never changed. No proof was made, no instance was rented, and no payment was sent.

Tags: **[P]** primary source (a specification, official documentation, a package published by the maintainers, a deployed contract read over RPC, or the repository itself); **[S]** secondary source (press, analytics firms, third-party blogs, the committed ethskills copies, earlier research in this scratch folder); **[I]** inference (my own arithmetic or reasoning, shown in full). Sources are numbered in section 9.

Owner questions:
- (A) Could the player have the proof made by an agent through MCP (the Model Context Protocol)?
- (B) Could proving be made a bounty for autonomous agents paid with x402?

## 0. Answers in short

**(A) Yes, and it is cheap to build. MCP is only a front end, though.** MCP 2026-07-28 is a stateless protocol [P, 6]. It handles long jobs in two ways: a handle the server issues and the client polls through ordinary tools, or the official Tasks extension (`tasks/get` polling, `ttlMs`, `pollIntervalMs`) [P, 6, 8]. A proving job of 2 to 15 minutes fits either. Three shapes work:
1. A remote MCP server in front of the operator's GPU prover, with the tools `quote`, `prove(run_id)` and `status(job_id)`.
2. A local stdio MCP server that wraps the `zk-host` binary, for a player who owns an NVIDIA GPU.
3. The owner's agent supervising its own prover through that same local server.

MCP adds discovery, a standard way for an agent to call the prover, and job polling. It adds no payment, no trust and no proof checking. Validity still comes only from the Groth16 check onchain. Payment comes either from x402 (an extension that rides in MCP `_meta`) [P, 3] or from the ProofBounty escrow.

**(B) x402 on its own is not a bounty mechanism. It is pay-per-call to a server the client chose.**
- Money flows from client to server, and the client picks one server. There is no open competition and no "first valid proof wins".
- In the default flow the server does the work and then settles the payment [P, 1]. The client pays before it can check the proof itself, and the `exact` scheme has no refund [P, 2].
- On EVM chains x402 moves ERC-20 tokens through EIP-3009 or Permit2. Native ETH is not offered [P, 1, 4], while this project's fees and pot are in native ETH.
- Arbitrum One has a production facilitator (Coinbase CDP) [P, 4]. No hosted facilitator lists Arbitrum Sepolia [P, 4, 5, 11].

Only ProofBounty gives payment on delivery that is atomic and verified onchain, open to anyone, with no account. The sensible combination:
- ProofBounty stays the bounty: agents act as bounty hunters, and the payee is bound inside the proof.
- x402 is used, at most, to sell proving as a priced service: an MCP or HTTP endpoint that proves, checks the proof with an `eth_call`, settles the run, and only then charges USDC.

ERC-8004 is deployed on Arbitrum One and Arbitrum Sepolia [P, my RPC reads]. It is optional here and is useful only so that agents can discover the operator's endpoint.

**Recommendation:**
1. Build the local MCP wrapper for the owner's supervising agent first. It is small and needs no new contract.
2. Build the remote MCP endpoint (quote, prove, status) next, free and rate-limited, once the GPU rate is measured.
3. Let agents compete on ProofBounty, with no x402.
4. Treat x402 pricing as optional and mainnet-only, after the escrow economics are settled.

## 1. What the committed skills and the escrow specification say (dated secondary sources)

The ethskills copies in `.claude/skills/` are undated in the file. Their own text names dates up to 2026-01-29. I treat them as [S].

- **standards/SKILL.md** [S, 12]:
  - It calls ERC-8004, x402, EIP-3009 and EIP-7702 "deployed and in production use".
  - x402 flow: `402` + `PAYMENT-REQUIRED`, then the client signs, then a retry with `PAYMENT-SIGNATURE`, then the server verifies and settles, then `200` + `PAYMENT-RESPONSE`. A facilitator does verify and settle.
  - Amounts are in token base units: USDC has 6 decimals, so 0.10 USD is `100000`.
  - EIP-3009 lets a payer with USDC and no ETH pay.
  - ERC-8004 registries sit at `0x8004A169…a432` (Identity) and `0x8004BAa1…9b63` (Reputation) on mainnets, and at a different pair on testnets. Reputation is attested by clients. The Validation Registry is "not part of the deployed pair".
  - EIP-7702 has been live since 2025-05-07.
- **tools/SKILL.md** [S, 12]: use the scoped `@x402/*` packages, version 2.x. The unscoped `x402` packages are frozen at 1.2.0. It also names Blockscout MCP for agents that read chain data.
- **wallets/SKILL.md** [S, 12]: decide authority before storage. A key that signs unattended should control only "a bounded float". A key that has appeared in a prompt is burned. Anything that moves funds gets a gate where a human confirms the amount and the destination. These rules apply directly to an agent that holds a prover's hot key or an x402 payer key.
- **concepts/SKILL.md** [S, 12]: for each state transition, ask who sends it, why, and whether the reward covers the gas. This is exactly the question for a bounty claim (section 6).
- **ProofBounty specification after red team** [S, 13]: anyone posts ETH on a `runId`. `claim(runId, proof)` pays `referee.payeeOf(proof)` and never `msg.sender`. The payee word sits inside the sha256-bound public values, so a copied proof pays the original prover. There is one payout per run. Refund opens after the settlement end or after the verifier's emergency stop. The per-run cap is 4 × runFee. The operator keeps settling every qualified best run itself (C1). Gas measured on the prototype [proto]:

  | Call | Gas |
  |---|---|
  | `post`, first deposit on a run | 97,436 |
  | `post`, later deposit | 63,236 |
  | `claim` of a human-style run, with the real verifier | about 588,700 |
  | `withdraw` | 37,949 |
  | `refund` | 67,481 |

  The decoy and self-claim liveness attack survives. It is fixed only by a lock with a stake, which is deferred to mainnet.
- **README §7.5** [P, 14]: a future proving service is "an untrusted prover, not an oracle". Settlement credits the run's player whoever submits. "The commit never waits for the service." "Proving stays permissionless."

## 2. x402 today (primary sources)

### 2.1 Version and flow
- **Specification:** protocol version 2, `x402Version: 2`. Version history: v2.0 on 2025-12-09 [P, 1]. The repository moved to `x402-foundation/x402` and has no GitHub releases [P, 15]. The packages are released on npm: `@x402/core`, `@x402/evm` and `@x402/mcp` are all at 2.30.0, published 2026-11-04 [P, 16].
- **Who signs what.** The client signs a `PaymentPayload` for one entry of the server's `accepts[]` list. On EVM `exact` this is an EIP-3009 `transferWithAuthorization`, or a Permit2 transfer, with `validAfter`/`validBefore` and a 32-byte nonce [P, 1, 2]. The server does not sign the payment.
- **When the work happens.** The protocol defines three flows [P, 1, §6.1]:

  | Flow | Order | Notes |
  |---|---|---|
  | `authorization` (the default) | verify → resource → settle | `/verify` is read-only. Funds move only after the resource completes. |
  | `upfront` | settle → resource | |
  | `escrow` | settle (hold) → resource → settle (final) | |

  When both are offered, clients "SHOULD prefer `authorization`".
- **What a facilitator does.** It exposes `POST /verify`, `POST /settle` and `GET /supported`, and submits the transaction so that the resource server "never runs a node or holds gas" [P, 1; S, 12]. A resource server may also settle by itself.
- **Timeouts.** `maxTimeoutSeconds` is required for every payment option. It bounds the authorization's validity window [P, 1]. A 15-minute proving job therefore needs a value of at least 900 s plus a margin [I].

### 2.2 Schemes [P, 1, 17]
- **`exact`:** a fixed amount, one transfer, irreversible. "`exact` moves a fixed amount once and offers no way to give it back" [P, 17, auth-capture summary].
- **`upto`:** the client authorizes a maximum, and the server settles the actual usage, which may be zero, after the handler runs. It is single-use, time-bound and bound to the recipient. On EVM it uses Permit2.
- **`batch-settlement`:** commitments backed by capital (deposit channels with cumulative vouchers; EVM binding v1.1 of 2026-10-06) or by credit.
- **`auth-capture`:** the escrow-like scheme. It supports authorize (hold), capture, void, refund, and a `reclaim` by the client after a capture deadline (scheme v1.1 of 2026-08-18). Its EVM binding uses Base's `commerce-payments` contracts: `AuthCaptureEscrow` v1.1 `0xf968…B19c` and v1.0 `0xBdEA…0cff`.
  - **These are not deployed on Arbitrum One or Arbitrum Sepolia.** `eth_getCode` returns empty for both escrows and for the EIP-3009 collector on both chains [P, my RPC reads, 18].
  - Even where deployed, capture, void and refund are decided by the resource server or its operator, not by a proof check.

### 2.3 Networks, tokens and fees
- **Coinbase CDP facilitator** [P, 4]:
  - Mainnets: Base, Polygon, **Arbitrum (`eip155:42161`)**, Monad, World and Solana.
  - Testnets: Base Sepolia, World Sepolia and Solana Devnet. **No Arbitrum Sepolia.**
  - Schemes on EVM: `exact`, `upto` and `batch-settlement`.
  - Tokens: "all ERC-20 tokens on its EVM networks through EIP-3009 or Permit2".
  - Fees: "The first 1,000 onchain Facilitator transactions each month are free", then 0.001 USD per onchain transaction. "Payment verification is always free."
- **Public x402.org facilitator** (testnets only): `GET /supported`, which I read, lists `eip155:84532` (Base Sepolia) plus non-EVM testnets. No Arbitrum network appears [P, 11].
- **Facilitator directory** on docs.x402.org: no entry names Arbitrum One or Arbitrum Sepolia explicitly. Several say only "EVM" [P, 5]. Third-party listings claim Arbitrum support for thirdweb, Corbits, AnySpend and Solvador [S, search results; not verified].
- **Native ETH:** the network page lists native assets only for Hedera, Cardano, Canton, Concordium and XRPL. EVM payments go through EIP-3009 or Permit2 on an ERC-20 [P, 19]. The core specification lists EVM assets as "ERC-20 tokens implementing EIP-3009" [P, 1, §11.2]. **Native ETH is therefore not an x402 asset on Arbitrum. The nearest substitute is WETH through Permit2** [I].
- **USDC on Arbitrum:**
  - Native USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` answers `name()` "USD Coin" and `version()` "2".
  - Its `TRANSFER_WITH_AUTHORIZATION_TYPEHASH()` returns `0xd099cc98…3de8`, so EIP-3009 is present.
  - The Arbitrum Sepolia USDC `0x75fa…AA4d` answers the same [P, my RPC reads, 18].
  - A self-hosted facilitator could therefore serve Arbitrum Sepolia [I].
- **Refunds and disputes:** `exact` has none. `upto` can charge 0. Only `auth-capture` has void, refund and reclaim, and those are decided by the server or operator [P, 17]. There is no third-party arbitration in the protocol.
- **Discovery:** the "Bazaar" through `GET /discovery/resources` and `/discovery/search` on a facilitator [P, 1, §8]. Community directories are named in the README: x402scan, Agentic.Market, x402-list and others [P, 15].
- **Maturity and volume:**
  - TRM Labs (2026-09-09): about 52.7 million USD settled across 198.9 million transactions on Base, Solana and Polygon since May 2025.
    - After screening out self-payments and wash flows, about 25.6 million USD "likely commerce" remains.
    - Only 0.6 % to 7.5 % of that looks agentic.
    - 99.6 % of the volume settled in USDC [S, 20].
    - Average: 52.7 M / 198.9 M = **0.27 USD per transaction** [I].
  - The x402.org home page says only "has processed millions of transactions" [P, 21].
  - Facilitators are run by Coinbase (CDP), Polygon, Celo, Fireblocks, PayAI, Dexter, thirdweb and others [P, 5].

### 2.4 x402 inside MCP [P, 3, 7, 16]
- **Transport specification `transports-v2/mcp.md`:**
  1. A paid tool called without payment returns a tool result with `isError: true` and the `PaymentRequired` object, in `structuredContent` and also in `content[0].text`.
  2. The client retries with `_meta["x402/payment"]`.
  3. The server verifies, executes, settles, and returns `_meta["x402/payment-response"]`.
- **Package `@x402/mcp` 2.30.0:**
  - `createPaymentWrapper(resourceServer, {accepts})` wraps a tool handler on the server. `wrapMCPClientWithPayment` and `createx402MCPClient` wrap a client.
  - The client's default spend control is "$1 per payment unless `spendControls` is set".
  - Hooks: `onBeforeExecution` runs after verify, `onAfterExecution` runs before settle, and `onAfterSettlement`.
  - In the code, a handler result with `isError` cancels settlement (`cancel({reason: "handler_failed"})`), so **a failed proof is not charged** [P, 16, dist/esm/index.mjs lines 1037-1053].
  - **Neither the README nor the code mentions MCP Tasks** (0 matches for "task"). A paid tool is therefore a synchronous call. Wrapping a call that returns a task handle would settle payment when the handle is returned, before the proof exists [I].
- **Coinbase's guide** "MCP payments": the CDP SDK's `createX402Server` is HTTP-only. For MCP you build the resource server and plug in the CDP facilitator. Long-running tools are not covered [P, 7].

## 3. MCP today (primary sources)

- **Current version: 2026-07-28** [P, 6, versioning page]. Its main changes from 2025-11-25 [P, 6, changelog]:
  - Protocol-level sessions and `Mcp-Session-Id` are removed. "Servers that need cross-call state use explicit, server-minted handles passed as ordinary tool arguments."
  - No `initialize` handshake. Each request carries its version and capabilities in `_meta`, and the new `server/discover` RPC is mandatory.
  - Tasks are moved into the official extension `io.modelcontextprotocol/tasks`: polling with `tasks/get`, `tasks/update` for input, `tasks/cancel`, and no `tasks/list`.
  - Request-scoped `notifications/progress` still flows on the response stream of the request it belongs to.
  - SSE resumability is removed: "A broken response stream loses the in-flight request".
- **Tasks extension** [P, 8]:
  - The server decides for each request whether to return `CreateTaskResult` (`resultType: "task"`, with `taskId`, status, `ttlMs` and `pollIntervalMs`), but only if the client declared the extension.
  - Statuses are `working`, `input_required`, `completed`, `failed` and `cancelled`.
  - Optional `notifications/tasks` arrive through `subscriptions/listen`.
  - Cancellation is "cooperative".
- **Client support for Tasks:** the official client matrix lists Claude, ChatGPT, Cursor and others. In my read the Tasks column was empty for all of them [P, 9]. I could not confirm that any major host supports Tasks today. **Design implication:** a `prove` tool that returns a `job_id`, plus a `status(job_id)` tool, works in every client. That is the pattern the changelog itself names. Tasks can be added for clients that support them [I].
- **Long single calls are fragile.** A dropped stream loses the request [P, 6]. Holding a 2 to 15 minute `tools/call` open is therefore not advisable [I].
- **Authorization** (2026-07-28):
  - "OPTIONAL". For HTTP it is OAuth 2.1, with servers acting as OAuth resource servers.
  - RFC 9728 protected-resource metadata is required, and RFC 8707 resource indicators are required.
  - Client ID Metadata Documents are preferred, and Dynamic Client Registration is deprecated.
  - stdio servers "SHOULD NOT" follow it and take credentials from the environment [P, 10].
- **Discovery:** the official MCP Registry ("in preview") lists public remote servers and packages under DNS- or GitHub-verified namespaces [P, 22].
- **SDK:** `@modelcontextprotocol/sdk` latest is 1.32.2, published 2026-10-23 [P, 16]. I did not verify which protocol revision it implements.

## 4. Agent identity and wallets

- **ERC-8004:**
  - Status Draft, created 2025-08-13. It defines Identity, Reputation and Validation registries. Its registration file has a `services` list (MCP, A2A, web and others) and an `x402Support` flag [P, 23].
  - The official contracts README lists **Arbitrum Mainnet** Identity `0x8004A169…a432` and Reputation `0x8004BAa1…9b63`, and **Arbitrum Testnet** `0x8004A818…BD9e` and `0x8004B663…8713` [P, 24].
  - My `eth_getCode` reads confirm 130-byte proxies at all four addresses on the expected chains, and empty code at the swapped pairs [P, 18].
  - The Validation Registry address that third parties give, `0x8004Cb1B…4272`, has code on Arbitrum Sepolia and none on Arbitrum One [P, 18; address from S].
- **Is ERC-8004 needed here?** No [I]:
  - The escrow trusts the proof, not the prover, so reputation decides nothing.
  - Its only use would be discovery: registering the operator's MCP and x402 endpoint once, so that agent directories list it. That costs one `register()` transaction, which I did not measure.
- **Agent wallets** [S, 12; I]:
  - A prover agent needs a hot key only to send `claim` (gas) and `withdraw`.
  - The payee should be a cold address or a Safe (must-have 12 of the escrow specification).
  - An x402 payer agent needs a bounded USDC float. The `@x402/mcp` default cap of 1 USD per payment is a second guard [P, 16].
  - The key is never in the model context. A deterministic signer process holds it.
  - EIP-7702 is not needed.

## 5. Precedents

| Mechanism | What it shows | Tag, source |
|---|---|---|
| Succinct Prover Network (SP1) | Open provers compete in an auction and are paid per proof in PROVE. Live on 2026-11-10: 1,052 Groth16 proofs in 6 h, 12 provers. Needs SP1, not RISC Zero. | S, 25 (earlier research, reading the network's RPC) |
| Boundless (RISC Zero) | Open provers with collateral and reverse auctions. Paused indefinitely on 2026-11-05. | S, 25 |
| Olas Mech Marketplace | Agents pay other agents ("mechs") per request onchain, in native token, OLAS or USDC. The requester posts an IPFS hash with payment, and the mech watches events and delivers. A typical fee is about 0.01 USD on Gnosis. | P, 26 docs; S fee |
| ERC-8183 "Agentic Commerce" | Job escrow (Open → Funded → Submitted → Completed/Rejected/Expired). One evaluator address decides, and may be a contract. ERC-20 only. Optional hooks. Draft, created 2026-02-25. The provider is set by the client, so it is not an open race. | P, 27 |
| x402 Bazaar | Facilitator-hosted discovery of paid endpoints. | P, 1 |
| ProofBounty (this project) | An evaluator that is the Groth16 verifier itself. Payee bound inside the proof. Open race. Native ETH. | S, 13 |

**Reading of the precedents** [I]: the open-prover pattern this project needs is the Succinct/Boundless one, where proof verification decides payment and provers compete. Only ProofBounty reproduces it for RISC Zero on Arbitrum. ERC-8183 is the nearest standard. ProofBounty could be presented as an ERC-8183-like job whose evaluator is the verifier, but 8183's client-chosen provider and ERC-20-only budget do not fit an open race in native ETH.

## 6. Costs and yardsticks for a payment of 0.03 to 0.10 USD

Inputs:
- ETH = 2,064.61 USD (CoinGecko, 2026-11-10 14:00 UTC) [S, 25].
- Arbitrum One `eth_gasPrice` = 0x1341330 = 0.02019 gwei at block 523,107,621 [P, 18].
- The effective all-in price per gas is derived from the escrow specification's claim estimate, which includes the L1 data fee [S, 13]: 0.0000123 / 588,700 = **2.09e-11 ETH per gas**, and 0.0000136 / 588,700 = **2.31e-11 ETH per gas**.
- I apply that rate to other calls. That is an approximation, because the L1 data share differs by calldata size [I].

| Payment path | Who pays what | Cost of one payment | Share of 0.03 USD / 0.10 USD |
|---|---|---|---|
| x402 `exact`, USDC on Arbitrum One, CDP facilitator | Payer: a signature only. Seller: CDP fee 0 for the first 1,000 a month, then 0.001 USD [P, 4] | 0 to 0.001 USD | 0-3.3 % / 0-1 % |
| x402 `exact`, self-hosted facilitator on Arbitrum One or Sepolia | Seller pays the gas of `transferWithAuthorization`: about 70,000 gas, **an estimate, not measured** | 70,000 × 2.09e-11 to 2.31e-11 = 1.46e-6 to 1.62e-6 ETH = **0.0030 to 0.0033 USD** [I] | 10-11 % / 3 % |
| ProofBounty `post`, first deposit on a run | Poster pays 97,436 gas | 2.04e-6 to 2.25e-6 ETH = **0.0042 to 0.0046 USD** [I] | 14-15 % / 4.2-4.6 % |
| ProofBounty `post`, later deposit | 63,236 gas | 0.0027 to 0.0030 USD [I] | 9-10 % / 2.7-3 % |
| ProofBounty `withdraw` (prover) | 37,949 gas | 0.0016 to 0.0018 USD [I] | 5-6 % / 1.6-1.8 % |
| ProofBounty `refund` | 67,481 gas | 0.0029 to 0.0032 USD [I] | n/a |
| ProofBounty `claim`, human-style run, including settlement | About 588,700 gas | 0.0000123 to 0.0000136 ETH = **0.025 to 0.028 USD** [S, 13; I] | This is the settlement cost the operator pays anyway. It is not a fee of the escrow. |

On Arbitrum Sepolia, testnet gas has no value, so every row costs nothing in real money [S, 13].

**What a bounty must cover** [I, from the stated third-party GPU figures, not measured on this guest]:
- A segment is 2^20 = 1,048,576 cycles. One segment costs 0.57 s to prove plus 0.33 s of recursion = 0.9 s on an RTX 5090, plus about 2 s for the Groth16 wrap.

| Run | Segments | Seconds on an RTX 5090 | Cost, RunPod 5090 community at 0.69 USD/h | Cost, GCP g2 L4 at 0.7068 USD/h (time × 1.67 to 1.86) |
|---|---|---|---|---|
| Human, 18 M cycles | 18 | 18 × 0.9 + 2 = 18.2 | 0.0035 USD | 0.0060-0.0066 USD |
| Bot, 137 M cycles | 131 | 119.9 | 0.023 USD | 0.039-0.044 USD |
| Legal worst case, 2.9 billion cycles | 2,766 | about 2,491 (41.5 min) | 0.48 USD | n/a |

- **Minimum bounty for a human-style run**, for a third-party agent on a rented GPU kept busy: claim gas (0.025 to 0.028 USD) + withdraw (about 0.002 USD) + GPU (0.0035 to 0.0066 USD) = **about 0.031 to 0.037 USD**.
- **For a bot-sized run:** 0.025 to 0.028 + 0.002 + 0.023 to 0.044 = **about 0.050 to 0.074 USD**.
- **The legal worst case** costs 0.48 USD of GPU alone. That exceeds the 4 × runFee cap of 4 × 0.1032 = **0.41 USD**, so such a run can never be economic as a bounty.

Machine start-up, Groth16 setup loading, idle time and the home RTX 3060's speed are not included and are unmeasured. So the 0.03 to 0.10 USD band is about the floor for real third-party provers, not a comfortable margin.

## 7. Question A: an agent that proves through MCP

### 7.1 Workable architectures

**A1. A remote MCP server in front of the operator's prover** (Streamable HTTP).
- Tools:
  - `quote(run_id)`: replays the run locally (`execute-run`, no proof). It returns the cycle count, an estimated time and the current price (0 if free), and whether the run is qualified, late or already settled.
  - `prove(run_id, payee?)`: returns a `job_id`.
  - `status(job_id)`: returns the state, the seal (260 bytes), the public values and, once settled, the transaction hash.
  - Optionally `settle(job_id)`.
- Built as handles the server issues and the client polls, as the 2026-07-28 changelog recommends. The Tasks extension can be added later.
- **The tool takes only a `run_id`.** The server rebuilds the run file from chain data: the journals from the `commitRun` calldata, the nonce from the reveal, and the levels from the season. This is README §7.5's own rule [P, 14].
- A player's agent, or a browser dApp through the same backend, can call it. Auth is optional, because payment and proof checks do not depend on who calls. Use rate limits per IP or per run [I].

**A2. A local stdio MCP server wrapping `zk-host`**, for a player or third-party agent that owns an NVIDIA GPU.
- Tools: `execute_run`, `prove_run(run_id, payee)`, `job_status`, `submit_claim(run_id)`.
- The server process holds the RPC URL and the hot key from its environment, as stdio authorization recommends [P, 10].
- Prerequisites:
  - x86-64 Linux, an NVIDIA GPU, and CUDA 12.8 or newer.
  - The 2.34 GB Groth16 component.
  - A build at the fixed absolute path, so that the image id matches the one onchain.
- Distribution as an MCP Registry entry is possible, with a package pointing at a container image [P, 22]. The image must reproduce the image id: check it with `zk-host image-id` before every job [I].

**A3. The owner's agent supervising the home prover.** This is A2 used by the operator's own agent, with the escrow specification's scheduling rules (C4): obligations first, then bounties by value per GPU-second, polling `bountyOf`, and killing the job when the bounty is paid.
- The agent decides **what** to prove.
- A deterministic script decides **whether** a claim is safe: an `eth_call` of `verifyRun`, a gas-floor check, and caps.
- The script, not the model, signs.

### 7.2 What MCP adds and what it does not
- **Adds** [I]:
  - A standard, discoverable interface that any agent host can call without custom glue.
  - A job and polling pattern for 2 to 15 minute work.
  - A place to put x402 pricing if wanted (section 2.4).
  - Registry listing for discovery.
- **Does not add:**
  - Payment: x402 or the escrow does that.
  - Trust: the contract checks the proof.
  - Delivery guarantees: a server can still refuse, and permissionless re-proving remains the fallback (README §7.5).
  - Speed: the GPU decides.
- MCP authorization is about access control to the server, not about money [P, 10].

### 7.3 Security rules [I, from 12, 13, 14]
1. **No signing key in the model context**, ever. The key lives in the MCP server process or a separate signer. Tools that move funds (`submit_claim`, `withdraw`) enforce caps in code and print the amount, destination and gas. On a public deployment they are not callable by a remote client at all.
2. **Journals are attacker-chosen bytes.** Never accept journals, levels or nonces from a tool argument. Rebuild them from chain data by run id, and check them with `check_levels` and RUN_FIELDS against chain state (C5).
   - Run the replay under the cycle cap and the per-run limits of C4: a legal run can cost up to about 2.9 billion cycles.
   - Treat any text in tool results (status messages, errors) as data. A run file cannot carry instructions to the model, because the model never sees it.
3. **A deterministic script on the proving path.** The LLM may schedule and report. The build, image-id check, proof, `eth_call` pre-check and claim are a fixed program with fixed arguments. A model error then costs a missed job, never a wrong transaction.
4. **Payee binding.** `prove(run_id, payee)` must use a checksummed payee (C6). A remote server must not let a caller set the payee of a proof the operator paid to make, unless that is the service sold (section 8.3).
5. **Denial of service.** `prove` is expensive. Use per-run deduplication (one job per run id), per-caller rate limits, and a `quote` gate that refuses late, unqualified or non-improving runs (C16).

### 7.4 How each shape composes with ProofBounty
- **A1, operator server:**
  - Free use: the operator proves with its own payee and settles through `claim`, collecting any bounty on the run. The player only had to ask, or post a bounty to move up the queue.
  - Paid use: see section 8.3.
- **A2, third-party agent with a GPU:** the agent watches `BountyPosted` events or polls `bountyOf`, proves with its own payee, and calls `claim`. It is paid only if its proof is valid and first. This is the "agents as bounty hunters" path, with no x402 involved.
- **A3, owner's agent:** the same as A2, plus the operator's obligations first.

## 8. Question B: x402 as a bounty mechanism

### 8.1 Why x402 alone is not a bounty

| Property | x402 (`exact` / `upto`) | ProofBounty escrow |
|---|---|---|
| Direction of payment | Client pays the server it called [P, 1] | Anyone deposits; the contract pays whoever presents a valid proof [S, 13] |
| Who chooses the prover | The client, before the work (one URL) | Nobody: an open race, first valid claim wins |
| Payment vs delivery | Default `authorization`: verify → work → **settle → respond**. The client pays before it can check the proof itself. `exact` has no refund [P, 1, 17] | Atomic: payment happens in the same transaction that verifies the Groth16 proof onchain |
| Account or registration | None, only a signature [P, 1] | None, only a transaction |
| Discovery | Bazaar `/discovery/*`, directories [P, 1, 15] | Onchain events (`BountyPosted`), readable by any agent; the dApp shows them |
| Currency | ERC-20 through EIP-3009 or Permit2; in practice USDC (99.6 % of volume) [P, 4, 19; S, 20] | Native ETH, the same unit as the run fee and pot (README §8) |
| Chain | Arbitrum One through CDP; no hosted facilitator on Arbitrum Sepolia [P, 4, 11] | Any chain where the contract is deployed; testnet first |
| Cost per payment (0.03 to 0.10 USD) | 0 to 0.001 USD (CDP), or about 0.003 USD of gas when self-hosted [I] | About 0.004 USD to post + about 0.002 USD to withdraw [I]; the claim's gas is the settlement the operator pays anyway |
| Trust | Client trusts the server to deliver a valid proof after payment; server trusts the facilitator; CDP adds KYT/OFAC checks [P, 5] | Trusts only the verifier contract and the immutable escrow code (unaudited, capped per run) |
| Refund | `exact`: none. `auth-capture` has void, refund and reclaim decided by the server, and its contracts are not on Arbitrum [P, 17, 18] | Automatic refund after the settlement end or the emergency stop |
| Copy protection | n/a | Payee inside the proof; a copied proof pays the original prover |

**Conclusion** [I]: x402 is a checkout for a service that a client chose. It cannot express "pay whoever proves first". It cannot hold money until a proof exists without a custom escrow contract. On Arbitrum that contract would have to be written anyway, and it would be ProofBounty. Its currency also differs from the game's.

### 8.2 Could x402's `auth-capture` with a custom operator be the bounty?
- In principle a `"custom"` operator contract could release funds on a valid proof [P, 17].
- But the client signs a hold toward one resource server, and the commerce-payments contracts are absent on Arbitrum [P, 18].
- The tokens are ERC-20.
- The open race would have to be added inside the custom operator. That operator would then be a ProofBounty paid in USDC with extra layers [I].
- **Not recommended.**

### 8.3 Combinations that make sense
1. **An x402-priced proving endpoint** (HTTP or MCP, `exact` or `upto`, USDC on Arbitrum One through CDP). A player's agent pays per proof. To close the gap between "paid" and "valid", the server, in the `authorization` flow:
   1. verifies the payment;
   2. proves;
   3. checks `verifyRun` with an `eth_call`, and optionally settles the run onchain itself (the credit goes to the player anyway, README §7.5);
   4. only then settles the x402 payment and returns the seal and transaction hash.

   If proving or the check fails, the handler returns `isError` and `@x402/mcp` cancels settlement [P, 16].
   - Limits:
     - The work time must fit inside `maxTimeoutSeconds`, and the MCP call must stay open, because `@x402/mcp` does not support Tasks. For more than a few minutes, sell it over HTTP with a job id. The other option is a priced `prove` that starts the job: `upto` settled at the end, which still needs the call open.
     - It needs USDC, while players hold ETH.
     - No Arbitrum Sepolia without a self-hosted facilitator.
   - **Mainnet only, optional.**
2. **x402 for quotes and status.** Not worth it: these are cheap reads, and charging for them adds friction without protecting anything that rate limits cannot protect [I].
3. **Agents as bounty hunters on the escrow** (A2 above). This is the bounty for autonomous agents. It needs no x402, no ERC-8004 and no account, only a GPU, ETH for gas and the published build. **Recommended.**
4. **Discovery through a registry.** List the remote MCP server in the MCP Registry [P, 22]. Optionally register an ERC-8004 identity on Arbitrum One with `services: [MCP]` and `x402Support` [P, 23, 24]. Bounty hunters need neither: the contract's events are the discovery.

## 9. Recommendation and what each piece would take

**Recommendation** [I]:
- Do not make x402 the bounty mechanism. Keep ProofBounty as the open, proof-paid path, and present it to agents as "watch these events, prove with your payee, call `claim`".
- Add MCP as a thin interface in this order:
  1. a local stdio MCP wrapper that the owner's supervising agent uses;
  2. the same wrapper published for third-party GPU owners;
  3. a remote MCP endpoint (quote, prove, status), free and rate-limited, run by the operator.
- Consider x402 pricing only on mainnet, after O14 (the economics of verification against the rake) is settled, and only as the "prove, check onchain, then charge" endpoint.
- Skip ERC-8004 unless agent-directory listing becomes a goal.
- Everything waits on M5.8, the GPU measurement on the owner's card.

**Effort** (plan §1.1 sizes; estimates):

| Piece | Size | Depends on | Content |
|---|---|---|---|
| Local MCP wrapper (stdio) | S | M5.8 (measured `zk-host` with cuda and `execute-run`) | About 4 tools around `zk-host` and `execute-run`; chain rebuild by run id; deterministic claim script with caps; key from the environment; tests with dev-mode proofs |
| Third-party prover kit | M | M5.10 ProofBounty, M5.13 tooling | Container or build script at the fixed path, image-id self-check, event watcher, `claim`/`withdraw`, docs/PROVER.md, a registry entry |
| Remote MCP endpoint | M | M5.8, M5.11 prover loop | Streamable HTTP server; job ids and polling (Tasks optional); dedup and rate limits; refusal of late, unqualified or non-improving runs; no keys reachable from tools; uptime monitoring |
| x402 pricing on the endpoint | S to M | Remote endpoint; mainnet decision; CDP account | `@x402/mcp` or `@x402/express` 2.30.0; USDC on `eip155:42161`; `exact` or `upto`; `eth_call` check before settle; spend docs. Arbitrum Sepolia needs a self-hosted facilitator (+S). |
| ERC-8004 registration | XS | Remote endpoint | Registration JSON with `services` and `x402Support`; one `register()` on Arbitrum One; `/.well-known/agent-registration.json` |

## 10. Could not verify
- The real gas of `transferWithAuthorization` on Arbitrum One. I used 70,000 gas as an estimate.
- Whether any hosted x402 facilitator other than CDP really serves Arbitrum One today, and whether any serves Arbitrum Sepolia. Only third-party listings claim the first.
- Which MCP host applications support the Tasks extension. The official matrix cells were empty in my read.
- Which protocol revision `@modelcontextprotocol/sdk` 1.32.2 implements.
- The current Validation Registry deployment of ERC-8004 on Arbitrum One. No code was found at the address third parties give.
- Any proving time on this guest or on the RTX 3060 or 5060 Ti. All GPU figures are third-party, for other cards.
- x402 volumes for October and November 2026 from a primary source. The figures I found are dated 2026-09-09 (TRM) or ambiguous.

## 11. Sources (all read 2026-11-10)
1. x402 Protocol Specification v2: https://raw.githubusercontent.com/x402-foundation/x402/main/specs/x402-specification-v2.md (version history v2.0, 2025-12-09) [P]
2. x402 `exact` scheme and EVM binding: https://raw.githubusercontent.com/x402-foundation/x402/main/specs/schemes/exact/scheme_exact.md and …/scheme_exact_evm.md [P]
3. x402 MCP transport: https://raw.githubusercontent.com/x402-foundation/x402/main/specs/transports-v2/mcp.md [P]
4. Coinbase CDP x402 network support: https://docs.cdp.coinbase.com/x402/network-support.md [P]
5. x402 facilitator directory: https://docs.x402.org/dev-tools/facilitators [P]
6. MCP versioning, 2026-07-28 changelog: https://modelcontextprotocol.io/specification/versioning and https://modelcontextprotocol.io/specification/2026-07-28/changelog [P]
7. Coinbase CDP, MCP payments (seller): https://docs.cdp.coinbase.com/x402/seller/mcp-payments.md [P]
8. MCP Tasks extension overview: https://modelcontextprotocol.io/extensions/tasks/overview; AAIF blog of 2026-08-28: https://aaif.io/blog/handle-long-running-mcp-tool-calls-with-the-mcp-tasks-extension [P; S]
9. MCP extension client matrix: https://modelcontextprotocol.io/extensions/client-matrix [P]
10. MCP authorization 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization [P]
11. Public x402.org facilitator `GET /supported`: https://x402.org/facilitator/supported [P, live read]
12. Committed ethskills copies: .claude/skills/{standards,tools,wallets,concepts}/SKILL.md [S, undated]
13. ProofBounty final specification: scratchpad/escrow/final.md (2026-11-10) [S]
14. Repository README §7.1, §7.2 and §7.5: README.md [P]
15. x402 repository: https://github.com/x402-foundation/x402 (no releases; specs, schemes and extensions listings) [P]
16. npm registry: `@x402/core`, `@x402/evm` and `@x402/mcp` 2.30.0 (2026-11-04); `@modelcontextprotocol/sdk` 1.32.2 (2026-10-23); `@x402/mcp` README and dist code from https://registry.npmjs.org/@x402/mcp/-/mcp-2.30.0.tgz [P]
17. x402 `auth-capture`, `upto` and `batch-settlement` schemes: https://raw.githubusercontent.com/x402-foundation/x402/main/specs/schemes/{auth-capture,upto,batch-settlement}/ [P]
18. My RPC reads through https://arb1.arbitrum.io/rpc and https://sepolia-rollup.arbitrum.io/rpc: `eth_getCode` of the ERC-8004 registries, the commerce-payments escrows and the collector; USDC `name`, `version` and `TRANSFER_WITH_AUTHORIZATION_TYPEHASH`; `eth_gasPrice` 0.02019 gwei at block 523,107,621 [P]
19. x402 network and token support: https://docs.x402.org/core-concepts/network-and-token-support.md [P]
20. TRM Labs, "Who's actually paying: measuring AI agent payments onchain" (2026-09-09): https://www.trmlabs.com/trm-tech-blog/whos-actually-paying-measuring-ai-agent-payments-onchain [S]
21. x402.org home page: https://www.x402.org/ [P]
22. MCP Registry (preview): https://modelcontextprotocol.io/registry/about [P]
23. ERC-8004 (Draft, 2025-08-13): https://eips.ethereum.org/EIPS/eip-8004 [P]
24. ERC-8004 contracts README: https://raw.githubusercontent.com/erc-8004/erc-8004-contracts/main/README.md [P]
25. Earlier research: scratchpad/research/proof-services.md and risc0-gpu.md (2026-11-10; ETH price, Succinct, Boundless, GPU figures, RunPod and GCP prices) [S]
26. Olas mech client and marketplace docs: https://stack.olas.network/mech-client and https://olas.network/mech-marketplace; fee from https://rnwy.com/learn/olas-mech-marketplace-agent-data [P; S]
27. ERC-8183 Agentic Commerce (Draft, 2026-02-25): https://eips.ethereum.org/EIPS/eip-8183 [P]
