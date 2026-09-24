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
   - type: exactly one of "news", "tutorial", "use_case", "tool", "model_release", "risk", "industry"
   - system_layer: one of "model", "agent", "tools_connectors", "data_context", "evals", "security_governance", "interface", or null
     * "interface" = how people interact with AI (chat, voice, apps, UX, design)
     * Agent products and autonomous AI agents (e.g. Meta's Muse, Devin, agent frameworks) = "agent"
     * Business, funding, education, or market stories: use the layer they most affect. If there is no clear technical layer, set system_layer to null and use type "industry".
     * General industry news with no specific system layer = type "industry" with system_layer null.
   - title: concise headline (your own wording)
   - summary: 2-4 sentences summarizing the item IN YOUR OWN WORDS. Never copy text from the source.
   - why_it_matters: 1-2 sentences on significance for AI practitioners
   - how_its_built: 1-3 sentences on what this story reveals about how AI systems are built or where they break
   - business_angle: Write for a finance, tax, or ERP leader. Be concrete and actionable: name the specific control, question, or decision they should make (e.g., service identities, credential vaults, approval thresholds, audit trails, vendor terms). Avoid generic advice like "should scrutinize" or "should consider". 1-2 sentences.
   - tags: array of 2-5 short lowercase tags
   - role_tags: array of relevant roles from: finance, legal, ops, marketing, IT (can be empty)
   - For tutorials ONLY: steps: array of { text, prompt? } objects where prompt is an optional example prompt string
   - For model_release type only: model_name, vendor, benchmark_score, price_input, price_output (all nullable strings)
   - source_url: if discoverable in the text, otherwise null

MODEL RELEASES — ONE ENTRY PER MODEL:
If a story covers several models (e.g. "Opus 5.5 and GPT-6 Sol/Luna"), split it into SEPARATE entries, one per model. Each entry gets its own model_name, vendor, benchmark_score, price_input, and price_output. Put the shared context (e.g. "announced together at X event") in each entry's summary so each stands alone. Do NOT combine multiple models into one entry.

COMMUNITY AI WORKFLOW & ROUNDTABLE STORIES:
Always capture "Community AI Workflow" and "Roundtable" stories as use_case entries. Structure them as Problem → Tool → Steps → Result:
   - summary: describe the problem and the result achieved
   - how_its_built: describe the tool and approach used
   - steps: array of { text } objects describing each step of the workflow

3. Sort each item into exactly ONE type — no item gets multiple. system_layer is also singular or null (for industry type).
4. Keep summaries short and rewritten — never paste source text.
5. If the newsletter contains no genuine AI news items, return an empty array.

DUPLICATE DETECTION:
You will also receive a list of existing entries from the last 30 days, each with an id, title, type, system_layer, and model_name.
For each item you extract, compare it against the existing entries. Only flag an item as a duplicate if it covers the SAME SPECIFIC EVENT or ANNOUNCEMENT as an existing entry — e.g. the same model release announcement, the same funding round, the same product launch, the same policy decision. 
Do NOT flag as duplicate just because two entries mention the same company, the same product, or the same general topic. Different developments about the same product or company are SEPARATE entries, not duplicates.
   - If it IS a duplicate of the same event/announcement: set duplicate_of_id to the id of the existing entry and duplicate_of_title to the existing entry's title.
   - If it is NOT a duplicate: set duplicate_of_id to null.
When in doubt, do NOT flag as duplicate — only flag when both entries are clearly reporting the same specific event.

You MUST call the save_entries tool with your results. Do not output any text.`;

const VALID_TYPES = new Set([
  "news", "tutorial", "use_case", "tool", "model_release", "risk", "industry",
]);
const VALID_LAYERS = new Set([
  "model", "agent", "tools_connectors", "data_context",
  "evals", "security_governance", "interface",
]);
const NULLABLE_LAYER_TYPES = new Set(["industry"]);

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

// ── Extract site name from HTML or URL ────────────────
// Prefers og:site_name or the page <title> publication name from HTML.
// Falls back to a known-host map, then to the URL subdomain.
function extractSiteName(url: string, html?: string): string | null {
  // 1. Try og:site_name from HTML — the most reliable publication name
  if (html) {
    let match = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
    if (match) return match[1].trim();

    match = html.match(/<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i);
    if (match) return match[1].trim();

    // For beehiiv/substack: the <title> often contains the publication name
    // e.g. "The Rundown AI | AI News" or "Publication Name - beehiiv"
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const rawTitle = titleMatch[1].trim();
      // Strip common suffixes like " | beehiiv", " - Substack", etc.
      const cleaned = rawTitle
        .replace(/\s*[\|\-]\s*(beehiiv|substack)\s*$/i, '')
        .replace(/\s*[\|\-]\s*Issue\s*#?\d+.*$/i, '')
        .trim();
      if (cleaned.length > 0 && cleaned.length < 80 && !/beehiiv|substack/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  // 2. Known hosting-domain → publication-name map
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length < 2) return host;
    const subdomain = parts[0].toLowerCase();
    const base = parts[parts.length - 2].toLowerCase();

    // Map known subdomains on hosting platforms to publication names
    const subdomainMap: Record<string, string> = {
      therundownai: "The Rundown AI",
      tldr: "TLDR AI",
      thebatch: "The Batch",
      natter: "Natter",
    };
    if (subdomainMap[subdomain]) return subdomainMap[subdomain];

    // If the base domain is a hosting platform, use the subdomain as the name
    const hostingDomains = new Set(["beehiiv", "substack", "squarespace", "ghost"]);
    if (hostingDomains.has(base) && subdomain !== "www" && subdomain.length > 0) {
      return subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
    }

    // Known base-domain map
    const known: Record<string, string> = {
      tldr: "TLDR AI",
      therundown: "The Rundown AI",
      thebatch: "The Batch",
      natter: "Natter",
    };
    if (known[base]) return known[base];

    return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
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

// ── Normalize steps from various forms ─────────────────
function normalizeSteps(raw: any): Array<{ text: string; prompt?: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((s: any) => {
        if (typeof s === "string") return { text: s };
        if (s && typeof s === "object" && typeof s.text === "string") {
          return { text: s.text, ...(s.prompt ? { prompt: String(s.prompt) } : {}) };
        }
        return null;
      })
      .filter((s: any): s is { text: string; prompt?: string } => s !== null);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeSteps(parsed);
    } catch { /* not JSON */ }
    // Split on newlines or numbered lines
    const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) return lines.map((text) => ({ text }));
  }
  return [];
}

function sanitizeEntry(raw: ProcessedEntry, recentIds: Set<string>): ProcessedEntry | null {
  if (!raw.title || !raw.summary) return null;
  if (!VALID_TYPES.has(raw.type)) return null;

  // system_layer can be null for industry entries; otherwise must be valid
  const layer = raw.system_layer || null;
  if (layer !== null && !VALID_LAYERS.has(layer)) return null;
  if (layer === null && !NULLABLE_LAYER_TYPES.has(raw.type)) return null;

  // Validate duplicate_of_id — must be a real recent entry id
  let dupId: string | null = null;
  if (raw.duplicate_of_id && recentIds.has(raw.duplicate_of_id)) {
    dupId = raw.duplicate_of_id;
  }

  return {
    type: raw.type,
    system_layer: layer,
    title: String(raw.title).slice(0, 500),
    summary: String(raw.summary).slice(0, 2000),
    why_it_matters: raw.why_it_matters ? String(raw.why_it_matters) : null,
    how_its_built: raw.how_its_built ? String(raw.how_its_built) : null,
    business_angle: raw.business_angle ? String(raw.business_angle) : null,
    steps: normalizeSteps(raw.steps),
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

      autoSourceName = extractSiteName(cleanedUrl, html);
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
                type: { type: "string", enum: ["news", "tutorial", "use_case", "tool", "model_release", "risk", "industry"] },
                system_layer: { type: "string", enum: ["model", "agent", "tools_connectors", "data_context", "evals", "security_governance", "interface"], description: "The system layer this entry belongs to. Set to null for industry entries with no clear technical layer." },
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
              required: ["type", "title", "summary"],
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
        steps: e.steps || [],
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
        sources: [newSource],
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
