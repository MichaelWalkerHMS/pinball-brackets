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

**NEVER run `git push` until you have received `APPROVED` from the code review agent.**

**Exception:** Changes that ONLY modify `.md` files do not require code review.

**Review loop (must complete before ANY push):**

1. Invoke the review subagent:
   ```
   Task: Review this branch using code-review-agent.md
   Context: [brief summary of what you changed]
   ```

2. Handle the response:
   - `APPROVED` → You may now push to GitHub and open the PR
   - `CHANGES_REQUESTED` → Fix blocking issues, amend commit, **return to step 1**
   - `ESCALATE_TO_HUMAN` → Stop and notify user

3. **You MUST loop through steps 1-2 until you receive `APPROVED`.** Do not push after fixing issues without re-running the review.

4. Maximum 5 review iterations. If unresolved, escalate.

5. **REQUIRED: Log ALL deferred findings to `future-improvements.md`.**
   - Any LOW or MEDIUM severity suggestion you choose NOT to fix MUST be added to `future-improvements.md`
   - Use the format documented in that file (severity, date, area, files, current behavior, suggested fix, why deferred)
   - This is NOT optional — deferred findings that aren't logged are lost context
   - Prefer fixing issues while context is fresh, but always log what you defer

**Never push code that hasn't been approved by the review subagent.**

### Code Changes

**CRITICAL: NEVER commit or push directly to `main` for code changes.**

All code changes must go through a PR for user review before merging. This ensures:
- User can review changes before they hit production
- Preview deployment allows testing against dev DB
- Vercel auto-deploys `main`, so direct pushes bypass all review

**Required workflow:**
1. Create a feature branch: `git checkout -b fix/descriptive-name` or `feature/descriptive-name`
2. Make commits on the feature branch
3. Run code review agent (see Pre-Push Code Review above)
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
- **CI:** Runs automatically on PRs

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
