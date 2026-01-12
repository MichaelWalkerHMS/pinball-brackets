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

## Dev-to-Prod Workflow

### Pre-Push Code Review

**CRITICAL: All code must pass automated review before being pushed to GitHub.**

**Exception:** Changes that ONLY modify `.md` files do not require code review.

**Before EVERY push:**

1. Invoke the review subagent:
   ```
   Task: Review this branch using code-review-agent.md
   Context: [brief summary of what you changed]
   ```

2. Handle the response:
   - `CHANGES_REQUESTED` → Fix issues medium or higher, amend commit, re-invoke review
   - `APPROVED` → Push to GitHub and open the PR
   - `ESCALATE_TO_HUMAN` → Stop and notify user

3. Maximum 5 review iterations. If unresolved, escalate.

4. **Log deferred findings:** Non-blocking suggestions you choose NOT to fix go in `future-improvements.md`. But prefer fixing issues while context is fresh.

**Never push code that hasn't been approved by the review subagent.**

### Code Changes
Feature branch → PR → Preview deployment (dev DB) → User reviews → Merge to main

### Database Changes
1. Make changes in DEV Supabase first
2. Test locally
3. `npx supabase migration new <name>`
4. Commit migration file with code
5. After merge: `npx supabase link --project-ref ynxmkbpdnucrbjyvovpq && npx supabase db push`

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
