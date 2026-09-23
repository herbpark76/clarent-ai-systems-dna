---
slug: what-is-rag
title: What is RAG?
category: Retrieval
readTime: 8 min read
description: A complete guide to Retrieval-Augmented Generation — how it works, why it matters, and when to use it over fine-tuning.
concepts: [rag, embeddings, vector-databases, chunking, metadata, search, evaluation]
updated: 2026-09-23
---

A large language model knows a lot, but it only knows what was in its training data. It doesn't know your contracts, your product catalog, last week's policy change, or the tax rules your company has configured for its ERP system. Ask about them and it will either say it doesn't know or, worse, give a confident answer that sounds right and isn't.

**Retrieval-Augmented Generation (RAG)** fixes this by giving the model the right information at the moment it answers. Before the model responds, the system *retrieves* relevant passages from your own sources and puts them into the prompt. The model then *generates* an answer grounded in that material instead of relying on memory.

It's the difference between asking someone a question from memory and handing them the relevant pages of the manual first.

## Why RAG matters

RAG has become the default architecture for putting AI on top of business knowledge, for four practical reasons:

- **Current information.** Update a document and the next answer reflects it. No retraining.
- **Private information.** Your data stays in your systems and is pulled in only when needed.
- **Traceability.** Because the answer is built from specific passages, you can show the sources. Users can check the work.
- **Cost.** Indexing documents is far cheaper and faster than training or fine-tuning a model.

## How it works

A RAG system has two halves: an **indexing pipeline** that prepares your content ahead of time, and a **query pipeline** that runs every time someone asks a question.

### 1. Indexing (done ahead of time)

1. **Load** the source content — PDFs, web pages, tickets, database records, spreadsheets.
2. **Chunk** it into passages small enough to be useful on their own, typically a few hundred words. Good chunks follow the document's natural structure (sections, clauses, table rows) rather than cutting mid-sentence.
3. **Attach metadata** to each chunk: source, date, owner, jurisdiction, product line — anything you might want to filter on later.
4. **Embed** each chunk. An embedding model turns the text into a list of numbers (a vector) that captures its meaning, so passages about similar things end up close together.
5. **Store** the vectors, text, and metadata in a searchable index, usually a vector database or a search engine with vector support.

### 2. Querying (every question)

1. **Embed the question** with the same embedding model.
2. **Retrieve** the chunks whose vectors are closest to the question's. Most production systems combine this with keyword search (hybrid search), because exact terms — part numbers, legal citations, error codes — matter.
3. **Filter and rerank.** Apply metadata filters (only this year's documents, only this country) and optionally use a reranker to put the most relevant chunks first.
4. **Build the prompt** with the question, the top chunks, and instructions such as "answer only from the provided sources and cite them."
5. **Generate** the answer, with citations back to the source passages.

## A worked example: tax rules

Suppose a finance team wants to ask, *"How should we tax a service contract that includes equipment shipped to Texas?"*

A general-purpose model will give a generic answer about how sales tax usually works. A RAG system built on the team's own material does better:

- The index holds the company's tax research memos, the product-to-tax-code mapping, and internal decision records, each tagged with jurisdiction and effective date.
- Retrieval finds the memo on bundled service and equipment transactions and the mapping rows for the relevant product codes, filtered to Texas and to rules currently in effect.
- The model answers from those passages and cites them, so a tax analyst can open the memo and confirm.

The model hasn't learned tax law. It has been handed the company's own answer and asked to apply it clearly. That is the core idea of RAG, and it carries over to any domain where the knowledge is specific, changes over time, and has to be defensible.

## RAG vs. fine-tuning

These solve different problems, and they're often confused.

| | RAG | Fine-tuning |
|---|---|---|
| **Changes** | What the model *knows at answer time* | How the model *behaves* |
| **Best for** | Facts, documents, policies, anything that changes | Tone, format, style, narrow repeated tasks |
| **Updating** | Re-index the changed documents | Retrain |
| **Citations** | Natural — answers come from specific passages | Not built in |
| **Cost to start** | Low | Higher |

A useful rule of thumb: **if the problem is "the model doesn't know X," use RAG. If it's "the model doesn't respond the way we need," consider fine-tuning** — and try better prompting first. Many production systems use both.

## Where RAG goes wrong

Most RAG failures are retrieval failures, not model failures. If the right passage never reaches the prompt, no model can answer correctly. The common problems:

- **Bad chunking.** Chunks that split a rule from its exceptions, or a table from its header, retrieve badly and mislead the model.
- **Vector search alone.** Embeddings are good at meaning and weak at exact identifiers. Add keyword search for codes, names, and numbers.
- **No metadata filters.** Without filters, an outdated policy can outrank the current one simply because it's worded more closely to the question.
- **Too much context.** Stuffing in dozens of chunks dilutes the relevant ones and raises cost. Retrieve widely, then rerank and keep the best few.
- **No evaluation.** Teams judge the system by whether answers "look right." Instead, build a set of real questions with known answers and measure retrieval (did the right passage come back?) separately from generation (was the answer faithful to it?).

## When not to use RAG

RAG isn't always the answer:

- If the knowledge fits comfortably in the prompt — a single policy, a short product list — just include it directly.
- If the question needs calculation or a live system lookup ("what's the tax on this invoice?"), use **tool calling** to query the system of record, not retrieval over documents.
- If the task requires reasoning across an entire corpus ("summarize every change across all 400 contracts"), plain retrieval of a few chunks won't cover it; you need a different pipeline, such as map-reduce summarization or a knowledge graph.

## Key takeaways

- RAG gives a model the right information at answer time by retrieving it from your own sources.
- Quality depends mostly on retrieval: chunking, hybrid search, metadata, and reranking.
- Use RAG for knowledge; use fine-tuning for behavior.
- Measure retrieval and answer quality separately, on real questions.

**Where to go next on the map:** [Embeddings](/concepts/embeddings) · [Chunking](/concepts/chunking) · [Search](/concepts/search) · [Evaluation](/concepts/evaluation)
