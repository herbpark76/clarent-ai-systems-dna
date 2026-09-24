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
  // Duplicate detection fields filled by Claude
  duplicate_of_id?: string | null;
  duplicate_of_title?: string | null;
}

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

DUPLICATE DETECTION:
You will also receive a list of existing entries from the last 30 days, each with an id, title, type, system_layer, and model_name.
For each item you extract, compare it against the existing entries. If an item covers the same story or the same model release as an existing entry (same type AND similar topic/title), set:
   - duplicate_of_id: the id of the existing entry
   - duplicate_of_title: the title of the existing entry
If it is NOT a duplicate, set duplicate_of_id to null.
When in doubt, do NOT flag as duplicate — only flag when the overlap is clear.

You MUST call the save_entries tool with your results. Do not output any text.`;

const VALID_TYPES = new Set([
  "news", "tutorial", "use_case", "tool", "model_release", "risk",
]);
const VALID_LAYERS = new Set([
  "model", "agent", "tools_connectors", "data_context",
  "evals", "security_governance", "interface",
]);

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
  } catch {
    return rawUrl;
  }
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

  cleaned = cleaned
    .replace(/<\/(h[1-6]|li|p|div|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");

  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/");

  cleaned = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

// ── Extract site name from URL ─────────────────────────
function extractSiteName(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length < 2) return host;
    const base = parts[parts.length - 2];
    const known: Record<string, string> = {
      tldr: "TLDR AI",
      therundown: "The Rundown AI",
      thebatch: "The Batch",
      natter: "Natter",
    };
    if (known[base.toLowerCase()]) return known[base.toLowerCase()];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return null;
  }
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

function sanitizeEntry(raw: ProcessedEntry, recentIds: Set<string>): ProcessedEntry | null {
  if (!raw.title || !raw.summary) return null;
  if (!VALID_TYPES.has(raw.type)) return null;
  if (!VALID_LAYERS.has(raw.system_layer)) return null;

  // Validate duplicate_of_id — must be a real recent entry id
  let dupId: string | null = null;
  if (raw.duplicate_of_id && recentIds.has(raw.duplicate_of_id)) {
    dupId = raw.duplicate_of_id;
  }

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
    duplicate_of_id: dupId,
    duplicate_of_title: dupId ? (raw.duplicate_of_title || null) : null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { text, url, source_name, source_date } = await req.json();

    // ── Admin auth check (before any fetch) ─────────────
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

    // ── Determine input text ────────────────────────────
    let inputText = "";
    let cleanedUrl: string | null = null;
    let autoSourceName: string | null = null;
    let autoSourceDate: string | null = null;

    if (url && typeof url === "string" && url.trim().length > 0) {
      cleanedUrl = stripTrackingParams(url.trim());

      if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
        return new Response(
          JSON.stringify({ error: "URL must start with http:// or https://." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let fetchResp: Response;
      try {
        fetchResp = await fetch(cleanedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SignalDesk/1.0; +https://aisystems.clarenttech.com)",
            "Accept": "text/html,application/xhtml+xml",
          },
          redirect: "follow",
        });
      } catch {
        return new Response(
          JSON.stringify({ error: "Could not fetch the URL. Please paste the newsletter text instead." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!fetchResp.ok) {
        return new Response(
          JSON.stringify({ error: `Fetch failed (HTTP ${fetchResp.status}). Please paste the newsletter text instead.` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const html = await fetchResp.text();
      inputText = extractReadableText(html);

      if (inputText.length < MIN_EXTRACTED_TEXT) {
        return new Response(
          JSON.stringify({ error: `Extracted too little text (${inputText.length} chars). Please paste the newsletter text instead.` }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      autoSourceName = extractSiteName(cleanedUrl);
      autoSourceDate = extractPublishDate(html);
    } else if (text && typeof text === "string") {
      inputText = text;
    } else {
      return new Response(
        JSON.stringify({ error: "Provide either a URL or pasted text." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (inputText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Text input is too short (min 50 characters)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Resolve source fields ───────────────────────────
    const finalSourceName = source_name || autoSourceName || null;
    const finalSourceDate = source_date || autoSourceDate || null;
    const finalSourceUrl = cleanedUrl || null;

    // ── Fetch recent entries for duplicate detection ────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    // Build the recent-entries context for Claude
    const recentContext = recentEntries.length > 0
      ? recentEntries.map((e) =>
          `- id: ${e.id} | title: "${e.title}" | type: ${e.type} | layer: ${e.system_layer}${e.model_name ? ` | model: ${e.model_name}` : ""}`
        ).join("\n")
      : "(no existing entries in the last 30 days)";

    // ── Define tool schema for structured output ────────
    const tools = [{
      name: "save_entries",
      description: "Save the extracted newsletter entries as structured data.",
      input_schema: {
        type: "object" as const,
        properties: {
          entries: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                type: { type: "string", enum: ["news", "tutorial", "use_case", "tool", "model_release", "risk"] },
                system_layer: { type: "string", enum: ["model", "agent", "tools_connectors", "data_context", "evals", "security_governance", "interface"] },
                title: { type: "string" },
                summary: { type: "string" },
                why_it_matters: { type: "string" },
                how_its_built: { type: "string" },
                business_angle: { type: "string" },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      prompt: { type: "string" },
                    },
                    required: ["text"],
                  },
                },
                tags: { type: "array", items: { type: "string" } },
                role_tags: { type: "array", items: { type: "string" } },
                model_name: { type: "string" },
                vendor: { type: "string" },
                benchmark_score: { type: "string" },
                price_input: { type: "string" },
                price_output: { type: "string" },
                source_url: { type: "string" },
                duplicate_of_id: { type: "string", description: "The id of an existing entry this duplicates, or null if not a duplicate." },
                duplicate_of_title: { type: "string" },
              },
              required: ["type", "system_layer", "title", "summary"],
            },
          },
        },
        required: ["entries"],
      },
    }];

    // ── Call Claude with forced tool use ─────────────────
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools,
        tool_choice: { type: "tool", name: "save_entries" },
        messages: [
          {
            role: "user",
            content: `Newsletter source: ${finalSourceName || "Unknown"}\nDate: ${finalSourceDate || "Unknown"}\n\nEXISTING ENTRIES FROM LAST 30 DAYS (use for duplicate detection):\n${recentContext}\n\nNewsletter text:\n\n${inputText}`,
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
    const stopReason: string = claudeData?.stop_reason ?? "unknown";

    // Handle max_tokens — the newsletter was too long for Claude to finish
    if (stopReason === "max_tokens") {
      const rawPreview = JSON.stringify(claudeData?.content ?? "").slice(0, 500);
      console.error(`[process-newsletter] stop_reason=max_tokens, raw preview: ${rawPreview}`);
      return new Response(
        JSON.stringify({ error: "The newsletter was too long for Claude to process in one pass. Try pasting a shorter excerpt or fewer items." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extract entries from the tool_use block's input
    const contentBlocks: Array<any> = claudeData?.content ?? [];
    const toolUseBlock = contentBlocks.find((b: any) => b.type === "tool_use" && b.name === "save_entries");

    if (!toolUseBlock || !toolUseBlock.input) {
      const rawPreview = JSON.stringify(claudeData?.content ?? "").slice(0, 500);
      console.error(`[process-newsletter] No tool_use block found. stop_reason=${stopReason}, raw preview: ${rawPreview}`);
      return new Response(
        JSON.stringify({ error: "Claude did not return structured entries. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawEntries: ProcessedEntry[] = Array.isArray(toolUseBlock.input.entries) ? toolUseBlock.input.entries : [];
    const cleanEntries = rawEntries
      .map((e) => sanitizeEntry(e, recentIds))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (cleanEntries.length === 0) {
      return new Response(
        JSON.stringify({ entries: [], message: "No valid entries extracted." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Build source objects and insert ─────────────────
    const newSource: SourceObj = {
      name: finalSourceName,
      date: finalSourceDate,
      url: finalSourceUrl,
    };

    const rows = cleanEntries.map((e) => {
      const isDup = !!e.duplicate_of_id;
      return {
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
        source_url: finalSourceUrl || e.source_url || null,
        source_name: finalSourceName,
        source_date: finalSourceDate,
        sources: JSON.stringify([newSource]),
        duplicate_of: isDup ? e.duplicate_of_id : null,
        duplicate_status: isDup ? "possible" : "none",
        status: "draft",
      };
    });

    const { data, error } = await supabase
      .from("signal_desk_entries")
      .insert(rows)
      .select("id, title, type, system_layer, status, duplicate_of, duplicate_status");

    if (error) {
      return new Response(
        JSON.stringify({ error: `Database insert failed: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build a summary that includes duplicate info for the frontend
    const duplicates = (data || []).filter((e: any) => e.duplicate_of);
    const newEntries = (data || []).filter((e: any) => !e.duplicate_of);

    return new Response(
      JSON.stringify({
        entries: data,
        count: data.length,
        new_count: newEntries.length,
        duplicate_count: duplicates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[process-newsletter] Unhandled error: ${err?.message ?? err}`);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
