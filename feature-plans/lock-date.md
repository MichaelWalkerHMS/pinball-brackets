# Plan: Replace lock_date with Results-Based Locking

## Summary
Replace the timestamp-based `lock_date` field with computed lock status based on whether results exist for the tournament. A tournament is "locked" when it has at least one result entered.

## Key Behavior Changes
- **Current**: Tournament locks at a specific datetime (`lock_date`)
- **New**: Tournament locks when first result is entered
- Deleting all results unlocks the tournament
- UI shows "Open" status + scheduled start date (informational only)

---

## Implementation Steps

### 1. Database Migration
**File**: `supabase/migrations/[timestamp]_replace_lock_date_with_results_check.sql`

**Changes**:
- Drop `lock_date` column from `tournaments` table (existing `start_date` column remains for display)
- Update 6 RLS policies to check `NOT EXISTS (SELECT 1 FROM results WHERE tournament_id = ...)`:
  - `Users can create brackets before lock`
  - `Users can delete own brackets before lock`
  - `Users can update own brackets before lock`
  - `Users can create picks before lock`
  - `Users can delete picks before lock`
  - `Users can update picks before lock`

### 2. TypeScript Types
**File**: `src/lib/types/index.ts`

- Remove `lock_date` from `Tournament` interface (line 8)
- Remove `lock_date` from `TournamentFormData` interface (line 140)
- Remove `lock_date` from `DashboardBracket` interface (line 186)
- Keep existing `start_date` field (already present for display purposes)
- Add `has_results?: boolean` to Tournament interface (for filtering)

### 3. Admin Tournament Form
**File**: `src/components/admin/TournamentForm.tsx`

- Remove `lock_date` form field (lines 237-247)
- Keep existing `start_date` field (already present in form)
- Update initial form state to remove `lock_date` (lines 37-39)

### 4. Admin Actions
**File**: `src/app/admin/actions.ts`

- Remove `lock_date` handling in `createTournament` (line 76)
- Remove `lock_date` handling in `updateTournament` (lines 130-131)
- Keep existing `start_date` handling (already present)

### 5. Lock Status Logic
**File**: `src/app/tournament/[id]/actions.ts`

- Update `checkLockStatus()` (lines 159-176) to query for results existence:
  ```typescript
  const { count } = await supabase
    .from("results")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  const isLocked = (count ?? 0) > 0;
  ```
- Update `saveBracket()` validation (lines 65-78) - same pattern
- Update `createBracket()` validation (lines 402-415) - same pattern
- Update `loadUserBrackets()` lock computation (lines 321-339)

### 6. UI Components - Lock Status Display

**Files to update**:
- `src/app/bracket/[id]/page.tsx` (line 201)
- `src/app/bracket/[id]/edit/page.tsx` (lines 169-212)
- `src/app/tournament/[id]/page.tsx` (lines 33-77)
- `src/components/dashboard/TournamentDetails.tsx` (lines 8-43)
- `src/app/admin/tournament/[id]/TournamentOverview.tsx` (line 171)

**Key insight**: Bracket pages already fetch results for display. Simply change:
```typescript
// Before
const isLocked = new Date(tournament.lock_date) <= new Date();

// After (results already fetched)
const isLocked = (results?.length ?? 0) > 0;
```

**UI Changes**:
- Remove lock date formatting logic
- Show "Open" or "Locked" status
- Optionally show "Scheduled Start: [date]" if start_date exists

### 7. Tournament Filtering
**Files**:
- `src/app/page.tsx` (lines 18-20) - tournament fetch
- `src/components/landing/TournamentWizard.tsx` (lines 32-38)
- `src/components/dashboard/CreateBracketWizard.tsx` (lines 26-32)

**Approach**: Use Supabase aggregate to get results count per tournament:
```typescript
const { data: tournaments } = await supabase
  .from("tournaments")
  .select("*, results(count)");

// Transform to add has_results boolean
const tournamentsWithLockStatus = tournaments.map(t => ({
  ...t,
  has_results: t.results[0]?.count > 0
}));
```

**Type change**: Add `has_results?: boolean` to Tournament interface

**Client filtering change**:
```typescript
// Before: t.state === selectedState && new Date(t.lock_date) > new Date()
// After:  t.state === selectedState && !t.has_results
```

### 8. Unit Test Updates

**`__tests__/fixtures/tournaments.ts`**:
- Remove `lock_date` from all mock tournaments
- Add `has_results: boolean` field:
  - `test-tournament-locked` → `has_results: true`
  - `test-tournament-open` → `has_results: false`
  - Default tournament → `has_results: false`

**`__tests__/unit/components/dashboard/MyBracketsTable.test.tsx`**:
- Remove `lock_date` from mock bracket data (lines 16, 34, 52)
- Keep `is_locked` field (it's a computed prop, unchanged)

**No changes needed**:
- `FinalScoreInput.test.tsx` - tests `isLocked` prop (unchanged)
- `Match.test.tsx` - tests `isLocked` prop (unchanged)

### 9. E2E Test Updates

**`e2e/dashboard.spec.ts:186`**:
```typescript
// Before
await expect(page.getByText(/Lock/i)).toBeVisible()

// After
await expect(page.getByText(/Open|Locked/i)).toBeVisible()
```

### 10. Seed Data
**File**: `src/scripts/seed-dev-data.ts`

- Remove `lock_date` from seed tournament (line 86)
- Keep existing `start_date` (already present)

---

## Data Migration Strategy

For existing tournaments:
- If tournament has results → it's locked (no action needed)
- If tournament has no results → it stays unlocked (no action needed)
- `lock_date` column is simply dropped (`start_date` already exists)

Migration SQL:
```sql
ALTER TABLE tournaments DROP COLUMN lock_date;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/[new].sql` | New migration - RLS policies + schema |
| `src/lib/types/index.ts` | Remove lock_date, add has_results |
| `src/components/admin/TournamentForm.tsx` | Remove lock_date input |
| `src/app/admin/actions.ts` | Remove lock_date handling |
| `src/app/tournament/[id]/actions.ts` | Update lock checks to use results |
| `src/app/bracket/[id]/page.tsx` | Update lock display |
| `src/app/bracket/[id]/edit/page.tsx` | Update lock display |
| `src/app/tournament/[id]/page.tsx` | Update lock display |
| `src/components/dashboard/TournamentDetails.tsx` | Update lock display |
| `src/app/admin/tournament/[id]/TournamentOverview.tsx` | Update lock display |
| `src/app/page.tsx` | Update tournament query to include results count |
| `src/components/landing/TournamentWizard.tsx` | Update filtering to use `has_results` |
| `src/components/dashboard/CreateBracketWizard.tsx` | Update filtering to use `has_results` |
| `__tests__/fixtures/tournaments.ts` | Remove lock_date, add has_results |
| `__tests__/unit/components/dashboard/MyBracketsTable.test.tsx` | Remove lock_date from mock data |
| `e2e/dashboard.spec.ts` | Update lock status text check |
| `src/scripts/seed-dev-data.ts` | Remove lock_date |

---

## Verification

1. **Unit tests**: `npm test` - ensure all tests pass after fixture updates
2. **Build**: `npm run build` - no TypeScript errors
3. **Manual testing**:
   - Create tournament without lock_date
   - Create bracket for tournament (should work)
   - Enter first result for tournament
   - Try to edit bracket (should be blocked)
   - Delete all results
   - Try to edit bracket (should work again)
4. **E2E tests**: `npm run test:e2e` - verify bracket creation/editing flows
5. **RLS verification**: Test directly in Supabase that non-admin cannot bypass lock
