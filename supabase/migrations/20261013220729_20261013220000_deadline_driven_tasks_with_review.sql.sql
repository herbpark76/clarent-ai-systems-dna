/*
# Deadline-driven tasks with completion notes and admin review

## Overview
Transforms the learner portal from a simple click-to-cycle checkbox into a 
submission-and-review workflow with due dates, completion notes, and admin review.

## Changes

### 1. Remove Week 1 task
- Deletes the "Take the call with Ed" task (and its progress rows via CASCADE).

### 2. lp_tasks: add due_date column
- New column `due_date` (date, nullable).
- Defaults every task's due_date to its week's end_date (Sunday).

### 3. lp_progress: new columns and status changes
- New columns: `completion_note` (text), `link` (text), `submitted_at` (timestamptz),
  `reviewed_at` (timestamptz), `review_comment` (text).
- Status CHECK constraint updated from (not_started, in_progress, done) to
  (not_started, in_progress, submitted, approved, changes_requested).
- Existing 'done' rows migrated to 'approved'.

### 4. Security: RLS policy updates
- UPDATE policy on lp_progress: learners can only set status to 
  not_started, in_progress, or submitted. Admins can set any status.
- A BEFORE UPDATE trigger prevents non-admins from modifying review_comment 
  or reviewed_at columns.

### 5. Due date editing
- Admins can update lp_tasks.due_date (existing admin UPDATE policy already covers this).
*/

-- ── 1. Remove the "Take the call with Ed" task ──────────────
DELETE FROM lp_tasks WHERE title = 'Take the call with Ed; tell him you''re acting on his feedback';

-- ── 2. Add due_date to lp_tasks ─────────────────────────────
ALTER TABLE lp_tasks ADD COLUMN IF NOT EXISTS due_date date;

-- Set default due_date from each task's week end_date
UPDATE lp_tasks t
SET due_date = w.end_date
FROM lp_weeks w
WHERE t.week_id = w.id AND t.due_date IS NULL;

-- ── 3. Add new columns to lp_progress ───────────────────────
ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS completion_note text;
ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS review_comment text;

-- ── 4. Update status CHECK constraint ───────────────────────
-- Migrate existing 'done' rows to 'approved'
UPDATE lp_progress SET status = 'approved' WHERE status = 'done';

ALTER TABLE lp_progress DROP CONSTRAINT IF EXISTS lp_progress_status_check;
ALTER TABLE lp_progress ADD CONSTRAINT lp_progress_status_check
  CHECK (status IN ('not_started', 'in_progress', 'submitted', 'approved', 'changes_requested'));

-- ── 5. Update RLS policies on lp_progress ───────────────────
-- SELECT: learners see own rows, admins see all (already correct, but re-create for safety)
DROP POLICY IF EXISTS "lp_progress_select_own" ON lp_progress;
CREATE POLICY "lp_progress_select_own" ON lp_progress FOR SELECT
  TO authenticated
  USING (
    auth.uid() = learner_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- INSERT: learners can insert own rows with learner-allowed statuses only
DROP POLICY IF EXISTS "lp_progress_insert_own" ON lp_progress;
CREATE POLICY "lp_progress_insert_own" ON lp_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = learner_id
    AND status IN ('not_started', 'in_progress', 'submitted')
  );

-- UPDATE: learners can update own rows (limited statuses), admins can update any row
DROP POLICY IF EXISTS "lp_progress_update_own" ON lp_progress;
CREATE POLICY "lp_progress_update_own" ON lp_progress FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = learner_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.uid() = learner_id AND status IN ('not_started', 'in_progress', 'submitted'))
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- DELETE: learners can delete own rows (unchanged)
DROP POLICY IF EXISTS "lp_progress_delete_own" ON lp_progress;
CREATE POLICY "lp_progress_delete_own" ON lp_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = learner_id);

-- ── 6. Trigger: prevent non-admins from modifying review fields ──
CREATE OR REPLACE FUNCTION enforce_review_field_protection()
RETURNS TRIGGER AS $$
BEGIN
  -- If the current user is NOT an admin, protect review fields
  IF (auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' THEN
    -- Non-admins cannot set review_comment or reviewed_at
    IF NEW.review_comment IS DISTINCT FROM OLD.review_comment THEN
      NEW.review_comment := OLD.review_comment;
    END IF;
    IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
      NEW.reviewed_at := OLD.reviewed_at;
    END IF;
    -- Non-admins cannot set status to approved or changes_requested
    IF NEW.status NOT IN ('not_started', 'in_progress', 'submitted') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS lp_progress_review_protection ON lp_progress;
CREATE TRIGGER lp_progress_review_protection
  BEFORE UPDATE ON lp_progress
  FOR EACH ROW
  EXECUTE FUNCTION enforce_review_field_protection();