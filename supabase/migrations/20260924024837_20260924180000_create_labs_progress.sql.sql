/*
# Labs progress table (multi-user, owner-scoped)

## Purpose
Track per-user progress on tutorial (labs) entries from the Signal Desk.
Each row records which steps a user has completed for a given entry.

## New Tables
- `labs_progress`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `entry_id` (uuid, not null, references signal_desk_entries)
  - `completed_steps` (int[], defaults to empty array — step indices the user has checked off)
  - `updated_at` (timestamptz, defaults to now())
  - Unique constraint on (user_id, entry_id) so each user has one progress row per lab.

## Security
- RLS enabled.
- Owner-scoped CRUD: each authenticated user can only read/write their own progress rows.
*/

CREATE TABLE IF NOT EXISTS labs_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES signal_desk_entries(id) ON DELETE CASCADE,
  completed_steps int[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, entry_id)
);

ALTER TABLE labs_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_labs_progress" ON labs_progress;
CREATE POLICY "select_own_labs_progress" ON labs_progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_labs_progress" ON labs_progress;
CREATE POLICY "insert_own_labs_progress" ON labs_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_labs_progress" ON labs_progress;
CREATE POLICY "update_own_labs_progress" ON labs_progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_labs_progress" ON labs_progress;
CREATE POLICY "delete_own_labs_progress" ON labs_progress FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
