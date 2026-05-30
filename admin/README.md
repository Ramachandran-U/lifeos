# LifeOS Admin Portal

Next.js 14 ops portal for prompts, flags, telemetry, feedback, and AI operations.
Talks to the existing Cloudflare Worker ([`workers/ai-proxy/`](../workers/ai-proxy)) via
the user's Supabase JWT.

## Tabs

Working (magic-link sign-in + admins-table role gate in front of all of them):

- **Overview** — health snapshot across the worker.
- **AI Operations** — consolidated AI ops view (also surfaces eval runs and schema failures, which remain reachable as deep-links).
- **Users** — registered users.
- **Telemetry** — event/usage telemetry.
- **Feedback** — in-app feedback inbox.
- **Flags** — list / toggle / kill feature flags.
- **Prompts** — view and edit per-key system prompts.
- **Push** — broadcast push notifications.

Coming: audit log (sidebar entry shown as "soon").

## Setup

```bash
cd admin
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_WORKER_URL
npm install
npm run dev   # http://localhost:3030
```

## Required Supabase setup

1. Apply `supabase/migrations/0001_admin_init.sql` (run via Supabase SQL editor or `supabase db push`).
2. Update the seeded admin email to whoever the first owner is — the migration
   inserts `ramachandran.u@vearc.com` as `owner`. Add more rows with `editor`
   or `support` role as needed.

## Required Worker setup

1. `cd ../workers/ai-proxy`
2. `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` — paste the project's service-role key.
3. `wrangler deploy` (or `wrangler dev` for local).
4. The Worker now exposes:
   - `GET  /v1/config` — public, consumer app fetches resolved flags.
   - `GET  /v1/admin/flags` — JWT + admins-table gated.
   - `PATCH /v1/admin/flags/:key` — `editor` and `owner` only.
   - plus the other JWT-gated admin routes the portal consumes under `/v1/admin/`:
     `prompts`, `telemetry`, `feedback`, `push`, `evals`, `overview`, `ai-ops`, `users`
     (see [`workers/ai-proxy/src/routes/admin/`](../workers/ai-proxy/src/routes/admin)).

## Architecture rule

Admin frontend NEVER talks to Supabase directly except for `auth` (magic link).
All data reads/writes go through the Worker, which holds the service-role key
and enforces the admins-table check. RLS on the data tables is locked down so
that even if the anon key leaked, no one could read `flags` or `audit_log`
without a service-role key.
