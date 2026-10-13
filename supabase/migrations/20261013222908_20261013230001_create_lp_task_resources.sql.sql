/*
# Learning resources for tasks

## Overview
Each task can have learning resources (docs, videos, concepts, tutorials) shown as
link chips underneath the task in the learner portal. Admins can add, edit, reorder
and remove them.

## Schema
- lp_task_resources: id (uuid), task_id (fk→lp_tasks), title (text), url (text),
  kind (enum: doc|video|concept|tutorial), sort_order (int)

## RLS
- SELECT: any authenticated user (learners + admins)
- INSERT/UPDATE/DELETE: admin only (via app_metadata.role = 'admin')

## Seeds
Resources matched to tasks by title. Internal concept pages are linked where
topically relevant:
  - "Session with Herb: what agents and Skills are" → /concepts/agents
  - "Session with Herb: how agents plan, call tools and loop" → /concepts/agents, /concepts/tool-calling, /concepts/planning
  - "Build the difficulty agent" → /concepts/agents, /concepts/evaluation
  - "Write your first Agent Skill" → /concepts/mcp
  - "Get a Claude API key from Herb" → /concepts/apis
  - "Set up the Supabase database" → /concepts/vector-databases
  - "Design tables for players, games and game events" → /concepts/vector-databases
*/

-- ── Enum ──
DO $$ BEGIN
  CREATE TYPE lp_resource_kind AS ENUM ('doc', 'video', 'concept', 'tutorial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Table ──
CREATE TABLE IF NOT EXISTS lp_task_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES lp_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  kind lp_resource_kind NOT NULL DEFAULT 'doc',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_lp_task_resources_task_id ON lp_task_resources(task_id);
CREATE INDEX IF NOT EXISTS idx_lp_task_resources_sort ON lp_task_resources(task_id, sort_order);

-- ── RLS ──
ALTER TABLE lp_task_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_task_resources_select" ON lp_task_resources;
CREATE POLICY "lp_task_resources_select" ON lp_task_resources FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lp_task_resources_admin_insert" ON lp_task_resources;
CREATE POLICY "lp_task_resources_admin_insert" ON lp_task_resources FOR INSERT
  TO authenticated WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "lp_task_resources_admin_update" ON lp_task_resources;
CREATE POLICY "lp_task_resources_admin_update" ON lp_task_resources FOR UPDATE
  TO authenticated USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "lp_task_resources_admin_delete" ON lp_task_resources;
CREATE POLICY "lp_task_resources_admin_delete" ON lp_task_resources FOR DELETE
  TO authenticated USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── Seed resources ──
INSERT INTO lp_task_resources (task_id, title, url, kind, sort_order)
SELECT tm.id, v.res_title, v.res_url, v.res_kind::lp_resource_kind, v.res_sort
FROM (VALUES
  ('Set up GitHub, VS Code, Claude Code and your Claude Project with the brief', 'GitHub: Getting started', 'https://docs.github.com/en/get-started', 'doc', 1),
  ('Set up GitHub, VS Code, Claude Code and your Claude Project with the brief', 'VS Code docs', 'https://code.visualstudio.com/docs', 'doc', 2),
  ('Set up GitHub, VS Code, Claude Code and your Claude Project with the brief', 'Claude Code overview', 'https://code.claude.com/docs/en/overview', 'doc', 3),
  ('Set up GitHub, VS Code, Claude Code and your Claude Project with the brief', 'Claude Projects', 'https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects', 'doc', 4),

  ('Session with Herb: what agents and Skills are', 'Building effective agents (Anthropic)', 'https://www.anthropic.com/engineering/building-effective-agents', 'doc', 1),
  ('Session with Herb: what agents and Skills are', 'Agent Skills overview', 'https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview', 'doc', 2),
  ('Session with Herb: what agents and Skills are', 'AI Agents concept page', '/concepts/agents', 'concept', 3),

  ('Install Node.js and Python (with Pandas); confirm both run', 'Learn Node.js', 'https://nodejs.org/en/learn', 'tutorial', 1),
  ('Install Node.js and Python (with Pandas); confirm both run', 'Python tutorial', 'https://docs.python.org/3/tutorial/', 'tutorial', 2),
  ('Install Node.js and Python (with Pandas); confirm both run', 'Pandas getting started', 'https://pandas.pydata.org/docs/getting_started/index.html', 'tutorial', 3),

  ('Create free Supabase and Vercel accounts', 'Supabase docs', 'https://supabase.com/docs', 'doc', 1),
  ('Create free Supabase and Vercel accounts', 'Vercel docs', 'https://vercel.com/docs', 'doc', 2),

  ('Get a Claude API key from Herb (Clarent account, with a spending limit); store it in a .env file, never in GitHub', 'Claude Platform docs', 'https://platform.claude.com/docs', 'doc', 1),
  ('Get a Claude API key from Herb (Clarent account, with a spending limit); store it in a .env file, never in GitHub', 'APIs concept page', '/concepts/apis', 'concept', 2),

  ('Build the first game with large, senior-friendly controls', 'Learn React', 'https://react.dev/learn', 'tutorial', 1),

  ('Deploy it to a test URL', 'Vercel docs', 'https://vercel.com/docs', 'doc', 1),

  ('Design tables for players, games and game events', 'Supabase docs', 'https://supabase.com/docs', 'doc', 1),
  ('Design tables for players, games and game events', 'Vector Databases concept page', '/concepts/vector-databases', 'concept', 2),

  ('Set up the Supabase database', 'Supabase docs', 'https://supabase.com/docs', 'doc', 1),

  ('Write 3 SQL queries: games per day, win rate, average session length', 'Supabase docs', 'https://supabase.com/docs', 'doc', 1),

  ('Session with Herb: how agents plan, call tools and loop', 'Building effective agents (Anthropic)', 'https://www.anthropic.com/engineering/building-effective-agents', 'doc', 1),
  ('Session with Herb: how agents plan, call tools and loop', 'Claude Agent SDK overview', 'https://code.claude.com/docs/en/agent-sdk/overview', 'doc', 2),
  ('Session with Herb: how agents plan, call tools and loop', 'Agents concept page', '/concepts/agents', 'concept', 3),
  ('Session with Herb: how agents plan, call tools and loop', 'Tool Calling concept page', '/concepts/tool-calling', 'concept', 4),
  ('Session with Herb: how agents plan, call tools and loop', 'Planning concept page', '/concepts/planning', 'concept', 5),

  ('Build the difficulty agent (target 70–80% win rate per player)', 'Building effective agents (Anthropic)', 'https://www.anthropic.com/engineering/building-effective-agents', 'doc', 1),
  ('Build the difficulty agent (target 70–80% win rate per player)', 'Claude Agent SDK overview', 'https://code.claude.com/docs/en/agent-sdk/overview', 'doc', 2),
  ('Build the difficulty agent (target 70–80% win rate per player)', 'Agents concept page', '/concepts/agents', 'concept', 3),
  ('Build the difficulty agent (target 70–80% win rate per player)', 'Evaluation concept page', '/concepts/evaluation', 'concept', 4),

  ('Write your first Agent Skill (e.g., generating trivia or word puzzles)', 'Agent Skills overview', 'https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview', 'doc', 1),
  ('Write your first Agent Skill (e.g., generating trivia or word puzzles)', 'Skills in the Agent SDK', 'https://code.claude.com/docs/en/agent-sdk/skills', 'doc', 2),
  ('Write your first Agent Skill (e.g., generating trivia or word puzzles)', 'MCP concept page', '/concepts/mcp', 'concept', 3),

  ('Build the Power BI dashboard: daily players, retention, session length, win rates', 'Power BI documentation', 'https://learn.microsoft.com/en-us/power-bi/', 'doc', 1)
) AS v(task_title, res_title, res_url, res_kind, res_sort)
JOIN lp_tasks tm ON tm.title = v.task_title
ON CONFLICT DO NOTHING;