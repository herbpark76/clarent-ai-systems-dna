/*
# Seed AI Concepts — Intelligence and Production clusters

Inserts 13 concepts for the Intelligence (8) and Production (5) clusters.
Uses UPSERT so the migration is safe to re-run.
*/

INSERT INTO ai_concepts
  (slug, name, category, short_description, overview, why_it_matters, why_should_i_care, common_mistakes, overview_minutes, x_position, y_position)
VALUES
  (
    'tool-calling', 'Tool Calling', 'intelligence',
    'The mechanism that allows LLMs to invoke external functions.',
    'Tool calling is the mechanism that allows LLMs to invoke external functions — APIs, code interpreters, web search — and receive their results back for continued reasoning.',
    'Tool calling transforms LLMs from text generators into systems that can interact with the real world, query live data, and take meaningful actions.',
    'Tool calling is what lets AI act in the world — booking, searching, writing, calculating. Without it, your AI can only talk; with it, it can do.',
    '["Not validating tool outputs before passing them back to the model","Allowing the model to call tools without any guardrails","Poorly documented tool schemas leading to incorrect calls","No retry or error-handling logic for failed tool calls"]'::jsonb,
    15, 668, 278
  ),
  (
    'mcp', 'MCP', 'intelligence',
    'Model Context Protocol — an open standard for connecting AI agents to tools.',
    'Model Context Protocol is an open standard for connecting AI agents to external tools, data sources, and APIs through a unified, discoverable interface.',
    'MCP enables any AI system to use any tool without custom integration for each pair — it''s the USB-C port for AI tool connectivity.',
    'MCP eliminates the custom plumbing needed to connect every AI system to every tool. A single MCP server makes your tools available to any compatible AI agent.',
    '["Building custom integrations when an MCP server already exists","Not versioning your MCP server interface","Exposing dangerous tools without access controls","Poor tool descriptions causing the model to misuse them"]'::jsonb,
    12, 793, 215
  ),
  (
    'agents', 'Agents', 'intelligence',
    'Autonomous AI systems that perceive, reason, and act to complete tasks.',
    'AI agents perceive their environment, reason about goals, select actions, execute tool calls, and loop until a task is complete — acting autonomously.',
    'Agents shift AI from answering questions to completing tasks — the transition from assistant to autonomous worker that can handle open-ended goals.',
    'Agents are what move AI from answering questions to completing tasks. They''re the architecture behind every AI workflow that does something, not just says something.',
    '["No maximum iteration limit — agents can loop forever","Missing observability into what the agent is doing and why","Over-trusting agent outputs for high-stakes actions without review","Building a single god-agent instead of specialized agents with clear scopes"]'::jsonb,
    22, 718, 415
  ),
  (
    'multi-agent-systems', 'Multi-Agent Systems', 'intelligence',
    'Networks of specialized agents that collaborate on complex tasks.',
    'Multi-agent systems are networks of specialized agents that collaborate, delegate tasks, and check each other''s work to solve problems too complex for a single agent.',
    'Multi-agent systems unlock parallelism and specialization — they can tackle complex, long-horizon tasks that would overwhelm or misdirect a single agent.',
    'Multi-agent systems let you parallelize complex work and have specialized agents check each other''s outputs — dramatically increasing reliability for long-horizon tasks.',
    '["No clear communication protocol between agents","Agents with overlapping, undefined scopes","Missing a coordinator agent for task decomposition","No shared memory or state management between agents"]'::jsonb,
    18, 848, 355
  ),
  (
    'memory', 'Memory', 'intelligence',
    'Systems that let AI agents retain and retrieve context across interactions.',
    'Memory systems let AI agents retain and retrieve context across interactions — from short-term conversation buffers to long-term semantic memory in vector stores.',
    'Memory turns one-shot interactions into persistent working relationships and allows agents to learn from prior experience over time.',
    'Without memory, every conversation starts from zero. Memory is what transforms a chatbot into an assistant that actually knows who you are and what you''ve done before.',
    '["Storing everything — memory becomes too noisy to be useful","Not distinguishing short-term, long-term, and episodic memory","Retrieving memories without relevance filtering","No memory cleanup or archiving strategy over time"]'::jsonb,
    14, 663, 522
  ),
  (
    'planning', 'Planning', 'intelligence',
    'How agents decompose goals into ordered action sequences.',
    'Planning is the process by which agents decompose complex goals into sequences of steps, reason about dependencies, and decide which actions to take and in what order.',
    'Planning separates reliable agents from unpredictable ones. It determines how well an agent handles multi-step problems and recovers from failures.',
    'Planning is what separates agents that reliably accomplish multi-step goals from agents that get confused and loop. It''s the cognitive backbone of effective autonomous systems.',
    '["No plan validation before execution begins","Rigid plans that can''t adapt when intermediate steps fail","Over-planning simple tasks that don''t need decomposition","Missing feedback loops that let the agent revise mid-execution"]'::jsonb,
    15, 812, 482
  ),
  (
    'evaluation', 'Evaluation', 'intelligence',
    'Systematically measuring AI system quality at scale.',
    'Evaluation is the discipline of systematically measuring AI system quality — accuracy, relevance, faithfulness, safety, and robustness — at scale in production.',
    'You can''t improve what you can''t measure. Evals are the engineering discipline that transforms AI from demo-quality to production-grade.',
    'Without evaluation, you''re deploying AI blind. Evals turn "it feels good" into "it scores 94% on our test suite" — and let you ship with real confidence.',
    '["Only evaluating happy-path examples, not edge cases","Using the LLM to evaluate itself without reference data","Building evals after the system is already in production","Treating evaluation as a one-time step rather than a continuous process"]'::jsonb,
    20, 712, 605
  ),
  (
    'guardrails', 'Guardrails', 'intelligence',
    'Safety layers that validate and constrain AI inputs and outputs.',
    'Guardrails are safety layers that validate, filter, and constrain AI inputs and outputs — enforcing behavioral boundaries and blocking harmful or off-topic responses.',
    'Guardrails are what separate a demo from a production system. They make AI behavior predictable, safe, and auditable at scale.',
    'Guardrails are what prevent your AI from embarrassing you — or causing real harm. They''re the safety net between the demo and the production system.',
    '["Adding guardrails only to output, not to input","Overly aggressive filters that block legitimate use cases","Hard-coding guardrail rules instead of making them configurable","Not testing adversarial inputs against your guardrails"]'::jsonb,
    14, 872, 565
  ),
  (
    'apis', 'APIs', 'production',
    'Exposing AI capabilities as services over HTTP.',
    'APIs expose AI capabilities as services — allowing other systems to call models, tools, and agents over HTTP using standard request/response patterns.',
    'APIs are how AI capabilities get packaged and delivered to applications at scale, separating the AI logic from the consuming application.',
    'APIs are how your AI capabilities become products. They''re the interface that lets applications, mobile apps, and integrations consume what you''ve built.',
    '["No rate limiting or cost controls on LLM-backed endpoints","Returning raw model outputs without any validation layer","Not versioning your API from day one","Missing auth and abuse prevention on public endpoints"]'::jsonb,
    12, 988, 278
  ),
  (
    'orchestration', 'Orchestration', 'production',
    'Coordinating LLM calls, tools, and agent actions across complex workflows.',
    'Orchestration is the coordination layer that sequences LLM calls, tool invocations, retrieval steps, and agent actions across complex, multi-step workflows.',
    'Orchestration turns individual AI calls into reliable, repeatable, observable pipelines — the difference between a script and a production system.',
    'Orchestration is the difference between an AI demo and a reliable system. It''s what makes AI workflows repeatable, observable, and maintainable as they grow.',
    '["No retry logic for transient LLM failures","Hardcoded step ordering that can''t adapt to partial failures","Missing observability into what happened in a pipeline run","Not treating AI steps as potentially slow and expensive operations"]'::jsonb,
    16, 1050, 418
  ),
  (
    'monitoring', 'Monitoring', 'production',
    'Tracking AI system behavior and quality in production.',
    'Monitoring tracks AI system behavior, performance, cost, latency, errors, and output quality in production through structured logging and observability tooling.',
    'AI systems degrade silently without monitoring. Visibility into what''s happening — and why — is what makes production AI maintainable.',
    'AI systems degrade silently — model updates, data drift, and edge cases accumulate without monitoring. Visibility is what makes AI maintainable after launch.',
    '["Only monitoring infrastructure metrics, not AI quality metrics","No alerting when output quality degrades over time","Not logging enough context to reproduce production failures","Skipping monitoring because it''s not in the MVP scope"]'::jsonb,
    14, 975, 522
  ),
  (
    'security', 'Security', 'production',
    'Protecting AI systems from prompt injection, leakage, and adversarial misuse.',
    'AI security covers the practices and controls that protect AI systems from prompt injection, data leakage, model theft, and adversarial misuse.',
    'AI systems introduce unique attack surfaces that require specialized defense. Security is not optional in production deployments.',
    'AI systems introduce attack surfaces that traditional security misses — prompt injection, data exfiltration via the model, and adversarial manipulation of agent behavior.',
    '["Assuming the LLM will resist prompt injection on its own","Exposing sensitive data in the retrieval context","No input sanitization before sending user content to the model","Over-trusting model outputs in agent tool calls"]'::jsonb,
    15, 1098, 565
  ),
  (
    'deployment', 'Deployment', 'production',
    'Shipping AI systems to production reliably and at scale.',
    'Deployment is the process of shipping AI systems to production — packaging models, configuring serving infrastructure, scaling, and maintaining them reliably over time.',
    'An AI system that isn''t in production delivers no value. Deployment is where research becomes reality, and where reliability becomes non-negotiable.',
    'A model that isn''t in production delivers zero value. Deployment decisions directly affect cost, latency, reliability, and your ability to iterate quickly.',
    '["No rollback strategy when a deployed model behaves unexpectedly","Deploying without load testing AI endpoints","Missing cost controls on inference spend","Not planning for model deprecation and version migration"]'::jsonb,
    14, 1158, 442
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  short_description = EXCLUDED.short_description,
  overview = EXCLUDED.overview,
  why_it_matters = EXCLUDED.why_it_matters,
  why_should_i_care = EXCLUDED.why_should_i_care,
  common_mistakes = EXCLUDED.common_mistakes,
  overview_minutes = EXCLUDED.overview_minutes,
  x_position = EXCLUDED.x_position,
  y_position = EXCLUDED.y_position,
  updated_at = now();
