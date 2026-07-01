/*
# Create ai_systems_waitlist table

## Summary
Creates a public waitlist/signup table for the AI Systems DNA platform.
Visitors can register their name, email, and learning interest to receive updates.
No authentication required — the table is intentionally public/shared (single-tenant, no sign-in).

## New Tables

### ai_systems_waitlist
- `id` (uuid, primary key) — auto-generated unique identifier
- `name` (text) — optional display name of the person signing up
- `email` (text, not null) — required email address
- `learning_interest` (text) — optional field indicating the user's area of interest
- `created_at` (timestamptz) — timestamp of when the record was created, defaults to now()

## Security
- RLS enabled on `ai_systems_waitlist`.
- Anon + authenticated users can INSERT (public signup form).
- No SELECT/UPDATE/DELETE policies for external callers — data is write-only from the public side.
*/

CREATE TABLE IF NOT EXISTS ai_systems_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL,
  learning_interest text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_systems_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_waitlist" ON ai_systems_waitlist;
CREATE POLICY "anon_insert_waitlist" ON ai_systems_waitlist FOR INSERT
TO anon, authenticated WITH CHECK (true);
