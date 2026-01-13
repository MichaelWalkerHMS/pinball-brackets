# Bracket Result Display Refactor - Implementation Plan

## Overview

Refactor bracket result display to fetch results at display time instead of caching redundant tournament-wide data on each pick. This enables proper cascading of actual participants through the bracket when earlier rounds have results.

## Background

### Current State (just committed on `feature/bracket-result-display`)
- Added `actual_winner_seed` and `actual_loser_seed` columns to `picks` table
- These are cached when admin enters results via `recalculateScores()`
- Display shows winner highlights, pick indicators, and result bars

### Problem Identified
1. `actual_winner_seed` and `actual_loser_seed` are **tournament-wide data**, not per-bracket
2. Storing them on `picks` is redundant (same values repeated across all brackets)
3. Current implementation doesn't handle **cascading**: when a player loses in Round N, they shouldn't appear in Round N+1, even if user picked them

### Desired Behavior
When viewing a bracket after results are entered:
- Show **actual tournament state** overlaid with user's picks
- If Philip beat Matthew in R16, Quarterfinals should show Philip (not Matthew) with orange highlight
- Display "Expected Matthew" message below the match
- Pick indicator bar should be amber (not red) for unexpected participants
- This cascades through all future rounds

## Architecture Decision

**Fetch results at display time** because:
- Actual participants are tournament-wide, not per-bracket
- Keeps data model clean (tournament data in `results`, per-bracket data in `picks`)
- `is_correct` stays cached (it IS per-bracket data, used for scoring)
- Scoring/leaderboard unaffected (still computed at result entry time)

## Implementation Steps

### Step 1: Create New Migration to Remove Columns

Create migration to drop `actual_winner_seed` and `actual_loser_seed` from `picks`:

```sql
-- Remove redundant tournament-wide columns from picks table
-- This data should be fetched from results table at display time

ALTER TABLE picks
DROP COLUMN IF EXISTS actual_winner_seed,
DROP COLUMN IF EXISTS actual_loser_seed;
```

### Step 2: Update TypeScript Types

**File: `src/lib/types/index.ts`**

Remove `actual_winner_seed` and `actual_loser_seed` from `Pick` interface:

```ts
export interface Pick {
  id: string;
  bracket_id: string;
  round: number;
  match_position: number;
  winner_seed: number;
  is_correct: boolean | null; // Keep this - it's per-bracket data
  created_at: string;
}
```

### Step 3: Simplify recalculateScores()

**File: `src/lib/scoring/recalculateScores.ts`**

Remove the logic that sets `actual_winner_seed` and `actual_loser_seed`:
- Keep the `is_correct` update logic
- Remove the `actual_winner_seed` and `actual_loser_seed` from pick updates
- Simplify the `pickUpdates` type and update query

### Step 4: Fetch Results in Bracket Pages

**Files:**
- `src/app/bracket/[id]/page.tsx`
- `src/app/tournament/[id]/page.tsx`

Add results fetch:
```ts
// Fetch results for this tournament
const { data: results } = await supabase
  .from("results")
  .select("*")
  .eq("tournament_id", tournament.id);
```

Pass results to BracketView component.

### Step 5: Update BracketView Component

**File: `src/components/bracket/Bracket.tsx`**

1. Add `results` prop to `BracketViewProps`
2. Build a results map: `Map<string, Result>` keyed by `${round}-${match_position}`
3. Create function to compute actual participants for a match based on results from feeder matches
4. Pass result info down to Round components

### Step 6: Create Utility for Computing Actual Participants

**New file: `src/lib/bracket/actualParticipants.ts`**

```ts
import { Result } from '../types';
import { getFeederMatchPositions } from './logic';

/**
 * Given results and bracket structure, compute who actually made it to each match.
 * Returns a map of "round-position" -> { actualTop: number | null, actualBottom: number | null }
 */
export function computeActualParticipants(
  results: Result[],
  playerCount: 16 | 24
): Map<string, { actualTop: number | null; actualBottom: number | null }> {
  // Build result map
  const resultMap = new Map<string, Result>();
  for (const result of results) {
    resultMap.set(`${result.round}-${result.match_position}`, result);
  }

  // For each round (starting from round after opening/R16):
  // - Look at feeder matches
  // - If feeder has result, actual participant is the winner
  // - If no feeder result, actual participant is null (TBD)

  // Implementation needs to use bracket logic to determine feeder matches
  // See getFeederMatchPositions() in src/lib/bracket/logic.ts
}
```

### Step 7: Update Round Component

**File: `src/components/bracket/Round.tsx`**

1. Accept `actualParticipantsMap` prop
2. Pass actual participant info to each Match

### Step 8: Update Match Component

**File: `src/components/bracket/Match.tsx`**

Update to handle actual vs expected participants:

```ts
interface MatchProps {
  // ... existing props
  actualTopSeed?: number | null;    // Who actually made it to top slot
  actualBottomSeed?: number | null; // Who actually made it to bottom slot
  resultInfo?: {                    // Result for THIS match (if exists)
    winnerSeed: number;
    loserSeed: number;
  };
}
```

Logic for display:
1. If `actualTopSeed` differs from expected top seed → show actual with orange highlight
2. If `actualBottomSeed` differs from expected bottom seed → show actual with orange highlight
3. If this match has a result → show winner with green highlight
4. Result bar logic:
   - "Correct pick!" (green) - user picked the actual winner
   - "You picked X" (red) - user picked someone in match who lost
   - "Expected X" (orange) - user expected different participant entirely

### Step 9: Update PlayerSlot Component

**File: `src/components/bracket/PlayerSlot.tsx`**

Already has most of the styling. May need to adjust:
- `isUnexpectedParticipant` prop (orange background, amber pick indicator)
- Distinguish between "unexpected winner" and "unexpected participant"

### Step 10: Update Test Fixtures

**Files:**
- `__tests__/fixtures/brackets.ts`
- `__tests__/unit/scoring/calculateScore.test.ts`

Remove `actual_winner_seed` and `actual_loser_seed` from mock Pick objects.

### Step 11: Add Tests for Actual Participants Logic

Create new test file: `__tests__/unit/lib/actualParticipants.test.ts`

Test scenarios:
- No results → all participants are expected (from user picks)
- R16 result exists → Quarterfinals shows actual winner
- Multiple results → cascading through rounds
- Mixed (some results, some TBD)

## Key Files Summary

| File | Changes |
|------|---------|
| `supabase/migrations/[timestamp]_remove_actual_result_columns.sql` | Drop columns |
| `src/lib/types/index.ts` | Remove fields from Pick type |
| `src/lib/scoring/recalculateScores.ts` | Remove actual_winner/loser logic |
| `src/lib/bracket/actualParticipants.ts` | NEW: Compute actual participants |
| `src/app/bracket/[id]/page.tsx` | Fetch results |
| `src/app/tournament/[id]/page.tsx` | Fetch results |
| `src/components/bracket/Bracket.tsx` | Accept results, compute actuals |
| `src/components/bracket/Round.tsx` | Pass actual participants to Match |
| `src/components/bracket/Match.tsx` | Display actual vs expected |
| `src/components/bracket/PlayerSlot.tsx` | Minor styling adjustments |
| `__tests__/fixtures/brackets.ts` | Update mock data |
| `__tests__/unit/scoring/calculateScore.test.ts` | Update mock data |
| `__tests__/unit/lib/actualParticipants.test.ts` | NEW: Test actual participants |

## Visual Behavior Reference

See screenshots in `ui-changes/` folder:
- `Screenshot 2026-01-10 103434.png` - Design mockup showing expected styling
- `actual ui.png` - Current UI showing the cascading problem

### Expected Display States

| Scenario | Background | Pick Indicator | Result Bar |
|----------|------------|----------------|------------|
| No result, user picked this player | Default | Green bar | None |
| Result exists, user picked winner | Green | Green bar | "Correct pick!" (green bg) |
| Result exists, user picked loser | Default (loser) / Green (winner) | Red bar on picked player | "You picked X" (red bg) |
| No result for this match, but unexpected participant from earlier result | Orange | Amber bar | "Expected X" (orange bg) |
| Unexpected participant who then won | Orange | Amber bar | "Expected X" (orange bg) |

## Testing Checklist

- [ ] TypeScript compiles without errors
- [ ] All existing unit tests pass
- [ ] New actual participants tests pass
- [ ] Visual testing:
  - [ ] Bracket with no results shows user picks normally
  - [ ] Bracket with R16 results shows correct winners with green
  - [ ] Bracket with R16 results shows cascading actual participants in QF
  - [ ] Unexpected participants have orange highlight
  - [ ] Result bars show correct messages and colors
- [ ] Leaderboard still updates correctly when admin enters results
- [ ] Apply migration to dev database and test

## Notes

- The `is_correct` field stays on picks - it's per-bracket data used for scoring
- Scoring logic is unchanged - leaderboard updates automatically on result entry
- This refactor only changes display logic, not scoring logic
- The extra query to fetch results is minimal overhead (~23 rows max)
