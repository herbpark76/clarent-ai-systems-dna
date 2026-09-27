/*
# Create learner portal tables (tracks, weeks, tasks, learner_progress)

## Purpose
A private learner portal at /learn where invited users sign in with email/password,
view their training track, mark tasks as done, and admins can see all learners' progress.

## New Tables
1. `lp_tracks` — training tracks (e.g. "AI Systems Foundations")
   - id (uuid PK)
   - title (text, not null)
   - description (text, nullable)
   - created_at (timestamptz, default now())

2. `lp_weeks` — weeks within a track
   - id (uuid PK)
   - track_id (uuid FK → lp_tracks, cascade delete)
   - week_number (int, not null)
   - title (text, not null)
   - goal (text, nullable)
   - start_date (date, nullable)
   - end_date (date, nullable)
   - created_at (timestamptz, default now())

3. `lp_tasks` — tasks within a week
   - id (uuid PK)
   - week_id (uuid FK → lp_weeks, cascade delete)
   - title (text, not null)
   - description (text, nullable)
   - sort_order (int, default 0)
   - created_at (timestamptz, default now())

4. `lp_progress` — learner progress per task
   - id (uuid PK)
   - learner_id (uuid FK → auth.users, cascade delete)
   - task_id (uuid FK → lp_tasks, cascade delete)
   - status (text: 'not_started' | 'in_progress' | 'done', default 'not_started')
   - completed_at (timestamptz, nullable)
   - created_at (timestamptz, default now())
   - UNIQUE(learner_id, task_id)

## Security — Row Level Security

All tables have RLS enabled.

### Tracks, Weeks, Tasks (read-only curriculum)
- All authenticated users (admin + learners) can SELECT these tables.
- Only admins can INSERT/UPDATE/DELETE (determined by raw_app_meta_data.role = 'admin').
- We use a helper function `lp_is_admin()` that checks `auth.jwt() ->> 'role' = 'admin'`.

### Learner Progress
- Learners can SELECT only their own rows (auth.uid() = learner_id).
- Learners can INSERT/UPDATE only their own rows.
- Learners can DELETE only their own rows.
- Admins can SELECT all rows (for the admin dashboard).
- Admins cannot INSERT/UPDATE/DELETE learner progress (learners control their own).

## Notes
1. Public sign-up is disabled at the Supabase Auth level (the admin invites users).
2. The admin's user account has `raw_app_meta_data.role = 'admin'` set manually.
3. The `lp_is_admin()` function reads from `auth.jwt() ->> 'role'` which maps to
   `raw_app_meta_data.role` — user-immutable server-side metadata.
*/

-- ── Helper function: is the current user an admin? ──
CREATE OR REPLACE FUNCTION lp_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', '') = 'admin'
$$;

-- ── lp_tracks ──
CREATE TABLE IF NOT EXISTS lp_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lp_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_tracks_select_authenticated" ON lp_tracks;
CREATE POLICY "lp_tracks_select_authenticated"
  ON lp_tracks FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lp_tracks_admin_insert" ON lp_tracks;
CREATE POLICY "lp_tracks_admin_insert"
  ON lp_tracks FOR INSERT TO authenticated
  WITH CHECK (lp_is_admin());

DROP POLICY IF EXISTS "lp_tracks_admin_update" ON lp_tracks;
CREATE POLICY "lp_tracks_admin_update"
  ON lp_tracks FOR UPDATE TO authenticated
  USING (lp_is_admin()) WITH CHECK (lp_is_admin());

DROP POLICY IF EXISTS "lp_tracks_admin_delete" ON lp_tracks;
CREATE POLICY "lp_tracks_admin_delete"
  ON lp_tracks FOR DELETE TO authenticated
  USING (lp_is_admin());

-- ── lp_weeks ──
CREATE TABLE IF NOT EXISTS lp_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES lp_tracks(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  title text NOT NULL,
  goal text,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lp_weeks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_weeks_select_authenticated" ON lp_weeks;
CREATE POLICY "lp_weeks_select_authenticated"
  ON lp_weeks FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lp_weeks_admin_insert" ON lp_weeks;
CREATE POLICY "lp_weeks_admin_insert"
  ON lp_weeks FOR INSERT TO authenticated
  WITH CHECK (lp_is_admin());

DROP POLICY IF EXISTS "lp_weeks_admin_update" ON lp_weeks;
CREATE POLICY "lp_weeks_admin_update"
  ON lp_weeks FOR UPDATE TO authenticated
  USING (lp_is_admin()) WITH CHECK (lp_is_admin());

DROP POLICY IF EXISTS "lp_weeks_admin_delete" ON lp_weeks;
CREATE POLICY "lp_weeks_admin_delete"
  ON lp_weeks FOR DELETE TO authenticated
  USING (lp_is_admin());

-- ── lp_tasks ──
CREATE TABLE IF NOT EXISTS lp_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES lp_weeks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lp_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_tasks_select_authenticated" ON lp_tasks;
CREATE POLICY "lp_tasks_select_authenticated"
  ON lp_tasks FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lp_tasks_admin_insert" ON lp_tasks;
CREATE POLICY "lp_tasks_admin_insert"
  ON lp_tasks FOR INSERT TO authenticated
  WITH CHECK (lp_is_admin());

DROP POLICY IF EXISTS "lp_tasks_admin_update" ON lp_tasks;
CREATE POLICY "lp_tasks_admin_update"
  ON lp_tasks FOR UPDATE TO authenticated
  USING (lp_is_admin()) WITH CHECK (lp_is_admin());

DROP POLICY IF EXISTS "lp_tasks_admin_delete" ON lp_tasks;
CREATE POLICY "lp_tasks_admin_delete"
  ON lp_tasks FOR DELETE TO authenticated
  USING (lp_is_admin());

-- ── lp_progress ──
CREATE TABLE IF NOT EXISTS lp_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES lp_tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(learner_id, task_id)
);

ALTER TABLE lp_progress ENABLE ROW LEVEL SECURITY;

-- Learners can read their own progress
DROP POLICY IF EXISTS "lp_progress_select_own" ON lp_progress;
CREATE POLICY "lp_progress_select_own"
  ON lp_progress FOR SELECT TO authenticated
  USING (auth.uid() = learner_id OR lp_is_admin());

-- Learners can insert their own progress rows
DROP POLICY IF EXISTS "lp_progress_insert_own" ON lp_progress;
CREATE POLICY "lp_progress_insert_own"
  ON lp_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = learner_id);

-- Learners can update their own progress rows
DROP POLICY IF EXISTS "lp_progress_update_own" ON lp_progress;
CREATE POLICY "lp_progress_update_own"
  ON lp_progress FOR UPDATE TO authenticated
  USING (auth.uid() = learner_id) WITH CHECK (auth.uid() = learner_id);

-- Learners can delete their own progress rows
DROP POLICY IF EXISTS "lp_progress_delete_own" ON lp_progress;
CREATE POLICY "lp_progress_delete_own"
  ON lp_progress FOR DELETE TO authenticated
  USING (auth.uid() = learner_id);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_lp_weeks_track_id ON lp_weeks(track_id);
CREATE INDEX IF NOT EXISTS idx_lp_tasks_week_id ON lp_tasks(week_id);
CREATE INDEX IF NOT EXISTS idx_lp_progress_learner_id ON lp_progress(learner_id);
CREATE INDEX IF NOT EXISTS idx_lp_progress_task_id ON lp_progress(task_id);
