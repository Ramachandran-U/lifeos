# LifeOS — Manual Ops To-Do

> Running list of operational actions the human must do — things Claude can't do from the keyboard (rotating secrets in dashboards, deploying, setting MFA, etc.). Tick off as completed. Add new items here whenever a code change requires a follow-up in a dashboard or CLI.

Last updated: 2026-05-08

---

## 🔴 Blocking — before next prod deploy

### Worker — secrets + deploy
- [ ] **Set `GOOGLE_CLIENT_ID` Worker secret.** Same value as `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in app `.env`.
  ```powershell
  cd workers/ai-proxy
  npx wrangler secret put GOOGLE_CLIENT_ID
  ```
- [ ] **Set `GOOGLE_CLIENT_SECRET` Worker secret.** The value previously held in `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET`.
  ```powershell
  npx wrangler secret put GOOGLE_CLIENT_SECRET
  ```
- [x] ~~Replace the placeholder admin Vercel host in `wrangler.toml`~~ — done 2026-05-08. Real URL: `https://project-yom9m.vercel.app`.
- [ ] **Deploy the Worker.**
  ```powershell
  cd workers/ai-proxy ; npx wrangler deploy
  ```
- [ ] **Remove `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` from local `.env`** and from any EAS / Cloudflare Pages env config — it is no longer used and shouldn't be in the bundle.
- [ ] **Redeploy the web build** so the new `oauth.ts` (Worker token-exchange path) ships to users.

### Admin auth hygiene
- [ ] **Rotate the seeded admin password.** Supabase Dashboard → Authentication → Users → `ramachandran.u@vearc.com` → **Send password reset**. Use the link to set a fresh password. This replaces the raw-SQL bootstrap password.
- [ ] **Enrol MFA on the owner admin.** At first sign-in after the password reset, follow the Supabase TOTP enrolment prompt. Save backup codes somewhere secure.
- [ ] **Enable Multi-Factor Auth in Supabase Auth settings.** Supabase Dashboard → Authentication → Providers → enable MFA. (Org-wide enforcement still pending the `aal2` JWT check in `workers/ai-proxy/src/lib/adminAuth.ts` — tracked separately.)

### Admin portal Vercel setup
- [x] ~~Deploy admin to Vercel~~ — live at `https://project-yom9m.vercel.app`.
- [x] ~~Paste production URL into `wrangler.toml` `ALLOWED_ORIGINS`~~ — done.
- [ ] **Redeploy the Worker** so the new `ALLOWED_ORIGINS` value takes effect. `cd workers/ai-proxy ; npx wrangler deploy`.
- [ ] **Add admin URL to Supabase Redirect URLs** — Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → add:
  - `https://project-yom9m.vercel.app/auth/callback`
  - `https://project-yom9m.vercel.app/**`
- [x] ~~Sanity-check end-to-end~~ — done 2026-05-08. Flags + Prompts load. Surprise gotcha worth remembering: the Worker secret `SUPABASE_SERVICE_ROLE_KEY` had been set to the publishable/anon key by mistake (the two look superficially similar in Supabase Dashboard — the right one is labeled `secret` / `sb_secret_*` and is the only one that bypasses RLS). Symptom was a clean `403 {"error":"admin: not authorized"}` from every `/v1/admin/*` call, because PostgREST returned `[]` from the admins lookup. Fix: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` with the correct key.
- [ ] **Future:** if you set a custom domain on Vercel (e.g. `admin.lifeos.app`), update both the Worker `ALLOWED_ORIGINS` and the Supabase Redirect URLs again.

---

## 🔴 To activate the latest commits (`9fa52c0`)

These changes are pushed to git but need three manual actions to be live:

- [ ] **Run Phase 3 telemetry migration.** Supabase Dashboard → SQL Editor → paste contents of [`supabase/migrations/0003_telemetry.sql`](../supabase/migrations/0003_telemetry.sql) → Run. Creates the `telemetry_events` table with indexes and RLS lockdown.
- [ ] **Redeploy the Worker.** Picks up:
  - new `POST /v1/telemetry` anonymous ingest
  - new `GET /v1/admin/telemetry/{funnel,recent}` routes
  - chatbot rate-limit bucket (`DAILY_CHATBOT_LIMIT=30`)
  - the finance categorizer changes are client-side; this redeploy isn't needed for those but doesn't hurt
  ```powershell
  cd "c:\personal\Project X\lifeos\.claude\worktrees\interesting-rubin-97ecf6\workers\ai-proxy"
  npx wrangler deploy
  ```
- [ ] **Wait for Vercel auto-deploy** of the admin (or trigger manually in the Vercel dashboard). The new Telemetry tab will appear in the sidebar.
- [ ] **Smoke-test end-to-end:** open the consumer app, Settings → Privacy → toggle "Share anonymous usage stats" ON. Then complete a routine block / create a goal. Within ~10s, check the admin Telemetry tab — your events should appear under "Recent events".

## 🟠 Soon — before App Store submission

These map to the 🟠 High tier in [PRE_PRODUCTION_CHECKLIST.md](PRE_PRODUCTION_CHECKLIST.md).

- [ ] **#8 Configure custom SMTP in Supabase.** Free-tier email is 4/hour. SendGrid / Resend / Postmark + SPF/DKIM/DMARC DNS on sender domain.
- [ ] **`aal2` MFA check in Worker.** Update `workers/ai-proxy/src/lib/adminAuth.ts` to reject JWTs with `aal < aal2` for `/v1/admin/*` once all admins have MFA enrolled.

---

## 🟡 Nice — when there's a moment

- [ ] **Decide `audit_log` retention** (90d? 1y?) and add a `pg_cron` job to delete past it. Consider archiving to R2/S3 first. ([PRE_PRODUCTION_CHECKLIST #12](PRE_PRODUCTION_CHECKLIST.md))
- [ ] **Daily rollup for `ai_calls`** once Phase 3 telemetry lands.
- [ ] **Sentry / Crashlytics**, but only if the no-third-party-trackers policy can be relaxed (see [SECURITY.md](SECURITY.md)).

---

## Done log (so we remember what we already cleared)

- 2026-05-08 — Closed checklist blockers #1, #2, #3, #4, #5, #6, #7 in code. Created `docs/SECURITY.md`, `admin/middleware.ts`, Worker `/v1/google/token` route, multi-origin CORS, Wrangler 4.90.0. Manual follow-ups for those moved into the lists above.
- 2026-04-28 — Original checklist drafted.
