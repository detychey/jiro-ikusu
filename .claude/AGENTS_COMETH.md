## AGENTS.md

This file provides guidance when working with this repo.

## Code Philosophy

- **Simple and Direct** - Less code is better. No unnecessary abstractions.
- **Readable & Explicit** - Code logic must be obvious. Use descriptive names (self-documenting).
- **Reuse First** - Duplicate code is forbidden. Always extend or reuse existing patterns.
- **Robustness** - Handle errors and edge cases explicitly. Do not swallow errors.
- **Fail Fast** - Detect and report errors immediately. Never hide or delay failure.

## Fail Fast & Fail Loud

1. **Never swallow errors** - Every error must be either handled meaningfully or propagated up.
2. **Validate inputs early** - Check preconditions at function/method entry, not deep in the logic.
3. **No silent failures** - Logging an error and continuing is not handling it. If something fails, the caller must know.
4. **Preserve context** - When re-throwing or wrapping errors, keep the original cause visible.

## Master Rules

1.  **Language**: English only for all code, variables, and commit messages.
2.  **Comments**: Avoid comments. If a comment is needed, the code is probably unclear.
     *Exception: comments are allowed only to document non-obvious intent, constraints, or unavoidable complexity.*
3.  **Purity**: Favor pure functions. Side effects must be isolated and explicit.
4.  **Structure**: Split components logically. Avoid monolithic files.
5.  **Testing**: Do not test more than one scenario per test method, except for explicit parameterized tests.
6.  **Naming**: Follow the project's naming conventions strictly.
7.  **Dependencies**: Think twice before adding a library. Can we do it natively?


## Before Creating Anything

ALWAYS verify these 5 points:
1.  Does this logic already exist in the codebase?
2.  Can I use an existing pattern instead of inventing a new one?
3.  Is this the right package/directory for this code?
4.  How will I test this change?
5.  **Impact**: Will this break existing functionality?

**If unsure → ASK QUESTIONS before implementing.**
When asking questions: Provide the context, what you've already checked in the repo, and the possible paths you are considering. Don't just ask "What do I do?".


## Definition of Done

Before considering a task complete:

1. **Verify it works** – Run the code, execute the tests locally, check the output. Do not assume.
2. **Check for regressions** – Run existing tests. If something breaks, fix it before considering the task done.
3. **Clean up** – Remove dead code, unused imports, debug statements, and TODO comments you introduced.
4. **Re-read your changes** – Would a human reviewer approve this? If not, improve it.
5. **Answer the actual request** – Did you solve what was asked, or did you solve something else?

**If you cannot verify something → say so. Do not assume success.**
