---
slug: what-are-ai-agents
title: What are AI Agents?
category: Agents
readTime: 5 min read
description: How agents plan, reason, and act — breaking down the loop from goal to tool call to response.
concepts: [agents, tool-calling, planning, memory, multi-agent-systems, orchestration, guardrails, evaluation]
updated: 2026-09-23
---

"Agent" is one of the most overused words in AI. Vendors use it for everything from a chatbot with one tool to a fully autonomous system. A useful working definition:

> **An AI agent is a system where a language model decides, step by step, which actions to take to reach a goal — observing the results of each action before choosing the next.**

The important word is *decides*. In a traditional workflow, a developer writes the sequence of steps in advance. In an agent, the model chooses the steps at run time.

## The agent loop

Every agent, however sophisticated, runs a version of the same loop:

1. **Goal.** The agent receives a task: "Find out why these five invoices failed tax calculation and suggest fixes."
2. **Think.** The model considers the goal, what it knows so far, and the tools available, and decides on the next step.
3. **Act.** It calls a tool — query a system, search documents, run a calculation.
4. **Observe.** The tool's result comes back into the model's context.
5. **Repeat.** The model decides whether it's done or needs another step. The loop continues until the goal is met, the agent gets stuck, or a limit is reached.

This is the tool-calling loop, run for as many steps as the task needs, with the model in charge of the plan.

## What an agent is made of

- **A model** — the reasoning engine that chooses each step.
- **Tools** — the actions available: APIs, databases, search, code execution. Often provided via MCP.
- **Instructions** — a system prompt defining the role, the rules, and what "done" looks like.
- **Memory** — what the agent carries forward: the current conversation and results, and sometimes longer-term notes across sessions.
- **Guardrails and limits** — maximum steps, spending caps, permission boundaries, and points where a human must approve.

## Workflows vs. agents

Not every AI system should be an agent. The choice is a spectrum:

| | Workflow | Agent |
|---|---|---|
| **Who decides the steps** | The developer, in advance | The model, at run time |
| **Predictability** | High | Lower |
| **Handles unexpected cases** | Poorly | Well |
| **Cost and latency** | Lower, fixed | Higher, variable |
| **Easy to test** | Yes | Harder |

A good rule: **use a workflow when you can write down the steps; use an agent when you can't.** Classifying incoming documents and routing them is a workflow. Investigating why an unusual transaction was calculated a certain way — where the next step depends on what you just found — is agent territory.

Many production systems mix the two: a fixed workflow with an agent handling one open-ended step.

## A worked example: investigating tax exceptions

A company's overnight process flags invoices where calculated tax doesn't match expectations. Today, an analyst investigates each one by hand. An agent could do the first pass.

**Goal:** "For each flagged invoice, determine the likely cause and recommend a fix. Don't change anything."

A run might look like this:

1. The agent pulls the first invoice and sees a ship-to address in a city with a local tax.
2. It checks the product's tax code mapping and finds the product is mapped as taxable.
3. It searches the company's tax research memos (RAG) and finds a memo saying this product category should be exempt in that state.
4. It checks the mapping history and sees the mapping changed two weeks ago.
5. It writes up the finding: likely a mapping error introduced on that date, with the evidence and the memo cited, and recommends a review.

No one scripted those steps. The agent chose each one based on what the previous one revealed. And it stopped short of making changes, because its instructions and permissions said to.

## Multi-agent systems

For larger tasks, work can be split across several agents: a coordinator that breaks down the problem and specialist agents that handle parts of it (one for data lookups, one for research, one for writing up results). This can help with complex tasks and keeps each agent's context focused. It also adds cost, latency, and more places for things to go wrong, so it's worth starting with a single agent and splitting only when there's a clear need.

## Where agents go wrong

- **Looping.** The agent repeats the same failing step. Set step limits and detect repetition.
- **Drifting.** Over a long run, it loses track of the original goal. Keep instructions clear and restate the goal in context.
- **Compounding errors.** A wrong conclusion in step 2 corrupts everything after it. Require evidence for conclusions and check key facts.
- **Too much autonomy too soon.** Giving an agent write access on day one is risky. Start read-only, add human approval for actions, and expand as trust is earned.
- **No evaluation.** Agents are harder to test than single prompts. Build a set of realistic tasks with known outcomes and measure success rate, steps taken, and cost per task.

## Getting started

1. Pick a task that's currently manual, well-bounded, and where a wrong answer is caught before it causes harm.
2. Give the agent read-only tools first.
3. Log every step so you can see how it reasons.
4. Measure it against how a person does the same task.
5. Add actions — with approval steps — only once it's reliable.

## Key takeaways

- An agent is a model choosing its own next steps in a loop of think, act, observe.
- Use workflows for known steps and agents for open-ended ones.
- Tools, instructions, memory, and limits matter as much as the model.
- Start read-only, keep a human in the loop, and measure before expanding.

**Where to go next on the map:** [Planning](/concepts/planning) · [Memory](/concepts/memory) · [Multi-Agent Systems](/concepts/multi-agent-systems) · [Guardrails](/concepts/guardrails)
