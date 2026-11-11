# Verified findings of the first review (40 kept), in the order they were applied

## K1 [high] 1. Summary (consistency/C1)

- Quote: A GPU changes the picture.
- Problem: The summary never says that settlement gas costs about a quarter of a run fee, which is above the 20% rake cap. It also omits the body's recommendation of no paid mainnet season until this is fixed, and the emergency-stop vendor risk (F4, rated High). A reader of the summary alone would think the GPU fixes the cost.
- Evidence: Section 11 lead: 'about a quarter of a run fee ... more than the largest rake'. Decision 10: 'No paid mainnet season until this is solved'. F4 is rated High. escrow/final.md:9 lists the economics as the first reason to pause. Lines 7-17 of the report mention none of these.
- Fix asked: Add two bullets after the GPU bullet. '**A GPU does not fix the economics.** Settling a run costs about a quarter of its fee in gas on Arbitrum One, above the 20% rake cap (estimate). No paid mainnet season until this is solved (section 11).' '**RISC Zero's emergency stop is a vendor risk.** One key outside the project can stop settlement for good (section 4, F4).'

## K2 [medium] 1. Summary; 3 (table); 4 F1; 6 row A; 11 (cost table) (accuracy-current/A1, accuracy-current/A4, consistency/C5, consistency/C12, outsider/O1, decision/D3)

- Quote: Proving was only ever done on a CPU, by the operator, at 6 to 17 hours per run.
- Problem: A formula range is presented as observed and labelled repo. The longest run proof took 2 h 7 min. The repo's formula gives 8.7 to 10.6 h for whole bot runs and 17 h for the heaviest. 6 h is derived arithmetic. Human-style runs are about 2 h. F1's 'real runs need 67 to 131' contradicts the human-style row, and :700 is a 28-segment level proof.
- Evidence: DEPLOYMENT.md:177 (4,515.3 s, 13 segments), :245-252 (67-81 segments, 8.7-10.6 h); VERIFICATION.md:708 ('would take about 16 to 17 hours'), :988 (16 segments, 7,638.5 s). 67x338 s = 6.3 h. For 96 segments: 96x338+120 = 9.0 h; 96x467+170 = 12.5 h.
- Fix asked: Summary: 'Proving was only ever done on a CPU, by the operator. By the repository's formula a whole bot-style run takes about 9 to 17 hours and a human-style run about 2 (estimate).' Use '9 to 17 h per bot-style run (estimate from repo rates)' in section 3 and row A. Section 11 row: '1.4 to 2.4 hours | 9 to 12.5 hours | estimate from the repo's rates'. F1: 'whole bot-style runs need 67 to 131'; evidence 'docs/VERIFICATION.md:988'.

## K3 [medium] 1. Summary; 10 (time table) (accuracy-agents-cloud/C7, consistency/C4, outsider/O2)

- Quote: Third-party figures put the same proof at about 1.5 minutes on an RTX 5090.
- Problem: No third party proved this guest. The figure scales a busy-loop benchmark of 12 segments to a 100-million-cycle run. 'The same proof' tells a reviewer it was measured on this guest, which section 10 contradicts.
- Evidence: research/risc0-gpu.md:122 ('SimpleLoop benchmark guest ... 12 segments'), :378 ('none is for this project's guest'). compute_out.md: 96 x 0.8917 + 1.97 = 87.6 s. Report section 10: 'scaled from one third-party measurement of another program'.
- Fix asked: Summary: 'Scaled from a third-party measurement of another program, a bot-style run would take about 1.5 minutes on an RTX 5090 (estimate).' In the section 10 table, set the RTX 5090 basis to 'Estimate from a third-party measurement of another program'.

## K4 [medium] 3. How verification works today (table); 10; 11 (accuracy-current/A2, outsider/O7)

- Quote: Cycles per run, human style | 15 to 18 million | measured
- Problem: The figure extrapolates two single-level journals, quick clears by one player, to six levels. 'Human style' and 'bot style' are never defined. Decision 5's gate, section 10 and section 11 rest on this figure, and the cost audit warns that cautious play costs far more.
- Evidence: audit/cost.md:257: two journals, 163 and 333 ticks, 4 and 5 captures, 'A run in that style is 15 to 18M cycles'. cost.md:235: 'A level cleared with 150 small captures costs on the order of 50M cycles'. Appendix A row 'Human-style run': 2.4 and 3.0 million, scaled to six levels.
- Fix asked: Change the label to 'estimate'. Add below the table: 'A human-style run is six levels played like the two human journals in the repository, quick clears by one player. A bot-style run uses the journals of the repository's playtest bots. A cautious player who makes many small captures can need about 50 million cycles per level (estimate).'

## K5 [medium] 13. Decisions (decision 5); 14 (item 1) (decision/D1)

- Quote: Go if a human-style run proves in minutes on the owner's card
- Problem: No six-level human run file exists, so the gate cannot be run as written. Item 1 says 'one whole real run' without naming a file. The escrow notes name the fixture to use.
- Evidence: audit/cost.md:257: only two human level journals exist. escrow/final.md build order 1 names contracts/test/fixtures/zk-run.json. VERIFICATION.md:988 records it at 16 segments and 15,374,362 user cycles, which is human-style size; five of its levels were closed early (:973).
- Fix asked: Decision 5: 'Go if `contracts/test/fixtures/zk-run.json`, a run of human-style size in 16 segments, proves in minutes on the owner's card.' Item 1: replace 'prove one whole real run' with 'prove `zk-run.json` and one whole bot run of the happy path'.

## K6 [medium] 13. Decisions (decision 10); 11 (levers) (accuracy-design/A1)

- Quote: Study aggregation first: a GPU makes it cheap (section 11)
- Problem: This reverses the owner's recorded 'No aggregation' decision without saying so. The repo did not measure aggregation's proving side. Aggregated runs settle only after the season ends, which conflicts with settling during the season and with per-run bounties.
- Evidence: README.md:854 ('No aggregation (Recommended)', owner, 2026-11-02). VERIFICATION.md:782-783: the set builder's proving time is not measured, and 'runs settle only once the season's batch is proven, after the season's end'. 530,256 - 227,591 + 8,400 + 2,787 = 313,852 gas, about 13 to 14% of the fee at the report's own gas price.
- Fix asked: Decision 10: 'Compare the levers by cost per settled run. Aggregation would bring direct settlement to about 13 to 15% of the fee (estimate). It reverses the owner's no-aggregation decision of 2 November, and runs would settle only after the season ends.' Section 11: replace 'A GPU makes the extra proving cheap.' with 'Its proving time was not measured, and runs settle only once the season's batch is proven.'

## K7 [medium] 8 (Proof format); 13 (decision 6); 14 (item 4) (accuracy-design/A2, decision/D11)

- Quote: Add the payee word and the faster flood fill together, so the image id changes once.
- Problem: Section 8 says the core does not change, yet item 4 changes core/src, the referee for real-money results. The plan never says how this is checked: no vector move, no version bump, the reverse version check and the freeze rule. The only evidence is the 75 vectors on a scratch copy.
- Evidence: Report section 8: 'The core, `RULES_VERSION`, `Challenge`, `Season` and `IReferee` stay as they are.' IMPLEMENTATION_PLAN.md:1542 ('check-rules-version.sh --reverse passes: no vector changed and no version bumped'), :2011 (no PR that changes core/ merges while a season is open). escrow/final.md §2: 'core ... unchanged'.
- Fix asked: Section 8: 'The core changes only by the faster flood fill, which moves no vector.' Item 4, add: 'The flood fill moves no vector, so `RULES_VERSION` stays. Done when `check-rules-version.sh --reverse`, the property suite and the differential fuzzing pass. It does not merge while a season is open.' Decision 6: 'Yes, if those checks pass.'

## K8 [medium] 14. Proposed work plan (accuracy-design/A3, accuracy-design/A6, accuracy-design/A8, decision/D9)

- Quote: Nine work items, one pull request each, with the GPU measurement as the gate for everything that follows it.
- Problem: Items have no plan ids, sizes or dependencies, which plan §1.1 requires. The escrow notes had drafted all three. Item 4 changes ZkReferee but omits README §7.3, the ABI and the tamper tests, and item 5 omits the ABI. Item 3 points to M5.5, but M5.5's route choice still includes the closed Boundless market.
- Evidence: IMPLEMENTATION_PLAN.md:40 ('next free number in its milestone'); :1997 and :2004 (Boundless price; settle 'only when the route is a prover network'). README.md:645 fixes the public values. CLAUDE.md contracts/src row requires contracts/abi. escrow/final.md C8, C10, C11 and §6 (M5.8 to M5.14, sizes, ProofBounty L).
- Fix asked: Add: 'Each item takes the next free M5 id, from M5.8, with a size and dependencies (escrow notes, section 6). The first PR adds them to the plan. ProofBounty is size L.' Item 3: 'Season operations (M5.5), re-scoped: Boundless is gone, so the operator settles from its own GPU.' Item 4, add: 'Change README section 7.3 and regenerate `contracts/abi/`. Keep the cited score-tamper tests on a score byte and add payee-tamper tests.' Item 5, add: 'Regenerate `contracts/abi/`.'

## K9 [medium] 8. The proposed design (Residual risks); 14 (item 8) (accuracy-design/A4, outsider/O5, outsider/O6)

- Quote: Unaudited contract holding users' ETH | Testnet only, capped per run
- Problem: The table leaves out three residuals the red teams found. A bounty on a run settled outside the escrow pays a later, useless proof. Deposits stay locked when no proof can exist. Cheap decoy runs of billions of cycles can keep the one GPU busy near the deadline. The rules table gives only the benefit of branch B.
- Evidence: escrow/final.md §4: 'Bounty on a run settled outside the escrow pays for a useless proof' and 'Deposits locked until the settlement end when no proof can exist'. redteam-ordering.md:30: 'about $2-3 keeps the only prover busy'. final.md C4 (cycle cap late in grace), C16 ('claim with my own payee' button), must-have 11.
- Fix asked: Add three rows. 'A bounty on a run settled outside the escrow pays a later, useless proof | Every tool settles a funded run through `claim`.' 'A deposit stays locked until settlement closes, even when no proof can exist | The dApp replays the run before posting.' 'A few funded runs of billions of cycles, for about 2 to 3 USD, keep the one GPU busy | Own runs first, queue-aware deadlines, a cycle cap late in grace.' Item 8, add: 'a claim with my own payee button'.

## K10 [medium] 8. The proposed design (Escrow rules) (outsider/O4)

- Quote: `claim` credits the payee named in the proof, never the caller
- Problem: The payee binding holds only through a referee that checks the seal against the public values. The mock and Stylus referees ignore the proof, so with them anyone could name a payee. The rules table never says that the escrow pins one ZkReferee and refuses runs of other referees.
- Evidence: escrow/spec.md:249: post requires the run's season to settle through this contract's referee, 'else `WrongReferee`: through another referee the payee would not be proven'. final.md §2 lists WrongReferee among post's checks.
- Fix asked: Add a rule row: '| Deposits only on runs whose season settles through the escrow's own `ZkReferee` | Only that referee checks the seal against the public values that hold the payee. The mock and Stylus referees do not |'.

## K11 [medium] 7 (step 9); 8; 13 (decision 11) (outsider/O3)

- Quote: a lock with a stake required before mainnet.
- Problem: The term is a mainnet gate and the only fix for the self-claim attack, but the report never defines it. A reviewer cannot tell who locks what, for how long, or who loses the stake.
- Evidence: escrow/final.md §1 rejected table: the lock is 'a second state machine (lock, expiry, slash, who gets the stake)'. spec.md:55: it is the fix for racing provers. The report has no definition.
- Fix asked: Add to section 8, after the red-team paragraph: 'A lock with a stake would let one prover reserve a funded run for a set time. The prover posts a stake and loses it if no proof arrives in time. Rivals stop racing, and a poster cannot claim its own bounty during the lock. It adds a second state machine, so it waits for mainnet.'

## K12 [medium] 4. Findings, F3 (accuracy-current/A3)

- Quote: On a CPU one machine covers a few tens of runs per season.
- Problem: This understates the capacity problem. A best run is final only at season end, so proving falls inside the grace. One 4-CPU machine settles about two whole bot runs in testnet-0's 24-hour grace. Tens of runs need close to the 30-day maximum grace.
- Evidence: audit/consistency.md:85 ('one 4-CPU machine settles two real runs in that grace'; 'about 65 to 80 runs per machine per season' at MAX_GRACE 30 days). audit/trust.md live-1: about 2 per 24 h, 4 or 5 per 48 h, about 70 at 30 days. seasons/testnet-0.json grace 86400.
- Fix asked: 'Best runs are final only at the season's end, so proofs fall in the grace. On a CPU one machine settles about two whole bot-style runs in testnet-0's 24-hour grace, and about 70 in the 30-day maximum (estimate).'

## K13 [medium] 1. Summary; 10 (Ranking); 11 (cost table) (accuracy-agents-cloud/C1, accuracy-agents-cloud/C6, accuracy-design/A9, consistency/C8, outsider/O11)

- Quote: Proving on a home card | under 0.01 EUR of electricity | 0.01 to 0.03 EUR | estimate
- Problem: Section 10 counts the card alone and section 11 counts the RTX 3060 with the whole PC, with neither basis stated. On a whole-PC basis the RTX 3060 costs about the same as a rented card. 'Home is the cheapest' therefore holds clearly only for the planned card.
- Evidence: recompute.py: card only 0.0044 to 0.0155 EUR per bot-style run. Whole PC at 1.5 to 1.8x: RTX 3060 0.0101 to 0.0279 EUR (11 to 31 USD per 1,000), RTX 5060 Ti 0.0066 to 0.0122 EUR (7 to 14 USD). Marketplace pods: 12 to 24 USD (ranking).
- Fix asked: Section 11 cell: '0.004 to 0.016 EUR for the card alone, up to about 0.03 EUR with the whole PC'. Ranking: '5 to 17 USD of electricity for the card alone, 7 to 31 USD for the whole PC (estimate)'. Summary: 'Home is the cheapest place to prove on the planned card, and about level with a rented card on the RTX 3060.'

## K14 [medium] 1. Summary; 10 (lead, ranking); 13 (decision 8) (accuracy-agents-cloud/C3, consistency/C10, outsider/O12, decision/D6)

- Quote: AWS and Compute Engine only if a large vendor's invoice is required, and then Cloud Run
- Problem: Three places disagree about which large-cloud product to use. The lead and the summary name Cloud Run. The ranking names spot L4 virtual machines for an invoiced batch. Decision 8 mixes the two. For batches, Cloud Run is the most expensive L4 option.
- Evidence: recompute.py, per 1,000 bot-style runs: Cloud Run L4 42.5 to 47.4 USD, GCE g2 on demand 28.8 to 32.0, GCE spot 17.2 to 19.2. Cold human-style proof: Cloud Run 0.025 USD against 0.064 on g2. Ranking: 'Spot L4 on Google or AWS if a large vendor's invoice is needed'.
- Fix asked: Decision 8 Why: 'If a large vendor's invoice is required, use Cloud Run for single requests and spot L4 machines on Google or AWS for a season's batch (section 10).' Section 10 lead and summary: 'If a large cloud is required, Google Cloud Run fits single requests and spot L4 machines fit batches.'

## K15 [medium] 1. Summary; 10 (lead) (accuracy-agents-cloud/C2)

- Quote: The cheapest AWS or Google machine costs two to three times more
- Problem: This holds only at on-demand prices. The report's own ranking gives spot L4 on Google or AWS at 17 to 27 USD per 1,000 runs, close to the marketplace's 12 to 24.
- Evidence: recompute.py: GCE g2 spot L4 17.2 to 19.2 USD per 1,000 bot-style runs, AWS g6 spot 24.1 to 26.8. RunPod 4090 community 12.4 to 15.7, Vast 5090 20.3.
- Fix asked: 'The cheapest AWS or Google machine costs two to three times more on demand, and up to about one and a half times more on spot capacity, which can be interrupted (estimate).'

## K16 [medium] 6. Options considered (row B) (consistency/C2)

- Quote: About 1.5 min on an RTX 5090 and 6 to 15 min on a mid-range 16 GB card (third-party, estimate)
- Problem: The 16 GB figure is an older estimate. Section 10 gives 5.8 to 9.1 min for the RTX 5060 Ti and calls 8 to 15 min 'an earlier, rougher estimate'. The two sections disagree about the card the owner plans to buy.
- Evidence: Section 10 table, RTX 5060 Ti row: '5.8 to 9.1 min'. Section 10, below the home-card table: 'An earlier, rougher estimate put the previous card of this class at 8 to 15 minutes'. escrow/spec.md:471-476 holds the old range. recompute.py: 350 to 543 s.
- Fix asked: 'About 1.5 min on an RTX 5090 and 6 to 9 min on an RTX 5060 Ti 16 GB, per bot-style run (estimate from third-party figures); unmeasured here'.

## K17 [medium] 13 (decision 8); 10 (What the benchmark shows) (decision/D7)

- Quote: a serverless endpoint only if bounties get a deadline
- Problem: ProofBounty has no deadline per bounty. Refunds open only at settlement end, on a stop, or 7 days later. No decision introduces a deadline, so the condition in decision 8 cannot be checked.
- Evidence: escrow/final.md §2: the refund conditions are settlementEnd, a stopped verifier and CLAIM_GRACE, with no deadline field. Report section 10: 'A bounty deadline must scale with the run's cycles.'
- Fix asked: Decision 8: 'a serverless endpoint only if the owner promises a response time, such as 10 minutes. The escrow has no deadline per bounty.' Section 10: replace 'A bounty deadline must scale with the run's cycles.' with 'Any promised response time must scale with the run's cycles.'

## K18 [medium] 13. Decisions (decision 5) (decision/D8, accuracy-design/A11)

- Quote: a grace period of at least seven days, and a new deployment on Arbitrum Sepolia
- Problem: The decision approves the grace period as a side effect of the escrow go-ahead. The grace is a season parameter, owned by seasons/*.json and derived at M5.5 from the measured route. The escrow notes kept both the grace (O4) and the new deployment (O13) as separate decisions.
- Evidence: CLAUDE.md: 'seasons/*.json own the season parameters'. IMPLEMENTATION_PLAN.md:2001: the grace is 'derived from the proving route'. escrow/final.md: O4 is 'an owner decision per season'; 'Merging approves O5-O11'; O13 is 'policy ... not a technical necessity'.
- Fix asked: End decision 5's Why at '...refunds on a stopped verifier and seven days after settlement closes.' Add a row after the measurement: '| Grace for seasons with bounties | At least 7 days, set in each season file at M5.5 from the measured route | It leaves room for the prover queue and a sequencer delay |'. Change 'five wait' to 'six wait'.

## K19 [medium] 13. Decisions (decision 12) (decision/D10)

- Quote: Ask RISC Zero who holds the emergency-stop key and what the maintenance plan is; keep the SP1 branch
- Problem: F4 is rated High: a stop after some runs have settled gives those runs the whole pot. No decision covers this outcome. Section 12 says 'decide whether to pin an own verifier', but section 13 does not list that decision.
- Evidence: contracts/src/Season.sol:196: the pot rolls over only when totalQualifiedPoints == 0. :218: claims pay best.score * playersPot / totalQualifiedPoints. DEPLOYMENT.md:196 says 'the season's pot rolls over'. Report section 12: 'decide whether to pin an own verifier'.
- Fix asked: Append: 'Decide before mainnet whether to pin an own verifier, or change `Season` so that a stopped referee rolls the pot over. Until then, the documents say that runs settled before a stop share the whole pot.'

## K20 [medium] 10. What the benchmark shows (accuracy-agents-cloud/C5, consistency/C3, decision/D12)

- Quote: The cheapest costs 245 USD per month. At the bounty cap of 0.41 USD, that takes 600 bounties a month.
- Problem: 245 USD is the RunPod community RTX 4090, not the cheapest. The report's own table lists a Vast.ai RTX 5060 Ti at 0.14 USD per hour, about 103 USD a month. The conclusion holds, but the numbers are wrong.
- Evidence: compute_out.md, 'Always on 30 days': Vast RTX 5060 Ti 103, Vast RTX 3090 165, RunPod 4090 community 245. 103 / 0.41 = 251. recompute.py: 245 / 0.41 = 597.6.
- Fix asked: 'The cheapest, a marketplace RTX 5060 Ti, costs about 103 USD per month, and a RunPod RTX 4090 costs 245. At the bounty cap of 0.41 USD, that takes 250 to 600 bounties a month (estimate).'

## K21 [low] 13. Decisions (decision 4; open question) (decision/D2)

- Quote: Correct the documents and write the operator's settle tool (work items 2 and 3)
- Problem: Decision 4 is listed under Now, but parts of items 2 and 3 wait on the measurement: 'measured times' and 'the measured route'. The OS question gates item 1 but sits after the table.
- Evidence: Report section 14, item 2: 'Replace "about an hour" with measured times.' Item 3: 'on the measured route'. Section 13 closes: 'One question is still open ... The GPU prover needs x86-64 Linux.'
- Fix asked: Recommendation: 'Yes. Remove Boundless and fix the rollover claim now. Add measured times and the route after item 1.' Move the open question above the Now table: 'First, the owner confirms that the RTX 3060 machine runs x86-64 Linux. Otherwise item 1 runs on a rented card.'

## K22 [low] 8. The proposed design (Status) (accuracy-design/A5)

- Quote: The contract is prototyped: 152 lines, 84 new tests and five invariants passing against copies of the real contracts (measured).
- Problem: The prototype lacks two rules from the table, the cap per run and the refund on a stopped verifier, so the 84 tests do not cover them.
- Evidence: escrow/final.md §2: 'C2 and C3 add about 15 lines, not yet prototyped.' A grep of proto/contracts/src/ProofBounty.sol finds only CLAIM_GRACE, with no cap and no paused() check.
- Fix asked: Append: 'The prototype does not yet have the cap per run or the refund on a stopped verifier. They add about 15 lines in item 5.'

## K23 [low] 13 (decision 9); 14 (consistency/C11, decision/D5)

- Quote: Build the local MCP wrapper for the owner's agent, then publish it
- Problem: No work item covers the MCP wrapper, although decision 9 recommends building it. The same holds for the remote endpoint of section 9 and the Cloudflare front door of row K.
- Evidence: Section 14 items 1-9 name neither MCP nor Cloudflare. Section 9: 'add a free, rate-limited remote endpoint third'. Row K: 'Use it for the request API and queue only'.
- Fix asked: Item 7: 'Prover loop and its local MCP wrapper, with job ids and no key in the model's context.' After the list: 'The remote endpoint and a Cloudflare front door come later and have no item yet.'

## K24 [low] 10. What the benchmark shows (accuracy-agents-cloud/C4)

- Quote: Cloud Run allows one hour at most.
- Problem: The report does not draw the consequence. On an L4, Cloud Run cannot finish the heaviest legal run within its one-hour maximum, and an RTX PRO 6000 only just does. Yet Cloud Run is named for overflow.
- Evidence: recompute.py worst case: L4 1.14 to 1.27 h, RTX PRO 6000 37 to 58 min, before start-up. cloud-check.md flaw 6.
- Fix asked: Append: 'On an L4, Cloud Run cannot finish the heaviest legal run, which needs about 1.1 to 1.3 hours. An RTX PRO 6000 needs 37 to 58 minutes (estimate). Send such runs to a machine without a limit.'

## K25 [low] 9. Where x402 could fit later (accuracy-agents-cloud/A1)

- Quote: The x402 package for MCP caps a paid call at 60 s by default and 600 s at most, so only short proofs fit.
- Problem: Both numbers are configurable defaults, not hard limits. The 60 s is the payment timeout. The 600 s is a client default cap that can be raised.
- Evidence: report/chk/pkg/package/README.md:276: 'maxRequestTimeoutSeconds | number | 600'. :288: 'maxTimeoutSeconds | No | Payment timeout (default: 60)'. agents-check.md:38.
- Fix asked: 'By default the x402 package for MCP waits 60 s for payment and caps the call at 600 s. Both can be raised, but the call must stay open for the whole proof.'

## K26 [low] 6. Options considered (row K) (accuracy-design/A13)

- Quote: containers stop at 4 vCPU and 12 GiB; 0.6 to 7 USD per run on CPU
- Problem: No working note holds these figures, yet the appendix says that everything can be re-checked from the notes.
- Evidence: A grep for 'cloudflare' over research/, design/, audit/, escrow/ and report/*.md finds only the report drafts and unrelated downloads. cloud.md has no Cloudflare rows.
- Fix asked: Label the limits as third-party and the cost as an estimate: 'containers stop at 4 vCPU and 12 GiB (third-party); about 0.6 to 7 USD per run on CPU (estimate)'. Then add the cost arithmetic to the working notes, or drop the cost figure.

## K27 [low] 1. Summary; 3; 5; 9; 10 (consistency/C7, accuracy-agents-cloud/C9)

- Quote: A rented consumer GPU costs 1 to 2 US cents per heavy run.
- Problem: 'Heavy run', 'heaviest run' and 'heaviest legal run' name three different workloads: 100 million, 130.7 million and 2.9 billion cycles. A reader can take the 1 to 2 cents as the cost of the worst case, which is 0.48 USD.
- Evidence: Section 9: 'The heaviest legal run would cost about 0.48 USD'. Section 5: 'the heaviest six-level run'. recompute.py: 0.012 to 0.022 USD per bot-style run on marketplace cards.
- Fix asked: Summary: 'A rented consumer GPU costs 1 to 2 US cents per bot-style run of 100 million cycles.' Elsewhere, write 'cost-maximising run (2.9 billion cycles)' for the scripted case and 'heaviest documented run' for the 130.7 million one.

## K28 [low] 14. Proposed work plan (item 1) (accuracy-design/A7)

- Quote: Add the `cuda` build feature to the host.
- Problem: The item leaves out a red-team warning and three items in final.md. The lockfile change forces a clean CI build of about an hour while Actions minutes are nearly spent. final.md also asks for an execute-run command and a record of the OS and of whether Docker ran.
- Evidence: escrow/redteam-implementation.md:23: 'adding the `cuda` feature changes referee/zk/Cargo.lock ... 62 min 35 s ... about 1,460 of 1,500'. escrow/final.md build order 1: 'whether Docker ran, OS; add `execute-run` ... Lockfile change in a PR without `ci:heavy`'.
- Fix asked: Append: 'The lockfile change forces a clean CI build of about an hour, so open the PR without `ci:heavy`. Add an `execute-run` command that prints a run file's cycles. Record the OS and whether Docker ran.'

## K29 [low] 8. The proposed design (Proof format) (consistency/C14, outsider/O13)

- Quote: Public values grow from 384 to 416 bytes per level and from 2,304 to 2,336 per run.
- Problem: Read literally, six levels at 416 bytes make 2,496, not 2,336. The payee is one word per proof, not one per level.
- Evidence: escrow/final.md §2: ZkReferee checks length 'levelCount * 384 + 32'. 6 x 384 + 32 = 2,336, and 384 + 32 = 416.
- Fix asked: 'The payee is one word at the end of each proof. Public values grow from 384 to 416 bytes for a level proof and from 2,304 to 2,336 for a run proof.'

## K30 [low] 8. The proposed design (What three red-team reviews changed) (accuracy-design/A12, consistency/C9)

- Quote: None found a way to steal a bounty. They added four things.
- Problem: The red teams also added the cap per run, the check of run files against chain data and the checksummed payee. The cap appears in the rules table with no source and no reason for the value 4.
- Evidence: escrow/final.md C3 (cap, liveness #8: '4, not 2: a heavy legal run on a 3060 may cost more than 2 fees of power'), C5 (ordering #5), C6 (implementation #8).
- Fix asked: Replace 'They added four things.' with 'Their main additions follow.' Then append: 'A bounty is capped at four run fees, because a heavy legal run on the RTX 3060 may cost more than two fees of power (estimate). The prover checks each run file against chain data, and the host refuses a payee without a checksum.'

## K31 [low] 2. Scope, method and evidence labels; 12 (consistency/C6)

- Quote: A usage limit cut off two reviewers of the optimistic designs.
- Problem: Section 12 says 'Two of three reviewers finished', so one reviewer was cut off, not two. The notes show only one unfinished red-team review. Whether a designer was also cut off was not confirmed.
- Evidence: design/ holds redteam-economic.md and redteam-liveness.md. redteam-implementation-work/ has no report. The report's section 12 row reads 'Two of three reviewers finished; they agree'.
- Fix asked: 'A usage limit cut off one of the three red-team reviewers of the optimistic designs.' If a designer was also cut off, name it in the same sentence and in section 12.

## K32 [low] 2. Scope, method and evidence labels (consistency/C13)

- Quote: Eleven topics on alternatives, from primary sources read on the day
- Problem: Appendix C lists nine research notes. The other two topics, agents and cloud hosting, sit in report/. A reader may count eleven options instead.
- Evidence: Appendix C: 'research/ | Nine notes'. The scratchpad research/ folder holds nine .md files. report/agents.md and report/cloud.md are the other two.
- Fix asked: 'Nine topics on alternatives, plus agents and cloud hosting, from primary sources read on the day'.

## K33 [low] 6. Options considered (row G) (accuracy-design/A14)

- Quote: a permissioned reopening early 2027 at best
- Problem: The source gives mid-December 2026 as the earliest date and Q1 2027 as the likely one, with neither assured. 'At best' turns the likely date into the earliest.
- Evidence: research/arbitrum-native.md:266: 'Not before mid-December 2026, more likely Q1 2027, subject to an onchain vote'.
- Fix asked: 'a permissioned reopening not before mid-December 2026, more likely in early 2027, and not assured'.

## K34 [low] 3. How verification works today (step 6); 1; 2 (outsider/O14, accuracy-current/A10)

- Quote: After the season end plus a grace period, the pot is shared pro rata among settled best runs.
- Problem: The pot is shared by score after the rake, among qualified players only, and it rolls over if none qualify. 'Qualified', 'settlement closes' and 'gate set' are used later but never defined.
- Evidence: README.md:711-712: ranking and rewards among 'qualified players', minClears 1 by default, rake, rollover. contracts/src/Season.sol:194-196, :218.
- Fix asked: 'After the season end plus the grace period, when settlement closes, the pot minus the rake is shared by score among qualified best runs. A run qualifies by clearing at least the season's minimum number of levels, one by default. With none, the pot rolls over.' At first use of 'gate set', add 'the repository's reference vectors'.

## K35 [low] 3. How verification works today (outsider/O10)

- Quote: A paid run counts only once a contract has checked a zero-knowledge proof that its public input journals produce the claimed result.
- Problem: Here a journal is the player's input log. In RISC Zero, the journal is the guest's public output, which this report calls public values. A ZK reviewer will mix the two up.
- Evidence: Section 3, step 3: 'one journal per level' of input changes. Section 8 uses 'Public values' for the guest output. The report never relates the two terms.
- Fix asked: Add after step 3: 'Here a journal is the player's input log. What RISC Zero calls the journal, the guest's public output, is called the public values in this report.'

## K36 [low] 8. The proposed design (outsider/O9)

- Quote: The escrow settles the run through the unchanged `Challenge` and credits that payee, whoever sent the transaction.
- Problem: In section 4, 'credit' means the score that goes to the run's player. Here it means ETH owed to the prover. A reader may think the payee takes the score.
- Evidence: Section 4: 'Anyone may settle, and the credit always goes to the run's player.' escrow/final.md §2: claim credits the bounty to payeeOf(proof), and the score still goes to the player through Challenge.
- Fix asked: 'The escrow settles the run through the unchanged `Challenge`, so the score still goes to the player. It then owes the bounty to that payee, whoever sent the transaction.'

## K37 [low] 4. Findings (What holds) (accuracy-current/A5)

- Quote: The referee is a per-season parameter, so a new backend does not touch the money contracts.
- Problem: This is true of the contracts, but the deployment policy redeploys all four contracts for a new image id. The report's own item 9 is a second generation.
- Evidence: docs/DEPLOYMENT.md:195: 'What forces a new generation: ... a new verify program, whose image id ZkReferee pins'. escrow/final.md C14: the new generation is policy, not forced by Season.
- Fix asked: 'The referee is a per-season parameter, so a new backend needs no change to the money contracts. Deployment policy still redeploys all four contracts for a new image id.'

## K38 [low] 4. Findings, F5 (accuracy-current/A6)

- Quote: and no automated check ties it to the source.
- Problem: This is overstated. The live end-to-end script checks that zk-host's image id equals ZkReferee.imageId() before it proves. What is missing is a check in CI.
- Evidence: scripts/contracts/e2e.mjs:827: assertEqual('zk-host image-id, the verify program ZkReferee pins', zkHost(['image-id']), referee.imageId()).
- Fix asked: 'and only the live end-to-end script compares it with the deployed referee. CI never does.'

## K39 [low] Appendix B; 4 (F7) (accuracy-current/A8)

- Quote: 295 to 410 s per segment, 43 to 57 s of recursion per segment, 120 to 170 s for the final step
- Problem: The cited lines give 396 to 408 s and 51 to 56 s. The bounds 295 s and 43 s come from DEPLOYMENT.md:178, and 410 s and 57 s from VERIFICATION.md:990. F7's 69% is at :943, not at :771 or :933.
- Evidence: VERIFICATION.md:708 ('396 s each ... 408 s ... 51 to 56 s'); DEPLOYMENT.md:177-178 (295 s, 43 s, Groth16 122.5 s); VERIFICATION.md:990 (410 s, 57 s); :943 ('69% of the fee').
- Fix asked: Set the Where cell to '`docs/VERIFICATION.md:708`, `:990`; `docs/DEPLOYMENT.md:177-178`'. Add '`:943`' to F7's evidence.

## K40 [low] 9. Agents (x402 table, Chain row) (accuracy-agents-cloud/A3)

- Quote: No hosted facilitator serves Arbitrum Sepolia; a self-hosted one can
- Problem: The sources show only that no hosted facilitator lists Arbitrum Sepolia. Some directory entries say only 'EVM', and the notes mark the point as not verified.
- Evidence: agents-check.md:28: 'Corbits, Dexter and Solvador say only "EVM"'. agents.md, under 'Could not verify': 'whether any serves Arbitrum Sepolia'.
- Fix asked: 'No hosted facilitator lists Arbitrum Sepolia, though some list only "EVM"; a self-hosted one can'.


# Rejected by the skeptic

- accuracy-current/A7: The 120 ms figure is the lead's own measurement, recorded in design-resume.js:20 and with its method in appendix A. The audits' 143 ms and 185 ms used other methods or levels. The gap is method noise and changes no conclusion.
- accuracy-current/A9: Chained circuit proofs need a second implementation of the rules, which the owner excludes, and have no cheap verifier. Section 5's conclusion stands. Memory64 does not change it either. Adding these points would add nuance, not correct the report.
- accuracy-design/A10: '2 to 7 s on one to sixteen cards' is accurate for the Ethproofs leaders (Airbender 6 s on one card, Pico 6.3 s on four). Row B's 16 GB range is fixed under consistency/C2.
- accuracy-agents-cloud/A2: The reviewer's corrected value, 0.059 to 0.063 USD, lies inside the report's 0.05 to 0.07. Nothing misleads.
- accuracy-agents-cloud/A4: The SDK v1 compatibility risk concerns an optional endpoint that the report already defers until after mainnet economics are settled. It does not affect any decision.
- accuracy-agents-cloud/C8: Lambda's start date and Hetzner's VAT do not change any ranking or decision. Both providers are already among the costlier or set-up-heavy options.
- decision/D4: The rules table already answers front-running: copied proofs are worthless and payment is once per run id, with re-randomization tested. A separate MEV paragraph would be length, not a correction.
- outsider/O8: Adding a conception step mostly adds length. The useful part, the reasons for the cap of 4 fees and the 7-day grace, is folded into accuracy-design/A12 and decision/D8.
- consistency/C14 (second part): '50 to 90 times' rounds 109 to 187 million gates over a limit of a little above 2 million gates. It is approximate, not wrong.
- accuracy-design/A3 (claim of 11 failing tests): The fix does not need this claim and I did not re-check it. The kept finding rests on README:645, CLAUDE.md and final.md C8 and C11.

# Overall

The report works for its purpose once the kept findings are fixed: the direction holds (keep the proof, measure a GPU, build the escrow for testnet only), and its arithmetic recomputes. Three weaknesses matter for decisions. The summary leaves out the main blocker: settlement gas is above the 20% rake cap. Headline CPU and GPU times are presented as observed or third-party, though they are scaled estimates. The go/no-go gate names a run file that does not exist, while zk-run.json fits. Next in weight: the residual risks, the pinned referee, the lock with a stake, and the work-plan obligations (plan ids, ABI, README 7.3, a re-scoped M5.5). The aggregation advice and the cloud-vendor advice also need rewording, along with several numbers that disagree between sections.
