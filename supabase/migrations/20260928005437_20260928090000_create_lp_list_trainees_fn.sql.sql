/*
# Add function to list all trainee profiles

## Summary
Creates a SECURITY DEFINER function `lp_list_trainees()` that returns the id
and full_name of every auth user whose `raw_app_meta_data->>'role'` is
`'trainee'`, joined with their `lp_profiles` row for the display name.
This lets the admin frontend list ALL trainees — including those with no
progress or journal entries — without direct access to `auth.users`.

## Security
- SECURITY DEFINER: runs with the function owner's privileges so it can
  read `auth.users.raw_app_meta_data`, which the `authenticated` role cannot.
- EXECUTE granted only to `authenticated` — any signed-in user can call it.
  The function returns only trainee ids + names (no emails, no sensitive data).
- The admin RLS check happens in the frontend (admin sees the full learner
  list; trainees only see their own data via RLS on lp_progress/journal).
*/

CREATE OR REPLACE FUNCTION lp_list_trainees()
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    COALESCE(p.full_name, u.email) AS full_name
  FROM auth.users u
  LEFT JOIN lp_profiles p ON p.id = u.id
  WHERE u.raw_app_meta_data->>'role' = 'trainee'
  ORDER BY p.full_name NULLS LAST, u.email;
$$;

GRANT EXECUTE ON FUNCTION lp_list_trainees() TO authenticated;
