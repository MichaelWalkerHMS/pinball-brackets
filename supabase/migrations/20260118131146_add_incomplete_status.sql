-- Add "completed - results incomplete" as a valid tournament status

-- Drop the existing constraint
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;

-- Add new constraint with the additional status value
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('upcoming', 'in_progress', 'completed', 'completed - results incomplete'));
