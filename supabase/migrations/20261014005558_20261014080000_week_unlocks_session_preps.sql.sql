/*
# Week Unlocking, Session Preps, and Progress Lock Enforcement

## Purpose
1. Add a table for admin-manual week unlocks per learner.
2. Add a SQL function `lp_is_week_unlocked` that determines whether a learner can access a given week — week 1 is always open, week N>1 requires all tasks in week N-1 approved AND a passed quiz for week N-1, unless an admin has manually unlocked it.
3. Modify the INSERT and UPDATE policies on `lp_progress` so learners can only submit/update progress for tasks in unlocked weeks — enforced at the database level, not just UI.
4. Add a table for saved weekly session prep summaries.

## New Tables

### lp_week_unlocks
- `id` (uuid, PK)
- `learner_id` (uuid, references lp_profiles, NOT NULL)
- `week_id` (uuid, references lp_weeks, NOT NULL)
- `unlocked_by` (uuid, references auth.users — the admin who unlocked it)
- `created_at` (timestamptz, default now())
- Unique constraint on (learner_id, week_id)

### lp_session_preps
- `id` (uuid, PK)
- `learner_id` (uuid, references lp_profiles, NOT NULL)
- `admin_id` (uuid, references auth.users, NOT NULL)
- `prep_date` (date, NOT NULL)
- `summary` (text, NOT NULL) — the full generated session prep text
- `created_at` (timestamptz, default now())

## New Functions

### lp_is_week_unlocked(p_learner_id, p_week_id)
Returns boolean. Week 1 always returns true. For week N>1:
- Returns true if there's a manual unlock row in lp_week_unlocks for this learner + week.
- Otherwise checks: all tasks in the previous week (week_number - 1, same track) have approved progress AND there exists a passed quiz attempt for the previous week.

## Security Changes
- RLS enabled on both new tables, scoped to authenticated users.
- lp_week_unlocks: learners can read their own unlocks; only admins (via lp_is_admin()) can insert/delete.
- lp_session_preps: admins can read all, insert, and delete. Learners can read their own.
- lp_progress INSERT policy updated to require the week is unlocked for the task being submitted.
- lp_progress UPDATE policy updated to require the week is unlocked for the task being updated.

## Important Notes
1. Week 1 is always unlocked for all learners.
2. The unlock check is enforced via RLS on lp_progress, so even if the UI is bypassed, a learner cannot submit progress for a locked week.
3. Admin manual unlocks bypass the prerequisite check.
4. The function references lp_quiz_attempts to check for passed quizzes.
5. Admin checks use the existing lp_is_admin() function.
*/
CREATE TABLE IF NOT EXISTS lp_week_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES lp_profiles(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES lp_weeks(id) ON DELETE CASCADE,
  unlocked_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(learner_id, week_id)
);

ALTER TABLE lp_week_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_unlocks" ON lp_week_unlocks;
CREATE POLICY "select_own_unlocks"
ON lp_week_unlocks FOR SELECT
TO authenticated
USING (
  auth.uid() = learner_id OR lp_is_admin()
);

DROP POLICY IF EXISTS "admin_insert_unlocks" ON lp_week_unlocks;
CREATE POLICY "admin_insert_unlocks"
ON lp_week_unlocks FOR INSERT
TO authenticated
WITH CHECK (lp_is_admin());

DROP POLICY IF EXISTS "admin_delete_unlocks" ON lp_week_unlocks;
CREATE POLICY "admin_delete_unlocks"
ON lp_week_unlocks FOR DELETE
TO authenticated
USING (lp_is_admin());

CREATE TABLE IF NOT EXISTS lp_session_preps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES lp_profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  prep_date date NOT NULL,
  summary text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lp_session_preps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_session_preps" ON lp_session_preps;
CREATE POLICY "read_session_preps"
ON lp_session_preps FOR SELECT
TO authenticated
USING (
  auth.uid() = learner_id OR lp_is_admin()
);

DROP POLICY IF EXISTS "admin_insert_session_preps" ON lp_session_preps;
CREATE POLICY "admin_insert_session_preps"
ON lp_session_preps FOR INSERT
TO authenticated
WITH CHECK (lp_is_admin());

DROP POLICY IF EXISTS "admin_delete_session_preps" ON lp_session_preps;
CREATE POLICY "admin_delete_session_preps"
ON lp_session_preps FOR DELETE
TO authenticated
USING (lp_is_admin());

CREATE OR REPLACE FUNCTION lp_is_week_unlocked(p_learner_id uuid, p_week_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_number int;
  v_track_id uuid;
  v_prev_week_id uuid;
  v_total_tasks int;
  v_approved_tasks int;
  v_passed_quiz int;
  v_manual_unlock int;
BEGIN
  SELECT week_number, track_id INTO v_week_number, v_track_id
  FROM lp_weeks WHERE id = p_week_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_week_number <= 1 THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO v_manual_unlock
  FROM lp_week_unlocks
  WHERE learner_id = p_learner_id AND week_id = p_week_id;

  IF v_manual_unlock > 0 THEN
    RETURN true;
  END IF;

  SELECT id INTO v_prev_week_id
  FROM lp_weeks
  WHERE track_id = v_track_id AND week_number = v_week_number - 1;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO v_total_tasks
  FROM lp_tasks WHERE week_id = v_prev_week_id;

  IF v_total_tasks = 0 THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO v_approved_tasks
  FROM lp_progress
  WHERE learner_id = p_learner_id
    AND task_id IN (SELECT id FROM lp_tasks WHERE week_id = v_prev_week_id)
    AND status = 'approved';

  IF v_approved_tasks < v_total_tasks THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_passed_quiz
  FROM lp_quiz_attempts
  WHERE learner_id = p_learner_id
    AND week_id = v_prev_week_id
    AND passed = true;

  IF v_passed_quiz = 0 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION lp_is_week_unlocked(uuid, uuid) TO authenticated;

-- Update lp_progress INSERT policy to enforce week locking
DROP POLICY IF EXISTS "insert_own_progress" ON lp_progress;
CREATE POLICY "insert_own_progress"
ON lp_progress FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = learner_id
  AND lp_is_week_unlocked(auth.uid(), (
    SELECT week_id FROM lp_tasks WHERE id = lp_progress.task_id
  ))
);

-- Update lp_progress UPDATE policy to enforce week locking
DROP POLICY IF EXISTS "update_own_progress" ON lp_progress;
CREATE POLICY "update_own_progress"
ON lp_progress FOR UPDATE
TO authenticated
USING (auth.uid() = learner_id)
WITH CHECK (
  auth.uid() = learner_id
  AND lp_is_week_unlocked(auth.uid(), (
    SELECT week_id FROM lp_tasks WHERE id = lp_progress.task_id
  ))
);
