---
slug: rag-for-vertical-data
title: RAG for Vertical Data
category: Domain
track: domain-builder
readTime: 4 min read
description: Why retrieval that works on general documents breaks in specialized domains — and the techniques that fix it.
concepts: [rag, chunking, metadata, search, embeddings, evaluation]
updated: 2026-09-23
---

A basic RAG pipeline — chunk the documents, embed them, retrieve the closest matches — works surprisingly well on general content. Point the same pipeline at a specialized domain and quality drops. The answers are plausible, cite real documents, and are wrong often enough that experts stop trusting them.

The model usually isn't the problem. **Retrieval is.** Vertical data has properties that generic retrieval ignores. This article covers the most important ones and how to handle each.

## 1. Specialized vocabulary

Domain language is precise, full of codes and abbreviations, and often uses everyday words with specific meanings. General-purpose embedding models may not separate terms that experts consider very different, and may miss that an abbreviation and its full name are the same thing.

**What helps:**

- **Hybrid search.** Combine vector search with keyword search so exact terms — codes, citations, product numbers — always match.
- **A glossary.** Maintain domain synonyms and abbreviations, and use them to expand queries.
- **Test your embedding model** on domain queries before committing to it; try alternatives, including domain-tuned models.

## 2. Time and versions

Domain documents supersede each other. A 2023 memo and a 2026 memo on the same topic may reach opposite conclusions, and a similarity search has no idea which is current. It may even prefer the old one because its wording happens to match the question better.

**What helps:**

- Store **effective dates and status** (current, superseded, draft) as metadata on every chunk.
- **Filter by default** to current material; allow "as of" queries for historical questions.
- When a document is superseded, mark it — don't just add the new one alongside.

## 3. Scope: jurisdiction, product, customer

Much domain knowledge applies only within a scope — a jurisdiction, a product line, a business unit, a customer segment. Retrieving a rule for the wrong scope is a confident wrong answer.

**What helps:**

- Tag chunks with **scope metadata** at indexing time.
- **Extract scope from the question** (a state, a product) and apply it as a filter before ranking.
- If the question's scope is ambiguous, have the assistant ask rather than guess.

## 4. Not all sources are equal

A statute, an internal policy, an expert's research memo, and an email thread may all discuss the same topic with very different authority.

**What helps:**

- Record **source type and authority level** as metadata.
- **Rank by authority** as well as relevance, and show users which kind of source each claim came from.
- Instruct the model to prefer authoritative sources and flag conflicts between sources rather than silently picking one.

## 5. Structure matters

Domain documents are full of tables, numbered clauses, exceptions, and cross-references. Naive fixed-size chunking splits a rule from its exception or a table row from its header — and the retrieved fragment then says the opposite of the full text.

**What helps:**

- **Chunk along the document's structure**: sections, clauses, table rows with their headers.
- **Add context to each chunk**: the document title, section heading, and effective date, prepended to the text before embedding.
- Keep exceptions with the rules they modify.

## 6. Some answers shouldn't come from documents at all

"What rate applies to this invoice?" is not a document question. The authoritative answer comes from a system of record.

**What helps:** route calculation and live-data questions to **tools** (the calculation engine, the ERP) rather than retrieval, and use documents to explain the result.

## Putting it together: a tax research pipeline

For a tax team's research assistant, a vertical-ready pipeline looks like this:

1. **Index** memos, policies, and audit notes, chunked by section, each chunk carrying jurisdiction, product category, effective dates, status, and authority level.
2. **Parse the question** for jurisdiction, product, and date.
3. **Retrieve** with hybrid search, filtered to the matching scope and to current documents (or "as of" the given date).
4. **Rerank** for relevance, boosting authoritative sources.
5. **Answer** from the top passages with citations, flagging any conflicts; call the tax engine for any calculation.

## Measure retrieval with experts

Generic benchmarks tell you little about your domain. Build a test set of real expert questions, record which document should answer each, and measure whether retrieval finds it — separately from answer quality. Each fix above should move that number; if it doesn't, it isn't worth the complexity.

## Key takeaways

- In specialized domains, most RAG failures are retrieval failures.
- Use hybrid search and a glossary for vocabulary; metadata filters for time, scope, and authority.
- Chunk along document structure and give each chunk its context.
- Send calculations to systems of record, and measure retrieval on expert questions.

**Where to go next:** [What is RAG?](/articles/what-is-rag) · [MCP for Domain Tools](/articles/mcp-for-domain-tools) · [Metadata concept](/concepts/metadata)
