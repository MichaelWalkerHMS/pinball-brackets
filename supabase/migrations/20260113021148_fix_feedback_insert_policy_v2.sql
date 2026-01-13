-- Fix: Remove incorrect TO public clause from feedback insert policy
-- The TO public clause targets the PostgreSQL 'public' role, not anonymous access
-- Supabase uses 'anon' and 'authenticated' roles

DROP POLICY IF EXISTS "Anyone can submit feedback" ON feedback;

CREATE POLICY "Anyone can submit feedback"
  ON feedback
  FOR INSERT
  WITH CHECK (true);
