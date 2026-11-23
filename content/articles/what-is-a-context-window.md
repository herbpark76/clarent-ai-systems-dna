---
slug: what-is-a-context-window
title: What Is a Context Window?
category: Foundation
readTime: 5 min read
description: Why AI models "forget" things mid-conversation, why long documents sometimes get half-read, and how to work within the limit.
concepts: [context-windows, tokens, llms, memory, rag]
updated: 2026-11-22
---

If a long chat with an AI has ever lost track of something you said at the start, you've run into its **context window**. Knowing how it works explains a lot of AI behavior that otherwise seems random.

## The short version

The context window is everything a model can see at one moment: its instructions, your question, the conversation so far, any files you shared and the reply it is writing. It's measured in [tokens](/articles/what-are-tokens), and every model has a maximum.

Picture a desk. The model can read and use whatever is on the desk. Anything that doesn't fit is invisible to it. There's no filing cabinet underneath, and the model can't go and look something up unless the system around it is built to do that.

## How big is the desk?

Context windows have grown quickly. Depending on the model, they now range from tens of thousands of tokens to over a million. As a rough guide, 100,000 tokens is around 75,000 words, about the length of a novel.

For a single question that's usually plenty. The desk still fills up faster than you'd expect:

- The whole conversation is resent each turn. The model has no memory of your earlier messages, so the app puts them back on the desk every time you send a new one.
- A few long PDFs or a big spreadsheet can take up most of the space on their own.
- The model's reply is written into the same window, so it needs room too.
- The app adds its own instructions, and sometimes tool or search results, which you don't see.

## What happens when it's full

Apps handle a full window in different ways:

- They drop or cut older messages, which is why the start of a long chat gets "forgotten".
- They summarize the conversation to save space, so early details survive only in shortened form.
- They show an error or ask you to start a new chat.

Very long inputs can make answers less reliable even before the desk is full. A model may pay less attention to material buried in the middle of a long document than to what's at the start or end. So a large window lets the model see more text, but it may still miss a detail in the middle.

## A worked example

An operations manager uploads three months of meeting notes (about 90 pages) and asks, "What did we decide about the vendor change in August?"

- If everything fits, the model can find the August notes and answer. But the notes are long and the answer depends on one paragraph, so it's worth asking the model to quote the decision and give the meeting date.
- If it doesn't fit, the app may drop or shorten some notes, and the August decision might not be on the desk at all. The model may then answer from whatever it *can* see, which is how you get a confident answer about the wrong meeting.

A better approach is to send only what's relevant: the August notes, or a search over the notes that pulls back the right passages. That's the idea behind [RAG](/articles/what-is-rag), where the system fetches the few pages that matter for each question.

## Context window vs. memory

These are often confused.

| | Context window | Memory |
| --- | --- | --- |
| What it is | What the model can see right now | Notes saved for later conversations |
| How long it lasts | One request | Across sessions, if the app supports it |
| Who manages it | Filled automatically each turn | The app decides what's worth saving |
| Size | Fixed maximum, in tokens | Small. Only key facts are kept |

Memory works by putting a few saved notes back onto the desk at the start of a new conversation. It still has to fit in the context window. See [how AI agents remember](/articles/how-ai-agents-remember-memory-patterns).

## Practical habits

- Start a fresh chat for a new task. It clears the desk so old details don't get mixed in.
- Put the most important instructions and material up front, and repeat key constraints near your question in long chats.
- Share the relevant part of an archive when you can.
- With long documents, ask for quotes or page references so you can check it used the right part.
- If it starts forgetting, ask it to summarize the decisions so far, then start a new chat with that summary.

## Key takeaways

- The context window is the model's desk: everything it can see in one request, measured in tokens.
- The conversation history, files, hidden instructions and the reply all share that space.
- When it's full, apps drop or summarize older content, which is the "forgetting" you notice.
- Bigger windows help, but sending only what's relevant still gives better, cheaper answers.

**Where to go next on the map:** [Embeddings](/concepts/embeddings) · [RAG](/concepts/rag) · [Memory](/concepts/memory)
