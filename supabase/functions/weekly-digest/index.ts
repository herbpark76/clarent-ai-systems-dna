import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "hpark76@gmail.com";
const SITE_ORIGIN = Deno.env.get("SITE_URL") || "https://aisystems.clarenttech.com";
const DEFAULT_FROM = "AI Systems DNA <notifications@clarenttechnologies.com>";
const FROM_EMAIL = Deno.env.get("RESEND_FROM") || DEFAULT_FROM;

interface WaitlistRow {
  email: string;
  name: string | null;
  unsubscribe_token: string;
}

interface EntryRow {
  title: string;
  slug: string;
  summary: string;
  type: string;
  created_at: string;
}

function buildDigestHtml(entries: EntryRow[], recipients: WaitlistRow[]): string {
  const entryHtml = entries.map((e, i) => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">${e.type.replace(/_/g, " ")}</div>
        <a href="${SITE_ORIGIN}/signal-desk/${e.slug}" style="font-size: 16px; font-weight: 700; color: #1e293b; text-decoration: none; display: block; margin-bottom: 4px;">${e.title}</a>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">${e.summary.slice(0, 160)}${e.summary.length > 160 ? "..." : ""}</p>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:white;padding:32px;">
    <div style="margin-bottom:24px;">
      <h1 style="font-size:22px;font-weight:700;color:#1e293b;margin:0 0 8px 0;">Weekly AI Signal Digest</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">Top ${entries.length} AI signals from the past 7 days, sorted by system layer.</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">${entryHtml}</table>
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
      <a href="${SITE_ORIGIN}/signal-desk" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:white;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;">View all on Signal Desk</a>
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      <p>You're receiving this because you signed up for AI Systems DNA updates.</p>
      <p style="margin-top:8px;"><a href="${SITE_ORIGIN}/unsubscribe?token={{UNSUB_TOKEN}}" style="color:#64748b;">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`;
}

function buildDigestText(entries: EntryRow[]): string {
  const lines = entries.map((e, i) => `${i + 1}. [${e.type.replace(/_/g, " ")}] ${e.title}\n   ${e.summary.slice(0, 160)}${e.summary.length > 160 ? "..." : ""}\n   ${SITE_ORIGIN}/signal-desk/${e.slug}`);
  return `Weekly AI Signal Digest\n\nTop ${entries.length} AI signals from the past 7 days:\n\n${lines.join("\n\n")}\n\nView all: ${SITE_ORIGIN}/signal-desk\n\n--\nYou're receiving this because you signed up for AI Systems DNA updates.\nTo unsubscribe, use the link in the HTML version of this email.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode } = body;

    // Admin auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let callerRole: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      callerRole = payload.app_metadata?.role ?? null;
    } catch { /* malformed JWT */ }

    if (callerRole !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized. Admin access required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch top published entries from the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    const { data: entries, error: entriesError } = await supabase
      .from("signal_desk_entries")
      .select("title, slug, summary, type, created_at")
      .eq("status", "published")
      .in("duplicate_status", ["none", "separate"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(10);

    if (entriesError) {
      return new Response(JSON.stringify({ error: `Failed to load entries: ${entriesError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entryRows: EntryRow[] = (entries || []) as EntryRow[];

    // Fetch active subscribers
    const { data: subs, error: subsError } = await supabase
      .from("ai_systems_waitlist")
      .select("email, name, unsubscribe_token")
      .is("unsubscribed_at", null);

    if (subsError) {
      return new Response(JSON.stringify({ error: `Failed to load subscribers: ${subsError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients: WaitlistRow[] = (subs || []) as WaitlistRow[];

    // ── Preview mode: return the rendered email without sending ──
    if (mode === "preview") {
      if (entryRows.length === 0) {
        return new Response(JSON.stringify({ html: "<p>No published entries in the past 7 days.</p>", text: "", recipient_count: recipients.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sampleHtml = buildDigestHtml(entryRows, recipients).replace("{{UNSUB_TOKEN}}", "PREVIEW_TOKEN");
      const sampleText = buildDigestText(entryRows);
      return new Response(JSON.stringify({ html: sampleHtml, text: sampleText, recipient_count: recipients.length, entry_count: entryRows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Send mode: email each subscriber individually ──
    if (mode === "send") {
      if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured. Cannot send digest." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (entryRows.length === 0) {
        return new Response(JSON.stringify({ error: "No published entries in the past 7 days to send." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (recipients.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: "No active subscribers to send to." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const textBody = buildDigestText(entryRows);
      let sentCount = 0;
      let failCount = 0;

      for (const sub of recipients) {
        const html = buildDigestHtml(entryRows, recipients).replace("{{UNSUB_TOKEN}}", sub.unsubscribe_token);
        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: sub.email,
              subject: `Weekly AI Signal Digest — ${entryRows.length} new signals`,
              html,
              text: textBody + `\n\nUnsubscribe: ${SITE_ORIGIN}/unsubscribe?token=${sub.unsubscribe_token}`,
            }),
          });
          if (resp.ok) sentCount++;
          else {
            const errText = await resp.text();
            console.error(`[weekly-digest] Resend API error (${resp.status}) for ${sub.email}: ${errText.slice(0, 300)}`);
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      return new Response(JSON.stringify({ sent: sentCount, failed: failCount, total: recipients.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode. Use 'preview' or 'send'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[weekly-digest] Unhandled error: ${(err as Error)?.message || err}`);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
