---
slug: chunking-strategies-for-rag
title: Chunking Strategies for RAG
category: Retrieval
readTime: 6 min read
description: How you split documents before embedding them determines whether your RAG system finds the right passage or the wrong one.
concepts: [chunking, rag, embeddings, vector-databases, metadata]
updated: 2026-11-06
---

Before you can embed documents for a RAG system, you have to split them into smaller pieces. That step — **chunking** — sounds trivial, but it's one of the highest-leverage decisions in the entire pipeline. Bad chunking means the right passage never reaches the model, and no amount of model intelligence can fix that.

## Why chunking matters

An embedding captures the meaning of a single passage. If you embed an entire 40-page contract as one vector, that vector represents the average meaning of every clause, definition, and signature block mashed together. When a user asks about a specific indemnification clause, the vector for their question won't be close enough to the document's averaged-out vector to retrieve it.

Chunking solves this by breaking documents into pieces small enough that each one has a coherent, self-contained meaning. Each chunk gets its own embedding, so retrieval can pinpoint the specific passage that answers the question.

## The tradeoff: too big vs. too small

- **Chunks too large:** The embedding averages out the meaning. A chunk that covers five different topics retrieves for all of them poorly — it's close to everything but precise about nothing.
- **Chunks too small:** A single sentence loses the context it needs to be understood. A chunk that says "see Section 4.2 for details" is useless without the surrounding context that explains what "Section 4.2" refers to.

The sweet spot is usually a few hundred words — enough to convey a complete idea, not so much that the meaning gets diluted.

## Common chunking strategies

### Fixed-size chunking

The simplest approach: split the text into chunks of N tokens (e.g., 500 tokens) with some overlap (e.g., 50 tokens) between adjacent chunks. The overlap ensures you don't cut a sentence or idea exactly at the boundary.

**When to use it:** When your documents are relatively uniform — articles, emails, chat logs — and you want a predictable, easy-to-implement pipeline.

**Downside:** It ignores document structure. A fixed-size split might cut a heading from its body text or split a table from its caption.

### Structure-aware chunking

Split along the document's natural boundaries: headings, sections, paragraphs, table rows. If a section is too long, split it further; if too short, merge it with the next.

**When to use it:** When your documents have clear structure — contracts with numbered clauses, policy manuals with sections, technical specs with headings.

**Downside:** Requires parsing the document structure, which varies by format (PDF, HTML, Markdown, DOCX).

### Semantic chunking

A more advanced approach that splits based on meaning: use embeddings to find natural boundaries where the topic shifts. Adjacent sentences that are semantically similar stay together; a shift in topic triggers a new chunk.

**When to use it:** When your documents lack clear structure and fixed-size chunks are cutting ideas in half.

**Downside:** More expensive (you embed twice — once to find boundaries, once for the final index) and harder to debug.

## A worked example: tax research memos

Suppose a finance team indexes a library of tax research memos. Each memo is 5-10 pages and covers multiple topics — nexus rules, apportionment factors, credit calculations — often in separate sections.

**Fixed-size chunking at 500 tokens** would cut some sections in the middle of a rule explanation. A chunk might start mid-sentence in the nexus section and end mid-sentence in the apportionment section. When someone asks about apportionment, the retrieved chunk includes irrelevant nexus content, diluting the signal.

**Structure-aware chunking** splits along the memo's section headings. Each chunk is a complete section: "Nexus Rules," "Apportionment Factors," "Credit Calculations." Retrieval can now surface exactly the apportionment section with its full context, including any cross-references within that section.

The difference in retrieval quality between these two approaches can be dramatic, and it costs nothing to switch — just a different splitting function.

## Overlap: why it helps

Even with structure-aware chunking, adding a small overlap (10-15% of the chunk size) between adjacent chunks helps with boundary cases. If a rule in one section references "the threshold described above," the overlap ensures the previous section's threshold is included in the current chunk too.

## Metadata: chunking's partner

Chunking determines *what* gets embedded. Metadata determines *what gets filtered before embedding is even searched*. Attaching metadata — source, date, jurisdiction, document type — to each chunk lets you scope retrieval before the vector search runs. This is often more impactful than tuning chunk size.

## Common mistakes

- **No overlap.** Sentences that cross chunk boundaries lose context. A small overlap fixes this.
- **Ignoring document structure.** A contract isn't an article. Split along clause boundaries, not at arbitrary token counts.
- **Chunks without context.** A chunk that says "as noted above" is useless if the referenced content is in a different chunk. Include headers or breadcrumbs in the chunk text.
- **Never evaluating.** Build a set of test queries with known-good passages. Measure whether the right chunk comes back. Adjust chunking and re-measure.

## Key takeaways

- Chunking is the single highest-leverage tuning parameter in a RAG pipeline.
- The sweet spot is usually a few hundred words — enough for a complete idea, not so much that meaning dilutes.
- Match the strategy to the document: fixed-size for uniform text, structure-aware for structured documents, semantic for unstructured text.
- Always add overlap and always evaluate retrieval quality on real queries.

**Where to go next on the map:** [RAG](/concepts/rag) · [Embeddings](/concepts/embeddings) · [Metadata](/concepts/metadata) · [Search](/concepts/search)
