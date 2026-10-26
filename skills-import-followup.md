# ethskills import — follow-up

## Status

`.claude/skills/ship/SKILL.md` has been imported (the index/router skill).

## Why a follow-up is needed

`https://ethskills.com/` is **blocked at the sandbox network level** (`Host not in allowlist`). Every fetch attempted (`WebFetch`, `curl -L --max-time 30 -A "Mozilla/5.0"`) returned HTTP 403 with the body `Host not in allowlist`.

The `ship` skill was imported by pasting its content into chat, then writing it verbatim to `.claude/skills/ship/SKILL.md`.

## Sibling skills (deferred)

`ship/SKILL.md` references 19 sibling skills, all behind the same blocked host:

| Skill | URL |
|---|---|
| why | https://ethskills.com/why/SKILL.md |
| protocol | https://ethskills.com/protocol/SKILL.md |
| gas | https://ethskills.com/gas/SKILL.md |
| wallets | https://ethskills.com/wallets/SKILL.md |
| l2s | https://ethskills.com/l2s/SKILL.md |
| standards | https://ethskills.com/standards/SKILL.md |
| tools | https://ethskills.com/tools/SKILL.md |
| building-blocks | https://ethskills.com/building-blocks/SKILL.md |
| orchestration | https://ethskills.com/orchestration/SKILL.md |
| addresses | https://ethskills.com/addresses/SKILL.md |
| concepts | https://ethskills.com/concepts/SKILL.md |
| security | https://ethskills.com/security/SKILL.md |
| audit | https://ethskills.com/audit/SKILL.md |
| noir | https://ethskills.com/noir/SKILL.md |
| testing | https://ethskills.com/testing/SKILL.md |
| indexing | https://ethskills.com/indexing/SKILL.md |
| frontend-ux | https://ethskills.com/frontend-ux/SKILL.md |
| frontend-playbook | https://ethskills.com/frontend-playbook/SKILL.md |
| qa | https://ethskills.com/qa/SKILL.md |
| feedback | https://ethskills.com/feedback/SKILL.md |

These are deferred because:

1. The same host block applies to all of them.
2. Onchain integration is **out of scope** for the current iteration of `ethblockdigger` (per user direction). When onchain is reintroduced, these skills become directly relevant.

## How to import the rest

Pick one path:

### Option A — paste content into chat
For each sibling skill the user wants, paste the raw `SKILL.md` (frontmatter + body) into chat. Each pasted skill is then written to `.claude/skills/<skill-name>/SKILL.md`, mirroring the existing layout.

### Option B — add ethskills.com to the sandbox allowlist
Add `ethskills.com` (and `*.ethskills.com`) to the harness allowlist. After that, `WebFetch` and `curl` will succeed and we can fetch the skills directly. The plan file already contains the curl command shape:

```
curl -L --max-time 30 -A "Mozilla/5.0" -o .claude/skills/<name>/SKILL.md https://ethskills.com/<name>/SKILL.md
```

### Option C — manual download
Download the skills locally on a host that can reach `ethskills.com`, then commit them to `.claude/skills/<name>/SKILL.md` in this repo.

## Validation (any path)

Each skill folder must contain a `SKILL.md` whose YAML frontmatter has `name` and `description` fields. Confirm with:

```
find .claude/skills -name SKILL.md -print -exec head -5 {} \;
```
