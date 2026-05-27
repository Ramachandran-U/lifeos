# LifeOS — Bug & Request Log

> Running log of issues and feature requests surfaced during testing, with status + where they were fixed. Newest batch at the bottom. "Fixed (commit)" links the commit/PR that resolved it; "Needs ops" means the code is ready but a dashboard/secret/deploy action is required.

Last updated: 2026-05-27

---

## Legend
- ✅ **Fixed** — shipped to `aurora-refined-v2` + merged to `lifeosv1`, live on `lifeos-6r5-eqa.pages.dev`
- 🟡 **Mitigated** — partial/client-side fix shipped; durable fix needs a follow-up
- 🔧 **Needs ops** — code correct; requires a manual dashboard/secret/deploy action
- 🔁 **Not reproduced** — code path verified correct; likely environment/cache

---

## Batch 1 — UI / fixes (PR #29)

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Hex bar edges need clean minimal symbols/icons | ✅ Fixed | `520735c` — domain glyphs (◆ ♥ ◈ ▲ ● ✦) at each HexRadar vertex |
| 2 | Editing routine times → Generate throws an error | ✅ Fixed | `520735c` — `"Unbalanced JSON"`: agent propose/critique had no `maxTokens` → worker's 1200 default truncated output. Raised to 3000/3500 |
| 3 | Hold-to-complete competes with mobile long-press copy | ✅ Fixed | `520735c` — hold 1000→250ms + web `userSelect:none`/`touchAction:manipulation` |

---

## Batch 2 — streaks / report / profile (PR #30)

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Streaks not saved / populated | ✅ Fixed | `3b1a622` — `loadFromDB` replaced `DEFAULT_STREAKS` with `'{}'`, wiping keys; `triggerStreak` then threw. Now merges over defaults |
| 2 | Voice assistant shows websocket error | 🔧 Needs ops | `3b1a622` — clearer client message shipped; **root cause = worker `GEMINI_API_KEY` secret not set** (`wrangler secret put GEMINI_API_KEY` in `workers/ai-proxy`) |
| 3 | profile → Notifications redirects to Today | 🔁 Not reproduced | Allow-listed + smoke nav test passes on current deploy. Stale PWA cache — hard-refresh resolves |
| 4 | what-lifeos-knows: copy AI prompt + paste back | ✅ Fixed | `3b1a622` — "Understand me better" card (Copy prompt + Paste results) wired to discovery extraction round-trip |
| 5 | profile/Appearance should be collapsible | ✅ Fixed | `3b1a622` — collapsed by default, tap header to expand |
| 6 | 28-day report shows "No report available" | ✅ Fixed | `3b1a622` — gated on a `user_profiles` row legacy users lack; falls back to empty profile, generates from routine/behaviour data |

---

## Batch 3 — health / engagement / goals (in progress)

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Saved vitals not persisting (health) — must re-enter | ⏳ In progress | — |
| 2 | Dynamic scroll-reactive background (vs static) | ⏳ In progress | — |
| 3 | Option to log yesterday's progress if missed | ⏳ In progress | — |
| 4 | All-tasks-complete → confetti + daily-summary popup | ⏳ In progress | — |
| 5 | Swipe-left to uncheck an accidentally-completed block | ⏳ In progress | — |
| 6 | Add goal → decompose: "AI returned invalid GoalHierarchy. Unbalanced JSON" | ⏳ In progress | Same truncation class as Batch-1 #2; durable fix needs worker `MAX_TOKENS_CAP` raised to 8000 |

---

## Batch 4 — verified QA handover (BUG-001/008–015)

| # | Issue | Status | Resolution |
|---|---|---|---|
| BUG-001 #1 | Decomposed goals "don't persist" (userId orphaning on reload) | ✅ Already fixed | Resolved in Batch 3 `203acfe` — `webRewriteUserId` now migrates all userId-scoped stores |
| BUG-001 #2 | AddGoalSheet dropped weekly + dailyTaskExamples | ✅ Fixed | AddGoalSheet now uses the canonical `persistHierarchy()` (saves all 5 levels); same path as onboarding |
| BUG-008 | DB-init ran twice under StrictMode + web console noise | ✅ Fixed | Module-level `didBootInit` run-once guard; web init log gated to `__DEV__` |
| BUG-009 | Three domain vocabularies; `mind`/Polymath unreachable from Life hub | ✅ Fixed | (1) Added the 6th "Explore" hub card. (2) Renamed the scored-domain key `mind` → `polymath` across the whole codebase to match the module key / `DomainId` / color+glyph tokens. Persisted data migrated: read-alias in `useGameStore.loadFromDB` + `domain_scores` parse, a `version:2` `migrate` on `lifeos_domain_history_v1`, and the gamification default. No score history orphaned |
| BUG-010 | `/chat` silently redirects to `/` | ✅ Fixed | Root-layout allowlist was missing `inChat` (report's `chatbot_beta` cause was wrong); added + smoke route |
| BUG-011 | Prompt-injection in goal text | ✅ Hardened | Defence was already structural (Zod-validated output + React text escaping). Added an explicit injection clause to `GOAL_DECOMPOSITION_PROMPT` (treat vision as untrusted data, not instructions) + a `goalInjection.test.ts` suite pinning both halves: adversarial vision stays schema-valid through the mock builder, and the schema rejects prose / wrong-shape / out-of-enum output |
| BUG-012 | Decompose has no progress/cancel/timeout UI | ✅ Fixed | Delayed "still working ~20s" hint after 8s + a Cancel button. `AbortSignal` is now threaded through `AIRequest` → `callViaProxy` fetch, so Cancel truly aborts the in-flight request (not just the UI) |
| BUG-013 | Onboarding bypass | ✅ Hardened | Extracted the root-layout routing guard into a pure `resolveGuardRedirect()` (`src/utils/routeGuard.ts`) + a 22-case `routeGuard.test.ts` that pins the fresh-/partly-onboarded paths: a sub-COMPLETE account is bounced to `day1-vision` even when deep-linking `(tabs)` or any post-onboarding route. The inline guard (untested) is replaced by the function |
| BUG-014 | Web routine blocks unsorted in storage | ✅ Fixed | Sort-on-read in `webGetRoutineBlocksByDate`/`InRange` (date, startTime) + unit test |
| BUG-015 | "Did it" not persisted; mid-flow refresh loses selections | ✅ Fixed | evening-reflect writes an idempotent draft via `upsertReflection` on each change; hydrates on remount |

---

## Known follow-ups
- **Worker `MAX_TOKENS_CAP`** ✅ Resolved — raised 4096 → 8000 in `workers/ai-proxy/wrangler.toml` and redeployed. Goal-hierarchy decompose (maxTokens 6000) and the 7-day week plan no longer truncate ("Unbalanced JSON").
- **BUG-011 / BUG-013** ✅ Hardened (see Batch 4 above) — addressed with unit-level coverage (`goalInjection.test.ts`, `routeGuard.test.ts`) + prompt hardening rather than full Playwright e2e plumbing, which kept the cost proportionate to the (low) risk.
