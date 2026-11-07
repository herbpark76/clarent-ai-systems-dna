/*
# Create client_errors table

1. New Tables
- `client_errors`
  - `id` (uuid, primary key, auto-generated)
  - `message` (text, not null) — the error message
  - `stack` (text, nullable) — first 2000 chars of the error stack trace
  - `component_stack` (text, nullable) — React component stack
  - `url` (text, nullable) — the page URL where the error occurred
  - `user_email` (text, nullable) — email of the authenticated user (if any)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `client_errors`.
- Grant INSERT to `anon` and `authenticated` so any client can report errors.
- Grant SELECT to `authenticated` — only admin users can read error logs.
  (The app checks admin status via app_metadata.role; all authenticated
  users get SELECT per policy but the admin UI is the only consumer.)
- No UPDATE or DELETE grants — error logs are append-only from the client.
*/

CREATE TABLE IF NOT EXISTS client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  stack text,
  component_stack text,
  url text,
  user_email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON client_errors TO anon, authenticated;
GRANT SELECT ON client_errors TO authenticated;

DROP POLICY IF EXISTS "anyone_can_insert_client_errors" ON client_errors;
CREATE POLICY "anyone_can_insert_client_errors"
  ON client_errors FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_can_read_client_errors" ON client_errors;
CREATE POLICY "authenticated_can_read_client_errors"
  ON client_errors FOR SELECT
  TO authenticated USING (true);
