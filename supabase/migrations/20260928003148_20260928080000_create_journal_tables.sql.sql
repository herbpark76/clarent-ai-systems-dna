/*
# Create journal tables for learner portal

## Summary
1. Create lp_journal_entries: weekly build journal entries by learners.
2. Create lp_journal_comments: admin/learner comments on journal entries.
3. RLS: learners own their entries; admins can read all. Comments: admins
   can insert and read all; learners can read and reply on their own entries.

## Tables
### lp_journal_entries
- id (uuid PK)
- learner_id (uuid, FK auth.users, NOT NULL, DEFAULT auth.uid())
- week_id (uuid, FK lp_weeks ON DELETE CASCADE)
- entry_date (date, NOT NULL)
- built (text, NOT NULL) — what I built
- broke (text, NOT NULL) — what broke
- learned (text, NOT NULL) — what I learned
- questions (text, nullable) — questions for Herb
- hours (numeric, nullable) — hours spent
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now())

### lp_journal_comments
- id (uuid PK)
- entry_id (uuid, FK lp_journal_entries ON DELETE CASCADE)
- author_id (uuid, FK auth.users, NOT NULL, DEFAULT auth.uid())
- body (text, NOT NULL)
- created_at (timestamptz, DEFAULT now())

## RLS
- lp_journal_entries: SELECT (own OR admin), INSERT/UPDATE/DELETE (own only)
- lp_journal_comments: SELECT (own entries OR admin), INSERT (own entries OR admin)
*/

-- ── 1. lp_journal_entries ──────────────────────────────
CREATE TABLE IF NOT EXISTS lp_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id uuid REFERENCES lp_weeks(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  built text NOT NULL DEFAULT '',
  broke text NOT NULL DEFAULT '',
  learned text NOT NULL DEFAULT '',
  questions text,
  hours numeric(5,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lp_journal_entries ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_learner ON lp_journal_entries(learner_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_week ON lp_journal_entries(week_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_learner_created ON lp_journal_entries(learner_id, created_at DESC);

-- Policies: learners own their entries; admins can read all
DROP POLICY IF EXISTS "journal_entries_select_own_or_admin" ON lp_journal_entries;
CREATE POLICY "journal_entries_select_own_or_admin"
  ON lp_journal_entries FOR SELECT TO authenticated
  USING (
    learner_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "journal_entries_insert_own" ON lp_journal_entries;
CREATE POLICY "journal_entries_insert_own"
  ON lp_journal_entries FOR INSERT TO authenticated
  WITH CHECK (learner_id = auth.uid());

DROP POLICY IF EXISTS "journal_entries_update_own" ON lp_journal_entries;
CREATE POLICY "journal_entries_update_own"
  ON lp_journal_entries FOR UPDATE TO authenticated
  USING (learner_id = auth.uid())
  WITH CHECK (learner_id = auth.uid());

DROP POLICY IF EXISTS "journal_entries_delete_own" ON lp_journal_entries;
CREATE POLICY "journal_entries_delete_own"
  ON lp_journal_entries FOR DELETE TO authenticated
  USING (learner_id = auth.uid());

-- ── 2. lp_journal_comments ─────────────────────────────
CREATE TABLE IF NOT EXISTS lp_journal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES lp_journal_entries(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lp_journal_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_journal_comments_entry ON lp_journal_comments(entry_id);

-- SELECT: admin can read all; learners can read comments on their own entries
DROP POLICY IF EXISTS "journal_comments_select_own_or_admin" ON lp_journal_comments;
CREATE POLICY "journal_comments_select_own_or_admin"
  ON lp_journal_comments FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM lp_journal_entries e
      WHERE e.id = lp_journal_comments.entry_id
      AND e.learner_id = auth.uid()
    )
  );

-- INSERT: admin can comment on any entry; learners can reply on their own entries
DROP POLICY IF EXISTS "journal_comments_insert_own_or_admin" ON lp_journal_comments;
CREATE POLICY "journal_comments_insert_own_or_admin"
  ON lp_journal_comments FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM lp_journal_entries e
      WHERE e.id = lp_journal_comments.entry_id
      AND e.learner_id = auth.uid()
    )
  );
