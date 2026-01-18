-- Add tournament_type column to distinguish Open vs Women's tournaments

ALTER TABLE tournaments
ADD COLUMN tournament_type text NOT NULL DEFAULT 'open'
CONSTRAINT tournaments_type_check CHECK (tournament_type IN ('open', 'womens'));

-- Add comment for documentation
COMMENT ON COLUMN tournaments.tournament_type IS 'Tournament type: open or womens';
