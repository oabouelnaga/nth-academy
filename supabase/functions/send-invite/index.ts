import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mizkuzwfjvvulkiyotle.supabase.co";
const INVITE_REDIRECT_URL = "https://nth-academy.org/set-password.html";

const ALLOWED_ORIGINS = [
  "https://nth-academy.org",
  "http://localhost",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  let body: { email?: string; name?: string; courseId?: string; cohortId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const { email, name, courseId, cohortId } = body;

  if (!email) {
    return new Response(JSON.stringify({ error: "email is required" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: missing service role key" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  const db = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Invite (or re-invite) the user — inviteUserByEmail is idempotent for existing users
  const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: INVITE_REDIRECT_URL,
    data: { full_name: name ?? "" },
  });

  if (inviteError) {
    return new Response(
      JSON.stringify({ error: inviteError.message }),
      { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  const userId = inviteData.user?.id;

  // Insert enrollment immediately — we have the user id from the invite response
  if (userId && courseId) {
    // Ensure profiles row exists with correct name
    await db.from("profiles").upsert(
      { id: userId, email, full_name: name ?? "", role: "student" },
      { onConflict: "id" }
    );

    await db.from("enrollments").upsert(
      {
        student_id: userId,
        course_id: courseId,
        cohort_id: cohortId ?? null,
        payment_status: "pending",
      },
      { onConflict: "student_id,course_id" }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
});
