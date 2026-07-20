const SUPABASE_URL = "https://mizkuzwfjvvulkiyotle.supabase.co";
const ALLOWED_ORIGINS = ["https://nth-academy.org", "http://localhost"];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  };
}

async function dbQuery(serviceRoleKey: string, table: string, filters: [string, string][]): Promise<Record<string, unknown> | null> {
  const params = filters.map(([k, v]) => k + "=eq." + encodeURIComponent(v)).join("&");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}&limit=1`, {
    headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
  });
  const rows = await res.json() as Record<string, unknown>[];
  return rows[0] || null;
}

async function sendEmail(apiKey: string, to: string, toName: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "NTH Academy", email: "noreply.nthacademy@gmail.com" },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
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

  let body: { type?: string; slotId?: string; studentId?: string; instructorId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const { type, slotId, studentId, instructorId } = body;
  if (!type || !slotId || !studentId || !instructorId) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("BREVO_API_KEY");

  if (!serviceRoleKey || !apiKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const [slot, student, instructor] = await Promise.all([
    dbQuery(serviceRoleKey, "availability", [["id", slotId]]),
    dbQuery(serviceRoleKey, "profiles", [["id", studentId]]),
    dbQuery(serviceRoleKey, "profiles", [["id", instructorId]]),
  ]);

  if (!slot || !student || !instructor) {
    return new Response(JSON.stringify({ error: "Data not found" }), {
      status: 404,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const slotDate = new Date(slot.available_at as string).toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const title = (slot.title as string) || "Session";
  const dur = slot.duration_mins ? ` &middot; ${slot.duration_mins} min` : "";
  const teamsBtn = slot.teams_link
    ? `<p><a href="${slot.teams_link}" style="background:#0078d4;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">Join via Teams</a></p>`
    : "";
  const footer = `<p style="color:#888;font-size:12px;margin-top:24px">NTH Academy &middot; <a href="https://nth-academy.org">nth-academy.org</a></p>`;

  type EmailJob = { to: string; name: string; subject: string; html: string };
  const emails: EmailJob[] = [];

  if (type === "booking") {
    emails.push({
      to: student.email as string, name: (student.full_name as string) || "",
      subject: `Session booked: ${title}`,
      html: `<p>Hi ${student.full_name || "there"},</p><p>Your session is confirmed.</p><p><strong>${title}</strong><br>${slotDate}${dur}<br>Instructor: ${instructor.full_name}</p>${teamsBtn}${footer}`,
    });
    emails.push({
      to: instructor.email as string, name: (instructor.full_name as string) || "",
      subject: `New booking: ${title}`,
      html: `<p>Hi ${instructor.full_name || "there"},</p><p>A student booked your session.</p><p><strong>${title}</strong><br>${slotDate}${dur}<br>Student: ${student.full_name} (${student.email})</p>${teamsBtn}${footer}`,
    });
  } else if (type === "cancellation_student") {
    emails.push({
      to: student.email as string, name: (student.full_name as string) || "",
      subject: `Booking cancelled: ${title}`,
      html: `<p>Hi ${student.full_name || "there"},</p><p>Your booking was cancelled.</p><p><strong>${title}</strong><br>${slotDate}</p><p><a href="https://nth-academy.org/dashboard.html">Book another slot</a></p>${footer}`,
    });
    emails.push({
      to: instructor.email as string, name: (instructor.full_name as string) || "",
      subject: `Booking cancelled: ${title}`,
      html: `<p>Hi ${instructor.full_name || "there"},</p><p>${student.full_name} cancelled their booking. The slot is open again.</p><p><strong>${title}</strong><br>${slotDate}</p>${footer}`,
    });
  } else if (type === "cancellation_instructor") {
    emails.push({
      to: student.email as string, name: (student.full_name as string) || "",
      subject: `Session cancelled: ${title}`,
      html: `<p>Hi ${student.full_name || "there"},</p><p>Your instructor cancelled this session.</p><p><strong>${title}</strong><br>${slotDate}</p><p><a href="https://nth-academy.org/dashboard.html">Book another slot</a></p>${footer}`,
    });
  }

  const results = await Promise.allSettled(
    emails.map((e) => sendEmail(apiKey, e.to, e.name, e.subject, e.html))
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason as Error)?.message || String(r.reason));

  return new Response(JSON.stringify({ success: true, sent, errors }), {
    status: 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
});
