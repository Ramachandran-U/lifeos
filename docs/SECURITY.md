# LifeOS — Security Model

> This is the single source of truth for the LifeOS server-side security posture. Update it whenever a new Supabase table, Worker route, or admin flow is added.

Last reviewed: 2026-05-08

---

## 1. Trust boundaries

```
 ┌────────────────┐   ┌────────────────┐   ┌──────────────────┐
 │  Consumer app  │   │  Admin portal  │   │ Anyone on the    │
 │  (Expo, PWA)   │   │  (Next.js)     │   │ public internet  │
 └────────┬───────┘   └────────┬───────┘   └────────┬─────────┘
          │ Bearer JWT          │ Bearer JWT         │ rejected
          ▼                     ▼                    ▼
 ┌────────────────────────────────────────────────────────────┐
 │                  Cloudflare Worker (ai-proxy)              │
 │              — only ingress to the data plane —            │
 └─────────────────────┬──────────────────────────────────────┘
                       │ service-role key
                       ▼
 ┌────────────────────────────────────────────────────────────┐
 │              Supabase Postgres (admin tables)              │
 │            RLS enabled, ZERO policies → deny all           │
 └────────────────────────────────────────────────────────────┘
```

**Hard rules:**
- The Worker is the only path to the data plane. Neither the consumer app nor the admin portal queries Supabase Postgres directly. (Auth-only operations via `@supabase/ssr` are the sole exception.)
- The service-role key never leaves the Worker. Not in env files, not in admin SSR, not in CI logs.
- The admin portal authenticates against Supabase Auth, then passes the resulting JWT to the Worker on every privileged request. The Worker re-verifies the JWT and re-checks the `admins` table.

---

## 2. Supabase RLS policy (admin tables)

Tables: `admins`, `audit_log`, `flags`, `flag_overrides`, `prompts`, `prompt_versions`.

**Design: deny by default.**

Every table has `ENABLE ROW LEVEL SECURITY` and **zero CREATE POLICY** statements. In Postgres semantics, that means:
- `anon` role → no rows visible, no writes accepted.
- `authenticated` role → no rows visible, no writes accepted.
- `service_role` → bypasses RLS entirely (this is documented Supabase behavior). This is what the Worker uses.

Each table also carries a `COMMENT` reminding future contributors of the contract:
```sql
comment on table flags is 'RLS: deny by default. Access only via service-role through the Worker.';
```

### What this means in practice
- If you (or a future contributor) **add a permissive `CREATE POLICY`** to one of these tables without thinking, data will leak to any user holding a Supabase JWT. There is no other gate.
- If a feature would require the consumer app or admin browser to read these tables **directly** (without going through the Worker), the answer is **no**. Add a Worker route instead.

### Verification check (do this when adding a table)
1. Run from a browser console signed in to the admin portal:
   ```js
   const sb = window.__supabase ?? <make a browser client>;
   await sb.from('flags').select('*');
   // expected: { data: [], error: { code: 'PGRST...', message: 'permission denied for ...' } }
   ```
2. If you see rows, RLS is broken. Stop, revert, file an incident.

### Adding a new admin-side table
Always include this stanza:
```sql
alter table my_new_table enable row level security;
comment on table my_new_table is 'RLS: deny by default. Access only via service-role through the Worker.';
```
Do **not** add `CREATE POLICY` unless you have a documented reason and have updated this file.

---

## 3. Admin onboarding (replaces the raw-SQL password pattern)

### The wrong way (don't do this)
During Phase 1 bootstrap the first admin password was set with:
```sql
update auth.users
   set encrypted_password = crypt('…', gen_salt('bf'))
 where email = '…';
```
This bypasses email verification, MFA enrolment, password complexity rules, and the password-rotation pipeline. It also leaves no trail in `auth.audit_log_entries`. **Do not do this for production admins. Ever.**

### The right way

Two-step process for every new admin:

#### Step 1 — invite via Supabase

Either through the Dashboard:
1. Supabase Dashboard → Authentication → Users → **Invite user**
2. Enter the admin's email; Supabase sends a magic-link / set-password email
3. The invited user clicks through, sets a password (and enrolls MFA, see §4), and Supabase emits the proper `auth.users` row

Or via the Admin API (for scripted onboarding):
```ts
import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
await supabaseAdmin.auth.admin.inviteUserByEmail('new-admin@example.com');
```

#### Step 2 — whitelist in `admins` table

The invitation only creates the `auth.users` row. To grant LifeOS admin authority, also add a row in our `admins` table:
```sql
insert into admins (email, role, added_by)
values ('new-admin@example.com', 'editor', 'ramachandran.u@vearc.com')
on conflict (email) do nothing;
```

Roles:
- `owner` — can edit anything including the admins list. There should be ≤ 2 owners.
- `editor` — can edit prompts, flags, content. Cannot manage admins.
- `support` — read-only on telemetry + feedback (Phase 5).

Both steps must happen. Without step 1 the user can't sign in; without step 2 they sign in but get 403 from every `/v1/admin/*` route.

### Removing an admin
1. Delete (or set role to `revoked` — TBD) the row in `admins`.
2. Optionally delete the `auth.users` row via Supabase Dashboard. Their JWT continues to validate at the Worker until expiry (~1h), but every `/v1/admin/*` call now 403s.

### Re-invite the seeded admin
The migration seeds `ramachandran.u@vearc.com` as `owner`. The underlying `auth.users` row was originally created with a raw-SQL password. Before going to production:
1. Use Supabase Dashboard → **Send password reset** for that email
2. Set a fresh password through the link (or enrol MFA, see §4)
3. Confirm the old session is invalidated (sign out of all admin sessions)

---

## 4. MFA

**Status: not enforced (debt).**

Supabase Auth supports TOTP-based MFA. To enforce for admins:
1. Supabase Dashboard → Authentication → Providers → enable Multi-Factor Auth
2. Each admin enrols a TOTP factor at first sign-in
3. The Worker should additionally check the JWT's `aal` (authenticator assurance level) ≥ `aal2` before allowing `/v1/admin/*` — TODO in `workers/ai-proxy/src/lib/adminAuth.ts`.

Until that check is in place, MFA is opt-in and an admin can bypass it. Track as a follow-up in [PRE_PRODUCTION_CHECKLIST.md](PRE_PRODUCTION_CHECKLIST.md).

---

## 5. Admin sign-in modes

The admin portal supports two sign-in modes:
- **Magic link (default)** — Supabase OTP email. Use this in production.
- **Password (fallback)** — only useful for admins who have explicitly set a password through the Supabase invite flow. Do not encourage.

The default in `admin/app/sign-in/page.tsx` is magic-link. Password mode is still toggleable from the UI for the rare case (e.g. an admin without inbox access during an incident) but should be considered the discouraged path.

---

## 6. Session refresh

`admin/middleware.ts` runs `supabase.auth.getUser()` on every request through the Next.js middleware matcher, which the `@supabase/ssr` cookie hooks use to refresh expired JWTs and write the new cookie back to the response. Without this, admin pages would 401 once per session at the ~1h expiry boundary.

If you see random 401s on admin pages, the first thing to check is whether middleware.ts is being matched for that route.

---

## 7. Worker as single ingress

Every privileged route is gated by [`workers/ai-proxy/src/lib/adminAuth.ts`](../workers/ai-proxy/src/lib/adminAuth.ts) → `requireAdmin()`, which:
1. Verifies the Supabase JWT against the JWKS endpoint
2. Reads the email from the JWT claims
3. Looks up that email in the `admins` table (via service role)
4. Throws if not found or if `role` doesn't permit the action

If you add a new admin route in `workers/ai-proxy/src/routes/admin/`, you MUST also gate it with `requireAdmin()` at the dispatch level in `index.ts`. The existing dispatcher already does this for the `/v1/admin/*` prefix — keep new routes under that prefix.

---

## 8. Secrets inventory

| Secret | Stored | Used by |
|--------|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Wrangler secret | Worker only |
| `SUPABASE_ANON_KEY` | Public (admin .env.local, consumer bundle) | Admin SSR auth, consumer Supabase auth |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Wrangler secret | Worker only |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Wrangler secret | Worker `/v1/google/token` |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Consumer bundle | OAuth redirect URL builder (public by design) |

If a new secret needs client-side use, that's a red flag — design around it. The only acceptable "public secrets" are OAuth client IDs (where the leak is structural and Google's design accepts it).

---

## 9. Auditing

`audit_log` rows are written by `requireAdmin()` paths in the Worker. Every mutating action (publish prompt, flip flag, add admin, etc.) writes a row with `(actor_email, action, target_type, target_id, before, after, ts)`.

Read-only operations are not audited (high volume, low value). If a Phase-3 telemetry need arises for "who looked at what," add it then.

Retention: undefined. Decide before scaling — see [PRE_PRODUCTION_CHECKLIST.md](PRE_PRODUCTION_CHECKLIST.md) item #12.

---

## 10. Incident response shortcuts

| Symptom | First action |
|---------|--------------|
| Admin tables leaking via anon | Check for accidental `CREATE POLICY`. Run the §2 verification command. Drop the policy. |
| Admin can't sign in | Check `admins` table has their row AND the `auth.users` row exists. Magic-link is the default. |
| Worker leaks data | Check `requireAdmin()` is called on the route. Check `ALLOWED_ORIGIN` is not `*`. |
| Service role key suspected leaked | Rotate via Supabase Dashboard → API. Update Wrangler secret. Redeploy Worker. |
