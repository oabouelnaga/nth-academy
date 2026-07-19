# NTH Academy — Project Context

Education academy based in Egypt. Student portal built as a static site on GitHub Pages, backed by Supabase for auth and data.

## Live URLs

| | |
|---|---|
| **Site** | https://nth-academy.org |
| **GitHub repo** | https://github.com/oabouelnaga/nth-academy |
| **Supabase dashboard** | https://supabase.com/dashboard/project/mizkuzwfjvvulkiyotle |

## Deployment

GitHub Pages from `main` branch. Deploy = commit + push (or upload via GitHub web UI). Pages rebuilds in ~30 seconds after each push.

**Egypt network note:** GitHub Pages (github.io) is accessible from Egypt. Netlify and Cloudflare have been blocked since ~June 2026. Do not migrate hosting there.

## Supabase

- **Project URL:** `https://mizkuzwfjvvulkiyotle.supabase.co`
- **Publishable key:** stored in `NTH password.txt` (never hardcode secrets beyond the publishable key)
- **Database password:** stored in `NTH password.txt`

### Tables

| Table | Purpose |
|---|---|
| `profiles` | One row per user. Columns: `id` (= auth.uid), `email`, `role` (student / instructor / admin), `full_name` |
| `students` | Student enrollment records |
| `sessions` | Scheduled class sessions |
| `materials` | Course materials/uploads |
| `homework` | Homework assignments and submissions |

Auto-trigger `handle_new_user()` fires on every Supabase Auth signup and creates a `profiles` row with `role = 'student'`.

### RLS

RLS is enabled. Policies to be aware of:
- `profiles` SELECT: authenticated users can read their own row (`auth.uid() = id`)
- Other tables: verify policies before building features that query them

## Critical: Supabase JS naming convention

The Supabase CDN (`@supabase/supabase-js@2` from jsdelivr) declares a global `supabase` identifier. **Never** name our client variable `supabase` — it causes `SyntaxError: Identifier 'supabase' has already been declared`.

**Always use `db` as the client variable name:**

```js
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

Also watch for **multi-line method chaining** — `replace_all` for `supabase.from(` misses patterns where the call spans two lines:

```js
// This pattern needs its own replace: "await supabase" → "await db"
const { data } = await db
    .from('profiles')
    .select('role')
    ...
```

## Pages built

| File | Status | Notes |
|---|---|---|
| `index.html` | ✅ Done | Landing/marketing page |
| `login.html` | ✅ Done | Auth with role-based redirect → dashboard / instructor / admin |
| `dashboard.html` | ✅ Done | Student dashboard — sessions, homework, materials, grades |
| `admin.html` | ✅ Done | Admin panel |
| `instructor.html` | ✅ Done | Instructor dashboard — students, sessions, upload materials, assign/grade homework |

## Role-based routing (login.html)

After successful auth, `redirectToDashboard(user)` queries `profiles.role` and routes:

- `student` → `dashboard.html`
- `instructor` → `instructor.html`
- `admin` → `admin.html`

## Test credentials

| Email | Password | Role |
|---|---|---|
| `student@nth.com` | `TestStudent123!` | student |

Create additional test users via the Supabase Auth dashboard. The `handle_new_user()` trigger fires automatically — no manual INSERT needed.

## Instructor test user + RLS — ✅ Done

Instructor account created and role-tested against `students`, `sessions`, `materials`, `homework`. instructor.html role-checks on load: if `profiles.role !== 'instructor'` it redirects to login.html.

## Next build: custom domain

Domain not yet purchased. Once bought, do this:

1. **Buy the domain** (user does this manually — real-money purchase, not something to automate). Suggestions: `nthacademy.com` / `nth-academy.com`. Registrar: Namecheap or GoDaddy (avoid Cloudflare Registrar — Cloudflare is blocked in Egypt as of ~June 2026, and while registration itself may not route through the blocked proxy, GitHub Pages custom domains work fine on any registrar's DNS so there's no reason to risk it).
2. **Add DNS records** at the registrar:
   - Apex domain (`nthacademy.com`) → four `A` records pointing to GitHub Pages IPs:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - `www` subdomain → `CNAME` record pointing to `oabouelnaga.github.io`
3. **Add a `CNAME` file** to the repo root containing just the domain name (e.g. `nthacademy.com`), then commit + push.
4. **Set custom domain in GitHub**: repo Settings → Pages → Custom domain → enter the domain → Save. Enable "Enforce HTTPS" once GitHub provisions the cert (can take up to 24h).
5. **Update this file**: replace the Live URLs table entry once the custom domain is live and verified working from an Egypt network.

## Future work

- Payment integration (Paymob or Fawry — Egypt-accessible)
- User creation from admin panel (needs Supabase Edge Function for service-role key — do not expose service key in client-side JS)
- Real content: course names, instructor bios/photos, WhatsApp contact, pricing

## Stack

- **Frontend:** Vanilla HTML/CSS/JS — no build step, no framework
- **Fonts:** Google Fonts (Inter + Cairo for Arabic)
- **Auth/DB:** Supabase JS v2 via CDN
- **Hosting:** GitHub Pages
- **i18n:** English/Arabic toggle via CSS class `body.ar` — all pages support RTL
