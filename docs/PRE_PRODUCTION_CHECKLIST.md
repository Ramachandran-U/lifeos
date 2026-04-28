# LifeOS — Pre-Production Checklist

Tech-debt and shortcuts taken during development that **must be resolved before public release** (App Store / Play Store / production Worker deploy). Grouped by severity. Update as items are closed.

Last updated: 2026-04-28

---

## 🔴 Blockers — must fix before any production build

### 1. Google OAuth `client_secret` shipped in mobile bundle
- **What**: Dev workaround sets `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` because the OAuth client in Google Cloud was created as **Web application** type. `EXPO_PUBLIC_*` vars are inlined into the JS bundle, so the secret is recoverable from any installed APK / IPA.
- **Why it matters**: A leaked client_secret lets anyone impersonate our app to Google's OAuth endpoints — phishing, quota theft, refresh-token abuse.
- **Fix**: Create separate **iOS** and **Android** OAuth clients in Google Cloud Console (these client types do *not* require a secret — they use bundle ID + SHA-1 fingerprint instead). Update `src/integrations/google/oauth.ts` to pick the right `client_id` per platform via `Platform.OS`. Remove `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` from `.env` and from `oauth.ts` body construction. Keep the Web client only for the admin portal / web build.
- **Owner**: TBD

### 2. Worker `ALLOWED_ORIGIN = "*"`
- **What**: `workers/ai-proxy/wrangler.toml` allows any origin to hit the proxy.
- **Why it matters**: Anyone can wire their own site to consume our AI quota using a stolen Supabase JWT.
- **Fix**: Restrict to `https://lifeos.app, https://admin.lifeos.app, https://<expo-web-domain>` (comma-split). Mobile builds don't send Origin so they're unaffected.

### 3. Worker KV namespace is a placeholder
- **What**: `wrangler.toml` has `id = "REPLACE_ME_AFTER_WRANGLER_KV_CREATE"`. Local dev uses `--local` simulated KV.
- **Why it matters**: Production deploy will fail or silently break rate limiting.
- **Fix**: `wrangler kv namespace create RATE_LIMIT` (and `RATE_LIMIT_PREVIEW` for staging), paste the IDs into `wrangler.toml`, redeploy.

### 4. RLS enabled with zero policies on `prompts` / `prompt_versions` / `flags` / `audit_log` / `admins`
- **What**: Tables have `ENABLE ROW LEVEL SECURITY` but no `CREATE POLICY` statements. Access works only because the Worker uses the service-role key, which bypasses RLS.
- **Why it matters**: If any client (consumer app, admin portal browser) ever connects with the anon key directly to these tables, it gets nothing — silent breakage. More dangerously, if someone *adds* a permissive policy later without realising the design, data leaks.
- **Fix**: Document this explicitly in `docs/SECURITY.md`. Add a deny-all comment to each table: `-- RLS: deny by default; access only via service-role through Worker.`

### 5. Admin password set via raw SQL (`crypt(..., gen_salt('bf'))`)
- **What**: First admin's password was set by directly updating `auth.users.encrypted_password`.
- **Why it matters**: No audit trail, no email verification, no MFA enrolment, password not rotatable through normal flows.
- **Fix**: Use Supabase Admin **Invite User** flow for all production admins. Force MFA via Supabase Auth settings. Remove the seeded admin row, re-invite properly.

---

## 🟠 High — fix before App Store submission

### 6. Wrangler 3 → 4 upgrade
- **What**: `package.json` pins Wrangler v3.
- **Why**: Cloudflare deprecation; v4 has the new observability + secrets flow we'll want.
- **Fix**: `npm i -D wrangler@4`, run smoke test, redeploy.

### 7. Admin portal lacks session refresh middleware
- **What**: `@supabase/ssr` cookie refresh not wired in `admin/middleware.ts`.
- **Why**: Admin gets random 401s after JWT expiry (~1h).
- **Fix**: Add Next.js middleware that calls `supabase.auth.getUser()` and refreshes cookies on every request — standard `@supabase/ssr` pattern.

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
