-- Migration: Allow bracket metadata updates when locked + fix tournament_id bug
--
-- Changes:
-- 1. Fix bug in INSERT/DELETE/UPDATE policies where tournament_id compared to itself
--    (was: results.tournament_id = results.tournament_id, always true)
--    (now: results.tournament_id = brackets.tournament_id, correct per-tournament check)
-- 2. Allow users to update bracket metadata (name, is_public) even when locked
-- 3. Add trigger to protect prediction columns (final_winner_games, final_loser_games)
--
-- Security model:
-- - Picks: Protected at RLS level (unchanged)
-- - Final games: Protected at database level via trigger
-- - Metadata (name, is_public): Always editable by owner

-- ============================================================================
-- FIX BUG: INSERT policy had self-comparison, blocking all inserts when any results exist
-- ============================================================================

DROP POLICY IF EXISTS "Users can create brackets before lock" ON brackets;

CREATE POLICY "Users can create brackets before lock" ON brackets
FOR INSERT WITH CHECK (
  user_id = (SELECT auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM results
    WHERE results.tournament_id = brackets.tournament_id
  )
);

-- ============================================================================
-- FIX BUG: DELETE policy had same self-comparison issue
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete own brackets before lock" ON brackets;

CREATE POLICY "Users can delete own brackets before lock" ON brackets
FOR DELETE USING (
  user_id = (SELECT auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM results
    WHERE results.tournament_id = brackets.tournament_id
  )
);

-- ============================================================================
-- FEATURE: UPDATE policy now allows metadata updates when locked
-- (trigger protects prediction columns)
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own brackets before lock" ON brackets;

CREATE POLICY "Users can update own brackets" ON brackets
FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- FEATURE: Trigger to protect prediction columns when tournament is locked
-- ============================================================================

CREATE OR REPLACE FUNCTION protect_bracket_predictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check if tournament is locked (has results)
  IF EXISTS (
    SELECT 1 FROM public.results
    WHERE public.results.tournament_id = NEW.tournament_id
  ) THEN
    -- Preserve the old prediction values, ignore any attempted changes
    NEW.final_winner_games := OLD.final_winner_games;
    NEW.final_loser_games := OLD.final_loser_games;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_bracket_predictions_trigger ON brackets;
CREATE TRIGGER protect_bracket_predictions_trigger
  BEFORE UPDATE ON brackets
  FOR EACH ROW
  EXECUTE FUNCTION protect_bracket_predictions();
