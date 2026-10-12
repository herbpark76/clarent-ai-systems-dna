import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = "claude-sonnet-5";
const MIN_EXTRACTED_TEXT = 500;

interface SourceObj {
  name: string | null;
  date: string | null;
  url: string | null;
}

interface RecentEntry {
  id: string;
  title: string;
  type: string;
  system_layer: string;
  model_name: string | null;
}

interface ProcessedEntry {
  type: string;
  system_layer: string | null;
  title: string;
  summary: string;
  why_it_matters?: string | null;
  how_its_built?: string | null;
  business_angle?: string | null;
  steps?: Array<{ text: string; prompt?: string }> | null;
  tags?: string[] | null;
  role_tags?: string[] | null;
  model_name?: string | null;
  vendor?: string | null;
  benchmark_score?: number | null;
  benchmark_name?: string | null;
  price_input?: string | null;
  price_output?: string | null;
  source_url?: string | null;
  result?: string | null;
  duplicate_of_id?: string | null;
  duplicate_of_title?: string | null;
}

// ── Type / layer constants ─────────────────────────────
const VALID_TYPES = new Set(["news", "tutorial", "use_case", "tool", "model_release", "risk"]);
const VALID_LAYERS = new Set(["model", "agent", "tools_connectors", "data_context", "evals", "security_governance", "interface"]);
const NULLABLE_LAYER_TYPES = new Set(["news"]);

const TYPE_ALIASES: Record<string, string> = {
  industry: "news", breaking: "news", announcement: "news", update: "news", release: "news",
  product: "tool", feature: "tool", framework: "tool",
  case_study: "use_case", walkthrough: "tutorial", guide: "tutorial", howto: "tutorial",
  vulnerability: "risk", security: "risk", compliance: "risk",
};

function normalizeType(rawType: string): string | null {
  const t = String(rawType).toLowerCase().trim();
  if (VALID_TYPES.has(t)) return t;
  if (TYPE_ALIASES[t]) return TYPE_ALIASES[t];
  return null;
}

// ── Title cleaning ─────────────────────────────────────
const TITLE_PREFIXES = [
  /^(roundtable|community\s*(ai\s*)?workflow|sponsored|deep\s*dive|quick\s*hit|bitesized|byte\s*sized|in\s*focus|spotlight|editor's\s*note|top\s*story|featured|breaking|update|exclusive|sneak\s*peek|q&a|ask\s*the\s*community|reader\s*question)\s*[:\-—–]\s*/i,
  /^(\d+\.|\#)\s+/i,
];

function cleanTitle(title: string): string {
  let cleaned = title.trim();
  for (const pat of TITLE_PREFIXES) {
    cleaned = cleaned.replace(pat, "");
  }
  return cleaned.trim();
}

// ── Quality review ─────────────────────────────────────
interface ReviewResult {
  status: "ready_for_review" | "needs_attention";
  notes: string[];
  cleaned_title?: string;
}

function reviewEntry(entry: ProcessedEntry): ReviewResult {
  const notes: string[] = [];
  const title = entry.title || "";
  const cleanedTitle = cleanTitle(title);

  // Check for newsletter prefixes in title
  if (cleanedTitle !== title) {
    notes.push(`Title had newsletter prefix; cleaned from "${title.slice(0, 60)}" to "${cleanedTitle.slice(0, 60)}"`);
  }

  // Tutorial must have steps
  if (entry.type === "tutorial") {
    const steps = entry.steps || [];
    if (steps.length === 0) {
      notes.push("Tutorial has no steps — source may not provide actionable instructions");
    }
  }

  // Use case should have result
  if (entry.type === "use_case") {
    if (!entry.result && !entry.how_its_built) {
      notes.push("Use case missing result/outcome — source may not provide enough detail");
    }
  }

  // Title too short or too long
  if (cleanedTitle.length < 10) {
    notes.push("Title is very short — may need more detail");
  }
  if (cleanedTitle.length > 200) {
    notes.push("Title is very long — consider trimming");
  }

  // Summary too short
  if ((entry.summary || "").length < 30) {
    notes.push("Summary is very short — may need more detail");
  }

  // Model release without model_name
  if (entry.type === "model_release" && !entry.model_name) {
    notes.push("Model release has no model_name");
  }

  // No system_layer on non-news type
  if (entry.system_layer === null && entry.type !== "news" && entry.type !== "use_case") {
    notes.push(`Type "${entry.type}" has no system_layer — verify this is correct`);
  }

  // Check for invented benchmark scores
  if (entry.benchmark_score !== null && entry.benchmark_score !== undefined) {
    if (typeof entry.benchmark_score !== "number" || isNaN(entry.benchmark_score)) {
      notes.push("Benchmark score is not a valid number");
    }
  }

  const status = notes.length > 0 ? "needs_attention" : "ready_for_review";
  const result: ReviewResult = { status, notes };
  if (cleanedTitle !== title) result.cleaned_title = cleanedTitle;
  return result;
}

// ── Prompts ────────────────────────────────────────────
const NOTES_SYSTEM_PROMPT = `You are an AI systems analyst for "Signal Desk" by Clarent, a learning platform that teaches how modern AI systems are built.

You receive ROUGH NOTES from a practitioner — a client lesson, an observation, or a how-to. Turn them into ONE structured learning entry.

CRITICAL RULES:
- Keep the author's wording and point of view. Do NOT invent facts, numbers, or details that are not in the notes.
- Produce exactly ONE entry. Never split into multiple.
- Write the business_angle from a finance, tax, or ERP implementation perspective. Be concrete: name the specific control, question, or decision.
- The source is "Clarent Technologies" with today's date and no URL.
- Write a clear, standalone title. Remove newsletter section prefixes like "Roundtable:" or "Community workflow:" if present.

ENTRY TYPE DEFINITIONS (use exactly one):
- news: An announcement, industry development, acquisition, funding round, or commentary. Default to this when the item reports what happened.
- tool: A specific product or feature readers can directly use (e.g., a new API endpoint, a CLI tool, a no-code feature). NOT every product announcement — only if readers can actually use the thing.
- tutorial: Actionable instructions that teach how to do something step by step. Must have steps.
- use_case: An example of someone applying AI to solve a real problem. Structure as Problem → Tool → Steps → Result.
- model_release: A new model or model version (e.g., GPT-5, Claude 4). One entry per model.
- risk: A security, safety, or governance concern (e.g., prompt injection, data leak, regulatory action).

SYSTEM LAYER DEFINITIONS (the AI DNA framework):
- model: The LLM layer — the models themselves, their capabilities, benchmarks, pricing.
- agent: Autonomous goal-seeking systems that plan, call tools, and loop. A product is "agent" only if it autonomously pursues goals. Using ChatGPT or Replit does NOT make something an agent.
- tools_connectors: Tool calling, MCP, APIs, integrations — how AI connects to external systems.
- data_context: RAG, vector databases, embeddings, chunking, knowledge graphs — how AI gets its knowledge.
- evals: Evaluation, testing, quality measurement of AI systems.
- security_governance: Guardrails, safety, compliance, security of AI systems.
- interface: How users interact with AI — chat UX, voice, app design, multimodal.
- null: Use null ONLY for news entries with no clear technical layer. Do not use null for other types unless truly no layer fits.

FIELDS:
- type: exactly one of "news", "tutorial", "use_case", "tool", "model_release", "risk"
- system_layer: one of "model", "agent", "tools_connectors", "data_context", "evals", "security_governance", "interface", or null
- title: clear, standalone headline in the author's voice. No newsletter prefixes.
- summary: 2-4 sentences summarizing the observation or lesson, keeping the author's perspective
- why_it_matters: 1-2 sentences on why this matters for practitioners
- how_its_built: 1-3 sentences on what this reveals about how AI systems are built or where they break (if applicable)
- business_angle: Write for a finance, tax, or ERP leader. Be concrete and actionable. 1-2 sentences.
- result: For use_case entries only — the outcome achieved. What happened as a result?
- tags: array of 2-5 short lowercase tags
- role_tags: array of relevant roles from: finance, legal, ops, marketing, IT (can be empty)
- For tutorials ONLY: steps: array of { text, prompt? } objects. Include any prompts the source actually provides. Do NOT invent prompts.
- For model_release type only: model_name, vendor, benchmark_score (number or null), benchmark_name, price_input, price_output

NEVER invent missing instructions, prompts, outcomes, benchmark scores, or prices. If the notes don't provide them, leave the field empty.

You MUST call the save_entry tool with your result. Do not output any text.`;

const SYSTEM_PROMPT = `You are an AI systems analyst for "Signal Desk" by Clarent, a learning platform that teaches how modern AI systems are built.

You receive raw newsletter text and must extract individual AI news items, turning each into a structured learning entry.

INSTRUCTIONS:
1. Skip sponsored sections, advertisements, partner content, footer boilerplate, unsubscribe links, and promotional blurbs.
2. For each genuine news item, produce ONE entry.

ENTRY TYPE DEFINITIONS (use exactly one):
- news: An announcement, industry development, acquisition, funding round, or commentary. Default to this when the item reports what happened. Do NOT classify every product announcement as Tool — most product announcements are news.
- tool: A specific product or feature readers can directly use (e.g., a new API endpoint, a CLI tool, a no-code feature). Only use this when readers can actually try the thing being described.
- tutorial: Actionable instructions that teach how to do something step by step. MUST include ordered steps and any prompts the source provides. If the source doesn't give step-by-step instructions, it's not a tutorial.
- use_case: An example of someone applying AI to solve a real problem. Structure as Problem → Tool → Steps → Result fields. If the source doesn't describe a complete workflow with a result, it's probably news, not a use_case.
- model_release: A new model or model version. One entry per model.
- risk: A security, safety, or governance concern (e.g., prompt injection vulnerability, data leak, regulatory action).

SYSTEM LAYER DEFINITIONS (the AI DNA framework — use consistently):
- model: The LLM layer — the models themselves, their capabilities, benchmarks, pricing.
- agent: Autonomous goal-seeking systems that plan, call tools, and loop. A product is "agent" only if it autonomously pursues goals without human step-by-step direction. Using ChatGPT or Replit does NOT automatically make something an agent — it's agent only if the product itself acts autonomously.
- tools_connectors: Tool calling, MCP, APIs, integrations — how AI connects to external systems and data.
- data_context: RAG, vector databases, embeddings, chunking, knowledge graphs — how AI retrieves and uses knowledge.
- evals: Evaluation, testing, quality measurement of AI systems.
- security_governance: Guardrails, safety, compliance, security of AI systems.
- interface: How users interact with AI — chat UX, voice, app design, multimodal interfaces.
- null: Use null ONLY for news entries with no clear technical layer. If no layer clearly fits, set to null. Do not force-fit.

TITLE CLEANING:
- Write clear, standalone headlines. Remove newsletter section prefixes like "Roundtable:", "Community workflow:", "Deep dive:", "Quick hit:", "Sponsored:", etc.
- Preserve the meaning and any uncertainty in the original claim (e.g., "OpenAI reportedly raises..." not "OpenAI raises...").
- Titles should make sense on their own without the newsletter context.

FIELDS:
- type: exactly one of "news", "tutorial", "use_case", "tool", "model_release", "risk"
- system_layer: one of "model", "agent", "tools_connectors", "data_context", "evals", "security_governance", "interface", or null
- title: clear, standalone headline (your own wording), no newsletter prefixes
- summary: 2-4 sentences summarizing the item IN YOUR OWN WORDS. Never copy text from the source.
- why_it_matters: 1-2 sentences on significance for AI practitioners
- how_its_built: 1-3 sentences on what this story reveals about how AI systems are built or where they break
- business_angle: Write for a finance, tax, or ERP leader. Be concrete and actionable. 1-2 sentences.
- result: For use_case entries only — the outcome or result achieved. Leave null for other types.
- tags: array of 2-5 short lowercase tags
- role_tags: array of relevant roles from: finance, legal, ops, marketing, IT (can be empty)
- For tutorials ONLY: steps: array of { text, prompt? } objects. Include any prompts the source actually provides. Do NOT invent prompts.
- For model_release type only: model_name, vendor, benchmark_score (a NUMBER or null), benchmark_name, price_input, price_output (all nullable)
- source_url: the individual story link if discoverable, otherwise null. Do NOT invent URLs.

MODEL RELEASES — ONE ENTRY PER MODEL:
If a story covers several models, split into SEPARATE entries, one per model. Each gets its own model_name, vendor, benchmark_score, benchmark_name, price_input, price_output.

BENCHMARK SCORES:
- benchmark_score MUST be a number or null. NEVER put text in this field.
- If the source only says "beats model X" with no number, set benchmark_score to null.

COMMUNITY AI WORKFLOW & ROUNDTABLE STORIES:
Capture "Community AI Workflow" and "Roundtable" stories as use_case entries. Structure them as Problem → Tool → Steps → Result:
- summary: describe the problem
- how_its_built: describe the tool and approach used
- steps: array of { text } objects describing each step
- result: the outcome achieved

3. Sort each item into exactly ONE type. system_layer is also singular or null (for news type).
4. Keep summaries short and rewritten — never paste source text.
5. If the newsletter contains no genuine AI news items, return an empty array.

NEVER invent missing instructions, prompts, outcomes, benchmark scores, or prices. If the source doesn't provide them, leave the field empty/null.

DUPLICATE DETECTION:
You will receive a list of existing entries from the last 30 days. Only flag an item as a duplicate if it covers the SAME SPECIFIC EVENT or ANNOUNCEMENT as an existing entry. Do NOT flag just because two entries mention the same company or product.
- If it IS a duplicate: set duplicate_of_id to the existing entry's id and duplicate_of_title to its title.
- If NOT a duplicate: set duplicate_of_id to null.
When in doubt, do NOT flag as duplicate.

You MUST call the save_entries tool with your results. Do not output any text.`;

// ── Slug generation ───────────────────────────────────
function generateBaseSlug(title: string): string {
  let slug = title.toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) slug = "entry";
  return slug.slice(0, 80);
}

// ── URL cleaning ───────────────────────────────────────
function stripTrackingParams(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const paramsToDelete: string[] = [];
    u.searchParams.forEach((_v, key) => {
      if (key.startsWith("utm_") || key === "_bhlid" || key === "_hsenc" || key === "_hsmi" || key === "mc_cid" || key === "mc_eid" || key === "ml_subscriber" || key === "ml_subscriber_hash") {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch { return rawUrl; }
}

// ── HTML text extraction ───────────────────────────────
function extractReadableText(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  cleaned = cleaned.replace(/<\/(h[1-6]|li|p|div|br|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  cleaned = cleaned
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&#x2F;/g, "/");
  cleaned = cleaned.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

// ── Extract site name from HTML or URL ────────────────
function extractSiteName(url: string, html?: string): string | null {
  if (html) {
    let match = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
    if (match) return match[1].trim();
    match = html.match(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i);
    if (match) return match[1].trim();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const rawTitle = titleMatch[1].trim();
      const cleaned = rawTitle.replace(/\s*[\|\-]\s*(beehiiv|substack)\s*$/i, '').replace(/\s*[\|\-]\s*Issue\s*#?\d+.*$/i, '').trim();
      if (cleaned.length > 0 && cleaned.length < 80 && !/beehiiv|substack/i.test(cleaned)) return cleaned;
    }
  }
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length < 2) return host;
    const subdomain = parts[0].toLowerCase();
    const base = parts[parts.length - 2].toLowerCase();
    const subdomainMap: Record<string, string> = { therundownai: "The Rundown AI", tldr: "TLDR AI", thebatch: "The Batch", natter: "Natter" };
    if (subdomainMap[subdomain]) return subdomainMap[subdomain];
    const hostingDomains = new Set(["beehiiv", "substack", "squarespace", "ghost"]);
    if (hostingDomains.has(base) && subdomain !== "www" && subdomain.length > 0) {
      return subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
    }
    const known: Record<string, string> = { tldr: "TLDR AI", therundown: "The Rundown AI", thebatch: "The Batch", natter: "Natter" };
    if (known[base]) return known[base];
    return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
  } catch { return null; }
}

// ── Extract publish date from HTML ─────────────────────
function extractPublishDate(html: string): string | null {
  let match = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
  if (match) return match[1].slice(0, 10);
  match = html.match(/<meta[^>]+name=["'](?:date|publish_date|publication_date)["'][^>]+content=["']([^"']+)["']/i);
  if (match) return match[1].slice(0, 10);
  match = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (match) return match[1].slice(0, 10);
  match = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  if (match) return match[1].slice(0, 10);
  return null;
}

// ── Normalize steps from various forms ─────────────────
function normalizeSteps(raw: any): Array<{ text: string; prompt?: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((s: any) => {
      if (typeof s === "string") return { text: s };
      if (s && typeof s === "object" && typeof s.text === "string") {
        return { text: s.text, ...(s.prompt ? { prompt: String(s.prompt) } : {}) };
      }
      return null;
    }).filter((s: any): s is { text: string; prompt?: string } => s !== null);
  }
  if (typeof raw === "string") {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return normalizeSteps(parsed); } catch { /* not JSON */ }
    const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) return lines.map((text) => ({ text }));
  }
  return [];
}

// ── Sanitize and validate an entry ─────────────────────
function sanitizeEntry(raw: ProcessedEntry, recentIds: Set<string>): { entry: ProcessedEntry } | { error: string } | null {
  if (!raw.title || !raw.summary) return null;
  const normalizedType = normalizeType(raw.type);
  if (!normalizedType) {
    return { error: `Unknown type "${raw.type}" for entry "${String(raw.title).slice(0, 80)}". Valid types: news, tutorial, use_case, tool, model_release, risk.` };
  }

  const layer = raw.system_layer || null;
  if (layer !== null && !VALID_LAYERS.has(layer)) return null;
  if (layer === null && !NULLABLE_LAYER_TYPES.has(normalizedType) && normalizedType !== "use_case") {
    // Allow null layer for news and use_case; reject for others
    return null;
  }

  let dupId: string | null = null;
  if (raw.duplicate_of_id && recentIds.has(raw.duplicate_of_id)) {
    dupId = raw.duplicate_of_id;
  }

  return {
    entry: {
      type: normalizedType,
      system_layer: layer,
      title: cleanTitle(String(raw.title).slice(0, 500)),
      summary: String(raw.summary).slice(0, 2000),
      why_it_matters: raw.why_it_matters ? String(raw.why_it_matters) : null,
      how_its_built: raw.how_its_built ? String(raw.how_its_built) : null,
      business_angle: raw.business_angle ? String(raw.business_angle) : null,
      steps: normalizeSteps(raw.steps),
      tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 10) : [],
      role_tags: Array.isArray(raw.role_tags) ? raw.role_tags.slice(0, 10) : [],
      model_name: raw.model_name || null,
      vendor: raw.vendor || null,
      benchmark_score: typeof raw.benchmark_score === "number" ? raw.benchmark_score : null,
      benchmark_name: raw.benchmark_name ? String(raw.benchmark_name) : null,
      price_input: raw.price_input || null,
      price_output: raw.price_output || null,
      source_url: raw.source_url || null,
      result: raw.result ? String(raw.result) : null,
      duplicate_of_id: dupId,
      duplicate_of_title: dupId ? (raw.duplicate_of_title || null) : null,
    } satisfies ProcessedEntry,
  };
}

// ── Tool schema (shared between notes and newsletter modes) ──
const ENTRY_PROPERTIES = {
  type: { type: "string" as const, enum: ["news", "tutorial", "use_case", "tool", "model_release", "risk"] },
  system_layer: { type: ["string", "null"] as const, enum: ["model", "agent", "tools_connectors", "data_context", "evals", "security_governance", "interface", null], description: "The system layer this entry belongs to. Set to null for news entries with no clear technical layer." },
  title: { type: "string" as const, description: "Clear, standalone headline with no newsletter section prefixes." },
  summary: { type: "string" as const },
  why_it_matters: { type: "string" as const },
  how_its_built: { type: "string" as const },
  business_angle: { type: "string" as const },
  result: { type: "string" as const, description: "For use_case entries: the outcome achieved. Null for other types." },
  steps: {
    type: "array" as const,
    items: {
      type: "object" as const,
      properties: { text: { type: "string" as const }, prompt: { type: "string" as const } },
      required: ["text"] as const,
    },
  },
  tags: { type: "array" as const, items: { type: "string" as const } },
  role_tags: { type: "array" as const, items: { type: "string" as const } },
  model_name: { type: "string" as const },
  vendor: { type: "string" as const },
  benchmark_score: { type: ["number", "null"] as const, description: "A numeric benchmark score, or null. NEVER text." },
  benchmark_name: { type: "string" as const },
  price_input: { type: "string" as const },
  price_output: { type: "string" as const },
  source_url: { type: "string" as const },
  duplicate_of_id: { type: ["string", "null"] as const },
  duplicate_of_title: { type: "string" as const },
};

// ── Recheck mode: deterministic quality review of existing drafts ──
async function handleRecheck(supabase: ReturnType<typeof createClient>): Promise<Response> {
  const { data: drafts, error } = await supabase
    .from("signal_desk_entries")
    .select("id, type, system_layer, title, summary, why_it_matters, how_its_built, business_angle, steps, tags, role_tags, model_name, vendor, benchmark_score, benchmark_name, price_input, price_output, result, source_url, sources, origin, duplicate_status")
    .eq("status", "draft");

  if (error) {
    return new Response(JSON.stringify({ error: `Failed to load drafts: ${error.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const proposals: Array<{
    id: string;
    title: string;
    type: string;
    current_review_status: string | null;
    proposed_review_status: "ready_for_review" | "needs_attention";
    proposed_review_notes: string;
    proposed_title?: string;
    changes: string[];
  }> = [];

  for (const draft of (drafts || [])) {
    const entry: ProcessedEntry = {
      type: draft.type,
      system_layer: draft.system_layer,
      title: draft.title,
      summary: draft.summary,
      why_it_matters: draft.why_it_matters,
      how_its_built: draft.how_its_built,
      business_angle: draft.business_angle,
      steps: draft.steps,
      tags: draft.tags,
      role_tags: draft.role_tags,
      model_name: draft.model_name,
      vendor: draft.vendor,
      benchmark_score: draft.benchmark_score,
      benchmark_name: draft.benchmark_name,
      price_input: draft.price_input,
      price_output: draft.price_output,
      result: draft.result,
    };

    const review = reviewEntry(entry);
    const changes: string[] = [...review.notes];
    if (review.cleaned_title && review.cleaned_title !== draft.title) {
      changes.unshift(`Title cleaned: "${draft.title.slice(0, 60)}" → "${review.cleaned_title.slice(0, 60)}"`);
    }

    proposals.push({
      id: draft.id,
      title: draft.title,
      type: draft.type,
      current_review_status: draft.review_status || null,
      proposed_review_status: review.status,
      proposed_review_notes: changes.join("; "),
      proposed_title: review.cleaned_title !== draft.title ? review.cleaned_title : undefined,
      changes,
    });
  }

  return new Response(JSON.stringify({ proposals }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Main handler ───────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { text, url, source_name, source_date, mode } = body;
    const isNotesMode = mode === "notes";
    const isRecheckMode = mode === "recheck";
    const isApplyMode = mode === "apply_recheck";

    // ── Admin auth check ──────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let callerRole: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      callerRole = payload.app_metadata?.role ?? null;
    } catch { /* malformed JWT */ }

    if (callerRole !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized. Admin access required." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Recheck mode: return proposed changes for review ──
    if (isRecheckMode) {
      return await handleRecheck(supabase);
    }

    // ── Apply recheck mode: apply proposed changes ──
    if (isApplyMode) {
      const { updates } = body;
      if (!Array.isArray(updates)) {
        return new Response(JSON.stringify({ error: "Missing updates array." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let applied = 0;
      for (const u of updates) {
        const patch: Record<string, any> = {
          review_status: u.review_status,
          review_notes: u.review_notes,
        };
        if (u.title) patch.title = u.title;
        const { error: updateError } = await supabase.from("signal_desk_entries").update(patch).eq("id", u.id);
        if (!updateError) applied++;
      }
      return new Response(JSON.stringify({ applied, total: updates.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Repair mode: fetch source, find outcome for incomplete use_case entries ──
    if (mode === "repair") {
      const { entry_ids } = body;
      if (!Array.isArray(entry_ids) || entry_ids.length === 0) {
        return new Response(JSON.stringify({ error: "Missing entry_ids array." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: repairEntries, error: fetchError } = await supabase
        .from("signal_desk_entries")
        .select("id, title, type, summary, how_its_built, result, source_url, source_name, steps")
        .in("id", entry_ids)
        .eq("status", "draft");

      if (fetchError) {
        return new Response(JSON.stringify({ error: `Failed to load entries: ${fetchError.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const proposals: Array<{
        id: string;
        title: string;
        found: boolean;
        proposed_result: string | null;
        explanation: string;
      }> = [];

      for (const entry of (repairEntries || [])) {
        if (entry.type !== "use_case") {
          proposals.push({
            id: entry.id,
            title: entry.title,
            found: false,
            proposed_result: null,
            explanation: "Repair only applies to use_case entries.",
          });
          continue;
        }

        // Try to get source text
        let sourceText = "";
        const sourceUrl = entry.source_url;

        if (sourceUrl) {
          try {
            const fetchResp = await fetch(sourceUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SignalDesk/1.0; +https://aisystems.clarenttech.com)", "Accept": "text/html,application/xhtml+xml" },
              redirect: "follow",
            });
            if (fetchResp.ok) {
              const html = await fetchResp.text();
              sourceText = extractReadableText(html);
            }
          } catch { /* fetch failed, sourceText stays empty */ }
        }

        if (!sourceText || sourceText.trim().length < 200) {
          proposals.push({
            id: entry.id,
            title: entry.title,
            found: false,
            proposed_result: null,
            explanation: sourceUrl
              ? "Could not retrieve source content from the saved URL."
              : "No source URL saved for this entry.",
          });
          continue;
        }

        // Use Claude to find the outcome from the source text
        if (!ANTHROPIC_API_KEY) {
          proposals.push({
            id: entry.id,
            title: entry.title,
            found: false,
            proposed_result: null,
            explanation: "Anthropic API key not configured.",
          });
          continue;
        }

        const repairPrompt = `You are reviewing a newsletter article to find the OUTCOME or RESULT of a specific use case.

ENTRY TITLE: ${entry.title}
ENTRY SUMMARY: ${entry.summary || ""}
HOW IT'S BUILT: ${entry.how_its_built || ""}

NEWSLETTER SOURCE TEXT:
${sourceText.slice(0, 12000)}

TASK:
Find the explicit outcome or result that was achieved in this use case. This is the "what happened as a result" — not the intended goal or benefit, but what actually occurred.

RULES:
- Accept qualitative outcomes (e.g., "the reminders worked reliably", "the app produced the intended artistic pairings"). Measurable savings or performance figures are NOT required.
- Do NOT turn an intended benefit into an achieved result. If the source only says "this could save time" or "this aims to improve X", that is NOT an outcome.
- Do NOT invent or fabricate details not present in the source text.
- If the source text does not describe an explicit outcome, say so clearly.

You MUST call the report_result tool with your finding.`;

        const repairTools = [{
          name: "report_result",
          description: "Report whether an explicit outcome was found in the source text.",
          input_schema: {
            type: "object" as const,
            properties: {
              found: { type: "boolean" as const, description: "Whether an explicit outcome/result was found in the source." },
              result: { type: "string" as const, description: "The outcome text if found, in 1-2 sentences. Null if not found." },
              explanation: { type: "string" as const, description: "Brief explanation of why an outcome was or was not found." },
            },
            required: ["found", "explanation"] as const,
          },
        }];

        try {
          const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: CLAUDE_MODEL, max_tokens: 2000, system: repairPrompt,
              tools: repairTools, tool_choice: { type: "tool", name: "report_result" },
              messages: [{ role: "user", content: "Find the outcome for this use case." }],
            }),
          });

          if (!claudeResp.ok) {
            proposals.push({
              id: entry.id,
              title: entry.title,
              found: false,
              proposed_result: null,
              explanation: `Claude API error (${claudeResp.status}).`,
            });
            continue;
          }

          const claudeData = await claudeResp.json();
          const toolUse = (claudeData?.content ?? []).find((b: any) => b.type === "tool_use" && b.name === "report_result");

          if (toolUse?.input) {
            proposals.push({
              id: entry.id,
              title: entry.title,
              found: !!toolUse.input.found,
              proposed_result: toolUse.input.found ? String(toolUse.input.result || "").trim() || null : null,
              explanation: String(toolUse.input.explanation || ""),
            });
          } else {
            proposals.push({
              id: entry.id,
              title: entry.title,
              found: false,
              proposed_result: null,
              explanation: "Claude did not return a structured result.",
            });
          }
        } catch {
          proposals.push({
            id: entry.id,
            title: entry.title,
            found: false,
            proposed_result: null,
            explanation: "Error calling Claude API for repair.",
          });
        }
      }

      return new Response(JSON.stringify({ proposals }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Determine input text ────────────────────────────
    let inputText = "";
    let cleanedUrl: string | null = null;
    let autoSourceName: string | null = null;
    let autoSourceDate: string | null = null;

    if (url && typeof url === "string" && url.trim().length > 0) {
      cleanedUrl = stripTrackingParams(url.trim());
      if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
        return new Response(JSON.stringify({ error: "URL must start with http:// or https://." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let fetchResp: Response;
      try {
        fetchResp = await fetch(cleanedUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SignalDesk/1.0; +https://aisystems.clarenttech.com)", "Accept": "text/html,application/xhtml+xml" },
          redirect: "follow",
        });
      } catch {
        return new Response(JSON.stringify({ error: "Could not fetch the URL. Please paste the newsletter text instead." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!fetchResp.ok) {
        return new Response(JSON.stringify({ error: `Fetch failed (HTTP ${fetchResp.status}). Please paste the newsletter text instead.` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const html = await fetchResp.text();
      inputText = extractReadableText(html);
      if (inputText.length < MIN_EXTRACTED_TEXT) {
        return new Response(JSON.stringify({ error: `Extracted too little text (${inputText.length} chars). Please paste the newsletter text instead.` }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      autoSourceName = extractSiteName(cleanedUrl, html);
      autoSourceDate = extractPublishDate(html);
    } else if (text && typeof text === "string") {
      inputText = text;
    } else {
      return new Response(JSON.stringify({ error: "Provide either a URL or pasted text." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (inputText.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Text input is too short (min 50 characters)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Anthropic API key not configured." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Notes mode ──────────────────────────────────────
    if (isNotesMode) {
      if (!text || typeof text !== "string" || text.trim().length < 20) {
        return new Response(JSON.stringify({ error: "Notes must be at least 20 characters." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const notesTools = [{
        name: "save_entry",
        description: "Save the single structured entry derived from the practitioner's notes.",
        input_schema: {
          type: "object" as const,
          properties: { ...ENTRY_PROPERTIES, result: { type: "string" as const, description: "For use_case entries: the outcome achieved." } },
          required: ["type", "title", "summary"] as const,
        },
      }];

      const today = new Date().toISOString().slice(0, 10);

      const notesClaudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: CLAUDE_MODEL, max_tokens: 4000, system: NOTES_SYSTEM_PROMPT,
          tools: notesTools, tool_choice: { type: "tool", name: "save_entry" },
          messages: [{ role: "user", content: `Today's date: ${today}\n\nPractitioner's notes:\n\n${text.trim()}` }],
        }),
      });

      if (!notesClaudeResp.ok) {
        const errBody = await notesClaudeResp.text();
        return new Response(JSON.stringify({ error: `Claude API error (${notesClaudeResp.status}): ${errBody.slice(0, 300)}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const notesClaudeData = await notesClaudeResp.json();
      const notesBlocks: Array<any> = notesClaudeData?.content ?? [];
      const notesToolUse = notesBlocks.find((b: any) => b.type === "tool_use" && b.name === "save_entry");

      if (!notesToolUse || !notesToolUse.input) {
        return new Response(JSON.stringify({ error: "Claude did not return a structured entry. Please try again." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const rawEntry: ProcessedEntry = notesToolUse.input;
      const result = sanitizeEntry(rawEntry, new Set());
      if (result && "error" in result) {
        return new Response(JSON.stringify({ error: result.error }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanEntry = result && "entry" in result ? result.entry : null;
      if (!cleanEntry) {
        return new Response(JSON.stringify({ error: "Could not generate a valid entry from these notes. Please add more detail." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Run quality review
      const review = reviewEntry(cleanEntry);

      const baseSlug = generateBaseSlug(cleanEntry.title);
      const { data: existingSlugs } = await supabase.from("signal_desk_entries").select("slug").eq("slug", baseSlug);
      let finalSlug = baseSlug;
      let suffix = 2;
      while ((existingSlugs || []).some((r: any) => r.slug === finalSlug)) { finalSlug = `${baseSlug}-${suffix}`; suffix++; }

      const notesSource: SourceObj = { name: "Clarent Technologies", date: today, url: null };

      const { data: insertedRows, error: insertError } = await supabase
        .from("signal_desk_entries")
        .insert({
          type: cleanEntry.type, system_layer: cleanEntry.system_layer,
          title: cleanEntry.title, summary: cleanEntry.summary,
          why_it_matters: cleanEntry.why_it_matters, how_its_built: cleanEntry.how_its_built,
          business_angle: cleanEntry.business_angle,
          steps: cleanEntry.steps || [], tags: cleanEntry.tags || [], role_tags: cleanEntry.role_tags || [],
          model_name: cleanEntry.model_name, vendor: cleanEntry.vendor,
          benchmark_score: cleanEntry.benchmark_score, benchmark_name: cleanEntry.benchmark_name,
          price_input: cleanEntry.price_input, price_output: cleanEntry.price_output,
          result: cleanEntry.result,
          source_name: "Clarent Technologies", source_date: today, source_url: null,
          sources: [notesSource], duplicate_of: null, duplicate_status: "none",
          slug: finalSlug, origin: "original", status: "draft",
          review_status: review.status, review_notes: review.notes.join("; ") || null,
        })
        .select("id, title, type, system_layer, status, review_status, review_notes");

      if (insertError) {
        return new Response(JSON.stringify({ error: `Database insert failed: ${insertError.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        entries: insertedRows, count: (insertedRows || []).length,
        new_count: (insertedRows || []).length, duplicate_count: 0, mode: "notes",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Newsletter mode ─────────────────────────────────
    const finalSourceName = source_name || autoSourceName || null;
    const finalSourceDate = source_date || autoSourceDate || null;
    const finalSourceUrl = cleanedUrl || null;

    // Fetch recent entries for duplicate detection
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();

    const { data: recentData } = await supabase
      .from("signal_desk_entries")
      .select("id, title, type, system_layer, model_name")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200);

    const recentEntries: RecentEntry[] = (recentData as RecentEntry[]) || [];
    const recentIds = new Set(recentEntries.map((e) => e.id));
    const recentContext = recentEntries.length > 0
      ? recentEntries.map((e) => `- id: ${e.id} | title: "${e.title}" | type: ${e.type} | layer: ${e.system_layer}${e.model_name ? ` | model: ${e.model_name}` : ""}`).join("\n")
      : "(no existing entries in the last 30 days)";

    const tools = [{
      name: "save_entries",
      description: "Save the extracted newsletter entries as structured data.",
      input_schema: {
        type: "object" as const,
        properties: {
          entries: {
            type: "array" as const,
            items: { type: "object" as const, properties: ENTRY_PROPERTIES, required: ["type", "title", "summary"] as const },
          },
        },
        required: ["entries"] as const,
      },
    }];

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CLAUDE_MODEL, max_tokens: 16000, system: SYSTEM_PROMPT,
        tools, tool_choice: { type: "tool", name: "save_entries" },
        messages: [{ role: "user", content: `Newsletter source: ${finalSourceName || "Unknown"}\nDate: ${finalSourceDate || "Unknown"}\n\nEXISTING ENTRIES FROM LAST 30 DAYS (use for duplicate detection):\n${recentContext}\n\nNewsletter text:\n\n${inputText}` }],
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      return new Response(JSON.stringify({ error: `Claude API error (${claudeResponse.status}): ${errBody.slice(0, 300)}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const claudeData = await claudeResponse.json();
    const stopReason: string = claudeData?.stop_reason ?? "unknown";

    if (stopReason === "max_tokens") {
      return new Response(JSON.stringify({ error: "The newsletter was too long for Claude to process in one pass. Try pasting a shorter excerpt or fewer items." }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contentBlocks: Array<any> = claudeData?.content ?? [];
    const toolUseBlock = contentBlocks.find((b: any) => b.type === "tool_use" && b.name === "save_entries");

    if (!toolUseBlock || !toolUseBlock.input) {
      return new Response(JSON.stringify({ error: "Claude did not return structured entries. Please try again." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rawEntries: ProcessedEntry[] = Array.isArray(toolUseBlock.input.entries) ? toolUseBlock.input.entries : [];
    const validationErrors: string[] = [];
    const cleanEntries = rawEntries
      .map((e) => {
        const r = sanitizeEntry(e, recentIds);
        if (r && "error" in r) { validationErrors.push(r.error); return null; }
        if (r && "entry" in r) return r.entry;
        return null;
      })
      .filter((e): e is ProcessedEntry => e !== null);

    if (cleanEntries.length === 0) {
      const msg = validationErrors.length > 0
        ? `No valid entries extracted. ${validationErrors.length} rejected: ${validationErrors.join("; ")}`
        : "No valid entries extracted.";
      return new Response(JSON.stringify({ entries: [], message: msg, validation_errors: validationErrors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Run quality review on each entry ──────────────
    const reviewedEntries = cleanEntries.map((e) => {
      const review = reviewEntry(e);
      return { entry: e, review };
    });

    // ── Build source objects and insert ─────────────────
    const newSource: SourceObj = { name: finalSourceName, date: finalSourceDate, url: finalSourceUrl };

    const baseSlugs = cleanEntries.map((e) => generateBaseSlug(e.title));
    const uniqueBaseSlugs = [...new Set(baseSlugs)];
    const { data: existingSlugs } = await supabase.from("signal_desk_entries").select("slug").in("slug", uniqueBaseSlugs);
    const usedSlugs = new Set((existingSlugs || []).map((r: any) => r.slug));
    const batchSlugs = new Set<string>();

    const rows = reviewedEntries.map(({ entry: e, review }) => {
      const isDup = !!e.duplicate_of_id;
      const baseSlug = generateBaseSlug(e.title);
      let finalSlug = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(finalSlug) || batchSlugs.has(finalSlug)) { finalSlug = `${baseSlug}-${suffix}`; suffix++; }
      batchSlugs.add(finalSlug);
      usedSlugs.add(finalSlug);
      return {
        type: e.type, system_layer: e.system_layer,
        title: e.title, summary: e.summary,
        why_it_matters: e.why_it_matters, how_its_built: e.how_its_built,
        business_angle: e.business_angle,
        steps: e.steps || [], tags: e.tags || [], role_tags: e.role_tags || [],
        model_name: e.model_name, vendor: e.vendor,
        benchmark_score: e.benchmark_score, benchmark_name: e.benchmark_name,
        price_input: e.price_input, price_output: e.price_output,
        result: e.result,
        source_url: finalSourceUrl || e.source_url || null,
        source_name: finalSourceName, source_date: finalSourceDate,
        sources: [newSource],
        duplicate_of: isDup ? e.duplicate_of_id : null,
        duplicate_status: isDup ? "possible" : "none",
        slug: finalSlug, status: "draft",
        review_status: review.status,
        review_notes: review.notes.join("; ") || null,
      };
    });

    const { data, error } = await supabase
      .from("signal_desk_entries")
      .insert(rows)
      .select("id, title, type, system_layer, status, duplicate_of, duplicate_status, review_status, review_notes");

    if (error) {
      return new Response(JSON.stringify({ error: `Database insert failed: ${error.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const duplicates = (data || []).filter((e: any) => e.duplicate_of);
    const newEntries = (data || []).filter((e: any) => !e.duplicate_of);
    const needsAttention = (data || []).filter((e: any) => e.review_status === "needs_attention");

    return new Response(JSON.stringify({
      entries: data, count: data.length,
      new_count: newEntries.length, duplicate_count: duplicates.length,
      needs_attention_count: needsAttention.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error(`[process-newsletter] Unhandled error: ${err?.message ?? err}`);
    return new Response(JSON.stringify({ error: (err as Error)?.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
