# Deploying Supabase Edge Functions

## send-invite

Sends a Supabase Auth invite email to a new student. The invite link
redirects to `https://nth-academy.org/set-password.html`.

---

### Prerequisites

Node.js and npm must be installed. The Supabase CLI is installed via npm.

---

### Steps

**1. Install the Supabase CLI**

```bash
npm install -g supabase
```

Verify:

```bash
supabase --version
```

**2. Log in**

```bash
supabase login
```

A browser window opens. Authenticate with your Supabase account.

**3. Link to the NTH Academy project**

```bash
supabase link --project-ref mizkuzwfjvvulkiyotle
```

Run this from the repo root (the directory containing `supabase/`).

**4. Set the service-role secret**

Get the service-role key from the Supabase dashboard:
Settings → API → Project API keys → `service_role` (reveal and copy).

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<paste-key-here>
```

Never commit this key to the repo.

**5. Deploy the function**

```bash
supabase functions deploy send-invite
```

The CLI bundles `supabase/functions/send-invite/index.ts` and uploads it.
Deployment takes ~30 seconds.

---

### Calling the function

```
POST https://mizkuzwfjvvulkiyotle.supabase.co/functions/v1/send-invite
Content-Type: application/json
Authorization: Bearer <anon-key>

{
  "email": "student@example.com",
  "name": "Student Name"
}
```

A successful response:

```json
{ "success": true }
```

---

### Re-deploying after changes

```bash
supabase functions deploy send-invite
```

No need to re-link or re-set secrets between deploys.
