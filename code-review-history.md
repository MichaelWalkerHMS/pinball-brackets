# PR Review - Replace lock_date with Results-Based Locking

**Review Date:** 2026-01-17
**Branch:** feature/results-based-locking
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR replaces the timestamp-based `lock_date` field with computed lock status based on whether results exist for the tournament. This is a significant architectural improvement that eliminates the need for manual lock date management and allows tournaments to automatically unlock when results are cleared. The implementation includes a database migration, TypeScript type updates, RLS policy updates, and UI changes across multiple components.

---

## Findings

### CRITICAL

None.

---

### HIGH

#### 1. TypeScript Errors - Test Fixtures Still Reference `lock_date`

**File:** `__tests__/unit/components/dashboard/MyBracketsTable.test.tsx` (lines 16, 34, 52)

**Issue:**
The test fixtures for `MyBracketsTable` still include `lock_date` fields that no longer exist in the `DashboardBracket` type. This causes TypeScript compilation errors:

```
error TS2353: Object literal may only specify known properties, and 'lock_date' does not exist in type 'DashboardBracket'.
```

**Why it matters:**
TypeScript compilation fails, preventing the build from completing. This is a blocking issue that must be fixed before merge.

**Suggested fix:**
Remove the `lock_date` property from all mock bracket objects in the test file:

```typescript
// Remove these lines (16, 34, 52):
lock_date: "2026-01-17T12:00:00Z",
```

---

#### 2. Import Script Still References `lock_date`

**File:** `src/scripts/import-state-tournaments.ts` (lines 259-260, 283)

**Issue:**
The tournament import script still creates a `lockDate` variable and attempts to insert it into the tournaments table:

```typescript
// Line 259-260
const lockDate = startDate;

// Line 283
lock_date: lockDate.toISOString(),
```

**Why it matters:**
After the migration runs, the `lock_date` column will no longer exist, so this script will fail at runtime when trying to import tournaments. This should be cleaned up for consistency.

**Suggested fix:**
Remove the `lockDate` variable and the `lock_date` field from the insert:

```typescript
// Remove line 259-260:
// Lock date = start date
const lockDate = startDate;

// Remove from insert on line 283:
// lock_date: lockDate.toISOString(),
```

---

### MEDIUM

#### 1. next-env.d.ts Modification Should Not Be Committed

**File:** `next-env.d.ts` (line 3)

**Issue:**
The diff shows a change from `.next/dev/types/routes.d.ts` to `.next/types/routes.d.ts`. This is an auto-generated file managed by Next.js that should not be committed.

**Why it matters:**
This file header explicitly states "This file should not be edited." Committing changes causes unnecessary merge conflicts and isn't a real code change. This is documented in `coding-standards.md` as a recurring issue.

**Suggested fix:**
Revert this change before committing:
```bash
git checkout main -- next-env.d.ts
```

---

### LOW

None.

---

### PRAISE

#### Excellent Migration Documentation

**File:** `supabase/migrations/20260116125304_replace_lock_date_with_results_check.sql`

The migration is excellently documented with:
- Clear header explaining what the change does and why
- Explicit documentation of the new behavior
- Section headers for different parts of the migration
- Comments explaining each policy's purpose

This is a model for how database migrations should be documented.

#### Clean RLS Policy Design

**File:** `supabase/migrations/20260116125304_replace_lock_date_with_results_check.sql` (lines 35-116)

The new RLS policies are well-designed:
- Proper `NOT EXISTS` subqueries to check for results
- Consistent pattern across brackets and picks tables
- Correct handling of the `bracket_id` join for picks policies
- Appropriate use of `(select auth.uid())` pattern (recommended over direct `auth.uid()` calls)

#### Comprehensive Code Updates

The lock status logic has been consistently updated across all relevant files:
- `src/app/bracket/[id]/edit/page.tsx` - Edit page lock check
- `src/app/bracket/[id]/page.tsx` - View page lock check
- `src/app/tournament/[id]/page.tsx` - Tournament hub lock check
- `src/app/tournament/[id]/actions.ts` - Server actions lock checks
- `src/components/dashboard/CreateBracketWizard.tsx` - Tournament filtering
- `src/components/landing/TournamentWizard.tsx` - Tournament filtering
- `src/components/dashboard/TournamentDetails.tsx` - Lock status display

#### Smart has_results Computation

**File:** `src/app/page.tsx` (lines 17-26)

The approach to computing `has_results` as a derived field is elegant:
```typescript
const tournaments = tournamentsRaw?.map((t) => ({
  ...t,
  has_results: (t.results?.[0]?.count ?? 0) > 0,
  results: undefined, // Remove the raw results array
})) as Tournament[] | null;
```

This leverages Supabase's `select("*, results(count)")` pattern to efficiently get the count without loading all results.

#### Proper Type Updates

**File:** `src/lib/types/index.ts`

The type changes are appropriate:
- `lock_date` removed from `Tournament` type
- `has_results` added as optional computed field
- `lock_date` removed from `TournamentFormData`
- `lock_date` removed from `DashboardBracket`

#### Clean Admin Form Update

**File:** `src/components/admin/TournamentForm.tsx`

The admin form correctly removes the lock date input field and updates the grid from 3 columns to 2 columns for the remaining date fields.

#### Appropriate Test Fixture Updates

**File:** `__tests__/fixtures/tournaments.ts`

The test fixtures correctly update the mock tournaments to use `has_results` instead of `lock_date`, with clear comments explaining when tournaments are locked vs open.

#### E2E Test Update

**File:** `e2e/dashboard.spec.ts`

The E2E test correctly updates to check for the new "Open" or "Locked" text pattern instead of the old "Lock" date format.

---

## Verification

- **TypeScript:** FAILS - 3 errors in MyBracketsTable.test.tsx (lock_date references)
- **Tests:** Cannot run due to TypeScript errors
- **Coding Standards:** next-env.d.ts modification violates standard

---

## Proposed Standards

None. The migration documentation pattern used here is already the expected standard.

---

## Verdict

**Status:** CHANGES_REQUESTED

Three issues need to be addressed before merge:

1. **[HIGH] Fix TypeScript errors** - Remove `lock_date` from test fixtures in `MyBracketsTable.test.tsx`
2. **[HIGH] Fix import script** - Remove `lock_date` references from `import-state-tournaments.ts`
3. **[MEDIUM] Revert next-env.d.ts** - This auto-generated file change should not be committed

The architectural design is solid and the implementation is well-documented. Once these issues are fixed, re-run the review for approval.

---

---

# PR Review - Admin UI Improvements (Final - State Dropdown + Sorting)

**Review Date:** 2026-01-15
**Branch:** feature/admin-ui-improvements
**Reviewer:** Code Review Agent
**Iteration:** 3 of max 5

---

## Summary

This is a re-review after additional improvements in commits 3 and 4. The PR now contains four commits: (1) adds state filters to the admin Upcoming section and renames the Results Sync button, (2) extracts TournamentRow to a shared component, (3) changes the state filter from pill buttons to a dropdown, and (4) sorts upcoming tournaments by state name ascending. All changes are clean, follow coding standards, and improve the admin UX.

---

## Previous Issues - Resolution Status

| Issue | Status |
|-------|--------|
| Duplicated TournamentRow component | FIXED in commit 2 |
| Accessibility concern for filter buttons | RESOLVED - Changed to dropdown which has better native accessibility |

---

## Findings

### CRITICAL

None.

---

### HIGH

None.

---

### MEDIUM

None.

---

### LOW

None.

---

### Praise

#### Excellent Dropdown Improvement

**File:** `src/components/admin/UpcomingTournaments.tsx` (lines 35-47)

The change from pill buttons to a dropdown `<select>` is a good UX improvement:
- More compact for many states
- Native HTML select has better accessibility than custom buttons
- Proper focus ring styling with `focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))]`
- All CSS variables correctly used for colors and borders

```tsx
<select
  value={selectedState}
  onChange={(e) => setSelectedState(e.target.value)}
  className="px-3 py-1.5 text-sm rounded-lg border border-[rgb(var(--color-border-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))]"
>
```

#### Smart State Sorting

**File:** `src/components/admin/UpcomingTournaments.tsx` (lines 21-26)

The tournaments are now sorted by state name ascending, which groups tournaments from the same state together. This makes it easier to scan when viewing "All States":

```typescript
const filteredTournaments = useMemo(() => {
  const filtered = selectedState === "all"
    ? tournaments
    : tournaments.filter((t) => t.state === selectedState);
  return [...filtered].sort((a, b) => a.state.localeCompare(b.state));
}, [tournaments, selectedState]);
```

The use of `localeCompare` is the correct approach for string sorting.

#### All Previous Praise Items Still Apply

- Clean TournamentRow extraction with optional `showState` prop
- Proper CSS variable usage throughout
- Clean memoization patterns
- Smart conditional rendering (dropdown only shows when multiple states)
- Empty state handling with clear user message
- Clear rename for Results Sync button

---

## Verification

- **Tests:** All 255 tests pass
- **TypeScript:** No type errors
- **Coding Standards:** Follows CSS variable pattern correctly
- **Previous Issues:** All resolved
- **No regression:** Existing functionality unchanged

---

## Proposed Standards

None. This implementation follows existing patterns well.

---

## Verdict

**Status:** APPROVED

All four commits are clean and follow best practices. Key strengths of the final implementation:

1. **DRY principle followed** - Single TournamentRow component serves both contexts
2. **Clean API** - Optional `showState` prop with sensible default
3. **Proper CSS variables** - All colors follow the coding standard
4. **Good memoization** - Computed values properly cached
5. **Smart UX** - Dropdown filter only appears when useful (multiple states)
6. **Better accessibility** - Native `<select>` has better a11y than custom buttons
7. **Logical sorting** - State name ascending groups related tournaments
8. **All 255 tests pass** - No regressions

Ready to push.

---

---

# PR Review - Admin UI Improvements (State Filters + Results Sync Rename + TournamentRow Extraction)

**Review Date:** 2026-01-15
**Branch:** feature/admin-ui-improvements
**Reviewer:** Code Review Agent
**Iteration:** 2 of max 5

---

## Summary

This is a re-review after the TournamentRow extraction was completed. The PR now contains two commits: (1) adds state filters to the admin Upcoming section and renames the Results Sync button, and (2) extracts the duplicated TournamentRow function into a shared component at `src/components/admin/TournamentRow.tsx` with an optional `showState` prop. The MEDIUM-severity code duplication issue from iteration 1 has been fully resolved.

---

## Previous Issues - Resolution Status

| Issue | Status |
|-------|--------|
| Duplicated TournamentRow component | FIXED - Extracted to shared component |

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

None.

---

### 🔵 Low

#### 1. Consider Accessibility for State Filter Buttons (carried from iteration 1)

**File:** `src/components/admin/UpcomingTournaments.tsx` (lines 36-58)

**Issue:**
The state filter buttons work for mouse users, but they lack aria-labels or role attributes to indicate their purpose to screen readers. The current active state is communicated visually but not programmatically.

**Why it matters:**
Minor accessibility improvement. Screen reader users wouldn't know these are filter buttons or which one is currently selected.

**Suggested enhancement (optional):**
```tsx
<button
  aria-pressed={selectedState === "all"}
  aria-label="Show all states"
  onClick={() => setSelectedState("all")}
  // ...
>
```

No change required for approval - this is a suggestion for future improvement.

---

### 🟢 Praise

#### Excellent Component Extraction

**File:** `src/components/admin/TournamentRow.tsx`

The TournamentRow extraction is clean and well-designed:
- Single shared component replaces two nearly-identical implementations
- Optional `showState` prop (defaulting to `false`) handles the visual difference between contexts
- Clean TypeScript interface with `TournamentRowProps`
- Default export follows the component file pattern used elsewhere
- All CSS variables properly preserved

#### Clean Integration in Both Contexts

**Files:** `src/app/admin/page.tsx`, `src/components/admin/UpcomingTournaments.tsx`

Both files now import and use the shared TournamentRow component:
- `admin/page.tsx` uses it without `showState` (or with `showState={false}` implicitly)
- `UpcomingTournaments.tsx` uses it with `showState` (boolean shorthand for `showState={true}`)

This is exactly the refactoring that was suggested in iteration 1.

#### Proper Removal of Duplicate Code

**File:** `src/app/admin/page.tsx` (diff lines 113-153)

The original `TournamentRow` function (41 lines) was removed from the admin page, eliminating the code duplication entirely. The `TournamentSection` component now imports from the shared location.

#### All Previous Praise Items Still Apply

- Excellent CSS variable usage throughout
- Clean memoization pattern in UpcomingTournaments
- Smart conditional rendering (filter only shows when multiple states)
- Empty state handling with clear user message
- Clear rename for Results Sync button

---

## Verification

- **Tests:** All 255 tests pass
- **TypeScript:** No type errors
- **Coding Standards:** Follows CSS variable pattern correctly
- **Previous Issue:** TournamentRow duplication resolved via component extraction
- **No regression:** Existing functionality unchanged

---

## Proposed Standards

None. This implementation follows existing patterns well.

---

## Verdict

**Status:** APPROVED

All issues from iteration 1 have been resolved. The TournamentRow extraction is clean, follows React/TypeScript best practices, and eliminates the code duplication concern. Key strengths:

1. **DRY principle followed** - Single TournamentRow component serves both contexts
2. **Clean API** - Optional `showState` prop with sensible default
3. **Proper CSS variables** - All colors follow the coding standard
4. **Good memoization** - Computed values properly cached
5. **Smart UX** - Filter only appears when useful (multiple states)
6. **All 255 tests pass** - No regressions

The only remaining item is a LOW-severity accessibility suggestion for filter buttons, which is optional. Ready to push.

---

---

# PR Review - Admin UI Improvements (State Filters + Results Sync Rename)

**Review Date:** 2026-01-15
**Branch:** feature/admin-ui-improvements
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR makes two minor improvements to the admin dashboard: (1) Adds state filter buttons to the Upcoming tournaments section, allowing admins to filter by state when there are tournaments in multiple states, and (2) Renames the "Match Play Sync" box to "Results Sync" with button text "Sync All Results" for clearer labeling. The implementation is clean, follows CSS variable standards, properly memoizes computed values, and reuses existing UI patterns.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

#### 1. Duplicated TournamentRow Component

**File:** `src/components/admin/UpcomingTournaments.tsx` (lines 83-123) and `src/app/admin/page.tsx` (lines 113-153)

**Issue:**
The new `UpcomingTournaments.tsx` file contains a `TournamentRow` component that is nearly identical to the `TournamentRow` function in `admin/page.tsx`. The only difference is that the new version includes the state in the subtitle text.

**Why it matters:**
Code duplication makes maintenance harder. If the row design changes, both places need updating. The two implementations could drift apart over time.

**Suggested fix:**
Consider extracting `TournamentRow` to a shared component in `src/components/admin/` that accepts an optional `showState` prop:
```typescript
// src/components/admin/TournamentRow.tsx
export function TournamentRow({
  tournament,
  badgeColor,
  showState = false,
}: {
  tournament: Tournament;
  badgeColor: string;
  showState?: boolean;
}) {
  // ...
  <p className="text-sm text-[rgb(var(--color-text-muted))]">
    {formattedDate} &bull; {tournament.player_count} players
    {showState && ` \u2022 ${tournament.state}`}
  </p>
}
```

Then both `TournamentSection` and `UpcomingTournaments` can import and use the shared component.

**Recommendation:** This is a valid refactoring opportunity but not blocking since the current implementation works correctly. Can be addressed now or deferred.

---

### 🔵 Low

#### 1. Consider Accessibility for State Filter Buttons

**File:** `src/components/admin/UpcomingTournaments.tsx` (lines 36-58)

**Issue:**
The state filter buttons work for mouse users, but they lack aria-labels or role attributes to indicate their purpose to screen readers. The current active state is communicated visually but not programmatically.

**Why it matters:**
Minor accessibility improvement. Screen reader users wouldn't know these are filter buttons or which one is currently selected.

**Suggested enhancement (optional):**
```tsx
<button
  aria-pressed={selectedState === "all"}
  aria-label="Show all states"
  onClick={() => setSelectedState("all")}
  // ...
>
```

No change required for approval - this is a suggestion for future improvement.

---

### 🟢 Praise

#### Excellent CSS Variable Usage

**File:** `src/components/admin/UpcomingTournaments.tsx` (all styling)

All colors correctly use CSS variables as required by coding standards:
- `text-[rgb(var(--color-text-primary))]` for headings
- `text-[rgb(var(--color-text-muted))]` for filter label and subtitles
- `bg-[rgb(var(--color-accent-primary))]` for active filter state
- `bg-[rgb(var(--color-bg-secondary))]` for inactive filter state
- `border-[rgb(var(--color-border-primary))]` for container borders

This follows the established "Use CSS Variables for Colors" coding standard perfectly.

#### Clean Memoization Pattern

**File:** `src/components/admin/UpcomingTournaments.tsx` (lines 15-24)

The component correctly memoizes both the unique states list and the filtered tournaments:
```typescript
const states = useMemo(() => {
  const uniqueStates = [...new Set(tournaments.map((t) => t.state))].sort();
  return uniqueStates;
}, [tournaments]);

const filteredTournaments = useMemo(() => {
  if (selectedState === "all") return tournaments;
  return tournaments.filter((t) => t.state === selectedState);
}, [tournaments, selectedState]);
```

This avoids unnecessary recomputation on each render.

#### Smart Conditional Rendering

**File:** `src/components/admin/UpcomingTournaments.tsx` (line 32)

The filter UI only appears when there are multiple states:
```tsx
{states.length > 1 && (
```

This avoids showing a useless "All | MI" filter when all tournaments are in a single state.

#### Empty State Handling

**File:** `src/components/admin/UpcomingTournaments.tsx` (lines 74-78)

The component handles the case where filtering results in no tournaments:
```tsx
<p className="text-[rgb(var(--color-text-muted))]">No upcoming tournaments in {selectedState}</p>
```

This provides clear feedback to the user.

#### Clear Rename for Results Sync

**File:** `src/components/admin/BulkSyncButton.tsx` (lines 62, 111)

The rename from "Match Play Sync" to "Results Sync" and "Sync All" to "Sync All Results" is a good UX improvement. The description still mentions "Match Play" where relevant (line 65), so users understand the source, but the primary label now describes the action more clearly.

---

## Verification

- **Tests:** All 255 tests pass
- **TypeScript:** No type errors
- **Coding Standards:** Follows CSS variable pattern correctly
- **No regression:** Existing functionality unchanged

---

## Proposed Standards

None. This implementation follows existing patterns well.

---

## Verdict

**Status:** APPROVED

The implementation is clean and functional. Key strengths:

1. **Proper CSS variables** - All colors follow the coding standard
2. **Good memoization** - Computed values are properly cached
3. **Smart UX** - Filter only appears when useful (multiple states)
4. **Empty state handled** - Clear message when no tournaments match filter

The only MEDIUM finding (duplicated TournamentRow) is a valid refactoring opportunity but not a blocking issue since:
- The current implementation is correct and fully functional
- The duplication is minor (one component in two places)
- The visual difference (showing state) is intentional

**Recommendation:** Can merge as-is and optionally address the TournamentRow extraction in a future cleanup PR, or address it now if preferred.

---

---

# PR Review - Bracket View Mode Toggle

**Review Date:** 2026-01-15
**Branch:** feature/bracket-view-mode-toggle
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR adds a view mode toggle to the bracket prediction page that allows users to switch between "Results" mode (showing result overlays with correct/incorrect highlighting) and "Original Predictions" mode (showing pure predictions without any result indicators). The implementation is clean, reuses the existing toggle pattern from the public/private toggle, follows CSS variable standards, and properly handles the data flow by conditionally passing empty maps instead of null values.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

None.

---

### 🔵 Low

#### 1. Consider Keyboard Accessibility for Toggle

**File:** `src/components/bracket/Bracket.tsx` (lines 502-517)

**Issue:**
The view mode toggle button works for mouse and touch users, but the toggle doesn't have focus ring styling that matches the other toggles in the codebase. While the button is technically keyboard-accessible (since it's a `<button>`), adding visible focus styles would improve the experience.

**Why it matters:**
Minor accessibility improvement. The toggle is functional for keyboard users, but visual feedback on focus is helpful.

**Suggested enhancement (optional):**
```tsx
<button
  type="button"
  onClick={() => setViewMode(v => v === 'results' ? 'predictions' : 'results')}
  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] focus:ring-offset-2 ${
    viewMode === 'results'
      ? "bg-[rgb(var(--color-accent-primary))]"
      : "bg-[rgb(var(--color-border-secondary))]"
  }`}
```

No change required for approval - this is a suggestion for future improvement.

---

### 🟢 Praise

#### Excellent Reuse of Existing Toggle Pattern

**File:** `src/components/bracket/Bracket.tsx` (lines 496-522)

The view mode toggle perfectly mirrors the existing public/private toggle pattern:
- Same visual design (pill-shaped toggle with sliding dot)
- Same CSS classes for active/inactive states
- Proper `aria-label` for screen readers
- Clean state management with union type `'results' | 'predictions'`

This consistency makes the UI feel cohesive and the code easier to maintain.

#### Smart Data Flow Architecture

**File:** `src/components/bracket/Bracket.tsx` (lines 114-145)

The approach of computing full data once and then conditionally passing empty maps is elegant:
```typescript
const actualParticipantsMapFull = useMemo(...);
const actualParticipantsMap = viewMode === 'results' ? actualParticipantsMapFull : new Map();

const pickResultMapFull = useMemo(...);
const pickResultMap = viewMode === 'results' ? pickResultMapFull : new Map();
```

This avoids:
- Re-computing data on every toggle
- Passing `null` values that would require null checks throughout child components
- Breaking the existing component interfaces

The existing components just see empty maps and render accordingly.

#### Proper CSS Variable Usage

**File:** `src/components/bracket/Bracket.tsx` (lines 498-519)

All colors use CSS variables as required by coding standards:
- `bg-[rgb(var(--color-bg-secondary))]` for container
- `text-[rgb(var(--color-text-primary))]` and `text-[rgb(var(--color-text-secondary))]` for labels
- `bg-[rgb(var(--color-accent-primary))]` and `bg-[rgb(var(--color-border-secondary))]` for toggle states

#### Clean Props Addition to Round Component

**File:** `src/components/bracket/Round.tsx` (lines 36, 51, 78)

The `hideSubtotal` prop is a clean, minimal addition:
- Well-documented with JSDoc comment explaining purpose
- Uses simple boolean logic: `{hasAnyScored && subtotal && !hideSubtotal && ...}`
- Doesn't require changes to parent components beyond passing the prop

#### Subtotals Still Calculate Correctly

**File:** `src/components/bracket/Bracket.tsx` (lines 147-154)

Important detail: `pickCorrectnessMap` still uses `pickResultMapFull`, not the conditionally-empty `pickResultMap`. This ensures that:
- The internal scoring/calculation always uses real data
- Only the visual display is affected by the toggle
- Users see their actual score even in "Original Predictions" mode (if they scroll to see it elsewhere)

---

## Verification

- **Tests:** All 255 tests pass
- **TypeScript:** No type errors
- **Coding Standards:** Follows CSS variable pattern correctly
- **No regression:** Existing functionality unchanged when toggle is in "results" mode

---

## Proposed Standards

None. This implementation follows existing patterns well.

---

## Verdict

**Status:** APPROVED

The implementation is clean, well-architected, and follows all established coding patterns. Key strengths:

1. **Consistent UI** - Toggle matches existing public/private toggle design
2. **Smart data handling** - Empty maps avoid null checks and component interface changes
3. **Proper CSS variables** - All colors follow the coding standard
4. **Minimal prop additions** - `hideSubtotal` is the only new prop needed
5. **No test breakage** - All 255 tests pass

The only remaining item is a LOW-severity accessibility suggestion for focus styles, which is optional. Ready to commit and push.

---

---

# PR Review - State/Province Label Update

**Review Date:** 2026-01-15
**Branch:** feature/bulk-player-sync
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR updates three text strings in the TournamentWizard component to change "State" to "State/Province" - the label, placeholder, and hint text. This is a simple internationalization improvement to be more inclusive of Canadian provinces. The change is minimal, focused, and has no functional impact.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

None.

---

### 🔵 Low

None.

---

### 🟢 Praise

#### Clean, Focused Change

**File:** `src/components/landing/TournamentWizard.tsx` (lines 88, 96, 127)

This is exactly how small text changes should be done:
- Only the necessary strings are modified
- No unrelated code changes
- No formatting changes
- Clear, consistent terminology across all three locations

#### Good Internationalization Thinking

The change from "State" to "State/Province" makes the UI more inclusive for Canadian users without adding complexity. The slash notation is a common UI pattern for this type of regional variation.

---

## Proposed Standards

None. This is a straightforward text change that doesn't warrant a new standard.

---

## Verdict

**Status:** APPROVED

This is a clean, minimal change that improves the user experience for Canadian users. No blocking issues found. Ready to push.

---

---

# PR Review - Admin CMS for Static Pages

**Review Date:** 2026-01-12
**Branch:** feature/admin-cms
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR adds an admin CMS for managing static pages (About, Privacy, Changelog) and FAQ content. The implementation includes new database tables with proper RLS policies, a markdown editor with live preview, a structured FAQ editor with reorder functionality, and updated public pages that render content from the database using react-markdown. Overall, this is a well-designed feature with good security practices, but there are two issues that need to be addressed before merging.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

#### 1. next-env.d.ts Modification Should Not Be Committed

**File:** `next-env.d.ts` (line 3)

**Issue:**
The diff shows a change from `.next/dev/types/routes.d.ts` to `.next/types/routes.d.ts`. This is an auto-generated file managed by Next.js that should not be committed.

**Why it matters:**
This file header explicitly states "This file should not be edited." Committing changes causes unnecessary merge conflicts and isn't a real code change. This has been a recurring issue flagged in multiple previous reviews and is documented in `coding-standards.md`.

**Suggested fix:**
Revert this change before committing:
```bash
git checkout main -- next-env.d.ts
```

---

#### 2. Missing Barrel Export for Content Library

**File:** `src/lib/content/index.ts`

**Issue:**
While the content library has an index.ts file, it's not being re-exported from the main lib barrel export (if one exists), and the actions file in `src/app/admin/content/actions.ts` imports types directly from `@/lib/types` rather than from a consolidated content module export.

This is minor since the current approach works, but it's worth noting for consistency. The new module follows the barrel export pattern for its own directory, which is good.

**Why it matters:**
Minor inconsistency with the "Barrel Exports for Library Directories" coding standard. The current implementation is acceptable.

**Status:** No blocking action required - current implementation is acceptable.

---

#### 3. Duplicate Disclaimer Content in About Page

**File:** `src/app/about/page.tsx` (lines 33-39) and `supabase/migrations/20260112212008_add_site_content_cms.sql` (seeded content)

**Issue:**
The About page has a hardcoded "Disclaimer" section that is always displayed, but the seeded markdown content in the migration also includes a "## Disclaimer" section. This creates potential for duplicate or conflicting disclaimer content.

**Why it matters:**
If an admin edits the About page content and changes the disclaimer section in the markdown, users will see both the hardcoded disclaimer AND any disclaimer text in the markdown content.

**Suggested fix:**
Either:
1. Remove the disclaimer from the seeded markdown content (since it's always shown via hardcode), OR
2. Remove the hardcoded disclaimer section and rely on the markdown content

---

### 🔵 Low

#### 1. Missing E2E Tests for New Feature

**Issue:**
Per CLAUDE.md, new features should include E2E tests for the user journey. The admin CMS feature doesn't include any E2E tests.

**Why it matters:**
E2E tests help ensure the feature works correctly in the browser and catches regressions.

**Suggested fix (can be deferred):**
Add E2E tests covering:
- Admin can view content dashboard
- Admin can edit and save page content
- Admin can add/edit/delete/reorder FAQ items
- Non-admin users cannot access admin content pages

---

#### 2. Potentially Large Textarea Content Not Validated

**File:** `src/app/admin/content/actions.ts` (lines 38-42)

**Issue:**
The `updatePageContent` server action accepts `title` and `content` parameters without any validation on length or content. Very large content could cause performance issues.

**Why it matters:**
Minor security/performance consideration. The RLS policies ensure only admins can update, but there's no validation on content size.

**Suggested enhancement (optional):**
Consider adding basic validation:
```typescript
if (content.length > 100000) {
  return { error: "Content too large" };
}
```

---

### 🟢 Praise

#### Excellent RLS Policy Design

**File:** `supabase/migrations/20260112212008_add_site_content_cms.sql` (lines 32-72)

The RLS policies are well-designed:
- Public read access for both tables (appropriate for public content)
- Admin-only write access using the existing `public.is_admin()` function
- Separate policies for INSERT, UPDATE, DELETE operations on FAQ items
- Proper grants aligned with policies

This follows security best practices.

#### Clean Server Actions Pattern

**File:** `src/app/admin/content/actions.ts`

The server actions are well-structured:
- Centralized `requireAdmin()` function for consistent auth checking
- Clear return types with discriminated unions (`{ success?: boolean; error?: string }`)
- Proper path revalidation for both admin and public pages
- Good error logging with `console.error`

#### Well-Designed MarkdownRenderer Component

**File:** `src/components/MarkdownRenderer.tsx`

The component correctly:
- Uses CSS variables for all colors (follows coding standard)
- Handles external links properly with `target="_blank"` and `rel="noopener noreferrer"`
- Distinguishes between inline and block code
- Provides consistent styling that matches the site theme

#### Proper CSS Variable Usage Throughout

All new components consistently use CSS variables for styling:
- `rgb(var(--color-text-primary))` for text
- `rgb(var(--color-bg-primary))` for backgrounds
- `rgb(var(--color-accent-primary))` for interactive elements
- etc.

This follows the established "Use CSS Variables for Colors" coding standard perfectly.

#### Good UX in ContentEditor

**File:** `src/app/admin/content/[slug]/ContentEditor.tsx`

- Dirty state tracking with `isDirty` comparison
- Save button disabled when no changes
- Success message auto-clears after 3 seconds
- Live preview toggle between edit and preview modes
- Clear labels and helper text for markdown support

#### FAQ Editor with Reorder Functionality

**File:** `src/app/admin/content/faq/FAQEditor.tsx`

Well-implemented FAQ management:
- Inline editing with expand/collapse
- Move up/down buttons for reordering
- Add new FAQ form with validation
- Delete confirmation with browser confirm()
- Markdown preview for answers

#### Well-Documented Migration

**File:** `supabase/migrations/20260112212008_add_site_content_cms.sql`

The migration includes:
- Clear comment at top explaining purpose
- Appropriate indexes for common query patterns
- Seed data that migrates existing hardcoded content

---

## Proposed Standards

None. This implementation follows existing patterns well.

---

## Verdict

**Status:** CHANGES_REQUESTED

Two issues should be addressed before merge:

1. **Revert next-env.d.ts** - This auto-generated file change should not be committed (MEDIUM)
2. **Fix duplicate disclaimer** - Either remove from seeded content or remove hardcoded section to avoid duplicate content (MEDIUM)

The implementation is solid, well-secured with proper RLS policies, and follows coding standards for CSS variables. Once these issues are addressed, this is ready to merge.

---

---

# PR Review - MatchPlay Indicator Component (Iteration 2 - APPROVED)

**Review Date:** 2026-01-12
**Branch:** feature/matchplay-indicator
**Reviewer:** Code Review Agent
**Iteration:** 2 of max 5

---

## Summary

This is a re-review after fixes were applied. The `next-env.d.ts` change from iteration 1 has been successfully reverted. The MatchPlay indicator component implementation is clean, well-designed, follows coding standards for CSS variables, and is ready for commit.

---

## Previous Issues - Resolution Status

| Issue | Status |
|-------|--------|
| `next-env.d.ts` modification | FIXED (reverted) |

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

None.

---

### 🔵 Low

#### 1. Missing Accessibility Attributes for Tooltip (carried from iteration 1)

**File:** `src/components/bracket/MatchPlayIndicator.tsx` (lines 32-34)

**Issue:**
The tooltip is implemented using CSS hover which works for mouse users, but keyboard users and screen reader users cannot access the tooltip content.

**Why it matters:**
The tooltip contains useful information about the MatchPlay integration that should be accessible to all users.

**Suggested enhancement (optional):**
Consider adding `tabIndex={0}` to the wrapper div and `role="tooltip"` for screen reader support. No change required for approval - this is a suggestion for future improvement.

---

### 🟢 Praise

#### Excellent CSS Variable Usage

**File:** `src/components/bracket/MatchPlayIndicator.tsx`

The component correctly uses CSS variables for all colors:
- `bg-[rgb(var(--color-success-icon))]` for linked state
- `bg-[rgb(var(--color-text-muted))]` for unlinked state
- `text-[rgb(var(--color-success-text))]` for linked text
- `text-[rgb(var(--color-text-muted))]` for unlinked text
- `bg-[rgb(var(--color-bg-primary))]` and `border-[rgb(var(--color-border-primary))]` for tooltip

This follows the established coding standard "Use CSS Variables for Colors" perfectly.

#### Clean Component Design

**File:** `src/components/bracket/MatchPlayIndicator.tsx`

The component is well-designed:
- Single responsibility - displays one piece of status information
- Clean interface with only one required prop (`isLinked: boolean`)
- Self-contained - doesn't depend on external state
- Reusable - could be used in other contexts if needed

#### Proper Integration

**File:** `src/components/bracket/Bracket.tsx` (lines 428-429)

The indicator is integrated cleanly into the existing controls bar:
- Uses `isLinked={!!tournament.matchplay_id}` pattern with proper boolean coercion
- Placed alongside other status indicators (save message, locked status)
- The refactoring to always show the status div (removing the conditional) is a sensible improvement

#### Good UX Copy

**File:** `src/components/bracket/MatchPlayIndicator.tsx` (lines 6-8)

The tooltip text is clear and helpful:
- Linked: "This tournament is on Match Play, so results will be synced automatically!"
- Not linked: "This tournament is not linked to Match Play. Results must be entered manually."

The text explains the user benefit, not just the technical state.

#### Proper aria-hidden Usage

**File:** `src/components/bracket/MatchPlayIndicator.tsx` (line 19)

The decorative indicator dot correctly uses `aria-hidden="true"` since it's purely visual and the label text conveys the same information.

---

## Verification

- **Tests:** All 244 tests pass
- **TypeScript:** No type errors
- **Coding Standards:** Follows CSS variable pattern correctly
- **Previous Issue:** `next-env.d.ts` change reverted (verified via `git diff next-env.d.ts` - no output)

---

## Proposed Standards

None. This implementation follows existing patterns well.

---

## Verdict

**Status:** APPROVED

All previous issues have been resolved:
- `next-env.d.ts` is no longer modified (verified via git diff)
- All 244 tests pass
- TypeScript type checking passes
- Code follows established coding standards for CSS variables

The only remaining item is a LOW-severity accessibility suggestion, which is optional. Ready to commit and push.

---

---

# PR Review - MatchPlay Indicator Component

**Review Date:** 2026-01-12
**Branch:** feature/matchplay-indicator
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR adds a MatchPlay indicator component to the bracket edit page. The indicator shows whether a tournament is linked to MatchPlay with a visual status (green dot when linked, gray when not linked) and provides a tooltip explaining the integration benefit. The implementation is clean, follows coding standards for CSS variables, and integrates smoothly into the existing Bracket component.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

#### 1. next-env.d.ts Modification Should Not Be Committed

**File:** `next-env.d.ts` (line 3)

**Issue:**
The diff shows a change from `.next/dev/types/routes.d.ts` to `.next/types/routes.d.ts`. This is an auto-generated file managed by Next.js that should not be committed.

**Why it matters:**
This file header explicitly states "This file should not be edited." Committing changes causes unnecessary merge conflicts and isn't a real code change. This is a recurring issue that has been flagged in multiple previous reviews.

**Suggested fix:**
Revert this change before committing:
```bash
git checkout main -- next-env.d.ts
```

---

### 🔵 Low

#### 1. Missing Accessibility Attributes for Tooltip

**File:** `src/components/bracket/MatchPlayIndicator.tsx` (lines 32-34)

**Issue:**
The tooltip is implemented using CSS hover (`:hover` via Tailwind's `group-hover:`) which works for mouse users, but keyboard users and screen reader users cannot access the tooltip content.

**Why it matters:**
The tooltip contains useful information about the MatchPlay integration that should be accessible to all users. While this is a minor UX enhancement, accessibility is important.

**Suggested enhancement (optional):**
Consider adding `tabIndex={0}` to the wrapper div and `role="tooltip"` with `aria-describedby` for screen reader support:
```tsx
<div className="relative group flex items-center gap-1.5" tabIndex={0}>
  {/* ... */}
  <div
    role="tooltip"
    className="... group-focus:block ..."
  >
```

No change required for approval - this is a suggestion for future improvement.

---

### 🟢 Praise

#### Excellent CSS Variable Usage

**File:** `src/components/bracket/MatchPlayIndicator.tsx` (lines 14-17, 23-27)

The component correctly uses CSS variables for all colors:
- `bg-[rgb(var(--color-success-icon))]` for linked state
- `bg-[rgb(var(--color-text-muted))]` for unlinked state
- `text-[rgb(var(--color-success-text))]` for linked text
- `text-[rgb(var(--color-text-muted))]` for unlinked text
- `bg-[rgb(var(--color-bg-primary))]` and `border-[rgb(var(--color-border-primary))]` for tooltip

This follows the established coding standard "Use CSS Variables for Colors" perfectly.

#### Clean Component Design

**File:** `src/components/bracket/MatchPlayIndicator.tsx`

The component is well-designed:
- Single responsibility - displays one piece of status information
- Clean interface with only one required prop (`isLinked: boolean`)
- Self-contained - doesn't depend on external state
- Reusable - could be used in other contexts if needed

#### Proper Integration

**File:** `src/components/bracket/Bracket.tsx` (lines 428-429)

The indicator is integrated cleanly into the existing controls bar:
- Uses the existing `isLinked={!!tournament.matchplay_id}` pattern with proper boolean coercion
- Placed alongside other status indicators (save message, locked status)
- The refactoring to always show the status div (removing the conditional) is a sensible improvement

#### Good UX Copy

**File:** `src/components/bracket/MatchPlayIndicator.tsx` (lines 6-8)

The tooltip text is clear and helpful:
- Linked: "This tournament is on Match Play, so results will be synced automatically!"
- Not linked: "This tournament is not linked to Match Play. Results must be entered manually."

The text explains the user benefit, not just the technical state.

#### Proper aria-hidden Usage

**File:** `src/components/bracket/MatchPlayIndicator.tsx` (line 19)

The decorative indicator dot correctly uses `aria-hidden="true"` since it's purely visual and the label text conveys the same information.

---

## Verification

- **Tests:** All 244 tests pass
- **TypeScript:** No type errors
- **Coding Standards:** Follows CSS variable pattern correctly

---

## Proposed Standards

None. This implementation follows existing patterns well.

---

## Verdict

**Status:** CHANGES_REQUESTED

One medium-severity issue needs to be addressed before merge:

1. **Revert next-env.d.ts** - This auto-generated file change should not be committed

The component implementation itself is clean and ready. Once the next-env.d.ts change is reverted, this is ready to merge.

---

---

# PR Review - Per-Game Result Tracking Support (Iteration 2 - APPROVED)

**Review Date:** 2026-01-12
**Branch:** feat/per-game-result-tracking
**Reviewer:** Code Review Agent
**Iteration:** 2 of max 5

---

## Summary

All findings from iteration 1 have been successfully addressed. The barrel exports have been added to `src/lib/matchplay/index.ts` and both API routes have been updated to import from `@/lib/matchplay` instead of direct file paths. All 244 tests pass, including the 7 new per-game tracking tests. The implementation is ready for merge.

---

## Changes Made

1. **Added barrel exports** to `src/lib/matchplay/index.ts`:
   - Exported `mapMatchPlayGames`, `countResultsByRound`, `buildSeedMap`, `getRoundFromIndex`, `getPositionFromIndex`, `getOpeningRoundPosition`
   - Exported types `MappedResult`, `MapResultsOutput`

2. **Updated API route imports**:
   - `src/app/api/matchplay/results/route.ts` now imports from `@/lib/matchplay`
   - `src/app/api/matchplay/bulk-results/route.ts` now imports from `@/lib/matchplay`

---

## Verification

- **Tests:** All 244 tests pass (including 7 new per-game tracking tests)
- **Imports:** Both API routes correctly use barrel exports
- **Coding Standards:** Full compliance with "Barrel Exports for Library Directories"
- **Type Safety:** No TypeScript errors

---

## Verdict

**Status:** APPROVED

All critical and high-severity findings from iteration 1 have been resolved. The code follows established patterns and is ready to merge.

---

---

# PR Review - Per-Game Result Tracking Support

**Review Date:** 2026-01-12
**Branch:** feat/per-game-result-tracking
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR adds support for MatchPlay's per-game result tracking format, which is used when tournaments use best-of-N matches (e.g., best-of-7). The implementation correctly handles both the standard W/L format (`resultPositions`) and the per-game tracking format (`resultPoints`), extracts game counts for future bracket display, and includes comprehensive test coverage with 7 new tests.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

#### 1. Missing Barrel Export for resultMapper

**File:** `src/lib/matchplay/index.ts`

**Issue:**
The `resultMapper.ts` exports (`mapMatchPlayGames`, `countResultsByRound`, `buildSeedMap`, etc.) are not included in the barrel export. Currently, API routes import directly from the file:
```typescript
import { mapMatchPlayGames } from '@/lib/matchplay/resultMapper';
```

This is inconsistent with the coding standard "Barrel Exports for Library Directories" which states all directories under `src/lib/` must have an `index.ts` that re-exports public types and functions.

**Why it matters:**
Inconsistent import patterns make the codebase harder to navigate and maintain. When the barrel export pattern is used inconsistently, developers must guess whether to import from the index or from specific files.

**Suggested fix:**
Add to `src/lib/matchplay/index.ts`:
```typescript
export {
  mapMatchPlayGames,
  countResultsByRound,
  buildSeedMap,
  getRoundFromIndex,
  getPositionFromIndex,
  getOpeningRoundPosition,
} from './resultMapper';
export type { MappedResult, MapResultsOutput } from './resultMapper';
```

Then update imports in:
- `src/app/api/matchplay/results/route.ts`
- `src/app/api/matchplay/bulk-results/route.ts`

---

### 🔵 Low

#### 1. Type Assertions in Tests

**File:** `__tests__/unit/lib/matchplay-resultMapper.test.ts` (multiple lines)

**Issue:**
Tests use `null as unknown as number` for resultPositions to simulate null values:
```typescript
resultPositions: [null as unknown as number, null as unknown as number],
```

**Why it matters:**
While this works and accurately simulates the API response (where TypeScript types may not match runtime reality), it's a bit awkward. The test correctly handles the real-world scenario where the API sends null values even though the type says `number[]`.

**Suggested action:**
No change required. This is an accurate representation of the API behavior where the type definition doesn't match runtime data. The test documents this edge case well.

---

#### 2. New Fields Not Documented in JSDoc

**File:** `src/lib/matchplay/types.ts` (lines 24-31)

**Issue:**
The new `bestOf` and `bracketSize` fields on `MatchPlayTournament` have JSDoc comments, which is good. However, they are marked as optional (`?`) but the comment doesn't explain when they would be undefined.

**Why it matters:**
Minor documentation gap - developers may not know when these fields are populated.

**Suggested enhancement (optional):**
```typescript
/**
 * Number of games per match. For bracket tournaments:
 * - 1 = Single match (standard W/L, uses resultPositions)
 * - 3, 5, 7, etc. = Best-of-N (per-game tracking, uses resultPoints)
 *
 * May be undefined for non-bracket tournament types.
 */
bestOf?: number;
```

---

### 🟢 Praise

#### Excellent Dual-Format Handling

**File:** `src/lib/matchplay/resultMapper.ts` (lines 128-161, 183-237)

The implementation elegantly handles both result formats:
- `hasValidResultPositions()` checks for standard W/L format
- `hasValidResultPoints()` checks for per-game tracking format
- `getWinnerLoser()` correctly determines winner from either format with proper fallback logic
- When both formats are present (standard format with game counts), it correctly extracts game counts aligned with playerIds

This is exactly the right approach for handling external API data that can vary in format.

#### Comprehensive Test Coverage

**File:** `__tests__/unit/lib/matchplay-resultMapper.test.ts` (lines 371-527)

Seven new tests thoroughly cover the per-game tracking scenarios:
1. Maps games using resultPoints when resultPositions are null
2. Correctly identifies winner when player2 has more points (upset scenario)
3. Extracts game counts when both resultPositions and resultPoints are valid
4. Skips games with tied points (incomplete match)
5. Skips incomplete games even with partial per-game results
6. Handles 16-player tournament correctly
7. Handles missing resultPoints gracefully

This is excellent test coverage that documents the expected behavior for edge cases.

#### Clear Skip Reason Messages

**File:** `src/lib/matchplay/resultMapper.ts` (lines 383-407)

The refactored skip reason logic provides specific, actionable messages:
- `"Game tied at X-X (no winner yet)"` for tied games
- `"Missing result data"` for empty resultPoints
- `"Game not completed"` for incomplete games

This makes debugging much easier when games are unexpectedly skipped.

#### Well-Structured Helper Functions

**Files:** `src/lib/matchplay/resultMapper.ts` (lines 139-161)

The new helper functions (`hasValidResultPositions`, `hasValidResultPoints`) are:
- Single responsibility - each checks one format
- Well-named - clearly indicate what they validate
- Reused - called from both `isValidGame` and `getWinnerLoser`

#### Type Safety Maintained

**File:** `src/lib/matchplay/resultMapper.ts` (line 128-137)

The new `GameResult` interface properly types the return value including optional game counts:
```typescript
interface GameResult {
  winnerId: number;
  loserId: number;
  winnerGames: number | undefined;
  loserGames: number | undefined;
}
```

This flows through to `MappedResult` which now includes `winner_games` and `loser_games` fields, matching the `ResultInput` type.

---

## Verification

- **Tests:** All 244 tests pass (including 7 new per-game tracking tests)
- **TypeScript:** No type errors
- **Coding Standards:** Follows utility module structure, but missing barrel exports

---

## Proposed Standards

None. This implementation follows existing patterns well.

---

## Verdict

**Status:** CHANGES_REQUESTED

One medium-severity issue needs to be addressed before merge:

1. **Missing barrel exports** - Add resultMapper exports to `src/lib/matchplay/index.ts` to follow the established "Barrel Exports for Library Directories" coding standard.

The implementation is solid, well-tested, and handles the dual-format scenario correctly. Once the barrel export is added, this is ready to merge.

---

# PR Review - Standardize Match Play Client Error Handling

**Review Date:** 2026-01-12
**Branch:** standardize-matchplay-error-handling
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR implements the `[HIGH]` priority item from `future-improvements.md` - "Standardize Match Play Client Error Handling". The implementation adds a `safeMatchPlayCall` wrapper function that provides consistent error handling across all Match Play API routes. The approach is clean, well-typed, thoroughly tested, and follows the coding standards established in the codebase.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

None.

---

### 🔵 Low

#### 1. Consider Using Discriminated Union Pattern More Explicitly

**File:** `src/lib/matchplay/client.ts` (lines 13-15)

**Issue:**
The `SafeMatchPlayResult<T>` type uses a discriminated union which is good, but the error branch could include additional context like the original error type for debugging.

**Why it matters:**
Minor - the current implementation is correct and the error is logged with `console.error`. This is just an optional enhancement for debugging.

**Suggested enhancement (optional):**
```typescript
export type SafeMatchPlayResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: number; isMatchPlayError?: boolean };
```

This would help callers distinguish between Match Play API errors vs network/unexpected errors without parsing the message.

**Verdict:** No change required - current implementation is clean and sufficient.

---

### 🟢 Praise

#### Excellent Implementation of the Wrapper Pattern

**File:** `src/lib/matchplay/client.ts` (lines 39-64)

The `safeMatchPlayCall` wrapper is elegantly implemented:
- Clean generic typing with `<T>` preserves type safety
- Discriminated union return type makes error handling explicit
- Console logging provides debugging context with `[Match Play]` prefix
- Properly handles both `MatchPlayError` (preserves status) and unexpected errors (502 fallback)
- Excellent JSDoc documentation with usage example

#### Comprehensive Test Coverage

**File:** `__tests__/unit/lib/matchplay-client.test.ts` (lines 301-412)

The new tests (6 total) cover all important scenarios:
- Success case with mock data
- MatchPlayError with status code preservation (404)
- Non-MatchPlayError exceptions (502 fallback)
- Non-Error exceptions (thrown strings)
- Rate limiting (429 status)
- Integration with real client method calls

#### Clean Route Refactoring

**Files:** `src/app/api/matchplay/results/route.ts`, `src/app/api/matchplay/bulk-results/route.ts`

Both routes were refactored to use the new wrapper consistently:
- Removed try/catch blocks in favor of the wrapper pattern
- Parallel fetching with `Promise.all` is preserved
- Error responses now use the correct status codes from Match Play API
- Code is more readable with explicit success/failure handling

#### Proper Barrel Export Updates

**File:** `src/lib/matchplay/index.ts` (lines 8-13)

The barrel export correctly exports both the function and its type:
- `safeMatchPlayCall` function export
- `SafeMatchPlayResult` type export

This follows the established codebase pattern.

---

## Previous Issues - Resolution Status

This PR addresses a deferred improvement from `future-improvements.md`:

| Improvement | Status |
|-------------|--------|
| `[HIGH] Standardize Match Play Client Error Handling` | IMPLEMENTED |

The implementation closely follows the suggested fix from the future-improvements document, with a slight enhancement: using `{ success: true/false }` discriminated union instead of `{ data }` vs `{ error }` pattern, which provides cleaner type narrowing.

---

## Verification

- **Tests:** All 237 tests pass (including 6 new tests for `safeMatchPlayCall`)
- **TypeScript:** No type errors
- **Coding Standards:** Follows barrel export pattern, has proper test coverage

---

## Proposed Standards

None. This implementation follows existing patterns well and the `safeMatchPlayCall` pattern is documented in JSDoc.

---

## Verdict

**Status:** APPROVED

The implementation is clean, well-tested, and follows established patterns. Key strengths:

1. **Type-safe** - Generic return type preserves data typing
2. **Well-documented** - JSDoc with example usage
3. **Thoroughly tested** - 6 new tests covering success, error, and edge cases
4. **Consistent** - Both API routes use the same pattern
5. **Proper exports** - Added to barrel export with type

No blocking issues found. Ready to commit.

---

## Post-Merge Action

After this PR is merged, update `future-improvements.md` to move the "Standardize Match Play Client Error Handling" entry to the "Completed Items" section.

---

# PR Review - Bracket Result Display Refactor

**Review Date:** 2026-01-10
**Branch:** feature/bracket-result-display
**Reviewer:** Code Review Agent
**Iteration:** 1

---

## Summary

This PR refactors how bracket results are displayed by removing redundant tournament-wide data (`actual_winner_seed`, `actual_loser_seed`) from the `picks` table and instead computing actual participants dynamically from the `results` table at display time. This is a clean architectural improvement that eliminates data duplication across all user brackets. The implementation is well-structured with proper separation of concerns, good test coverage for the new utility, and thoughtful UI enhancements for showing unexpected participants.

**Note:** This review covers both the committed changes AND the uncommitted working directory changes, which together form the complete refactored implementation.

---

## Findings

### 🔴 Critical

*None found*

---

### 🟠 High

*None found*

---

### 🟡 Medium

#### 1. Magic Color Values (Hardcoded Hex)
**File:** `src/components/bracket/PlayerSlot.tsx` (lines 45-46, 101, 112)

**Issue:**
The component uses hardcoded hex colors (`#252323`, `#f0b224`, `#3a3a45`) instead of CSS variables like the rest of the codebase.

**Why it matters:**
This breaks the theming pattern established in the codebase where all colors use CSS variables like `rgb(var(--color-*))`. If the app adds dark/light theme switching in the future, these hardcoded values won't adapt.

**Current code:**
```typescript
const bgClass = isUnexpectedWinner || isUnexpectedParticipant
  ? "bg-[#252323]"
  // ...
<div className="text-xs text-[#f0b224] pt-1 border-t border-[#3a3a45] mt-1 w-full">
```

**Suggested fix:**
Add these colors to the CSS variables system and use them consistently:
```css
/* In global CSS or tailwind config */
--color-unexpected-bg: 37 35 35; /* #252323 */
--color-unexpected-text: 240 178 36; /* #f0b224 */
--color-unexpected-border: 58 58 69; /* #3a3a45 */
```
Then use:
```typescript
const bgClass = isUnexpectedWinner || isUnexpectedParticipant
  ? "bg-[rgb(var(--color-unexpected-bg))]"
```

---

#### 2. Conflicting Migration Files
**Files:**
- `supabase/migrations/20260110155215_add_actual_result_to_picks.sql` (committed)
- `supabase/migrations/20260110113232_remove_actual_result_columns.sql` (uncommitted)

**Issue:**
There are two migration files with conflicting purposes - one adds columns and one removes them. The timestamps suggest the "add" migration was created later (155215 > 113232), which means in a fresh deployment, the columns would be added AFTER being removed, leaving them in place.

**Why it matters:**
This will cause schema confusion and potential deployment issues. The migration sequence needs to be cleaned up before merging.

**Suggested fix:**
Since the final design does NOT include these columns on picks:
1. Delete the `20260110155215_add_actual_result_to_picks.sql` migration file (the one that ADDS columns)
2. If these columns were already deployed to production, keep the removal migration
3. If the columns were never deployed, delete both migration files

---

#### 3. Unused `position` Prop in PlayerSlot
**File:** `src/components/bracket/PlayerSlot.tsx` (line 9, 24)

**Issue:**
The `position` prop is defined in the interface and destructured but never used in the component.

**Why it matters:**
Dead code adds confusion and maintenance burden.

**Suggested fix:**
Remove the `position` prop from the interface and destructure statement, or use it if it serves a purpose.

---

### 🔵 Low

#### 4. next-env.d.ts Changes
**File:** `next-env.d.ts`

**Issue:**
This file changed from `.next/types/routes.d.ts` to `.next/dev/types/routes.d.ts`. This appears to be an auto-generated file that shouldn't be committed.

**Why it matters:**
This can cause unnecessary merge conflicts and isn't a real code change.

**Suggested fix:**
Revert this change before committing:
```bash
git checkout main -- next-env.d.ts
```

---

#### 5. ui-changes Directory
**File:** `ui-changes/` (untracked)

**Issue:**
There's an untracked `ui-changes/` directory that wasn't described as part of this PR.

**Why it matters:**
This might contain test files, screenshots, or other artifacts that should either be committed or gitignored.

**Suggested fix:**
Review the contents and either commit them if relevant, add to `.gitignore`, or delete if not needed.

---

### 🟢 Praise

#### Clean Architectural Decision
The decision to compute actual participants from results at display time rather than caching them per-pick is the right architectural choice. Tournament results are tournament-wide, not user-specific, so storing them on each user's picks was indeed redundant.

#### Well-Designed actualParticipants Utility
The `src/lib/bracket/actualParticipants.ts` file is well-structured with:
- Clear type exports (`ActualParticipants`, `MatchResult`)
- Reusable helper functions (`buildResultMap`, `getActualWinner`, `getActualLoser`)
- Good separation between single-match and batch computation
- Proper handling of both 16-player and 24-player tournament formats

#### Comprehensive Test Coverage
The `__tests__/unit/lib/actualParticipants.test.ts` file provides thorough coverage including:
- Fixed seed cases for opening round
- Cascading winner propagation through rounds
- Consolation match losers
- 16-player tournament handling
- Edge cases for missing results

#### Thoughtful UI Enhancement
The "Expected X" message display with distinct styling (dark background, yellow text) provides clear visual feedback when a user's expected participant differs from the actual participant due to earlier upset results.

#### Type Safety Maintained
The refactor properly updates the Pick interface and all consuming components, maintaining TypeScript type safety throughout.

#### Proper Page Updates
Both bracket view pages (`/bracket/[id]/page.tsx` and `/bracket/[id]/edit/page.tsx`) now fetch results and pass them to BracketView, enabling the cascading display feature.

---

## Proposed Standards

### Proposed Standard: CSS Variable Consistency

**Rule:** All color values in components must use CSS variables (`rgb(var(--color-*))`) rather than hardcoded hex values.

**Rationale:** Maintains theming consistency, enables future dark/light mode support, and keeps all colors centrally manageable.

**Example of violation:**
```tsx
<div className="bg-[#252323] text-[#f0b224]">
```

**Example of compliance:**
```tsx
<div className="bg-[rgb(var(--color-unexpected-bg))] text-[rgb(var(--color-unexpected-text))]">
```

**Origin:** Found in PlayerSlot.tsx during review on 2026-01-10

---

## Verdict

**Status:** CHANGES REQUESTED

The architecture and implementation are solid, but the following issues should be addressed before merge:

1. **Migration files conflict** - Clean up the duplicate/conflicting migration files to prevent schema issues
2. **Hardcoded colors** - Convert hex values to CSS variables for consistency
3. **Dead code** - Remove unused `position` prop from PlayerSlot

All tests pass (182 tests) and TypeScript compilation succeeds. Once these items are addressed, this is ready to merge.

---

# PR Review - Content Updates and Dark Mode Enforcement (Iteration 2)

**Review Date:** 2026-01-10
**Branch:** feature/bracket-result-display
**Reviewer:** Code Review Agent
**Iteration:** 2 of 5

---

## Summary

This review covers additional changes: adding informational content to the Privacy and About pages, and enforcing dark mode by simplifying the theme system. The changes are clean and straightforward. The implementation correctly preserves light mode CSS and code comments for future re-enablement. No security issues or bugs were found.

---

## Findings

### Critical

None.

### High

None.

### Medium

None.

### Low

None.

### Praise

#### Clean Theme Simplification
**Files:** `src/components/ThemeProvider.tsx`, `src/components/SettingsButton.tsx`, `src/app/layout.tsx`

The approach to enforcing dark mode is well-executed:
- Comments clearly indicate the intent and that code is preserved for future use
- The simplification removes unnecessary state management and effects
- The inline script in layout.tsx is reduced to a single, clear line
- SettingsButton returns null with clear documentation about why

#### Good Content Additions
**Files:** `src/app/about/page.tsx`, `src/app/privacy/page.tsx`

- The "In Plain English" section for the privacy policy is user-friendly and transparent
- The IFPA disclaimer is appropriately placed and clearly worded
- Both sections use consistent styling with existing page patterns

#### Proper Use of HTML Entities
**File:** `src/app/about/page.tsx` (line 101), `src/app/privacy/page.tsx`

Correct use of `{"'"}` and `&apos;` for apostrophes in JSX strings.

---

## Proposed Standards

None. This PR follows existing patterns well.

---

## Verdict

**Status:** APPROVED

All changes are clean, well-documented, and follow existing codebase patterns. No security, architectural, or code quality issues were found. The decision to preserve light mode code for future use is sensible and well-documented throughout.

---

# PR Review — Fix Mutable Search Path Security Warnings

**Review Date:** 2026-01-10
**Branch:** main (1 commit ahead of origin/main)
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR adds a database migration that fixes mutable `search_path` security warnings for three Supabase functions (`handle_updated_at`, `is_admin`, `handle_new_user`). The fix is straightforward and follows Supabase's recommended security best practice by setting `search_path` to an empty string, which prevents search path manipulation attacks.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

None.

---

### 🔵 Low

None.

---

### 🟢 Praise

#### Well-Documented Security Fix
**File:** `supabase/migrations/20260110174001_fix_function_search_paths.sql`

The migration includes:
- Clear comment explaining what the migration does
- Reference to official Supabase documentation
- Explanation of why setting `search_path` to empty string is the correct approach (prevents search path manipulation attacks by requiring fully schema-qualified references)

This is exactly how database migrations should be documented.

#### Appropriate Solution
Setting `search_path = ''` is the correct fix for this security warning. This approach:
1. Forces all object references within the functions to be fully schema-qualified
2. Prevents potential attackers from manipulating the search path to substitute malicious objects
3. Follows Supabase's official security recommendations

#### Clean and Minimal Change
The migration is focused and does exactly one thing - it fixes the security warnings without unnecessary changes or scope creep.

---

## Proposed Standards

None. This PR follows existing best practices.

---

## Verdict

**Status:** APPROVED

The migration is:
- Security-focused and addresses a legitimate vulnerability
- Well-documented with references to official documentation
- Minimal and focused on the specific issue
- Following Supabase's recommended best practices

No blocking issues found. The code is ready to be pushed to GitHub.

---

# PR Review - Add Vercel Analytics and Speed Insights

**Review Date:** 2026-01-10
**Branch:** feature/vercel-analytics
**Reviewer:** Code Review Agent
**Iteration:** 1 of 5

---

## Summary

This PR adds Vercel Analytics and Speed Insights to the application by installing the official Vercel packages and integrating them into the root layout. The implementation follows Vercel's recommended approach and is straightforward. The changes are minimal and well-contained.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

None.

---

### 🔵 Low

#### Component Placement Outside ThemeProvider

**File:** `src/app/layout.tsx` (lines 39-40)

**Issue:**
The `<Analytics />` and `<SpeedInsights />` components are placed outside the `<ThemeProvider>` wrapper. While this works correctly (these components don't render visible UI and don't need theme context), it's worth noting for future reference that any components placed outside ThemeProvider won't have access to theme context.

**Why it matters:**
Not a functional issue - just a minor architectural observation. The placement is actually correct for these specific components since they don't need theme context.

**Suggested action:**
No change needed. The current placement is appropriate.

---

### 🟢 Praise

#### Clean Implementation
The implementation follows Vercel's official documentation exactly. The imports use the correct subpaths (`@vercel/analytics/react` and `@vercel/speed-insights/next`) which are optimized for React/Next.js applications.

#### Minimal Footprint
The changes are appropriately scoped - only the necessary files are modified (package.json and layout.tsx), and no extraneous code was added.

#### Correct Package Versions
Using recent stable versions of both packages (1.6.1 and 1.3.1) which are compatible with Next.js 16.

---

## Proposed Standards

None. This is a standard third-party integration that follows established patterns.

---

## Verdict

**Status:** APPROVED

The implementation is clean, follows best practices, and correctly integrates Vercel Analytics and Speed Insights. No blocking issues were found.

---

# PR Review — MP-001 Match Play API Client

**Review Date:** 2026-01-11
**Branch:** main (uncommitted changes)
**Reviewer:** Code Review Agent
**Iteration:** 1 of max 5

---

## Summary

This PR implements a Match Play Events API client for integrating with external tournament data. The implementation includes well-typed interfaces, a clean client class with proper error handling, and comprehensive unit tests using MSW. Overall, this is a solid implementation that follows existing codebase patterns.

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

#### 1. Missing index.ts barrel export

**File:** `src/lib/matchplay/` (missing file)

**Issue:**
The matchplay folder is missing an `index.ts` file to re-export its types and client. Other lib directories like `src/lib/scoring/` use barrel exports for cleaner imports.

**Why it matters:**
Inconsistent with existing codebase patterns. Without a barrel export, consumers must import from specific files like `@/lib/matchplay/client` and `@/lib/matchplay/types` separately, rather than `@/lib/matchplay`.

**Suggested fix:**
Create `src/lib/matchplay/index.ts`:
```typescript
export { MatchPlayClient, createMatchPlayClient } from './client';
export type {
  MatchPlayTournament,
  MatchPlayTournamentWithPlayers,
  MatchPlayPlayer,
  MatchPlayGame,
  MatchPlayGamePlayer,
  MatchPlayApiResponse,
  MatchPlayApiListResponse,
  MatchPlayApiError,
} from './types';
export { MatchPlayError } from './types';
```

---

#### 2. next-env.d.ts modification should not be committed

**File:** `next-env.d.ts` (line 3)

**Issue:**
The diff shows a change from `.next/types/routes.d.ts` to `.next/dev/types/routes.d.ts`. This appears to be an auto-generated change from Next.js that shouldn't be part of this feature PR.

**Why it matters:**
This is an unrelated change that could cause issues or confusion. The file header explicitly states "This file should not be edited."

**Suggested fix:**
Revert this change with `git checkout next-env.d.ts` before committing.

---

### 🔵 Low

#### 1. Consider whether createMatchPlayClient factory is needed

**File:** `src/lib/matchplay/client.ts` (lines 128-130)

**Issue:**
The codebase uses named exports throughout (which is good for tree-shaking), but having `createMatchPlayClient` as a factory function alongside the class constructor might be redundant since they do exactly the same thing.

**Why it matters:**
Minor API surface area question - having both `new MatchPlayClient(token)` and `createMatchPlayClient(token)` that do the same thing. Consider if the factory function is needed or if the class constructor is sufficient.

**Suggested fix:**
This is optional - keep both if you anticipate adding initialization logic to the factory function later, or remove `createMatchPlayClient` if it's not adding value. No action required.

---

### 🟢 Praise

#### 1. Excellent type definitions

**File:** `src/lib/matchplay/types.ts`

The types are well-documented with clear section separators, proper use of union types for status fields, and nullable fields are correctly typed. The custom `MatchPlayError` class properly extends `Error` and includes useful metadata (status, code).

---

#### 2. Comprehensive error handling

**File:** `src/lib/matchplay/client.ts`

The `parseErrorBody` method gracefully handles both JSON and non-JSON error responses. The error handling doesn't expose internal details and properly wraps API errors in a custom error type with structured metadata.

---

#### 3. Thorough test coverage

**File:** `__tests__/unit/lib/matchplay-client.test.ts`

Tests cover:
- Constructor with explicit and environment tokens
- Missing token error case
- All API methods (getTournament, getTournamentWithPlayers, getGames, getCompletedGames)
- Multiple error scenarios (404, 401, 429, 500)
- Non-JSON error response handling
- Factory function

The use of MSW for API mocking follows existing test patterns in the codebase.

---

#### 4. Good .env.example documentation

**Files:** `.env.example`, `.env.test.example`

Clear comments explain where to obtain the API token and mark it as optional. This helps new developers understand the integration.

---

## Proposed Standards

None - this PR follows existing patterns well.

---

## Verdict

**Status:** CHANGES_REQUESTED

Two medium-severity issues need to be addressed before merge:

1. **Add barrel export** - Create `src/lib/matchplay/index.ts` to match codebase conventions
2. **Revert next-env.d.ts** - This auto-generated file change should not be committed

Both are quick fixes and will bring this PR to approved status.

---

# PR Review — MP-001 Match Play API Client (Re-review)

**Review Date:** 2026-01-11
**Branch:** main (uncommitted changes)
**Reviewer:** Code Review Agent
**Iteration:** 2 of max 5

---

## Summary

This is a re-review after fixes were applied. The Match Play API client implementation now includes the barrel export at `src/lib/matchplay/index.ts` and the `next-env.d.ts` has been reverted. All tests pass (13/13) and TypeScript type checking passes. The implementation is clean, well-typed, and ready for commit.

---

## Previous Issues - Resolution Status

| Issue | Status |
|-------|--------|
| Missing `src/lib/matchplay/index.ts` barrel export | FIXED |
| `next-env.d.ts` modification | FIXED |

---

## Findings

### 🔴 Critical

None.

---

### 🟠 High

None.

---

### 🟡 Medium

None.

---

### 🔵 Low

#### Consider adding JSDoc for MatchPlayError class

**File:** `src/lib/matchplay/types.ts` (lines 91-101)

**Issue:**
The `MatchPlayError` class lacks JSDoc documentation explaining its purpose and usage.

**Why it matters:**
Other developers may not immediately understand when to use this error class vs a generic Error. This is a minor documentation improvement.

**Suggested fix (optional):**
```typescript
/**
 * Custom error class for Match Play API errors.
 * Contains status code and optional error code from the API response.
 */
export class MatchPlayError extends Error {
  // ...
}
```

---

### 🟢 Praise

#### Excellent Type Definitions
**File:** `src/lib/matchplay/types.ts`

The type definitions are comprehensive and well-organized with clear section separators. The use of union types for status fields (`'created' | 'started' | 'completed'`) provides good type safety.

#### Clean Barrel Export Pattern
**File:** `src/lib/matchplay/index.ts`

The barrel export follows the existing pattern in the codebase (matching `src/lib/scoring/index.ts`) and cleanly separates type exports from value exports.

#### Comprehensive Test Coverage
**File:** `__tests__/unit/lib/matchplay-client.test.ts`

Tests cover:
- Constructor behavior (explicit token, env token, missing token)
- Successful API calls
- Error handling (404, 401, 429, 500)
- Non-JSON error responses
- All public methods

This is excellent test coverage for an API client.

#### Robust Error Handling
**File:** `src/lib/matchplay/client.ts` (lines 109-120)

The `parseErrorBody` method gracefully handles non-JSON error responses, which is a common edge case with HTTP APIs.

---

## Non-Code Items

### Untracked File: "git error"
There's an untracked file named "git error" in the repository root that appears to be a PNG screenshot. This should be deleted before committing or added to `.gitignore` if it's intentional. This is outside the scope of the PR but worth noting.

---

## Proposed Standards

None. The implementation follows existing patterns well.

---

## Verdict

**Status:** APPROVED

All previous issues have been resolved:
- Barrel export at `src/lib/matchplay/index.ts` is present and follows existing patterns
- `next-env.d.ts` is no longer modified (verified via `git status`)
- Tests pass (13/13)
- TypeScript type checking passes
- Code follows existing codebase conventions

The only remaining item is a LOW-severity JSDoc suggestion, which is optional. Ready to commit and push.
