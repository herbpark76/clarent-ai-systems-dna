/*
# Signal Desk — entries table

## Purpose
Stores AI news items turned into structured learning content by the
`process-newsletter` edge function.  Each entry is classified by type and
system layer, enriched with a business angle, and saved as a draft for
admin review before publishing.

## New Tables
- `signal_desk_entries`
  - `id` uuid PK (default gen_random_uuid)
  - `created_at` timestamptz (default now)
  - `type` enum: news | tutorial | use_case | tool | model_release | risk
  - `system_layer` enum: model | agent | tools_connectors | data_context | evals | security_governance | interface
  - `title` text NOT NULL
  - `summary` text NOT NULL  (2–4 sentences, original wording)
  - `why_it_matters` text
  - `how_its_built` text  (1–3 sentences on what the story shows about how AI systems are built or break)
  - `business_angle` text  (applies to finance/tax/ERP teams)
  - `steps` jsonb  (array of { text, prompt? }, tutorials only)
  - `tags` text[]  default '{}'
  - `role_tags` text[]  default '{}'  (finance, legal, ops, marketing, IT)
  - `model_name` text  (nullable, model_release)
  - `vendor` text  (nullable, model_release)
  - `benchmark_score` text  (nullable, model_release)
  - `price_input` text  (nullable, model_release)
  - `price_output` text  (nullable, model_release)
  - `source_name` text
  - `source_date` date
  - `source_url` text
  - `status` text NOT NULL DEFAULT 'draft'  (draft | published)

## New Enums
- `signal_desk_entry_type`
- `signal_desk_system_layer`

## Security
- RLS enabled on `signal_desk_entries`.
- All CRUD scoped to `authenticated` only — admin-only access.
  The admin page uses Supabase auth; only the owner's account can sign in.
  No anon access — the public site does not read this table directly.
- 4 policies: select, insert, update, delete — all `TO authenticated`.

## Indexes
- `idx_signal_desk_entries_status` on `status` — review queue filtering
- `idx_signal_desk_entries_created_at` on `created_at DESC` — newest first
- `idx_signal_desk_entries_system_layer` on `system_layer`
*/

-- ── Enums ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE signal_desk_entry_type AS ENUM (
    'news', 'tutorial', 'use_case', 'tool', 'model_release', 'risk'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE signal_desk_system_layer AS ENUM (
    'model', 'agent', 'tools_connectors', 'data_context',
    'evals', 'security_governance', 'interface'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_desk_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  type          signal_desk_entry_type NOT NULL,
  system_layer  signal_desk_system_layer NOT NULL,

  title         text NOT NULL,
  summary       text NOT NULL,
  why_it_matters text,
  how_its_built text,
  business_angle text,

  steps         jsonb DEFAULT '[]'::jsonb,
  tags          text[] NOT NULL DEFAULT '{}',
  role_tags     text[] NOT NULL DEFAULT '{}',

  model_name      text,
  vendor          text,
  benchmark_score text,
  price_input     text,
  price_output    text,

  source_name    text,
  source_date    date,
  source_url     text,

  status        text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published'))
);

-- ── Indexes ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_signal_desk_entries_status
  ON signal_desk_entries (status);
CREATE INDEX IF NOT EXISTS idx_signal_desk_entries_created_at
  ON signal_desk_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_desk_entries_system_layer
  ON signal_desk_entries (system_layer);

-- ── RLS ────────────────────────────────────────────────
ALTER TABLE signal_desk_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_signal_desk_entries" ON signal_desk_entries;
CREATE POLICY "select_own_signal_desk_entries"
  ON signal_desk_entries FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_signal_desk_entries" ON signal_desk_entries;
CREATE POLICY "insert_own_signal_desk_entries"
  ON signal_desk_entries FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_signal_desk_entries" ON signal_desk_entries;
CREATE POLICY "update_own_signal_desk_entries"
  ON signal_desk_entries FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_signal_desk_entries" ON signal_desk_entries;
CREATE POLICY "delete_own_signal_desk_entries"
  ON signal_desk_entries FOR DELETE
  TO authenticated USING (true);
