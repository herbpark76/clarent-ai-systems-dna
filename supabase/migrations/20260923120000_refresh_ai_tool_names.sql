/*
# Refresh dated AI tool names

Replaces version-specific model names (GPT-4o, Claude 3.5, Gemini 1.5, Llama 3,
text-embedding-ada-002) with durable family names so the concept panels don't
go stale as new model versions ship. Safe to run more than once.
*/

UPDATE ai_tools SET name = 'GPT (OpenAI)'        WHERE slug = 'gpt-4o';
UPDATE ai_tools SET name = 'Claude (Anthropic)'  WHERE slug = 'claude-35';
UPDATE ai_tools SET name = 'Gemini (Google)'     WHERE slug = 'gemini-15';
UPDATE ai_tools SET name = 'Llama (Meta)'        WHERE slug = 'llama-3';
UPDATE ai_tools SET name = 'OpenAI Embeddings'   WHERE slug = 'text-embedding-ada-002';
UPDATE ai_tools SET name = 'MCP spec'            WHERE slug = 'anthropic-mcp';
