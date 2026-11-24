# Owner / outsider check of doc-rev101.md (2026-11-11)

Repo facts for the first step (f52a60a):
- contracts/test/fixtures/zk-run.json exists; VERIFICATION.md:988 proves it in 16 segments, 15,374,362 user cycles: human-style size. OK.
- IMPLEMENTATION_PLAN.md has M5.5 (:1987); M5.4 deferred (:2164); no M5.8 anywhere: free. OK.
- scripts/check-rules-version.sh accepts --reverse (:11-19). OK.
- ci:heavy used by zk-prove.yml:57, e2e.yml:27/:99, nightly.yml:41, stylus-gas.yml:25. OK.
- But ci.yml zk-exec (:400-460) runs on any PR touching referee/zk/** whatever the label, cold build ~63 min. So "no ci:heavy" does not avoid the hour build.
- No whole bot run file is committed (seasons/testnet-0/runs/ has run-1 only, --short). testnet-0 run 2 committed six full journals onchain (DEPLOYMENT.md:5).
- zk-host already has `execute-run` for six vectors (main.rs:14); a run-file variant is what is missing.

Counts: section 13 = 4 + 6 + 5 = 15, matches header. Section 14 = 10 items, cross-refs from decisions 2, 4, 5, 6, 10 match.
Options 11 = 2 kept + 1 reserve + 8 dropped. F1-F10 = ten.

Notes archive: verification-review-notes.tar.gz (Nov 10 16:12) holds audit/, escrow/, optimistic/, research/ only. No report/ folder (agents.md, cloud.md, cloud-check.md, recompute.py, cloudflare.md written 11 Nov, review/). Appendix C claims report/ was sent.

escrow/final.md vs report:
- Verdict point (3) "with one prover, the escrow mostly pays the owner money players post" is absent.
- Must-have 12 "payee should be a cold address or a Safe" absent.
- O13 (new generation) only implied by item 10; O12 implied by item 5. Acceptable.
- Draft ids (M5.9 payee, M5.10 escrow ...) no longer match once docs and flood fill take ids.

Arithmetic:
- Bot-style bounty floor: spec.md:471 claim gas 0.047-0.053 USD + withdraw 0.002 + RTX 5090 GPU 0.017-0.020 = 0.066-0.075 USD; report says about 0.06 (agents.md:212 used human claim gas).
- All section 10/11 figures re-run with recompute.py: match.

Consistency:
- Section 14 "Before any mainnet season" lists 3 of the 5 mainnet decisions of section 13 (omits vendor risk, replay cost, legal review).
- Summary has no line on Cloudflare or per-level proofs, two of the owner's questions; section 10 and decision 9 do not mention Cloudflare.
- Decision 6 "image id changes only once" assumes the operator keeps a zk-host built for the deployed image after item 4 merges (C15).
- First step: decision 2 adds rented cards, section 14 item 1 does not; non-Linux fallback contradicts decision 5's "on the owner's card".
