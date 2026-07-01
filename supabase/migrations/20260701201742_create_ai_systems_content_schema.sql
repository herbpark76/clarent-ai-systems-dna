/*
# AI Systems DNA Content Schema

Creates the core content tables for the AI Systems DNA learning platform.
This is a single-tenant, public-read content system — no authentication required.

1. New Tables
   - ai_concepts: Core AI concept nodes with descriptions, positions, learning metadata
   - ai_concept_relationships: Directed relationships (edges, prerequisites, unlocks, highlight_group)
   - ai_learning_paths: Structured learning paths (beginner / builder / architect / domain-builder)
   - ai_learning_path_steps: Ordered concept steps within each learning path
   - ai_tools: AI tools and technologies referenced across concepts
   - ai_concept_tools: Many-to-many mapping between concepts and tools

2. Security
   - RLS enabled on all tables
   - Public SELECT for anon + authenticated (content is intentionally public)
   - No INSERT/UPDATE/DELETE policies — content is managed via Supabase dashboard or migrations

3. Notes
   - All tables use UUID primary keys
   - Slug columns are unique and serve as stable identifiers for frontend references
   - JSONB columns (common_mistakes, build_checklist) store arrays of strings
*/

-- ── ai_concepts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_concepts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text UNIQUE NOT NULL,
  name                  text NOT NULL,
  category              text NOT NULL,
  short_description     text,
  overview              text,
  why_it_matters        text,
  why_should_i_care     text,
  common_mistakes       jsonb DEFAULT '[]',
  build_checklist       jsonb DEFAULT '[]',
  difficulty            text,
  overview_minutes      int,
  deep_dive_minutes     int,
  implementation_minutes int,
  x_position            numeric,
  y_position            numeric,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE ai_concepts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_concepts" ON ai_concepts;
CREATE POLICY "anon_select_ai_concepts" ON ai_concepts FOR SELECT
  TO anon, authenticated USING (true);

-- ── ai_concept_relationships ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_concept_relationships (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_concept_slug  text NOT NULL,
  target_concept_slug  text NOT NULL,
  relationship_type    text NOT NULL,
  description          text,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE ai_concept_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_concept_relationships" ON ai_concept_relationships;
CREATE POLICY "anon_select_ai_concept_relationships" ON ai_concept_relationships FOR SELECT
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ai_concept_rels_source
  ON ai_concept_relationships(source_concept_slug);
CREATE INDEX IF NOT EXISTS idx_ai_concept_rels_target
  ON ai_concept_relationships(target_concept_slug);
CREATE INDEX IF NOT EXISTS idx_ai_concept_rels_type
  ON ai_concept_relationships(relationship_type);

-- ── ai_learning_paths ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_learning_paths (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  name              text NOT NULL,
  audience          text,
  description       text,
  difficulty        text,
  estimated_minutes int,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE ai_learning_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_learning_paths" ON ai_learning_paths;
CREATE POLICY "anon_select_ai_learning_paths" ON ai_learning_paths FOR SELECT
  TO anon, authenticated USING (true);

-- ── ai_learning_path_steps ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_learning_path_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_slug         text NOT NULL,
  concept_slug      text NOT NULL,
  step_order        int NOT NULL,
  lesson_title      text,
  estimated_minutes int,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE ai_learning_path_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_learning_path_steps" ON ai_learning_path_steps;
CREATE POLICY "anon_select_ai_learning_path_steps" ON ai_learning_path_steps FOR SELECT
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ai_path_steps_path_slug
  ON ai_learning_path_steps(path_slug);
CREATE INDEX IF NOT EXISTS idx_ai_path_steps_order
  ON ai_learning_path_steps(path_slug, step_order);

-- ── ai_tools ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tools (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text UNIQUE NOT NULL,
  name             text NOT NULL,
  category         text,
  short_description text,
  website_url      text,
  open_source      boolean DEFAULT false,
  pricing_model    text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE ai_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_tools" ON ai_tools;
CREATE POLICY "anon_select_ai_tools" ON ai_tools FOR SELECT
  TO anon, authenticated USING (true);

-- ── ai_concept_tools ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_concept_tools (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_slug      text NOT NULL,
  tool_slug         text NOT NULL,
  relationship_type text,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE ai_concept_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_concept_tools" ON ai_concept_tools;
CREATE POLICY "anon_select_ai_concept_tools" ON ai_concept_tools FOR SELECT
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ai_concept_tools_concept
  ON ai_concept_tools(concept_slug);
CREATE INDEX IF NOT EXISTS idx_ai_concept_tools_tool
  ON ai_concept_tools(tool_slug);
