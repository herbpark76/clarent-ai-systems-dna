/*
# Security hardening: role-based access control + learner profiles

## Changes

### 1. Set app_metadata roles and user_metadata full_name for both users
- hpark76@gmail.com: app_metadata.role = 'admin', user_metadata.full_name = 'Herb Park'
- herbpark@hotmail.com: app_metadata.role = 'trainee', user_metadata.full_name = 'John Doe'

app_metadata is server-only and user-immutable — users cannot change their own role.

### 2. Create lp_profiles table
A lightweight profiles table so the admin can see learner names instead of UUIDs.
- id (uuid PK, FK → auth.users, cascade delete)
- full_name (text)
- created_at (timestamptz default now())

RLS:
- Each authenticated user can SELECT their own row.
- Each authenticated user can INSERT/UPDATE only their own row.
- Admins (app_metadata.role = 'admin') can SELECT all rows.

### 3. Replace signal_desk_entries RLS to use app_metadata.role = 'admin'
The old policies checked `signal_desk_admins` table by email. The new policies
check `auth.jwt() ->> 'role' = 'admin'` directly from the JWT's app_metadata.
- anon SELECT: only published entries (unchanged).
- authenticated SELECT (all entries incl drafts): only if role = 'admin'.
- INSERT/UPDATE/DELETE: only if role = 'admin'.

The old signal_desk_admins table is kept for backward compat but no longer
referenced by policies. We drop the old email-based policies and replace them.

### 4. Lock ai_systems_waitlist from anon/anon SELECT
Currently the waitlist has only an INSERT policy for anon+authenticated.
There is no SELECT policy, but the default GRANT includes SELECT for anon.
We REVOKE SELECT from anon so anonymous users cannot read the waitlist.
*/

-- ── 1. Set roles and names ──────────────────────────────
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"full_name": "Herb Park"}'::jsonb
WHERE email = 'hpark76@gmail.com';

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "trainee"}'::jsonb,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"full_name": "John Doe"}'::jsonb
WHERE email = 'herbpark@hotmail.com';

-- ── 2. lp_profiles table ───────────────────────────────
CREATE TABLE IF NOT EXISTS lp_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lp_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_profiles_select_own" ON lp_profiles;
CREATE POLICY "lp_profiles_select_own"
  ON lp_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR COALESCE(auth.jwt() ->> 'role', '') = 'admin');

DROP POLICY IF EXISTS "lp_profiles_insert_own" ON lp_profiles;
CREATE POLICY "lp_profiles_insert_own"
  ON lp_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "lp_profiles_update_own" ON lp_profiles;
CREATE POLICY "lp_profiles_update_own"
  ON lp_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── 3. Replace signal_desk_entries RLS ─────────────────
-- Drop old email-based policies
DROP POLICY IF EXISTS "public_read_published_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "admin_read_all_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "admin_insert_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "admin_update_entries" ON signal_desk_entries;
DROP POLICY IF EXISTS "admin_delete_entries" ON signal_desk_entries;

-- Public (anon) can read only published entries
CREATE POLICY "public_read_published_entries"
  ON signal_desk_entries FOR SELECT
  TO anon
  USING (status = 'published');

-- Authenticated non-admin users can also read published entries
CREATE POLICY "authenticated_read_published_entries"
  ON signal_desk_entries FOR SELECT
  TO authenticated
  USING (status = 'published' OR COALESCE(auth.jwt() ->> 'role', '') = 'admin');

-- Only admin can insert
CREATE POLICY "admin_insert_entries"
  ON signal_desk_entries FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE(auth.jwt() ->> 'role', '') = 'admin');

-- Only admin can update
CREATE POLICY "admin_update_entries"
  ON signal_desk_entries FOR UPDATE
  TO authenticated
  USING (COALESCE(auth.jwt() ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE(auth.jwt() ->> 'role', '') = 'admin');

-- Only admin can delete
CREATE POLICY "admin_delete_entries"
  ON signal_desk_entries FOR DELETE
  TO authenticated
  USING (COALESCE(auth.jwt() ->> 'role', '') = 'admin');

-- ── 4. Lock ai_systems_waitlist from anon SELECT ───────
-- The table currently has no SELECT policy, but the default GRANT
-- gives anon SELECT. Revoke it so anonymous users cannot read the waitlist.
REVOKE SELECT ON ai_systems_waitlist FROM anon;

-- ── 5. Update lp_is_admin to also check role from JWT ───
-- (already checks auth.jwt() ->> 'role' = 'admin', which is correct)
-- No changes needed to lp_is_admin().

-- ── 6. Insert lp_profiles rows for both users ──────────
INSERT INTO lp_profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data ->> 'full_name', email)
FROM auth.users
WHERE email IN ('hpark76@gmail.com', 'herbpark@hotmail.com')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
