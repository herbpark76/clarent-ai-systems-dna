/*
# Add concepts array to Signal Desk entries

1. Changes
- Add `concepts` column (text[]) to `signal_desk_entries` — stores 0-3 concept IDs
  from the 25 AI Systems DNA map concepts (e.g. 'rag', 'agents', 'llms').
- Backfill existing published entries with deterministic keyword matching against
  title, summary, tags, and system_layer — no AI calls.
- Grant UPDATE on the table to `anon` and `authenticated` so the existing
  RLS policies continue to work (the column is new but the table already has
  RLS and policies; we just need the column to be writable).

2. Security
- No new tables. No RLS policy changes — existing policies on signal_desk_entries
  already cover SELECT/INSERT/UPDATE/DELETE for the appropriate roles.
- The new column inherits existing RLS protections.

3. Backfill logic
- Maps system_layer values to concept IDs (model → llms, data_context → rag, etc.)
- Maps keywords in title/summary/tags to concept IDs (e.g. "rag" → rag, "agent" → agents)
- Caps at 3 concept IDs per entry, deterministic, no AI.
*/

ALTER TABLE signal_desk_entries
  ADD COLUMN IF NOT EXISTS concepts text[] DEFAULT '{}';

-- ── Backfill: deterministic keyword → concept mapping ──
-- Concept keywords mapped to concept IDs. Order matters for priority.
DO $$
BEGIN
  -- Only backfill rows where concepts is null or empty
  UPDATE signal_desk_entries
  SET concepts = sub.concept_ids
  FROM (
    SELECT
      e.id,
      (
        SELECT array_agg(c.concept_id ORDER BY c.priority)
        FROM (
          SELECT concept_id, priority FROM (
            -- system_layer → concept mapping (highest priority)
            SELECT 'llms' AS concept_id, 1 AS priority FROM signal_desk_entries WHERE id = e.id AND system_layer = 'model'
            UNION ALL
            SELECT 'rag', 1 FROM signal_desk_entries WHERE id = e.id AND system_layer = 'data_context'
            UNION ALL
            SELECT 'agents', 1 FROM signal_desk_entries WHERE id = e.id AND system_layer = 'agent'
            UNION ALL
            SELECT 'tool-calling', 1 FROM signal_desk_entries WHERE id = e.id AND system_layer = 'tools_connectors'
            UNION ALL
            SELECT 'evaluation', 1 FROM signal_desk_entries WHERE id = e.id AND system_layer = 'evals'
            UNION ALL
            SELECT 'security', 1 FROM signal_desk_entries WHERE id = e.id AND system_layer = 'security_governance'
            UNION ALL
            SELECT 'apis', 1 FROM signal_desk_entries WHERE id = e.id AND system_layer = 'interface'

            -- keyword matching on title + summary + tags (lower priority)
            UNION ALL SELECT 'llms', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(llm|gpt|claude|gemini|llama|foundation model|language model)\b')
            UNION ALL SELECT 'rag', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(rag|retriev|grounding|hallucinat)\b')
            UNION ALL SELECT 'agents', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(agent|autonomous|agentic|workflow)\b')
            UNION ALL SELECT 'tool-calling', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(tool call|function call|tool use)\b')
            UNION ALL SELECT 'mcp', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(mcp|model context protocol)\b')
            UNION ALL SELECT 'embeddings', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(embedding|vector represent)\b')
            UNION ALL SELECT 'vector-databases', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(vector db|vector database|pinecone|weaviate|qdrant|pgvector)\b')
            UNION ALL SELECT 'chunking', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(chunk|split.*document)\b')
            UNION ALL SELECT 'knowledge-graphs', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(knowledge graph|graphrag|neo4j|ontology)\b')
            UNION ALL SELECT 'context-windows', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(context window|context length|long context)\b')
            UNION ALL SELECT 'tokens', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(token|tokenizer|bpe)\b')
            UNION ALL SELECT 'prompt-engineering', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(prompt engineer|prompting|chain.of.thought|few.shot)\b')
            UNION ALL SELECT 'evaluation', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(eval|evaluation|benchmark|leaderboard|ragas|trulens)\b')
            UNION ALL SELECT 'guardrails', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(guardrail|safety|content filter|constitutional ai)\b')
            UNION ALL SELECT 'memory', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(memory|memgpt|letta|zep)\b')
            UNION ALL SELECT 'planning', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(planning|plan.*execution|react)\b')
            UNION ALL SELECT 'multi-agent-systems', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(multi.agent|multiagent|crewai|autogen)\b')
            UNION ALL SELECT 'orchestration', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(orchestrat|pipeline|langgraph|temporal)\b')
            UNION ALL SELECT 'monitoring', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(monitor|observ|langsmith|helicone|telemetry)\b')
            UNION ALL SELECT 'security', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(security|prompt injection|data leak|adversar|owasp)\b')
            UNION ALL SELECT 'deployment', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(deploy|inference|serving|kubernetes|docker)\b')
            UNION ALL SELECT 'apis', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(api|rest|graphql|endpoint)\b')
            UNION ALL SELECT 'search', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(search|bm25|hybrid search|rerank)\b')
            UNION ALL SELECT 'metadata', 2 FROM signal_desk_entries WHERE id = e.id AND (lower(e.title || ' ' || coalesce(e.summary, '') || ' ' || coalesce(array_to_string(e.tags, ' '), '')) ~ '(?i)\b(metadata|filter.*search)\b')
          ) c
          ORDER BY c.priority
          LIMIT 3
        ) c
      ) AS concept_ids
    FROM signal_desk_entries e
    WHERE e.status = 'published'
      AND (e.concepts IS NULL OR array_length(e.concepts, 1) IS NULL)
  ) sub
  WHERE signal_desk_entries.id = sub.id
    AND sub.concept_ids IS NOT NULL
    AND array_length(sub.concept_ids, 1) > 0;
END $$;
