---
slug: what-are-tokens
title: What Are Tokens?
category: Foundation
readTime: 5 min read
description: The small pieces of text AI models actually read and write, and why they decide what you pay, how much fits in a chat and some odd model mistakes.
concepts: [tokens, llms, context-windows]
updated: 2026-11-22
---

AI models read text in **tokens**: small chunks that might be a whole word, part of a word, a space or a punctuation mark. You rarely see them, but they decide what an AI tool costs and how much text fits in one conversation. They also explain some of the odd mistakes models make.

## What a token looks like

Before a model sees your text, a program called a **tokenizer** chops it into pieces from a fixed vocabulary of common chunks.

- Common short words are usually one token: "the", "invoice", "report".
- Longer or rarer words get split: "unbelievable" might become "un" + "believ" + "able".
- Spaces, punctuation and capital letters often change how text is split.
- Numbers, code and unusual names tend to break into many small tokens.

Each model family has its own tokenizer, so the same sentence can be a slightly different number of tokens in ChatGPT and in Claude.

## The rule of thumb

For everyday English text:

- 1 token is about 4 characters, or roughly three-quarters of a word.
- 100 tokens is about 75 words.
- A typical single-spaced page is around 500 to 700 tokens.

These are averages. Many other languages, as well as spreadsheets, code and long numbers, use noticeably more tokens for the same amount of meaning.

## Why tokens matter to you

### 1. They are how AI is priced

AI services that charge for usage, especially through an API, bill per token, usually quoted per million tokens. There are two meters running:

- Input tokens are everything you send, including your question, any pasted documents and, in a chat, the earlier messages too.
- Output tokens are everything the model writes back. These usually cost several times more per token than input.

So a short question about a 50-page document is a big request. The model reads all 50 pages every time you ask, and you pay for that reading.

### 2. They set the size limit

Every model has a maximum number of tokens it can handle at once, called its [context window](/articles/what-is-a-context-window). Your messages, any files, the conversation history and the model's reply all count toward it. When people say a model has a "200K context", they mean 200,000 tokens.

### 3. They explain some odd mistakes

The model sees chunks of text, so it can stumble on tasks that depend on individual characters, like counting the letters in a word or doing long arithmetic digit by digit. Asking it to work through the problem step by step, or to use a calculator tool, usually fixes this.

## A worked example: what does a question cost?

A finance analyst pastes a 30-page vendor agreement into an AI tool and asks five follow-up questions in the same chat.

- The agreement is about 30 × 600 = 18,000 tokens.
- Each question resends the agreement plus the conversation so far. By the fifth question, the model is reading well over 20,000 tokens of input.
- Across five questions that's roughly 100,000 input tokens, plus a few thousand output tokens for the answers.

On a flat-rate chat subscription you won't see a bill for this, but it counts toward your usage limits. In a company system paying per token, the same pattern repeated across hundreds of users adds up fast. That's why well-built systems retrieve only the relevant pages instead of sending the whole document every time. See [RAG](/articles/what-is-rag) and [chunking](/articles/chunking-strategies-for-rag).

## Practical habits

- When you can, paste only the relevant section of a file.
- Start a new chat for a new topic. A long conversation carries its whole history into every new question.
- Ask for the length you need. "In 100 words" saves output tokens and usually gives a better answer.
- For exact counts and other character-level tasks, ask the model to use a tool, or check the result yourself.

## Key takeaways

- Tokens are the chunks of text models read and write. In English, one token is about three-quarters of a word.
- You pay per token, for input and output, and output usually costs more.
- Everything in the conversation counts toward the model's token limit, every time.
- Seeing chunks instead of letters is why models can stumble on spelling and counting tasks.

**Where to go next on the map:** [Context Windows](/concepts/context-windows) · [LLMs](/concepts/llms) · [Chunking](/concepts/chunking)
