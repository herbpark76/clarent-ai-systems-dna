/*
# lp_profiles column protection trigger

The RLS policy lp_profiles_update_own_name allows learners to UPDATE their own row,
but RLS alone can't restrict WHICH columns they update. This trigger enforces that
learners can only change full_name. All other columns (start_date, etc.) are admin-only.
*/
CREATE OR REPLACE FUNCTION lp_protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text;

  -- Admin can change anything
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin: only full_name can change
  IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    RAISE EXCEPTION 'Cannot change start_date. Contact your instructor.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lp_protect_profile_columns_trigger ON lp_profiles;
CREATE TRIGGER lp_protect_profile_columns_trigger
BEFORE UPDATE ON lp_profiles
FOR EACH ROW
EXECUTE FUNCTION lp_protect_profile_columns();

GRANT EXECUTE ON FUNCTION lp_protect_profile_columns() TO authenticated;
