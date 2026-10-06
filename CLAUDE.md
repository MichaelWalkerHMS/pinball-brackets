# IFPA Michigan Pinball Bracket Predictor

Bracket prediction app for IFPA pinball tournaments.

## Domain Context

### Tournament Format (24 Players)
- **Opening Round:** Seeds 9-24 play (8 matches), seeds 1-8 get bye
- **Round of 16:** Seeds 1-8 + 8 opening round winners
- **Quarterfinals → Semifinals → Finals** (includes 3rd/4th consolation)

### Scoring
Point values are defined in `src/lib/scoring/calculateScore.ts`.

**24-player bracket (53 points max):**
- Opening: 1pt | Round of 16: 2pt | Quarters: 3pt | Semis: 4pt | Finals: 5pt | Consolation: 4pt

**16-player bracket (29 points max):**
- Round of 16: 1pt | Quarters: 2pt | Semis: 3pt | Finals: 4pt | Consolation: 3pt

### Tiebreakers (in order)
1. Correctly predicted champion (true > false)
2. Game score difference: sum of |predicted - actual| for winner_games + loser_games (lower is better)
3. Total correct predictions (higher is better)

### Data Encoding
- `round`: 0=opening, 1=round of 16, 2=quarters, 3=semis, 4=final, 5=consolation
- Bracket pairings defined in `src/lib/bracket/constants.ts`

## Architecture

- Next.js 16 on Vercel (auto-deploys from main)
- Supabase for auth + database with Row Level Security
- Local/Preview → Dev Supabase; Production → Prod Supabase

## Coding Standards

See `coding-standards.md` for established code patterns and conventions. All code must follow these standards.

## Dev-to-Prod Workflow

### Pre-Push Code Review

**CRITICAL: All code must pass automated review before being pushed to GitHub.**

**NEVER run `git push` until the branch has a clean review (zero CRITICAL/HIGH findings).**

**Exception:** Changes that ONLY modify `.md` files do not require code review.

**Review loop (commit first, then run both checks against the branch):**

1. **Correctness review:** run the built-in `/code-review high` on the branch.
2. **Project rules review:** spawn a subagent with the prompt in `code-review-agent.md` plus a one-line summary of the change. It returns `APPROVED` or `CHANGES_REQUESTED`.
3. Fix every CRITICAL/HIGH finding in a **new commit** (don't amend; separate commits are easier for the user to review), then re-run both checks. Don't push after fixing without re-reviewing.
4. Maximum 5 iterations. If CRITICAL/HIGH issues remain, stop and escalate to the user.
5. Fix MEDIUM findings where reasonable. Log any deferred MEDIUM+ finding in `future-improvements.md` (short format in that file). Drop LOW suggestions.
6. Put a short **Review** section in the PR description: what was found, what was fixed, what was deferred.

### Code Changes

**CRITICAL: NEVER commit or push directly to `main` for code changes.**

All code changes must go through a PR for user review before merging. This ensures:
- User can review changes before they hit production
- Preview deployment allows testing against dev DB
- Vercel auto-deploys `main`, so direct pushes bypass all review

**Required workflow:**
1. Create a feature branch: `git checkout -b fix/descriptive-name` or `feature/descriptive-name`
2. Make commits on the feature branch
3. Run the review loop (see Pre-Push Code Review above)
4. Push the branch: `git push -u origin <branch-name>`
5. Create PR: `gh pr create`
6. User reviews PR and preview deployment
7. User approves and merges (or tells you to merge)

**Exception:** Changes that ONLY modify `.md` files may be committed directly to `main`.

### Database Changes

**Supabase Project Refs:**
- **DEV:** `nsmositomvtlhxkghchr` (used by local dev and preview deployments)
- **PROD:** `ynxmkbpdnucrbjyvovpq` (used by production)

**CRITICAL: Always verify you're linked to the correct project before pushing migrations.**

**During development (before merge):**
1. Link to DEV: `npx supabase link --project-ref nsmositomvtlhxkghchr`
2. Verify: `cat supabase/.temp/project-ref` (should show `nsmositomvtlhxkghchr`)
3. Create migration: `npx supabase migration new <name>`
4. Push to DEV: `npx supabase db push`
5. Test locally and on preview deployment
6. Commit migration file with code

**After merge to main:**
1. Link to PROD: `npx supabase link --project-ref ynxmkbpdnucrbjyvovpq`
2. Verify: `cat supabase/.temp/project-ref` (should show `ynxmkbpdnucrbjyvovpq`)
3. Push to PROD: `npx supabase db push`

## Testing

### Unit Tests
- **Stack:** Vitest + React Testing Library + MSW
- **Run:** `npm test` | `npm run test:watch` | `npm run test:coverage`
- **Location:** `__tests__/unit/`, `__tests__/mocks/`, `__tests__/fixtures/`

### E2E Tests
- **Stack:** Playwright (Chrome, Firefox, Safari + mobile)
- **Run:** `npm run test:e2e` | `npm run test:e2e:ui`
- **Location:** `e2e/` directory
- **CI:** Temporarily disabled. The GitHub secrets still use the old single-account names (`E2E_TEST_EMAIL`), but `e2e/fixtures/auth.ts` expects per-worker accounts (`E2E_TEST_EMAIL_0`, ...) and `E2E_ADMIN_*`. Re-enable the `e2e-tests` job in `.github/workflows/ci.yml` once the secrets are fixed. Until then, run E2E locally when `.env.test` is available.

### E2E Test Requirements
- **New features:** Must include E2E test for the user journey
- **Bug fixes:** Add regression test if user-facing
- **UI changes:** Update affected E2E tests
- **Skip E2E:** Pure refactoring, backend-only changes, documentation

## PR Requirements

- **Results mutations:** Any PR touching result save/delete/clear must verify `recalculateScores()` is called
- **Security:** Review your own code for OWASP top 10 vulnerabilities before submitting

## Working with Me

- This is a learning project — explain reasoning, don't just implement
- Plan before implementing; get approval before changes
- One small feature at a time; don't over-engineer or go down rabbit holes
- Security is an absolute priority
- Never commit/push/merge without explicit approval
