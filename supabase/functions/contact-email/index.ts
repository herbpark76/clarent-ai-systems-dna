import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "hpark76@gmail.com";
const SITE_ORIGIN = Deno.env.get("SITE_URL") || "https://aisystems.clarenttech.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { name, email, company, topic, message } = body;

    if (!name || !email || !topic || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("[contact-email] RESEND_API_KEY not configured — email not sent, but contact message is saved.");
      return new Response(JSON.stringify({ ok: true, emailed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailSubject = `New contact: ${topic} — ${name}`;
    const emailBody = [
      `New contact form submission`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      company ? `Company: ${company}` : null,
      `Topic: ${topic}`,
      ``,
      `Message:`,
      message,
      ``,
      `Submitted at ${SITE_ORIGIN}/contact`,
    ].filter(Boolean).join("\n");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AI Systems DNA <onboarding@resend.dev>",
        to: ADMIN_EMAIL,
        reply_to: email,
        subject: emailSubject,
        text: emailBody,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[contact-email] Resend API error (${resp.status}): ${errText.slice(0, 300)}`);
      return new Response(JSON.stringify({ ok: true, emailed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, emailed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[contact-email] Unhandled error: ${(err as Error)?.message || err}`);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
