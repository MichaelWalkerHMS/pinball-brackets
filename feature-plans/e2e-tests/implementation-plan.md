# E2E Testing Implementation Plan

## Overview

This plan establishes Playwright-based E2E testing for the IFPA Bracket Predictor to reduce manual regression testing.

**Framework:** Playwright (free, open source)
**Browsers:** Chrome, Firefox, Safari (WebKit)
**Mobile:** Device emulation (iPhone, Android profiles)
**CI:** GitHub Actions (free tier: 2,000 min/month for private repos)

---

## Why Playwright Over Cypress

| Feature | Playwright | Cypress |
|---------|------------|---------|
| Safari/WebKit | Yes | No |
| Mobile emulation | Full device profiles | Viewport only |
| Parallel (free) | Yes | Paid |
| Multi-tab/auth | Native | Limited |
| TypeScript | Excellent | Good |

---

## Test User & Cleanup Strategy

### Dedicated Test User (Option A)
- Create permanent `e2e-test@yourdomain.com` in dev Supabase
- Store credentials in environment variables:
  - Local: `.env.test` (gitignored)
  - CI: GitHub Secrets
- All E2E tests authenticate as this user

### Environment Variables
```
E2E_TEST_EMAIL=e2e-test@yourdomain.com
E2E_TEST_PASSWORD=<secure-password>
E2E_TEST_USER_ID=<uuid-from-supabase>
```

### Cleanup Strategy
1. **Global setup** (before suite): Delete all test user's brackets/picks
2. **Per-test cleanup** (afterEach): Each test cleans up what it created
3. **Global teardown** (after suite): Final cleanup sweep

```typescript
// e2e/global-setup.ts
import { createClient } from '@supabase/supabase-js'

export default async function globalSetup() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Clean slate before tests run
  await supabase.from('picks').delete().eq('user_id', process.env.E2E_TEST_USER_ID)
  await supabase.from('brackets').delete().eq('user_id', process.env.E2E_TEST_USER_ID)
}
```

### Why This Works
- **No user clutter:** One permanent test user, never creates more
- **No data clutter:** Brackets/picks cleaned up automatically
- **Isolated tests:** Each test starts with clean state
- **Safe credentials:** Stored in env vars, not committed

---

## Implementation Phases

### Phase 1: Setup
**Files to create/modify:**
- `playwright.config.ts` - Main config with browser/device profiles
- `e2e/` - New directory for E2E tests
- `e2e/global-setup.ts` - Database cleanup before tests
- `e2e/fixtures/auth.ts` - Auth helpers (login, signup utilities)
- `package.json` - Add Playwright dependencies and scripts
- `.github/workflows/e2e.yml` - CI workflow
- `.env.test` - Test environment variables (gitignored)
- `.gitignore` - Add `.env.test`

**Configuration:**
```
Projects: Chrome, Firefox, WebKit, Mobile Chrome, Mobile Safari
Base URL: http://localhost:3000
Retries: 2 in CI, 0 locally
```

### Phase 2: Core Tests
**Priority order (addresses main pain points):**

1. `e2e/auth.spec.ts`
   - Signup with email
   - Login with valid credentials
   - Login with invalid credentials (error handling)
   - Logout
   - Password reset flow

2. `e2e/bracket.spec.ts`
   - Create new bracket for tournament
   - Make picks through all rounds
   - Save bracket
   - Load and edit existing bracket
   - Verify picks persist after reload

3. `e2e/leaderboard.spec.ts`
   - View tournament leaderboard
   - Verify bracket appears after creation
   - Check scoring display

4. `e2e/admin.spec.ts`
   - Admin guard (non-admin blocked)
   - Create tournament
   - Import players
   - Enter results

### Phase 3: Mobile Tests
5. `e2e/mobile.spec.ts`
   - Bracket interaction on iPhone viewport
   - Touch/tap pick selection
   - Responsive layout verification

### Phase 4: CI Integration
- GitHub Actions workflow runs on PR
- Parallel execution across browsers
- Screenshot artifacts on failure
- Test report summary in PR comments

---

## Test Scripts (package.json)

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:debug": "playwright test --debug"
}
```

---

## Ongoing Workflow

As we build features:
1. Write feature code
2. Write/update E2E test for the user journey
3. Run `npm test` (unit) + `npm run test:e2e` (E2E)
4. PR includes both feature and tests

---

## E2E Test Writer Agent

Create `.claude/agents/e2e-test-writer.md` with the following content:

```markdown
# E2E Test Writer Agent

You are a specialized agent for writing Playwright E2E tests for the IFPA Bracket Predictor.

## Your Role
Write comprehensive E2E tests that cover user journeys. You can be invoked:
- After a feature is implemented (to add test coverage)
- In parallel with feature development (to write tests concurrently)
- To expand coverage of existing features

## Context You Need
When invoked, you should receive:
1. Description of the feature/user journey to test
2. Relevant component/page file paths
3. Expected user interactions and outcomes

## Test Structure

All tests go in `e2e/` directory:
- `e2e/auth.spec.ts` - Authentication flows
- `e2e/bracket.spec.ts` - Bracket creation and editing
- `e2e/leaderboard.spec.ts` - Leaderboard functionality
- `e2e/admin.spec.ts` - Admin interface
- `e2e/mobile.spec.ts` - Mobile-specific tests

## Test Patterns

### Authentication Helper
```typescript
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

test('user journey', async ({ page }) => {
  await login(page)
  // ... test steps
})
```

### Page Object Pattern
```typescript
// e2e/pages/bracket.ts
export class BracketPage {
  constructor(private page: Page) {}

  async selectPick(round: number, match: number, seed: number) {
    await this.page.click(`[data-testid="match-${round}-${match}"] [data-seed="${seed}"]`)
  }

  async saveBracket() {
    await this.page.click('[data-testid="save-bracket"]')
    await expect(this.page.locator('[data-testid="save-success"]')).toBeVisible()
  }
}
```

### Cleanup Pattern
```typescript
test.afterEach(async ({ page }) => {
  // Clean up any brackets created during test
  // This happens automatically via global setup, but explicit cleanup is good practice
})
```

## Test Naming Convention
- Describe the user journey: `test('user can create bracket and make picks')`
- Not implementation: `test('clicking save button calls API')`

## Mobile Testing
```typescript
test.describe('mobile', () => {
  test.use({ ...devices['iPhone 13'] })

  test('can make picks on mobile', async ({ page }) => {
    // Touch interactions work automatically
  })
})
```

## What NOT to Test in E2E
- Unit-level logic (use Vitest for that)
- API responses in isolation (use MSW mocks)
- Every edge case (focus on happy paths + critical errors)

## Before Submitting Tests
1. Run locally: `npm run test:e2e`
2. Check all browsers pass
3. Verify cleanup works (run twice, second run should pass)
```

---

## Files Summary

### New Files
- `playwright.config.ts` - Playwright configuration
- `e2e/` - Test directory
  - `e2e/global-setup.ts` - Database cleanup
  - `e2e/fixtures/auth.ts` - Login helper
  - `e2e/pages/` - Page object models
  - `e2e/*.spec.ts` - Test files
- `.env.test` - Test environment variables (gitignored)
- `.github/workflows/e2e.yml` - CI workflow
- `.claude/agents/e2e-test-writer.md` - Agent instructions

### Modified Files
- `package.json` - Add Playwright deps and scripts
- `CLAUDE.md` - Add E2E testing section (already done)
- `.gitignore` - Add `.env.test`

---

## Prerequisites Before Implementation

1. Create test user `e2e-test@yourdomain.com` in dev Supabase
2. Note the user's UUID for `E2E_TEST_USER_ID`
3. Have GitHub Secrets access for CI credentials

---

## Sources

- [Playwright vs Cypress 2025 Showdown](https://frugaltesting.com/blog/playwright-vs-cypress-the-ultimate-2025-e2e-testing-showdown)
- [LambdaTest: Cypress vs Playwright](https://www.lambdatest.com/blog/cypress-vs-playwright/)
- [Playwright Emulation Docs](https://playwright.dev/docs/emulation)
- [Playwright Mobile Testing Guide 2025](https://www.pcloudy.com/blogs/playwright-mobile-testing-setup-complete-guide/)
- [BrowserStack: Playwright vs Cypress](https://www.browserstack.com/guide/playwright-vs-cypress)
