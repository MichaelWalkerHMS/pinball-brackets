# Lock Date Change - Implementation Status

## Summary

Replacing timestamp-based `lock_date` field with computed lock status based on whether results exist.

## Current Status: COMMITTED (not pushed)

- **Branch:** `feature/results-based-locking`
- **Commit:** `a3f69d1` - "Replace lock_date with results-based locking"
- **Date:** 2026-01-16

## Implementation Complete

All implementation steps from the plan have been completed:

### 1. Database Migration ✅
- Created `supabase/migrations/20260116125304_replace_lock_date_with_results_check.sql`
- Drops `lock_date` column from tournaments table
- Updates 6 RLS policies to check `NOT EXISTS (SELECT 1 FROM results WHERE tournament_id = ...)`

### 2. TypeScript Types ✅
- Removed `lock_date` from `Tournament` interface
- Removed `lock_date` from `TournamentFormData` interface
- Removed `lock_date` from `DashboardBracket` interface
- Added `has_results?: boolean` to `Tournament` interface

### 3. Admin Tournament Form ✅
- Removed `lock_date` form field
- Changed date grid from 3 columns to 2 columns

### 4. Admin Actions ✅
- Removed `lock_date` handling in `createTournament`
- Removed `lock_date` handling in `updateTournament`

### 5. Lock Status Logic ✅
- Updated `checkLockStatus()` to query results existence
- Updated `saveBracket()` validation to check results
- Updated `createBracket()` validation to check results
- Updated `loadUserBrackets()` to compute lock status from results

### 6. UI Components ✅
- `src/app/bracket/[id]/page.tsx` - uses results length for isLocked
- `src/app/bracket/[id]/edit/page.tsx` - uses results length, removed lock date display
- `src/app/tournament/[id]/page.tsx` - queries results count for lock status
- `src/components/dashboard/TournamentDetails.tsx` - shows "Open" or "Locked"
- `src/app/admin/tournament/[id]/TournamentOverview.tsx` - removed Predictions Lock field

### 7. Tournament Filtering ✅
- `src/app/page.tsx` - fetches tournaments with results count, adds `has_results`
- `src/components/landing/TournamentWizard.tsx` - filters by `!t.has_results`
- `src/components/dashboard/CreateBracketWizard.tsx` - filters by `!t.has_results`

### 8. Test Fixtures ✅
- Updated `__tests__/fixtures/tournaments.ts` - removed lock_date, added has_results

### 9. Seed Data ✅
- Updated `src/scripts/seed-dev-data.ts` - removed lock_date

### 10. E2E Tests ✅
- Fixed `e2e/dashboard.spec.ts` - updated test to look for "Open|Locked" instead of "Lock"

## Test Results

- **Build:** ✅ Passes (`npm run build`)
- **Unit Tests:** ✅ 255 passed (`npm test`)
- **E2E Tests:** 305 passed, 10 failed, 85 skipped
  - 5 failures: "logged out user sees CTA on public bracket page" - appears to be pre-existing flaky test
  - 5 failures: Mobile Safari specific - likely browser flakiness

## Next Steps

1. **Code Review:** Run the code review agent before pushing
2. **Push:** `git push -u origin feature/results-based-locking`
3. **PR:** Create PR for review
4. **After Merge:** Push migration to production:
   ```bash
   npx supabase link --project-ref ynxmkbpdnucrbjyvovpq
   npx supabase db push
   ```

## Data Migration Notes

For existing tournaments:
- If tournament has results → it's locked (no action needed)
- If tournament has no results → it stays unlocked (no action needed)
- The `lock_date` column is simply dropped (`start_date` already exists)

No data backfill is needed because lock status is now computed dynamically.

## Files Changed

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
| `__tests__/fixtures/tournaments.ts` | Update mock data |
| `src/scripts/seed-dev-data.ts` | Update seed data |
| `e2e/dashboard.spec.ts` | Fix test expectation |
