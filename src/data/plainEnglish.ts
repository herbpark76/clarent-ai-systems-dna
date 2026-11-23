/**
 * Beginner-friendly explanations for every concept on the map.
 *
 *   plain    – one sentence, no jargon. Shown under the concept name.
 *   analogy  – an everyday comparison that makes the idea stick.
 *   example  – what this looks like in a tool people already use.
 *   lesson   – slug of the Deep Dive that serves as the full lesson (optional).
 */
export interface PlainEnglish {
  plain: string;
  analogy: string;
  example: string;
  lesson?: string;
}

export const PLAIN_ENGLISH: Record<string, PlainEnglish> = {
  // ── FOUNDATION ──────────────────────────────────────────
  llms: {
    plain: 'An LLM is the AI model behind ChatGPT, Claude and Gemini. It reads text and writes text back.',
    analogy: 'Think of a very well-read autocomplete. It has seen so much writing that it can finish almost any sentence, and that turns out to be enough to answer questions, draft emails and write code.',
    example: 'When you ask ChatGPT to summarize a report, an LLM is writing the summary one word-piece at a time.',
    lesson: 'what-is-an-llm',
  },
  tokens: {
    plain: 'Tokens are the small pieces of text a model reads and writes. A word can be one token or several.',
    analogy: 'Like syllables for a computer. "Unbelievable" might be split into "un", "believ" and "able".',
    example: 'AI services charge by the token, and a chat limit like "200K tokens" is a token count, not a word count.',
    lesson: 'what-are-tokens',
  },
  'context-windows': {
    plain: 'The context window is how much text a model can look at in one go: your question, the conversation so far and any documents you pasted in.',
    analogy: 'It\'s the model\'s desk. It can see everything on the desk. Anything that falls off, it has no memory of.',
    example: 'When a long chat starts "forgetting" what you said at the start, the early messages have slid off the desk.',
    lesson: 'what-is-a-context-window',
  },
  embeddings: {
    plain: 'An embedding turns a piece of text into a list of numbers so a computer can tell which texts mean similar things.',
    analogy: 'Like giving every document a spot on a map, so documents about the same topic sit close together even when they use different words.',
    example: 'Searching your help center for "can\'t log in" and finding the article titled "Reset your password" works because of embeddings.',
    lesson: 'what-are-embeddings',
  },
  'prompt-engineering': {
    plain: 'Prompt engineering is writing instructions for an AI clearly enough that you get the answer you need, every time.',
    analogy: 'Like briefing a smart new hire. A clear brief with an example gets you much closer to what you wanted.',
    example: 'Adding "answer in three bullet points and say when you are unsure" to a request is prompt engineering.',
    lesson: 'prompt-engineering-that-holds-up-in-production',
  },

  // ── KNOWLEDGE ───────────────────────────────────────────
  'vector-databases': {
    plain: 'A vector database stores embeddings and finds the ones closest to a question, fast.',
    analogy: 'Like a library that shelves books by topic, so the librarian can grab the five most relevant in seconds.',
    example: 'A support chatbot uses one to pull the right help articles from thousands before it answers.',
    lesson: 'vector-dbs-vs-knowledge-graphs',
  },
  'knowledge-graphs': {
    plain: 'A knowledge graph stores facts as things and the links between them, like "Product A is sold in Texas".',
    analogy: 'Like a family tree, except the boxes can be customers, products or rules, and the lines say how they relate.',
    example: 'Asking "which of our products are affected by the new Texas rule?" is a question a knowledge graph answers well.',
    lesson: 'vector-dbs-vs-knowledge-graphs',
  },
  rag: {
    plain: 'RAG means looking up the right information first, then having the AI answer using it.',
    analogy: 'Like handing someone the relevant pages of the manual before you ask them a question.',
    example: 'A company assistant that answers HR questions from the actual employee handbook, and links to the page, is using RAG.',
    lesson: 'what-is-rag',
  },
  chunking: {
    plain: 'Chunking is cutting long documents into smaller passages so the AI can find and use just the part it needs.',
    analogy: 'Like adding section tabs to a thick binder. You flip straight to the right section instead of reading the whole thing.',
    example: 'A 60-page policy gets split into sections so a question about travel expenses retrieves only the travel section.',
    lesson: 'chunking-strategies-for-rag',
  },
  metadata: {
    plain: 'Metadata is the labels attached to each piece of content, like date, author, department or region.',
    analogy: 'Like the label on a file folder, which tells you what\'s inside and how current it is before you open it.',
    example: 'Filtering to "only policies effective this year" stops the AI from quoting last year\'s rules.',
  },
  search: {
    plain: 'Search is how an AI system finds the passages it needs, using keywords, meaning, or both.',
    analogy: 'Like a researcher who checks both the index at the back of a book for exact words and the table of contents for topics.',
    example: 'Finding a part number like "AX-4410" needs keyword search; finding "how do I return something" needs meaning-based search.',
  },

  // ── INTELLIGENCE ────────────────────────────────────────
  'tool-calling': {
    plain: 'Tool calling lets an AI use other software, for example to look up an order or check a calendar.',
    analogy: 'Like an assistant with a phone who knows which department to call and what to ask.',
    example: 'When an assistant checks the live weather or your order status before answering, it is calling a tool.',
    lesson: 'how-tool-calling-works',
  },
  mcp: {
    plain: 'MCP (Model Context Protocol) is a standard way to plug AI assistants into apps and data, so each connection is built once and works everywhere.',
    analogy: 'USB for AI. Before USB every device needed its own cable; MCP gives AI tools one common plug.',
    example: 'Connecting Claude to Google Drive, Slack or your CRM through a "connector" usually runs on MCP.',
    lesson: 'what-is-mcp',
  },
  agents: {
    plain: 'An agent is an AI that works through a task step by step, deciding what to do next and using tools along the way.',
    analogy: 'Asking a chatbot something is like asking a colleague a question. Using an agent is like sending them on an errand.',
    example: '"Find three flights under $400, compare them and draft an email to my manager" is a job for an agent.',
    lesson: 'what-are-ai-agents',
  },
  'multi-agent-systems': {
    plain: 'A multi-agent system splits a big job across several AI agents, each with its own role.',
    analogy: 'Like a small team where a researcher, a writer and a reviewer each hand work to the next.',
    example: 'One agent gathers sources, another drafts a report, a third checks the facts before it reaches you.',
  },
  memory: {
    plain: 'Memory lets an AI keep useful information between conversations instead of starting from zero each time.',
    analogy: 'Like a good assistant\'s notebook, where they jot down what matters from each conversation.',
    example: 'An assistant that remembers your preferred report format next week is using memory.',
    lesson: 'how-ai-agents-remember-memory-patterns',
  },
  planning: {
    plain: 'Planning is how an agent breaks a goal into steps and decides the order to do them in.',
    analogy: 'Like writing a to-do list before a project, then adjusting it when something unexpected comes up.',
    example: 'Asked to "prepare for Monday\'s board meeting", an agent first lists what to gather, then gathers it.',
  },

  // ── PRODUCTION ──────────────────────────────────────────
  evaluation: {
    plain: 'Evaluation is testing an AI system against real questions with known answers, so you know how often it is right.',
    analogy: 'Like a driving test: you check the AI can handle real roads before you hand over the keys.',
    example: 'Running 200 real customer questions through a support bot and scoring how many answers were correct.',
    lesson: 'how-to-evaluate-ai-systems',
  },
  guardrails: {
    plain: 'Guardrails are the checks that keep an AI on task and stop harmful, off-topic or private information getting out.',
    analogy: 'Like the bumpers in a bowling lane, which keep the ball out of the gutter while it still rolls on its own.',
    example: 'A banking assistant that refuses to share another customer\'s balance, however the question is phrased.',
    lesson: 'guardrails-keeping-ai-systems-safe-and-on-task',
  },
  apis: {
    plain: 'An API is how one piece of software asks another for something. It is how apps talk to AI models and to each other.',
    analogy: 'Like a restaurant waiter: you order from the menu, and the waiter brings back what the kitchen made.',
    example: 'Your company\'s app sending a question to Claude or GPT and getting the answer back is an API call.',
  },
  orchestration: {
    plain: 'Orchestration is the logic that runs an AI workflow: which step happens when, what happens if one fails, and when a person signs off.',
    analogy: 'Like the conductor of an orchestra, who decides when each section comes in.',
    example: 'Read the invoice, check it against the PO, flag mismatches for a person, then post it: orchestration runs that sequence.',
  },
  monitoring: {
    plain: 'Monitoring is watching an AI system after launch: how it is used, what it costs, and where it goes wrong.',
    analogy: 'Like the gauges on a car dashboard, which you keep an eye on for the whole trip.',
    example: 'A weekly report showing which questions the bot got wrong and how much each answer cost.',
  },
  security: {
    plain: 'Security is making sure an AI system only sees and does what it should, and can\'t be tricked into more.',
    analogy: 'Like giving a contractor a key to the one room they\'re working in, and logging when they come and go.',
    example: 'An AI agent that can read invoices but needs a person\'s approval before it pays one.',
  },
  deployment: {
    plain: 'Deployment is getting an AI system out of testing and into the hands of real users, safely.',
    analogy: 'Like a soft opening for a restaurant: a small crowd first, then wider once the kinks are worked out.',
    example: 'Releasing a new assistant to one team for two weeks before the whole company gets it.',
  },
};
