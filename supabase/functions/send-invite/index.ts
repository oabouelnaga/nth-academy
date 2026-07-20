const SUPABASE_URL = "https://mizkuzwfjvvulkiyotle.supabase.co";
const INVITE_REDIRECT_URL = "https://nth-academy.org/set-password.html";
const ALLOWED_ORIGINS = ["https://nth-academy.org", "http://localhost"];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

  let body: { email?: string; name?: string; courseId?: string; cohortId?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }); }

  const { email, name, courseId, cohortId } = body;
  if (!email) return new Response(JSON.stringify({ error: "email is required" }), { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

  // Invite user via Admin REST API (no esm.sh import needed)
  const inviteRes = await fetch(SUPABASE_URL + "/auth/v1/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": "Bearer " + serviceRoleKey },
    body: JSON.stringify({ email, data: { full_name: name || "" }, invite: true, redirect_to: INVITE_REDIRECT_URL }),
  });
  const inviteData = await inviteRes.json() as { id?: string; msg?: string; message?: string };
  if (!inviteRes.ok) return new Response(JSON.stringify({ error: inviteData.msg || inviteData.message || "Invite failed" }), { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

  const userId = inviteData.id;

  if (userId && courseId) {
    await fetch(SUPABASE_URL + "/rest/v1/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": "Bearer " + serviceRoleKey, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ id: userId, email, full_name: name || "", role: "student" }),
    });
    await fetch(SUPABASE_URL + "/rest/v1/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": serviceRoleKey, "Authorization": "Bearer " + serviceRoleKey, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ student_id: userId, course_id: courseId, cohort_id: cohortId || null, payment_status: "pending" }),
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
});
