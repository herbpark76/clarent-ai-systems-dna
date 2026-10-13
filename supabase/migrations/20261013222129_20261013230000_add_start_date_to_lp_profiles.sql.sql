/*
# Add start_date to lp_profiles for per-learner track dates

## Overview
Each learner's track timeline is now relative to their own start_date instead of
the stored template week dates. Week 1 runs from start_date through the first
Sunday on or after start_date. Later weeks run Monday–Sunday. Task due dates
are the Sunday their week ends.

## Changes

### 1. lp_profiles: add start_date column
- New `start_date` column (date, nullable).
- Admin-editable on the learner detail page.
- Defaults to the date the learner is invited (set by the invite-learner edge function).

### 2. lp_list_trainees: return start_date
- Updated to also return `start_date` from lp_profiles.

### 3. RLS: admin can update start_date
- The existing lp_profiles_update_own policy only allows self-update by the row owner.
- Added a new admin-only UPDATE policy so admins can edit start_date.

### 4. Set Alex DeVore and John Doe start_date to 2026-10-13
*/

ALTER TABLE lp_profiles ADD COLUMN IF NOT EXISTS start_date date;

-- Update lp_list_trainees to return start_date
DROP FUNCTION IF EXISTS lp_list_trainees();
CREATE OR REPLACE FUNCTION lp_list_trainees()
RETURNS TABLE(id uuid, full_name text, start_date date)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
SELECT
  u.id,
  COALESCE(p.full_name, u.email) AS full_name,
  p.start_date AS start_date
FROM auth.users u
LEFT JOIN lp_profiles p ON p.id = u.id
WHERE u.raw_app_meta_data->>'role' = 'trainee'
ORDER BY p.full_name NULLS LAST, u.email;
$$;

-- Admin can update lp_profiles (for start_date editing)
DROP POLICY IF EXISTS "lp_profiles_admin_update" ON lp_profiles;
CREATE POLICY "lp_profiles_admin_update" ON lp_profiles FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Set start_date for both learners
UPDATE lp_profiles SET start_date = '2026-10-13' WHERE full_name IN ('Alex DeVore', 'John Doe');