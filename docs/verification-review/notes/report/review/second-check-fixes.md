# Check of the 40 applied findings (doc-rev101.md)

## Per finding
- K1 fixed (summary bullets 14-15). K2 fixed: 9 to 17 h, 9 to 12.5 h and 1.4 to 2.4 h recompute (96x338+120 = 9.05 h; 96x467+170 = 12.5 h; 15-18 segments give 1.44 to 2.38 h); F1 cites :988 (16 segments, 7,638.5 s).
- K3 fixed in the summary and the 5090 row. The L4 row still reads "One third-party measurement of another program", with no "Estimate" (finding 5).
- K4 fixed (label, "Two reference runs" paragraph; cost.md:235, :257). K5 fixed in decision 5, item 1 and section 12. Section 10 "Measuring before choosing" step 3 still proves "a human-style run", which has no file (finding 6).
- K6 fixed. 313,852 gas at final.md:61's price (0.0000123-0.0000136 ETH for 588,700 gas) = 13.1 to 14.5% of the fee. README:609 says aggregation is reconsidered before mainnet.
- K7 fixed. check-rules-version.sh --reverse exists (lines 11, 18, 55-67); plan :2011 has the freeze rule.
- K8 fixed. The plan's M5 table ends at M5.7, M5.4 is deferred, so the next id is M5.8 (redteam-implementation.md:22). M5.5 is season operations (plan :1902).
- K9 fixed. "2 to 3 USD" comes from redteam-ordering.md:30. The "refund opens after 7 days" wording is ambiguous (finding 7).
- K10 fixed (spec.md:249). K11 fixed. The lock text matches final.md:39 and is consistent with decision 12.
- K12 fixed: 24 h / 9-11 h = about 2; 720 h / 9-10.6 h = 68-80 (consistency.md:85).
- K13 fixed in the summary, section 10 and the ranking. Whole-PC figures recompute (recompute.py: 3060 0.0101-0.0279 EUR, 5060 Ti 0.0066-0.0122 EUR; x1.12 gives 0.011-0.031 and 0.007-0.014 USD). Two places were not moved to the new basis. In section 11, the bot-style home cell "0.01 to 0.03 EUR" should start at 0.007 (finding 4). The break-even "tens of thousands" still uses card-only electricity, e1e8 = 0.0063 USD in recompute.py:33 (finding 2).
- K14 and K15 fixed (spot L4 17-27 USD against marketplace 12-24). K16 fixed. K17 fixed. K18 fixed: decision 7 was added and the count of six is right. K19 fixed (Season.sol:196, :218). K20 fixed (103/0.41 = 251; 245/0.41 = 598).
- K21, K22, K23 fixed. K24: 1.1 to 1.3 h is correct (recompute: 1.14 to 1.27 h). The RTX PRO 6000 sentence was dropped, but nothing is wrong.
- K25 fixed. The added "not verified" sentence is supported by agents-check.md:45.
- K26 fixed. report/cloudflare.md supports 4 vCPU, 12 GiB, 0.40 USD/h and 0.56 to 6.8 USD. However, the archive sent to the owner does not contain report/ (finding 1).
- K27 fixed (cost-maximising run, 2.9 billion cycles). K28 fixed: redteam-implementation.md:23 and final.md:116; the `ci:heavy` label exists in .github/workflows. K29 and K30 fixed (final.md C3, C5, C6). The new cap reason is weak (finding 3).
- K31 fixed. design/ holds no judge.md, but the notes do not show that a usage limit stopped the judge (finding 8). K32, K33, K34 (README:711-712), K35, K36 and K37 fixed. K38 fixed (e2e.mjs:827). K39 fixed (VERIFICATION :708, :990, :943; DEPLOYMENT :177-178, :245-252). K40 fixed.

## Unrequested changes
- Front-running paragraph: supported by spec.md:49 (reverted claim in calldata; eth_estimateGas visible to the RPC provider).
- Lock with a stake: consistent with final.md:39 and O3.
- "This report" row: six reviewer files plus verify.md; acceptable.
- Two reference runs: supported (cost.md:235, :257).
- 0.12 to 0.19 s: 120 ms (lead, design-resume.js:20), 143 ms (ops.md:11, means of 20), 185 ms (ux.md:385, the six slowest levels, median of 15). Fine.
- 32-bit WebAssembly sentence: fine.
- Cloudflare row K: matches cloudflare.md, but that file is not in the archive the owner received.

## Findings (see structured output)
1. medium: Appendix C names report/ (including the Cloudflare arithmetic and the review), but verification-review-notes.tar.gz (10 Nov 16:12) has no report/ folder.
2. low: break-even not recomputed on the whole-PC basis.
3. low: the reason for the cap ("four, not two") is contradicted by the report's own 3060 figures.
4. low: section 11 home cell, 0.01 should be 0.007.
5. low: L4 basis has no estimate label.
6. low: the measurement step proves a "human-style run" that has no file.
7. low: "the refund opens after 7 days" is ambiguous.
8. low: the judge was "cut off" in section 2 but "not run" in section 12.
