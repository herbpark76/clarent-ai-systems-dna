export type ProgressStatus = 'not-started' | 'in-progress' | 'completed';

export interface NextStep {
  id: string;
  reason: string;
}

export interface Roadmap {
  id: string;
  label: string;
  description: string;
  estimatedHours: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  conceptIds: string[];
  pipeline: string[];
  nextSteps: Record<string, NextStep>;
}

export const ROADMAP_GOALS = [
  'Internal Knowledge Assistant',
  'Customer Support Bot',
  'AI Research Assistant',
  'Workflow Automation',
  'AI Agent',
  'Coding Assistant',
  'Enterprise Search',
  'AI SaaS Product',
  'Domain Intelligence Platform',
] as const;

export type RoadmapGoal = typeof ROADMAP_GOALS[number];

export const ROADMAPS: Roadmap[] = [
  {
    id: 'knowledge-assistant',
    label: 'Internal Knowledge Assistant',
    description: 'Build an AI system that answers questions from your company\'s internal documents, wikis, and knowledge bases.',
    estimatedHours: '6–8 hours',
    difficulty: 'Intermediate',
    conceptIds: ['llms', 'prompt-engineering', 'embeddings', 'chunking', 'vector-databases', 'search', 'rag', 'evaluation'],
    pipeline: ['Documents', 'Chunking', 'Embeddings', 'Vector Database', 'Search', 'RAG', 'LLM', 'Evaluation'],
    nextSteps: {
      'llms': { id: 'prompt-engineering', reason: 'Prompts determine how well the LLM uses retrieved knowledge — highest leverage next step.' },
      'prompt-engineering': { id: 'embeddings', reason: 'Embeddings are how your documents become searchable by meaning.' },
      'embeddings': { id: 'chunking', reason: 'Chunking determines how embeddings are created for retrieval.' },
      'chunking': { id: 'vector-databases', reason: 'Vector databases store your embedded chunks and make them searchable at scale.' },
      'vector-databases': { id: 'search', reason: 'Search is how you find the right chunks for a given question.' },
      'search': { id: 'rag', reason: 'RAG combines your search results with the LLM to generate grounded answers.' },
      'rag': { id: 'evaluation', reason: 'Evaluation tells you whether your knowledge assistant is actually working correctly.' },
    },
  },
  {
    id: 'support-bot',
    label: 'Customer Support Bot',
    description: 'Build an AI system that resolves customer inquiries using your product documentation and support history.',
    estimatedHours: '5–7 hours',
    difficulty: 'Beginner',
    conceptIds: ['llms', 'prompt-engineering', 'embeddings', 'chunking', 'vector-databases', 'rag', 'guardrails', 'evaluation'],
    pipeline: ['Knowledge Base', 'Chunking', 'Embeddings', 'Vector DB', 'RAG', 'LLM', 'Guardrails', 'Response'],
    nextSteps: {
      'llms': { id: 'prompt-engineering', reason: 'Prompt engineering controls tone, scope, and safety — critical for customer-facing bots.' },
      'prompt-engineering': { id: 'embeddings', reason: 'Embeddings are how your support docs become semantically searchable.' },
      'embeddings': { id: 'chunking', reason: 'Good chunking directly improves answer quality.' },
      'chunking': { id: 'vector-databases', reason: 'Store and search your chunked support content.' },
      'vector-databases': { id: 'rag', reason: 'RAG grounds your bot\'s answers in real support documentation.' },
      'rag': { id: 'guardrails', reason: 'Guardrails keep customer-facing AI responses safe and on-topic.' },
      'guardrails': { id: 'evaluation', reason: 'Evaluate your bot before customers do.' },
    },
  },
  {
    id: 'research-assistant',
    label: 'AI Research Assistant',
    description: 'Build an agent that searches, synthesizes, and summarizes research across multiple sources.',
    estimatedHours: '10–12 hours',
    difficulty: 'Advanced',
    conceptIds: ['llms', 'prompt-engineering', 'embeddings', 'chunking', 'vector-databases', 'search', 'rag', 'tool-calling', 'agents', 'memory', 'evaluation'],
    pipeline: ['Sources', 'Embeddings', 'Vector DB', 'Search', 'RAG', 'Agent', 'Tool Calling', 'Memory', 'Summary'],
    nextSteps: {
      'llms': { id: 'prompt-engineering', reason: 'Prompts control how the agent reasons about and synthesizes research.' },
      'prompt-engineering': { id: 'embeddings', reason: 'Embeddings let the assistant search research by meaning.' },
      'embeddings': { id: 'chunking', reason: 'Chunking determines what gets embedded from source documents.' },
      'chunking': { id: 'vector-databases', reason: 'Vector databases hold your research corpus.' },
      'vector-databases': { id: 'search', reason: 'Search is how the agent finds relevant content.' },
      'search': { id: 'rag', reason: 'RAG synthesizes search results into coherent answers.' },
      'rag': { id: 'tool-calling', reason: 'Tool calling lets the agent fetch fresh data and use external APIs.' },
      'tool-calling': { id: 'agents', reason: 'Agents loop, plan, and invoke tools autonomously.' },
      'agents': { id: 'memory', reason: 'Memory lets the agent build on prior research sessions.' },
      'memory': { id: 'evaluation', reason: 'Evaluate research quality and factual accuracy.' },
    },
  },
  {
    id: 'workflow-automation',
    label: 'Workflow Automation',
    description: 'Build AI-powered workflows that automate multi-step business processes using tools and APIs.',
    estimatedHours: '8–10 hours',
    difficulty: 'Intermediate',
    conceptIds: ['llms', 'prompt-engineering', 'tool-calling', 'agents', 'orchestration', 'apis', 'monitoring'],
    pipeline: ['Trigger', 'LLM', 'Tool Calling', 'Agent', 'Orchestration', 'APIs', 'Monitoring'],
    nextSteps: {
      'llms': { id: 'prompt-engineering', reason: 'Prompts define what the workflow understands and produces.' },
      'prompt-engineering': { id: 'tool-calling', reason: 'Tool calling lets your workflow interact with external systems.' },
      'tool-calling': { id: 'agents', reason: 'Agents provide the loop that drives multi-step automation.' },
      'agents': { id: 'orchestration', reason: 'Orchestration sequences and coordinates the workflow steps reliably.' },
      'orchestration': { id: 'apis', reason: 'APIs expose and consume the AI capabilities powering your workflow.' },
      'apis': { id: 'monitoring', reason: 'Monitoring ensures your automations don\'t fail silently.' },
    },
  },
  {
    id: 'ai-agent',
    label: 'AI Agent',
    description: 'Build an autonomous agent that can plan, reason, and act across multiple tools to accomplish open-ended goals.',
    estimatedHours: '10–14 hours',
    difficulty: 'Advanced',
    conceptIds: ['llms', 'prompt-engineering', 'tool-calling', 'mcp', 'agents', 'planning', 'memory', 'evaluation', 'guardrails'],
    pipeline: ['Goal', 'LLM', 'Planning', 'Tool Calling', 'MCP', 'Memory', 'Evaluation', 'Guardrails'],
    nextSteps: {
      'llms': { id: 'prompt-engineering', reason: 'The system prompt is the agent\'s instruction set — get it right first.' },
      'prompt-engineering': { id: 'tool-calling', reason: 'Tool calling is the mechanism that lets your agent act.' },
      'tool-calling': { id: 'mcp', reason: 'MCP standardizes tool connectivity for your agent.' },
      'mcp': { id: 'agents', reason: 'Agents orchestrate reasoning, tools, and memory into an autonomous loop.' },
      'agents': { id: 'planning', reason: 'Planning makes your agent reliable on multi-step problems.' },
      'planning': { id: 'memory', reason: 'Memory lets your agent retain context across interactions.' },
      'memory': { id: 'evaluation', reason: 'Evaluate agent behavior systematically before deploying.' },
      'evaluation': { id: 'guardrails', reason: 'Guardrails constrain agent behavior within safe boundaries.' },
    },
  },
  {
    id: 'coding-assistant',
    label: 'Coding Assistant',
    description: 'Build an AI coding assistant that understands your codebase, suggests completions, and helps debug.',
    estimatedHours: '6–8 hours',
    difficulty: 'Intermediate',
    conceptIds: ['llms', 'context-windows', 'prompt-engineering', 'embeddings', 'chunking', 'rag', 'tool-calling', 'mcp'],
    pipeline: ['Codebase', 'Chunking', 'Embeddings', 'RAG', 'Context Window', 'LLM', 'Tool Calling', 'MCP'],
    nextSteps: {
      'llms': { id: 'context-windows', reason: 'Context windows determine how much code the model can see at once.' },
      'context-windows': { id: 'prompt-engineering', reason: 'Effective system prompts shape how the model reasons about code.' },
      'prompt-engineering': { id: 'embeddings', reason: 'Embeddings let you search the codebase by meaning, not just filename.' },
      'embeddings': { id: 'chunking', reason: 'Chunking code into functions and modules improves retrieval quality.' },
      'chunking': { id: 'rag', reason: 'RAG injects relevant code context into the LLM\'s prompt.' },
      'rag': { id: 'tool-calling', reason: 'Tool calling lets the assistant run tests, read files, and search.' },
      'tool-calling': { id: 'mcp', reason: 'MCP connects the assistant to your IDE and development tools.' },
    },
  },
  {
    id: 'enterprise-search',
    label: 'Enterprise Search',
    description: 'Build a semantic search system across unstructured enterprise data with filtering, faceting, and relevance ranking.',
    estimatedHours: '8–10 hours',
    difficulty: 'Intermediate',
    conceptIds: ['embeddings', 'chunking', 'metadata', 'vector-databases', 'knowledge-graphs', 'search', 'rag', 'evaluation', 'guardrails'],
    pipeline: ['Documents', 'Chunking', 'Metadata', 'Embeddings', 'Vector DB + KG', 'Search', 'RAG', 'Guardrails'],
    nextSteps: {
      'embeddings': { id: 'chunking', reason: 'Chunking is what you embed — it determines your search granularity.' },
      'chunking': { id: 'metadata', reason: 'Metadata filtering dramatically improves search precision.' },
      'metadata': { id: 'vector-databases', reason: 'Vector databases store and search your embedded chunks with metadata.' },
      'vector-databases': { id: 'knowledge-graphs', reason: 'Knowledge graphs add structured entity relationships for more precise retrieval.' },
      'knowledge-graphs': { id: 'search', reason: 'Search combines vector similarity with graph traversal and keyword matching.' },
      'search': { id: 'rag', reason: 'RAG synthesizes search results into coherent answers.' },
      'rag': { id: 'evaluation', reason: 'Evaluate retrieval and generation quality independently.' },
      'evaluation': { id: 'guardrails', reason: 'Guardrails enforce access controls and prevent data leakage.' },
    },
  },
  {
    id: 'ai-saas',
    label: 'AI SaaS Product',
    description: 'Build and ship a production AI product with APIs, authentication, monitoring, security, and scalable deployment.',
    estimatedHours: '16–20 hours',
    difficulty: 'Advanced',
    conceptIds: ['llms', 'prompt-engineering', 'rag', 'agents', 'tool-calling', 'apis', 'orchestration', 'evaluation', 'guardrails', 'monitoring', 'security', 'deployment'],
    pipeline: ['User', 'API', 'Orchestration', 'LLM + Agent', 'Guardrails', 'Monitoring', 'Security', 'Deployment'],
    nextSteps: {
      'llms': { id: 'prompt-engineering', reason: 'Prompts are your core product logic — define them precisely.' },
      'prompt-engineering': { id: 'rag', reason: 'RAG grounds your product in real knowledge.' },
      'rag': { id: 'agents', reason: 'Agents power the autonomous features that differentiate AI products.' },
      'agents': { id: 'tool-calling', reason: 'Tool calling is how your agent interacts with the world.' },
      'tool-calling': { id: 'apis', reason: 'APIs expose your AI capabilities to users.' },
      'apis': { id: 'orchestration', reason: 'Orchestration makes multi-step AI workflows reliable.' },
      'orchestration': { id: 'evaluation', reason: 'Evaluation drives continuous improvement of your product.' },
      'evaluation': { id: 'guardrails', reason: 'Guardrails are mandatory before going to production.' },
      'guardrails': { id: 'monitoring', reason: 'Monitoring keeps your production system healthy.' },
      'monitoring': { id: 'security', reason: 'Security protects your product and your users\' data.' },
      'security': { id: 'deployment', reason: 'Deployment is the final step to shipping your AI product.' },
    },
  },
  {
    id: 'domain-platform',
    label: 'Domain Intelligence Platform',
    description: 'Build a full domain intelligence platform using the AI DNA Framework — applying AI to a specialized vertical with structured domain knowledge.',
    estimatedHours: '20+ hours',
    difficulty: 'Advanced',
    conceptIds: ['llms', 'embeddings', 'knowledge-graphs', 'chunking', 'vector-databases', 'rag', 'agents', 'mcp', 'orchestration', 'evaluation', 'guardrails', 'monitoring', 'security', 'deployment'],
    pipeline: ['Domain Data', 'Knowledge Graph', 'Embeddings', 'Vector DB', 'RAG', 'Agents', 'MCP', 'Orchestration', 'Production'],
    nextSteps: {
      'llms': { id: 'embeddings', reason: 'Embeddings are how you make domain knowledge semantically searchable.' },
      'embeddings': { id: 'knowledge-graphs', reason: 'Knowledge graphs encode domain relationships that embeddings can\'t capture alone.' },
      'knowledge-graphs': { id: 'chunking', reason: 'Chunk domain documents to feed into the knowledge pipeline.' },
      'chunking': { id: 'vector-databases', reason: 'Store embedded domain chunks for semantic retrieval.' },
      'vector-databases': { id: 'rag', reason: 'RAG grounds your platform in real domain knowledge.' },
      'rag': { id: 'agents', reason: 'Agents apply domain knowledge to accomplish complex tasks.' },
      'agents': { id: 'mcp', reason: 'MCP connects agents to domain-specific tools and data sources.' },
      'mcp': { id: 'orchestration', reason: 'Orchestration coordinates the full domain intelligence workflow.' },
      'orchestration': { id: 'evaluation', reason: 'Evaluate domain-specific quality metrics.' },
      'evaluation': { id: 'guardrails', reason: 'Domain platforms need specialized guardrails for their use case.' },
      'guardrails': { id: 'monitoring', reason: 'Monitor domain-specific performance and data quality.' },
      'monitoring': { id: 'security', reason: 'Protect sensitive domain data and access controls.' },
      'security': { id: 'deployment', reason: 'Deploy your domain intelligence platform at scale.' },
    },
  },
];

export const GOAL_TO_ROADMAP_ID: Record<string, string> = {
  'Internal Knowledge Assistant': 'knowledge-assistant',
  'Customer Support Bot': 'support-bot',
  'AI Research Assistant': 'research-assistant',
  'Workflow Automation': 'workflow-automation',
  'AI Agent': 'ai-agent',
  'Coding Assistant': 'coding-assistant',
  'Enterprise Search': 'enterprise-search',
  'AI SaaS Product': 'ai-saas',
  'Domain Intelligence Platform': 'domain-platform',
};
