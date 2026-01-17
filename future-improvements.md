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

### [MEDIUM] Add Unit Tests for Bulk Player Sync API Routes
**Added:** 2026-01-15 | **Source:** PR #TBD (feature/bulk-player-sync) / Code Review
**Area:** Testing
**Files:**
- `src/app/api/matchplay/bulk-players-preview/route.ts`
- `src/app/api/matchplay/bulk-players-apply/route.ts`

**Current Behavior:**
The new bulk player sync API routes have no unit tests. They perform critical database operations (deleting and inserting players) that should be tested.

**Suggested Improvement:**
Add unit tests in `__tests__/unit/api/` covering:
- Authentication and authorization checks
- Request body validation
- Error handling for various failure modes
- Correct re-validation against Match Play API
- Seeding change log entries when brackets exist

**Why Deferred:**
Non-blocking - the API routes follow established patterns and have been manually tested. Unit tests would add confidence but the core functionality is proven by integration.

---

### [LOW] Add E2E Tests for Bulk Player Sync Wizard
**Added:** 2026-01-15 | **Source:** PR #TBD (feature/bulk-player-sync) / Code Review
**Area:** Testing
**Files:** New file needed: `e2e/admin-bulk-player-sync.spec.ts`

**Current Behavior:**
The bulk player sync feature has no E2E tests covering the multi-phase wizard UI.

**Suggested Improvement:**
Add Playwright E2E tests covering:
1. Admin can initiate bulk player sync
2. Progress indicators display correctly during fetching
3. Review modal shows diff correctly
4. Accept/Skip functionality works
5. Apply all completes successfully

**Why Deferred:**
Non-blocking - feature works correctly. E2E tests would catch UI regressions but the wizard follows patterns from the existing codebase.

---

### [LOW] Extract TournamentPreview Interface to Shared Types
**Added:** 2026-01-15 | **Source:** PR #TBD (feature/bulk-player-sync) / Code Review
**Area:** Code Quality, Maintainability
**Files:**
- `src/components/admin/BulkPlayerSyncButton.tsx` (lines 8-20)
- `src/app/api/matchplay/bulk-players-preview/route.ts` (lines 11-23)

**Current Behavior:**
The `TournamentPreview` interface is duplicated between the component and the API route.

**Suggested Improvement:**
Create a shared type in `src/lib/matchplay/index.ts` or `src/lib/types.ts`:
```typescript
export interface TournamentPreviewResponse {
  tournament: { id: string; name: string; matchplay_id: string };
  players: MappedPlayer[];
  diff: PlayerDiff | null;
  hasChanges: boolean;
  bracketCount: number;
  existingCount: number;
  error?: string;
}
```

**Why Deferred:**
Non-blocking - both interfaces are identical and work correctly. This is a maintainability improvement for future changes.

---

### [LOW] Add Focus Ring to View Mode Toggle Button
**Added:** 2026-01-15 | **Source:** Code Review (feature/bracket-view-mode-toggle)
**Area:** Accessibility
**Files:** `src/components/bracket/Bracket.tsx` (lines 502-516)

**Current Behavior:**
The view mode toggle button (Results/Original Predictions) has no visible focus indicator for keyboard users.

**Code Context:**
```tsx
<button
  type="button"
  onClick={() => setViewMode(v => v === 'results' ? 'predictions' : 'results')}
  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
    viewMode === 'results'
      ? "bg-[rgb(var(--color-accent-primary))]"
      : "bg-[rgb(var(--color-border-secondary))]"
  }`}
  aria-label={...}
>
```

**Suggested Improvement:**
Add focus ring styling consistent with other interactive elements.

**Suggested Fix:**
```tsx
className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer
  focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] focus:ring-offset-2
  ${viewMode === 'results' ? "bg-[rgb(var(--color-accent-primary))]" : "bg-[rgb(var(--color-border-secondary))]"}`}
```

**Why Deferred:**
Non-blocking - toggle works correctly for mouse users. This is an accessibility enhancement for keyboard navigation.

---

### [MEDIUM] Extract TournamentRow to Shared Component
**Added:** 2026-01-15 | **Source:** PR #58 / Code Review
**Area:** Code Quality, Maintainability
**Files:**
- `src/components/admin/UpcomingTournaments.tsx` (lines 80-115)
- `src/app/admin/page.tsx` (lines 116-156)

**Current Behavior:**
The `TournamentRow` component is duplicated between `UpcomingTournaments.tsx` and the admin page. Both render tournament rows with similar structure but slightly different details (the new component shows state in the subtitle).

**Suggested Improvement:**
Extract `TournamentRow` to a shared component in `src/components/admin/TournamentRow.tsx` that can be configured via props.

**Suggested Fix:**
```typescript
// src/components/admin/TournamentRow.tsx
interface TournamentRowProps {
  tournament: Tournament;
  badgeColor: string;
  showState?: boolean;
}

export function TournamentRow({ tournament, badgeColor, showState = false }: TournamentRowProps) {
  // Shared implementation with optional state display
}
```

**Why Deferred:**
Non-blocking - both implementations work correctly. This is a maintainability improvement to reduce duplication.

---

### [LOW] Remove Dead "orange" Color Path in Match.tsx
**Added:** 2026-01-17 | **Source:** PR #TBD (fix/bracket-alignment-and-centering) / Code Review
**Area:** Code Quality
**Files:** `src/components/bracket/Match.tsx` (lines 81-82, 161)

**Current Behavior:**
The `resultBarColor` type includes "orange" as a valid option, and the result bar styling includes an orange case, but "orange" is never assigned anywhere in the code. The code always assigns "green" or "red".

**Code Context:**
```typescript
// Line 81-82: Type includes orange
let resultBarColor: "green" | "red" | "orange" | null = null;

// Line 161: Orange case in styling (never reached)
: "bg-[rgb(var(--color-warning-bg))] text-[rgb(var(--color-warning-text))] ..."
```

**Suggested Improvement:**
Remove the unused "orange" option from the type and the corresponding styling branch.

**Suggested Fix:**
```typescript
// Simplified type
let resultBarColor: "green" | "red" | null = null;

// Remove the orange styling branch from the template literal
```

**Why Deferred:**
Non-blocking - the dead code doesn't affect functionality. Minor cleanup that can be done in a future refactoring pass.

---

### [LOW] Add aria-pressed to State Filter Buttons
**Added:** 2026-01-15 | **Source:** PR #58 / Code Review
**Area:** Accessibility
**Files:** `src/components/admin/UpcomingTournaments.tsx` (lines 36-55)

**Current Behavior:**
The state filter buttons change visual appearance when selected but don't communicate selection state to screen readers.

**Code Context:**
```tsx
<button
  onClick={() => setSelectedState("all")}
  className={`px-3 py-1 text-sm rounded-full transition-colors ${
    selectedState === "all"
      ? "bg-[rgb(var(--color-accent-primary))] text-white"
      : "bg-[rgb(var(--color-bg-secondary))] ..."
  }`}
>
  All
</button>
```

**Suggested Improvement:**
Add `aria-pressed` attribute to communicate toggle state to assistive technologies.

**Suggested Fix:**
```tsx
<button
  onClick={() => setSelectedState("all")}
  aria-pressed={selectedState === "all"}
  className={...}
>
  All
</button>
```

**Why Deferred:**
Non-blocking - filters work correctly for sighted users. This is an accessibility enhancement for screen reader users.

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
