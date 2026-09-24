---
slug: modeling-a-domain-knowledge-graph
title: Modeling a Domain Knowledge Graph
category: Domain
track: domain-builder
readTime: 4 min read
description: How to design the entities, relationships, and time rules that let AI reason precisely about a specialized field.
concepts: [knowledge-graphs, rag, metadata, embeddings, evaluation]
updated: 2026-09-23
---

In a specialized domain, many of the most valuable questions are about **connections**: which products are affected by a rule change, which customers hold the right certificates, which contracts reference a clause that was just revised. Those questions are hard for document search and natural for a **knowledge graph**.

The hard part isn't the database. It's the **model** — deciding what the entities and relationships are. Get that right and the graph becomes the backbone of your domain platform. Get it wrong and it becomes an expensive copy of your ERP.

## Start from questions, not data

The most common mistake is modeling everything in the source systems. Instead, start by collecting 20–30 real questions your experts answer regularly, then design the smallest model that can answer them.

Questions a tax team might list:

- Which products mapped to a given tax code are sold into jurisdictions where that code's treatment changed this year?
- Which customers buying exempt-eligible products don't have a valid certificate on file?
- What was the rule for this product in this jurisdiction on the invoice date?

Each question points to entities (products, tax codes, jurisdictions, customers, certificates, rules) and the relationships between them.

## The building blocks

**Entities** are the things in your domain, each with a type and a stable identifier:

- `Product`, `TaxCode`, `Jurisdiction`, `Customer`, `ExemptionCertificate`, `Rule`, `ResearchMemo`

**Relationships** are named, directional connections:

- `Product —MAPPED_TO→ TaxCode`
- `TaxCode —HAS_RULE_IN→ Jurisdiction` (with the treatment: taxable, exempt, reduced)
- `Jurisdiction —PART_OF→ Jurisdiction` (city within county within state)
- `Customer —HOLDS→ ExemptionCertificate —VALID_IN→ Jurisdiction`
- `ResearchMemo —DISCUSSES→ TaxCode`

**Properties** are attributes on entities and relationships: names, codes, rates, status, and — critically — dates.

## Design for time

Specialized domains change constantly, and questions are often about a specific point in time. Build time into the model from the start:

- Put **effective-from** and **effective-to** dates on relationships that change: mappings, rules, certificate validity.
- Never overwrite history. When a mapping changes, end-date the old relationship and create a new one.
- Make "as of" a standard part of every query.

This is what lets the platform answer "what applied on the invoice date?" instead of only "what applies now?" — and explain what changed and when.

## Track where facts come from

Every fact in the graph should carry **provenance**: which system or document it came from, and when it was loaded. When an AI answer relies on a graph fact, provenance is what lets a user verify it — and lets you trace and fix bad data.

## Connect the graph to your documents

The graph becomes much more useful when it links to the unstructured knowledge:

- Link documents to the entities they discuss (`ResearchMemo —DISCUSSES→ TaxCode`).
- Use the graph to **narrow retrieval**: find the relevant entities first, then search only documents linked to them.
- Use documents to **explain graph facts**: the graph says a code is exempt in a state; the linked memo explains why.

## Building it: where the data comes from

- **Structured sources first.** Master data — products, customers, jurisdictions, mappings — usually already exists in systems of record. Load it directly; it's the most reliable part of the graph.
- **Extract from documents with care.** Language models can pull entities and relationships out of memos and contracts, which dramatically lowers the cost of building a graph. Treat extracted facts as *proposed*: record their source, score confidence, and have experts review the ones that matter.
- **Keep it in sync.** A stale graph is worse than none. Schedule regular loads from source systems and track freshness.

## Keep the model small

- Model only what your questions need. You can always add entity types later.
- Prefer a few well-defined relationship types over many overlapping ones.
- Write down the definition of each entity and relationship. Experts and AI both need to know exactly what `MAPPED_TO` means.
- Review the model with domain experts. They'll spot missing distinctions — and unnecessary ones — immediately.

## Validate it

Before building applications on the graph, test it:

- Run your original list of expert questions as graph queries and check the answers with experts.
- Spot-check a sample of facts against the source systems.
- Add those checks to your evaluation set so they re-run after every data load.

## Key takeaways

- Start from real expert questions and model only what they need.
- Build time (effective dates) and provenance into the model from day one.
- Load structured master data first; treat facts extracted from documents as proposals to review.
- Link the graph to your documents so each makes the other more useful.

**Where to go next:** [Vector DBs vs Knowledge Graphs](/articles/vector-dbs-vs-knowledge-graphs) · [RAG for Vertical Data](/articles/rag-for-vertical-data) · [Knowledge Graphs concept](/concepts/knowledge-graphs)
