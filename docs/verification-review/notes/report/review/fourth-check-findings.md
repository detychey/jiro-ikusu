# Fourth check: the committed copy after the third check's fixes (2026-11-11)

Five checkers read the files of the pull request at commit `963b977`, after the fixes of the third check, against the default branch at `ca07ef5` and pull request 91 at `4f482cc`. Each had one question. A further reviewer then tried to refute each finding, and refuted it by default when the evidence was not conclusive.

| Checker | Question |
|---|---|
| A | Were the third check's 13 fixes applied, and did they break anything? |
| B | Is the report consistent with the owner's decision to start on a rented GPU, and with itself? |
| C | Are the numbers right, against the notes and against each other? |
| D | Is what the report says about the repository and about pull request 91 true of the trees? |
| E | Are the pull request's description and the notes index true of the folder? |

Of 19 findings, 14 held and 5 were refuted. Four of the 14 were found twice, so ten distinct corrections were made: five in the report, three in the notes index and two in the pull request's description. Two refuted findings still led to a small change, and three related edits were made on the way. None changes a recommendation.

Two direct checks ran beside the checkers:

- The committed report was regenerated from the export of the shared document and came out identical.
- No value of the session's keys or tokens appears in the folder: 13 values of 8 characters or more and the session's token file were searched for in every file of the folder and in the 80 members of `audit/scratch-tools.tar.gz`. The three 32-byte hex strings of `research/arbitrum-native.md` are public transaction hashes and a Snapshot proposal id.

## What the checkers covered

- **A** read `third-check-findings.md`, the whole diff between the two commits, and each new statement against the default branch and pull request 91. It confirmed S2, S4, S6, P2, P5, P6 and P7 as applied and correct.
- **B** read the whole report, every table included, and checked every cross-reference and every count stated in prose: 10 findings, 11 options, 11 conception steps, 15 decisions split 4, 6 and 5, and 10 work items.
- **C** ran `report/recompute.py` and checked every figure of sections 1, 3 to 6, 8 to 11, 13 and 15 against it, against the notes and against the other places where the same quantity appears: the 19 rows of the cost table, the 11 rows of times by card, the home-card table, the ranking and the economics.
- **D** checked the file and line references of section 4, the findings table included, and of appendix B at `f52a60a`: all hold what the report says. It then checked the statements about M5.5, M5.8, M5.9, the settle tool, the runbook, testnet-1 and the documents of work item 2 against the default branch, and the statements about pull request 91 against its head, in both directions.
- **E** ran the commands that the pull request's description quotes, counted the folder's files against it and against the notes index, and listed the archive.

## Findings that held

### A1 and D1 [medium] The plan's M5.9 was still described as it reads in pull request 91

- Where: `docs/verification-review/README.md`, section 10, "Measuring before choosing", and section 13, decision 2.
- Quote: "This extends plan item M5.9, which measures one rented card and builds the prover on that machine." Then: "Prove the two committed runs that M5.9 uses, three times each." Then: "Yes, first. Taken: plan item M5.9".
- Problem: the third check's S1 was fixed in five places, but these three still presented the rented card and the two committed runs as the plan's M5.9. Only pull request 91, still open, makes that true. The first sentence was added by the fix of S5.
- Evidence: `IMPLEMENTATION_PLAN.md:2106` on the default branch, "M5.9 GPU proving on the owner's card", with the deliverable "One whole bot run, and the gate set's heaviest run (131 segments, `docs/VERIFICATION.md`), proven on the owner's RTX 3060". The report's own section 4: "Until it merges, the plan names the RTX 3060."
- Change made: "This extends plan item M5.9 as pull request 91 writes it: one rented card, with the prover built on that machine." Then: "Prove the two committed runs that pull request 91 gives M5.9, three times each." Then: "Yes, first. Taken: plan item M5.9, which pull request 91 moves to a rented card". The summary's first paragraph was tightened the same way: "Plan item M5.9 is the measurement, and pull request 91 moves it to a rented card."

### A2 and B2 [medium] The notes index defined "brief" and "addendum" wrongly

- Where: `notes/README.md`, "Words of the review".
- Quote: "The brief is the question the owner asked. The addendum is the owner's later answers, listed in section 7 of the report."
- Problem: both definitions were wrong, and they came from the third check's own fix of P4. The addendum is the lead's list of eight corrected premises, of which only item 8 is the owner's direction. The brief is the lead's task text, with the lead's figures. A reader would have taken a fact tagged "addendum" for the owner's words, and would not have found it in section 7.
- Evidence: `optimistic/redteam-economic.md:3`, "against the lead's addendum", and its section 10, which lists the items from "1, GPU proving in minutes" to "8, the owner's direction". `optimistic/redteam-liveness.md:8`: "given by the lead (task context and addendum), not rechecked". `optimistic/trust.md:11`: "where the brief counts 2 to 4", hours of proving that the owner never gave.
- Change made: the bullet now says that the brief is the lead's task text, that the addendum is the lead's list of eight corrected premises given to the reviewers of the optimistic designs, that its item 8 is the owner's direction, and that the owner's questions are in section 7 of the report.

### A4 and D2 [low] The notes index named too few notes that use draft plan ids

- Where: `notes/README.md`, "Plan ids".
- Quote: "The escrow notes and `report/agents.md` number their draft items from M5.8."
- Problem: `report/cloud.md` uses a draft id too. Its M5.9 is the draft's payee item, not the plan's GPU proving. Applying the fix showed that the first two checks of the report also use the draft ids.
- Evidence: `report/cloud.md:461`, "and `--payee` once M5.9 exists". `escrow/final.md:118`, "M5.9 Payee in the zk public values". `report/review/second-check-findings.md:223` lists the draft from M5.8 to M5.14.
- Change made: "The escrow notes, `report/agents.md`, `report/cloud.md` and the first two checks in `report/review/` use draft ids from M5.8 to M5.14, written when M5.8 was the next free id."

### A5 and E3 [low] Two manifests of the scratch tools need a folder that the archive does not hold

- Where: `notes/README.md`, "The scratch tools".
- Quote: "The scripts and the Rust manifests name the review's clone at `/home/user/jiro-ikusu`. Point them at your own clone before running them."
- Problem: the manifests of `check-opt1` and `rv32/guest-opt1` point instead at `core-opt1`, the patched copy of the core, which is not in the archive. Following the sentence did not make them build.
- Evidence: in the archive, `check-opt1/Cargo.toml:8` has `jiro-core = { path = "../core-opt1" }` and `rv32/guest-opt1/Cargo.toml:8` has `jiro-core = { path = "../../core-opt1" }`. `tar tzf` lists no `core-opt1/`. Five manifests and two scripts, `compare.py` and `parse_cycles.py`, name the clone.
- Change made: the sentence now counts the files that name the clone and says how to rebuild `core-opt1`: copy `core/` to `scratch-tools/core-opt1/` and apply the flood-fill diff inside it with `patch -p2`. That command was dry-run on a copy of `core/` at `963b977`, and the diff applies.

### B5 [low] The 13-segment run was called the size of a human-style run

- Where: report, section 13, decision 5.
- Quote: "which has 13 segments and the size of a human-style run,"
- Problem: the report defines a human-style run as 15 to 18 million cycles and equates it with the 16-segment proof. The 13-segment run that pull request 91 adds is testnet-0's settled run, which was cut short.
- Evidence: report, section 3: "15 to 18 million cycles (estimate)". Finding F1: "The largest run proof has 16 segments, the size of a human-style run". `docs/DEPLOYMENT.md:176` at `f52a60a`: "13 segments of 2^20 cycles; 13,631,488 proving cycles, of which 12,592,566 user cycles".
- Change made: "which has 13 segments, a little smaller than a human-style run of 16,".

### B6 [low] "By the hour" was presented as part of the owner's decision

- Where: report, section 10, "Owner's decision of 11 November", and section 13, decision 9.
- Quote: "The project starts on a GPU rented online, by the hour." Then: "Decided on 11 November: start on a GPU rented online, by the hour."
- Problem: the owner decided to start on a GPU rented online and named no billing period. Renting by the hour is the report's recommendation.
- Evidence: the owner's words, which the pull request's description quotes: "we will rent GPU online a priori as a starter". The report's own ranking keeps the two apart: "rented by the hour, for example on RunPod", then "Renting is the owner's choice".
- Change made: "The project starts on a GPU rented online. This report recommends renting it by the hour." Then: "Decided on 11 November: start on a GPU rented online. This report recommends renting it by the hour."

### C2 [low] The RTX 5060 Ti was called the cheapest rented card

- Where: report, section 10, "An always-on rented GPU does not pay".
- Quote: "The cheapest, a marketplace RTX 5060 Ti, costs about 100 USD per month"
- Problem: the review's own price notes list a cheaper marketplace card, the RTX 3060 on Vast.ai, which the report proposes to rent for the measurement. The bullet's conclusion holds.
- Evidence: `report/cloud.md:151`, RTX 3060, 12 GB, median 0.082 USD per hour, which is 59 USD for 720 hours. Report, section 10, step 2 of the measurement: "an RTX 5060 Ti and an RTX 3060 on Vast.ai".
- Change made: "A marketplace RTX 5060 Ti costs about 100 USD per month".

### C3 [low] The CPU time of the human-style run was the range of another size

- Where: report, section 11, cost table, row "Proving on 4 CPU cores", column "Human-style run, 16 million cycles".
- Quote: "1.4 to 2.4 hours"
- Problem: 16 million cycles are 16 segments. At the report's rates that takes 1.5 to 2.1 hours. The cell held the range for 15 to 18 segments.
- Evidence: 338 to 467 s per segment and 120 to 170 s for the final step (report, section 3 and appendix B). (16 x 338 + 120) / 3,600 = 1.54 h and (16 x 467 + 170) / 3,600 = 2.12 h. The bot-style column, 9 to 12.5 hours, follows the same method with 96 segments. The repository measured a 16-segment run at 7,638 s, which is 2.12 h (`docs/VERIFICATION.md:988` at `f52a60a`).
- Change made: "1.5 to 2.1 hours". `report/cloudflare.md` quoted the old range and was corrected with it. Its rounded result, "about 0.6 to 7 USD per run on CPU", does not move.

### E1 [low] The pull request's description left the deployment notes out of work item 2

- Where: pull request description, "Proposed, for later".
- Quote: "Boundless and its price in the README, `docs/ECONOMY.md` and `docs/VERIFICATION.md`"
- Problem: work item 2 also names the deployment notes, which still quote the Boundless price.
- Evidence: report, section 14, item 2: "Remove Boundless and its price from the README, the economy notes and the verification and deployment notes." `docs/DEPLOYMENT.md:254`: "Boundless, RISC Zero's proof market, sells raw Groth16 proofs at about 0.000018 ETH on Base".
- Change made: the description names `docs/DEPLOYMENT.md` with the others.

### E2 [low] "It passed" hid eleven failing tests

- Where: pull request description, "The prototype".
- Quote: "It passed against copies of the contracts at `f52a60a`"
- Problem: the prototype's 84 new tests pass. With its changed referee, eleven of the repository's own `ZkReferee` tests fail until the proof fixtures are proven again. The notes index said so, and the description did not.
- Evidence: `escrow/spec.md:585`: "302 tests in 21 suites, 291 passing and 11 failing. The 11 are the tests of `ZkReferee.t.sol` that use the committed proofs".
- Change made: the description says both. The report's appendix had the same gap in its row "Escrow prototype", which now adds: "With the changed referee, eleven of the repository's own referee tests fail until the proof fixtures are proven again".

## Findings that were refuted

### A3 [low] The fix of S3 was applied only in part

- Claim: the "Since the review" paragraph says "two to five whole bot runs" in 48 h, which mixes the heaviest run into bot runs, and it lacks the sentence on settling during the season that S3 asked for.
- Why it was refuted: the report counts the 131-segment run among bot runs throughout, as in "9 to 17 hours", so two to five runs in 48 h follows from its own figures and matches the runbook's "2 to 5 runs in 48 h".
- Change made anyway: the claim was right on one point. The third check's record says that all its fixes were applied, and the sentence was missing. It is added: "The runbook also has the operator settle the best runs so far on every day of the season, so that the grace only has to cover the last day's best runs." Evidence: `docs/SEASON_RUNBOOK.md` on the default branch, "The operator settles every day of the season, so the queue at the end holds the best runs committed or improved on the last day".

### B1 [medium] The report credits the owner with pointing to the Ethproofs benchmark

- Claim: none of the owner's statements given to the checker mentions Ethproofs, so step 3 of section 7 credits the owner with a turning point that came from the review's own research.
- Why it was refuted: the owner did point to Ethproofs on 10 November, after the question on proofs per level. The list of the owner's statements given to this check's reviewers left that one out. The gap was in this check's task text, not in the report. `report/review/first-review-decision.md` lists "Ethproofs as reference" among the owner's questions.
- No change.

### B3 [medium] The cap of four run fees is justified only by the RTX 3060

- Claim: the cap's reason names a card that is no longer the first prover.
- Why it was refuted: the first reason, bounding what unaudited code can strand, does not depend on the card. The RTX 3060 stays a possible prover and the escrow is open to any card. Section 9 already sets the cap against a rented card: "about 0.48 USD of GPU time, more than the cap of four run fees".
- No change.

### B4 [low] Decision 9 is counted among the decisions that wait

- Claim: "six wait for the GPU measurement" includes decision 9, which is taken.
- Why it was refuted: the sentence counts the rows of each table, and the next paragraph says which decisions are taken. Decisions 1 and 2 are treated the same way, and part of decision 9 still depends on the measurement.
- No change.

### C1 [low] "Never against the cheapest marketplace cards"

- Claim: `report/recompute.py` prints finite break-even counts for the bought RTX 5060 Ti against the cheapest marketplace cards, so "never" is unsupported.
- Why it was refuted: the script's counts use mid-range values and the electricity of the card alone. On the report's basis, the whole PC, the ranges overlap: a bot-style run costs 0.007 to 0.014 USD at home and 0.012 to 0.016 USD on the cheapest marketplace card. At one end of those ranges the bought card never pays for itself.
- Change made anyway: at the other end it does, after about 77,000 runs at the lower of the two card prices. The sentence now reads "and perhaps never against the cheapest marketplace cards (estimate)".

## Related edits

- The report's first line read "after two independent reviews". It now reads "after four rounds of independent review".
- Section 2's row "This report" now ends: "Five more then re-checked that copy, and a further reviewer tried to refute each of their findings".
- The pull request's description said that no value of the session's "15 key, token or secret variables" appears in the notes. Fifteen variable names match those words, but two of them hold a value too short to search for. The description now gives what was searched for: 13 values and the token file.

## A check of these corrections

The third check's fixes had introduced four of the errors above, so three more checkers read the corrections of this check once they were committed, at `27a2484`: the changed lines of the report, this record with the notes index, and the pull request's description. A further reviewer again tried to refute each finding. Of six findings, three held, all low, and none was in the report.

- **This record gave two wrong counts.** It said that checker C had checked "the 21 rows of the cost table": the table has 19 rows, and 21 counts its header and separator lines. It said that checker D had checked "35 file and line references of section 3, of the findings table and of appendix B": section 3 holds none, and section 4 and appendix B hold 33. Both sentences are corrected above.
- **The pull request's description still said "M5.9's small run".** Only pull request 91 gives M5.9 that run. The description now says "the small run that #91 adds to M5.9".

Three findings on the report were refuted. Two of them still led to a clearer sentence:

- **Daily settlement.** The sentence added for A3 is true of the default branch. Pull request 91 changes the runbook to "In one session at mid-season, and in one after the end". The "Since the review" paragraph now says so: "It also replaces the daily settlement with one session at mid-season and one after the end."
- **Decision 9.** "Rent it by the hour." followed "Decided on 11 November:" and could still be read as part of the decision. It now reads as in section 10: "This report recommends renting it by the hour." The entry of B6 above gives that final wording.
- **The escrow's status in section 8** says "84 new tests and five invariants passing", without the eleven failing tests that the appendix now names. It was left as it is: the sentence is limited to the new tests.

## Not covered

- The default branch moved from `ca07ef5` to `6f1fcff` while this check ran, when pull request 90, the phone version's draft specification, merged. It changes line 15 of the plan and adds a block of M3 items at line 1451. In the root README it changes the roadmap's M3 row and adds one entry to the file list. It adds `docs/PHONE.md`. It touches no M5 item and nothing the report describes, and the branch still merges without conflict. The checkers did not read it.
- No GPU proof was made. Every GPU time and cloud cost in the report is still an estimate.
