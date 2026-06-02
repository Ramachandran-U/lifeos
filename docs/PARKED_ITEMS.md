# Parked Items — Cross-Session Registry

> A consolidated list of work and decisions that have been **deliberately deferred** across sessions — with *why* they're parked and *what would un-park them*. This is a backlog of intent, not a task tracker; pull items from here into `TASKS.md` / `roadmap/` when their trigger fires.
>
> **Compiled:** 2026-06-01. Each entry is a point-in-time note — **verify file/line claims against current code before acting**; the codebase moves faster than this doc.
>
> Legend: 🅿️ parked work (pick up when triggered) · 🚫 decided against (don't re-pitch) · 🧱 known constraint (gotcha, not a deliverable) · ✅ done (kept for context).

---

## 1. Deployment & Ops

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 1.1 🅿️ | **Deploy the apex `lifeos-6r5.pages.dev`.** It's a *separate* Cloudflare Pages project (named `lifeos`), ~1 month stale (`dc37eec` "PWA shell"), **no P1 sync**. All session deploys went to the `lifeos-6r5` project → `lifeos-6r5-eqa.pages.dev`. | We treat `-eqa` as the de-facto production surface (it's in the Worker CORS allowlist, runs all P1). The apex is functional but old. | When the apex is the URL we want users on. Command: `wrangler pages deploy dist --project-name=lifeos` (confirm that project's production branch first — its last prod deploy used branch `claude/interesting-rubin-97ecf6`). |
| 1.2 🅿️ | **Run the native (iOS/Android) build.** A build *scaffold* now exists (added 2026-06-02 on branch `chore/eas-build-scaffold` by a parallel session — working-tree/feature-branch, **not yet on `lifeosv1`**): `eas.json` (dev/preview/production profiles, `appVersionSource: local`), `app.json` `ios.buildNumber` / `android.versionCode` / `runtimeVersion`, plus `expo-dev-client` + `eas-cli` deps. | Scaffold is staged but no `eas build` has run; needs Expo + Apple Developer + Google Play credentials. | `eas login`, then `eas build -p ios --profile production` (and `-p android`). This is also the only way to exercise **T10's native-only schema fixes** — latent until a real native build runs. |
| 1.3 🅿️ | **Enable `compaction_enabled` + `backup_enabled` flags.** Both default OFF in `useFlagStore` FALLBACK_FLAGS. | Compaction *deletes* mutation-log rows; backup import *overwrites* local data. Crypto + planner are unit-tested, but the native file/SQLite plumbing is **not device-validated**. | After a two-device native smoke test confirms gather/apply/compaction behave. Flip per-cohort via Worker `/v1/config`. |
| 1.4 🅿️ | **Publish the Google OAuth consent screen to "Production".** Currently "Testing" → refresh tokens expire ~7 days → the "reconnect Gmail every few days" papercut. | Fix is in Google Cloud Console, **not code**. | Do it in the console; no deploy needed. See memory `google-token-refresh-needs-supabase-session`. |
| 1.5 🅿️ | **Repo hygiene:** gitignore `supabase/.branches/` + `supabase/.temp/` (local Supabase CLI scratch — they show as `??` and risk an accidental `git add .`); harden `scripts/post-export-web.js` font-rename against Windows EPERM (already wrapped in try/catch, so cosmetic). | Low priority; doesn't block anything. | Any time; quick. Add to `.gitignore`: `supabase/.branches/` and `supabase/.temp/`. |
| 1.6 🅿️ | **Local Supabase stack needs Docker Desktop running.** Commands hitting the local stack fail with `Could not connect to local Supabase project…` — the Docker daemon isn't running (client installed, daemon unreachable). The `supabase` CLI is also not on PATH — invoke via `npx supabase`. | Only matters when you need the local backend; no code is broken and hosted/remote Supabase is unaffected. | Start Docker Desktop (wait for the daemon) → `npx supabase start` → verify `npx supabase status`. |

---

## 2. P1 Sync — follow-ons & watch items

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 2.1 🅿️ | **Canary/observe sync now that it's globally on.** `sync_engine_enabled` is global `true`; sync is active for all users on `-eqa`. | Decision was to ship sync on (not the ship-dark/canary path). | Watch `mutations` table growth + convergence (the Settings sync-status pill is the quick read). Gamification logs on every XP-changing action → higher push volume. If it misbehaves, flip the flag off in the Worker (kill switch, no redeploy). |
| 2.2 🅿️ | **E2E-encrypted sync for sensitive entities** (health_logs, food_entries, blood_reports, finance, contacts/social). | These are **intentionally local-only** today (privacy). The encrypted-backup core (T8, `backupCrypto.ts`) is the substrate for this later. | When we decide sensitive data should cross devices — only via E2E encryption, honoring the per-entity allowlist. See memory `sync-coverage-gap`. |
| 2.3 🧱 | **Privacy non-goal — do NOT auto-sync sensitive entities.** Listed here so it isn't re-proposed as "missing coverage." | By design. Non-sensitive coverage (goals, routine, reflections, gamification, interests, exploration, expeditions, sparks, profile) is complete. | n/a — design boundary. |
| 2.4 🅿️ | **Compaction breaks the hash chain.** `planCompaction` builds checkpoints with `prevHash: null` + a synthetic, non-cryptographic `hash` (`ckpt:…`), so post-compaction the `mutation_log` holds rows that don't validate as chain links (and a checkpoint can become the `resume()` head). | Surfaced in the PR #93 review; not fixed (flag-gated off). Undermines the chain's tamper-evidence guarantee once compaction runs. | Resolve **before** enabling `compaction_enabled`: re-hash checkpoints into the chain (real `prevHash` + hasher) or make integrity checks checkpoint-aware. `src/sync/compaction.ts:79-93`. |
| 2.5 🅿️ | **Native backup apply: untested + latent hazards.** `applyNative` is atomic now (PR #93) but unverified on-device; `INSERT OR REPLACE` fires `ON DELETE CASCADE` if any table declares cascading FKs, and rows apply in `sqlite_master` order, not FK-dependency order. | Can't unit-test expo-sqlite here — needs a device smoke test. | Before enabling `backup_enabled`: two-device export→import smoke test; confirm no table declares `ON DELETE CASCADE` (else insert in dependency order). `src/sync/backup.ts`. |
| 2.6 🅿️ | **PBKDF2 (150k iters) runs synchronously on the JS thread** during export/import (`backupCrypto.ts` `deriveKey`). | Fine for an explicit user action, but blocks the UI ~hundreds of ms on low-end devices. Documented in code; not mitigated. | Before enabling `backup_enabled`: show a spinner around the call; consider off-thread derivation for low-end Android. |

---

## 3. AI Architecture — gap-fix backlog

> From the 2026-05-30 code-grounded review (memory `ai-gap-fix-plan`). The 30-day sprint + durable memory (#2) shipped; these remain. **Re-verify against current code before picking up** (that memory is dated).

| # | Item | Horizon | Notes |
|---|------|---------|-------|
| 3.1 🅿️ | **Act-stage confirm-card UI (#1).** Propose-only write tools + the commit *logic* are done; the inline confirmable UI cards are still TODO. | ~30d | ALWAYS confirm (no "always allow this kind" bypass). Commit flows through existing `recordMutation` queries. |
| 3.2 🅿️ | **Learning-loop act half (#3-act).** Measurement end is wired (`recordSuggestionOutcome`); the human-toggled variant switch is not. | ~90d | NO silent auto-flip — surface kill/keep verdict, human toggles. |
| 3.3 🅿️ | **Goal replanning (#6).** Wire the unused `GOAL_REBALANCE_PROMPT`. | ~90d | |
| 3.4 🅿️ | **Life graph (#8).** `entity_edges`, 1-hop traversal. | ~12mo | Every write query already calls `recordMutation` → the audit trail is the substrate. |

---

## 4. Interop / Platform

| # | Item | Status | Un-park trigger |
|---|------|--------|-----------------|
| 4.1 🅿️ | **MCP — expose LifeOS as a server (read-only, over the synced subset).** | Parked; canonical record: [`docs/architecture/mcp-interop-decision.md`](architecture/mcp-interop-decision.md). | The doc's "earliest after P1 sync" condition is **now met** (P1 sync is done). Build when we actually want to dogfood LifeOS from Claude Desktop. It's a thin adapter on the Worker (map `AIToolDeclaration` → MCP tool schema), not a rewrite. |
| 4.2 🅿️ | **MCP — consume external servers** (e.g. Linear/Notion/GitHub tasks into the planner). | Parked. | Only when a concrete source that *already speaks MCP* appears and MCP is genuinely less work than a direct REST client. Decide per-source; host the client **on-device** to preserve data locality. |
| 4.3 🧱 | **Keep-the-door-open discipline.** The whole cost of future-proofing MCP is: keep new tools in the `AgentTool { declaration, execute }` shape and don't let provider-specific wire formats (Gemini `functionCall`) leak past `runtime.ts`. | Ongoing convention. | n/a — just don't break it. |

---

## 5. Integration Decisions (don't re-pitch)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 🚫 | **LinkedIn connect for the career section.** | Rejected 2026-05-31 (memory `linkedin-integration-rejected`). | Free API tier returns only name/photo/email — no work history/skills. Rich data is partner-only/paid; scraping is a ToS violation (LinkedIn v. Proxycurl). Don't re-propose unless LinkedIn's API access materially changes. |
| 5.2 🅿️ | **Career-engine grounding via O*NET + Adzuna** (the free/legit alternative to 5.1). | Parked option. | O*NET Web Services (occupation→skills, free key) + Adzuna (jobs+salary, free tier, covers India). Wire via the ai-proxy Worker (key as wrangler secret); non-PII reference data. |
| 5.3 🚫 | **Plaid / vector DB.** | Explicitly later-phase per `CLAUDE.md`. | Don't add without checking the roadmap. Durable memory already works *without* a vector DB (SQLite + JS cosine). |

---

## 6. Known constraints (gotchas, not work items)

| # | Item | Notes |
|---|------|-------|
| 6.1 🧱 | **Local `expo start --web` 500s every route** — static SSR can't resolve `expo-sqlite`'s wasm. | To browser-verify locally: temporarily set `web.output: "single"` in `app.json` (SPA) and revert, **or** test the deployed build / a static `expo export` + `serve dist`. Memory `web-ssr-sqlite-wasm-blocker`. |
| 6.2 🧱 | **Never junction/symlink `node_modules` into a git worktree on Windows** — deleting the link can recurse through and wipe the *real* `node_modules`. | Run a real `npm ci` in the worktree, or ship via reviewed patch. If a junction must go: `cmd /c rmdir "path"` (no `/s`). Memory `worktree-node-modules-junction-danger`. |
| 6.3 ✅ | Local test harness (tsc + jest) — **resolved** 2026-06-01; both run locally. | Native expo-sqlite paths still can't run under jest-node (device smoke only). Kept here so the old "harness incomplete" note isn't trusted. |
| 6.4 ✅ | Stale `testworktree` removed — **2026-06-02**. Worktree, branch `worktree-testworktree`, and on-disk dir all gone; `git worktree prune` confirmed no dangling metadata. | Resolved in the course of other branch work; kept for provenance. |

---

## 7. Type-check & CI tooling

> Surfaced 2026-06-01 during the PR #93 review (backup/compaction hardening). Both are fixable; left as follow-ups because each needs a deliberate call rather than a ride-along edit.

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 7.1 🅿️ | **`tsc` crashes on the default Node stack** (`RangeError: Maximum call stack size exceeded`) — deep Drizzle type instantiation overflows the stack, so the checker aborts before reporting. It only completes via `node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit`. Any `tsc` / `npm run verify` gate is therefore **unreliable** — the crash can read as a hard fail (or get ignored), masking real type errors. | The default-stack crash hid 4 real pre-existing errors until a large-stack run exposed them; PR #93 fixed 3 of them. | Bump the stack in the `verify` script + the CI typecheck step (e.g. `node --stack-size=8000 …/tsc --noEmit`), or split the typecheck into smaller `tsc -p` projects. Validate the stack value cross-platform — too high can segfault. |
| 7.2 🅿️ | **`src/sync/__tests__/outbox.test.ts:70` pre-existing type error** — `Conversion of type 'MutationRecord' to 'Record<string, unknown>'` (TS2352). The last remaining error after PR #93 (4 → 1). | The TS-suggested fix (`as unknown as …`) conflicts with the repo's ban on `as unknown`, so it needs a rule-compliant approach (typed helper / restructured assertion), not a reflexive cast. Was masked by 7.1. | Fix alongside the 7.1 stack bump so the typecheck gate goes fully green. Low effort. |

---

## Related canonical docs

- [`docs/MANUAL_OPS_TODO.md`](MANUAL_OPS_TODO.md) — manual operational steps
- [`docs/PRE_PRODUCTION_CHECKLIST.md`](PRE_PRODUCTION_CHECKLIST.md) — pre-launch gate
- [`docs/architecture/mcp-interop-decision.md`](architecture/mcp-interop-decision.md) — MCP decision record (items 4.1–4.3)
- `TASKS.md` / `roadmap/` / `implementation-plan/` — active work & sequencing
