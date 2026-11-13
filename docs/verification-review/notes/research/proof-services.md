# Proof markets and hosted provers a browser dApp can call

Research report, written 2026-11-10 (all pages and endpoints read between 13:50 and 14:25 UTC that day).

Question: if the proof stays a zkVM proof, what is the lightest way for a player, from the browser and with no installed software, to get it produced on demand, and what does it cost and depend on?

Every fact is tagged **[P]** primary source (official docs, source code, a deployed contract, a network's own API, read by me today), **[S]** secondary source (press, third-party measurements) or **[I]** inference (my arithmetic or reasoning from tagged facts). "Project record" means a measurement already written in the repository's `docs/VERIFICATION.md` or `README.md`; I did not redo those. Nothing was proven here and no request was sent to any market: every network call I made was a read. Sources are numbered in section 11, each with its URL and date.

Reference prices used for conversions [P, source 30, CoinGecko, 2026-11-10 14:00 UTC]: ETH 2,064.61 USD, PROVE 0.1676 USD. The run fee of 0.00005 ETH is therefore **0.1032 USD**.

## 0. The facts that decide the answer

1. **Boundless, the only market for RISC Zero proofs, has stopped.** The Boundless Foundation announced on 2026-11-03: "Boundless ZK proving operations will pause indefinitely", and "November 5, 2026: New proof requests and proving reward claims end" [P, source 1]. On Base, the market contract's last `RequestFulfilled` event is at 2026-11-03 11:00:13 UTC; since then it has emitted only deposits and withdrawals [P, my scan, source 4]. The 111 requests sent to its order stream from 2026-11-04 to 2026-11-08, by 12 different clients, all expired without a lock, although half of them offered 0.000067 ETH or more [P, Boundless indexer, source 3]. The price in the project's documents (0.0000184 ETH per proof) was read on 2026-11-02, the market's second-to-last day. **Today no hosted service sells a RISC Zero 3.0 Groth16 proof** that I could find (section 4).
2. **The RISC Zero proof itself still works.** The prover is open source, the 3.0 verifier is still routed and not stopped on Arbitrum One and Arbitrum Sepolia (checked today, source 5), and the image id and seal do not depend on who proves. What is gone is the place to buy the proof.
3. **The Succinct Prover Network (SP1) is alive and deep.** In the 6 hours before 14:07 UTC today it fulfilled 1,052 Groth16 requests, with 9 unfulfillable and none expired; 12 prover addresses from 5 named operators; 21 requesters [P, the network's own RPC, source 7]. Groth16 requests of 98.5 million PGU (102.5 million cycles, this project's size) were fulfilled in 46 to 106 s for about 0.468 PROVE, **0.078 USD, 76% of the run fee** [P data, I conversion]. It needs SP1, not RISC Zero: a zkVM switch that the repository already trialled (all four checks passed, project record).
4. **A browser can reach the Succinct network without a backend, but nobody ships the client.** Its RPC answers gRPC-web with open CORS, and requests are signed with EIP-191 (`personal_sign`) [P, my probe and the SDK source, sources 8 and 9]. There is no JavaScript or TypeScript SDK on npm for it, nor for Boundless [P, source 10]. Payment is in PROVE deposited on Ethereum mainnet, so in practice the operator funds the account [P, sources 11 and 12].
5. **Verification layers do not help here.** Aligned takes only SP1 compressed proofs and settles only on Ethereum mainnet, within a 24-hour window [P, source 17]. zkVerify has a contract on Arbitrum One, but its aggregation roots are written by an `OPERATOR` role, "the zkVerify authorized relayer", with no cryptographic check: validity would rest on a trusted signer [P, source 19].
6. **One rented GPU proves a run in minutes.** Unmodified RISC Zero 3.0.6 with `cuda` on an RTX 5090: 565.8 ms per 2^20-cycle segment, and 12.67 s for a whole Groth16 proof of a benchmark [S, source 22]. For 1e8 cycles that gives about 1.5 to 3 minutes on one RTX 4090 or 5090 [I]. At RunPod's prices of today that is about 0.012 to 0.017 USD per proof on a pod kept busy, and about 0.06 to 0.08 USD on a scale-to-zero serverless worker [P prices, source 24; I product].

**Conclusion in one paragraph.** To keep the current proof, the lightest credible path is no longer a market: it is the project's own prover, packaged so that anyone can run it, and exposed as a stateless HTTPS endpoint on a scale-to-zero GPU. The browser sends a run id, gets a 260-byte seal about 2 to 4 minutes later, and the player settles from the wallet they already have on Arbitrum. The contract still checks a validity proof, no token or second chain is involved, and the operator stops being the only possible prover because the same image and any NVIDIA card of 16 GB or more produce the same seal. What this does not give is a second prover that shows up by itself: for that, the only live market is Succinct's, at the price of moving the guest to SP1 and holding PROVE on Ethereum.

## 1. The yardstick

| Quantity | Value | Source |
|---|---|---|
| Work per run | 70 to 137 million zkVM cycles; heaviest run 136.4 million proving cycles on RISC Zero, 119.5 million PGU on SP1 | project record |
| Run fee | 0.00005 ETH = 0.1032 USD today | README; source 30 |
| Onchain verification | 227,591 gas for RISC Zero's Groth16 `verify`; at Arbitrum One's 0.02 gwei today that is 0.0000046 ETH, 0.009 USD, before the L1 data fee | project record; gas price source 31 |
| What needs a proof | each player's best run of a season, not every run | README |

The last row matters for every price below: the proving bill grows with the number of players, not of runs. A player who buys ten runs pays 0.0005 ETH and needs one proof.

## 2. Boundless (RISC Zero's market)

### 2.1 What it was, as documented

| Question | Answer | Tag, source |
|---|---|---|
| Chains hosting the market | Base mainnet (`BoundlessMarket` `0xfd152dadc5183870710fe54f939eae3ab9f0fe82`, order stream `https://base-mainnet.boundless.network`) and Taiko mainnet (`0xb3f5c7b4379052eade8c7f3fa6da37fb871da28b`, `https://taiko-mainnet.boundless.network`). Ethereum mainnet holds only a verifier and the ZKC token. No market on Arbitrum. | P, source 2 |
| SDK | Rust only: "The Boundless Market SDK offers high-level Rust APIs". Latest crate `boundless-market` 2.0.1 of 2026-06-02. No package under `@boundless-xyz` or `@risc0` for requests on npm. | P, sources 2, 10, 29 |
| REST or order-stream API | Yes: `POST /api/v1/submit_order` with an EIP-712-signed request, `GET /api/v1/orders`, `GET /api/v1/nonce/<address>`, and a WebSocket `/ws/v1/orders` with Sign-In-with-Ethereum auth. Offchain orders cost no gas but need a deposit in the market first. | P, sources 2, 6 |
| Callable from a browser | Not as deployed: `GET /api/v1/nonce/...` answers 200 with no `access-control-allow-origin` header, and an `OPTIONS` preflight on `/api/v1/orders` answers 405. A dApp would have needed its own proxy. | P, my probe, 2026-11-10 14:10 UTC |
| Program at a public URL | Yes: "Provers must be able to access your guest program via a publicly accessible URL". Programs and inputs under 50 MB; journals delivered onchain under 10 KB. Storage through Pinata (IPFS), S3 or GCS. | P, source 2 |
| Who pays, in what | The requester, in ETH on the market's chain (deposit, or value sent with an onchain request). Provers lock ZKC collateral. A "smart contract requestor" (ERC-1271) could pay for requests that third parties submit. | P, source 2 |
| Raw Groth16 seal | A request option (`with_groth16_proof()`); the default is a Merkle inclusion in an aggregated set. "If you need cross-chain verification or raw proof data, use Groth16." | P, source 2 |

### 2.2 The pause

- **Announcement** [P, source 1, Boundless Foundation blog, dated 2026-11-03]: "As ZKC's role shifts to AI access, Boundless ZK proving operations will pause indefinitely." Key dates: "November 5, 2026: New proof requests and proving reward claims end. Provers must claim outstanding eligible rewards before this date." "November 30, 2026: The Explorer UI goes offline." FAQ: "Proving operations pause indefinitely from November 5, 2026, and the protocol's source code stays publicly available."
- **Press** [S, sources 27 and 28, 2026-11-04]: TokenPost, "Boundless Plans AI Credits for ZKC Stakers as ZK Protocol Pauses"; BlockBeats through KuCoin, "Boundless's ZK proof service will be suspended indefinitely starting November 5, 2026."
- **Repository** [P, source 6]: the last commits on `boundless-xyz/boundless` `main` are "BM-3116: Pause order generators and mute producer alarms (#2079)" and "BM-3117: Pin shutdown images and refresh pipeline GitHub credential (#2081)" on 2026-10-28, then "BM-3120: Remove nightly CI workflows (#2083)" and "BM-3121: Disable sunset alarms and distributor scheduling (#2084)" on 2026-11-05.
- **Onchain** [P, source 4, my scan of `0xfd152dad...fe82` on Base, blocks 53,400,000 to 55,642,644, through `base-rpc.publicnode.com`]:

  | Day (UTC) | RequestSubmitted | RequestLocked | RequestFulfilled | ProofDelivered | Deposit | Withdrawal | CollateralDeposit | CollateralWithdrawal |
  |---|---:|---:|---:|---:|---:|---:|---:|---:|
  | 2026-11-02 (from 03:16) | 128 | 129 | 129 | 129 | 6 | 8 | 0 | 0 |
  | 2026-11-03 | 76 | 76 | 77 | 77 | 44 | 3 | 0 | 1 |
  | 2026-11-04 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
  | 2026-11-05 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 1 |
  | 2026-11-06, 11-07 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
  | 2026-11-08 | 0 | 0 | 0 | 0 | 1 | 2 | 0 | 0 |
  | 2026-11-09 | 0 | 0 | 0 | 0 | 0 | 11 | 0 | 6 |
  | 2026-11-10 (to 14:00) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

  The last `RequestFulfilled` is in block 53,457,133, 2026-11-03 11:00:13 UTC. Event names come from `IBoundlessMarket.sol`: `RequestFulfilled`, `Deposit`, `Withdrawal`, `CollateralDeposit` and `CollateralWithdrawal` are matched by the keccak of their signatures; `RequestSubmitted`, `RequestLocked` and `ProofDelivered` by the block numbers the indexer gives for the last request's submit, lock and fulfil transactions.
- **Indexer** [P, source 3, `d2mdvlnmyov1e1.cloudfront.net`, read 13:52 to 13:56 UTC]:
  - Week from 2026-11-02: 336 requests submitted (224 onchain, 112 offchain), 225 fulfilled, 111 expired, 2 provers, 14 requesters, 0.00929 ETH of fees locked. Week from 2026-11-09: zero on every line. `eligible_prover_count` 124, `active_eligible_prover_count` 0. The indexer is live: its `last_indexed_block` was 71 blocks behind Base's head.
  - By day of creation, over the latest 500 requests: 2026-11-01 163 fulfilled and 1 expired; 11-02 149 fulfilled; 11-03 76 fulfilled; 11-04 53 expired; 11-05 4 expired; 11-06 34 expired; 11-08 20 expired. All 111 expired requests are offchain, from 12 clients, 110 of them for a raw Groth16 seal, and none was ever locked. Their maximum prices have a median of 0.000067 ETH and reach 0.00067 ETH, 13 times the run fee; the newest (2026-11-08 18:06 UTC) offered up to 0.0000449 ETH. So it is not only Boundless's own provers that stopped: no third party picked the orders up.
- The order-stream health endpoints still answer 200 on both chains, and `docs.boundless.network` and RISC Zero's remote-proving page carry no notice [P, my probes; sources 2 and 23]. A developer reading only the docs would not learn that the market is closed.

### 2.3 What the market delivered in its last three days

From the indexer's request list [P, source 3], fulfilled requests created 2026-11-01 to 2026-11-03, raw Groth16 seals (selector `73c457ba`), 50 to 250 million total cycles (n = 235, all `ClaimDigestMatch`, all from one requester, `0x7276fa3c...19c9`, two provers):

| Day | Requests | Lock price p10 / p50 / p90 (ETH) | Created to fulfilled p10 / p50 / p90 |
|---|---:|---|---|
| 2026-11-01 | 93 | 0.0000142 / 0.0000142 / 0.0000189 | 110 / 380 / 724 s |
| 2026-11-02 | 84 | 0.0000141 / 0.0000187 / 0.0000191 | 102 / 170 / 942 s |
| 2026-11-03 | 58 | 0.0000190 / 0.0001183 / 0.0001189 | 144 / 164 / 942 s |

- Over the three days: lock within 22 s (median), proof delivered within 198 s (median), 942 s at p90; the indexer's `effective_prove_mhz` has a median of 0.96 MHz. Boundless's own auction guide assumes "an average market execution speed of 30MHz and an average market proving speed of 1MHz" [P, source 2].
- On the last day the median price for this size rose sixfold, to 0.000118 ETH, 2.4 times the run fee.
- **Depth:** two provers fulfilled everything (`0x8252c632...2ec8` 309 of 388, `0xa6c2cc7c...a024` 79). The requester behind 381 of the 388 fulfilled requests fetched its programs from a bucket named `boundless-s3-bucket-d87297d6f2`, which, with the commit "Pause order generators", suggests it was Boundless's own load generator [I]. The price the project recorded was therefore the price of mostly synthetic demand served by two provers.

### 2.4 What remains of RISC Zero

- `risc0-zkvm` 3.0.6 (2026-07-17) is still the latest stable release; 3.1.0-rc.1 is dated 2026-10-30 [P, source 29]. The last commits on `risc0/risc0` `main` are of 2026-10-24 and 2026-10-26 (CI moved to GitHub-hosted runners; rzup downloads moved to `artifacts.risczero.net`), after a gap since 2026-07-20 [P, source 21]. No statement on the zkVM's maintenance was found.
- Arbitrum One, block 522,999,198, and Arbitrum Sepolia, block 327,893,403 [P, source 5, my `eth_call`s]: the router `0x0b144e07a0826182b6b59788c34b32bfa86fb711` still returns the emergency-stop wrapper for selector `0x73c457ba` (`0x9f9994eb...e696` and `0x724d375b...7797`), and `paused()` is false on both. The wrapper's `owner()` on Arbitrum One is `0xf616a4f8...d412`; the router's owner is the timelock `0xdc986a09...1d15`.
- **Risk** [I]: a season that settles through that wrapper depends on a guardian key held by a team that has left proving. The same goes for the download hosts of the toolchain and of the Groth16 prover (`artifacts.risczero.net`, Docker Hub). Both can be removed as dependencies: a referee can point at its own copy of `RiscZeroGroth16Verifier` (1,185,417 gas to deploy, project record), and the pinned artifacts can be mirrored.

## 3. Succinct Prover Network (SP1)

All figures in this section are from the network's public RPC `https://rpc.mainnet.succinct.xyz`, called without a key on 2026-11-10 between 13:58 and 14:08 UTC [P, source 7], or from SP1 SDK v6.10.0's source [P, source 8]. Scripts are in `research/work/proof-services/` (`spn.py`, `spn_requests.py`, `spn_analyze.py`).

| Question | Answer | Tag |
|---|---|---|
| Where the market lives | An offchain auction run by the network (the SDK calls it a vApp), settled to `SuccinctVApp` on Ethereum mainnet. Proofs come back to the requester offchain and verify on any chain with an SP1 gateway. | P, sources 11, 12 |
| Arbitrum One | Groth16 gateway `0x397A5f7f3dBd538f23DE225B51f532c34448dA9B` on Arbitrum One (42161) and Arbitrum Sepolia (421614); the gateways "officially support proofs using SP1 circuit version v6.1.0 (Hypercube)". | P, source 13 |
| SDK | Rust (`sp1-sdk` 6.10.0 of 2026-10-23, a release about every two weeks). No JavaScript or TypeScript SDK: no package named `@succinctlabs/...` or `sp1-sdk` on npm. | P, sources 10, 29 |
| Wire protocol | gRPC. The mainnet RPC also answers **gRPC-web** (`content-type: application/grpc-web+proto`) and its CORS preflight returns `access-control-allow-origin` for an arbitrary origin, with methods `GET,POST,OPTIONS` and the header `x-grpc-web` allowed. | P, my probe |
| Signing | Every request is a protobuf body signed with the requester's secp256k1 key by "Sign an arbitrary message per EIP-191", which is what a browser wallet's `personal_sign` does. Creating an input artifact signs the fixed text `create_artifact`. | P, source 8 |
| Program at a public URL | No. The ELF and the input are uploaded to the network's artifact store through a presigned URL. Inputs are public unless a TEE mode is used; this project's inputs are public anyway. | P, source 8 |
| Who pays, in what | The requester, in PROVE (ERC-20 on Ethereum mainnet), deposited into `SuccinctVApp`; minimum deposit 0.01 PROVE (project record, 2026-10-31). The explorer has a "Transfer" between network accounts. No ETH, stablecoin or card option in the docs. | P, sources 11, 12 |
| Limits | Maximum 1 trillion PGU and 24 hours per request; core-mode proofs are rejected. | P, source 12 |
| Trust | The result is an SP1 Groth16 proof checked by the gateway's verifier on Arbitrum: still a validity proof. | P, source 13 |

### 3.1 Price today

| Parameter | Value |
|---|---|
| Base fee, Groth16 or PLONK | 0.447227 PROVE (0.0750 USD) |
| Base fee, compressed | 0.298151 PROVE (0.0500 USD) |
| Quoted market price per PGU (`GetMarketPricePerPgu`, as of 13:40 UTC) | 715,563,506 PROVE-wei, 0.716 PROVE per billion PGU |
| Default maximum price per PGU | 710,000,000 PROVE-wei |
| Network floor per PGU | 240,000,000 PROVE-wei |
| PROVE price (`GetProvePrice`) | 0.1677 USD, -4.55% over 24 h |

Both fees track the dollar: on 2026-10-31 the project read 0.363372 PROVE and 581,395,348 PROVE-wei with PROVE at 0.2076 USD, the same 0.075 USD and 0.12 USD per billion PGU [I].

**Realized price.** All 1,000 fulfilled Groth16 requests I read cleared at 240,000,000 PROVE-wei per PGU, the floor, not at the quoted market price [P]. So:

| Proof | PGU | Cost | Against the run fee |
|---|---:|---|---:|
| Observed Groth16 requests of this size (six of them, 09:01 to 12:46 UTC) | 98.5 million | 0.464 to 0.469 PROVE, 0.078 USD, 0.0000380 ETH | 76% |
| The project's heaviest run, at the floor | 119.5 million | 0.472 PROVE, 0.079 USD, 0.0000383 ETH | 77% |
| The same, at the quoted market price | 119.5 million | 0.533 PROVE, 0.089 USD, 0.0000433 ETH | 87% |

The base fee is 94% of the price: a level and a run cost almost the same.

### 3.2 Latency and depth today

Fulfilled requests, by size, created 08:19 to 13:59 UTC (Groth16) [P]:

| Mode, size in PGU | Requests | Created to fulfilled p10 / p50 / p90 | Fulfillers | Requesters |
|---|---:|---|---:|---:|
| Groth16, under 20 million | 476 | 32 / 44 / 77 s | 12 | 14 |
| Groth16, 20 to 60 million | 71 | 29 / 40 / 63 s | 8 | 5 |
| **Groth16, 60 to 250 million** | **63** | **44 / 71 / 112 s** | **12** | **3** |
| Groth16, 250 million to 1 billion | 27 | 37 / 53 / 94 s | 10 | 4 |
| Groth16, over 1 billion | 363 | 101 / 160 / 347 s | 10 | 2 |
| Compressed, 60 to 250 million (05:37 to 13:58) | 228 | 17 / 24 / 47 s | 11 | 3 |

- **Volume:** 1,000 Groth16 proofs in 5.7 hours (about 4,200 a day), 1,000 compressed in 8.4 hours (about 2,900 a day), 500 PLONK in 14.3 hours (about 840 a day) [P data, I rates].
- **Failure rate, Groth16, last 6 hours:** 1,052 fulfilled, 9 unfulfillable, 6 in progress, none expired.
- **Provers:** 12 addresses named Alan 1 to 3, ZAN and ZAN 2, Mintair 1 to 3, Aoraki 1 to 3 and Succinct Labs 1: five operators.
- **Requesters:** 21 for Groth16 in the window. The largest carry labels ("TRUE Trading", "[Prod] Alpen v6 9", "[Prod] Interchain"); unnamed accounts with 40 to 80 requests each are served too.

### 3.3 Three ways to use it, lightest first

1. **Operator relay.** A small stateless function holds a requester key with a capped PROVE balance. The browser posts a run id; the function rebuilds the run from chain data, submits the request, and returns the proof; the player (or the function) calls `settleRun`. The operator pays but does not prove, and anyone else with PROVE can request the same proof. Needs Rust (`sp1-sdk`) on the server side only.
2. **Player's own account, from the browser.** Technically open today (gRPC-web, CORS, EIP-191) [P], but it needs a hand-written TypeScript client generated from the protobuf definitions, a wallet prompt that shows raw bytes, and PROVE in the player's network account. The operator could fund that account with the network's internal transfer. No one publishes such a client; I found no example [I].
3. **Player buys PROVE.** A deposit is an Ethereum mainnet transaction: about 150,000 gas, 0.000037 ETH (0.075 USD) at today's 0.24 gwei [I, gas price source 31], on a chain the player does not otherwise use, for a token the player does not otherwise hold. Not credible for an arcade game.

### 3.4 What switching to SP1 costs (project record, 2026-10-31)

SP1 v6.10.0 reproduced 75 of 75 vectors in its executor, with 119.5 million PGU for the heaviest run and a mock round trip in 7.8 s. A CPU proof did not fit in 13.4 GiB, so every real SP1 proof would come from the network or from a GPU with 24 GB of VRAM [P, source 14: "We recommend GPUs with at least 24 GB VRAM"; Groth16 wrapping "requires roughly 14GB of memory"]. Verification gas is about the same (234,718 in SP1's own test).

## 4. Hosted proving APIs

No service in this table sells a RISC Zero 3.0 proof to a self-serve customer today.

| Service | State on 2026-11-10 | zkVMs | Self-serve API | Fit | Tag, source |
|---|---|---|---|---|---|
| Bonsai (RISC Zero) | "No longer available" since December 2025 (project record). `bonsai-sdk` 1.4.3 (2026-07-17) still exists as the client for Bento's API. | RISC Zero | closed | no | P, sources 2, 29 |
| Boundless | Paused indefinitely since 2026-11-05 (section 2). | RISC Zero | closed | no | P, source 1 |
| Succinct Prover Network | Live (section 3). | SP1 only | yes, with a funded key | possible, after a zkVM switch | P, source 7 |
| Succinct reserved capacity | "Succinct and trusted proving partners", contractual service levels; access by contacting Succinct. | SP1 | on contract | weak for a small team | P, source 12 |
| Sindri | `sindri.app` answered HTTP 503 to the fetch tool and failed the TLS handshake from this session. Its Rust SDK (0.3.1) is of 2025-07-21 and its npm package (0.0.1-alpha.73) of 2025-08-08, both older than twelve months. The SDK names SP1, Jolt, Halo2 and Plonky2; RISC Zero is not named. | SP1, Jolt, circuits | REST with a key, if it still runs | could not verify | P for the dates, sources 10, 29; S for the framework list |
| ZkCloud (Gevulot, Firestarter) | `zkcloud.com` redirects to `zenith.network`, "the EVM and SVM execution layer for Canton Network", operated by Gevulot Oy. The page does not mention proving. `docs.zkcloud.com` does not resolve. | was Risc0, SP1 and others (2024 press) | none found | no | P, source 15; S for the past |
| Fermah (Froben) | "Live on mainnet", a B2B proof marketplace with ZKsync Era and Abstract named as customers; the docs mark "API Reference" as "Soon"; access through a "Build with us" form. An older docs mirror listed RISC Zero and SP1 as live; I could not open it. | not stated today | no | weak | P, source 16 |
| Brevis ProverNet | "By defining computational work for the Pico zkVM, developers gain instant access to a global proving network"; "BREV is the native settlement currency". | Pico only | not described on the page read | no for RISC Zero or SP1 | P, source 16 |
| Lagrange Prover Network | A gRPC gateway for clients; the ZK Coprocessor is the first proof type. Nothing found on SP1 or RISC Zero jobs. Its docs answered 403 to the fetch tool. | own proof types | not for this | no | S, source 16 |
| Cysic | Its docs describe a ZK proof layer, its own "Venus" stack and ASIC hardware. No self-serve API for a custom RISC Zero or SP1 program found. Cysic is itself a prover on Succinct's network (2025 press). | not for this | no | no | P for the docs page, S for the rest, source 16 |
| Nexus | Its own zkVM and its own L1. No hosted prover for other zkVMs and no EVM verifier contract found. | Nexus zkVM | no | no | S, source 16 |
| Marlin Kalypso | The docs page I could open held one line of text. | unknown | unknown | could not verify | source 16 |

Bonsai closed in December 2025 and Boundless in November 2026; ZkCloud's site now points to a different product (I could not date the change), and Sindri could not be reached. For a small team that is the main lesson of this table [I]: a hosted prover is a dependency that can vanish in a week, so the fallback of proving with open-source software on rented hardware has to exist whatever else is chosen.

## 5. Proof verification layers

| | Aligned | zkVerify |
|---|---|---|
| What it is | Proof Aggregation Service: proofs are recursively aggregated and one proof is verified on Ethereum; a dApp checks a Merkle inclusion. | A separate chain that verifies proofs, then publishes aggregation roots to contracts on other chains; a dApp checks a Merkle inclusion. |
| Destination chains | Ethereum mainnet (`AlignedProofAggregationService` `0xD0696d3eEebffcAB2D1b358805efAA005A9A8BC0`), Hoodi and Sepolia. "Propagation of the results to different L2s" is listed under future additions. **No Arbitrum.** | Arbitrum One (`0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69`), Base, OP Mainnet, Apechain, Horizen, Robinhood Chain; Arbitrum Sepolia (`0xd007494945580eEb25522c8e0b2fa798B3F0FDE2`) and seven other testnets. |
| Proof systems | "SP1 (v6, sp1-sdk >= 6.1.0) -- compressed proofs only. SP1 v5 and v6.0.x proofs are not accepted." "Risc0 -- ... proof submission is not available yet". | Groth16, Fflonk, UltraHonk, UltraPlonk, Plonky2, EZKL, TEE, SP1 "v5.x" (not v6), RISC Zero "v2.1, v2.2, v2.3" on the summary page; the RISC Zero verifier page also defines a `V3_0` proof variant. The two pages disagree on 3.0. |
| Latency | "within the aggregation window, which defaults to 24 hours" | not stated on the pages read |
| Price per proof | Not published: a share of about 300,000 gas on Ethereum, "plus a small aggregation fee and the cost of reading the result on-chain" | Not found. Fees are paid in VFY (0.0050 USD today, source 30). |
| Client | CLI and Rust SDK; deposit on Ethereum to fund a quota | `zkverifyjs` 3.4.0 (npm, 2026-11-03), and Kurier, a REST API with a key in the URL (`POST /submit-proof/{API_KEY}`), mainnet and testnet |
| Extra trust | None for validity: "There is no separate validator set to trust ... The aggregator can censor a proof ... but it cannot cause an invalid proof to be accepted." | The destination contract "receives an aggregation from the zkVerify authorized relayer"; `submitAggregation(...) external onlyRole(OPERATOR)` stores the root with no proof. Validity on Arbitrum rests on that operator and on zkVerify's validators. |
| Fit | **no**: wrong chain, wrong proof kind, and it verifies proofs, it does not make them | **no**: fails the owner's rule that validity must not rest on a trusted signer; and it does not make proofs either |

Sources: Aligned [P, source 17, docs read 2026-11-10]; zkVerify [P, sources 18, 19, 20].

Neither removes the hard part. A verification layer takes a proof someone has already produced. What they would save is the Groth16 wrap and about 228,000 gas per run, which costs 0.009 USD on Arbitrum today.

## 6. Self-hosting on a rented GPU

### 6.1 Throughput

| Fact | Tag, source |
|---|---|
| RISC Zero publishes no per-GPU figure for 3.x that I could open. Its remote-proving page describes only Boundless; `benchmarks.risczero.com` did not connect from this session. | P, source 23 |
| Unmodified RISC Zero v3.0.6, "built with `--features cuda`" on an RTX 5090: 565.8 ms per segment at 2^20 cycles and 1,119 ms at 2^21 (composite); a whole succinct proof of the benchmark in 10.70 s; a whole Groth16 proof in 12.67 s. So the Groth16 wrap adds about 2 s on the GPU, against 167 to 472 s in Docker on a CPU (project record). | S, source 22, a third-party fork's pull request of 2026-10-16 |
| The same pull request reports its fork at 113.8 ms per segment, 5 times faster. A fork is a different prover binary, not a different proof; I did not check its seals against the deployed verifier. | S, source 22 |
| VRAM: "1 million cycles requires 9~10GB of GPU VRAM", 2 million 17 to 18 GB, 4 million 32 to 34 GB. | P, source 2 |
| Boundless recommends "at least one NVIDIA GPU with >= 8GB of VRAM", best results on "4090, and L4". | P, source 2 |
| Market average while it ran: 0.96 MHz effective, and Boundless's planning figure of 1 MHz. | P, sources 2, 3 |
| SP1: CUDA compute capability 8.0 or more, "at least 24 GB VRAM", Linux x86-64, a native `sp1-gpu-server`; "Docker and the NVIDIA Container Toolkit are no longer required". No throughput figure on the pages read; the network's provers return a Groth16 proof of this size in 71 s (median), auction included. | P, sources 7, 14 |

**Time for one run** [I]. 1e8 cycles are 96 segments of 2^20 cycles. At 566 ms each that is 54 s of segment proofs on an RTX 5090. Recursion (lift and join) is not itemized in the source. If the benchmark is about 12 segments, which the same author's previous pull request suggests but does not state (4.04 s for a whole composite proof at 325 ms per segment), the 10.70 s for a whole succinct proof puts recursion at about 0.33 s per segment, and a run at 96 x 0.9 s + 2 s, about **1.5 minutes on an RTX 5090**. An RTX 4090 is slower: allow **2 to 3 minutes**. Boundless's market average of about 1 MHz gives the same order: 100 s for 1e8 cycles. Against that, 9 to 17 hours on 4 CPU cores. A cold serverless worker adds its start (loading about 2.3 GB of Groth16 parameters and the GPU kernels): allow 30 to 60 s. None of this was measured on this project's guest.

### 6.2 Price

Prices read today [P, source 24, RunPod pricing page; source 25, Modal pricing page]:

| Rental | Price | One 1e8-cycle run | Against the run fee |
|---|---|---|---:|
| RunPod pod, RTX 4090, community / secure | 0.34 / 0.89 USD per hour | 0.012 to 0.016 / 0.032 to 0.041 USD (130 to 165 s, machine kept busy) | 12 to 40% |
| RunPod pod, RTX 5090, community / secure | 0.69 / 1.19 USD per hour | 0.017 / 0.029 USD (88 s, machine kept busy) | 16 to 28% |
| RunPod Serverless, 24 GB (4090 class) | 1.34 USD per hour, "rounded up to the nearest second", scale to zero | 0.060 to 0.084 USD (160 to 225 s with a cold start) | 58 to 81% |
| RunPod Serverless, 32 GB (5090 class) | 1.79 USD per hour | 0.059 to 0.074 USD (118 to 148 s with a cold start) | 57 to 71% |
| RunPod Serverless, 24 GB (L4, A5000, 3090) and 16 GB tiers | 0.75 and 0.58 USD per hour | not estimated: no RISC Zero 3.x figure for these cards | |
| Modal, L4 / A10 / L40S | 0.80 / 1.10 / 1.95 USD per hour, per second, scale to zero, 30 USD of free credit a month | not estimated: no RISC Zero 3.x figure for these cards | |
| For comparison: Succinct network, SP1 Groth16 | | 0.078 USD, 71 s | 76% |
| For comparison: Boundless, 2026-11-01 and 11-02 medians | | 0.029 and 0.039 USD, 380 and 170 s | 28 and 37% |

So on demand, one proof at a time, a self-hosted GPU costs about what Succinct's market charges; in batches (the season's best runs proven together near its end) it costs a fifth of that. Vast.ai's page states "Per-second billing" but its live prices did not render for me [P, source 26].

### 6.3 Bento, Boundless's own stack

Bento is the open-source proving cluster Boundless provers ran: a REST API, a task database (PostgreSQL), Redis, MinIO and one prove agent per GPU, under Docker Compose. "Bento is intended to be a drop in replacement for Bonsai, including being partially Bonsai API compatible" [P, source 2], so a self-hosted Bento is a hosted-prover API with plain HTTP. It is heavier than this project needs: its guide warns that it "will not work on standard dockerized cloud providers such as Vast.ai as the proving stack relies on Docker" [P, source 2]. One binary built with the `cuda` feature does the same job for one run at a time [I].

## 7. The options side by side

| Option | What the player needs | Latency | Price per verified run | Still a validity proof checked on Arbitrum | New dependencies for the team |
|---|---|---|---|---|---|
| A. Own GPU prover behind an HTTPS endpoint, image published | the Arbitrum wallet they already have | about 2 to 4 min on demand | 0.06 to 0.08 USD on demand; 0.012 to 0.03 USD batched | yes, unchanged | one GPU cloud account; one container image; mirrors of RISC Zero's artifacts |
| B. SP1 through Succinct's network, operator relay | the Arbitrum wallet | about 1 to 2 min | 0.078 USD (0.47 PROVE) | yes, SP1's verifier | SP1 toolchain and guest wrapper; a new referee and season; a PROVE balance funded on Ethereum mainnet; a relay |
| C. SP1 through Succinct's network, from the browser | a network account holding PROVE | about 1 to 2 min | 0.078 USD, paid by the player | yes | all of B, plus a hand-written TypeScript gRPC-web client |
| D. Self-hosted Bento | the Arbitrum wallet | as A | as A, plus a machine that stays up | yes | Docker Compose stack with PostgreSQL, Redis and MinIO |
| E. Boundless | | | | | closed since 2026-11-05 |
| F. zkVerify | a proof made elsewhere | | VFY fee not found | no: an operator role posts the roots | a second chain and token |
| G. Aligned | a proof made elsewhere | up to 24 h | not published | yes, but only on Ethereum mainnet | wrong chain |
| H. Other hosted APIs | | | | | none sells this proof today |

## 8. Conclusion: the lightest credible way to keep the current proof and stop the operator being the only prover

1. **Accept that the market is gone, and say so in the documents.** README section 7.3, section 7.5 and D2, `docs/VERIFICATION.md` ("Prover network price") and `docs/DEPLOYMENT.md` section 6 ("Alternatives") quote Boundless at about 0.000018 ETH and name it as the hosted route. That route closed on 2026-11-05. The project never sent it a request (`docs/DEPLOYMENT.md`: its "prover credential ... was never set"), so nothing breaks today; the plan for mainnet does.
2. **Package the prover, not a service.** Build `zk-host` with `risc0-zkvm`'s `cuda` feature in a container that also holds the `risc0-groth16` component, pin the image by digest in the repository, and give it one command: run id in, seal out, with the run file rebuilt from chain data and handed to the existing `zk-host prove --run <run file> --season <season file>`. Same guest, same image id, same 260-byte seal, same verifier. Anyone with an NVIDIA card of 16 GB or more (2^20-cycle segments need 9 to 10 GB) can then prove any run in minutes instead of hours. This is what removes the operator as the only prover in fact, where today "any player can still prove their own run" is true only on paper.
3. **Put the same image behind a scale-to-zero endpoint.** A serverless GPU worker (RunPod Serverless, Modal or similar) gives the dApp a button: post the run id, poll, receive the seal, call `settleRun` from the player's wallet. The endpoint holds no secret and needs no player key, because a proof is a function of public chain data; it can refuse anything that is not a committed, unsettled run and cache by run id, which bounds abuse. Cost about 0.06 to 0.08 USD per on-demand proof, paid by the operator, or 0.012 to 0.03 USD when the operator proves a season's best runs in one batch.
4. **Cut the two remaining ties to the vendor.** Mirror the pinned toolchain and Groth16 artifacts, and consider settling through the project's own immutable copy of the Groth16 verifier instead of the vendor's emergency-stop wrapper.
5. **Keep SP1 as the exit, not the plan.** If a real second prover is wanted, one that shows up without the operator's endpoint, Succinct's network is the only live one: 0.078 USD and about a minute per run today. The kept SP1 trial branch makes that a known amount of work. It costs a second toolchain, a PROVE treasury on Ethereum, and a new referee and season. One referee that accepts either proof would double what must be trusted, so it is a choice for the owner, not a default [I].

What none of this delivers is the literal request: the player's own machine producing the proof inside the browser. This family of options only lets the browser *obtain* a proof. Whether a browser can *make* one is the subject of the sibling reports.

## 9. What the repository would change

| Option | Changes |
|---|---|
| A | A `cuda` feature on `referee/zk/host` (today `risc0-zkvm = { version = "=3.0.6", features = ["prove"] }`) and a GPU container image; a command that builds a run file from a run id and chain data, as `scripts/contracts/e2e.mjs` does for the bot run; a small HTTP handler around it and `zk-host prove --run`; a "prove and settle" call in `web/`; documentation (README 7.3, 7.5, D2; `docs/VERIFICATION.md`; `docs/DEPLOYMENT.md`; `docs/ECONOMY.md` prover trust). No contract, vector, `RULES_VERSION` or image-id change. One GPU proof must be checked against the deployed verifier before relying on it: none was made here. |
| B | The SP1 guest wrapper and host from the kept trial branch, with a reproducible verifying key; an SP1 referee calling the gateway `0x397A...dA9B`, its fixtures and gas tests; a new season; a relay with a capped PROVE account; the same documentation. No change to `core/`. |
| C | B, plus a TypeScript client (protobuf bindings, gRPC-web, artifact upload, EIP-191 signing) that nobody maintains upstream. |

## 10. Could not verify

- **Why Boundless's requests stopped two days before the announced date.** The contract's last fulfilment is 2026-11-03 11:00 UTC; the announcement says 2026-11-05. I did not find a statement about the gap.
- **Whether the market on Taiko also stopped.** The announcement covers "Boundless ZK proving operations" as a whole; I scanned only the Base contract.
- **Whether the `BoundlessMarket` contracts now reject requests**, or only lack provers. The order stream still answers its health check.
- **Any statement on the future maintenance of the RISC Zero zkVM**, of its verifier contracts on Arbitrum, or of who holds the emergency-stop key since the Boundless market paused.
- **Sindri's status and current framework list** (HTTP 503 and a TLS failure), **Fermah's supported proof systems and prices** (its API reference is "Soon"; `docs-61j.pages.dev` did not resolve), **ZkCloud's docs** (`docs.zkcloud.com` did not resolve), **Lagrange's docs** (HTTP 403), **Marlin Kalypso's status**.
- **zkVerify's fee per proof**, and whether its RISC Zero verifier accepts 3.0 receipts on mainnet: its summary page says v2.1 to v2.3, its verifier page defines `V3_0`.
- **Aligned's fee per proof.**
- **Per-GPU throughput of RISC Zero 3.0.6 from RISC Zero itself**, and any throughput on this project's guest. The 566 ms per segment is one third party's benchmark on one card; the split between segment proofs and recursion in a full run is my estimate.
- **Per-GPU throughput of SP1 6.x** on one card.
- **That the Succinct network accepts requests from any new account** without an allowlist: the quickstart describes no gate, and I sent no request.
- **That a browser can upload to the Succinct artifact store**: the RPC allows cross-origin calls, but I did not test the presigned storage URL's CORS.
- **Vast.ai's live prices** (not rendered), and RunPod's community-cloud prices beyond what its page data gave.
- **The identity of requester `0x7276fa3c...19c9`** as Boundless's own load generator: inferred from its bucket name and a commit title.

## 11. Sources

All read on 2026-11-10. "Undated" means the page shows no publication or update date.

1. Boundless Foundation, "ZKC: Introducing Tokenized AI Inference", dated 2026-11-03. `https://boundlessfdn.org/blog/zkc-introducing-tokenized-ai-inference/` (reached by redirect from `https://boundless.network/blog`). Blog index: `https://boundlessfdn.org/blog/`.
2. Boundless documentation, undated: `https://docs.boundless.network/developers/smart-contracts/deployments`, `/developers/tutorials/request.md`, `/developers/tutorials/proof-types.md`, `/developers/tutorials/auction.md` (mentions "as of October 2025"), `/developers/tutorials/smart-contract-requestor.md`, `/developers/tutorials/request-stream.md`, `/developers/tooling/sdk.md`, `/provers/bento.md`, `/provers/quick-start.md`, index `https://docs.boundless.network/llms.txt`.
3. Boundless indexer API, live data read 13:52 to 13:56 UTC: `https://d2mdvlnmyov1e1.cloudfront.net/v1/market/aggregates?aggregation=weekly...`, `/v1/market/requests?limit=500&sort_by=created_at`, `/v1/market`, `/v1/market/efficiency`, `/openapi.json`.
4. Base mainnet, `eth_getLogs` on `0xfd152dadc5183870710fe54f939eae3ab9f0fe82`, blocks 53,400,000 to 55,642,644, through `https://base-rpc.publicnode.com`, read about 14:00 UTC; block timestamps from the same RPC. Event names from `https://raw.githubusercontent.com/boundless-xyz/boundless/main/contracts/src/IBoundlessMarket.sol`.
5. Arbitrum One (block 522,999,198) and Arbitrum Sepolia (block 327,893,403), `eth_call` of `getVerifier(bytes4)`, `paused()` and `owner()` through `https://arbitrum-one-rpc.publicnode.com` and `https://arbitrum-sepolia-rpc.publicnode.com`, 14:09 UTC.
6. Boundless repository: commits on `main`, `https://github.com/boundless-xyz/boundless/commits/main/` (latest 2026-11-05); releases, `https://github.com/boundless-xyz/boundless/releases` (latest v2.0.2); order-stream client, `https://raw.githubusercontent.com/boundless-xyz/boundless/main/crates/boundless-market/src/order_stream_client.rs`; probes of `https://base-mainnet.boundless.network/api/v1/health`, `/api/v1/nonce/...` and `https://taiko-mainnet.boundless.network/api/v1/health`.
7. Succinct Prover Network RPC, `https://rpc.mainnet.succinct.xyz`, methods `network.ProverNetwork/GetProofRequestParams`, `GetMarketPricePerPgu` (as of 2026-11-10 13:40 UTC), `GetProvePrice`, `GetFilteredProofRequests`; gRPC-web and CORS probes; 13:58 to 14:08 UTC.
8. SP1 SDK source at tag `v6.10.0` (2026-10-23): `https://raw.githubusercontent.com/succinctlabs/sp1/v6.10.0/crates/sdk/src/network/client.rs`, `.../network/utils.rs`, `.../network/signer.rs`, `.../network/mod.rs`, `.../network/proto/auction/types.rs`, `.../network/proto/auction/network.rs`, `.../network/proto/artifact.rs`.
9. Same as 8, `signer.rs`: "Sign an arbitrary message per EIP-191."
10. npm registry, `https://registry.npmjs.org/` (search and package lookups): no `@boundless-xyz/*` or `@succinctlabs/*` SDK under the names tried, `sp1-sdk` and `boundless-market` absent; `sindri` 0.0.1-alpha.73 (2025-08-08); `zkverifyjs` 3.4.0 (2026-11-03); `@risc0/ui` 0.0.429 (2025-08-14).
11. Succinct documentation, undated: `https://docs.succinct.xyz/docs/protocol/prove/pay`, `https://docs.succinct.xyz/docs/sp1/prover-network/intro`, `/quickstart`.
12. Succinct documentation, undated: `https://docs.succinct.xyz/docs/sp1/prover-network/faq`, `/reserved-capacity`.
13. Succinct documentation, undated: `https://docs.succinct.xyz/docs/sp1/verification/contract-addresses`.
14. Succinct documentation, undated: `https://docs.succinct.xyz/docs/sp1/getting-started/hardware-requirements`; `https://docs.succinct.xyz/docs/provers/introduction`.
15. `https://zkcloud.com/` (HTTP 301 to `https://zenith.network/`), undated, copyright 2026.
16. Other providers, undated unless said: Fermah `https://fermah.xyz/` and `https://docs.fermah.xyz/`; Brevis `https://provernet-docs.brevis.network/`; Cysic `https://docs.cysic.xyz/`; Marlin `https://docs.marlin.org/learn/what-is-kalypso`; Lagrange and Nexus through search results for `docs.lagrange.dev` and `docs.nexus.xyz` (secondary); Sindri `https://sindri.app/` (HTTP 503).
17. Aligned documentation, undated: `https://docs.alignedlayer.com/proof-aggregation-layer/architecture/4_supported_verifiers.md`, `/proof-aggregation-layer/guides/7_contract_addresses.md`, `/proof-aggregation-layer/architecture/1_overview.md`, `/introduction/2_faq.md`, `https://docs.alignedlayer.com/llms.txt`.
18. zkVerify documentation, copyright 2026: `https://docs.zkverify.io/architecture/supported_proofs`, `/architecture/verification_pallets/risc0`, `/architecture/verification_pallets/sp1`.
19. zkVerify documentation: `https://docs.zkverify.io/architecture/proof-verification-smart-contract`, `/architecture/proof-aggregation/publish-aggregations`.
20. zkVerify documentation: `https://docs.zkverify.io/architecture/contract-addresses`, `/overview/getting-started/kurier`.
21. RISC Zero repository: `https://github.com/risc0/risc0/commits/main/` (latest 2026-10-26), `https://github.com/risc0/risc0/releases` (v3.0.6 marked latest; v3.1.0-rc.1 pre-release).
22. `https://github.com/hemilabs/risc0/pull/21`, "perf(cuda): speed stack 2: ~1.7-1.9x over release-3.0, ~5x over upstream v3.0.6 on RTX 5090", description of 2026-10-16, merged; and `https://github.com/hemilabs/risc0/pull/20`, merged 2026-10-15 (325 ms per segment and 4.04 s for a whole composite proof on `release-3.0`).
23. RISC Zero documentation, undated: `https://dev.risczero.com/api/generating-proofs/remote-proving`.
24. RunPod: `https://www.runpod.io/pricing` and `https://docs.runpod.io/serverless/pricing`, undated.
25. Modal: `https://modal.com/pricing`, undated.
26. Vast.ai: `https://vast.ai/pricing`, undated.
27. TokenPost, "Boundless Plans AI Credits for ZKC Stakers as ZK Protocol Pauses", 2026-11-04. `https://www.tokenpost.com/news/technology/48701`.
28. KuCoin flash relaying BlockBeats, 2026-11-04. `https://kucoin.com/news/flash/boundless-launches-tokenized-ai-inference-plan-with-zkc-staking-rewards`. CoinMarketCap summary: `https://coinmarketcap.com/cmc-ai/boundless/latest-updates/`.
29. crates.io API, `https://crates.io/api/v1/crates/<name>`: `boundless-market` 2.0.1 (2026-06-02), `sp1-sdk` 6.10.0 (2026-10-23), `risc0-zkvm` 3.0.6 (2026-07-17) and 3.1.0-rc.1 (2026-10-30), `sindri` 0.3.1 (2025-07-21), `bonsai-sdk` 1.4.3 (2026-07-17).
30. CoinGecko, `https://api.coingecko.com/api/v3/simple/price?ids=ethereum,succinct,boundless,aligned,zkverify,...`, 2026-11-10 14:00 UTC.
31. Gas prices by `eth_gasPrice`, 2026-11-10 14:08 UTC: Ethereum 0.244 gwei (`https://ethereum-rpc.publicnode.com`), Arbitrum One 0.02 gwei, Base 0.006 gwei.
32. Project record: `docs/VERIFICATION.md` (sections "Prover network", "Proving", "Verification gas", "Prover network price", measured 2026-10-31 to 2026-11-02) and `README.md` (sections 7.3, 7.5, 13 D2).
