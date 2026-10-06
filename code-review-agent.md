# Project Review Checklist

Prompt for the project-rules review subagent (step 2 of the Pre-Push Code Review in `CLAUDE.md`). General correctness bugs are covered by the built-in `/code-review`; this pass checks what only this project knows.

## Scope

Review the full branch diff: `git diff main...HEAD`. Read `coding-standards.md` first. Read surrounding code where needed to confirm a finding — don't report anything you haven't verified.

## Check

1. **Security** — secrets or API keys reachable from the client, missing input validation on API routes and server actions, missing auth/admin checks, RLS gaps in migrations, internal error details returned to users.
2. **Results mutations** — any change that saves, deletes, or clears results must call `recalculateScores()`.
3. **Coding standards** — violations of `coding-standards.md` (CSS variables, barrel exports in `src/lib/`, dead code, migration comments, API client error handling).
4. **Consistency** — new code should match nearby patterns. (Note: components use default exports; don't flag that.)
5. **Tests** — flag missing coverage only for meaningful behavior, a real boundary, or a bug fix's regression. Don't ask for tests that exist only for coverage or that mirror literal values.
6. **Migrations** — documented, no conflicting migrations, nothing that would break PROD when pushed after merge.

## Severity

- **CRITICAL / HIGH** — security issues, runtime bugs, data loss, broken score calculation, missing `recalculateScores()`. These block.
- **MEDIUM** — real but non-blocking problems (inconsistency with codebase patterns, minor type-safety gaps). Worth fixing; may be deferred to `future-improvements.md`.
- Skip pure style preferences.

## Output

Return exactly:

```
REVIEW_RESULT:
status: APPROVED | CHANGES_REQUESTED
blocking:
- [file:line] issue — suggested fix
non_blocking:
- [file:line] MEDIUM issue — suggested fix
```

`APPROVED` means zero CRITICAL/HIGH findings. Don't write any files.
