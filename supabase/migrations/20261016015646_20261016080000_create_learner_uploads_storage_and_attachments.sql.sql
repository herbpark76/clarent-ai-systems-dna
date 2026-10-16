/*
# Create learner-uploads storage bucket and lp_attachments table

## Purpose
Learners can upload screenshots and PDFs directly to their task submissions
and journal entries, instead of hosting files elsewhere. Files are stored in
a private Supabase Storage bucket and served via short-lived signed URLs.

## 1. Storage Bucket
- Creates a PRIVATE bucket named `learner-uploads` (not public).
- Files are organized as `<learner_id>/<task_id or journal_entry_id>/<filename>`.
- Allowed MIME types: png, jpg, jpeg, gif, webp, pdf.
- Max file size: 10 MB enforced at the application layer.

## 2. Storage RLS (storage.objects)
- Learners (authenticated) can INSERT, SELECT, and DELETE only objects
  whose path starts with their own `auth.uid()/` prefix.
- Admins (authenticated users with app_metadata.role = 'admin') can SELECT
  all objects in the bucket.
- No anonymous access.
- DELETE is blocked for files attached to an approved task (enforced in
  lp_attachments DELETE policy; storage DELETE policy only checks folder
  ownership — the application layer checks approval status before deleting).

## 3. New Table: lp_attachments
- `id` (uuid PK, default gen_random_uuid)
- `learner_id` (uuid NOT NULL, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
- `progress_id` (uuid nullable, references lp_progress ON DELETE CASCADE)
- `journal_entry_id` (uuid nullable, references lp_journal_entries ON DELETE CASCADE)
- `file_path` (text NOT NULL) — full path in the bucket
- `file_name` (text NOT NULL) — original file name
- `mime_type` (text NOT NULL)
- `size_bytes` (integer NOT NULL)
- `created_at` (timestamptz default now())

## 4. Table RLS (lp_attachments)
- Learners can SELECT and INSERT their own rows (auth.uid() = learner_id).
- Admins can SELECT all rows.
- Learners can DELETE their own rows ONLY if the linked task is not approved
  (checked via join to lp_progress).
- No UPDATE policy — attachments are immutable once created.
- No anonymous access.

## 5. Indexes
- Index on learner_id for fast per-learner queries.
- Index on progress_id for fast per-submission queries.
- Index on journal_entry_id for fast per-entry queries.
*/

-- ── Storage bucket ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('learner-uploads', 'learner-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies ────────────────────────────────
-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "learner_uploads_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "learner_uploads_select_own" ON storage.objects;
DROP POLICY IF EXISTS "learner_uploads_select_admin" ON storage.objects;
DROP POLICY IF EXISTS "learner_uploads_delete_own" ON storage.objects;

-- Learners can upload to their own folder
CREATE POLICY "learner_uploads_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'learner-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Learners can read their own folder
CREATE POLICY "learner_uploads_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'learner-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read all files in the bucket
CREATE POLICY "learner_uploads_select_admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'learner-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
  OR (
    bucket_id = 'learner-uploads'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
);

-- Learners can delete from their own folder
CREATE POLICY "learner_uploads_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'learner-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── lp_attachments table ────────────────────────────────
CREATE TABLE IF NOT EXISTS lp_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  progress_id uuid REFERENCES lp_progress(id) ON DELETE CASCADE,
  journal_entry_id uuid REFERENCES lp_journal_entries(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lp_attachments ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lp_attachments_learner_id ON lp_attachments(learner_id);
CREATE INDEX IF NOT EXISTS idx_lp_attachments_progress_id ON lp_attachments(progress_id);
CREATE INDEX IF NOT EXISTS idx_lp_attachments_journal_entry_id ON lp_attachments(journal_entry_id);

-- ── Table RLS policies ──────────────────────────────────
DROP POLICY IF EXISTS "attachments_select_own" ON lp_attachments;
DROP POLICY IF EXISTS "attachments_select_admin" ON lp_attachments;
DROP POLICY IF EXISTS "attachments_insert_own" ON lp_attachments;
DROP POLICY IF EXISTS "attachments_delete_own_not_approved" ON lp_attachments;

-- Learners can read their own attachments
CREATE POLICY "attachments_select_own"
ON lp_attachments FOR SELECT
TO authenticated
USING (auth.uid() = learner_id);

-- Admins can read all attachments
CREATE POLICY "attachments_select_admin"
ON lp_attachments FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Learners can insert their own attachments
CREATE POLICY "attachments_insert_own"
ON lp_attachments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = learner_id);

-- Learners can delete their own attachments, but not if linked to an approved task
CREATE POLICY "attachments_delete_own_not_approved"
ON lp_attachments FOR DELETE
TO authenticated
USING (
  auth.uid() = learner_id
  AND (
    progress_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM lp_progress
      WHERE lp_progress.id = lp_attachments.progress_id
      AND lp_progress.status = 'approved'
    )
  )
);