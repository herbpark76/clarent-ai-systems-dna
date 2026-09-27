/*
# Fix admin RLS check: use app_metadata.role path

## Root cause
lp_is_admin() reads `auth.jwt() ->> 'role'` which looks for a top-level
`role` claim. Supabase stores the role inside `app_metadata` in the JWT,
so `auth.jwt() ->> 'role'` returns NULL and the admin check always fails.

## Fix
1. Update lp_is_admin() to use `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`.
2. Replace all inline `auth.jwt() ->> 'role'` checks in signal_desk_entries
   and lp_profiles policies with the same `app_metadata` path.
3. Add admin-only SELECT policy on ai_systems_waitlist (currently no SELECT
   policy exists at all — anon had SELECT revoked but authenticated never
   got a SELECT policy, so even admins can't read it).

## Tables affected
- signal_desk_entries: all admin policies now use app_metadata path
- lp_profiles: select policy uses app_metadata path
- lp_progress: uses lp_is_admin() (now fixed)
- lp_tracks, lp_weeks, lp_tasks: use lp_is_admin() (now fixed)
- ai_systems_waitlist: new admin SELECT policy
*/

-- ── 1. Fix lp_is_admin() ───────────────────────────────
CREATE OR REPLACE FUNCTION lp_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

-- ── 2. Fix signal_desk_entries policies ────────────────
-- Drop and recreate with the correct app_metadata path
DROP POLICY IF EXISTS "public_read_published_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "authenticated_read_published_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "admin_insert_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "admin_update_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "admin_delete_entries" ON signal_desk_entries;

-- Public (anon) can read only published entries
CREATE POLICY "public_read_published_entries"
  ON signal_desk_entries FOR SELECT
  TO anon
  USING (status = 'published');

-- Authenticated users can read published entries; admins can read all
CREATE POLICY "authenticated_read_published_entries"
  ON signal_desk_entries FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Only admin can insert
CREATE POLICY "admin_insert_entries"
  ON signal_desk_entries FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Only admin can update
CREATE POLICY "admin_update_entries"
  ON signal_desk_entries FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Only admin can delete
CREATE POLICY "admin_delete_entries"
  ON signal_desk_entries FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 3. Fix lp_profiles policies ────────────────────────
DROP POLICY IF EXISTS "lp_profiles_select_own" ON lp_profiles;
DROP POLICY IF EXISTS "lp_profiles_insert_own" ON lp_profiles;
DROP POLICY IF EXISTS "lp_profiles_update_own" ON lp_profiles;

CREATE POLICY "lp_profiles_select_own"
  ON lp_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "lp_profiles_insert_own"
  ON lp_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "lp_profiles_update_own"
  ON lp_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 4. Fix lp_progress policies (use inline check, not the function) ──
DROP POLICY IF EXISTS "lp_progress_select_own" ON lp_progress;
DROP POLICY IF EXISTS "lp_progress_insert_own" ON lp_progress;
DROP POLICY IF EXISTS "lp_progress_update_own" ON lp_progress;
DROP POLICY IF EXISTS "lp_progress_delete_own" ON lp_progress;

CREATE POLICY "lp_progress_select_own"
  ON lp_progress FOR SELECT TO authenticated
  USING (
    auth.uid() = learner_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "lp_progress_insert_own"
  ON lp_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "lp_progress_update_own"
  ON lp_progress FOR UPDATE TO authenticated
  USING (auth.uid() = learner_id)
  WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "lp_progress_delete_own"
  ON lp_progress FOR DELETE TO authenticated
  USING (auth.uid() = learner_id);

-- ── 5. Fix lp_tracks, lp_weeks, lp_tasks (inline check) ──
-- lp_tracks
DROP POLICY IF EXISTS "lp_tracks_select_authenticated" ON lp_tracks;
DROP POLICY IF EXISTS "lp_tracks_admin_insert" ON lp_tracks;
DROP POLICY IF EXISTS "lp_tracks_admin_update" ON lp_tracks;
DROP POLICY IF EXISTS "lp_tracks_admin_delete" ON lp_tracks;

CREATE POLICY "lp_tracks_select_authenticated"
  ON lp_tracks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "lp_tracks_admin_insert"
  ON lp_tracks FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "lp_tracks_admin_update"
  ON lp_tracks FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "lp_tracks_admin_delete"
  ON lp_tracks FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- lp_weeks
DROP POLICY IF EXISTS "lp_weeks_select_authenticated" ON lp_weeks;
DROP POLICY IF EXISTS "lp_weeks_admin_insert" ON lp_weeks;
DROP POLICY IF EXISTS "lp_weeks_admin_update" ON lp_weeks;
DROP POLICY IF EXISTS "lp_weeks_admin_delete" ON lp_weeks;

CREATE POLICY "lp_weeks_select_authenticated"
  ON lp_weeks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "lp_weeks_admin_insert"
  ON lp_weeks FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "lp_weeks_admin_update"
  ON lp_weeks FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "lp_weeks_admin_delete"
  ON lp_weeks FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- lp_tasks
DROP POLICY IF EXISTS "lp_tasks_select_authenticated" ON lp_tasks;
DROP POLICY IF EXISTS "lp_tasks_admin_insert" ON lp_tasks;
DROP POLICY IF EXISTS "lp_tasks_admin_update" ON lp_tasks;
DROP POLICY IF EXISTS "lp_tasks_admin_delete" ON lp_tasks;

CREATE POLICY "lp_tasks_select_authenticated"
  ON lp_tasks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "lp_tasks_admin_insert"
  ON lp_tasks FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "lp_tasks_admin_update"
  ON lp_tasks FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "lp_tasks_admin_delete"
  ON lp_tasks FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 6. ai_systems_waitlist: admin-only SELECT ──────────
-- Currently no SELECT policy exists. Add admin SELECT so admins can
-- view the waitlist. Anon cannot read (SELECT revoked).
DROP POLICY IF EXISTS "admin_select_waitlist" ON ai_systems_waitlist;
CREATE POLICY "admin_select_waitlist"
  ON ai_systems_waitlist FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 7. Backfill lp_profiles for any missing users ──────
INSERT INTO lp_profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data ->> 'full_name', email)
FROM auth.users
WHERE id NOT IN (SELECT id FROM lp_profiles)
ON CONFLICT (id) DO NOTHING;
