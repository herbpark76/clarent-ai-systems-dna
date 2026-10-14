/*
# Week Lock Enforcement for Quiz Attempts and Journal Entries + Fix Duplicate Progress Policies

## Problem
1. lp_progress has DUPLICATE INSERT policies (insert_own_progress + lp_progress_insert_own) and DUPLICATE UPDATE policies (update_own_progress + lp_progress_update_own). The older policies don't enforce week locking or restrict status values. Since Postgres policies are OR'd, the weaker old policies bypass the newer restrictions.
2. lp_quiz_attempts INSERT only checks auth.uid() = learner_id — no week lock check.
3. lp_journal_entries INSERT only checks auth.uid() = learner_id — no week lock check.

## Changes

### 1. Drop old duplicate lp_progress policies
- DROP "lp_progress_insert_own" (old INSERT that allowed any status, no week lock)
- DROP "lp_progress_update_own" (old UPDATE that allowed admin via USING but didn't restrict status in WITH CHECK properly for learners)

The remaining "insert_own_progress" and "update_own_progress" policies enforce:
- auth.uid() = learner_id
- lp_is_week_unlocked() check
- The UPDATE policy also needs status restriction — we recreate it to include status check

### 2. Recreate update_own_progress with status restriction
The current update_own_progress only checks auth.uid() and week unlock. It does NOT restrict which status values a learner can set. We need to ensure learners can only set status to 'not_started', 'in_progress', or 'submitted' — NOT 'approved' or 'changes_requested' (those are admin-only).

### 3. Add week-lock enforcement to lp_quiz_attempts INSERT
Drop old INSERT policy and recreate with week lock check.

### 4. Add week-lock enforcement to lp_journal_entries INSERT
Drop old INSERT policy and recreate with week lock check.

## Security
- All policies scope TO authenticated (no anon access).
- Learners cannot set status to 'approved' or 'changes_requested'.
- Admins can update any progress row (via the lp_progress_update_own policy that checks admin role — but we're dropping that one). We need to ensure admin updates still work: we add a separate admin UPDATE policy.
*/
-- ── 1. Fix lp_progress: drop old duplicate policies ──
DROP POLICY IF EXISTS "lp_progress_insert_own" ON lp_progress;
DROP POLICY IF EXISTS "lp_progress_update_own" ON lp_progress;

-- ── 2. Recreate update_own_progress with status restriction for learners ──
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
    -- Learner can only set safe statuses AND week must be unlocked
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

-- ── 3. Add week-lock to lp_quiz_attempts INSERT ──
DROP POLICY IF EXISTS "lp_quiz_insert_own" ON lp_quiz_attempts;
CREATE POLICY "lp_quiz_insert_own"
ON lp_quiz_attempts FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = learner_id
  AND lp_is_week_unlocked(auth.uid(), week_id)
);

-- ── 4. Add week-lock to lp_journal_entries INSERT ──
DROP POLICY IF EXISTS "journal_entries_insert_own" ON lp_journal_entries;
CREATE POLICY "journal_entries_insert_own"
ON lp_journal_entries FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = learner_id
  AND lp_is_week_unlocked(auth.uid(), week_id)
);
