-- Migration: (Superseded by 20260116130000)
-- This migration attempted column-level REVOKE but it doesn't work
-- when table-level GRANT exists. See 20260116130000 for the fix.
--
-- Original commands (no-op, kept for migration history):
REVOKE SELECT (is_admin) ON public.profiles FROM anon;
REVOKE SELECT (email) ON public.profiles FROM anon;
