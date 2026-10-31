# ethskills import

Plan M0.3 imported the `ship` guide and 19 of the 20 topic skills from ethskills.com on 2026-10-31. Each file is copied byte for byte into `.claude/skills/<name>/SKILL.md`, and `scripts/ethskills.sha256` pins them: `sha256sum -c scripts/ethskills.sha256`. Agents use these committed copies and never fetch from or send anything to ethskills.com (`CLAUDE.md`). The README and `CLAUDE.md` stay authoritative over their advice (README §12).

| Skill | Source | Copy | Fetched | sha256 |
|---|---|---|---|---|
| ship | https://ethskills.com/ship/SKILL.md | [`.claude/skills/ship/SKILL.md`](.claude/skills/ship/SKILL.md) | 2026-10-31 | `1a98ecd987dc1edc55740ef441cf941bb10d225a392761a759a569fa522b003f` |
| why | https://ethskills.com/why/SKILL.md | [`.claude/skills/why/SKILL.md`](.claude/skills/why/SKILL.md) | 2026-10-31 | `c58e0cc64032de3fac6aa1da12d2fc6287630d7f4cf551c1f2f0f5dd9be96ff4` |
| protocol | https://ethskills.com/protocol/SKILL.md | [`.claude/skills/protocol/SKILL.md`](.claude/skills/protocol/SKILL.md) | 2026-10-31 | `5ec404821f05f6ef02f0230b97d9888eff5e91a2d908269c2daca296684a3189` |
| gas | https://ethskills.com/gas/SKILL.md | [`.claude/skills/gas/SKILL.md`](.claude/skills/gas/SKILL.md) | 2026-10-31 | `ecd548d95d53ac768b12ec639bdd491358f34170644248321253d2fc65ca6625` |
| wallets | https://ethskills.com/wallets/SKILL.md | [`.claude/skills/wallets/SKILL.md`](.claude/skills/wallets/SKILL.md) | 2026-10-31 | `99aafa697ff5f13b6ba0e77b5263e5d68c416593de82a6d9e65c2984e32d4756` |
| l2s | https://ethskills.com/l2s/SKILL.md | [`.claude/skills/l2s/SKILL.md`](.claude/skills/l2s/SKILL.md) | 2026-10-31 | `ee6120ed8b02c3b49ec635aec03378e45aecfd92cbe19d8788e7cfcef1efd5a3` |
| standards | https://ethskills.com/standards/SKILL.md | [`.claude/skills/standards/SKILL.md`](.claude/skills/standards/SKILL.md) | 2026-10-31 | `60e21914f26958ca2419beec34a3f399c0c295499fe717582d394e0f08617006` |
| tools | https://ethskills.com/tools/SKILL.md | [`.claude/skills/tools/SKILL.md`](.claude/skills/tools/SKILL.md) | 2026-10-31 | `b83b357c1b4737f00998965e67a9a2c9de291b5dc19f28c7314a02c1d1fe048b` |
| building-blocks | https://ethskills.com/building-blocks/SKILL.md | [`.claude/skills/building-blocks/SKILL.md`](.claude/skills/building-blocks/SKILL.md) | 2026-10-31 | `ce51e6c98a8ff556b842f12d2e1755e2aed9fd1952964ecd8edcd4a260831972` |
| orchestration | https://ethskills.com/orchestration/SKILL.md | [`.claude/skills/orchestration/SKILL.md`](.claude/skills/orchestration/SKILL.md) | 2026-10-31 | `35fe2620e99cdc38c9a755e96202d72d20cc071b79423723e50031cd388e220f` |
| addresses | https://ethskills.com/addresses/SKILL.md | [`.claude/skills/addresses/SKILL.md`](.claude/skills/addresses/SKILL.md) | 2026-10-31 | `cd055f01bb22151a26988cf01ddf60b5c194e7074ac06ab08622ad5816988602` |
| concepts | https://ethskills.com/concepts/SKILL.md | [`.claude/skills/concepts/SKILL.md`](.claude/skills/concepts/SKILL.md) | 2026-10-31 | `22c6b516888b749ae3c49a075cf9a7d3235f7c784e945b32a354af3efd836fe6` |
| security | https://ethskills.com/security/SKILL.md | [`.claude/skills/security/SKILL.md`](.claude/skills/security/SKILL.md) | 2026-10-31 | `c789816096149d4802d7707124395faefa7c304139008b83a2e9fa5983e26f8e` |
| audit | https://ethskills.com/audit/SKILL.md | [`.claude/skills/audit/SKILL.md`](.claude/skills/audit/SKILL.md) | 2026-10-31 | `b86fdc2dc685fd451fc9f39885b271336e6e40bf03b170f17e08142c46944ee5` |
| noir | https://ethskills.com/noir/SKILL.md | [`.claude/skills/noir/SKILL.md`](.claude/skills/noir/SKILL.md) | 2026-10-31 | `a3ef383ad078dd5012a6750f272a3959ffef5589983ea7ac4aa51722c76f8299` |
| testing | https://ethskills.com/testing/SKILL.md | [`.claude/skills/testing/SKILL.md`](.claude/skills/testing/SKILL.md) | 2026-10-31 | `78383556bc234736e5910e8656cac27f4ede9ce821e811650765a2a3b5cd0f63` |
| indexing | https://ethskills.com/indexing/SKILL.md | [`.claude/skills/indexing/SKILL.md`](.claude/skills/indexing/SKILL.md) | 2026-10-31 | `09f444c22b01831285b636433650b8bff8012550a3ba327de47c1355d3025e23` |
| frontend-ux | https://ethskills.com/frontend-ux/SKILL.md | [`.claude/skills/frontend-ux/SKILL.md`](.claude/skills/frontend-ux/SKILL.md) | 2026-10-31 | `babb0a1d2ad2da62d2639a35181003b24225a7b7164177f14c3ebe785264dbc0` |
| frontend-playbook | https://ethskills.com/frontend-playbook/SKILL.md | [`.claude/skills/frontend-playbook/SKILL.md`](.claude/skills/frontend-playbook/SKILL.md) | 2026-10-31 | `c268d4aef817c86ff0da2493df231bc4433b64918026d1c354116d0cf8d5874e` |
| qa | https://ethskills.com/qa/SKILL.md | [`.claude/skills/qa/SKILL.md`](.claude/skills/qa/SKILL.md) | 2026-10-31 | `09408108e6748943daf71b41c727ad5d53ddea5d1c8b6a50dc9eee2dc9b28f17` |
| feedback | https://ethskills.com/feedback/SKILL.md | not imported | 2026-10-31 (checked, not kept) | – |

- **The index.** The ethskills root index (`name: ethskills`) lives at [`.claude/skills/ethskills/`](.claude/skills/ethskills/SKILL.md). M0.1 copied it from ethblockdigger's `.claude/skills/ship/SKILL.md`, which is the index, not the `ship` guide; M0.3 does not refetch it.
- **`why`** declares `name: why-ethereum`, not `why`, so it loads as the skill `why-ethereum` from the directory `why/`.
- **`feedback` is not imported.** As fetched on 2026-10-31, it has no `name` field (it declares `title: Feedback`), and it asks the agent to POST project notes to `https://ethskills.com/api/feedback`, which `CLAUDE.md` forbids. The "send a one-line note via feedback" lines of other skills fall under the same rule.

## Where the imported skills conflict with this project

A full read of the 20 files on import found these statements that, followed here, would contradict the README or `CLAUDE.md`. The README and `CLAUDE.md` win.

- **Fetching from or sending to ethskills.com** (`CLAUDE.md`): `ship` line 82 points to skills by URL; `ship` 36, `concepts` 29 and `qa` 67 fetch `crops`, which is not imported; `ship` 88, `gas` 51, `addresses` 179, `security` 64 and `frontend-ux` 28 end with "send a one-line note via feedback".
- **The chain** (D12, Arbitrum One): `ship` 59 treats the chain as open, with mainnet unless an L2 shows a product fit; `gas` 41 keeps mainnet for low-frequency, high-value actions.
- **The contracts** (§7.2, §7.3, §8.4): `ship` 25 caps an MVP at three custom contracts, where v1 has four (entropy, referee, `Season`, `Challenge`), and prefers audited primitives over the reused `ArbBlockhashEntropy`; `concepts` 18 pays whoever calls a permissionless function, where only `claim` and `withdrawRake` send ETH; `concepts` 35 offers other randomness constructions than §7.2's; `orchestration` 28 redeploys or upgrades in place, where season parameters never change and a new rules version means a new season.
- **Deployment** (D2, D12, plan §1.3): `orchestration` 8 keeps the frontend on localhost until launch, against the per-PR previews and jiro-ikusu.win; `orchestration` 12 and 32 test on a fork with `yarn generate`, where Stylus gas needs a local Arbitrum node; `orchestration` 13 tests live with real money, where testnet comes first; `orchestration` 22 hands over env files with keys filled in, where keys are never committed or printed.
- **Proofs** (§6.4, §7.3, §7.5): `noir` 10 hashes with Poseidon, where the commitments are keccak256; `noir` 18 wants a browser prover, where neither the browser nor the Pico ever proves; `noir` 40 makes the recipient a public input, where the public values are the Outcome's.
- **Frontend and data** (§8.4, plan P8, M5.3): `indexing` 8 and 10 require an indexer and offchain ranking, where `Season` keeps best runs onchain and M5.3 reads logs without an indexer; `frontend-playbook` 44 releases to IPFS, where the site is jiro-ikusu.win; `qa` 15 and 38 assume Scaffold-ETH 2, where the site is plain TypeScript with ethers v6.
- **Process:** `concepts` 22 writes answers into the README unasked (`GUIDELINES.md` §2, §3); `testing` 16 skips tests whose failure would be a compiler or dependency bug, where the golden vectors check exactly that every build agrees (§3, §6.6).
