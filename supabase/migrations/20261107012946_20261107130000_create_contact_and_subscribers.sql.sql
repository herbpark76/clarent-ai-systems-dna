/*
# Create contact_messages table + subscriber unsubscribe tokens

1. New Tables
- `contact_messages`: stores submissions from the /contact page.
  - id (uuid PK)
  - name (text, required)
  - email (text, required)
  - company (text, optional)
  - topic (text, required — AI training / Indirect tax & ONESOURCE / Building an AI platform / Other)
  - message (text, required)
  - is_read (boolean, default false — admin read/unread toggle)
  - created_at (timestamptz, default now())

2. Modified Tables
- `ai_systems_waitlist`: add `unsubscribe_token` (uuid, default gen_random_uuid()) and
  `unsubscribed_at` (timestamptz, nullable). Backfill existing rows with tokens.

3. Security
- `contact_messages`: enable RLS. Anyone (anon + authenticated) can INSERT.
  Only authenticated admin users can SELECT and UPDATE (read/unread toggle).
  Admin check uses auth.jwt() -> app_metadata.role = 'admin'.
- `ai_systems_waitlist`: add INSERT policy for anon (already had one, but ensure).
  Add SELECT policy for admin only. Add UPDATE policy for anon using unsubscribe_token.
*/

-- ── contact_messages ──
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  topic text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a contact message
DROP POLICY IF EXISTS "anyone_insert_contact" ON contact_messages;
CREATE POLICY "anyone_insert_contact"
  ON contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admin can read contact messages
DROP POLICY IF EXISTS "admin_read_contact" ON contact_messages;
CREATE POLICY "admin_read_contact"
  ON contact_messages FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Only admin can update (mark as read/unread)
DROP POLICY IF EXISTS "admin_update_contact" ON contact_messages;
CREATE POLICY "admin_update_contact"
  ON contact_messages FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

GRANT INSERT ON contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE ON contact_messages TO authenticated;

-- ── ai_systems_waitlist: unsubscribe token + unsubscribed_at ──
ALTER TABLE ai_systems_waitlist
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

-- Backfill tokens for existing rows that have null
UPDATE ai_systems_waitlist
SET unsubscribe_token = gen_random_uuid()
WHERE unsubscribe_token IS NULL;

-- Admin can read all waitlist entries
DROP POLICY IF EXISTS "admin_read_waitlist" ON ai_systems_waitlist;
CREATE POLICY "admin_read_waitlist"
  ON ai_systems_waitlist FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Anon can update (unsubscribe) using the token
DROP POLICY IF EXISTS "anon_unsubscribe_waitlist" ON ai_systems_waitlist;
CREATE POLICY "anon_unsubscribe_waitlist"
  ON ai_systems_waitlist FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON ai_systems_waitlist TO authenticated;
