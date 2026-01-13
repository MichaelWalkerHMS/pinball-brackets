-- Migration: Add feedback table
-- Purpose: Anonymous feedback collection from users

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  page_url text,
  created_at timestamptz DEFAULT now()
);

-- Index for querying by creation date
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can submit feedback (anonymous)
CREATE POLICY "Anyone can submit feedback"
  ON feedback
  FOR INSERT
  WITH CHECK (true);

-- Only admins can view feedback
CREATE POLICY "Admins can view feedback"
  ON feedback
  FOR SELECT
  USING (public.is_admin());

-- Only admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON feedback
  FOR DELETE
  USING (public.is_admin());

-- Grant permissions
GRANT INSERT ON feedback TO anon;
GRANT INSERT ON feedback TO authenticated;
GRANT SELECT, DELETE ON feedback TO authenticated;
