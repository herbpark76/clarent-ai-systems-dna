---
slug: how-to-evaluate-ai-systems
title: How to Evaluate AI Systems
category: Evaluation
readTime: 6 min read
description: Practical frameworks for measuring accuracy, relevance, faithfulness, and safety in production AI systems.
concepts: [evaluation, monitoring, rag, agents, guardrails, prompt-engineering]
updated: 2026-09-23
---

Most AI projects are judged the same way at first: someone tries a few questions, the answers look good, and the system ships. Then real users ask different questions, the answers are sometimes wrong in ways nobody noticed, and trust erodes.

**Evaluation** is how you replace "it looks good" with evidence. It's the difference between a demo and a system you can put in front of a finance team, a customer, or an auditor.

## Why AI is harder to test than normal software

Traditional software is deterministic: the same input gives the same output, and a test either passes or fails. AI systems are different:

- **Outputs vary.** The same question can produce differently worded answers.
- **"Correct" is fuzzy.** Two different answers can both be right; a fluent answer can be subtly wrong.
- **Failures are silent.** A wrong answer doesn't throw an error. It reads just as confidently as a right one.
- **Small changes ripple.** Changing a prompt, a model version, or a chunking setting can improve some answers and break others.

This means you need a deliberate, repeatable way to measure quality — and to re-measure every time something changes.

## Start with an evaluation set

The foundation of every evaluation is a **test set**: a collection of realistic inputs with a definition of what a good output looks like.

- **Use real questions.** Pull them from users, support tickets, or subject-matter experts. Invented questions tend to be easier than real ones.
- **Include the hard cases.** Edge cases, ambiguous questions, questions the system should decline, and questions whose answers changed recently.
- **Define "good."** For some questions, that's an exact answer. For others, it's the key facts that must appear, the source that must be cited, or a rubric.
- **Start small.** Fifty well-chosen examples beat a thousand generic ones. Grow the set as you find new failures.

Every production failure you discover should become a new test case.

## What to measure

Different parts of a system need different measures.

### For retrieval (RAG)

- **Retrieval recall** — did the passage containing the answer come back in the results?
- **Retrieval precision** — how much of what came back was relevant?

Measure these separately from the final answer. If the right passage never reaches the model, no prompt will fix it.

### For answers

- **Correctness** — is the answer right?
- **Faithfulness (groundedness)** — is every claim supported by the retrieved sources or tool results, or did the model add things?
- **Relevance** — does it actually answer the question asked?
- **Completeness** — does it include everything important?
- **Citation accuracy** — do the cited sources say what the answer claims?

### For agents

- **Task success rate** — did it achieve the goal?
- **Efficiency** — how many steps, tool calls, and how much cost per task?
- **Tool-use accuracy** — did it call the right tools with the right arguments?
- **Safety** — did it stay within its permissions and ask for approval when required?

### For every system

- **Latency and cost** — per request, and at expected volume.
- **Refusals** — does it decline when it should, and *only* when it should?

## How to score: three methods

1. **Code-based checks.** Exact matches, required keywords, valid JSON, correct numbers, a specific source cited. Fast, cheap, and reliable — use them wherever the answer can be checked mechanically.
2. **Model-graded evaluation ("LLM as judge").** A separate model scores outputs against a rubric: "Is every claim in this answer supported by these sources? Answer yes or no, then explain." This scales to fuzzy qualities like faithfulness and relevance. It needs its own validation — check a sample of its judgments against a human's.
3. **Human review.** Subject-matter experts grade a sample. Slowest and most expensive, but it's the ground truth the other methods are calibrated against, and essential in specialized domains.

Most mature teams use all three: code checks for what's mechanical, model grading for scale, and periodic human review to keep the automated scores honest.

## A worked example: a tax research assistant

A tax team builds an assistant that answers questions from its research memos and its tax engine.

Their evaluation set has 120 questions drawn from real analyst requests, each with:

- The expected answer's key facts ("exempt in State X for resale with a valid certificate").
- The memo or system record that supports it.
- A category: rule lookup, calculation explanation, policy question, or should-decline.

They measure:

- **Retrieval recall** — was the supporting memo in the top five results? (Code check.)
- **Correctness** — does the answer contain the key facts? (Model-graded against the expected facts.)
- **Faithfulness** — is every claim supported by the retrieved material? (Model-graded.)
- **Calculations** — for questions that should use the tax engine, did the assistant call it rather than estimate? (Code check on the tool log.)
- **Declines** — does it refuse to give advice on questions outside its scope? (Code check plus human review.)

Every month, a tax analyst reviews 30 random production answers. Any error found becomes a new test case. Before any change goes live — a new model, a prompt edit, re-chunked memos — the full set is re-run and compared with the previous scores.

## From testing to monitoring

Evaluation doesn't stop at launch. In production:

- **Log everything** — inputs, retrieved context, tool calls, outputs, latency, cost.
- **Sample and score** live traffic with the same automated checks.
- **Collect user feedback** — thumbs up/down, corrections, escalations.
- **Watch for drift** — new kinds of questions, changes in source data, declining scores.
- **Re-run the test set** on every change, the way you would run regression tests for code.

## Common mistakes

- Judging quality by trying a handful of questions yourself.
- Measuring only the final answer, so retrieval problems stay hidden.
- Trusting model-graded scores without checking them against human judgment.
- Building a test set once and never updating it.
- Optimizing one metric (like correctness) while cost or latency quietly doubles.

## Key takeaways

- Build a test set of real questions with a clear definition of "good," and grow it from real failures.
- Measure retrieval, answer quality, and (for agents) task success separately.
- Combine code checks, model grading, and human review.
- Re-run evaluations on every change, and keep monitoring after launch.

**Where to go next on the map:** [Evaluation](/concepts/evaluation) · [Monitoring](/concepts/monitoring) · [Guardrails](/concepts/guardrails) · [RAG](/concepts/rag)
