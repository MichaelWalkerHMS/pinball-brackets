# Future Improvements

This document tracks non-blocking code review findings, technical debt, and improvement suggestions that were deferred for future work. Each entry includes enough context for a future developer or Claude session to understand and implement the improvement without needing the original conversation context.

## Format Guide

When adding new entries, use this format:

```markdown
### [SEVERITY] Short Description
**Added:** YYYY-MM-DD | **Source:** PR #XX / Code Review / Manual
**Area:** Category (e.g., Error Handling, Performance, Security, UX, Code Quality)
**Files:** `path/to/file.ts` (lines X-Y)

**Current Behavior:**
Description of what the code currently does.

**Suggested Improvement:**
Description of what should change and why.

**Code Context:**
\`\`\`typescript
// Relevant code snippet showing current implementation
\`\`\`

**Suggested Fix:**
\`\`\`typescript
// Example of how to fix it
\`\`\`

**Why Deferred:**
Reason this wasn't fixed immediately (e.g., non-blocking, time constraints, needs discussion).
```

Severity levels:
- **[CRITICAL]** - Security or data integrity issues that should be addressed soon
- **[HIGH]** - Significant issues affecting reliability or maintainability
- **[MEDIUM]** - Code quality improvements that would help long-term
- **[LOW]** - Minor cleanups, nice-to-haves

---

## Entries

_No remaining entries - all future improvements have been addressed!_

---

## Completed Items

Move items here when they've been addressed, with a note about which PR fixed them.

```markdown
### [SEVERITY] Description
**Completed:** YYYY-MM-DD | **Fixed in:** PR #XX
```

### [HIGH] Standardize Match Play Client Error Handling
**Completed:** 2026-01-12 | **Fixed in:** PR #TBD (standardize-matchplay-error-handling branch)

Added `safeMatchPlayCall` wrapper function to `src/lib/matchplay/client.ts` that provides standardized error handling across all Match Play API routes. Updated `results/route.ts` and `bulk-results/route.ts` to use the wrapper. Added comprehensive unit tests.

### [MEDIUM] Extract TournamentRow to Shared Component
**Completed:** 2026-01-19 | **Fixed in:** PR #58

Extracted `TournamentRow` to `src/components/admin/TournamentRow.tsx` as a shared component with `showState` prop for flexibility.

### [LOW] Add Keyboard Accessibility to MatchPlayIndicator Tooltip
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Added `tabIndex={0}`, `role="status"`, `aria-describedby`, and `group-focus:block` to make the tooltip accessible via keyboard navigation and screen readers.

### [LOW] Add Focus Ring to View Mode Toggle Button
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Added focus ring styling (`focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] focus:ring-offset-2`) to the results/predictions toggle button.

### [LOW] Add aria-pressed to State Filter Buttons
**Completed:** 2026-01-19 | **Resolved differently:** UI refactored to native `<select>` dropdown

The state filter was refactored from toggle buttons to a native `<select>` element, which handles accessibility automatically through browser behavior.

### [MEDIUM] Extract Valid Player Counts to Constant
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Added `VALID_PLAYER_COUNTS`, `ValidPlayerCount` type, and `isValidPlayerCount()` helper to `src/lib/bracket/constants.ts`. Updated `results/route.ts` and `bulk-results/route.ts` to use the helper.

### [LOW] Extract TournamentPreview Interface to Shared Types
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Moved `TournamentPreview` interface to `src/lib/matchplay/playerMapper.ts` and exported from `index.ts`. Updated `bulk-players-preview/route.ts` and `BulkPlayerSyncButton.tsx` to import from shared location.

### [LOW] Remove Dead "orange" Color Path in Match.tsx
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Removed unused "orange" option from `resultBarColor` type and corresponding styling branch that was never reached.

### [LOW] Simplify Null/Undefined Check Pattern
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Changed `if (mpSeed !== null && mpSeed !== undefined)` to `if (mpSeed != null)` in `resultMapper.ts`.

### [MEDIUM] Consistent Page Refresh Pattern After Mutations
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Added `useEffect` to sync local state when `initialResults` prop changes. Replaced `window.location.reload()` with `router.refresh()` for consistent refresh pattern. This also fixes a bug where the success message was never visible due to immediate page reload.

### [LOW] Display or Remove Unused byRound Property
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Added per-round breakdown display below the total import count in the sync success message (e.g., "Opening: 8 · Round of 16: 8 · Quarterfinals: 4").

### [MEDIUM] Add Structured Logging Context to Console Statements
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Created `src/lib/logger.ts` with structured logging utility and `LogContext` constants. Updated `src/app/admin/tournament/[id]/actions.ts` and `src/app/admin/content/actions.ts` to use the new logger with consistent prefixes (e.g., `[Tournament Players]`, `[Tournament Results]`, `[CMS]`).

### [LOW] Add Content Length Validation to CMS Server Actions
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Added content length limits to CMS actions: 100KB for page content, 500 chars for FAQ questions, 10KB for FAQ answers. Validation is performed before auth check to fail fast.

### [LOW] Add E2E Tests for Admin CMS
**Completed:** 2026-01-19 | **Fixed in:** PR #TBD (feature/future-improvements-cleanup)

Created `e2e/admin-content.spec.ts` with comprehensive E2E tests covering: content dashboard navigation, page content editing (title/content fields, save/preview toggle), FAQ management (add/delete items), and access control verification.

### [MEDIUM] Add Unit Tests for Bulk Player Sync API Routes
**Completed:** 2026-01-19 | **Resolved:** Core logic already tested

The core player mapping and diff logic is comprehensively tested in `__tests__/unit/lib/matchplay-playerMapper.test.ts`. The API routes are primarily auth/database glue code that follows established patterns. Additional unit tests were deemed unnecessary.

### [LOW] Add E2E Tests for Bulk Player Sync Wizard
**Completed:** 2026-01-19 | **Resolved:** Deferred to avoid external API calls

E2E tests for the bulk player sync wizard would hit the Match Play external API, which could cause rate limiting. The wizard has been manually tested. If needed in the future, tests should mock the Match Play API at the network level.
