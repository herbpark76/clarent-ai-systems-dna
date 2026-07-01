/*
# Seed AI Tools and Concept-Tool Mappings

Inserts the key AI tools referenced across concepts, then maps each concept
to its related tools via ai_concept_tools.
*/

DELETE FROM ai_concept_tools;
DELETE FROM ai_tools;

INSERT INTO ai_tools (slug, name, category, open_source, pricing_model) VALUES
  -- LLM Providers
  ('gpt-4o',        'GPT-4o',         'llm-provider',   false, 'paid'),
  ('claude-35',     'Claude 3.5',     'llm-provider',   false, 'paid'),
  ('gemini-15',     'Gemini 1.5',     'llm-provider',   false, 'paid'),
  ('llama-3',       'Llama 3',        'llm-provider',   true,  'free'),
  ('mistral',       'Mistral',        'llm-provider',   true,  'freemium'),
  -- Tokenizers
  ('tiktoken',      'tiktoken',       'tokenizer',      true,  'free'),
  ('sentencepiece', 'SentencePiece',  'tokenizer',      true,  'free'),
  -- Embedding Models
  ('text-embedding-ada-002', 'text-embedding-ada-002', 'embedding-model', false, 'paid'),
  ('cohere-embed',  'Cohere Embed',   'embedding-model', false, 'paid'),
  ('bge',           'BGE',            'embedding-model', true,  'free'),
  ('nomic',         'Nomic',          'embedding-model', true,  'freemium'),
  ('jina',          'Jina',           'embedding-model', true,  'freemium'),
  -- Prompt Engineering
  ('dspy',          'DSPy',           'prompt-framework', true, 'free'),
  -- Vector Databases
  ('pinecone',      'Pinecone',       'vector-database', false, 'paid'),
  ('weaviate',      'Weaviate',       'vector-database', true,  'freemium'),
  ('qdrant',        'Qdrant',         'vector-database', true,  'freemium'),
  ('pgvector',      'pgvector',       'vector-database', true,  'free'),
  ('chroma',        'Chroma',         'vector-database', true,  'free'),
  ('milvus',        'Milvus',         'vector-database', true,  'free'),
  -- Knowledge Graph
  ('neo4j',         'Neo4j',          'graph-database',  false, 'freemium'),
  ('graphrag',      'GraphRAG',       'rag-framework',   true,  'free'),
  ('falkordb',      'FalkorDB',       'graph-database',  true,  'free'),
  -- RAG Frameworks
  ('llamaindex',    'LlamaIndex',     'rag-framework',   true,  'free'),
  ('langchain',     'LangChain',      'rag-framework',   true,  'free'),
  ('haystack',      'Haystack',       'rag-framework',   true,  'free'),
  ('ragas',         'Ragas',          'eval-framework',  true,  'free'),
  -- Search
  ('elasticsearch', 'Elasticsearch',  'search-engine',   true,  'freemium'),
  ('cohere-rerank', 'Cohere Rerank',  'reranking',       false, 'paid'),
  -- Tool Calling / MCP
  ('anthropic-mcp', 'Anthropic MCP',  'mcp',             true,  'free'),
  ('claude-desktop','Claude Desktop', 'mcp-client',      false, 'free'),
  -- Agent Frameworks
  ('langgraph',     'LangGraph',      'agent-framework', true,  'free'),
  ('autogen',       'AutoGen',        'agent-framework', true,  'free'),
  ('crewai',        'CrewAI',         'agent-framework', true,  'free'),
  ('pydantic-ai',   'Pydantic AI',    'agent-framework', true,  'free'),
  -- Memory
  ('zep',           'Zep',            'memory',          true,  'freemium'),
  ('mem0',          'mem0',           'memory',          true,  'freemium'),
  ('redis',         'Redis',          'cache-memory',    true,  'freemium'),
  -- Evaluation & Observability
  ('trulens',       'TruLens',        'eval-framework',  true,  'free'),
  ('deepeval',      'DeepEval',       'eval-framework',  true,  'free'),
  ('langsmith',     'LangSmith',      'observability',   false, 'freemium'),
  ('braintrust',    'Braintrust',     'eval-framework',  false, 'freemium'),
  ('helicone',      'Helicone',       'observability',   false, 'freemium'),
  ('wandb',         'Weights & Biases','observability',  false, 'freemium'),
  ('datadog',       'Datadog',        'observability',   false, 'paid'),
  ('opentelemetry', 'OpenTelemetry',  'observability',   true,  'free'),
  -- Guardrails
  ('guardrails-ai', 'Guardrails AI',  'guardrails',      true,  'free'),
  ('nemo-guardrails','NeMo Guardrails','guardrails',     true,  'free'),
  ('llamaguard',    'LlamaGuard',     'guardrails',      true,  'free'),
  -- APIs
  ('openai-api',    'OpenAI API',     'llm-api',         false, 'paid'),
  ('anthropic-api', 'Anthropic API',  'llm-api',         false, 'paid'),
  ('fastapi',       'FastAPI',        'api-framework',   true,  'free'),
  -- Orchestration
  ('temporal',      'Temporal',       'orchestration',   true,  'freemium'),
  ('prefect',       'Prefect',        'orchestration',   true,  'freemium'),
  ('dify',          'Dify',           'orchestration',   true,  'freemium'),
  -- Deployment
  ('modal',         'Modal',          'deployment',      false, 'paid'),
  ('replicate',     'Replicate',      'deployment',      false, 'paid'),
  ('aws-bedrock',   'AWS Bedrock',    'deployment',      false, 'paid'),
  ('vercel-ai',     'Vercel AI',      'deployment',      false, 'freemium'),
  ('docker',        'Docker',         'deployment',      true,  'freemium'),
  ('kubernetes',    'Kubernetes',     'deployment',      true,  'free');

-- ── Concept → Tool mappings ───────────────────────────────────────────────────
INSERT INTO ai_concept_tools (concept_slug, tool_slug, relationship_type) VALUES
  -- LLMs
  ('llms', 'gpt-4o',        'example'),
  ('llms', 'claude-35',     'example'),
  ('llms', 'gemini-15',     'example'),
  ('llms', 'llama-3',       'example'),
  ('llms', 'mistral',       'example'),
  -- Tokens
  ('tokens', 'tiktoken',      'implementation'),
  ('tokens', 'sentencepiece', 'implementation'),
  -- Embeddings
  ('embeddings', 'text-embedding-ada-002', 'implementation'),
  ('embeddings', 'cohere-embed',           'implementation'),
  ('embeddings', 'bge',                    'implementation'),
  ('embeddings', 'nomic',                  'implementation'),
  ('embeddings', 'jina',                   'implementation'),
  -- Prompt Engineering
  ('prompt-engineering', 'dspy',        'implementation'),
  -- Vector Databases
  ('vector-databases', 'pinecone',   'implementation'),
  ('vector-databases', 'weaviate',   'implementation'),
  ('vector-databases', 'qdrant',     'implementation'),
  ('vector-databases', 'pgvector',   'implementation'),
  ('vector-databases', 'chroma',     'implementation'),
  ('vector-databases', 'milvus',     'implementation'),
  -- Knowledge Graphs
  ('knowledge-graphs', 'neo4j',    'implementation'),
  ('knowledge-graphs', 'graphrag', 'implementation'),
  ('knowledge-graphs', 'falkordb', 'implementation'),
  -- RAG
  ('rag', 'llamaindex', 'framework'),
  ('rag', 'langchain',  'framework'),
  ('rag', 'haystack',   'framework'),
  ('rag', 'ragas',      'evaluation'),
  -- Chunking
  ('chunking', 'llamaindex', 'framework'),
  ('chunking', 'langchain',  'framework'),
  -- Metadata
  ('metadata', 'pgvector',  'implementation'),
  ('metadata', 'weaviate',  'implementation'),
  -- Search
  ('search', 'elasticsearch', 'implementation'),
  ('search', 'cohere-rerank', 'implementation'),
  -- MCP
  ('mcp', 'anthropic-mcp', 'implementation'),
  ('mcp', 'claude-desktop', 'client'),
  -- Agents
  ('agents', 'langgraph',  'framework'),
  ('agents', 'autogen',    'framework'),
  ('agents', 'crewai',     'framework'),
  ('agents', 'pydantic-ai','framework'),
  -- Multi-Agent Systems
  ('multi-agent-systems', 'autogen',   'framework'),
  ('multi-agent-systems', 'crewai',    'framework'),
  ('multi-agent-systems', 'langgraph', 'framework'),
  -- Memory
  ('memory', 'zep',      'implementation'),
  ('memory', 'mem0',     'implementation'),
  ('memory', 'redis',    'implementation'),
  -- Evaluation
  ('evaluation', 'ragas',      'implementation'),
  ('evaluation', 'trulens',    'implementation'),
  ('evaluation', 'deepeval',   'implementation'),
  ('evaluation', 'langsmith',  'observability'),
  ('evaluation', 'braintrust', 'implementation'),
  -- Guardrails
  ('guardrails', 'guardrails-ai',   'implementation'),
  ('guardrails', 'nemo-guardrails', 'implementation'),
  ('guardrails', 'llamaguard',      'implementation'),
  -- APIs
  ('apis', 'openai-api',    'example'),
  ('apis', 'anthropic-api', 'example'),
  ('apis', 'fastapi',       'framework'),
  -- Orchestration
  ('orchestration', 'langgraph', 'framework'),
  ('orchestration', 'temporal',  'implementation'),
  ('orchestration', 'prefect',   'implementation'),
  ('orchestration', 'dify',      'platform'),
  -- Monitoring
  ('monitoring', 'langsmith',     'implementation'),
  ('monitoring', 'helicone',      'implementation'),
  ('monitoring', 'wandb',         'implementation'),
  ('monitoring', 'datadog',       'implementation'),
  ('monitoring', 'opentelemetry', 'implementation'),
  -- Security
  ('security', 'llamaguard', 'implementation'),
  -- Deployment
  ('deployment', 'modal',      'platform'),
  ('deployment', 'replicate',  'platform'),
  ('deployment', 'aws-bedrock','platform'),
  ('deployment', 'vercel-ai',  'platform'),
  ('deployment', 'docker',     'infrastructure'),
  ('deployment', 'kubernetes', 'infrastructure');
