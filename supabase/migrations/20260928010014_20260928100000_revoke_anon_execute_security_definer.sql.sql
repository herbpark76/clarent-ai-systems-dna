/*
# Revoke anon EXECUTE on SECURITY DEFINER functions

## Summary
The database linter flagged that `lp_is_admin()` and `lp_handle_new_user()`
are SECURITY DEFINER functions callable by the `anon` role. This is unnecessary:
- `lp_handle_new_user` is a trigger function — it runs as the function owner
  during INSERT on auth.users, not via direct RPC calls.
- `lp_is_admin` is used inside RLS policies — it evaluates as the definer
  during policy checks, not via direct RPC calls.

Leaving EXECUTE on anon causes 403 errors when the Supabase client tries
to discover/invoke RPCs during session initialization.

## Changes
- REVOKE EXECUTE on both functions from anon.
- REVOKE EXECUTE on lp_list_trainees from anon (already granted to authenticated).
*/

REVOKE EXECUTE ON FUNCTION lp_is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION lp_handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION lp_list_trainees() FROM anon;
