export interface LearningPathDef {
  id: string;
  level: string;
  label: string;
  description: string;
  color: string;
  badge: string;
  conceptIds: string[];
}

export const LEARNING_PATH_DEFS: LearningPathDef[] = [
  {
    id: 'beginner',
    level: 'Beginner',
    label: 'Understand the Basics',
    description: 'No background required. Understand what these systems are, why they matter, and how the pieces fit together.',
    color: 'from-sky-500/20 to-sky-400/5',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    conceptIds: [
      'llms',
      'tokens',
      'context-windows',
      'embeddings',
      'prompt-engineering',
      'chunking',
      'rag',
    ],
  },
  {
    id: 'builder',
    level: 'Builder',
    label: 'Build AI-Powered Workflows',
    description: 'For developers ready to ship. Build your first RAG pipeline, wire up tool-calling agents, and handle memory.',
    color: 'from-emerald-500/20 to-emerald-400/5',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    conceptIds: [
      'llms',
      'prompt-engineering',
      'embeddings',
      'chunking',
      'vector-databases',
      'search',
      'rag',
      'tool-calling',
      'agents',
      'memory',
    ],
  },
  {
    id: 'architect',
    level: 'Architect',
    label: 'Design Production AI Systems',
    description: 'For engineers designing systems at scale. Covers evaluation, observability, orchestration, and production hardening.',
    color: 'from-orange-500/20 to-orange-400/5',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    conceptIds: [
      'rag',
      'agents',
      'planning',
      'multi-agent-systems',
      'evaluation',
      'guardrails',
      'orchestration',
      'monitoring',
      'security',
      'deployment',
    ],
  },
  {
    id: 'domain-builder',
    level: 'Domain Platform Builder',
    label: 'Apply AI to Specialized Domains',
    description: 'For teams building domain intelligence platforms using the AI DNA Framework.',
    color: 'from-rose-500/20 to-rose-400/5',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    conceptIds: [
      'llms',
      'embeddings',
      'knowledge-graphs',
      'chunking',
      'vector-databases',
      'rag',
      'agents',
      'mcp',
      'tool-calling',
      'orchestration',
      'deployment',
    ],
  },
];
