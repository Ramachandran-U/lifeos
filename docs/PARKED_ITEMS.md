# Parked Items — Cross-Session Registry

> A consolidated list of work and decisions that have been **deliberately deferred** across sessions — with *why* they're parked and *what would un-park them*. This is a backlog of intent; pull items from here into `roadmap/` / `implementation-plan/` when their trigger fires.
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
| 1.4 ✅ | **Google OAuth consent screen published to Production — 2026-06-08.** Refresh tokens no longer expire after 7 days. Existing sessions roll over naturally on next token refresh. | — | — |
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
| 3.1 ✅ | **Act-stage confirm-card UI (#1).** `CoachActionsCard` shipped in PRs #121/#123 (after this doc was compiled). Each proposed action renders as a confirmable card with Skip/Confirm buttons, action-type icon, entry animation, and per-kind accent colour. Nothing mutates without explicit Confirm; `ai_coach_actions` is default-on (useFlagStore v3, 2026-06-05). UI polished 2026-06-06. | — | ALWAYS confirm holds by construction — no tool touches the DB. |
| 3.2 🅿️ | **Learning-loop act half (#3-act).** Measurement end is wired (`recordSuggestionOutcome`); the human-toggled variant switch is not. | ~90d | NO silent auto-flip — surface kill/keep verdict, human toggles. |
| 3.3 ✅ | **Goal replanning (#6) — shipped 2026-06-06.** `rebalanceGoals()` is now wired: `detectDomainDivergence()` fires on Goals screen focus (once per session) and opens `GoalRebalanceSheet`; a manual "Balance" chip in the legend row is always available. Confirmed proposals save `weeklyHoursTarget` to each goal's metadata via `updateGoalMetadata()`. `GOAL_SLIP_RECOVERY_PROMPT` is also wired via `recoverGoal()` — the `GoalDetailSheet` shows a "Get a 7-day recovery plan" banner for active goals with >7 days since last update; the plan includes encouragement, a quick win, and 7 daily steps. | — | `recoverGoal` task added to modelRouter.ts. |
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

## 9. Calorie / nutrition v2

> 🅿️ The calorie target now personalises from age (PR #125) and has a goal selector (PR #131); the voice agent has a nutrition tool (PR #133). Two follow-ons are scoped but gated:

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 9.1 🅿️ | **ED-safety items — code guardrails done; human sign-off outstanding.** Code items shipped 2026-06-08: `CalorieRing` over-target color changed from `c.error` (red) to `c.health` (neutral, all fill levels); "Eating concerns? Get support →" NEDA helpline link added to `CalorieRing` (always visible, `c.textMuted` caption); gamification audited — no badge/XP tied to calorie accuracy. **Still needs human sign-off** before promotion: range-vs-single-number display (product decision), clinical copy review. See [`docs/CALORIE_ED_SAFETY_CHECKLIST.md`](CALORIE_ED_SAFETY_CHECKLIST.md) (3 of 5 items now ✅). | Human sign-off on copy review + range-display decision remains the gate for promoting the surface. |
| 9.2 🅿️ | **Adaptive TDEE** — learn true expenditure from logged intake vs. weight trend (MacroFactor-style); ~3× more accurate than a static formula after 2–4 weeks. ~1.5–2 day build, behind a flag, formula as fallback. | Needs an adherence gate (else partial logging → under-eating advice) and the 9.1 safety items first (a "your real TDEE is X" number is more authoritative). | After 9.1 sign-off. Design + open decisions: [`docs/ADAPTIVE_TDEE_DESIGN.md`](ADAPTIVE_TDEE_DESIGN.md). |

---

## 10. LLM latency & cost

> From the ~2–3s-per-call latency review (2026-06-05). Quick wins shipped (#144); cheap-tier Groq routing shipped behind two opt-ins (#145). The bigger *perceived*-latency win (streaming) is deliberately gated on reading the new telemetry first (measure-first).

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 10.1 ✅ | **Latency telemetry read — 2026-06-08.** `Server-Timing` headers are emitted per-call but not stored (in-memory spans only; Langfuse not configured). Historical latency breakdown unavailable; task-tier mapping used as proxy. Per-task volume/token data queryable via `/v1/admin/ai-ops`. Top cheap-tier Groq candidates identified: `categorizeMerchant`, `generateRabbitHoleNode`, `generateDailyBriefing`, `generateDailySpark`. | — | — |
| 10.2 ✅ | **Groq cheap-tier routing activated — 2026-06-08.** `EXPO_PUBLIC_CHEAP_PROVIDER=groq` set in `.env` + baked into prod bundle. `GROQ_API_KEY` pushed as Worker secret. `pickModel` in `claude.ts` updated to translate `gemini-2.5-flash` → `llama-3.1-8b-instant` on Groq (planning/reasoning tier stays on `llama-3.3-70b-versatile` as fallback). Both Worker + Pages deployed. | — | — |
| 10.3 ✅ | **Streaming shipped — 2026-06-08.** Worker (`claude.ts`): `callGeminiStream` uses `:streamGenerateContent?alt=sse`; `callGroqStream` uses `stream:true`; both re-emit simplified `data:{"text":"..."}` / `data:{"done":true,...}` SSE to the client. Client (`src/ai/client.ts`): `callAIStream(request, onChunk)` reads the stream incrementally, calls `recordUsage`/`track`/`endSpan` on the done chunk — same cost-ledger and telemetry guarantees as `callAI`. Chat screen (`app/chat.tsx`): streams text into a live bubble; `streamingText` state drives incremental render. Tool-use and JSON calls stay on the non-streaming path. Worker + Pages deployed. | — | — |

---

## 11. Goals page revamp

> A four-lens review (UX / engineer / layman / growth-PM) of the current Goals page produced a revamp brief; the **goals↔planner slice shipped** (PR #126 — see below), the rest is parked. The page's core problem (per the review): it leads with *judgment* (a trajectory scoreboard) instead of *action*, and the loop was unmeasurable.

✅ **Shipped this session (context):** goal remove/postpone/restore (#122); live goals drive the planner + lifecycle instrumentation + relaxed confidence gate + in-place "add to today" preview (#126). The items below are the **remaining** brief.

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 11.1 ✅ | **Action-first Goals page — shipped 2026-06-06.** "Your next move" hero card (first active daily task with Mark done / View actions). Page restructured into **Now** (life/yearly) + **Build** (monthly/weekly) + **Archive** (completed + postponed + deleted, single collapsible). Life vision gated until sub-goals exist. `GoalCard` now shows "X of Y steps" (honest progress) instead of fake % for leaf goals; progress bar hidden for leaf goals. Completion toast with Undo slides up on task complete. | Remaining: jargon pass ("Trajectory" → plain label) and deeper action-card linking to routine blocks — both need a Figma sign-off. | §11.3 (render perf) is the next gates item before growing the tree further. |
| 11.2 ✅ | **Editable goals + activate the dead goal-intelligence — shipped 2026-06-06.** `updateGoalFields(id, { title, goalType, timeline })` added to goals queries + web storage. `GoalDetailSheet` has a new "Edit" mode (title text input, type chip selector, optional timeline input) accessible from the active-goal lifecycle row. `onFieldsChanged` callback reloads the goal list in the parent. Rebalance intelligence wired in §3.3. | — | — |
| 11.3 ✅ | **Goals-page render perf — shipped 2026-06-06.** `getCommentCountsByUser(userId)` reads ALL goal comments in one pass → `O(1)` per render (was one Drizzle/localStorage read per goal). `descendantCounts` useMemo replaces the per-render BFS walk with an `O(n)` pre-computed map keyed by goal id. `progressFor` now reads from that map (one lookup). JSX double `countDescendants` call eliminated. | — | — |
| 11.4 ✅ | **`priorityAdjust` flipped ON — 2026-06-08.** `DEFAULT_FLAGS.priorityAdjust` changed to `true` in `src/config/flags.ts`. Goal-change re-plans (remove/postpone "add to today" preview, `offerReplan` in goals.tsx, edit-priorities flow) now active by default. Kill switch: `setFlagOverride({ priorityAdjust: false })` or Worker `/v1/config`. | — | — |

---

## 12. Rabbit Hole → navigable decision-tree map (Explore v3)

> The rabbit hole was rebuilt from a destructive linear stack into a persistent, branchable decision-tree MAP. Full design + resolved decisions: [`docs/rabbit-hole-tree-map-redesign.md`](rabbit-hole-tree-map-redesign.md). Engine + UI + route are built and **unit/render-tested**, all behind the `rabbitHoleTreeMap` flag (default OFF). Phases 1–6 shipped; the items below are the remaining tail.

✅ **Shipped (context):** the pure tree model + helpers, schema (`rabbit_hole_trees` + `constellation_edges`, local-only) + queries/shim, the Zustand store + actions (advance / score / scoring ledger), the constellation feed + shared `isCrossCategory`, the 5 shape badges, the component layer (`RabbitHoleScreen`/`MapView`/`MapNode`/`ConnectorElbow`/`NodeCard`/`ForkButton`/`DepthBadge`/`Breadcrumb`/`ExitSummary` + pure `rabbitHoleLayout`), and the `app/rabbit-hole.tsx` flag fork. Frontier now passes `adjacentField` so frontier-seeded trees can earn synapses.

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 12.1 ✅ | **Legacy screen gone — 2026-06-08.** `app/rabbit-hole.tsx` was verified to already render only `<RabbitHoleScreen />` with no flag fork and no `LegacyRabbitHoleScreen` in the tree. The `rabbitHoleTreeMap` flag was never committed to `flags.ts` — the legacy code was cleaned up directly. Nothing to delete. | — | — |
| 12.2 ✅/🅿️ | **"Your Maps" gallery polished — 2026-06-08.** Each map card now shows: (1) **`MapSilhouette`** — a 72×48 SVG tree diagram built from the live `treeJson` node map (BFS depth layout, dots + lines, up to 4 layers); (2) **Suggest name →** button on untitled maps — calls `suggestMapTitle` (new `cheap`-tier AI task in `modelRouter.ts` + `functions.ts`), saves the title via `upsertRabbitHoleTree`, and updates local state. Remaining polish: image share (needs `react-native-view-shot` dependency — deferred). | — | — |
| 12.3 ✅ | **Animation polish — shipped 2026-06-08.** Cursor tile now has a `withRepeat` ripple ring: a gold `Animated.View` overlay that scales 1→1.4 and fades 0.55→0 over 1.1s, looping forever while the node is the active cursor. New cursor tiles use `ZoomIn.springify().damping(14)` entrance (was flat `FadeIn`). Phone Focus sheet now enters with `SlideInDown.springify().damping(18)` and exits with `SlideOutDown.duration(220)` (was static `View`). True measured-origin grow-from-tile remains a future polish pass (needs scroll-offset tracking across nested ScrollViews). | — | — |
| 12.4 🅿️ | **Web drag-pan / pinch for the map.** Today it's nested `ScrollView`s (works, but no pan/zoom). | Deliberately avoided a canvas/pan-zoom dependency (design decision). At ~25–40 tiles, scroll is adequate. | If real trees routinely exceed the viewport on web. |
| 12.5 🅿️ | **`react-native-skia` connectors if node count > 50.** Connectors are bordered `View`s today. | Fine at the depth-12 / sparse-fork ceiling (~25–40 Views). | Only if a perf measurement shows the View-per-connector layout janking on low-end devices. |
| 12.6 🅿️ | **Rabbit-hole thread sync.** Trees are **local-only** (`rabbit_hole_trees` + `constellation_edges` bypass the mutation log). | The sync union has no rabbit-hole entity type yet, and constellation rebuilds from source. | When cross-device "Your Maps" is wanted — add thread metadata to the mutation log once constellation sync is scoped (see memory `sync-coverage-gap`). |

---

## 13. Ink + Signal W4 — module-screen hierarchy

> The W4 foundation PR (flag `module_hierarchy_v1`, legacy extraction + snapshots, `SectionTitle`/`ConnectRow`/`EmptyState.trustNote`, `useHeroSnoozeStore`, `hierarchyGuards.test.ts`) landed first; the five screen recompositions follow one PR each behind the flag. Spec: `docs/design-deep-dive/04-module-screens.md`.

| # | Item | Why parked | Un-park trigger |
|---|------|-----------|-----------------|
| 13.1 🅿️ | **Delete `src/screens/legacy/*` + the `*.legacy` snapshots** (`src/screens/legacy/__tests__/legacySnapshots.test.tsx` + its `__snapshots__/`), the five `if (!hierarchyV1) return <XScreenLegacy/>` branches, and the three guard-allowlist entries that followed the extraction (colorToken ×1, capsLabel ×5, motionToken ×5 renames in `src/theme/__tests__`). Counter-rule for Dilution trap 1 — the legacy path must die, not linger. Owner: **RATIFIED (founder, 2026-06-13)** — the Claude session that flips `module_hierarchy_v1` to 100% records the flip date here, and a Claude session executes the deletion once 14 consecutive days have elapsed. Filed by W4 foundation PR. **FLIP RECORDED: `module_hierarchy_v1` default-on (100%) since 2026-06-13 — deletion eligible from 2026-06-27**, provided the flag was not killed via the Worker in between. | The legacy trees are the flag-off render path until `module_hierarchy_v1` rollout completes — deleting earlier removes the kill switch. | **Graduation criterion: `module_hierarchy_v1` at 100% for 14 consecutive days.** Deletion is one file per screen plus the wrapper branch — no surgery. |
| 13.2 ✅ | **UN-PARKED 2026-06-13 (W4 follow-ups PR):** the Fit ConnectRow's press now opens `FitActionsSheet` (`Sync now` / `Disconnect Google Fit`) — the same one-level-in pattern as Finance's Gmail sheet (spec 04 amendment s). Disconnect clears tokens + synced data, mirroring legacy semantics. | — | Done; graduation blocker removed. |

---

## Related canonical docs

- [`docs/PARKED_ITEMS_RUNBOOK.md`](PARKED_ITEMS_RUNBOOK.md) — **step-by-step instructions to un-park each item here** (commands, console paths, gotchas)
- [`docs/MANUAL_OPS_TODO.md`](MANUAL_OPS_TODO.md) — manual operational steps (parked-items human actions mirrored as checkboxes)
- [`docs/PRE_PRODUCTION_CHECKLIST.md`](PRE_PRODUCTION_CHECKLIST.md) — pre-launch gate
- [`docs/architecture/mcp-interop-decision.md`](architecture/mcp-interop-decision.md) — MCP decision record (items 4.1–4.3)
- `roadmap/` / `implementation-plan/` — active work & sequencing (note: the `TASKS.md`/`PRD.md` hub referenced by older docs no longer exists; product spec is `docs/PRODUCT_TECHNICAL_DOC.md`)
