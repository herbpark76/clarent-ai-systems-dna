import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    // Verify caller has admin role
    let callerRole: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      callerRole = payload.app_metadata?.role ?? null;
    } catch { /* malformed JWT */ }

    if (callerRole !== "admin") {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Admin access required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, full_name } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "A valid email is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Full name is required (at least 2 characters)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Determine the redirect URL for the invite email
    const siteUrl = Deno.env.get("SITE_URL") || "https://aisystems.clarenttech.com";
    const redirectTo = `${siteUrl}/learn`;

    // Invite the user by email with trainee role and full_name
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      {
        redirect_to: redirectTo,
        data: { full_name: full_name.trim() },
      }
    );

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: `Invite failed: ${inviteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = inviteData.user.id;

    // Set app_metadata.role = "trainee" via admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(newUserId, {
      app_metadata: { role: "trainee" },
    });

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `User invited but role assignment failed: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create lp_profiles row (id FK to auth.users)
    const { error: profileError } = await adminClient
      .from("lp_profiles")
      .insert({ id: newUserId, full_name: full_name.trim() });

    if (profileError) {
      // If profile already exists, upsert instead
      const { error: upsertError } = await adminClient
        .from("lp_profiles")
        .upsert({ id: newUserId, full_name: full_name.trim() });

      if (upsertError) {
        return new Response(
          JSON.stringify({ error: `User invited and role set, but profile creation failed: ${upsertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId, email: email.trim().toLowerCase() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Server error: ${String(err)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
