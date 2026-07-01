/*
# Seed AI Learning Paths and Steps

Inserts 4 learning paths and their ordered concept steps.
Matches the existing LEARNING_PATH_DEFS data from the frontend.

Paths:
- beginner: 7 concepts (Understand the Basics)
- builder: 10 concepts (Build AI-Powered Workflows)
- architect: 10 concepts (Design Production AI Systems)
- domain-builder: 11 concepts (Apply AI to Specialized Domains)
*/

DELETE FROM ai_learning_path_steps;
DELETE FROM ai_learning_paths;

INSERT INTO ai_learning_paths (slug, name, audience, description, difficulty, estimated_minutes)
VALUES
  (
    'beginner',
    'Understand the Basics',
    'Beginner',
    'No background required. Understand what these systems are, why they matter, and how the pieces fit together.',
    'Beginner',
    87
  ),
  (
    'builder',
    'Build AI-Powered Workflows',
    'Builder',
    'For developers ready to ship. Build your first RAG pipeline, wire up tool-calling agents, and handle memory.',
    'Intermediate',
    161
  ),
  (
    'architect',
    'Design Production AI Systems',
    'Architect',
    'For engineers designing systems at scale. Covers evaluation, observability, orchestration, and production hardening.',
    'Advanced',
    167
  ),
  (
    'domain-builder',
    'Apply AI to Specialized Domains',
    'Domain Platform Builder',
    'For teams building domain intelligence platforms using the AI DNA Framework.',
    'Advanced',
    183
  );

INSERT INTO ai_learning_path_steps (path_slug, concept_slug, step_order, lesson_title, estimated_minutes)
VALUES
  -- Beginner path (7 concepts)
  ('beginner', 'llms',               1, 'What is an LLM?',         20),
  ('beginner', 'tokens',             2, 'How Tokens Work',          10),
  ('beginner', 'context-windows',    3, 'Context Windows Explained',12),
  ('beginner', 'embeddings',         4, 'Introduction to Embeddings',15),
  ('beginner', 'prompt-engineering', 5, 'Prompt Engineering Basics',18),
  ('beginner', 'chunking',           6, 'Chunking Documents',       12),
  ('beginner', 'rag',                7, 'Intro to RAG',             20),

  -- Builder path (10 concepts)
  ('builder', 'llms',               1,  'LLMs as a Foundation',    20),
  ('builder', 'prompt-engineering', 2,  'Engineering Prompts',     18),
  ('builder', 'embeddings',         3,  'Embeddings Deep Dive',    15),
  ('builder', 'chunking',           4,  'Chunking Strategies',     12),
  ('builder', 'vector-databases',   5,  'Vector Databases',        15),
  ('builder', 'search',             6,  'Retrieval & Search',      14),
  ('builder', 'rag',                7,  'Building RAG Pipelines',  20),
  ('builder', 'tool-calling',       8,  'Tool Calling',            15),
  ('builder', 'agents',             9,  'Building Agents',         22),
  ('builder', 'memory',             10, 'Agent Memory',            14),

  -- Architect path (10 concepts)
  ('architect', 'rag',                1,  'RAG Architecture',          20),
  ('architect', 'agents',             2,  'Agent Architecture',        22),
  ('architect', 'planning',           3,  'Agent Planning',            15),
  ('architect', 'multi-agent-systems',4,  'Multi-Agent Systems',       18),
  ('architect', 'evaluation',         5,  'Evaluation Frameworks',     20),
  ('architect', 'guardrails',         6,  'Safety & Guardrails',       14),
  ('architect', 'orchestration',      7,  'Workflow Orchestration',    16),
  ('architect', 'monitoring',         8,  'Production Monitoring',     14),
  ('architect', 'security',           9,  'AI Security',               15),
  ('architect', 'deployment',         10, 'Deployment Patterns',       14),

  -- Domain Builder path (11 concepts)
  ('domain-builder', 'llms',               1,  'LLMs for Domain Work',     20),
  ('domain-builder', 'embeddings',         2,  'Domain Embeddings',        15),
  ('domain-builder', 'knowledge-graphs',   3,  'Domain Knowledge Graphs',  14),
  ('domain-builder', 'chunking',           4,  'Domain-Aware Chunking',    12),
  ('domain-builder', 'vector-databases',   5,  'Vector Storage',           15),
  ('domain-builder', 'rag',                6,  'Domain RAG',               20),
  ('domain-builder', 'agents',             7,  'Domain Agents',            22),
  ('domain-builder', 'mcp',               8,  'MCP for Domain Tools',     12),
  ('domain-builder', 'tool-calling',       9,  'Domain Tool Calling',      15),
  ('domain-builder', 'orchestration',     10,  'Platform Orchestration',   16),
  ('domain-builder', 'deployment',        11,  'Platform Deployment',      14);
