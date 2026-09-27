/*
# Auto-populate lp_profiles for new auth users + backfill existing

## Changes
1. Create a trigger function that inserts an lp_profiles row when a new auth.users row is created.
   Uses full_name from raw_user_meta_data if available, otherwise falls back to email.
2. Create a trigger on auth.users AFTER INSERT.
3. Backfill any existing auth.users that don't have an lp_profiles row yet.
*/

-- ── Trigger function ───────────────────────────────────
CREATE OR REPLACE FUNCTION lp_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO lp_profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

-- ── Trigger on auth.users ──────────────────────────────
DROP TRIGGER IF EXISTS lp_on_auth_user_created ON auth.users;
CREATE TRIGGER lp_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION lp_handle_new_user();

-- ── Backfill any missing profiles ──────────────────────
INSERT INTO lp_profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data ->> 'full_name', email)
FROM auth.users
WHERE id NOT IN (SELECT id FROM lp_profiles)
ON CONFLICT (id) DO NOTHING;

-- Revoke EXECUTE from anon (internal trigger function)
REVOKE EXECUTE ON FUNCTION lp_handle_new_user() FROM anon;
