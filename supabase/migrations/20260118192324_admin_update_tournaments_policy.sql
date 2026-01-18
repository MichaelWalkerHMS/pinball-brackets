-- Allow admins to update tournaments (for status transitions during result sync)
CREATE POLICY "Admins can update tournaments" ON tournaments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.is_admin = true
  )
);
