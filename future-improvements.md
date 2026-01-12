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

### [HIGH] Standardize Match Play Client Error Handling
**Added:** 2026-01-12 | **Source:** PR #46 / Code Review
**Area:** Error Handling
**Files:** `src/app/api/matchplay/results/route.ts` (lines 118-124), and other Match Play API routes

**Current Behavior:**
The catch block in the results sync API uses a generic fallback message pattern. Each Match Play API route handles errors slightly differently, and error messages may inconsistently reveal or hide Match Play API internals.

**Code Context:**
```typescript
// src/app/api/matchplay/results/route.ts:118-124
} catch (error) {
  const message = error instanceof Error ? error.message : 'Failed to fetch from Match Play';
  return NextResponse.json(
    { success: false, imported: 0, skipped: 0, byRound: {}, error: message },
    { status: 502 }
  );
}
```

**Suggested Improvement:**
Create a wrapper function to standardize Match Play client error handling across all endpoints. This ensures consistent error messages, proper logging, and prevents information leakage.

**Suggested Fix:**
```typescript
// Add to src/lib/matchplay/client.ts or a new utils file

export async function safeMatchPlayCall<T>(
  fn: () => Promise<T>,
  actionName: string
): Promise<{ data: T } | { error: string; status: number }> {
  try {
    return { data: await fn() };
  } catch (err) {
    console.error(`[Match Play] ${actionName} failed:`, err);

    if (err instanceof MatchPlayError) {
      // Use Match Play error status but sanitize message
      return {
        error: `Match Play ${actionName} failed: ${err.message}`,
        status: err.status
      };
    }

    // Generic fallback for unexpected errors
    return {
      error: `Failed to ${actionName} from Match Play`,
      status: 502
    };
  }
}

// Usage in routes:
const result = await safeMatchPlayCall(
  () => client.getCompletedGames(matchplayId),
  'fetch games'
);
if ('error' in result) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
const games = result.data;
```

**Why Deferred:**
Non-blocking - current implementation is safe (uses generic fallback). Improvement is for consistency and maintainability.

---

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

## Completed Items

Move items here when they've been addressed, with a note about which PR fixed them.

```markdown
### [SEVERITY] Description
**Completed:** YYYY-MM-DD | **Fixed in:** PR #XX
```

<!-- No completed items yet -->
