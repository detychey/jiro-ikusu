# Precedents: how shipped projects verify game runs, and who proves in the browser

Research date: 2026-11-10. Every page below was opened on that date unless a publication date is given.

Each fact carries a confidence mark:

- **[P]** primary source: official documentation, a repository file, a vendor's own post, a deployed-contract tracker;
- **[S]** secondary source: press, a third party's page, or a search-engine extract of a page I could not open;
- **[I]** inference or arithmetic of mine from the cited facts.

Sources older than twelve months (before 2025-11-10) are marked *stale*. Source numbers refer to section 8.

**Limits of this research.** The session's shared web-search budget ran out after about 20 queries. Everything after that came from opening known primary pages and repository files directly, so absence claims below ("none found") rest on fewer searches than I would like; section 7 lists what I could not check. Three hosts were unreachable: `web.archive.org` (blocked by the egress policy), `docs.zypher.network` and `blog.hyli.org` (not resolvable from this session).

## 1. Answer first

**Nobody has shipped in-browser proof generation for a whole real-time game replay of this size, and the one project that advertises it does not do it in its published code.** What ships in 2024 to 2026 falls into the nine patterns of section 4, and only two of them keep validity free of a trusted party at this workload: a zk proof made outside the browser, and optimistic settlement with a proof on dispute.

The facts that decide it:

1. **The flagship "proved in the browser" arcade game builds dummy proofs.** ZkNoid's Arkanoid on Mina defines a real recursive o1js program, 10 ticks per recursive step, but the browser worker in both its archived repository and its current one calls `mockProof(...)`, which wraps the natively computed result in `GameRecordProof.dummy(...)`; `compileContracts` is an empty function (S1 to S4) [P]. A 16,200-tick run at 10 ticks per step would need 1,620 recursive proofs [I].
2. **The browser proofs that do ship are three orders of magnitude smaller than this game.** Aligned's ZK Arcade (Ethereum mainnet, 2025-10-28 to early 2026) proved *Parity*, a 3×3 puzzle, in the browser with Circom and snarkjs; its circuit is `ValidateParityGame(3, 55)` set up with a 2^16 powers-of-tau file, so at most 65,536 constraints (S10, S12) [P]. Dark Forest proves one move at a time (S20, S22) [P]. The sibling report on circuits estimates this game at 48 to 187 million gates per run (S44) [S]. Both are also second implementations of the rules, in Circom.
3. **When a zkVM proves a whole run with one shared Rust core, the proof is made outside the browser.** ZK Arcade's *Beast* shares a `game_logic` crate between the game and an SP1 5.0.0 guest and proves on the player's own machine with a native binary (S10, S11) [P]. ZKsync's official tutorial sends the recorded actions to a backend that asks the SP1 prover network for a Groth16 proof (S16) [P]. Succinct's testnet games made players "deposit $10 USDC to pay for the proofs you generate", requested from its prover network by playing (S17) [P]. RISC Zero's own repository has a `browser-verify` example, for verifying, and none for proving (S15) [P].
4. **A run here is the size of RISC Zero's DOOM demo, which stayed an experiment.** The vendor's post reported 119,537,664 cycles for a DOOM demo replay without rendering (S14) [S]; a run here is 70 to 137 million. The demo's README says "experimental and should not be used for any production use cases" (S13) [P], and the post is no longer on the vendor's site.
5. **The games that pay real prizes avoid proving a replay.** Starknet's Loot Survivor and Budokan put every action onchain (S23 to S26) [P]. Cartesi's RIVES replays the tape in a RISC-V machine run by its operator: in its v1 backend, in-rollup verification is locked by default and scores are accepted only from the operator's address (S6, S7) [P]. Atari's "Onchain Arcade" on Base took scores from a web API, and a third party put itself second on the leaderboard without playing (S33) [S].
6. **The only trust-minimized pattern lighter than "prove every paid result" is optimistic with a proof on dispute.** ZkNoid's 2026 game, Wizard Battle on Mina mainnet, does this in its published contract: an admin posts the result, a challenge window opens (default 100 slots), anyone may then finalize by timeout, and a ZK fraud proof over two consecutive committed states overturns the result (S5) [P]. A June 2026 Solana prototype, tickproof, bisects to one tick and re-executes it onchain for about 19,000 compute units (S32) [P]. Cartesi's permissionless fraud proofs are live for exactly one application, a bug-bounty honeypot holding 1,230 USD, with a 7-day challenge period and a 0.232 ETH bond (S8, S9) [P].

**For a game of this size and stakes, what is proven to work:** proving outside the browser, by the operator, a prover market or the player's own native machine, and verifying one small proof onchain, which is what the repository already does; and settling optimistically with that same proof as the dispute backend. **What remains demo-only:** a browser tab proving a whole real-time replay, with a zkVM or with a circuit.

## 2. The yardstick

From `README.md` §7 and `docs/VERIFICATION.md` [P]:

| Quantity | Value |
|---|---|
| Run | 6 levels, at most 16,200 ticks at 15 Hz, journals of input changes only, at most 8,171 bytes each |
| Proven computation | 70 to 137 million RISC Zero cycles per run |
| Verification | one Groth16 seal, 227,591 gas on Arbitrum |
| Run fee | 0.00005 ETH, about 0.11 USD |
| Proving today | 9 to 17 hours on 4 CPU cores; about 0.0000184 ETH on a two-prover market |
| Constraints | one Rust core for every target; no trusted signer for validity; light dependencies |

## 3. Precedents, one by one

Each entry records the verification system, where the proof or check is produced, the size of the computation, the time, the onchain cost, the trust model, and whether real money is involved.

### 3.1 Replay re-execution under an operator: Cartesi RIVES

- **System.** RIV is a fantasy console on the Cartesi Machine, a deterministic RISC-V Linux emulator. The same game binary runs in the player's browser, compiled to WebAssembly, and in the rollup node; a "tape" is the recorded input log (S6, S27) [P].
- **Where verified.** In a Cartesi Rollups node: "to be verified by a remote Cartesi Machine that will be running in a node of the Cartesi Rollups" (S6) [P]. No proof is generated.
- **Who decides in practice.** In `rives-core` (Rollups node 1.5.x, last updated 2025-09-24), `verify` returns "Internal verification locked" because `internal_verify_lock = True` by default, and `external_verification` starts with `# only operator` and rejects any sender other than `operator_address`: the operator's external verifier replays tapes offchain and posts scores in batches. In `rives-core-nv2` (node 2.1.x, updated 2026-03-11) the lock is gone and `verify` replays inside the rollup machine; awards stay operator-only (S7) [P]. I did not verify which version runs on Base today.
- **The rollup's own validation.** Cartesi's application framework offers Authority ("only the contract owner can submit and accept claims") and Quorum consensus; its mainnet page says "the validation remains permissive, with no support for disputes", and the docs index calls fraud proofs "a distinct sub-system, not part of the Rollups application framework" (S8) [P].
- **Size.** Up to 100 million RISC-V instructions per second of play (S6) [P]: a 3-minute level may use 1.8 × 10^10 instructions, about 130 to 260 times one whole run here [I]. Re-execution has no trouble with sizes that proving cannot touch.
- **Latency and cost.** Not published for tapes. Authority and Quorum settle per epoch, 7,200 blocks by default (S8) [P].
- **Real money.** The "Doom Olympics" of 2024-09-12 to 09-19 ran on Base mainnet with a 15,000 USD prize pool sponsored by Cartesi (S28, *stale*) [S]. Both backend READMEs say "this is not a final product and should not be used as one" (S7) [P].
- **Cartesi fraud proofs.** PRT v2 is live for the Honeypot v2 application on Ethereum mainnet since 2025-11-08: Stage 2, total value secured 1,230 USD, challenge period 7 d 1 h, initial tournament bond 0.23219805 ETH, three bond levels, "at least one week for a sealed epoch to be settled" (S8, S9) [P]. That bond is 4,640 times this project's run fee [I]. None of the 18 games in Cartesi's project directory is described as running with fraud proofs (S27) [P].

**Reading.** This is the closest architectural relative: one binary in the browser and in the verifier, and input logs published onchain. It has paid prizes. Its validity rests on the operator, which the owner rules out.

### 3.2 Recursive proofs in the browser: ZkNoid on Mina

- **Arkanoid (2023 to 2024).** `GameProcess` is an o1js `ZkProgram` whose method `processTicks(prevProof: SelfProof, inputs: GameInputs)` verifies the previous proof and applies `CHUNK_LENGTH = 10` ticks; `GameRecord` joins it to a map-generation proof; the Protokit runtime module `ArkanoidGameHub.addGameResult` calls `proof.verify()` and the `Gamehub` holds competition funds and rewards (S1, S2) [P].
- **What the browser actually does.** `proveGameRecord` in the web worker computes each step natively and wraps the output with `mockProof`, defined as `GameRecordProof.dummy([], [''], 2)`. This is the case in the archived `ZkNoid/zknoid` (archived 2024-10-08) and in `ZkNoid/store` (worker last changed 2024-10-12; repository updated 2025-05-28) (S3, S4) [P]. No proving time exists to report, because no real proof is made.
- **Wizard Battle (live on Mina mainnet since early May 2026).** The Mina post says "every turn generates a proof" and "the entire match history can be proven via a recursive proof after the match concludes"; first tournaments have "free entry and sponsored prize pools for the top 10 players", later ones "entry fees go directly into player prize pools" (S29) [P]. It is turn-based.
- **Its contract is optimistic.** `GameManager` (repository updated 2026-06-07): `startGame` and `finishGame` are admin-only; `finishGame` moves the game to `AwaitingChallenge` with a deadline of the current slot plus `challengeWindowSlots`, set to 100 by default; `proveGameRecord` finalizes on a valid recursive proof; `proveFraud` finalizes as fraud on a proof that, for two sequential states in the committed state tree, the transition from the first does not give the second; `proveByTimeout` is "Anyone can call" after the deadline; `slash` is admin-only (S5) [P]. The repository's README describes a NestJS and Redis WebSocket game server and does not mention proofs; both the frontend and the backend depend on o1js 2.8.0, and where the recursive proof is generated is not documented (S5) [P].
- **Browser limit stated by Mina.** Its in-browser node "only had 4GB of memory due to WASM limitations" (S30, *stale*) [P].

**Reading.** The team with the longest record of "provable games" moved from "the player proves the whole game" (never shipped with real proofs) to "an operator posts, a window opens, a proof settles disputes".

### 3.3 Proofs made by players: Aligned's ZK Arcade

The strongest precedent for the owner's question, and it ended.

- **Live with value.** Launched on Ethereum mainnet on 2025-10-28, at first for 700 whitelisted wallets, with a wider ticket collection announced for later; the campaign has finished ("Seasons 1–6 · Complete"). 5,644 proofs verified per the closing post (the site's counter shows 5,643), 657.22 million points, and 10,000,000 ALIGN tokens (0.10% of supply) shared among participants, 60% of them by leaderboard score (S10) [P].
- **Parity: proved in the browser.** "Proofs for successful completion are generated in-browser using Circom." Groth16 through snarkjs 0.7.5; circuit `ValidateParityGame(3, 55)`, 3 levels of up to 55 rounds on a 3×3 board, set up with a 2^16 powers-of-tau file (S10, S12) [P]. The rules are written a second time, in Circom.
- **Beast: proved on the player's machine.** "Installing the game also installs the SP1 zkVM, which lets you generate proofs of your scores locally before uploading them." The guest `beast_1984_program` imports the same `game_logic` crate as the terminal game and replays a log of events; the client calls `ProverClient::from_env()` and `.prove(&pk, &stdin).compressed()` with `sp1-sdk = "5.0.0"`; binaries are prebuilt for Linux x86-64 and macOS (S10, S11) [P]. A compressed proof is a STARK: SP1's own table marks Core and Compress as not EVM-compatible and asks 16+ cores and 16 GB+ for them (S18) [P]. Proving time and cycle counts are not published.
- **How it was verified.** Not by a contract checking a proof. The launch posts name "Aligned's Proof Verification Layer" (S10) [P]; the client submits through `aligned_sdk::verification_layer` and the leaderboard contract calls `verifyBatchInclusion` on Aligned's service manager (S11) [P]. That layer "works using a subset of Ethereum's validators via restaking ... If a two-thirds majority agrees, the results are posted to Ethereum" (S19) [P]. Players deposited a recommended 0.001 ETH for verification (S10) [P], 20 times this project's whole run fee [I].
- **Not on Arbitrum.** Aligned's newer Proof Aggregation Service (mainnet alpha 2026-01-23) does check a recursive proof in a contract, for about 300,000 gas per aggregated proof, but it accepts SP1 proofs only and its post names Ethereum only (S19) [P]. The sibling report on proof services found no Arbitrum deployment (S47) [S].

**Reading.** Players did prove their own arcade runs with a zkVM and a shared Rust core, natively, in a campaign of a few hundred wallets (the site counts 608 tickets minted). Getting there took a desktop binary, a STARK that no EVM chain verifies directly, and a committee of signers in place of a verifier contract.

### 3.4 zkVM game demos and tutorials

| Precedent | System | Where proved | Size and time | Onchain | Status |
|---|---|---|---|---|---|
| RISC Zero zkDOOM (S13, S14) | RISC Zero zkVM v0.20, PureDOOM replaying a demo file | host machine | 119,537,664 cycles without rendering, 7,809,794,048 with; about 37,500 cycles per tick without rendering; no proving time given [S] | none | "experimental"; the post is gone from the vendor's site, whose sitemap now lists two pages [P] |
| RISC Zero examples: chess, wordle, bevy (S15) | RISC Zero | host, or the Bonsai service the READMEs point to | small | "you could build an app where on-chain payment depends on off-chain gameplay" | examples; `browser-verify` verifies only [P] |
| ZKsync "Build a ZK Game" (S16) | SP1, Groth16 | backend, with `SP1_PROVER=network` | Breakout clone; not stated | the game contract checks the program's verification key | official tutorial, updated 2025-06-09, *stale* [P] |
| Succinct testnet games, "Level 1: Crisis of Trust" (S17) | SP1 | requested from the Succinct Prover Network | Flappy Bird and others; not stated | not stated | 2025-02-10, *stale*; 1,000 spots; 10 USDC deposit "to pay for the proofs you generate" [P] |
| zk-nintendo (S31) | SP1, NES emulator fork | a Rust script | "unlikely that the script will execute on your local machine, or even a really beefy AWS instance" | none | hobby repository, 12 commits [P] |
| Zypher (S34) | not named in the posts read; an earlier note on app-specific Plonk circuits compiled to wasm was seen only as a search extract [S] | "a network layer of distributed validation nodes off-chain" | game actions "bundled into a single ZKP" | its own Layer 3 on Linea | vendor claims, 2024, *stale* [P] |
| Delphinus zkWasm mini-rollup (S35) | zkWasm | "the ZKWASM proving service" | server-side application | "verified onchain with settlement callbacks" | template [P] |

**Reading.** Every zkVM game precedent proves on a server, a prover network or a native machine. The one with a published size, DOOM, is the size of a run here and never left the experimental folder.

### 3.5 Per-move circuits in the browser: Dark Forest and its descendants

- **Dark Forest.** A Groth16 proof with every move, made with snarkjs; the move circuit hides two coordinates behind MiMC hashes and checks range and distance; the contracts ship a generated `Verifier.sol` (S20, S22) [P]. Its own guide calls proof generation "computationally expensive" and documents a remote "snarker" to move it out of the browser (S21) [P]. In 2020 the team wrote "it still takes nearly a minute for us to actually generate the MiMC SNARK on a modern Macbook Pro" (S20, *stale*) [P]. The first beta ran on Ropsten with a 1,024 DAI prize pool (S20, *stale*) [P].
- **BattleZips-Noir.** Battleship in Noir: one board proof and one proof per shot, with a note that the Aztec backend packages "do not currently work perfectly" in a create-react-app frontend (S36, undated, old tooling) [P]. The Noir team's curated list has no games section today (S36) [P].
- **This workload as a circuit.** Measured by the sibling report: bb.js proves 2^20 gates in 42.6 s in WASM, and a full run would be 48 to 187 million gates (S44) [S].

**Reading.** Browser proving ships where the statement is one move or one small puzzle, and where the rules are written in a circuit language. Neither holds here.

### 3.6 Every action onchain: Dojo and Cartridge on Starknet

- **Loot Survivor.** "All game logic, state management, and randomness are handled by smart contracts"; "ZK proof integration" appears only under planned enhancements (S23) [P]. Cartridge's Controller lets "games ... execute approved transactions without user prompts", with a paymaster (S24) [P].
- **Budokan.** An onchain tournament protocol on Starknet mainnet: entry fees, prize pools in ERC-20 or ERC-721, "a 5% fee on entry fees" (S25) [P]. A listing showed a Loot Survivor event with more than 8,000 USDC in prizes for 2026-11-09 to 11-15 (S25) [S].
- **Client-side proving.** Dojo's FAQ, at v1.7.0: "The ability to execute Dojo programs in the browser is entirely plausible and is on our roadmap" (S26) [P]. StarkWare says S-two "makes it feasible to generate proofs locally on any device" and lists developer APIs under what is next; its evidence is FibRace (S37, *stale* by a week) [P]. SNIP-36, in-protocol verification of S-two proofs, is a draft created 2026-02-15: proofs of about 500,000 bytes, priced at 75 million L2 gas, produced by a self-hosted prover service (S38) [P].
- **FibRace.** 6,047 players made 2,195,488 Cairo M proofs of Fibonacci numbers on 1,420 phone models in September 2025; "most modern smartphones" finished in under 5 seconds; 3 GB of RAM for stable proving (S39, *stale*) [P]. The computation is a Fibonacci number, not a game replay.

**Reading.** The Starknet answer to prizes is to make each action a transaction. A run here has up to 16,200 ticks and its inputs are already one transaction's calldata; a transaction per input change would cost more and add latency to a 15 Hz game. Client-side proving of games on Starknet is a roadmap line.

### 3.7 Optimistic schemes with a dispute

- **Wizard Battle** (3.2): admin-posted result, 100-slot window, ZK fraud proof, timeout finalization. Live, with sponsored prizes (S5, S29) [P].
- **tickproof** (S32) [P]: a `no_std` Rust state transition compiled to Solana's SBF; the operator commits Merkle state roots and a rolling input hash; a challenger bisects to one tick, which the chain re-executes as a program call. One-step fraud proof about 19,000 compute units, settlement about 13,000, against about 280,000 for an SP1 Groth16 verification on Solana, per the paper. Interpreting the tick instead of running it natively is put at 80+ compute units per emulated instruction, about 157,000 per tick before memory proofs. Devnet prototype of June 2026, challenge windows of 64 slots ("mainnet values would be hours"), single-challenger sessions, inputs not yet signed by players, no author named.
- **Cartesi PRT** (3.1): general bisection over RISC-V steps, live for one honeypot.
- The single-round "claim, challenge, prove" shape used by OP Succinct Lite, and its numbers on Arbitrum, are in the sibling report `scratchpad/research/optimistic.md` (S45) [S].

**Reading.** Re-executing one tick onchain is the cheapest dispute, but it needs the rules to run on the chain: SBF on Solana, and on Arbitrum only Stylus, whose activations are paused (3.9).

### 3.8 Server-side and attested anti-cheat

- **Atari and Stack on Base (2024).** "When the user starts the game, nothing happens on-chain"; the score went to Stack's server in an API call, and Stackr's team placed their wallet second "without playing a single game" (S33, *stale*) [S].
- **Elympics.** Server-run matches with input-based replays stored "in Elympics Cloud"; the site advertises "Proof of Game ... an on-chain cryptographic proof of game results" and node operators who "stake $ELP to host and verify matches" (S40) [P for the claims]. No verifier contract, numbers or chain list is given.
- **Paima Engine.** Inputs are ordered on an L1 and the state is whatever the game's code derives from them; nodes "need to re-execute transactions to check the validity of the chain"; no fraud proofs; a ZK layer through Mina is described (S41, v1 docs, 2024, *stale*) [P].
- **Aligned** (3.3): a two-thirds quorum of restaked operators attests that a proof verified.

**Reading.** These are light and they ship. Each one puts a server, an operator or a committee where this project has a verifier contract.

### 3.9 Games on Arbitrum Stylus

- Offchain Labs' curated Stylus list has one game entry, a conference talk, "Onchain Chess in Rust with Arbitrum Stylus", 2024-02-26 (S42, *stale*) [P].
- New Stylus activations were paused by an emergency upgrade on 2026-10-02, over hand-crafted WASM programs that could halt the chain; "Existing Stylus contracts are untouched"; no date to resume (S43) [S]. The repository read `activationGas` at the uint64 maximum on Arbitrum One and Sepolia on 2026-11-02 (`docs/VERIFICATION.md`, "Stylus activation") [P].
- The owner's earlier project measured a full Stylus replay of its game at 0.84 to 3.25 million gas on Arbitrum Sepolia; it is "not audited, not live" (`README.md` §7.3 and §10) [P].
- I found no Stylus game with real money. I could not search for one after the search budget ran out.

## 4. Summary table

| Pattern | Shipped example | Where the proof or check is made | Size handled | Onchain cost | Validity rests on | Real money |
|---|---|---|---|---|---|---|
| Operator re-executes the replay | Cartesi RIVES | operator's node | up to 10^8 instructions per second of play | calldata for the tape | the operator (Authority consensus) | 15,000 USD sponsored, 2024 |
| Every action is a transaction | Loot Survivor, Budokan | the chain | one action per transaction | one Starknet transaction per action | Starknet | yes, prize pools, 5% protocol fee |
| zkVM proof from a server or market | ZKsync tutorial, Succinct testnet games, this repository | backend, prover network | 10^8 cycles (here) | one Groth16 check, 227,591 gas here | the proof system | testnet here; deposits for proofs at Succinct |
| zkVM proof from the player's native machine | Aligned Beast | player's desktop, SP1 compressed | not published | none directly: operator quorum | two thirds of restaked operators | token allocation, campaign over |
| Circuit proof from the browser | Aligned Parity, Dark Forest | browser, snarkjs | at most 65,536 constraints; one move | Groth16, or operator quorum | proof system and a second rules implementation | token allocation; 1,024 DAI in 2020 |
| Recursive proof from the browser | ZkNoid Arkanoid | browser, o1js | 10 ticks per step | Protokit appchain | nothing: proofs are mocked | hackathon and grants |
| Optimistic with a proof on dispute | ZkNoid Wizard Battle | operator posts; anyone proves fraud | one state transition per fraud proof | Mina zkApp | one honest challenger inside 100 slots, plus an admin | sponsored prize pools, 2026 |
| Optimistic with bisection to one step | tickproof; Cartesi PRT | chain re-executes one step | one tick; one RISC-V step | about 19,000 compute units; 7 days and 0.232 ETH bond | one honest challenger | devnet; 1,230 USD honeypot |
| Server API | Atari and Stack on Base | server | any | none | the server | prizes; leaderboard spoofed |

## 5. What this means for the project

Judged against 10^8 cycles per run, a 0.00005 ETH fee, Arbitrum One, one Rust core and a small team.

1. **The current design is the mainstream trust-minimized precedent, and it is ahead of most of it.** Publishing the inputs, replaying them for free offchain, and proving only the results that money depends on is what ZKsync's tutorial, Succinct's games and RISC Zero's examples describe. I found no shipped game that verifies a zkVM proof of a whole run directly in a contract on an L2 for prize money; ZK Arcade, the nearest, verified through an operator quorum on Ethereum.
2. **"The player proves in the browser" has no precedent at this size.** The browser proofs that ship are at most 65,536 constraints or one move, in hand-written circuits; the recursive design meant for whole runs was shipped with dummy proofs. The sibling reports `browser-zkvm.md` and `browser-circuit.md` in the same directory give the technical reasons (S44) [S].
3. **"The player proves on his own machine" has one precedent, and it needed a desktop binary and a non-EVM proof.** For Arbitrum the proof must still be wrapped into Groth16, which here takes about 7 GiB in an x86 Docker image. A native prover is an optional extra for players with a GPU, not a default path.
4. **The lighter option with precedent is optimistic settlement.** The browser already replays journals in milliseconds, so every client can check every claim; a proof is made only on dispute. Wizard Battle ships this shape with an admin and a ZK fraud proof; the Arbitrum-specific window and bond numbers are in `optimistic.md`. It lowers the number of proofs, not the number of dependencies: the zk stack stays as the dispute backend.
5. **The patterns with fewer dependencies all trade away the owner's constraint.** Operator re-execution, a restaked committee, server-authoritative replays and a plain API are lighter and ship more often; each puts a signer where the proof is. Every-action-onchain keeps the constraint but does not fit a 15 Hz game whose inputs already cost one transaction.
6. **Stylus is the only route to "re-execute one tick onchain" on Arbitrum, and it is closed for now.**

## 6. Demo, roadmap or claim: a short list

- **Demo-only:** RISC Zero zkDOOM; zk-nintendo; BattleZips-Noir; ZkNoid Arkanoid's browser proof (mocked); tickproof (devnet prototype).
- **Roadmap:** Dojo programs in the browser; S-two client-side developer APIs; SNIP-36 (draft); Cartesi fraud proofs for applications other than the Honeypot; Aligned's aggregation results reaching L2s; Stylus activations resuming.
- **Vendor claim without a verifier I could inspect:** Elympics "Proof of Game"; Zypher's user counts and proof pipeline.
- **Shipped, with value:** Loot Survivor and Budokan; RIVES contests; ZK Arcade (ended); Wizard Battle tournaments; Cartesi Honeypot v2.

## 7. What I could not verify

- Proving time, cycle count and hardware for ZK Arcade's Beast proofs, and how many of the 5,644 verified proofs were Beast rather than Parity.
- Where Wizard Battle's recursive match proof is generated (browser or the backend's Mina service), and whether the `GameManager` in the repository is the contract deployed on Mina mainnet.
- Which RIVES backend version and which consensus contract run on Base mainnet today, and whether RIVES still holds paid contests.
- The publication date and full text of RISC Zero's DOOM post: the page returns 404, the Wayback Machine holds a snapshot of 2026-02-15 that this session could not open, and the cycle counts come from a search-engine extract.
- Any game on Arbitrum Stylus with real money; any Noir or Barretenberg browser game with real money; any shipped zkVM prover running in a browser for a game. The search budget ran out before I could query for these specifically.
- Dark Forest's constraint counts and verification gas, and its later prize rounds.
- Zypher's current documentation (`docs.zypher.network` not reachable) and Hyli's game posts (`blog.hyli.org` not reachable).
- Elympics' "Proof of Game" mechanism, chains and volumes beyond its marketing page.
- Budokan prize figures beyond a third-party listing.
- The Block's article on the Atari leaderboard word for word: it was read through a page summary, and a direct download returned 403.

## 8. Sources

| # | Source | Date | Type |
|---|---|---|---|
| S1 | `https://raw.githubusercontent.com/ZkNoid/zknoid/develop/packages/chain/src/arkanoid/ArkanoidGameHub.ts`, `.../arkanoid/constants.ts`, `.../arkanoid/types.ts` | repository archived 2024-10-08, *stale* | P |
| S2 | `https://raw.githubusercontent.com/ZkNoid/zknoid/develop/packages/chain/src/engine/GameHub.ts`; `https://github.com/ZkNoid/zknoid` (README, archive notice) | archived 2024-10-08, *stale* | P |
| S3 | `https://raw.githubusercontent.com/ZkNoid/zknoid/develop/apps/web/worker/zknoidWorker.ts`, `.../apps/web/lib/utils.ts`, `.../apps/web/games/arkanoid/features/useProof.ts` | archived 2024-10-08, *stale* | P |
| S4 | `https://raw.githubusercontent.com/ZkNoid/store/main/packages/games/arkanoid/workers/worker.ts`; its history at `https://github.com/ZkNoid/store/commits/main/packages/games/arkanoid/workers/worker.ts`; `https://github.com/orgs/ZkNoid/repositories` | commits 2024-09-29 and 2024-10-12; repository updated 2025-05-28 | P |
| S5 | `https://raw.githubusercontent.com/ZkNoid/wizard-battle/main/apps/mina-contracts/src/GameManager.ts`, `.../Proofs/GameRecordProof.ts`, `.../Proofs/FraudProoof.ts`, `.../apps/backend/src/mina-app.ts`, `.../apps/frontend/package.json`, `.../apps/backend/package.json`, `.../README.md` | repository updated 2026-06-07 | P |
| S6 | `https://github.com/rives-io/riv` (README) | repository updated 2026-10-14 | P |
| S7 | `https://raw.githubusercontent.com/rives-io/rives-core/main/core/tape.py`, `.../core/core_settings.py`, `.../README.md`; `https://raw.githubusercontent.com/rives-io/rives-core-nv2/main/core/tape.py`, `.../core/core_settings.py`, `.../README.md`; `https://github.com/rives-io` | updated 2025-09-24 and 2026-03-11 | P |
| S8 | `https://docs.cartesi.io/llms-full.txt` (the full documentation text), including `https://docs.cartesi.io/cartesi-rollups/2.0/resources/mainnet-considerations/`, `https://docs.cartesi.io/fraud-proofs/`, `.../fraud-proofs/fraud-proof-basics/bonds/`, `.../fraud-proofs/fraud-proof-basics/epochs/`, `.../fraud-proofs/honeypot/prt-integration/` | undated, read 2026-11-10 | P |
| S9 | `https://ethbeat.org/scaling/projects/cartesi-prt-honeypot-v2`, reached by a 301 redirect from `https://l2beat.com/scaling/projects/cartesi-prt-honeypot-v2` | page updates dated 2026-10-01 | P |
| S10 | `https://blog.alignedlayer.com/zk-arcade-now-live-2/` (2025-10-28); `https://blog.alignedlayer.com/zk-arcade-coming-soon/` (2025-10-02); `https://blog.alignedlayer.com/what-our-tokenomics-update-means-for-zk-arcade-participants/` (2026-04-01); `https://raw.githubusercontent.com/yetanotherco/zk_arcade/main/site/index.html` and `.../README.md` | 2025-10-02 to 2026-04-01; repository undated, footer 2026 | P |
| S11 | `https://raw.githubusercontent.com/yetanotherco/zk_arcade/main/games/beast/beast1984/src/sp1_prover.rs`, `.../beast1984/Cargo.toml`, `.../beast1984/sp1_program/src/main.rs`, `.../games/beast/Cargo.toml`, `.../install_beast.sh`, `.../Makefile`, `.../contracts/src/Leaderboard.sol` | undated, read 2026-11-10 | P |
| S12 | `https://raw.githubusercontent.com/yetanotherco/zk_arcade/main/games/parity/circuits/parity.circom`, `.../circuits/Makefile`, `.../web/assets/package.json` | undated, read 2026-11-10 | P |
| S13 | `https://raw.githubusercontent.com/risc0/demos/main/zkdoom/README.md`, `https://raw.githubusercontent.com/risc0/demos/main/README.md` | undated; names zkVM v0.20, *stale* | P |
| S14 | `https://risczero.com/blog/when-the-doom-music-kicks-in` (404 on 2026-11-10; the numbers are from a search-engine extract of the page); `https://risczero.com/sitemap.xml` (two URLs); snapshot listed at `http://web.archive.org/web/20260215013526/https://risczero.com/blog/when-the-doom-music-kicks-in`, not opened | post date unknown, about 2024, *stale* | S |
| S15 | `https://github.com/risc0/risc0/tree/main/examples`; `https://raw.githubusercontent.com/risc0/risc0/main/examples/browser-verify/README.md`, `.../examples/bevy/README.md`, `.../examples/chess/README.md` | undated, read 2026-11-10 | P |
| S16 | `https://code.zksync.io/tutorials/build-a-zk-game`, `https://code.zksync.io/tutorials/build-a-zk-game/writing-the-program` | updated 2025-06-09, *stale* | P |
| S17 | `https://blog.succinct.xyz/network/the-succinct-prover-network-testnet-is-live/` (2025-02-10); `https://blog.succinct.xyz/the-succinct-testnet-stage-2-is-live/` (2025-05-13) | 2025, *stale* | P |
| S18 | `https://docs.succinct.xyz/docs/sp1/getting-started/hardware-requirements` | undated, read 2026-11-10 | P |
| S19 | `https://raw.githubusercontent.com/yetanotherco/aligned_layer/main/docs/2_architecture/1_proof_verification_layer.md`, `.../docs/2_architecture/0_supported_verifiers.md`, `.../docs/2_architecture/2_aggregation_mode.md`; `https://blog.alignedlayer.com/proof-aggregation-service-mainnet-alpha/` (2026-01-23) | undated; 2026-01-23 | P |
| S20 | `https://blog.zkga.me/df-init-circuit` (2020-09-29); `https://blog.zkga.me/announcing-darkforest` (2020-08-02); `https://blog.zkga.me/intro-to-zksnarks` (2020-08-10) | 2020, *stale* | P |
| S21 | `https://dev-guides.zkga.me/snarking/running-a-remote-snarker` | undated, "v.6 Round 1", *stale* | P |
| S22 | `https://raw.githubusercontent.com/darkforest-eth/circuits/master/README.md`, `.../circuits/master/move/circuit.circom`; `https://raw.githubusercontent.com/darkforest-eth/eth/master/contracts/Verifier.sol` | undated, *stale* | P |
| S23 | `https://docs-gamma-ecru.vercel.app/lootsurvivor/technical/architecture` (the Provable Games documentation) | undated, read 2026-11-10 | P |
| S24 | `https://docs.cartridge.gg/controller/sessions` | undated, read 2026-11-10 | P |
| S25 | `https://docs-gamma-ecru.vercel.app/budokan` (P); `https://egamers.io/?p=128359`, a third-party listing of the 2026-11-09 Loot Survivor event, read as a search-engine extract only (S) | undated; 2026-11 | P, S |
| S26 | `https://book.dojoengine.org/faq` | page header v1.7.0, undated | P |
| S27 | `https://rolluplab.cartesi.io/rives/`, `https://rolluplab.cartesi.io/` | RIVES entry dated 2024-05-15, *stale* | P |
| S28 | `https://decrypt.co/249402/doom-olympics-game-competition-ethereum-base-cartesi` | 2024-09-13, *stale* | S |
| S29 | `https://minaprotocol.com/blog/first-pvp-game-on-mina-mainnet` | 2026-05-13 | P |
| S30 | `https://minaprotocol.com/?p=13151` ("Retro: Mina Web Node Testing") | 2025-04-11, *stale* | P |
| S31 | `https://github.com/corddry/zk-nintendo` | undated | P |
| S32 | `https://tickproof.vercel.app/paper` | June 2026 | P |
| S33 | `https://www.theblock.co/post/309665/stackr-hacks-atari-game-to-disprove-onchain-claim` | 2024-08-06, *stale* | S |
| S34 | `https://zyphergames.substack.com/p/zypher-network-server-abstraction` (2024-10-31); `https://zyphergames.substack.com/p/partnering-with-risc-zero-a-new-paradigm` (2024-03-26); `https://zyphergames.substack.com/p/zypher-2025-year-of-escape-velocity` (2025-01-02) | 2024 to 2025, *stale* | P |
| S35 | `https://raw.githubusercontent.com/DelphinusLab/zkwasm-mini-rollup/main/README.md` | undated | P |
| S36 | `https://raw.githubusercontent.com/BattleZips/BattleZips-Noir/main/README.md`; `https://raw.githubusercontent.com/noir-lang/awesome-noir/main/README.md` | undated | P |
| S37 | `https://www.starknet.io/blog/s-two-is-live-on-starknet-mainnet-the-fastest-prover-for-a-more-private-future/` | 2025-11-03, *stale* by one week | P |
| S38 | `https://community.starknet.io/t/snip-36-in-protocol-proof-verification/116123`; `https://docs.starknet.io/build/starknet-privacy/proving` | created 2026-02-15, replies to 2026-11 | P |
| S39 | `https://arxiv.org/abs/2510.14693` | 2025-10-16, *stale* | P |
| S40 | `https://www.elympics.ai/`, `https://www.elympics.ai/products/verifiable-replays` | footer 2025, undated | P (vendor claims) |
| S41 | `https://docs.paimastudios.com/` | footer 2024, *stale* | P |
| S42 | `https://raw.githubusercontent.com/OffchainLabs/awesome-stylus/main/README.md` | undated; the entry is dated 2024-02-26 | P |
| S43 | `https://cryptobriefing.com/arbitrum-pauses-new-stylus-activations/` | 2026-10-02 | S |
| S44 | `scratchpad/research/browser-circuit.md` and `scratchpad/research/browser-zkvm.md` (sibling reports of this workflow) | 2026-11-10 | S |
| S45 | `scratchpad/research/optimistic.md` (sibling report) | 2026-11-10 | S |
| S46 | `README.md` §7.3, §7.5, §10; `docs/VERIFICATION.md` | repository, 2026-11-10 | P |
| S47 | `scratchpad/research/proof-services.md` (sibling report), section 5 | 2026-11-10 | S |

Files downloaded for this report are in `scratchpad/research/dl-precedents/`.
