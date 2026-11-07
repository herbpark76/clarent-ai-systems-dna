---
slug: what-are-embeddings
title: What Are Embeddings?
category: Data
readTime: 6 min read
description: How embeddings turn text into numbers that capture meaning — the foundation of semantic search, RAG, and AI memory.
concepts: [embeddings, llms, vector-databases, rag, search]
updated: 2026-11-06
---

A language model can't read text. It only works with numbers. So before any AI system can search, compare, or retrieve documents, it needs a way to turn words into numbers in a way that preserves *meaning*. That's what embeddings do.

## What is an embedding?

An **embedding** is a list of numbers — usually hundreds or thousands of them — that a model produces from a piece of text. The key property is that texts with similar meanings produce numbers that are close together, and texts with different meanings produce numbers that are far apart.

Think of it as coordinates. If you plotted every document in your company on a map, documents about the same topic would cluster together. An embedding model is what figures out those coordinates automatically.

The numbers themselves don't have labels. Dimension 47 isn't "tax rate" and dimension 203 isn't "product category." The model learns these mappings during training, and the geometry emerges from patterns in language. What matters is that the geometry works: nearby points mean similar things.

## Why embeddings matter

Embeddings are the bridge between human language and machine search. Without them, your system can only find things by matching exact keywords. With them, it can find things by meaning.

This unlocks three capabilities that production AI systems depend on:

- **Semantic search.** A user asks about "revenue recognition for multi-element arrangements" and the system finds a document titled "ASC 606 guidance for bundled contracts" — even though no words overlap.
- **Retrieval for RAG.** Before a language model answers a question, the system embeds the question, finds the closest passages in the knowledge base, and feeds them to the model.
- **Memory for agents.** An AI assistant can embed each conversation turn and later retrieve relevant past interactions by similarity, giving it a form of long-term memory.

## How embeddings are made

An embedding model is typically a transformer trained on a large text corpus. During training, it learns to place semantically related text close together. When you send it a passage, it outputs a fixed-length vector — often several hundred to a few thousand numbers.

The critical practical detail: **you must use the same embedding model for indexing and querying.** If you embed your documents with one model and the question with another, the vectors live in different coordinate systems and the similarity scores are meaningless.

## A worked example: finding the right policy

Suppose an operations team maintains a library of internal policies — procurement rules, expense guidelines, travel policies, approval matrices — spread across hundreds of PDFs.

A keyword search for "approval threshold" returns every document that contains those exact words. But what if someone searches "who can sign off on a $50K purchase"? Keyword search finds nothing — those words don't appear together in any policy.

With embeddings, the query "who can sign off on a $50K purchase" and the policy section titled "Delegation of Authority: Expenditure Approvals" land close together in vector space. The system retrieves the right policy even though the wording is completely different.

That gap — between what people type and what documents say — is why embeddings matter in practice.

## Choosing an embedding model

Several factors affect which model fits your use case:

- **Dimensionality.** Higher dimensions can capture more nuance but cost more to store and search. Common models range from a few hundred to a few thousand dimensions.
- **Language support.** If your content is in Spanish or Japanese, make sure the model was trained on that language. Some models are English-only.
- **Domain fit.** General-purpose models work well for most text. If your content is highly technical — medical records, legal contracts, code — a domain-specific model may retrieve better.
- **Speed.** Embedding speed matters when you're indexing millions of documents or doing real-time queries.

## Common mistakes

- **Mixing embedding models.** Index with one model, query with another, and your search quality drops to random. Always keep them consistent.
- **Embedding full documents instead of chunks.** A 50-page document embedded as one vector averages out all its meaning. Chunk first, embed each chunk, and let retrieval surface the right section.
- **Never re-embedding after updates.** If you update a document but don't re-embed it, the vector no longer matches the text. Build re-indexing into your update workflow.
- **Skipping evaluation.** Embedding quality varies by domain. Build a small test set of queries with known-good documents and measure whether the right results come back.

## Key takeaways

- Embeddings turn text into arrays of numbers where similar meanings produce nearby points.
- They enable semantic search, RAG retrieval, and agent memory — the backbone of most production AI systems.
- Always use the same embedding model for indexing and querying.
- Chunk your documents before embedding; don't embed entire documents as single vectors.

**Where to go next on the map:** [Vector Databases](/concepts/vector-databases) · [Chunking](/concepts/chunking) · [RAG](/concepts/rag) · [Search](/concepts/search)
