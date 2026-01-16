-- Migration: Hide sensitive profile columns from anonymous users
-- Purpose: Prevent anonymous enumeration of admin users
--
-- Security Issue: The "Anyone can view profiles" RLS policy exposed is_admin
-- and email to anonymous users, allowing attackers to identify admin accounts.
--
-- Fix: Revoke table-level SELECT, grant only safe columns.
--
-- Impact Analysis:
-- - Anonymous users: Can see id, display_name, created_at, updated_at (for leaderboards)
-- - Anonymous users: CANNOT see is_admin or email
-- - Authenticated users: Full access retained (needed for requireAdmin() checks)
-- - No code changes required
--
-- Verified compatible with:
-- - Leaderboard joins: profiles(display_name) works
-- - Admin checks: Authenticated role has full access
-- - Profile updates: Authenticated role has full access

-- Revoke table-level SELECT from anon (column-level REVOKE doesn't work otherwise)
REVOKE SELECT ON public.profiles FROM anon;

-- Grant SELECT only on safe columns to anon
GRANT SELECT (id, display_name, created_at, updated_at) ON public.profiles TO anon;
