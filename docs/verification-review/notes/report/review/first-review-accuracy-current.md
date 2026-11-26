# Review: accuracy of the description and criticism of the current design (sections 1-5, appendix B)

Checked against repo f52a60a and audit/research notes.

## Confirmed
- Sec 3 flow vs Challenge.sol:102-175, 241-287; ZkReferee.sol:66-94; Season.sol:186-218. Fee 0.00005 ETH (README:38); 8,171 bytes = HEADER_LEN 71 + 8,100 (core/src/consts.rs:24-28).
- 227,591 (VERIFICATION:745); 130,741,601 / 131 segments (:405); 9.2 / 7 GiB (:707); 1,282 s (:569), 2,128 s (:701); 278,653 + 8,400 (:778); Sepolia run 338 ticks, 4,515 s, 530,256 (DEPLOYMENT:150,173-178); MAX_RAKE_BP 2,000 (Season.sol:44).
- F2 (ECONOMY:84, season.mjs only `open`), F4 (Season.sol:196, DEPLOYMENT:196), F6 (VERIFICATION:919-926; cost.md §6 ×22), F9 (README:590, settle.ts:177), F10 (Challenge.sol:262-266), binding (ZkReferee:78-94, Challenge:241-260).
- 71% fill, 54% (×0.457) cut: cost.md §0, §7. Browser circuit 2^21 in 82 s at 3.4 GiB, 109-187M gates: browser-circuit.md:18-19. CSP 18.5 s / 1.47 GB: ethproofs-leaders.md:121.

## Problems (detail in structured result)
1. "6 to 17 hours per run" (sec 1, sec 3 label repo): repo range is 9-17 h estimates (DEPLOYMENT:252-253, VERIFICATION:708); 6 h is audit arithmetic at run 1's rate; only proven run took 75 min; human-style is 1.4-2.4 h (sec 11).
2. Human-style 15-18M labelled measured: extrapolated from two Training journals by the owner, cleared in 163 and 333 ticks (cost.md:257; ECONOMY:136 "too few"); cautious play ~50M per level (cost.md:235).
3. F3 "a few tens of runs per season": audits give 2 runs per 24 h grace, 4-5 per 48 h (consistency.md F2, trust.md:135, ux-2).
4. F1 "real runs need 67 to 131" contradicts sec 3 human-style 15-18M; 16-segment proof is at VERIFICATION:988, not :700 (:700 is the 28-segment level).
5. "new backend does not touch the money contracts": tooling forces new generation of all four (DEPLOYMENT:195; ops.md §6 item 6).
6. F5 "no automated check": e2e.mjs:827 asserts image id = ZkReferee.imageId() in the live happy path; CI does not compare (consistency F5).
7. 120 ms browser replay: audit notes record 143 ms (ops.md:11) and 185 ms six slowest (ux.md:385); 120 ms only in design notes as "lead".
8. Citations: App. B CPU rates cite VERIFICATION:699-710 (which give 396-408 s, 51-56 s); 295/43 are DEPLOYMENT:177-178, 410/57 VERIFICATION:990. F7's 69% is at :943, not :771/:933.
9. Sec 5 "at most 4 GB" ignores Memory64 (16 GB, Chrome/Firefox); "a whole run is not" vs browser-circuit.md:269 (35-130 chained proofs, 1-3 h desktop).
10. Step 6 "pro rata among settled best runs": by score among qualified runs (README:712, Season.sol:218).
