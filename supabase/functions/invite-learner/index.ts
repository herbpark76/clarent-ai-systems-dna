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

    const siteUrl = Deno.env.get("SITE_URL") || "https://aisystems.clarenttech.com";
    const redirectTo = `${siteUrl}/learn`;
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = full_name.trim();

    // Try to invite a new user
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirect_to: redirectTo, data: { full_name: trimmedName } }
    );

    let userId: string;
    let wasExisting = false;

    if (inviteError) {
      // Check if the error is because the user already exists
      const isAlreadyExists = inviteError.message.includes("already been registered") ||
        inviteError.message.includes("already registered") ||
        inviteError.message.includes("User already registered");

      if (!isAlreadyExists) {
        return new Response(
          JSON.stringify({ error: `Invite failed: ${inviteError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // User already exists — look them up by email
      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) {
        return new Response(
          JSON.stringify({ error: `User exists but lookup failed: ${listError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const existingUser = (listData.users || []).find(
        (u: any) => u.email?.toLowerCase() === normalizedEmail
      );

      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: "User appears to exist but could not be found by email." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = existingUser.id;
      wasExisting = true;

      // Send a password-reset email so they can sign in
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo }
      );

      if (resetError) {
        return new Response(
          JSON.stringify({ error: `Found existing user but password reset email failed: ${resetError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      userId = inviteData.user.id;
    }

    // Set app_metadata.role = "trainee" and user_metadata.full_name
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { role: "trainee" },
      user_metadata: { full_name: trimmedName },
    });

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Role/name assignment failed: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update lp_profiles row
    const { error: profileError } = await adminClient
      .from("lp_profiles")
      .upsert({ id: userId, full_name: trimmedName });

    if (profileError) {
      return new Response(
        JSON.stringify({ error: `Role and name set, but profile creation failed: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = wasExisting
      ? "Existing user updated. A password reset email has been sent so they can sign in."
      : "Invite email sent.";

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email: normalizedEmail, was_existing: wasExisting, message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Server error: ${String(err)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
