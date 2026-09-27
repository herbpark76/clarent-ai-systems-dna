/*
# Seed learner portal with sample track and set admin role

## Changes
1. Insert a sample track "AI Systems Foundations" with 4 weeks and tasks.
2. Set the existing admin user (hpark76@gmail.com) raw_app_meta_data.role = 'admin'
   so lp_is_admin() returns true for them.
*/

-- ── Set admin role on the existing admin user ──
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'hpark76@gmail.com';

-- ── Insert sample track ──
INSERT INTO lp_tracks (id, title, description)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'AI Systems Foundations',
  'A 4-week onboarding track covering the core concepts of modern AI systems — from LLMs and RAG to agents, evaluation, and production deployment.'
)
ON CONFLICT (id) DO NOTHING;

-- ── Insert weeks ──
INSERT INTO lp_weeks (id, track_id, week_number, title, goal, start_date, end_date) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, 'Foundations: LLMs & Prompting', 'Understand how large language models work and write effective prompts.', '2026-09-29', '2026-10-05'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 2, 'RAG & Knowledge Retrieval', 'Build a retrieval-augmented generation pipeline for domain-specific data.', '2026-10-06', '2026-10-12'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 3, 'Agents & Tool Calling', 'Create AI agents that call external tools and APIs autonomously.', '2026-10-13', '2026-10-19'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 4, 'Evaluation & Production', 'Evaluate AI system quality and deploy safely to production.', '2026-10-20', '2026-10-26')
ON CONFLICT (id) DO NOTHING;

-- ── Insert tasks for each week ──
-- Week 1
INSERT INTO lp_tasks (id, week_id, title, description, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Read: What is an LLM?', 'Read the concept page on Large Language Models and complete the quiz.', 1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Prompt engineering exercise', 'Write 5 prompts for different task types (summarize, extract, classify, generate, reason). Document what works and what doesn''t.', 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Read: How Tool Calling Works', 'Read the deep dive on tool calling and answer the reflection questions.', 3),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Week 1 reflection', 'Write a 200-word reflection: what surprised you about how LLMs work?', 4)
ON CONFLICT (id) DO NOTHING;

-- Week 2
INSERT INTO lp_tasks (id, week_id, title, description, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Read: What is RAG?', 'Read the concept page on Retrieval-Augmented Generation.', 1),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'Read: RAG for Vertical Data', 'Read the deep dive on RAG for domain-specific data.', 2),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', 'Build a mini RAG pipeline', 'Use the Labs tutorial to build a simple RAG pipeline with a small document set.', 3),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000002', 'Read: Vector DBs vs Knowledge Graphs', 'Read the comparison article and write 3 key takeaways.', 4)
ON CONFLICT (id) DO NOTHING;

-- Week 3
INSERT INTO lp_tasks (id, week_id, title, description, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000003', 'Read: What are AI Agents?', 'Read the concept page on AI agents.', 1),
  ('c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000003', 'Read: MCP for Domain Tools', 'Read the deep dive on Model Context Protocol.', 2),
  ('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000003', 'Build a tool-calling agent', 'Follow the Labs tutorial to create an agent that calls a weather API tool.', 3),
  ('c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000003', 'Week 3 reflection', 'What are the key risks when giving agents tool access? List 3.', 4)
ON CONFLICT (id) DO NOTHING;

-- Week 4
INSERT INTO lp_tasks (id, week_id, title, description, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000004', 'Read: How to Evaluate AI Systems', 'Read the deep dive on evaluation methods.', 1),
  ('c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000004', 'Design an eval rubric', 'Create a 5-criteria rubric for evaluating an AI assistant in your domain.', 2),
  ('c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000004', 'Read: Building a Domain Intelligence Platform', 'Read the capstone article and identify 3 patterns you would apply.', 3),
  ('c0000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000004', 'Final project: Pitch an AI system', 'Write a 1-page pitch for an AI system in your domain: problem, architecture, risks, and success metrics.', 4)
ON CONFLICT (id) DO NOTHING;
