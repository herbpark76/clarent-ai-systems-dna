---
slug: building-a-domain-intelligence-platform
title: Building a Domain Intelligence Platform
category: Domain
track: domain-builder
readTime: 5 min read
description: How the pieces — knowledge, systems of record, agents, and evaluation — come together into an AI platform for one specialized field.
concepts: [knowledge-graphs, rag, mcp, agents, evaluation, guardrails, orchestration]
updated: 2026-09-23
---

General-purpose AI assistants are impressive across a wide range of topics, but in a specialized field they hit the same wall: they don't know *your* domain the way your experts do. They don't know your product catalog, the exceptions your team has documented over years, which system holds the authoritative number, or which answers need to be defensible to an auditor.

A **domain intelligence platform** is what you build to close that gap. It's not a single chatbot. It's a set of shared capabilities — knowledge, connections to systems, reasoning, and quality controls — that any number of AI applications in that domain can use.

This article covers the technical architecture. The **AI DNA Framework** covers the strategic layer: which domain problems to target and how the platform maps to the business.

## What makes a domain different

Specialized domains — tax, insurance, clinical operations, supply chain, legal — share a few traits that general AI handles poorly:

- **Precise vocabulary.** Terms have exact meanings, and near-synonyms can mean different things.
- **Rules with exceptions.** The general rule is rarely the whole answer.
- **Time matters.** Rules have effective dates; yesterday's correct answer can be today's wrong one.
- **Authoritative systems.** Some answers must come from a system of record, never from a model's estimate.
- **Accountability.** Answers need sources, and mistakes have real cost.

Each layer of the platform exists to handle one or more of these.

## The five layers

### 1. Knowledge layer

The platform's understanding of the domain, in two complementary forms:

- **Documents** — research, policies, procedures, decisions — indexed for retrieval (RAG), with metadata for dates, jurisdictions, and authority.
- **A domain model** — the entities and relationships that define the field, often as a knowledge graph. In tax, that's products, tax codes, jurisdictions, customers, exemptions, and the rules connecting them.

Documents capture *reasoning*; the domain model captures *structure*. Most real questions need both.

### 2. Systems layer

Connections to the systems of record — ERP, billing, the calculation engine, the document repository — exposed as well-designed tools, typically through **MCP servers**. The rule here is simple: if a system produces the authoritative answer, the AI calls the system rather than guessing.

### 3. Reasoning layer

The applications that do the work: assistants that answer questions, workflows that process documents, and agents that investigate open-ended problems. These use the knowledge and systems layers rather than each building their own.

### 4. Quality layer

**Evaluation** built with domain experts — test sets of real questions with expert-approved answers — plus monitoring of live usage. In a specialized domain, experts must define what "correct" means; engineers can't do it alone.

### 5. Governance layer

Permissions, audit trails, human approval for consequential actions, and clear boundaries for what the AI may and may not do. In regulated domains this layer is what makes the platform deployable at all.

## A worked example: an indirect tax platform

Picture a company that sells products across many jurisdictions and calculates tax through a tax engine integrated with its ERP. A domain platform for its tax team might include:

- **Knowledge:** tax research memos and audit notes indexed with jurisdiction and effective-date metadata; a graph of products, tax codes, jurisdictions, and exemption certificates.
- **Systems:** an MCP server exposing the tax engine (calculate, look up rules), the ERP (invoices, customers), and the certificate repository.
- **Reasoning:** a research assistant for analysts; an overnight agent that investigates calculation exceptions; a workflow that reviews new product setups for missing tax codes.
- **Quality:** 150 expert-reviewed test questions, re-run on every change, and monthly analyst review of production answers.
- **Governance:** read-only access by default; any change to a tax code mapping proposed by the AI requires analyst approval and is logged.

Three applications, one platform. When a new memo is written, all three know about it. When the MCP server gains a tool, all three can use it.

## How to start

A platform is built incrementally, not designed completely up front:

1. **Pick one high-value, well-bounded use case** — ideally one where experts spend hours on repetitive research.
2. **Build the minimum knowledge and systems layers** that use case needs, designed to be reused.
3. **Build the evaluation set with experts before launch**, not after.
4. **Ship read-only first.** Earn trust before adding actions.
5. **Add the second use case on the same foundation.** This is where the platform starts paying off — each new application costs less than the last.

## Common mistakes

- **Building a chatbot, not a platform.** Every new use case starts from scratch.
- **Letting the model estimate what a system should calculate.** Route authoritative answers to systems of record.
- **Ignoring time.** Without effective dates, the platform will confidently apply outdated rules.
- **Leaving experts out.** Without domain-expert evaluation, quality is guesswork.
- **Starting with autonomy.** Agents that can change data on day one erode trust fast when they're wrong.

## Key takeaways

- A domain intelligence platform is shared infrastructure, not a single app.
- Five layers: knowledge, systems, reasoning, quality, governance.
- Documents capture reasoning; a domain model captures structure — use both.
- Start with one use case, build reusable foundations, and let the second use case prove the platform.

**Where to go next:** [Domain Knowledge Graphs](/articles/modeling-a-domain-knowledge-graph) · [RAG for Vertical Data](/articles/rag-for-vertical-data) · [MCP for Domain Tools](/articles/mcp-for-domain-tools)
