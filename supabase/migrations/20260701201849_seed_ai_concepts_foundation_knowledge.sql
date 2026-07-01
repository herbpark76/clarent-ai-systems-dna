/*
# Seed AI Concepts — Foundation and Knowledge clusters

Inserts 11 concepts for the Foundation (5) and Knowledge (6) clusters.
Uses UPSERT so the migration is safe to re-run.
*/

INSERT INTO ai_concepts
  (slug, name, category, short_description, overview, why_it_matters, why_should_i_care, common_mistakes, overview_minutes, x_position, y_position)
VALUES
  (
    'llms', 'LLMs', 'foundation',
    'Large Language Models predict the next token in a sequence.',
    'Large Language Models predict the next token in a sequence, giving them the ability to generate, translate, summarize, and reason with language at scale.',
    'LLMs are the reasoning engine at the center of virtually every modern AI system. Everything else is built around or on top of them.',
    'Every AI product decision starts with understanding what LLMs can and can''t do. This knowledge directly impacts scoping, cost, and which architectures you''ll need around it.',
    '["Assuming the model always tells the truth","Ignoring token costs at scale","Treating LLMs as databases rather than reasoners","Skipping evals because output \"looks good\""]'::jsonb,
    20, 195, 375
  ),
  (
    'tokens', 'Tokens', 'foundation',
    'The smallest units of text an LLM processes.',
    'Tokens are the smallest units of text an LLM processes. Words are split into sub-word pieces using algorithms like BPE that balance vocabulary size with coverage.',
    'Token count determines cost, speed, and what fits in a model''s context window. Understanding tokenization prevents subtle bugs and budget surprises.',
    'Token limits are why your AI assistant forgets things mid-conversation. They determine your API bill and fundamentally constrain what your system can hold in mind at once.',
    '["Estimating 1 token = 1 word (it''s closer to 0.75)","Not monitoring token usage in production","Ignoring token limits when designing prompts","Forgetting that outputs also count toward limits"]'::jsonb,
    10, 105, 260
  ),
  (
    'context-windows', 'Context Windows', 'foundation',
    'The maximum amount of text an LLM can process in a single request.',
    'The context window is the maximum amount of text an LLM can process in a single request — its working memory for a conversation or task.',
    'Context size determines how much history, documentation, and instruction you can feed the model at once. It''s the primary constraint in system design.',
    'Context limits force every AI architecture decision. They''re why you need RAG, why agents need memory, and why your system can lose track of earlier instructions.',
    '["Stuffing irrelevant content into the context","Not handling context overflow gracefully","Assuming more context always improves quality","Ignoring the \"lost in the middle\" degradation problem"]'::jsonb,
    12, 258, 193
  ),
  (
    'embeddings', 'Embeddings', 'foundation',
    'Dense numerical vectors that encode the meaning of text.',
    'Embeddings are dense numerical vectors that encode the meaning of text. Semantically similar text produces vectors that are close together in high-dimensional space.',
    'Embeddings make it possible to search by meaning rather than keywords — the foundation of semantic search, RAG, and memory systems.',
    'Embeddings are the bridge between human language and machine search. Without them, your AI can only find things by exact keyword — with them, it can understand what you mean.',
    '["Using the wrong embedding model for your language or domain","Embedding full documents instead of chunks","Never re-embedding after data changes","Mixing embedding models between indexing and querying"]'::jsonb,
    15, 142, 510
  ),
  (
    'prompt-engineering', 'Prompt Engineering', 'foundation',
    'Crafting instructions to reliably guide LLM behavior.',
    'Prompt engineering is the practice of crafting instructions, examples, and context to reliably guide LLM behavior toward desired outputs.',
    'Well-engineered prompts dramatically improve output quality, consistency, and alignment with intent — often more than model changes.',
    'A better prompt often delivers more improvement than switching to a more expensive model. It''s the highest-ROI skill for anyone building with AI.',
    '["Under-specifying the desired output format","Writing prompts that work once but aren''t robust across inputs","Not testing prompts across edge cases","Putting instructions in user turns instead of the system prompt"]'::jsonb,
    18, 80, 448
  ),
  (
    'vector-databases', 'Vector Databases', 'knowledge',
    'Datastores optimized for querying high-dimensional embedding vectors.',
    'Vector databases are datastores optimized for storing and querying high-dimensional embedding vectors at scale using approximate nearest-neighbor search.',
    'They make semantic search fast enough for production, enabling RAG pipelines, memory systems, and recommendation engines.',
    'Without a vector database, your AI can only search by exact keywords or hold knowledge in its limited context window. Vector DBs unlock instant semantic search at scale.',
    '["Not normalizing embedding vectors before indexing","Searching the whole corpus without metadata filters","Using only vector similarity without BM25 hybrid search","Choosing a database before benchmarking on your own data"]'::jsonb,
    15, 425, 510
  ),
  (
    'knowledge-graphs', 'Knowledge Graphs', 'knowledge',
    'Structured networks of entities and relationships encoding real-world facts.',
    'Knowledge graphs are structured networks of entities and relationships that encode real-world facts as typed graph nodes and edges.',
    'Knowledge graphs provide precise, structured knowledge that complements the fuzzy pattern-matching of LLMs — enabling more accurate, explainable reasoning.',
    'When your domain has structured relationships — org charts, product hierarchies, medical ontologies — a knowledge graph lets AI reason about those connections explicitly.',
    '["Building a knowledge graph when a vector database is sufficient","Not defining a clear ontology before ingesting data","Failing to keep the graph in sync as source data changes","Ignoring graph traversal costs at query time"]'::jsonb,
    14, 357, 610
  ),
  (
    'rag', 'RAG', 'knowledge',
    'Retrieval-Augmented Generation — grounding LLM answers in real documents.',
    'Retrieval-Augmented Generation retrieves relevant documents from a knowledge source and injects them into the LLM''s context window before generating a response.',
    'RAG grounds LLM outputs in real, current facts — dramatically reducing hallucination and enabling AI systems to reason over private or recent data.',
    'RAG is what transforms a generic LLM into one that knows about your business. It''s the standard architecture for knowledge-grounded AI assistants.',
    '["Poor chunking strategy that tanks retrieval quality","Not evaluating retrieval independently from generation","Injecting too much context and overwhelming the model","Using RAG when fine-tuning would be more appropriate"]'::jsonb,
    20, 518, 385
  ),
  (
    'chunking', 'Chunking', 'knowledge',
    'Splitting documents into appropriately sized pieces before embedding.',
    'Chunking is the process of splitting documents into appropriately sized pieces before embedding and indexing in a vector database.',
    'Chunk quality directly determines retrieval quality. Too big loses precision; too small loses context. It''s the highest-leverage tuning parameter in RAG.',
    'Poor chunking is the most common reason a RAG system fails in practice. It''s also one of the cheapest things to fix — if you catch it early.',
    '["Chunks too large — retrieves irrelevant surrounding context","Chunks too small — loses the context needed for understanding","No overlap between adjacent chunks at boundaries","Ignoring document structure like headings and sections"]'::jsonb,
    12, 370, 435
  ),
  (
    'metadata', 'Metadata', 'knowledge',
    'Structured attributes on chunks that enable filtered search.',
    'Metadata is structured attributes attached to document chunks that enable filtered, faceted, and hybrid search during retrieval.',
    'Metadata filtering scopes retrieval to relevant subsets of a knowledge base — it''s often the difference between a good and a broken RAG system.',
    'Metadata filters are what make enterprise search practical. Without them, every query searches your entire corpus — slow, noisy, and often wrong.',
    '["Not extracting metadata at ingestion time","Using inconsistent metadata schemas across document types","Filtering too aggressively and missing relevant results","Skipping metadata when documents come from multiple sources"]'::jsonb,
    10, 402, 568
  ),
  (
    'search', 'Search', 'knowledge',
    'The retrieval layer combining vector similarity and keyword matching.',
    'The retrieval layer that finds the most relevant chunks for a given query using vector similarity, keyword matching (BM25), or hybrid methods combining both.',
    'Search quality is the bottleneck in most RAG systems — bad retrieval means bad answers regardless of how capable the LLM is.',
    'Even with a perfect LLM, bad retrieval means bad answers. Search quality is often the first and easiest place to improve a struggling AI system.',
    '["Using only vector search when BM25 handles keyword queries better","Not reranking results before sending to the LLM","Retrieving too few chunks (missing relevant content)","Never evaluating retrieval quality independently from generation"]'::jsonb,
    14, 478, 540
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  short_description = EXCLUDED.short_description,
  overview = EXCLUDED.overview,
  why_it_matters = EXCLUDED.why_it_matters,
  why_should_i_care = EXCLUDED.why_should_i_care,
  common_mistakes = EXCLUDED.common_mistakes,
  overview_minutes = EXCLUDED.overview_minutes,
  x_position = EXCLUDED.x_position,
  y_position = EXCLUDED.y_position,
  updated_at = now();
