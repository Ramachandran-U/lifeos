# LifeOS Admin Portal — Implementation Plan

> **Status:** plan, not yet built. Source of truth until v1 ships.
> **Owner:** Ramachandran
> **Stack decisions:** Next.js 14 (App Router) at `admin/` · Cloudflare Worker (extend `lifeos-ai-proxy`) · Supabase Postgres + Auth · Cloudflare KV for hot config reads · Opt-in anonymous telemetry from day 1.

---

## 1. Why this exists

LifeOS is local-first. The privacy doc says the app stores no user data on a server, and that has to remain true. So the admin portal is **not** a user-data console — it is an **operations** portal for the team that builds LifeOS:

- Edit prompts and feature flags **without an app release** (current pain: every prompt tweak ships through the Expo store).
- See **anonymous** funnel + AI usage data so product decisions stop being intuition-only.
- Triage feedback (the `projectm7sct+lifeos@gmail.com` mailto already exists; it has no surface today).
- Catch AI regressions early via evals + schema-failure logs.
- Kill-switch a misbehaving feature in seconds.

The non-goal is equally important: **never hold per-user state on the server**. No user lookup, no goal database, no "view this user's plan." If a feature would require it, the answer is no.

---

## 2. Architecture at a glance

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│  Consumer app (Expo)        │         │  Admin portal (Next.js)  │
│  — local SQLite/IndexedDB   │         │  — Vercel or CF Pages    │
│  — fetches flags+prompts    │         │  — Supabase magic-link   │
│    from KV at startup       │         │  — gated by admins table │
└──────────────┬──────────────┘         └─────────────┬────────────┘
               │                                       │
               │ AI calls (already done)               │ admin API
               │ telemetry POST (new, opt-in)          │
               ▼                                       ▼
        ┌──────────────────────────────────────────────────────┐
        │  Cloudflare Worker (lifeos-ai-proxy, EXTENDED)        │
        │   /v1/ai/*           ← already exists                 │
        │   /v1/telemetry      ← new, anon, opt-in              │
        │   /v1/config         ← new, public read of KV         │
        │   /v1/admin/*        ← new, JWT + role-checked        │
        └──────┬─────────────────────────────────┬─────────────┘
               │                                 │
        ┌──────▼──────┐                  ┌───────▼──────────┐
        │ Cloudflare  │                  │   Supabase       │
        │ KV (hot)    │                  │   Postgres + RLS │
        │ flags,      │                  │   prompts hist,  │
        │ active      │                  │   evals, events, │
        │ prompts     │                  │   feedback, audit│
        └─────────────┘                  └──────────────────┘
```

**Rule of thumb:**
- **KV** = anything the consumer app reads on startup (flags, currently-published prompts, kill switches). Sub-10ms global reads.
- **Postgres** = anything that needs history, joins, or row-level security (prompt versions, eval runs, telemetry events, feedback, audit log, admins).
- **Worker** = the *only* thing the public internet talks to. The Next.js admin frontend goes through the Worker too — it never hits Supabase directly except for auth (magic-link).

---

## 3. The five surfaces (v1 scope)

### 3.1 AI Ops

The most valuable part. Concrete features:

- **Prompt registry.** Every system prompt (`DISCOVERY_EXTRACTION_PROMPT`, `DISCOVERY_USER_PROMPT`, goal/health/finance/career/routine/reflect prompts) is a row in `prompts` with versions in `prompt_versions`. Admin can edit, diff against current published version, save as draft, run evals, then **publish** — which atomically writes the new version body to KV under `prompt:<key>:active`. Consumer app reads from KV at app start (cached 60s) instead of bundling prompt strings.
- **Prompt eval runner.** A small fixture set per prompt (~5–10 inputs each) lives in `eval_fixtures`. `Run evals` on a draft sends each fixture through the model, validates the output against the same Zod schema the app uses, and shows pass/fail + diffs. Block "Publish" if eval pass-rate drops below the threshold of the current published version.
- **Schema-parse failure log.** Every time the consumer app's `Zod.parse()` throws on AI output (already happens — see `extractDiscoveryProfile` catch block), it POSTs the raw response + prompt-version-id + schema-name to `/v1/telemetry` (anonymous; no user content beyond the AI output itself). Admin sees a feed grouped by prompt+schema with frequency and an "open in eval" action that adds the failing input as a new fixture.
- **Cost & latency dashboard.** Worker already proxies AI calls — extend it to record `(timestamp, prompt_key, model, input_tokens, output_tokens, latency_ms, cache_hit)` to a Postgres `ai_calls` table, sampled at 100% in v1. Charts: per-prompt p50/p95 latency, $/day per prompt, cache hit rate.
- **Mock-mode cohort toggle.** Already a flag (`EXPO_PUBLIC_USE_AI_MOCK`) at the env level — promote it to a runtime flag so QA/internal users can be put on mocks without an app rebuild.

### 3.2 Release & Content Ops

- **Feature flags.** Single `flags` table. Each flag: key, type (`bool` | `cohort_pct` | `enum`), default, per-cohort overrides (platform, app_version, opt-in tester list). Consumer app fetches the resolved-for-me bundle from `/v1/config` at startup and caches in localStorage with a 5-min stale-while-revalidate.
  - Initial flags to seed: `discovery_import_enabled`, `chatbot_beta`, `gmail_finance_enabled`, `evening_reflect_enabled`, `polymath_enabled`.
- **Kill switches.** Same table; admins can flip any flag to `force_off` and consumer app respects within one config refresh.
- **Force-update gate.** `min_app_version` per platform. If `Platform.OS == ios` and version < 1.4.0, the app shows a hard update screen.
- **Hot content.** A separate `content` table for things that aren't prompts but want to ship without a release: chatbot knowledge pack, badge definitions, starter routines per domain, the canned `DISCOVERY_USER_PROMPT`. Same publish-to-KV mechanism.
- **Push broadcast.** Tokens are the *only* user identifier we keep server-side, in an `expo_push_tokens` table (created on first opt-in to notifications, no PII linked). Admin can compose a push, segment by platform/app_version/last_active_within, and dispatch via Expo Push API.

### 3.3 Telemetry & Funnel (opt-in)

- **Posture.** Anonymous, opt-in (toggle in Profile sidebar, default OFF). Updated privacy doc covers it explicitly. Single anonymous device-id (UUID generated locally, stored in localStorage) — never tied to user id, name, or email.
- **Events.** `telemetry_events(device_id, event, props_json, ts, app_version, platform)`. Whitelist of allowed event names is enforced server-side; payloads schema-validated. Initial set: `onboarding_step_completed`, `onboarding_dropped`, `goal_created`, `routine_block_completed`, `discovery_import_started/extracted/seeded`, `evening_reflect_completed`, `ai_call`, `ai_schema_failure`, `crash`.
- **Crash reporting.** Lightweight wrapper around `ErrorUtils.setGlobalHandler` posts stack + breadcrumbs to telemetry. No third-party (Sentry/etc) in v1 to keep the privacy promise tight.
- **Dashboards.** Two views are 80% of the value: (a) onboarding funnel (welcome-intent → first goal → 7-day retention), (b) feature engagement (DAU per tab, AI calls per fn per day). Built on Supabase queries with `cube.dev`-style precomputed rollups — or just SQL views if traffic stays small.

### 3.4 Feedback & Support

- **Inbox.** The `projectm7sct+lifeos@gmail.com` mailto continues to exist for the user. A scheduled Worker (cron 1×/hour) uses Gmail API (single service account, OAuth refresh token) to pull unread mail into a `feedback` table: from-email, subject, body, attachments_count, received_ts, status (`new` | `triaged` | `responded` | `closed`).
- **Triage UI.** List view, tag/assign/respond, mark resolved. Reply sends from the same address via Gmail API (or just opens the email client — v1 pragmatic).
- **In-app feedback (v1.1).** Optional next pass: replace the mailto with an in-app `POST /v1/feedback` that writes directly. Keeps experience smoother, but mailto works for v1.

### 3.5 Admin Auth & Audit

- **Auth.** Supabase magic-link only (no passwords). `admins` table whitelists allowed emails — anyone else's JWT, even if valid, is 403'd by the Worker. Roles in v1: `owner` (you), `editor` (can edit prompts/flags/content), `support` (can read telemetry + feedback only).
- **Audit log.** Every mutating admin action writes a row to `audit_log(actor, action, target, before_json, after_json, ts)`. Surfaced as a tab in the admin UI.
- **Two-person rule for prompt publish (optional v2).** Editor saves draft → owner clicks publish. Defer for v1 unless the team grows.

---

## 4. Data model — Supabase tables

```sql
-- prompts & evals
prompts(id, key UNIQUE, description, schema_name, created_at)
prompt_versions(id, prompt_id, version, body, status [draft|published|archived],
                eval_pass_rate, created_by, created_at, published_at)
eval_fixtures(id, prompt_id, name, input_json, expected_shape, created_at)
eval_runs(id, prompt_version_id, fixture_id, output_raw, parsed_ok, latency_ms, ran_at)

-- flags & content
flags(id, key UNIQUE, type, default_value, status, updated_by, updated_at)
flag_overrides(id, flag_id, scope_json, value, updated_at)
content(id, key UNIQUE, body_json, status, updated_by, updated_at)

-- telemetry & ops
telemetry_events(id, device_id, event, props, app_version, platform, ts)
ai_calls(id, prompt_key, prompt_version, model, input_tokens, output_tokens,
         latency_ms, cache_hit, status, ts)
schema_failures(id, prompt_key, prompt_version, schema_name, raw_output,
                zod_error, ts)

-- support & ops
expo_push_tokens(id, token UNIQUE, platform, app_version, last_seen)
feedback(id, from_email, subject, body, status, assigned_to, received_at, gmail_msg_id UNIQUE)
admins(id, email UNIQUE, role, added_by, added_at, last_login)
audit_log(id, actor_email, action, target_type, target_id, before, after, ts)
```

All tables have `created_at`/`updated_at` where relevant. RLS policies: Worker uses the service role; admin frontend uses the anon role and **never** queries Supabase directly — it goes through `/v1/admin/*` Worker routes which enforce role checks. (This is the "Worker as single ingress" rule from §2.)

---

## 5. Repo & deploy layout

```
lifeos/
├── admin/                          # NEW Next.js 14 app
│   ├── app/
│   │   ├── (auth)/sign-in.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx          # role gate
│   │   │   ├── prompts/
│   │   │   ├── flags/
│   │   │   ├── content/
│   │   │   ├── telemetry/
│   │   │   ├── ai-ops/
│   │   │   ├── feedback/
│   │   │   ├── push/
│   │   │   └── audit/
│   │   └── api/                    # thin BFF — proxies to Worker /v1/admin/*
│   ├── lib/                        # shared types with Worker (zod)
│   ├── components/                 # shadcn/ui (desktop-first dashboard primitives)
│   └── package.json
├── workers/ai-proxy/               # EXISTING — extend, don't fork
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   ├── ai.ts               # existing
│       │   ├── telemetry.ts        # NEW
│       │   ├── config.ts           # NEW (public flag/prompt fetch)
│       │   └── admin/              # NEW (gated)
│       │       ├── prompts.ts
│       │       ├── flags.ts
│       │       ├── content.ts
│       │       ├── push.ts
│       │       └── feedback.ts
│       └── lib/
│           ├── auth.ts             # JWT + admins whitelist
│           ├── kv.ts
│           └── supabase.ts         # service-role client
├── supabase/
│   └── migrations/                 # NEW — sql files for tables above
└── src/                            # consumer app — minor edits
    ├── ai/client.ts                # add prompt fetch from KV (with bundled fallback)
    ├── store/useFlagStore.ts       # NEW — fetches /v1/config at startup
    └── utils/telemetry.ts          # NEW — gated by user opt-in
```

**Deploys:**
- Admin → Vercel (free tier comfortably covers this).
- Worker → Cloudflare (already wired).
- Supabase → existing project `izojsgzlaehodwlqwyvf` — add new migrations.

---

## 6. Phased build order

I'd ship this in 5 weekend-sized phases. Each phase is independently useful — you can stop after any of them and the portal still earns its keep.

### Phase 1 — Foundation (1 weekend)
- Add `admin/` Next.js scaffold with shadcn/ui + Supabase magic-link auth + role gate against `admins` table.
- Add `admins`, `audit_log`, `flags`, `flag_overrides` migrations.
- Worker: add `/v1/admin/*` route group with JWT + admin whitelist guard. Add `/v1/config` for flag fetch.
- Consumer app: add `useFlagStore` that fetches `/v1/config` at startup, caches 5min, exposes `isFlagEnabled()`.
- **First win:** flip `discovery_import_enabled` from the admin UI and watch the consumer app respect it on next refresh.

### Phase 2 — Prompts + AI Ops (1 weekend)
- `prompts`, `prompt_versions`, `eval_fixtures`, `eval_runs`, `ai_calls`, `schema_failures` migrations.
- Migrate one prompt as a pilot — `DISCOVERY_EXTRACTION_PROMPT` is the cleanest candidate (already isolated, has a mock for fixture seed). Consumer app fetches from KV with the bundled string as offline fallback.
- Admin: prompt list + edit + diff + publish.
- Worker: `/v1/ai/*` records `ai_calls` row per request.
- **First win:** edit the discovery prompt in admin, hit publish, see the next consumer extraction use the new prompt without a redeploy.

### Phase 3 — Telemetry (1 weekend)
- Privacy doc update + Profile sidebar telemetry toggle + `device_id` provisioning.
- `telemetry_events` migration + `/v1/telemetry` ingest endpoint with whitelist + schema validation.
- Consumer-side `track(event, props)` helper, gated.
- Admin: 2 dashboards — onboarding funnel + per-feature DAU.
- **First win:** see day-1 retention numbers for new users instead of guessing.

### Phase 4 — Eval runner + schema failure feed (1 weekend)
- Eval runner Worker job. Pass-rate gate on prompt publish.
- Schema-failure ingest from consumer app catch blocks + admin feed view.
- Add 5 fixtures per prompt as part of this phase.
- **First win:** can't publish a regression; can see exactly which AI outputs failed validation in the wild.

### Phase 5 — Feedback inbox + push broadcast (1 weekend)
- Gmail-pull cron (Worker scheduled trigger every hour).
- `feedback` triage UI.
- `expo_push_tokens` registration + admin push composer.
- **First win:** support flow stops being a personal inbox; can broadcast a release note to all v1.4 users.

---

## 7. Key files to write / modify

### New
- `admin/` (entire Next.js app — see §5)
- `workers/ai-proxy/src/routes/{telemetry,config,admin/*}.ts`
- `workers/ai-proxy/src/lib/{auth,supabase}.ts` (admin guard + service-role client)
- `supabase/migrations/0001_admin_init.sql` … `0005_feedback.sql`
- `src/store/useFlagStore.ts`
- `src/utils/telemetry.ts`

### Modify
- `src/ai/client.ts` — add prompt fetch + KV cache layer with bundled fallback
- `src/ai/functions.ts` — change prompt imports to go through the new client
- `src/components/shared/ProfileSidebar.tsx` — add Telemetry toggle row
- `app/terms-privacy.tsx` — add an "Anonymous usage stats (opt-in)" section
- `workers/ai-proxy/src/index.ts` — wire new routes
- `workers/ai-proxy/wrangler.toml` — add KV namespace `CONFIG`, env vars for Supabase service role

### Reuse
- Existing `workers/ai-proxy/src/auth.ts` (Supabase JWT verification — add admins whitelist on top)
- Existing Supabase client in `src/integrations/supabase/`
- Existing `RATE_LIMIT` KV — telemetry can share it for spam protection

---

## 8. Verification checklist (per phase)

Each phase ends green only when **all** of these pass:

1. `npm run typecheck` clean in `admin/`, `workers/ai-proxy/`, and consumer app.
2. New endpoints have at least one happy-path test in `workers/ai-proxy/test/`.
3. Manual run: log in to admin as the seeded owner email, exercise the new surface, watch the audit_log row appear.
4. Manual run: consumer app on web, observe the new behavior (flag flip, prompt change, telemetry event in dashboard).
5. RLS check: from a browser console, attempt to read the admin tables with the anon key — must return `[]` or `permission denied`. Worker is the only path.
6. Privacy: any new outbound traffic from consumer app is documented in `app/terms-privacy.tsx`.

---

## 9. Risks and how I'd handle them

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Admin compromise leaks prompts/flags | Low | Short-lived JWT, magic-link only, IP allowlist for `owner` role, audit log alarm on `flags.kill_switch` flips |
| Telemetry creep (someone adds PII to props) | Medium | Server-side whitelist of event names + props schema; reject + alert on unknown |
| Prompt regression ships through publish gate | Medium | Eval pass-rate must equal-or-exceed current; manual publish step (no auto-deploy from CI) |
| Worker cost spike from telemetry traffic | Low | Sample at 10% past 1k events/min/device-id, hard cap per device-id per day |
| Supabase row growth on `ai_calls` | Medium | Daily rollup job (Worker cron) into `ai_calls_daily`; truncate raw past 30d |
| Admin UI ships in consumer Expo bundle by accident | Low | `admin/` is a separate package; CI check that nothing under `admin/` is imported from `app/` or `src/` |

---

## 10. Out of scope for v1 (explicitly)

- **No user lookup / user data view.** Even if we added it via Supabase auth, the LifeOS data is local. Promising "view user X's plan" would require a sync backend, which is a separate (much larger) project.
- **No A/B experimentation framework.** Cohort flags are the manual primitive; full A/B with significance testing is v2+.
- **No custom analytics SQL editor.** Predefined dashboards only — keeps the surface small and the privacy story easy to audit.
- **No third-party error tracking** (Sentry, LogRocket). Built-in crash reporting only, to keep the no-third-party-trackers promise.
- **No revenue / billing surface.** No paid product yet.

---

## 11. First commit after approval

A single PR with three things:
1. `docs/ADMIN_PORTAL_PLAN.md` (this file).
2. `supabase/migrations/0001_admin_init.sql` — `admins`, `audit_log`, `flags`, `flag_overrides` only.
3. `admin/` scaffold — Next.js 14 + shadcn + Supabase auth + role gate, with one working page (`/admin/flags`) wired to a stub Worker route.

That's the smallest end-to-end vertical slice that proves the auth, the Worker route, and the deploy story all hold up. Everything else is repetition of that pattern.
