# Outsider review of doc-rev40.md (clarity for a third-party ZK / contract reviewer)

Checked: whole report; escrow/final.md, escrow/spec.md (lock, B13-B15, referee pinning), escrow/redteam-ordering.md
(attacks 1, 2, 4, 5); design/redteam-economic.md (4-8% sourced, line 274); research/risc0-gpu.md:122,175 (5090 figure is a
12-segment SimpleLoop guest); research/ethproofs-leaders.md:69-70; report/compute_out.md:55-68; docs/DEPLOYMENT.md:173-180
(Sepolia run = 13 segments, 4,515 s); docs/VERIFICATION.md:700-708; README.md:711,742,749 (qualification, best run).

Findings (summary; full text in structured output):
1. Sec 1 / F1: "6 to 17 hours per run" and "real runs need 67 to 131" are bot-journal figures; the report's own human-style run is 15-18 Mcycles (~15-18 segments, 1.4-2.4 h CPU), and a 13-segment run was proven in 1 h 15.
2. Sec 1: "the same proof at about 1.5 minutes" -- extrapolated from a 12-segment busy loop, not the same proof.
3. "lock with a stake" never defined, yet a mainnet gate (decision 11).
4. Escrow rules omit that payee binding depends on the escrow pinning ZkReferee (Mock/Stylus referees bind nothing) -- spec.md:48.
5. Branch-B payment harvest (redteam-ordering #4, final.md residuals) missing from report.
6. GPU buy-out with heavy legal runs (redteam-ordering #1) missing; residual table understates it.
7. human-style / bot-style never defined; human-style rests on two human journals x6 (appendix A).
8. "credits that payee" ambiguous with the player's score credit.
9. "journal" = input log here, RISC Zero "journal" = "public values" here; not said.
10. Sec 7 lacks the human-style measurement pivot and the origin of 7-day grace and 4-fee cap.
11. Sec 11 home electricity 0.01-0.03 EUR vs sec 10 0.004-0.016 EUR (compute_out.md:55,59).
12. "416 bytes per level" vs 2,336 per run ambiguity.
13. Decision 8 "Why" contradicts sec 10 ranking.
14. gate set / qualified best run / settlement close undefined.
