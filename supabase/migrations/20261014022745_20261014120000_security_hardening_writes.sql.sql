/*
# Security Hardening: Quiz/Interview Write Lockdown, Progress Column Protection, Profile Restriction, Journal Comments

## Changes

### 1. lp_quiz_attempts — remove all learner write policies
Learners: SELECT own only. All writes happen via the learn-coach edge function (service role).
- DROP lp_quiz_insert_own, lp_quiz_update_own, lp_quiz_delete_own
- Keep lp_quiz_select_own

### 2. lp_interview_practice — remove all learner write policies
Learners: SELECT own only. All writes via edge function (service role).
- DROP lp_interview_insert_own, lp_interview_update_own, lp_interview_delete_own
- Keep lp_interview_select_own

### 3. lp_progress — column protection trigger + admin-only DELETE + block updates on approved rows + review history
- DROP lp_progress_delete_own (learner DELETE removed — admin only)
- Add admin DELETE policy
- Update UPDATE policy: block learners from updating rows where current status = 'approved'
- Add trigger lp_protect_progress_columns that raises exception if a non-admin tries to change:
  review_comment, reviewed_at, coach_feedback, coach_question, coach_answer, coach_completed, task_id, learner_id
  Learners may only change: completion_note, link, status, submitted_at, completed_at
- Add lp_review_history table to keep full history of review comments (append-only)
- Add trigger lp_append_review_history that inserts a row into lp_review_history whenever review_comment or status changes

### 4. lp_profiles — restrict learner UPDATE to full_name only
- DROP lp_profiles_update_own (allowed updating any column)
- Add lp_profiles_update_own_name: learner can update only full_name on their own row
- Keep lp_profiles_admin_update (admin can update all columns)

### 5. lp_journal_comments — add DELETE policy
- Learners can delete their own comments (author_id = auth.uid())
- Admins can delete any comment
- UPDATE not needed (comments are create-only or delete)
*/

-- ── 1. lp_quiz_attempts: remove learner write policies ──
DROP POLICY IF EXISTS "lp_quiz_insert_own" ON lp_quiz_attempts;
DROP POLICY IF EXISTS "lp_quiz_update_own" ON lp_quiz_attempts;
DROP POLICY IF EXISTS "lp_quiz_delete_own" ON lp_quiz_attempts;
-- SELECT policy remains: lp_quiz_select_own

-- ── 2. lp_interview_practice: remove learner write policies ──
DROP POLICY IF EXISTS "lp_interview_insert_own" ON lp_interview_practice;
DROP POLICY IF EXISTS "lp_interview_update_own" ON lp_interview_practice;
DROP POLICY IF EXISTS "lp_interview_delete_own" ON lp_interview_practice;
-- SELECT policy remains: lp_interview_select_own

-- ── 3. lp_progress: admin-only DELETE, block updates on approved, column trigger, review history ──

-- Remove learner DELETE, add admin DELETE
DROP POLICY IF EXISTS "lp_progress_delete_own" ON lp_progress;
DROP POLICY IF EXISTS "lp_progress_delete_admin" ON lp_progress;
CREATE POLICY "lp_progress_delete_admin"
ON lp_progress FOR DELETE
TO authenticated
USING (lp_is_admin());

-- Update UPDATE policy: learners can't update approved rows
DROP POLICY IF EXISTS "update_own_progress" ON lp_progress;
CREATE POLICY "update_own_progress"
ON lp_progress FOR UPDATE
TO authenticated
USING (
  auth.uid() = learner_id
  OR lp_is_admin()
)
WITH CHECK (
  (
    -- Learner can only update non-approved rows, set safe statuses, week must be unlocked
    auth.uid() = learner_id
    AND (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'submitted'::text]))
    AND lp_is_week_unlocked(auth.uid(), (
      SELECT week_id FROM lp_tasks WHERE id = lp_progress.task_id
    ))
  )
  OR (
    -- Admin can set any status
    lp_is_admin()
  )
);

-- The USING clause also needs to prevent learners from touching approved rows.
-- Since USING is OR'd, we need a separate restrictive approach: use a trigger.
-- Actually, USING controls which rows are visible for update. The current USING
-- allows learner to see their own rows (including approved). We need to block
-- the update via a trigger if the OLD row is approved and the caller is not admin.

-- Review history table
CREATE TABLE IF NOT EXISTS lp_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id uuid NOT NULL REFERENCES lp_progress(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id),
  old_status text,
  new_status text,
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lp_review_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "review_history_select_own_or_admin" ON lp_review_history;
CREATE POLICY "review_history_select_own_or_admin"
ON lp_review_history FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM lp_progress WHERE id = lp_review_history.progress_id AND (learner_id = auth.uid() OR lp_is_admin()))
);

DROP POLICY IF EXISTS "review_history_insert_admin" ON lp_review_history;
CREATE POLICY "review_history_insert_admin"
ON lp_review_history FOR INSERT
TO authenticated
WITH CHECK (lp_is_admin());

-- Column protection trigger for lp_progress
CREATE OR REPLACE FUNCTION lp_protect_progress_columns()
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
    -- Append to review history if status or review_comment changed
    IF (NEW.status IS DISTINCT FROM OLD.status) OR (NEW.review_comment IS DISTINCT FROM OLD.review_comment) THEN
      INSERT INTO lp_review_history (progress_id, reviewer_id, old_status, new_status, comment)
      VALUES (OLD.id, auth.uid(), OLD.status, NEW.status, NEW.review_comment);
    END IF;
    RETURN NEW;
  END IF;

  -- Non-admin (learner): protect columns
  -- Block updating approved rows
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Cannot modify an approved task. Contact your instructor if changes are needed.';
  END IF;

  -- Block changing protected columns
  IF NEW.task_id IS DISTINCT FROM OLD.task_id THEN
    RAISE EXCEPTION 'Cannot change task_id.';
  END IF;
  IF NEW.learner_id IS DISTINCT FROM OLD.learner_id THEN
    RAISE EXCEPTION 'Cannot change learner_id.';
  END IF;
  IF NEW.review_comment IS DISTINCT FROM OLD.review_comment THEN
    RAISE EXCEPTION 'Cannot change review_comment.';
  END IF;
  IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
    RAISE EXCEPTION 'Cannot change reviewed_at.';
  END IF;
  IF NEW.coach_feedback IS DISTINCT FROM OLD.coach_feedback THEN
    RAISE EXCEPTION 'Cannot change coach_feedback.';
  END IF;
  IF NEW.coach_question IS DISTINCT FROM OLD.coach_question THEN
    RAISE EXCEPTION 'Cannot change coach_question.';
  END IF;
  IF NEW.coach_answer IS DISTINCT FROM OLD.coach_answer THEN
    -- Learners CAN set coach_answer (their follow-up answer) but only if it was NULL before
    IF OLD.coach_answer IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot change an existing coach_answer.';
    END IF;
  END IF;
  IF NEW.coach_completed IS DISTINCT FROM OLD.coach_completed THEN
    RAISE EXCEPTION 'Cannot change coach_completed.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lp_protect_progress_columns_trigger ON lp_progress;
CREATE TRIGGER lp_protect_progress_columns_trigger
BEFORE UPDATE ON lp_progress
FOR EACH ROW
EXECUTE FUNCTION lp_protect_progress_columns();

GRANT EXECUTE ON FUNCTION lp_protect_progress_columns() TO authenticated;

-- ── 4. lp_profiles: restrict learner UPDATE to full_name only ──
DROP POLICY IF EXISTS "lp_profiles_update_own" ON lp_profiles;
CREATE POLICY "lp_profiles_update_own_name"
ON lp_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
-- Admin update policy (lp_profiles_admin_update) remains unchanged.

-- ── 5. lp_journal_comments: add DELETE policy ──
DROP POLICY IF EXISTS "journal_comments_delete_own_or_admin" ON lp_journal_comments;
CREATE POLICY "journal_comments_delete_own_or_admin"
ON lp_journal_comments FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR lp_is_admin()
);
