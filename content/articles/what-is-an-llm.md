---
slug: what-is-an-llm
title: What Is an LLM?
category: Foundation
readTime: 6 min read
description: What large language models are, how they produce answers, and what they can and can't be trusted to do. No technical background needed.
concepts: [llms, tokens, context-windows, prompt-engineering]
updated: 2026-11-22
---

ChatGPT, Claude and Gemini are all built on the same kind of technology: a **large language model**, or LLM. You can use one well without knowing the math. It helps to have a clear picture of what it's doing, because that explains why it's so useful and also why it sometimes gets things confidently wrong.

## The one-sentence version

An LLM is a program that has read an enormous amount of text and learned to predict what comes next.

Give it the start of a sentence and it picks a likely next piece of text. Then it adds that piece and picks the next one, and the one after that, until the answer is finished. Every reply you have ever seen from a chatbot was written this way, one small piece at a time. (Those pieces are called **tokens**. There's a [separate lesson on them](/articles/what-are-tokens).)

That sounds too simple for something that can draft a contract or debug code. But predicting the next word *well* takes a lot: grammar, facts, tone, how an argument is built, even how a spreadsheet formula works. A model that gets good enough at prediction picks those skills up along the way.

## How a model learns

Building an LLM happens in two broad stages.

1. Pre-training: the model reads a huge collection of text, such as books, websites and code. It plays the same guessing game billions of times: hide the next word, guess it, check, adjust. Over time it picks up patterns in language and a broad (but imperfect) store of general knowledge.
2. Fine-tuning: the raw model is good at continuing text but not at being a helpful assistant. So it is trained further on examples of good answers, and on feedback from people rating which responses are better. This is where it learns to follow instructions, answer questions directly and decline harmful requests.

The result is one model that handles many kinds of writing and reasoning, with no separate program for each task.

## What an LLM is good at

- Drafting, rewriting, summarizing, translating and changing the tone of text.
- Explaining a dense document in plain terms and answering follow-up questions about it.
- Pulling names, dates and amounts out of an email and into a table.
- First drafts of emails, outlines, code, test questions and meeting agendas.
- Working through a problem step by step, especially when you ask it to show its work.

## What it is not

Most of the trouble people have with AI tools comes from three misunderstandings.

**It is not a database.** The model doesn't look facts up. It produces text that sounds right based on patterns it learned. Usually that text is also correct. When it's wrong, it reads just as confidently. These made-up answers are often called **hallucinations**. They are most likely with specific details: citations, figures, names, dates and anything niche.

**It doesn't know recent events or your private information.** A model's knowledge stops at its training cutoff, and it has never seen your company's files. Ask about either and it will say it doesn't know, or guess. Systems fix this by handing the model the right documents at the moment it answers. That technique is called [RAG](/articles/what-is-rag).

**It doesn't remember you between conversations** unless the app it runs in adds a memory feature. Within one conversation, it can only see what fits in its [context window](/articles/what-is-a-context-window).

## A worked example

Say you paste a supplier's 12-page contract into a chat and ask: "What are our termination rights?"

- The model reads the contract text you gave it, along with your question.
- It writes an answer by predicting, piece by piece, the response a careful reader of *that* contract would give.
- Because the contract is right there in front of it, the answer is grounded in real text. You can ask it to quote the clauses so you can check them.

Ask the same question without pasting the contract and the model can only describe what termination clauses usually say, because it has never seen yours. That answer may sound just as sure of itself. So the most useful habit to build is to give the model the source material and ask it to point to where its answer came from.

## How to get better answers

- Be specific about the job. "Summarize this for a CFO in five bullets, and flag any dollar amounts" gets a better result than "summarize this".
- Paste in the document, data or example instead of hoping it knows.
- Ask it to check itself: "quote the sentence that supports each point" or "tell me what you're unsure about".
- Check anything that matters before you rely on it. Treat the output as a first draft from a fast, well-read colleague.

## Key takeaways

- An LLM writes by predicting the next piece of text, over and over. That one skill, done well, produces writing, summarizing and reasoning.
- It learns from huge amounts of text, then is fine-tuned to act as a helpful assistant.
- It doesn't look facts up, doesn't know your private data and can be confidently wrong. Give it sources and check what matters.
- Most of the other concepts on this site are ways around those limits, such as feeding the model the right information, connecting it to tools and checking its work.

**Where to go next on the map:** [Tokens](/concepts/tokens) · [Context Windows](/concepts/context-windows) · [Prompt Engineering](/concepts/prompt-engineering)
