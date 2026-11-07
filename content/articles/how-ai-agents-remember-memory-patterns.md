---
slug: how-ai-agents-remember-memory-patterns
title: How AI Agents Remember: Memory Patterns
category: Agents
readTime: 7 min read
description: How production AI agents store, retrieve, and use past interactions — from short-term context to long-term vector memory.
concepts: [memory, agents, rag, context-windows, vector-databases]
updated: 2026-11-06
---

A language model has no memory between conversations. Every time you send a new request, it starts fresh — it doesn't remember what you asked yesterday or what it told you last week. For a chatbot that's fine. For an agent that's supposed to help someone over days or weeks, it's a problem. **Memory** is how production AI systems bridge that gap.

## The memory problem

A context window — the maximum text a model can process in one request — is limited. Even models with large context windows can't hold an entire conversation history indefinitely. Eventually, older messages fall off the end. And if a user starts a new session, everything from the previous session is gone.

Memory systems solve this by storing relevant information outside the model and pulling it back in when needed. The model still doesn't remember — but the system around it does.

## Three kinds of memory

### 1. Short-term (conversation context)

This is simply the current conversation kept in the prompt. The model sees the last N messages and responds based on them. When the conversation gets too long, older messages are dropped or summarized.

**Best for:** Current task context, recent back-and-forth, instructions the user just gave.

**Limitation:** Vanishes when the session ends or the context window fills up.

### 2. Working memory (scratchpad)

A designated space where the agent writes down intermediate results during a task — plans, partial findings, decisions made so far. This is especially useful for multi-step tasks where the agent needs to track its own progress.

**Best for:** Complex tasks that unfold over many tool calls — research, data gathering, multi-document analysis.

**Limitation:** Cleared when the task completes. It's a scratchpad, not a permanent store.

### 3. Long-term memory (persistent retrieval)

This is where the system stores information across sessions. The standard pattern:

1. After each conversation turn, extract key facts or summaries.
2. Embed them and store the vectors in a vector database.
3. On the next session, embed the user's first message and retrieve the most relevant past interactions.
4. Inject those memories into the prompt as context.

The agent now "remembers" by retrieving, not by holding everything in its context window.

**Best for:** User preferences, past decisions, ongoing project context, facts learned in previous sessions.

**Limitation:** Retrieval is approximate — you get the most similar memories, not necessarily the most relevant ones. And if you store too much, noise drowns out signal.

## A worked example: a tax research assistant

Suppose a firm builds an AI assistant that helps tax analysts research client questions. The assistant works across multiple sessions for the same client.

**Without long-term memory:** Every session starts from scratch. The analyst re-explains the client's industry, their past positions, and the specific rules they're working within. The assistant redoes work it already did last week.

**With long-term memory:** After each session, the system stores a summary — "Client X is a SaaS company in Texas. We determined that their bundled training services are taxable under Rule 3.2. Open question: whether the maintenance contract is also taxable." On the next session, when the analyst asks about the maintenance contract, the system retrieves that summary and injects it. The assistant picks up where it left off.

The model didn't remember anything. The system retrieved the right context and handed it to the model. That's the core pattern.

## Design decisions

### What to store

Don't store raw conversation logs — they're too noisy. Extract and store:
- **Facts:** "User is in the manufacturing industry."
- **Decisions:** "We chose approach B over approach A because of cost."
- **Open questions:** "Still need to verify whether Rule 3.2 applies to the maintenance contract."

### When to retrieve

Retrieving on every turn is expensive and can flood the context with irrelevant memories. Options:
- Retrieve only on the first message of a session.
- Retrieve when the user references something past ("remember when we discussed...").
- Retrieve when the current context doesn't seem to have enough information.

### Forgetting

Memory systems that never forget become bloated. Old, outdated facts compete with current ones. Build in a decay or consolidation mechanism: periodically merge similar memories, discard contradictions, and archive stale entries.

## Common mistakes

- **Storing everything.** Raw logs are noise. Store extracted facts and summaries, not every message.
- **No retrieval filtering.** Injecting 50 memories into every prompt wastes context and confuses the model. Retrieve a few relevant ones.
- **Treating memory as a database lookup.** Memory retrieval is approximate. Design your system to handle the case where the retrieved memory is wrong or outdated.
- **Forgetting to forget.** Without consolidation, old memories accumulate and degrade retrieval quality over time.

## Key takeaways

- Language models have no built-in memory between sessions — the system around the model provides it.
- Three patterns: short-term (current context), working (task scratchpad), long-term (persistent retrieval).
- Long-term memory works by embedding past interactions and retrieving the most relevant ones at query time.
- Store extracted facts and decisions, not raw logs. And build in a way to forget stale memories.

**Where to go next on the map:** [Agents](/concepts/agents) · [Context Windows](/concepts/context-windows) · [Vector Databases](/concepts/vector-databases) · [RAG](/concepts/rag)
