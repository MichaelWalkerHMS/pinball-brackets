-- Migration: Replace lock_date with results-based locking
--
-- Change: Tournament locking is now determined by whether results exist,
-- not by a fixed lock_date timestamp. This allows tournaments to be
-- automatically unlocked when results are cleared.
--
-- Behavior:
-- - Tournament is "locked" when it has at least one result
-- - Tournament is "unlocked" when it has no results
-- - Deleting all results unlocks the tournament
-- - start_date remains for display/informational purposes

-- ============================================================================
-- DROP OLD RLS POLICIES (must happen before dropping the column they depend on)
-- ============================================================================

DROP POLICY IF EXISTS "Users can create brackets before lock" ON brackets;
DROP POLICY IF EXISTS "Users can delete own brackets before lock" ON brackets;
DROP POLICY IF EXISTS "Users can update own brackets before lock" ON brackets;
DROP POLICY IF EXISTS "Users can create picks before lock" ON picks;
DROP POLICY IF EXISTS "Users can delete picks before lock" ON picks;
DROP POLICY IF EXISTS "Users can update picks before lock" ON picks;

-- ============================================================================
-- SCHEMA CHANGE: Drop lock_date column
-- ============================================================================

ALTER TABLE tournaments DROP COLUMN IF EXISTS lock_date;

-- ============================================================================
-- CREATE NEW BRACKETS TABLE RLS POLICIES
-- Replace lock_date checks with results existence checks
-- ============================================================================

-- Users can create brackets when tournament has no results
CREATE POLICY "Users can create brackets before lock" ON brackets
FOR INSERT
WITH CHECK (
  user_id = (select auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM results
    WHERE results.tournament_id = tournament_id
  )
);

-- Users can delete own brackets when tournament has no results
CREATE POLICY "Users can delete own brackets before lock" ON brackets
FOR DELETE
USING (
  user_id = (select auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM results
    WHERE results.tournament_id = tournament_id
  )
);

-- Users can update own brackets when tournament has no results
CREATE POLICY "Users can update own brackets before lock" ON brackets
FOR UPDATE
USING (
  user_id = (select auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM results
    WHERE results.tournament_id = tournament_id
  )
);

-- ============================================================================
-- CREATE NEW PICKS TABLE RLS POLICIES
-- Replace lock_date checks with results existence checks
-- ============================================================================

-- Users can create picks when tournament has no results
CREATE POLICY "Users can create picks before lock" ON picks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM brackets
    WHERE brackets.id = bracket_id
    AND brackets.user_id = (select auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM results
      WHERE results.tournament_id = brackets.tournament_id
    )
  )
);

-- Users can delete picks when tournament has no results
CREATE POLICY "Users can delete picks before lock" ON picks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM brackets
    WHERE brackets.id = bracket_id
    AND brackets.user_id = (select auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM results
      WHERE results.tournament_id = brackets.tournament_id
    )
  )
);

-- Users can update picks when tournament has no results
CREATE POLICY "Users can update picks before lock" ON picks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM brackets
    WHERE brackets.id = bracket_id
    AND brackets.user_id = (select auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM results
      WHERE results.tournament_id = brackets.tournament_id
    )
  )
);
