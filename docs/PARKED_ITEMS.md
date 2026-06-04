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
| 1.5 ✅ | **Repo hygiene:** gitignore `supabase/.branches/` + `supabase/.temp/` — **done 2026-06-02** (branch `chore/parked-quickwins`); both now in `.gitignore`. The remaining sub-note (harden `scripts/post-export-web.js` font-rename against Windows EPERM) is already wrapped in try/catch, so cosmetic — left as-is. | Low priority; didn't block anything. | — |
| 1.6 🅿️ | **Local Supabase stack needs Docker Desktop running.** Commands hitting the local stack fail with `Could not connect to local Supabase project…` — the Docker daemon isn't running (client installed, daemon unreachable). The `supabase` CLI is also not on PATH — invoke via `npx supabase`. | Only matters when you need the local backend; no code is broken and hosted/remote Supabase is unaffected. | Start Docker Desktop (wait for the daemon) → `npx supabase start` → verify `npx supabase status`. |

---

## 2. P1 Sync — follow-ons & watch items

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 2.1 🅿️ | **Canary/observe sync now that it's globally on.** `sync_engine_enabled` is global `true`; sync is active for all users on `-eqa`. | Decision was to ship sync on (not the ship-dark/canary path). | Watch `mutations` table growth + convergence (the Settings sync-status pill is the quick read). Gamification logs on every XP-changing action → higher push volume. If it misbehaves, flip the flag off in the Worker (kill switch, no redeploy). |
| 2.2 🅿️ | **E2E-encrypted sync for sensitive entities** (health_logs, food_entries, blood_reports, finance, contacts/social). | These are **intentionally local-only** today (privacy). The encrypted-backup core (T8, `backupCrypto.ts`) is the substrate for this later. | When we decide sensitive data should cross devices — only via E2E encryption, honoring the per-entity allowlist. See memory `sync-coverage-gap`. |
| 2.3 🧱 | **Privacy non-goal — do NOT auto-sync sensitive entities.** Listed here so it isn't re-proposed as "missing coverage." | By design. Non-sensitive coverage (goals, routine, reflections, gamification, interests, exploration, expeditions, sparks, profile) is complete. | n/a — design boundary. |
| 2.4 ✅ | **Compaction breaks the hash chain.** Checkpoints used `prevHash: null` + a synthetic `hash` (`ckpt:…`), so post-compaction rows didn't validate as chain links. **Resolved 2026-06-03 (Option A)**: `planCompaction` is now async + hasher-injected; it re-chains the local subsequence (survivors + checkpoints, `compareMutationOrder`) with real `chainHash`, returning `rechained[]` survivors the sink UPDATEs atomically alongside the delete + checkpoint insert. The web sink re-sorts so `resume()` keeps the true head; native `resume()` got a `(device_id,id)` tie-break. `validateChain` over the local chain is intact end-to-end post-compaction (tested). Adversarially reviewed (4 lenses). | Was a PR #93 finding; undermined tamper-evidence once compaction ran. | — *(this was the hard gate for enabling `compaction_enabled` — see 1.3 / runbook §B; 2.5 device smoke is the next gate)* |
| 2.5 🅿️ | **Native backup apply: untested + latent hazards.** `applyNative` is atomic now (PR #93) but unverified on-device; `INSERT OR REPLACE` fires `ON DELETE CASCADE` if any table declares cascading FKs, and rows apply in `sqlite_master` order, not FK-dependency order. | Can't unit-test expo-sqlite here — needs a device smoke test. | Before enabling `backup_enabled`: two-device export→import smoke test; confirm no table declares `ON DELETE CASCADE` (else insert in dependency order). `src/sync/backup.ts`. |
| 2.6 🅿️ | **PBKDF2 (150k iters) runs synchronously on the JS thread** during export/import (`backupCrypto.ts` `deriveKey`). **Spinner-yield landed 2026-06-03** — `handleExport`/`doImport` (`app/settings.tsx`) now `yieldToPaint()` after `setBackupBusy(true)`, so the "Working…" state paints before the block. The `backup_enabled` soft-gate is cleared. | Fine for an explicit user action, but still blocks the UI ~hundreds of ms on low-end devices (the yield makes the spinner honest; it doesn't speed up derivation). | Remaining (optional): off-thread / chunked derivation for low-end Android. |

---

## 3. AI Architecture — gap-fix backlog

> From the 2026-05-30 code-grounded review (memory `ai-gap-fix-plan`). The 30-day sprint + durable memory (#2) shipped; these remain. **Re-verify against current code before picking up** (that memory is dated).

| # | Item | Horizon | Notes |
|---|------|---------|-------|
| 3.1 🅿️ | **Act-stage confirm-card UI (#1).** Propose-only write tools + the commit *logic* are done; the inline confirmable UI cards are still TODO. | ~30d | ALWAYS confirm (no "always allow this kind" bypass). Commit flows through existing `recordMutation` queries. |
| 3.2 🅿️ | **Learning-loop act half (#3-act).** Measurement end is wired (`recordSuggestionOutcome`); the human-toggled variant switch is not. | ~90d | NO silent auto-flip — surface kill/keep verdict, human toggles. |
| 3.3 🅿️ | **Goal replanning (#6).** *(Correction: `GOAL_REBALANCE_PROMPT` is NOT unused — `src/ai/goalRebalance.ts` already consumes it via `rebalanceGoals()`. The misleading "Not currently called" comment in `goals.ts` was fixed 2026-06-03.)* The real gap: `goalRebalance.ts` has no UI consumer — surface it (manual "Rebalance hours" action, or a proactive `detectDomainDivergence()` trigger). | ~90d | `GOAL_SLIP_RECOVERY_PROMPT` in the same file *is* genuinely still unwired — don't confuse the two. |
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

> Surfaced 2026-06-01 during the PR #93 review (backup/compaction hardening). **Both resolved 2026-06-02** (7.1 via the `typecheck` stack bump on branch `chore/parked-quickwins`; 7.2 was already fixed in PR #88) — kept here for provenance.

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 7.1 ✅ | **`tsc` crashes on the default Node stack** (`RangeError: Maximum call stack size exceeded`) — deep Drizzle type instantiation overflows the stack, so the checker aborts before reporting. **Resolved 2026-06-02** (branch `chore/parked-quickwins`): added a `typecheck` npm script (`node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit`), wired into `npm run verify` and the CI **Typecheck** workflow (`.github/workflows/typecheck.yml`). Validated: `npm run typecheck` exits 0 with zero errors on Node 22 locally. | The default-stack crash hid 4 real pre-existing errors until a large-stack run exposed them; PR #93 fixed 3, the 4th was 7.2 below. | — |
| 7.2 ✅ | **`src/sync/__tests__/outbox.test.ts:70` pre-existing type error** (`Conversion of type 'MutationRecord' to 'Record<string, unknown>'`, TS2352). **Already fixed in PR #88** — line 70 now reads `expect((all[0] as { syncState?: unknown }).syncState).toBeUndefined();`, a narrow rule-compliant cast (no `as unknown`). Confirmed clean by the 7.1 large-stack `npm run typecheck` (0 errors). | — | — |

---

## 8. Google Maps integration

> 🅿️ Researched **2026-06-04** (scoping only — no code). Full report in that session's transcript. **Un-park trigger: we obtain a Google Maps Platform API key.** Pull the chosen first features into `roadmap/` then. Verify exact per-1000 $ SKU rates on Google's [core pricing list](https://developers.google.com/maps/billing-and-pricing/pricing) before budgeting (research used some secondary sources for dollar figures).

**2025 landscape shift (still current mid-2026):** classic Places / Directions / Distance Matrix are now **Legacy** → use **Places API (New)** + **Routes API**. The flat $200/mo credit was replaced (Mar 1 2025) by **per-SKU monthly free tiers** (~10k Essentials / 5k Pro / 1k Enterprise calls *per SKU, per month*) — cheap at our pre-scale volume.

**Candidate features:**

| # | Feature | Engine | API(s) | Proxyable? | Cost tier |
|---|---------|--------|--------|-----------|-----------|
| A | "Leave-by" + travel/commute time in the planner | Routine | Routes API | ✅ Worker | Essentials/Pro |
| B | Nearby gyms / parks / running spots | Health | Places Nearby/Text Search | ✅ Worker | Pro |
| C | Meetup-spot suggestions for overdue contacts | Social | Places + Routes | ✅ Worker | Pro |
| D | Enrich transaction merchants w/ place+category | Finance | Places Text Search/Details | ✅ Worker | Pro/Enterprise |
| E | Place-based discovery ideas | Explore | Places | ✅ Worker | Pro |
| F | Outdoor-workout suitability (AQI / pollen) | Health | Air Quality / Pollen | ✅ Worker | Env APIs |
| G | Rendered interactive map / place-card UI | any | Maps JS / react-native-maps / Places UI Kit | ❌ client-side key | Map SKUs |

**🧱 Hard constraints (gotchas):**
- **Data APIs (A–F) are REST → proxy through the Worker** (IP-restricted key) — fits our keys-server-side model. **Rendered maps (G) need a client-side bundled/exposed key → breaks that invariant**, and web map rendering is immature (`expo-maps` = alpha + no web; `react-native-web-maps` = unmaintained since 2020). Defer G.
- **ToS: do NOT cache/store Places content locally except place IDs** (storable indefinitely). Conflicts with our local-first / event-sourced store → persist **place ID only**, re-hydrate display fields on read. Routes + Air Quality/Pollen sidestep this entirely.
- **Mandatory Google attribution** on surfaced place data; **privacy** — send coordinates, not contact/merchant records; minimise what leaves the device.

**Recommended first ship (4-lens review, this session):** **A (Routes "leave-by") first** — pure data, proxyable, ToS-clean, lands in the daily planner loop. Then **F (AQI/pollen workout suitability)** — cheapest "wow", feeds the existing replan/`cognition` machinery. Then **C (Social meetup spots)** / **D (Finance enrichment, place-ID-only)**. **Avoid G first.** Devil's-advocate guardrails to fold in before shipping: cap Places field masks to cheap tiers, lint against persisting Places payloads (place-ID-only), and don't send user location off-device without explicit consent. The location-egress concern is the gating product decision (opt-in, coarse, computed-then-discarded).

---

## 9. Goals page revamp

> A four-lens review (UX / engineer / layman / growth-PM) of the current Goals page produced a revamp brief; the **goals↔planner slice shipped** (PR #126 — see below), the rest is parked. The page's core problem (per the review): it leads with *judgment* (a trajectory scoreboard) instead of *action*, and the loop was unmeasurable.

✅ **Shipped this session (context):** goal remove/postpone/restore (#122); live goals drive the planner + lifecycle instrumentation + relaxed confidence gate + in-place "add to today" preview (#126). The items below are the **remaining** brief.

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 9.1 🅿️ | **Action-first Goals page**: a pinned "Your next move" hero card (one prioritised task → opens its routine block), section the page into **Now / Build / Archive**, plain-language pass (kill "Trajectory/Recalibrate" jargon), gate the trajectory chart until there's real data, honest progress (**"3 of 7 steps"**, never a fake 0% on leaf goals), and a **completion celebration + Undo** (reuse `AchievementToast`). | The high-leverage backend slice (goals→planner) shipped first; this is a larger **UX/design** effort and warrants a Figma pass, not a quick wire-up. | When prioritising Goals-page UX. The 4-lens brief is the spec; start with the "next move" card + completion celebration (the two that move D1/D7 retention). |
| 9.2 🅿️ | **Editable goals + activate the dead goal-intelligence.** No way to edit a goal's title/type/timeline after creation (only description/comments/lifecycle). And `rebalanceGoals` + `detectDomainDivergence` (`src/ai/goalRebalance.ts`) are fully built, prompted, and unit-tested but **called by nothing**. | Edit needs a small `updateGoalFields` mirror + UI; the rebalance intelligence needs a dismissible propose→confirm banner (reuse the `GoalReplanSheet` pattern). | Both are S–M; pick up with 9.1. |
| 9.3 🧱 | **Goals-page render perf.** `commentCounts` runs `listGoalComments` per goal on every render, and `countDescendants`/`progressFor` walk the subtree per node per render — O(n²)-ish, and the web Dexie shim has no index (full-array scans). | Fine at ~20 goals; visibly janky at a few hundred. | **Before** shipping any feature that grows the tree (filters, templates). Cheap fix: one `listAllGoalComments(userId)` pass + memoised descendant counts. |
| 9.4 🧱 | **`priorityAdjust` gates the goal-change re-plans.** The remove/postpone *and* the new "add to today" previews only fire when `priorityAdjust` is enabled (default OFF). | Intentional — the same flag guards the whole adjust-today AI-write path. | Flip the flag (per-cohort via Worker `/v1/config`) once the diff+undo flow is dogfooded. |

---

## Related canonical docs

- [`docs/PARKED_ITEMS_RUNBOOK.md`](PARKED_ITEMS_RUNBOOK.md) — **step-by-step instructions to un-park each item here** (commands, console paths, gotchas)
- [`docs/MANUAL_OPS_TODO.md`](MANUAL_OPS_TODO.md) — manual operational steps (parked-items human actions mirrored as checkboxes)
- [`docs/PRE_PRODUCTION_CHECKLIST.md`](PRE_PRODUCTION_CHECKLIST.md) — pre-launch gate
- [`docs/architecture/mcp-interop-decision.md`](architecture/mcp-interop-decision.md) — MCP decision record (items 4.1–4.3)
- `TASKS.md` / `roadmap/` / `implementation-plan/` — active work & sequencing
