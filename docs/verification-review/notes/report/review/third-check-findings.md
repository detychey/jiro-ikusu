# Third check: the copy committed to the repository (2026-11-11)

Two checkers read the files of the pull request before it was finalised. One compared the report with the default branch at `ca07ef5` and with pull request 91. The other looked for anything that should not be published. Their findings are below; all were applied.

## Staleness against the current tree

Verdict: The report is mostly accurate on the current tree, and its numbers match pull request 91 (0.34 USD an hour, 2.2 to 2.8 min, 13 and 131 segments, 16 GB, no key on the rented machine). It has one real problem. Several sections describe the rented card and the 13-segment run of M5.9 as current plan content. Only the still-open pull request 91 makes that true: the plan on the default branch still says RTX 3060 and one whole bot run. One more statement is now stale: in F5, settle.mjs now also compares the image id. Four optional fixes follow. Notes: scratchpad/report/prcheck/staleness.md

Checked: I read all of docs/verification-review/README.md, plus IMPLEMENTATION_PLAN.md (M5.5, M5.6, M5.8, M5.9, G2, G2b, G3, risks), SEASON_RUNBOOK.md, TESTNET.md, and the ECONOMY.md and DEPLOYMENT.md diffs since f52a60a. I checked seasons/testnet-1.json, web/scripts/settle.mjs, web/src/pages/settle.ts, web/season.html, and scripts/contracts image-id checks. I also read README.md lines 590, 671 and 754, the root README diff, the three PR 91 patches and the notes/ folder listing. Note: HEAD became 1b1fe82 during the check, a commit holding the review files with the same content.

### S1 [high] docs/verification-review/README.md

- Quote: The owner chose GPU proving, and plan item M5.9 measures it on a rented card, which will answer F1 and size F3.
- Problem: Only the open PR 91 makes M5.9 a rented card with a 13-segment run. The current plan says the owner's RTX 3060 and one whole bot run. G2 'Chosen' and the runbook also name the RTX 3060. Lines 163, 461, 482, 489 and 497 make the same claim. If this PR merges first, the public report contradicts the plan.
- Evidence: IMPLEMENTATION_PLAN.md:1906 'GPU proving on the owner's card'; :1999 'Chosen ... the owner's RTX 3060'; M5.9 deliverable 'One whole bot run, and the gate set's heaviest run ... on the owner's RTX 3060'; SEASON_RUNBOOK.md:34 route RTX 3060. PR 91 patch changes all of these.
- Fix asked: Merge this PR after PR 91. Otherwise, add to the 'Since the review' paragraph: 'Pull request 91, still open, moves M5.9 to a rented card. It also records the owner's choice to rent. Until it merges, the plan names the RTX 3060.' In decision 5, write 'the small run that pull request 91 adds to M5.9'.

### S2 [medium] docs/verification-review/README.md

- Quote: only the live end-to-end script compares it with the deployed referee. CI never does.
- Problem: Since M5.5, the operator's settle tool also checks that zk-host's image id matches the referee before it proves. The 'Since the review' paragraph still says the other findings stand. The CI part of F5 is still true.
- Evidence: web/scripts/settle.mjs:42-45 checkProverImage reads ZkReferee.imageId() and compares it with `zk-host image-id`, then throws on a mismatch. There is still no CI job doing this.
- Fix asked: Add to the 'Since the review' paragraph: 'M5.5 also made the settle tool compare the image id with the referee before proving. CI still never compares it with the source, so F5 stands.'

### S3 [low] docs/verification-review/README.md

- Quote: On a CPU one machine settles about two whole bot runs in a 24-hour grace period, and about 70 in the 30-day maximum (estimate).
- Problem: The 24 h example is testnet-0's grace. README §8.4 proposes 48 h, and testnet-1 uses 48 h. The runbook now settles the best runs so far during the season, which the finding does not mention.
- Evidence: seasons/testnet-1.json grace 172800; README.md:740 'Proposed: 48 h'; SEASON_RUNBOOK.md:13 and :38 settle during the season; runbook §5 gives '2 to 5 runs in 48 h' on a CPU.
- Fix asked: Write: 'On a CPU one machine settles about two to five whole bot runs in testnet-1's 48 h grace. The runbook settles the best runs so far during the season, but a later best run still needs a proof in the grace.'

### S4 [low] docs/verification-review/README.md

- Quote: Remove Boundless and its price from the README and the verification and deployment notes.
- Problem: docs/ECONOMY.md also quotes the Boundless price as a live cost, along with the 69% figure that F7 disputes. The list leaves it out.
- Evidence: docs/ECONOMY.md:42 'Boundless: about 0.0000184 ETH ($0.042) per raw Groth16 proof'; :44 'plus 0.0000184 ETH of proving ... 69% of the 0.00005 ETH fee'.
- Fix asked: Write: 'Remove Boundless and its price from the README, the economy notes and the verification and deployment notes.'

### S5 [low] docs/verification-review/README.md

- Quote: Build the image once, off the rented machines, and check its image id against the deployed contract.
- Problem: PR 91's gpu-measure.sh builds on the rented machine, and the runbook keeps the pod's disk so the build runs only once. A reader may take this step as a description of M5.9.
- Evidence: PR 91 plan patch: gpu-measure.sh 'installs the zk toolchain, builds with --features cuda, prints the card and the image id'; runbook patch: 'keep the pod's disk between sessions, so that the build is done once'.
- Fix asked: Add after step 1: 'M5.9 builds on the rented machine itself. A prebuilt image is a later saving, not part of M5.9.'

### S6 [low] README.md

- Quote: - `docs/verification-review/` (linked to its README): the review of 2026-11-10 of how level completion is verified
- Problem: The new line sits between the style guide entry and the brand/ entry. Those two entries belong together. The line's content is accurate.
- Evidence: README.md 'Repository files': STYLE_GUIDE.md line, then the new line, then the brand/ line, which builds the identity that the style guide describes.
- Fix asked: Move the line below the brand/ entry, just before the IMPLEMENTATION_PLAN.md entry. Keep the text unchanged.

## Publication readiness

Verdict: Safe to publish once the medium finding is fixed. I found no secret, credential or keyed RPC URL. I found no personal data beyond what the repository already publishes, no prompt text that instructs an agent, no legal or financial advice stated as fact, and no ready-made exploit against a live system. No file triggers the Rust or contract checks. The root README edit sits outside section 4, and check-rule-tags.sh passes. All relative links resolve, and notes/README.md describes the folder truthfully. The one medium issue is that the old draft plan ids clash with the plan's real M5.8 and M5.9. The low findings are wording and path tidy-ups.

Checked: All 59 files under docs/verification-review, plus the archive, listed and extracted under prcheck/tar. I grepped for keys, tokens, hex secrets, addresses, emails, absolute paths, home details, agent wording, legal terms and strong claims about vendors. I read all four Python scripts and ProofBounty.sol. I checked the path filters of ci.yml and the other workflows, and ran scripts/check-rule-tags.sh. I checked every relative link and checked notes/README.md against the files. I compared the report's claims about the current tree with the plan, the runbook and the PR 91 patches. Notes: scratchpad/report/prcheck/publication.md

### P1 [medium] docs/verification-review/notes/README.md

- Quote: They are kept as evidence, as they were written: where a note and the report disagree, the report is the later text.
- Problem: Several notes use draft plan ids that now name other plan items. In final.md, M5.8 is the GPU measurement and M5.9 is the payee word. In spec.md, M5.9 is ProofBounty, and agents.md says everything waits on M5.8. The real plan has M5.8 as season operations and M5.9 as GPU proving. A public reader will take the drafts for plan items.
- Evidence: escrow/final.md:116-123 (M5.8 GPU proving measurement, M5.9 payee). escrow/spec.md:526-530 (M5.9 ProofBounty). report/agents.md:328 (M5.8 is the GPU measurement). redteam-implementation.md:48-53. The plan's merged M5.8 is season operations, and PR 91 is M5.9, GPU proving. Only the report (README.md:529) warns about this, and only for the escrow notes.
- Fix asked: Add a bullet under "What to know before reading": "**Plan ids.** The escrow notes and `report/agents.md` number their draft items from M5.8. The plan has since used M5.8 for season operations and M5.9 for GPU proving. A draft id in these notes is not a plan item."

### P2 [low] docs/verification-review/notes/optimistic/redteam-economic.md

- Quote: FOUNDRY_SOLC=/root/.local/share/svm/0.8.28/solc-0.8.28
- Problem: An absolute path from the review machine was not normalised, unlike the scratchpad/... paths. The same path appears in redteam-liveness.md:350.
- Evidence: notes/optimistic/redteam-economic.md:288 and notes/optimistic/redteam-liveness.md:350 both set FOUNDRY_SOLC=/root/.local/share/svm/0.8.28/solc-0.8.28.
- Fix asked: In both files, replace it with FOUNDRY_SOLC=<svm>/0.8.28/solc-0.8.28. Then add to the Paths bullet of notes/README.md: "`<svm>` is the local solc install of svm."

### P3 [low] docs/verification-review/notes/README.md

- Quote: the timing and profiling scripts, with the paths of the review's container
- Problem: The README says only the scripts hold container paths. Six Cargo.toml manifests in the archive also point to core, so they build only with a clone at that path.
- Evidence: tar -tzf, then grep: check-base, nibbler, native-stats, restore-check and rv32/guest Cargo.toml line 8 hold jiro-core = { path = "core" }, as does the sixth manifest. compare.py:8 and parse_cycles.py:3 hold the same root.
- Fix asked: Replace the sentence with: "The scripts and the Rust manifests name the review's clone at `/home/user/jiro-ikusu`. Point them at your own clone before running them."

### P4 [low] docs/verification-review/notes/README.md

- Quote: **Paths.** `scratchpad/...` names the review's working directory, which was not kept. Only the files in this folder were.
- Problem: The notes use workflow words that a public reader cannot decode. Examples are "the lead", "task context", "the lead's addendum", "the brief", and the draft names doc-rev40.md and doc-rev101.md. They read as traces of agent prompts, and the README explains none of them.
- Evidence: optimistic/minimal.md:5 says "[L] measured by the lead (task context)". redteam-economic.md:3 and :251 refer to the lead's addendum. trust.md:11 and :17 refer to the brief. report/review/first-review-*.md headers say "Review of doc-rev40.md". second-check-*.md headers name doc-rev101.md.
- Fix asked: Add a bullet: "**Words of the review.** The lead is the reviewer who ran the review and wrote the report. The brief is the question the owner asked. The addendum is the owner's later answers, listed in section 7 of the report. doc-rev40.md and doc-rev101.md are drafts of the report."

### P5 [low] docs/verification-review/notes/research/attestation.md

- Quote: ### 5.2 Gelato Web3 Functions: shut down
- Problem: The heading and the table row ("sunset in 2026", line 227) state a vendor's shutdown as fact. The note itself says the date comes only from a competitor's guide [S], and that Gelato's own pages could not be opened.
- Evidence: attestation.md:128 says "A competitor's migration guide says ... [S] (G1)". attestation.md:245 lists "Gelato's own statement of the Web3 Functions shutdown" as not verified, with the date from a competitor.
- Fix asked: Heading: "### 5.2 Gelato Web3 Functions: reported shut down". Table row at line 227: "reported sunset in 2026 (not confirmed by Gelato)".

### P6 [low] docs/verification-review/notes/optimistic/redteam-liveness.md

- Quote: Who controls the stop's owner key since the vendor's pivot
- Problem: "Pivot" describes RISC Zero's business as fact. The only source is the lead's unpublished addendum. proof-services.md:269 repeats "after the pivot". The sourced fact is narrower: the Boundless market paused on 2026-11-05.
- Evidence: redteam-liveness.md:54 tags the row "L (addendum 2)", which is not rechecked per line 8. proof-services.md:13 quotes only the Boundless Foundation's pause announcement.
- Fix asked: redteam-liveness.md:54: "Who controls the stop's owner key since the Boundless market paused". proof-services.md:269: "of who holds the emergency-stop key since the Boundless market paused".

### P7 [low] docs/verification-review/README.md

- Quote: The notes behind this report are in the repository, in `docs/verification-review/notes/`, beside the export of this report.
- Problem: There is no export. The report is README.md in the same folder, so "the export" points to nothing.
- Evidence: find docs/verification-review -maxdepth 1 -type f lists only README.md.
- Fix asked: "The notes behind this report are in the repository, in `docs/verification-review/notes/`, beside this report."
