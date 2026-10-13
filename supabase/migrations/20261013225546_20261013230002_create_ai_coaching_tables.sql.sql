/*
# AI Coaching: progress columns, quiz attempts, interview practice, rate limiting

## Overview
Adds AI coaching infrastructure to the learner portal:
1. New columns on lp_progress for coach feedback, follow-up question, and learner's answer.
2. New table lp_quiz_attempts for weekly knowledge checks.
3. New table lp_interview_practice for interview practice sessions.
4. New table lp_coach_calls for daily rate limiting (30 calls/learner/day).

## Changes to lp_progress
- coach_feedback text: Claude's feedback (what's good + what's missing)
- coach_question text: Claude's follow-up question
- coach_answer text: Learner's answer to the follow-up question
- coach_completed boolean default false: true when learner has answered the follow-up

## New Tables

### lp_quiz_attempts
- id uuid PK
- learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- week_id uuid NOT NULL REFERENCES lp_weeks(id) ON DELETE CASCADE
- questions jsonb NOT NULL: array of question objects
- answers jsonb: array of answer objects
- score int: 0-100
- passed boolean: score >= 75
- feedback text: Claude's overall feedback
- created_at timestamptz DEFAULT now()

### lp_interview_practice
- id uuid PK
- learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- question text NOT NULL
- answer text
- scores jsonb: { clarity: 1-5, technical_depth: 1-5, use_of_specifics: 1-5 }
- feedback text: Claude's feedback including suggested stronger version
- created_at timestamptz DEFAULT now()

### lp_coach_calls
- id uuid PK
- learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- call_type text NOT NULL: 'feedback' | 'quiz_generate' | 'quiz_grade' | 'interview'
- created_at timestamptz DEFAULT now()
Used for rate limiting: max 30 rows per learner per day.

## Security (RLS)
- lp_progress: existing policies already scope by ownership. New columns are covered by existing UPDATE policy.
- lp_quiz_attempts: learners read/write own rows; admins read all.
- lp_interview_practice: learners read/write own rows; admins read all.
- lp_coach_calls: learners can read own count; admins read all. No direct insert from client (edge function uses service role).
*/

-- ── Add columns to lp_progress ──
DO $$ BEGIN
  ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS coach_feedback text;
  ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS coach_question text;
  ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS coach_answer text;
  ALTER TABLE lp_progress ADD COLUMN IF NOT EXISTS coach_completed boolean NOT NULL DEFAULT false;
END $$;

-- ── lp_quiz_attempts ──
CREATE TABLE IF NOT EXISTS lp_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES lp_weeks(id) ON DELETE CASCADE,
  questions jsonb NOT NULL,
  answers jsonb,
  score int,
  passed boolean,
  feedback text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_quiz_attempts_learner ON lp_quiz_attempts(learner_id);
CREATE INDEX IF NOT EXISTS idx_lp_quiz_attempts_week ON lp_quiz_attempts(week_id, learner_id);

ALTER TABLE lp_quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_quiz_select_own" ON lp_quiz_attempts;
CREATE POLICY "lp_quiz_select_own" ON lp_quiz_attempts FOR SELECT
  TO authenticated USING (auth.uid() = learner_id OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "lp_quiz_insert_own" ON lp_quiz_attempts;
CREATE POLICY "lp_quiz_insert_own" ON lp_quiz_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = learner_id);

DROP POLICY IF EXISTS "lp_quiz_update_own" ON lp_quiz_attempts;
CREATE POLICY "lp_quiz_update_own" ON lp_quiz_attempts FOR UPDATE
  TO authenticated USING (auth.uid() = learner_id) WITH CHECK (auth.uid() = learner_id);

DROP POLICY IF EXISTS "lp_quiz_delete_own" ON lp_quiz_attempts;
CREATE POLICY "lp_quiz_delete_own" ON lp_quiz_attempts FOR DELETE
  TO authenticated USING (auth.uid() = learner_id);

-- ── lp_interview_practice ──
CREATE TABLE IF NOT EXISTS lp_interview_practice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  scores jsonb,
  feedback text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_interview_practice_learner ON lp_interview_practice(learner_id);

ALTER TABLE lp_interview_practice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_interview_select_own" ON lp_interview_practice;
CREATE POLICY "lp_interview_select_own" ON lp_interview_practice FOR SELECT
  TO authenticated USING (auth.uid() = learner_id OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "lp_interview_insert_own" ON lp_interview_practice;
CREATE POLICY "lp_interview_insert_own" ON lp_interview_practice FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = learner_id);

DROP POLICY IF EXISTS "lp_interview_update_own" ON lp_interview_practice;
CREATE POLICY "lp_interview_update_own" ON lp_interview_practice FOR UPDATE
  TO authenticated USING (auth.uid() = learner_id) WITH CHECK (auth.uid() = learner_id);

DROP POLICY IF EXISTS "lp_interview_delete_own" ON lp_interview_practice;
CREATE POLICY "lp_interview_delete_own" ON lp_interview_practice FOR DELETE
  TO authenticated USING (auth.uid() = learner_id);

-- ── lp_coach_calls (rate limiting) ──
CREATE TABLE IF NOT EXISTS lp_coach_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_coach_calls_learner_date ON lp_coach_calls(learner_id, created_at);

ALTER TABLE lp_coach_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_coach_calls_select_own" ON lp_coach_calls;
CREATE POLICY "lp_coach_calls_select_own" ON lp_coach_calls FOR SELECT
  TO authenticated USING (auth.uid() = learner_id OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');