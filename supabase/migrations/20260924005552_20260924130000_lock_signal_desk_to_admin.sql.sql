/*
# Lock Signal Desk to a single admin + public read of published entries

## Purpose
Restrict all write operations on `signal_desk_entries` to a single admin user
(hpark76@gmail.com) via an `admins` table, while allowing the public (anon role)
to read only published entries.

## New Tables
- `signal_desk_admins`
  - `email` text PRIMARY KEY — the email address allowed admin access
  - `created_at` timestamptz DEFAULT now()

## Seed
- Inserts `hpark76@gmail.com` as the sole admin.

## Security Changes
- RLS enabled on `signal_desk_admins` (admin-only read; no public access).
  - SELECT: authenticated users can check if they are an admin (needed for
    the frontend auth gate and for RLS subqueries via `auth.jwt() ->> 'email'`).
    Actually, RLS policies run as the current user, and the subquery against
    `signal_desk_admins` in the entries policies needs to succeed for the
    authenticated admin. We allow `authenticated` SELECT so the subquery works.
- `signal_desk_entries` policies replaced:
  - **anon SELECT**: only rows where `status = 'published'` (public pages).
  - **authenticated SELECT (drafts)**: only if the caller's email exists in
    `signal_desk_admins`. Checks `auth.jwt() ->> 'email'` against the table.
  - **INSERT / UPDATE / DELETE**: only if the caller's email is in
    `signal_desk_admins`.
- All old "any authenticated user" policies are dropped.

## How the admin check works
The policies use:
  `EXISTS (SELECT 1 FROM signal_desk_admins WHERE email = auth.jwt() ->> 'email')`
This reads the email from the JWT's `raw_user_meta_data` (or any claim
containing `email`). Supabase includes `email` in the JWT, so
`auth.jwt() ->> 'email'` resolves to the signed-in user's email.
The admins table is the single source of truth — to add or remove an admin,
just insert/delete a row. No user IDs are hardcoded.
*/

-- ── Admins table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_desk_admins (
  email       text PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE signal_desk_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_signal_desk_admins" ON signal_desk_admins;
CREATE POLICY "select_signal_desk_admins"
  ON signal_desk_admins FOR SELECT
  TO authenticated USING (true);

-- Seed the single admin
INSERT INTO signal_desk_admins (email)
VALUES ('hpark76@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- ── Replace entries policies ───────────────────────────
-- Drop ALL old policies on signal_desk_entries
DROP POLICY IF EXISTS "select_own_signal_desk_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "insert_own_signal_desk_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "update_own_signal_desk_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "delete_own_signal_desk_entries" ON signal_desk_entries;

-- Public can read only published entries
DROP POLICY IF EXISTS "public_read_published_entries" ON signal_desk_entries;
CREATE POLICY "public_read_published_entries"
  ON signal_desk_entries FOR SELECT
  TO anon
  USING (status = 'published');

-- Authenticated admin can read ALL entries (including drafts)
DROP POLICY IF EXISTS "admin_read_all_entries" ON signal_desk_entries;
CREATE POLICY "admin_read_all_entries"
  ON signal_desk_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM signal_desk_admins
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Admin can insert
DROP POLICY IF EXISTS "admin_insert_entries" ON signal_desk_entries;
CREATE POLICY "admin_insert_entries"
  ON signal_desk_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM signal_desk_admins
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Admin can update
DROP POLICY IF EXISTS "admin_update_entries" ON signal_desk_entries;
CREATE POLICY "admin_update_entries"
  ON signal_desk_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM signal_desk_admins
      WHERE email = auth.jwt() ->> 'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM signal_desk_admins
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Admin can delete
DROP POLICY IF EXISTS "admin_delete_entries" ON signal_desk_entries;
CREATE POLICY "admin_delete_entries"
  ON signal_desk_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM signal_desk_admins
      WHERE email = auth.jwt() ->> 'email'
    )
  );
