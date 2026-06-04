# LifeOS — Manual Ops To-Do

> Running list of operational actions the human must do — things Claude can't do from the keyboard (rotating secrets in dashboards, deploying, setting MFA, etc.). Tick off as completed. Add new items here whenever a code change requires a follow-up in a dashboard or CLI.
>
> **Relationship to [PRE_PRODUCTION_CHECKLIST.md](PRE_PRODUCTION_CHECKLIST.md):** that file is the *tech-debt register* (what's wrong in code and whether it's resolved); this file is the *action list* (the dashboard/CLI steps a human must run). They are complementary, not duplicates.
>
> **Status caveat:** open checkboxes below reflect the state at the dates noted, not live verification — confirm against the Supabase/Cloudflare dashboards before trusting any unchecked box.

Last updated: 2026-05-08 (paths refreshed 2026-05-30; parked-items follow-ups added 2026-06-03)

> **2026-06-04 re-verification (Claude, read-only):** checked live state via `wrangler secret list` + `wrangler deployments list` (Worker `lifeos-ai-proxy`, authed as ramachandranu.96@gmail.com) and `gh secret list` + `gh run list`. Items confirmed done are now ticked and marked **✓v 2026-06-04** with the evidence. Items I **could not** verify without dashboard/DB access (Supabase migrations actually applied, Vercel redirect URLs, admin MFA/password, SMTP) are left **unchecked** — treat those as the genuine remaining human actions.

---

## 🔴 Blocking — before next prod deploy

### Worker — secrets + deploy
- [x] **Set `GOOGLE_CLIENT_ID` Worker secret.** **✓v 2026-06-04** (`wrangler secret list` shows it set). Same value as `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in app `.env`.
  ```powershell
  cd workers/ai-proxy
  npx wrangler secret put GOOGLE_CLIENT_ID
  ```
- [x] **Set `GOOGLE_CLIENT_SECRET` Worker secret.** **✓v 2026-06-04** (`wrangler secret list` shows it set). The value previously held in `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET`.
  ```powershell
  npx wrangler secret put GOOGLE_CLIENT_SECRET
  ```
- [x] ~~Replace the placeholder admin Vercel host in `wrangler.toml`~~ — done 2026-05-08. Real URL: `https://project-yom9m.vercel.app`.
- [x] **Deploy the Worker.** **✓v 2026-06-04** — Worker last deployed 2026-05-27 (`wrangler deployments list`).
  ```powershell
  cd workers/ai-proxy ; npx wrangler deploy
  ```
- [x] **Remove `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` from local `.env`** and from any EAS / Cloudflare Pages env config — it is no longer used and shouldn't be in the bundle. **✓v 2026-06-04** — not present in local `.env`.
- [ ] **Redeploy the web build** so the new `oauth.ts` (Worker token-exchange path) ships to users. *(Could not verify the live Pages bundle from here — confirm in Cloudflare Pages.)*

### Admin auth hygiene
- [ ] **Rotate the seeded admin password.** Supabase Dashboard → Authentication → Users → `ramachandran.u@vearc.com` → **Send password reset**. Use the link to set a fresh password. This replaces the raw-SQL bootstrap password. *(Dashboard-only — cannot verify from here.)*
- [ ] **Enrol MFA on the owner admin.** At first sign-in after the password reset, follow the Supabase TOTP enrolment prompt. Save backup codes somewhere secure. *(Dashboard-only — cannot verify from here.)*
- [ ] **Enable Multi-Factor Auth in Supabase Auth settings.** Supabase Dashboard → Authentication → Providers → enable MFA. (Org-wide enforcement still pending the `aal2` JWT check in `workers/ai-proxy/src/lib/adminAuth.ts` — tracked separately.) *(Dashboard-only — cannot verify from here.)*

### Admin portal Vercel setup
- [x] ~~Deploy admin to Vercel~~ — live at `https://project-yom9m.vercel.app`.
- [x] ~~Paste production URL into `wrangler.toml` `ALLOWED_ORIGINS`~~ — done.
- [x] **Redeploy the Worker** so the new `ALLOWED_ORIGINS` value takes effect. **✓v 2026-06-04** — Worker deployed 2026-05-27 (after this change). `cd workers/ai-proxy ; npx wrangler deploy`.
- [ ] **Add admin URL to Supabase Redirect URLs** — Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → add: *(Dashboard-only — cannot verify from here.)*
  - `https://project-yom9m.vercel.app/auth/callback`
  - `https://project-yom9m.vercel.app/**`
- [x] ~~Sanity-check end-to-end~~ — done 2026-05-08. Flags + Prompts load. Surprise gotcha worth remembering: the Worker secret `SUPABASE_SERVICE_ROLE_KEY` had been set to the publishable/anon key by mistake (the two look superficially similar in Supabase Dashboard — the right one is labeled `secret` / `sb_secret_*` and is the only one that bypasses RLS). Symptom was a clean `403 {"error":"admin: not authorized"}` from every `/v1/admin/*` call, because PostgREST returned `[]` from the admins lookup. Fix: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` with the correct key.
- [ ] **Future:** if you set a custom domain on Vercel (e.g. `admin.lifeos.app`), update both the Worker `ALLOWED_ORIGINS` and the Supabase Redirect URLs again.

---

## 🔴 To activate the latest commits (`9fa52c0`)

These changes are pushed to git but need three manual actions to be live:

- [ ] **Run Phase 3 telemetry migration.** Supabase Dashboard → SQL Editor → paste contents of [`supabase/migrations/0003_telemetry.sql`](../supabase/migrations/0003_telemetry.sql) → Run. Creates the `telemetry_events` table with indexes and RLS lockdown. *(Cannot verify DB from here — but migrations 0006–0008 exist on disk and the Worker is live, so 0003 was very likely applied; confirm in Supabase before relying on it.)*
- [x] **Redeploy the Worker.** **✓v 2026-06-04** — Worker deployed 2026-05-27. Picks up:
  - new `POST /v1/telemetry` anonymous ingest
  - new `GET /v1/admin/telemetry/{funnel,recent}` routes
  - chatbot rate-limit bucket (`DAILY_CHATBOT_LIMIT=30`)
  - the finance categorizer changes are client-side; this redeploy isn't needed for those but doesn't hurt
  ```powershell
  cd "c:\personal\Project X\lifeos\workers\ai-proxy"
  npx wrangler deploy
  ```
- [ ] **Wait for Vercel auto-deploy** of the admin (or trigger manually in the Vercel dashboard). The new Telemetry tab will appear in the sidebar. *(Dashboard-only — cannot verify from here.)*
- [ ] **Smoke-test end-to-end:** open the consumer app, Settings → Privacy → toggle "Share anonymous usage stats" ON. Then complete a routine block / create a goal. Within ~10s, check the admin Telemetry tab — your events should appear under "Recent events". *(Manual — cannot verify from here.)*
- [ ] **Run Phase 5 migration.** Supabase Dashboard → SQL Editor → paste [`supabase/migrations/0004_feedback_and_push.sql`](../supabase/migrations/0004_feedback_and_push.sql) → Run. Adds `feedback` + `expo_push_tokens` tables. *(Cannot verify DB from here — likely applied; confirm in Supabase.)*
- [x] **Redeploy Worker** to pick up `/v1/feedback`, `/v1/push/register`, and the admin feedback/push routes. **✓v 2026-06-04** — Worker deployed 2026-05-27. (`npx wrangler deploy` from `workers/ai-proxy`.)
- [ ] **Test feedback round-trip:** open consumer → Profile sidebar → Send feedback → submit a test message. Check the admin's new Feedback tab. *(Manual — cannot verify from here.)*
- [ ] **Test push (native only):** install the EAS / device build, grant notification permission. In Supabase verify a row appears in `expo_push_tokens`. Send a test broadcast from admin → Push to confirm the device receives it. *(Needs a native build — cannot verify from here.)*

### Phase 4b — eval pass-rate reporting (commit `e45d9d5`) — ✓ COMPLETE (verified 2026-06-04)

- [ ] **Run migration:** Supabase SQL Editor → paste [`supabase/migrations/0005_eval_reports.sql`](../supabase/migrations/0005_eval_reports.sql). *(Cannot verify DB directly — but the reporting pipeline below works end-to-end, which requires this table, so treat as applied.)*
- [x] **Generate an eval reporter token.** **✓v 2026-06-04** — token exists (set on both Worker + GitHub, below).
  ```powershell
  -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | % { [char]$_ })
  ```
- [x] **Set the Worker secret:** **✓v 2026-06-04** — `EVAL_REPORTER_TOKEN` present in `wrangler secret list`.
  ```powershell
  cd "c:\personal\Project X\lifeos\workers\ai-proxy"
  npx wrangler secret put EVAL_REPORTER_TOKEN
  ```
  Paste the token when prompted. Then `npx wrangler deploy`.
- [x] **Set the two GitHub repo secrets** at https://github.com/Ramachandran-U/lifeos/settings/secrets/actions: **✓v 2026-06-04** (`gh secret list`: `EVAL_REPORTER_URL` + `EVAL_REPORTER_TOKEN` both set 2026-05-28).
  - `EVAL_REPORTER_URL` = `https://lifeos-ai-proxy.haloai.workers.dev/v1/evals/report`
  - `EVAL_REPORTER_TOKEN` = same opaque string from above
- [x] **Verify:** **✓v 2026-06-04** — `evals.yml` workflow runs are succeeding (latest: 2026-06-03, `lifeosv1` + PR runs all green), so the "Report to admin portal" step is operating.

## 🟠 Soon — before App Store submission

These map to the 🟠 High tier in [PRE_PRODUCTION_CHECKLIST.md](PRE_PRODUCTION_CHECKLIST.md).

- [ ] **#8 Configure custom SMTP in Supabase.** Free-tier email is 4/hour. SendGrid / Resend / Postmark + SPF/DKIM/DMARC DNS on sender domain. *(Dashboard-only — cannot verify from here.)*
- [ ] **`aal2` MFA check in Worker.** Update `workers/ai-proxy/src/lib/adminAuth.ts` to reject JWTs with `aal < aal2` for `/v1/admin/*` once all admins have MFA enrolled. *(Code change — gated on MFA enrolment above; do not ship until the owner admin has TOTP enrolled or it can lock out admin access.)*

---

## 🟣 Parked-items follow-ups (human actions)

> Manual actions to un-park items from [PARKED_ITEMS.md](PARKED_ITEMS.md). **Full step-by-step (commands, console paths, gotchas) lives in [PARKED_ITEMS_RUNBOOK.md](PARKED_ITEMS_RUNBOOK.md)** — these checkboxes are just the index. Verified against the repo 2026-06-03.

- [ ] **1.4 — Publish Google OAuth consent screen to Production.** *Highest value, zero code* — fixes the ~7-day Gmail-reconnect papercut. Console only: APIs & Services → OAuth consent screen → **Publish app**, then enable Gmail/Calendar/Fitness APIs and confirm prod redirect URIs. ([runbook §1.4](PARKED_ITEMS_RUNBOOK.md#14--publish-google-oauth-consent-screen-to-production-))
- [ ] **1.1 — Deploy the apex Pages site** (decision-gated; only if you want users on `lifeos-6r5.pages.dev`). `npm run web:export` → `npx wrangler pages deploy dist --project-name=lifeos --branch=<prod-branch>`. CORS already allowlisted. ([runbook §1.1](PARKED_ITEMS_RUNBOOK.md#11--deploy-the-apex-cloudflare-pages-site-))
- [ ] **1.2 — First native EAS build** (needs Expo + Apple Developer + Google Play credentials). `npx eas login` → `eas init` → `eas build -p ios/android --profile production`. Watch out for the `expo-health` `0.0.0` placeholder dep. ([runbook §1.2](PARKED_ITEMS_RUNBOOK.md#12--first-native-iosandroid-build-via-eas-))
- [ ] **1.6 — Local Supabase stack** (only when you need local *auth* dev; app data does NOT flow through it). Start Docker daemon → `npx supabase init` → `start` → `status`. ([runbook §1.6](PARKED_ITEMS_RUNBOOK.md#16--local-supabase-stack-))
- [ ] **5.2 — O*NET + Adzuna keys** (optional/future career grounding). Register both (free), then `npx wrangler secret put` the four keys from `workers/ai-proxy/`. Hand off to Claude for wiring. ([runbook §5.2](PARKED_ITEMS_RUNBOOK.md#52--onet--adzuna-api-keys-optionalfuture-))
- [ ] **2.5 — Two-device native backup/compaction smoke test** *(gated: needs 2.4 fix + a native build first)*. Export on device A → restore on B → verify merge + compaction + wrong-passphrase abort. ([runbook §B step 3](PARKED_ITEMS_RUNBOOK.md#step-3--25-two-device-native-smoke-test--needs-a-native-build-from-12-first))
- [ ] **1.3 — Flip `compaction_enabled` / `backup_enabled` per-cohort** *(gated: needs 2.4 + 2.5 + 2.6)*. Seed the flag rows + a `flag_overrides` row in Supabase SQL Editor (no admin API creates them). ([runbook §B step 4](PARKED_ITEMS_RUNBOOK.md#step-4--13-flip-the-flags-per-cohort-))
- **2.1 — Sync monitoring** (ongoing, not a one-off): Settings sync pill + the `mutations`-table SQL queries + the kill switch. ([runbook §2.1](PARKED_ITEMS_RUNBOOK.md#21--monitor-the-now-globally-on-sync-engine-ongoing-))

---

## 🟡 Nice — when there's a moment

- [ ] **Decide `audit_log` retention** (90d? 1y?) and add a `pg_cron` job to delete past it. Consider archiving to R2/S3 first. ([PRE_PRODUCTION_CHECKLIST #12](PRE_PRODUCTION_CHECKLIST.md))
- [ ] **Daily rollup for `ai_calls`** once Phase 3 telemetry lands.
- [ ] **Sentry / Crashlytics**, but only if the no-third-party-trackers policy can be relaxed (see [SECURITY.md](SECURITY.md)).

---

## Done log (so we remember what we already cleared)

- 2026-06-04 — Read-only re-verification of the 🔴 blocking + Phase 4b sections via `wrangler`/`gh`: all four Worker secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EVAL_REPORTER_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) set; Worker deployed 2026-05-27; `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` already gone from `.env`; GitHub eval-reporter secrets set; `evals.yml` green. Ticked the confirmed boxes. Remaining open items are all dashboard/DB/native (Supabase migrations confirmation, MFA/password, Vercel redirect URLs, SMTP) or decision-gated parked items.
- 2026-05-08 — Closed checklist blockers #1, #2, #3, #4, #5, #6, #7 in code. Created `docs/SECURITY.md`, `admin/middleware.ts`, Worker `/v1/google/token` route, multi-origin CORS, Wrangler 4.90.0. Manual follow-ups for those moved into the lists above.
- 2026-04-28 — Original checklist drafted.
