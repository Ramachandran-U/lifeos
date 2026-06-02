# Parked-Items Runbook — step-by-step

> Concrete, grounded instructions for actioning each item in [`PARKED_ITEMS.md`](PARKED_ITEMS.md). Every command/path/flag/route below was verified against the repo (and adversarially re-checked) on **2026-06-03** — but the codebase moves; re-confirm before executing.
>
> **Relationship to the other docs:** [`PARKED_ITEMS.md`](PARKED_ITEMS.md) is *what's parked and why*; this file is *how to un-park it*; [`MANUAL_OPS_TODO.md`](MANUAL_OPS_TODO.md) is the human-action checklist (the §A/§B-manual items here are mirrored there as checkboxes); [`PRE_PRODUCTION_CHECKLIST.md`](PRE_PRODUCTION_CHECKLIST.md) is the tech-debt register.
>
> Legend: 🧑 **you only** · 🧑→🤖 **you decide/act, then Claude codes** · 🤖 **Claude's code, you just approve**.

---

## A. Independent items — do any time

### 1.4 — Publish Google OAuth consent screen to Production 🧑
**Highest-value, zero-code.** Fixes the "reconnect Gmail every few days" papercut — Testing mode expires refresh tokens after ~7 days. Pure Google Cloud Console.

1. [console.cloud.google.com](https://console.cloud.google.com) → project picker → select the project whose OAuth client matches `.env` `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (find it under **APIs & Services → Credentials → OAuth 2.0 Client IDs**).
2. **APIs & Services → OAuth consent screen** (newer console: under "Audience"). Status reads **Testing**.
3. Open **Scopes / Data access** and confirm the app's real scopes (verified in code): `openid email profile`, `calendar.events`, seven `fitness.*.read` scopes, `gmail.readonly`. **`gmail.readonly` is *restricted*** (heaviest verification); fitness scopes are *sensitive*.
4. Click **PUBLISH APP** → confirm. Status → **In production**.
5. If a verification banner appears (it will, due to `gmail.readonly` + fitness): supply homepage URL, a verified **Authorized domain** you own, privacy-policy URL, app logo, submit. Restricted scope ⇒ CASA security assessment + demo video (days–weeks).
6. **Enable the underlying APIs** — **APIs & Services → Enabled APIs & services** must list **Gmail API, Google Calendar API, Fitness API**. A published consent screen still 403s if the API itself is off.
7. Confirm production-origin redirect URIs on the client (**Credentials → client → Authorized redirect URIs**): `https://<prod-origin>/google-auth-callback`, `/calendar-callback`, `/fit-callback`, `/gmail-callback`.

**Done when:** status reads "In production"; a fresh Google account connects without the "approved test users" block; Gmail still silently refreshes 8+ days later.
**Gotchas:** *In production ≠ Verified* — while unverified you're capped at **100 users** and everyone sees the "Google hasn't verified this app" screen. If prod doesn't need Gmail finance import, **dropping `gmail.readonly`** removes the entire CASA burden. Don't rotate the client secret without re-running `npx wrangler secret put GOOGLE_CLIENT_SECRET` on the Worker; the bundled `EXPO_PUBLIC_GOOGLE_CLIENT_ID` must point at the same client (it's inlined at build time → rebuild if wrong).

---

### 1.1 — Deploy the apex Cloudflare Pages site 🧑→🤖
**Decision first:** the repo treats `lifeos-6r5-eqa.pages.dev` (project `lifeos-6r5`) as de-facto prod. Only deploy the apex `lifeos-6r5.pages.dev` (project named **`lifeos`** — inverted naming is the main foot-gun) if you want users there. `npm run deploy` targets the *other* project, so deploy the apex manually. Run all from repo root `c:\personal\Project X\lifeos`:

1. Check the apex project's production branch (deploys hit prod only if `--branch` matches it):
   ```
   npx wrangler pages deployment list --project-name=lifeos --environment production
   ```
   PARKED note: its last prod deploy used branch `claude/interesting-rubin-97ecf6` — whatever shows here is what `--branch` must match.
2. *(Optional)* set prod branch to `lifeos`: dashboard → **Workers & Pages → `lifeos` → Settings → Builds & deployments → Production branch** (wrangler 4.x can't set this from CLI).
3. Build (`public/` must exist — it does):
   ```
   npm run web:export
   ```
   Success prints `post-export-web: dist ready for Cloudflare Pages`. A Windows EPERM warning on the font rename is non-fatal.
4. Deploy to the apex project (match the branch from step 1):
   ```
   npx wrangler pages deploy dist --project-name=lifeos --branch=lifeos --commit-dirty=true
   ```
   Wrong branch → silently lands as a preview URL, not the apex.
5. **CORS already fine — no Worker redeploy.** `https://lifeos-6r5.pages.dev` is the first entry in `ALLOWED_ORIGINS` (`workers/ai-proxy/wrangler.toml:38`).
6. Verify: re-run the `deployment list` (fresh row under production); open `https://lifeos-6r5.pages.dev`; SPA loads, fonts render, an AI action succeeds with no CORS error.

**Gotcha:** the "~1 month stale" PARKED note is unreliable (the apex was deployed to recently); step 3 rebuilds from current source regardless.

---

### 1.2 — First native iOS/Android build via EAS 🧑
The scaffold (`eas.json`, `app.json` `buildNumber`/`versionCode`/`runtimeVersion`) is **already on `lifeosv1`** (the "separate branch" note is stale). No `eas build` has run yet. From repo root:

1. Confirm CLI (pinned `eas-cli ^20`): `npx eas --version`
2. `npx eas login` → `npx eas whoami`
3. Link the project (creates `projectId` on your account): `npx eas init`, then **commit app.json** (`git add app.json && git commit`).
4. **iOS credentials:** easiest is to let EAS manage signing during the build (prompts for Apple ID). Pre-stage with `npx eas credentials -p ios`. *You supply:* Apple ID + 2FA, **Apple Team ID** (10-char, developer.apple.com → Membership). Bundle id `com.lifeos.app` is fixed — don't change it.
5. **Android credentials:** for `eas build` alone, accept EAS's offer to generate + store an upload keystore (**back it up**). For *submission* you need a Google Play service-account JSON (Cloud Console → IAM → Service Accounts → JSON key; invite that email in Play Console with release perms). Keep JSON **outside the repo**.
6. Build: `npx eas build -p ios --profile production` and `npx eas build -p android --profile production`. iOS builds on EAS's hosted Macs (no local Xcode), but the paid Apple Developer membership ($99/yr) is required first.
7. *(Optional install)* `npx eas build -p android --profile preview` → installable APK.
8. *(Optional submit)* `npx eas submit -p android --profile production` (asks for the service-account JSON path).

**Gotchas:** `expo-health` is pinned to a `0.0.0` placeholder — if the build fails resolving it, that dep needs a real version or removal first. Production-profile builds bundle your `EXPO_PUBLIC_*` values — confirm prod env first. (Note: the earlier "exercises T10 native schema fixes" rationale was wrong — T10 is a not-started *schema-drift CI guard*, not on-device code.)

---

### 1.6 — Local Supabase stack 🧑
⚠️ **Read first:** the app only calls `supabase.auth.*` — **zero** `supabase.from()/.storage/.rpc`. App data sync goes through the **Worker** (`/v1/sync/push|pull`) to a *hosted* Supabase. So pointing `EXPO_PUBLIC_SUPABASE_URL` at the local stack **only redirects auth** — goals/routine/sync data will NOT appear in your local DB. Do this only for local *auth* dev (or also run the Worker locally — step 7). From repo root:

1. `docker version` (install Docker Desktop if missing).
2. Start the Docker **daemon** (Docker Desktop → "Engine running"). Verify: `docker info` returns a Server section. *"Could not connect to local Supabase project" = daemon not up.*
3. `npx supabase init` (required — no `config.toml` exists yet).
4. `npx supabase start` (pulls multi-GB images first run).
5. `npx supabase status` → API URL `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, anon + service_role keys.
6. Point the app's `.env`: `EXPO_PUBLIC_SUPABASE_URL` = **API URL** (not DB URL); `EXPO_PUBLIC_SUPABASE_ANON_KEY` = **anon** key (never service_role). On a real device, use your LAN IP, not `127.0.0.1`.
7. *(Only for local sync)* run the Worker locally (`wrangler dev` in `workers/ai-proxy`, pointed at local Supabase) and set `EXPO_PUBLIC_AI_PROXY_URL` to it.
8. Restart Expo: `npx expo start --clear`
9. Stop: `npx supabase stop` (check `npx supabase stop --help` for the current backup flag — it drifted across versions).

**Done when:** `docker info` succeeds, `npx supabase status` lists services, Studio opens, a **new sign-up** appears in local Studio `auth.users`.
**Gotcha:** local auth may need email confirmation — set `[auth.email] enable_confirmations=false` in `config.toml`, or grab the link from the local Inbucket/Mailpit URL.

---

### 2.1 — Monitor the now-globally-on sync engine (ongoing) 🧑
**In-app:**
1. Settings → **Sync** card (`<SyncStatus/>`, Settings screen only — no Today-tab pill).
2. Dot meaning: **green "Synced · just now/Xs ago"** = healthy; **violet "Syncing…"** = transient; **grey "Sync off"** = disabled/killed; **grey "Sign in to sync"** = no session; **green but "ago" keeps climbing and never resets** = round-trips failing silently (engine swallows all errors — the only visible tell).
3. Force a round-trip: make a small change, then background→foreground (native) / switch tab away+back (web); or wait ≤60s (periodic drain).

**Server (Supabase dashboard — `mutations` is RLS deny-by-default; use SQL Editor, not Table Editor):**
4. Dashboard → project `izojsgzlaehodwlqwyvf` → **SQL Editor → New query**.
5. Growth/volume:
   ```sql
   select count(*) total_rows, count(distinct user_id) users, count(distinct device_id) devices,
          max(created_at) latest, count(*) filter (where created_at > now() - interval '1 hour') last_1h
   from mutations;
   ```
   Expect high volume (gamification logs a mutation per XP action). A 10× jump in `last_1h` → investigate a possible push loop.
6. Convergence per user:
   ```sql
   select user_id, count(*) rows, count(distinct device_id) devices, max(created_at) last_push
   from mutations group by user_id order by last_push desc limit 50;
   ```
   The pull cursor is the server **`seq`** (gap-free bigserial), *not* `lamport` (lamport is conflict-ordering only). Convergence = each active device keeps appearing in recent pushes + its own pill says "just now."

**Kill switch (no redeploy):**
7. Pre-check the flag row exists (else PATCH 404s / UPDATE hits 0 rows):
   ```sql
   select key, status from flags where key = 'sync_engine_enabled';
   ```
8. Preferred: **Admin portal → Feature flags → `sync_engine_enabled` → "Kill"** (one button that becomes "Restore"; distinct from "Toggle"). Needs owner/editor role.
9. CLI fallback:
   ```
   curl -X PATCH "<WORKER_URL>/v1/admin/flags/sync_engine_enabled" \
     -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
     -d '{"status":"killed"}'
   ```
   `<WORKER_URL>` = your `EXPO_PUBLIC_AI_PROXY_URL`. Restore with `{"status":"active"}`.
10. Clients pick it up within ~5 min (or instantly on cold launch).

⚠️ **Kill caveat:** `status='killed'` beats `default_value=true`, **but a scope-matching `flag_override` row still wins** (override loop runs after the kill loop). Remove any override too. Killing sync leaves the local log growing; backlog replays safely (idempotent) on restore.

---

### 5.2 — O*NET + Adzuna API keys (optional/future) 🧑→🤖
Only if you want the career engine grounded in real occupation/job data. **Your part = keys + Worker secrets; the wiring is Claude's.**

1. Ensure Worker deps installed: `npm ci` in `workers/ai-proxy` (so local `wrangler` exists), or use `npx wrangler`.
2. Register O*NET Web Services (free): [services.onetcenter.org/developer/signup](https://services.onetcenter.org/developer/signup). **O*NET uses HTTP Basic auth — username + password, not a token.**
3. Register Adzuna (free): [developer.adzuna.com](https://developer.adzuna.com/) → dashboard gives **app_id** + **app_key** (covers India).
4. From `workers/ai-proxy/`, confirm `npx wrangler whoami` owns `lifeos-ai-proxy`, then:
   ```
   npx wrangler secret put ONET_USERNAME
   npx wrangler secret put ONET_PASSWORD
   npx wrangler secret put ADZUNA_APP_ID
   npx wrangler secret put ADZUNA_APP_KEY
   ```
5. Verify: `npx wrangler secret list` shows all four.
6. Tell Claude the secrets are set (and exact names) → it adds them to the Worker `Env`, adds the fetch path, grounds `src/ai/prompts/career.ts`, and deploys. Secrets sit inert until that deploy — safe to set early.
**Never** put `app_key`/O*NET password in `wrangler.toml [vars]` (plaintext, committed).

---

## B. The gated rollout chain — strict order

**Goal: enable `compaction_enabled` + `backup_enabled` (item 1.3).** Three gates must clear first, in this order.

### Step 1 — 2.4: Fix compaction breaking the hash chain ✅ DONE 2026-06-03 (Option A)
Was a hard blocker: checkpoints had `prevHash: null` + a fake `hash`, so the chain broke once compaction ran. **Resolved** — `planCompaction` now re-chains the local subsequence with real `chainHash`, re-linking survivors atomically (the sink applies the deletes + survivor re-links + checkpoint inserts in one transaction). `validateChain` is intact end-to-end post-compaction; covered by 16 compaction tests + a sink-level test, and adversarially reviewed across 4 lenses. Merged to `lifeosv1`.

### Step 2 — 2.6: Backup spinner-yield 🤖 (soft gate for `backup_enabled`) — ✅ DONE 2026-06-03
PBKDF2 (150k iters) runs synchronously, so the "Working…" state didn't paint before the freeze. Fixed: `handleExport`/`doImport` now yield a paint frame after `setBackupBusy(true)` (`app/settings.tsx`). Off-thread derivation for low-end Android remains an optional follow-up.

### Step 3 — 2.5: Two-device native smoke test 🧑 (needs a native build from 1.2 first)
Build both devices from a branch with the 2.4 fix + `backup_enabled`/`compaction_enabled` flipped **locally** in `FALLBACK_FLAGS` (test build only):
1. Device A: accumulate data → Settings → **Backup & Restore** → passphrase (≥6 chars) → **Export** → save the `.lifeos.json` file off-device.
2. Transfer to Device B (same account) → **Restore** → same passphrase → confirm the destructive alert → pick file. Import = per-row UPSERT in one transaction (merge, not wipe); `mutation_log`/`sync_cursor` excluded. Fully close + reopen B.
3. **Assert:** A's data on B; B's pre-existing extra rows still there; no crash. (Schema has **no** `onDelete: cascade` FKs, so the cascade hazard isn't present today.)
4. Compaction: on a device with >50 mutations for an entity, background→foreground to trigger; confirm the log shrank **and** the chain still validates (proves 2.4 on-device).
5. Wrong-passphrase test: must fail with **`Could not decrypt — wrong passphrase or corrupted backup.`** and write nothing.

### Step 4 — 1.3: Flip the flags per-cohort 🧑→🤖
Only after 2.4 merged + 2.5 passed + 2.6 landed. Flags live **only** in `useFlagStore` FALLBACK + the Supabase `flags` table (**not** `src/config/flags.ts`). No admin API creates flags/overrides, so seed rows via SQL:

1. Supabase SQL Editor — seed base rows:
   ```sql
   insert into flags (key, type, default_value, description) values
     ('compaction_enabled','bool','false'::jsonb,'P1-T9 compaction (deletes log rows). Requires 2.4 fix.'),
     ('backup_enabled','bool','false'::jsonb,'P1-T8 encrypted backup/import (overwrites local data).')
   on conflict (key) do nothing;
   ```
   (`status` defaults to `active`; stays globally OFF via `default_value=false` until an override matches.)
2. Per-cohort override (use `platform` — `tester_email` scoping is inert unless you wire the user's email into `_layout.tsx`'s `fetchFlags`):
   ```sql
   insert into flag_overrides (flag_id, scope_json, value)
   select id, '{"platform":"ios"}'::jsonb, 'true'::jsonb from flags where key = 'backup_enabled';
   ```
3. Verify: `curl "<WORKER_URL>/v1/config?platform=ios&app_version=1.0.0"` → expect `backup_enabled: true`.
4. Global on later: PATCH `default_value` via admin API, or an always-true override. Kill switch: PATCH `status→killed`.

**Done when:** in-cohort `/v1/config` returns the flag true (out-of-cohort false); on a cohort device after relaunch the Backup card appears / compaction runs; killing the flag hides it within 5 min.

---

## C. Claude's code — you just decide + say go

| # | What you decide | Go-ahead |
|---|---|---|
| **2.4** Compaction hash-chain | Option A (re-hash into chain) vs B (checkpoint-aware checks). See §B step 1. | *"Fix 2.4 with option A/B."* |
| **3.1** Act-stage confirm UI | Extend `WhatNextCard` vs new `ActionProposalCard`; gate on existing `aiCoachActions`. Locked: each action confirmed individually, no "always allow." (Propose→commit logic already exists + tested — UI only.) | *"Build the act-stage confirm UI (3.1), gated on `aiCoachActions`, one Confirm per action."* |
| **3.2** Learning-loop act half | Where verdict+toggle lives (likely Settings "AI behavior"); which tasks. Locked: no silent auto-flip. (Measurement + policy + store wired; only toggle UI missing. Verdicts accrue **native-only** — `recordSuggestionOutcome` no-ops on web.) | *"Build 3.2: Settings UI showing per-task verdict + recommendation, human toggles via `useVariantStore`."* |
| **3.3** Goal replanning | `GOAL_REBALANCE_PROMPT` is already consumed by `src/ai/goalRebalance.ts`; the gap is no UI calls it. Decide **(A)** manual "Rebalance my hours" action on the goals screen, or **(B)** proactive `detectDomainDivergence()` trigger (needs per-domain tracked-minutes + a cooldown source — that aggregation is the real work). *(The misleading goals.ts:78 comment was corrected 2026-06-03.)* | *"Wire 3.3 option A/B: surface `rebalanceGoals` as a confirm sheet; apply only on confirm."* |
| **3.4** Life graph (~12mo) | Greenfield. Which entity pairs get edges, derived-vs-explicit, and **which consumer needs it** — don't build ahead of a consumer. | *"Build 3.4: `entity_edges` table + migration + Dexie shim + `neighbors()`, wired to <consumer>."* |
| **4.1** MCP server (read-only) | Trigger met (P1 sync done). Decide if you want to drive LifeOS from Claude Desktop. Lives on the **Worker**, synced subset only — never health/contacts/journal. ~1 file (adapter over existing `AgentTool`s). | *"Build 4.1: read-only MCP endpoint on the Worker over the synced subset, Supabase-bearer auth."* |
| **4.2** MCP consume | **Name the source** (Linear/Notion/GitHub…) that already speaks MCP and where MCP beats REST — no source = stays parked. Client runs **on-device**. | *"Build 4.2 for <source>: on-device MCP client, wrap its tools as `AgentTool[]` into `buildLifeOsTools`."* |

---

## Suggested sequence
1.4 first (biggest user-facing fix, zero code) → then let Claude clear **2.4 + 2.6** (the code gates) to unblock the backup/compaction rollout chain → then pick a **3.x** feature.
