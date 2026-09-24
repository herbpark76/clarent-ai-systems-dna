import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Change this to switch the Claude model used for newsletter processing.
const CLAUDE_MODEL = "claude-sonnet-5";

const ADMIN_EMAIL = "hpark76@gmail.com";

const SYSTEM_PROMPT = `You are an AI systems analyst for "Signal Desk" by Clarent, a learning platform that teaches how modern AI systems are built.

You receive raw newsletter text and must extract individual AI news items, turning each into a structured learning entry.

INSTRUCTIONS:
1. Skip sponsored sections, advertisements, partner content, footer boilerplate, unsubscribe links, and promotional blurbs.
2. For each genuine news item, produce ONE entry with these fields:
   - type: exactly one of "news", "tutorial", "use_case", "tool", "model_release", "risk"
   - system_layer: exactly one of "model", "agent", "tools_connectors", "data_context", "evals", "security_governance", "interface"
   - title: concise headline (your own wording)
   - summary: 2-4 sentences summarizing the item IN YOUR OWN WORDS. Never copy text from the source.
   - why_it_matters: 1-2 sentences on significance for AI practitioners
   - how_its_built: 1-3 sentences on what this story reveals about how AI systems are built or where they break
   - business_angle: 1-2 sentences on how this applies to a team running finance, tax, or ERP systems
   - tags: array of 2-5 short lowercase tags
   - role_tags: array of relevant roles from: finance, legal, ops, marketing, IT (can be empty)
   - For tutorials ONLY: steps: array of { text, prompt? } objects where prompt is an optional example prompt string
   - For model_release type only: model_name, vendor, benchmark_score, price_input, price_output (all nullable strings)
   - source_url: if discoverable in the text, otherwise null

3. Sort each item into exactly ONE type and ONE system_layer — no item gets multiple.
4. Keep summaries short and rewritten — never paste source text.
5. If the newsletter contains no genuine AI news items, return an empty array.

Return ONLY a JSON object: { "entries": [ ... ] }
Do not include markdown, commentary, or explanation outside the JSON.`;

interface ProcessedEntry {
  type: string;
  system_layer: string;
  title: string;
  summary: string;
  why_it_matters?: string;
  how_its_built?: string;
  business_angle?: string;
  steps?: Array<{ text: string; prompt?: string }>;
  tags?: string[];
  role_tags?: string[];
  model_name?: string;
  vendor?: string;
  benchmark_score?: string;
  price_input?: string;
  price_output?: string;
  source_url?: string;
}

const VALID_TYPES = new Set([
  "news", "tutorial", "use_case", "tool", "model_release", "risk",
]);
const VALID_LAYERS = new Set([
  "model", "agent", "tools_connectors", "data_context",
  "evals", "security_governance", "interface",
]);

function sanitizeEntry(raw: ProcessedEntry): ProcessedEntry | null {
  if (!raw.title || !raw.summary) return null;
  if (!VALID_TYPES.has(raw.type)) return null;
  if (!VALID_LAYERS.has(raw.system_layer)) return null;

  return {
    type: raw.type,
    system_layer: raw.system_layer,
    title: String(raw.title).slice(0, 500),
    summary: String(raw.summary).slice(0, 2000),
    why_it_matters: raw.why_it_matters ? String(raw.why_it_matters) : null,
    how_its_built: raw.how_its_built ? String(raw.how_its_built) : null,
    business_angle: raw.business_angle ? String(raw.business_angle) : null,
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 10) : [],
    role_tags: Array.isArray(raw.role_tags) ? raw.role_tags.slice(0, 10) : [],
    model_name: raw.model_name || null,
    vendor: raw.vendor || null,
    benchmark_score: raw.benchmark_score || null,
    price_input: raw.price_input || null,
    price_output: raw.price_output || null,
    source_url: raw.source_url || null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { text, source_name, source_date } = await req.json();

    // ── Admin auth check ───────────────────────────────
    // The edge function has verify_jwt = true, so Supabase already validates
    // the JWT is well-formed. We additionally check the caller's email.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let callerEmail: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      callerEmail = payload.email ?? null;
    } catch { /* malformed JWT — leave null */ }

    if (callerEmail !== ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Text input is required (min 50 characters)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Call Claude ──────────────────────────────────────
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Newsletter source: ${source_name || "Unknown"}\nDate: ${source_date || "Unknown"}\n\nNewsletter text:\n\n${text}`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      return new Response(
        JSON.stringify({ error: `Claude API error (${claudeResponse.status}): ${errBody.slice(0, 300)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const claudeData = await claudeResponse.json();
    const rawText: string = claudeData?.content?.[0]?.text ?? "";

    let parsed: { entries?: ProcessedEntry[] };
    try {
      // Strip any markdown code fences if present
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse Claude response as JSON." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const cleanEntries = rawEntries
      .map(sanitizeEntry)
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (cleanEntries.length === 0) {
      return new Response(
        JSON.stringify({ entries: [], message: "No valid entries extracted." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Insert as drafts into Supabase ──────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rows = cleanEntries.map((e) => ({
      type: e.type,
      system_layer: e.system_layer,
      title: e.title,
      summary: e.summary,
      why_it_matters: e.why_it_matters,
      how_its_built: e.how_its_built,
      business_angle: e.business_angle,
      steps: JSON.stringify(e.steps || []),
      tags: e.tags || [],
      role_tags: e.role_tags || [],
      model_name: e.model_name,
      vendor: e.vendor,
      benchmark_score: e.benchmark_score,
      price_input: e.price_input,
      price_output: e.price_output,
      source_url: e.source_url,
      source_name: source_name || null,
      source_date: source_date || null,
      status: "draft",
    }));

    const { data, error } = await supabase
      .from("signal_desk_entries")
      .insert(rows)
      .select("id, title, type, system_layer, status");

    if (error) {
      return new Response(
        JSON.stringify({ error: `Database insert failed: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ entries: data, count: data.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
