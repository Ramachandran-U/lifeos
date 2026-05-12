# LifeOS — Pre-Production Checklist

Tech-debt and shortcuts taken during development that **must be resolved before public release** (App Store / Play Store / production Worker deploy). Grouped by severity. Update as items are closed.

Last updated: 2026-04-28

---

## 🔴 Blockers — must fix before any production build

### 1. ~~Google OAuth `client_secret` shipped in mobile bundle~~ ✅ Resolved 2026-05-08
- **Original issue**: `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` was inlined into every platform bundle by Metro, so the secret was recoverable from any installed APK / IPA.
- **Resolution**: Token exchange now runs server-side via the Worker. New endpoint `POST /v1/google/token` (Bearer-auth'd, see `workers/ai-proxy/src/routes/googleToken.ts`) handles both `authorization_code` and `refresh_token` grants. The secret is held as a Wrangler secret (`GOOGLE_CLIENT_SECRET`) and never leaves the Worker. `src/integrations/google/oauth.ts` no longer references the secret. `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` removed from `.env.example`.
- **Operational follow-up before prod deploy**: `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET` against the production Worker. These must match the OAuth client the app uses (same `EXPO_PUBLIC_GOOGLE_CLIENT_ID`).
- **Future native OAuth**: When iOS/Android native flows are added (separate from this web-only driver), use Application-type OAuth clients (no secret) and switch by `Platform.OS`.

### 2. ~~Worker `ALLOWED_ORIGIN = "*"`~~ ✅ Resolved 2026-05-08
- **Original issue**: Worker accepted any Origin — anyone could mount a site to consume the AI quota with a stolen Supabase JWT.
- **Resolution**: Renamed `ALLOWED_ORIGIN` → `ALLOWED_ORIGINS` (comma-separated allowlist). `corsHeaders(req, env)` in [`workers/ai-proxy/src/index.ts`](../workers/ai-proxy/src/index.ts) now parses the list, matches the incoming `Origin`, echoes it back, and emits `Vary: Origin`. Unmatched origins get `null` (browsers block). Mobile/native requests don't send Origin and are unaffected. Seeded list in [`wrangler.toml`](../workers/ai-proxy/wrangler.toml) covers the prod web host, admin Vercel host, and local dev ports — update the admin host once the real Vercel URL is known.

### 3. ~~Worker KV namespace is a placeholder~~ ✅ Already resolved (checklist was stale)
- **State at audit**: `wrangler.toml` already had a real KV id (`8e46261c4c6948018ae072335c6a522a`). The placeholder reference in the original checklist was outdated.

### 4. ~~RLS enabled with zero policies~~ ✅ Documented 2026-05-08
- **Original issue**: Tables had `ENABLE ROW LEVEL SECURITY` with no policies — relied on Worker service-role bypass. Risk of silent leak if anyone later added a permissive policy without understanding the design.
- **Resolution**: Design is now documented in [`docs/SECURITY.md § 2`](SECURITY.md). The migration ([`supabase/migrations/0001_admin_init.sql`](../supabase/migrations/0001_admin_init.sql)) carries explicit `COMMENT ON TABLE` reminders on each admin table. SECURITY.md includes the verification command and the rule for adding new tables.
- **Residual**: One-time MFA enforcement (Auth Dashboard setting + `aal2` check in `adminAuth.ts`) is tracked in SECURITY.md § 4 as remaining debt.

### 5. ~~Admin password set via raw SQL~~ ✅ Documented + UI default flipped 2026-05-08
- **Original issue**: First admin's password was set by directly updating `auth.users.encrypted_password` — no audit trail, no email verification, no MFA, not rotatable.
- **Resolution**: Proper "Invite User" onboarding flow documented in [`docs/SECURITY.md § 3`](SECURITY.md). Migration seed comment updated to forbid raw-SQL passwords. Admin sign-in UI default flipped from `password` → `magic` in [`admin/app/sign-in/page.tsx`](../admin/app/sign-in/page.tsx); password mode still toggleable for incident-response edge cases.
- **Operational follow-up before prod**: Send a password reset to the seeded `ramachandran.u@vearc.com` row to rotate the raw-SQL-derived credential, and enrol MFA at first reset. Steps in SECURITY.md § 3.

---

## 🟠 High — fix before App Store submission

### 6. ~~Wrangler 3 → 4 upgrade~~ ✅ Resolved 2026-05-08
- **Resolution**: Bumped `wrangler` to `^4.0.0` in [`workers/ai-proxy/package.json`](../workers/ai-proxy/package.json) (resolved to 4.90.0). `npx tsc --noEmit` clean; `npx wrangler deploy --dry-run` succeeds with all bindings (RATE_LIMIT KV + env vars) picked up.
- **Operational follow-up**: User to run a real `wrangler deploy` after rotating the OAuth secrets (see blocker #1 follow-up) and reviewing the new `ALLOWED_ORIGINS` value.

### 7. ~~Admin portal lacks session refresh middleware~~ ✅ Resolved 2026-05-08
- **Original issue**: `@supabase/ssr` cookie refresh wasn't wired — admin pages 401'd at JWT expiry (~1h).
- **Resolution**: [`admin/middleware.ts`](../admin/middleware.ts) added. Calls `supabase.auth.getUser()` on every request through the standard `@supabase/ssr` `createServerClient` + `getAll`/`setAll` cookie hook pattern. Matcher excludes static assets.

### 8. Magic-link / password reset rate limits
- **What**: Hit Supabase's free 4-emails-per-hour ceiling during testing.
- **Why**: Real users will hit this on day one.
- **Fix**: Configure custom SMTP in Supabase (SendGrid / Resend / Postmark). Update sender domain DNS for SPF/DKIM/DMARC.

### 9. `usePromptStore` has no persistent cache
- **What**: Prompt fetch is in-memory only with 5min TTL — every cold start re-fetches.
- **Why**: Adds 200-500ms to first AI call after launch; fails closed (uses bundled fallback) if network slow.
- **Fix**: Wrap store in `zustand/middleware` `persist` with AsyncStorage. Same treatment as `useFlagStore`.

### 10. Chatbot has no per-feature rate limit
- **What**: Daily AI quota is global per user; chatbot can drain it.
- **Why**: User runs out of AI before the daily Routine Builder fires.
- **Fix**: Add `task: 'chatbot'` quota bucket in Worker (e.g. 30/day vs 100/day overall). Already plumbed — just needs counter logic.

---

## 🟡 Medium — fix in next iteration

### 11. Discovery Screen 3 (confirm + seed) unfinished
- **What**: `extractDiscoveryProfile` works, paste/confirm screens exist read-only. Editable confirm + seeding extracted data into SQLite tables (`goals`, `health_profile`, etc.) is deferred.
- **Fix**: Carry-over task — see plan `smooth-tumbling-lantern.md` for the intro screen pass; Screen 3 follows.

### 12. Audit log retention undefined
- **What**: `audit_log` grows unbounded.
- **Fix**: Pick a retention (90d? 1y?) and add a `pg_cron` job to delete past it. Consider archiving to R2/S3 first.

### 13. Phase 3+ admin features deferred
- Phase 3: telemetry dashboard (request count, p95, errors, cost per user)
- Phase 4: prompt eval runner (golden-set regression test before Activate)
- Phase 5: feedback inbox + push broadcast

### 14. Mock mode (`USE_AI_MOCK`) not wired into all AI paths
- **What**: `extractDiscoveryProfile` checks the flag; chatbot and other functions don't.
- **Fix**: Audit `src/ai/functions.ts` — every `callAI` call should have a mock branch.

### 15. No automated E2E tests
- **What**: All onboarding / chat / admin flows verified manually.
- **Fix**: Add Playwright suite for admin portal, Maestro for mobile happy-paths.

---

## 🟢 Low — nice to have

- Sentry / error monitoring on consumer app + Worker + admin
- Crashlytics for native crashes
- Bundle size analysis — strip unused Expo modules
- Light mode theme tokens (currently dark-only)
- App Store screenshots, listing copy, privacy policy URL, support URL
- Privacy nutrition labels (App Store) + Data Safety form (Play Store) — be precise about on-device-only fields
- HealthKit / Health Connect entitlements + usage descriptions in `app.json`

---

## Operational notes

- **Branch**: `claude/interesting-rubin-97ecf6` — uncommitted work as of session end (admin Phase 2 prompt registry, consumer prompt fetch, chatbot v1, Google web sign-in).
- **Worker dev**: `cd workers/ai-proxy && npx wrangler dev` (uses `.dev.vars` — gitignored).
- **Admin dev**: `cd admin && npm run dev` — must seed admin row in Supabase before sign-in works.
- **Bundled prompt fallbacks** live in `src/ai/prompts/*.ts` and ship in the app bundle. The Worker `/v1/prompts` endpoint returns *active* versions which override these at runtime when reachable.
