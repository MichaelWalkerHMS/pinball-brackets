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

### [MEDIUM] Add Structured Logging Context to Console Statements
**Added:** 2026-01-12 | **Source:** PR #46 / Code Review
**Area:** Code Quality, Observability
**Files:** Multiple files including:
- `src/app/admin/tournament/[id]/actions.ts` (10+ console.error calls)
- `src/app/api/matchplay/*/route.ts` files

**Current Behavior:**
Console.error statements are scattered throughout without consistent prefixes or structured context. In production, this makes logs hard to search and filter.

**Code Context:**
```typescript
// Current pattern (inconsistent)
console.error("Error clearing all results:", error);
console.error("Error deleting existing players:", deleteError);
console.error("Error fetching Match Play players:", error);
```

**Suggested Improvement:**
Add consistent prefixes and structured logging context to all console statements.

**Suggested Fix:**
```typescript
// Option 1: Simple prefix pattern
console.error("[Tournament Results] Failed to clear all results:", {
  tournamentId,
  error: error?.message,
});

console.error("[Match Play Sync] Failed to fetch players:", {
  matchplayId,
  tournamentId,
  error: error?.message,
});

// Option 2: Create a simple logger utility
// src/lib/logger.ts
export const logger = {
  error: (context: string, message: string, data?: Record<string, unknown>) => {
    console.error(`[${context}] ${message}`, data ?? '');
  },
  info: (context: string, message: string, data?: Record<string, unknown>) => {
    console.log(`[${context}] ${message}`, data ?? '');
  },
};

// Usage:
logger.error('Tournament Results', 'Failed to clear all results', { tournamentId, error: error?.message });
```

**Why Deferred:**
Non-blocking - logs still work, just harder to filter in production. Could be addressed as part of a broader observability improvement.

---

### [MEDIUM] Extract Valid Player Counts to Constant
**Added:** 2026-01-12 | **Source:** PR #46 / Code Review
**Area:** Code Quality, Maintainability
**Files:**
- `src/app/api/matchplay/results/route.ts` (lines 96-101)
- `src/app/api/matchplay/bulk-results/route.ts` (lines 113-117)

**Current Behavior:**
Player count validation is hardcoded with magic numbers. If 32-player or other tournament formats are added, multiple files need updating.

**Code Context:**
```typescript
// src/app/api/matchplay/results/route.ts:96-101
if (tournament.player_count !== 16 && tournament.player_count !== 24) {
  return NextResponse.json(
    { success: false, imported: 0, skipped: 0, byRound: {}, error: 'Invalid player count (must be 16 or 24)' },
    { status: 400 }
  );
}
```

**Suggested Improvement:**
Define valid player counts as a constant in bracket constants file and reference it throughout.

**Suggested Fix:**
```typescript
// Add to src/lib/bracket/constants.ts
export const VALID_PLAYER_COUNTS = [16, 24] as const;
export type ValidPlayerCount = typeof VALID_PLAYER_COUNTS[number];

// Helper function
export function isValidPlayerCount(count: number): count is ValidPlayerCount {
  return VALID_PLAYER_COUNTS.includes(count as ValidPlayerCount);
}

// Usage in API routes:
import { VALID_PLAYER_COUNTS, isValidPlayerCount } from '@/lib/bracket/constants';

if (!isValidPlayerCount(tournament.player_count)) {
  return NextResponse.json({
    success: false,
    error: `Player count ${tournament.player_count} not supported. Valid: ${VALID_PLAYER_COUNTS.join(', ')}`
  }, { status: 400 });
}
```

**Why Deferred:**
Non-blocking - current implementation works correctly. This is a maintainability improvement for when/if new tournament sizes are added.

---

### [MEDIUM] Consistent Page Refresh Pattern After Mutations
**Added:** 2026-01-12 | **Source:** PR #46 / Code Review
**Area:** UX, Code Consistency
**Files:** `src/app/admin/tournament/[id]/ResultsEntry.tsx` (lines 77-78, 106)

**Current Behavior:**
The "Sync from Match Play" button uses `window.location.reload()` for a hard page refresh, while "Clear All Results" uses `router.refresh()`. The hard reload was used because `router.refresh()` wasn't updating the local React state.

**Code Context:**
```typescript
// Sync button (line 77-78)
// Full page reload to show updated results
window.location.reload();

// Clear button (line 106)
setResults([]);
router.refresh();
```

**Suggested Improvement:**
Use consistent refresh pattern. Either:
1. Use `router.refresh()` everywhere and fix state sync issue, OR
2. Document why hard reload is needed for sync but not clear

**Suggested Fix (Option 1 - Preferred):**
```typescript
// The issue is that router.refresh() updates server components but not local state.
// Fix by making the component respond to prop changes:

// Change from:
const [results, setResults] = useState(initialResults);

// To:
const [results, setResults] = useState(initialResults);

// Add useEffect to sync state when props change
useEffect(() => {
  setResults(initialResults);
}, [initialResults]);

// Then both handlers can use:
router.refresh();
```

**Why Deferred:**
Non-blocking - `window.location.reload()` works correctly, just slightly slower UX. The fix requires understanding React state sync patterns.

---

### [LOW] Display or Remove Unused byRound Property
**Added:** 2026-01-12 | **Source:** PR #46 / Code Review
**Area:** Code Quality
**Files:** `src/app/admin/tournament/[id]/ResultsEntry.tsx` (lines 27-31, 72-76, 387-390)

**Current Behavior:**
The `SyncResult` interface includes a `byRound` property that captures per-round import counts, but this data is never displayed to the user.

**Code Context:**
```typescript
// Interface definition (lines 27-31)
interface SyncResult {
  imported: number;
  skipped: number;
  byRound: Record<string, number>;  // Captured but never displayed
}

// Success message only shows total (lines 387-390)
<p className="text-sm text-[rgb(var(--color-success-text))] mt-1">
  Imported {syncResult.imported} result{syncResult.imported !== 1 ? 's' : ''}
  {syncResult.skipped > 0 && ` (${syncResult.skipped} skipped)`}
</p>
```

**Suggested Improvement:**
Either display the byRound breakdown to users, or remove it from the interface if not needed.

**Suggested Fix (Display Option):**
```typescript
// Enhanced success message
{syncResult && (
  <div className="text-sm text-[rgb(var(--color-success-text))] mt-1">
    <p>Imported {syncResult.imported} result{syncResult.imported !== 1 ? 's' : ''}
      {syncResult.skipped > 0 && ` (${syncResult.skipped} skipped)`}
    </p>
    {Object.keys(syncResult.byRound).length > 0 && (
      <p className="text-xs opacity-75 mt-1">
        {Object.entries(syncResult.byRound).map(([round, count]) =>
          `${round}: ${count}`
        ).join(' | ')}
      </p>
    )}
  </div>
)}
```

**Why Deferred:**
Non-blocking - minor UX enhancement. The data is already available, just needs to be displayed.

---

### [LOW] Simplify Null/Undefined Check Pattern
**Added:** 2026-01-12 | **Source:** PR #46 / Code Review
**Area:** Code Quality
**Files:** `src/lib/matchplay/resultMapper.ts` (line 48-51)

**Current Behavior:**
The code explicitly checks for both `null` and `undefined` separately.

**Code Context:**
```typescript
// Current (line 48-51)
const mpSeed = player.tournamentPlayer?.seed;
if (mpSeed !== null && mpSeed !== undefined) {
  seedMap.set(player.playerId, mpSeed + 1);
}
```

**Suggested Improvement:**
Use the loose equality `!= null` which checks both null and undefined in one comparison.

**Suggested Fix:**
```typescript
const mpSeed = player.tournamentPlayer?.seed;
if (mpSeed != null) {  // Checks both null and undefined
  seedMap.set(player.playerId, mpSeed + 1);
}
```

**Why Deferred:**
Non-blocking - purely cosmetic. Both versions work identically. Some teams prefer explicit checks for clarity.

---

### [LOW] Add Keyboard Accessibility to MatchPlayIndicator Tooltip
**Added:** 2026-01-12 | **Source:** PR #49 / Code Review
**Area:** Accessibility, UX
**Files:** `src/components/bracket/MatchPlayIndicator.tsx` (lines 12-35)

**Current Behavior:**
The tooltip is only visible on hover (via CSS `group-hover:block`). Keyboard users cannot access the tooltip content, and screen readers have no association between the indicator and its tooltip.

**Code Context:**
```tsx
// Current implementation (lines 12-35)
<div className="relative group flex items-center gap-1.5">
  <span className={`inline-block w-2.5 h-2.5 rounded-full ...`} aria-hidden="true" />
  <span className={`text-xs whitespace-nowrap ...`}>
    {isLinked ? "MatchPlay Linked" : "MatchPlay Not Linked"}
  </span>
  <div className="absolute left-0 top-full mt-1.5 hidden group-hover:block z-10 ...">
    {tooltipText}
  </div>
</div>
```

**Suggested Improvement:**
Add `tabIndex={0}` to make the element focusable, add `group-focus:block` to show tooltip on focus, and add ARIA attributes for screen reader support.

**Suggested Fix:**
```tsx
<div
  className="relative group flex items-center gap-1.5"
  tabIndex={0}
  role="status"
  aria-describedby="matchplay-tooltip"
>
  <span className={`inline-block w-2.5 h-2.5 rounded-full ...`} aria-hidden="true" />
  <span className={`text-xs whitespace-nowrap ...`}>
    {isLinked ? "MatchPlay Linked" : "MatchPlay Not Linked"}
  </span>
  <div
    id="matchplay-tooltip"
    role="tooltip"
    className="absolute left-0 top-full mt-1.5 hidden group-hover:block group-focus:block z-10 ..."
  >
    {tooltipText}
  </div>
</div>
```

**Why Deferred:**
Non-blocking - the indicator displays correctly for mouse users. This is an accessibility enhancement for keyboard navigation and screen reader users.

---

### [LOW] Add E2E Tests for Admin CMS
**Added:** 2026-01-12 | **Source:** PR #TBD (feature/admin-cms) / Code Review
**Area:** Testing
**Files:** New file needed: `e2e/admin-content.spec.ts`

**Current Behavior:**
The admin CMS feature has no E2E tests covering the user journeys for editing pages and managing FAQ items.

**Suggested Improvement:**
Add Playwright E2E tests covering:
1. Navigate to admin content dashboard
2. Edit markdown page content (About, Privacy, Changelog)
3. Preview rendered markdown
4. Add/edit/delete FAQ items
5. Reorder FAQ items
6. Verify changes appear on public pages

**Why Deferred:**
Non-blocking - feature works correctly. E2E tests would add confidence for future changes but the admin CMS is a lower-traffic feature.

---

### [LOW] Add Content Length Validation to CMS Server Actions
**Added:** 2026-01-12 | **Source:** PR #TBD (feature/admin-cms) / Code Review
**Area:** Security, UX
**Files:** `src/app/admin/content/actions.ts`

**Current Behavior:**
The `updatePageContent` and FAQ server actions accept content without length limits. Very large content submissions could cause issues.

**Code Context:**
```typescript
// src/app/admin/content/actions.ts
export async function updatePageContent(
  slug: string,
  title: string,
  content: string  // No length validation
): Promise<{ success?: boolean; error?: string }> {
```

**Suggested Improvement:**
Add reasonable content length limits (e.g., 100KB for page content, 10KB for FAQ answers).

**Suggested Fix:**
```typescript
const MAX_PAGE_CONTENT_LENGTH = 100_000; // 100KB
const MAX_FAQ_ANSWER_LENGTH = 10_000;    // 10KB

export async function updatePageContent(
  slug: string,
  title: string,
  content: string
): Promise<{ success?: boolean; error?: string }> {
  if (content.length > MAX_PAGE_CONTENT_LENGTH) {
    return { error: `Content exceeds maximum length of ${MAX_PAGE_CONTENT_LENGTH} characters` };
  }
  // ... rest of function
}
```

**Why Deferred:**
Non-blocking - only admins can submit content, and admins are trusted. This is a defense-in-depth measure.

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
