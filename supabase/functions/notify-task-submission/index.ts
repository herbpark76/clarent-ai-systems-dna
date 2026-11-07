const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ADMIN_EMAIL = "hpark76@gmail.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      // Fail silently — never block the learner's submission
      return new Response(
        JSON.stringify({ success: false, reason: "RESEND_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { learnerName, taskTitle } = await req.json();

    const subject = `Task submitted: ${taskTitle}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0ea5e9; font-size: 18px; margin-bottom: 16px;">New task submission</h2>
        <p style="color: #333; font-size: 14px; line-height: 1.6;">
          <strong>${learnerName || 'A learner'}</strong> has submitted
          <strong>${taskTitle || 'a task'}</strong> for review.
        </p>
        <p style="color: #666; font-size: 13px; line-height: 1.6; margin-top: 16px;">
          Log in to the <a href="https://aisystems.clarenttech.com/learn" style="color: #0ea5e9;">Learn Portal</a> to review the submission.
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AI Systems Learn <onboarding@resend.dev>",
        to: ADMIN_EMAIL,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ success: false, error: errText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
