# Epics Database

> Each row is convertible to a Notion database entry. Status options: Backlog · Planned · In Progress · Blocked · Done.

## Active & Completed Epics

| Epic | Status | Priority | Description | Related Commits | Related Modules | Progress % | Risks |
|---|---|---|---|---|---|---|---|
| Project scaffolding | Done | P0 | Initial Expo + Drizzle + theme tokens + base UI | `4ca7668` `55c3a92` `4f701f9` `d449449` | `app/` `src/` foundation | 100 | None |
| Onboarding v1 (legacy) | Done | P0 | day1-vision / day1-career / day1-routine flow | `cfc13de` `5101a2a` | `app/(onboarding)/` | 100 | Three onboarding paths now active simultaneously — consolidation pending |
| Today screen + Routine Builder v1 | Done | P0 | Routine blocks, life-balance dashboard, day plan | `b1a8513` `c2a33eb` | `app/(tabs)/index.tsx` `src/ai/prompts/routine.ts` | 100 | — |
| Goal Intelligence Engine | Done | P0 | Hub, hierarchy, add sheet, goal detail | `a9b4b43` | `app/(tabs)/goals.tsx` `src/components/modules/goals/` | 95 | Goal-comments table added; surfacing pending |
| Health Intelligence Engine | Done | P0 | Calorie ring, food tracking, blood reports | `321855d` `12e21fa` `7269d87` `8820d48` `17eb72b` `d9f4ca7` | `app/(tabs)/health.tsx` `src/data/foods/` | 95 | Vitals re-prompt UX (resolved 2026-05-14) |
| Finance Intelligence Engine | Done | P0 | Goals, Gmail ingestion, parsers, categoriser, insights | `bd1ea75` `3d9513a` `713a6eb` `ffab3c9` | `src/finance/` `app/(tabs)/finance.tsx` | 90 | Web-only Gmail integration; native pending |
| Career & Upskill Engine | Done | P1 | Skill gap chart, learning path, strategist | `4b2b3ba` `713a6eb` `de156f2` | `app/(tabs)/career.tsx` | 85 | Persists in localStorage (Career tab), not SQLite |
| Polymath / Curiosity Engine | Done | P1 | Interests, weekly targets, exploration log | `532614a` | `app/(tabs)/explore.tsx` | 80 | Lightweight; deeper recommendations pending |
| Social Intelligence | Backlog | P2 | Contacts, nudges, reconnect cadence | (zombie tables in schema) | `src/db/schema.ts:contacts` | 10 | Zombie tables — punch-list §P1-5 says drop or commit |
| Gamification Engine | Done | P0 | XP, levels, streaks, badges, quests | `a735cdb` `f29d3c7` `bceae53` `9faf071` | `src/store/useGameStore.ts` `src/utils/gamification.ts` | 100 | — |
| Design System (Aurora Glass) | Done | P0 | Theme tokens, motion, density, glass surfaces | `2f6af72` `e3a9545` | `src/theme/` `src/components/ui/` | 100 | — |
| Gamification design-bundle import | Done | P0 | HexRadar, LevelRing, AvatarRing, QuestCard, StreakFlame | `313cf4a` `122512b` | `src/components/gamification/` | 100 | Conflict resolved by taking `lifeosv1` side |
| Notifications | Done | P1 | Daily routine, goal task, streak risk, social nudge | `0412198` | `src/hooks/useNotifications.ts` | 90 | Push token registration unverified end-to-end |
| Settings + Profile | Done | P1 | User profile sheet, prefs, theme toggle | `5fbd96f` `e9b656a` `9670a2b` | `app/settings.tsx` `app/(tabs)/profile.tsx` | 95 | — |
| Auth (email/password) | Done | P0 | Local SQLite-backed sign-up + sign-in | `517e5fa` | `app/(auth)/` `src/db/queries/users.ts` | 100 | — |
| Auth (Supabase + Google) | Done | P0 | Cloud-synced identity, Google OAuth web | `b329c5e` `b018c57` | `src/integrations/supabase/` `src/integrations/googleAuth/` | 100 | — |
| Voice Assistant | Done | P1 | WebSocket voice client, in-app sheet, e2e spec | `b018c57` | `src/ai/voiceClient.ts` `src/components/shared/VoiceAssistantSheet.tsx` | 80 | Native-only check; web parity pending |
| Onboarding v2 (Discovery Chat) | Done | P1 | Conversational profile capture, feature-flagged | `7fa58a7` `065f01a` `1dbe631` `c9eba9a` | `app/(onboarding)/discovery-*` | 90 | Three onboarding paths in production — graduation pending |
| Google Calendar integration | Done | P1 | PKCE OAuth, two-way block sync | `3d9513a` | `src/integrations/googleCalendar/` | 95 | — |
| Google Fit integration | Done | P1 | OAuth, 14-day pull, FitDashboard | `3d9513a` | `src/integrations/googleFit/` | 95 | — |
| Gmail integration (Finance) | Done | P1 | OAuth, fetcher, bank parsers (HDFC/ICICI/Axis) | `bd1ea75` `713a6eb` | `src/finance/gmail/` | 90 | Web-only; native bridge missing |
| PWA + Cloudflare Pages | Done | P0 | Manifest, static output, deploy pipeline | `dc37eec` `85b8d19` | `scripts/post-export-web.js` `public/` | 100 | `EXPO_PUBLIC_*` env vars not in git — deploy machine risk |
| Worker: AI Proxy | Done | P0 | Claude + Gemini, auth, rate limit | (workers/ai-proxy commits) | `workers/ai-proxy/` | 100 | — |
| Admin Portal v1 (flags + prompts) | Done | P0 | Phase 1 + 2 — flag toggles, prompt registry | `0681ed2` `e2e261d` | `admin/app/(authed)/flags` `prompts/` | 100 | — |
| Admin Portal — Telemetry | Done | P0 | Anonymous opt-in events, dashboards | `9fa52c0` | `admin/app/(authed)/telemetry/` | 100 | — |
| Admin Portal — Schema Failures | Done | P0 | Surface AI schema-parse failures | `ae4cb12` | `admin/app/(authed)/schema-failures/` | 100 | — |
| Admin Portal — Feedback + Push | Done | P1 | In-app feedback inbox, push broadcast | `e0f2bfc` | `admin/app/(authed)/feedback,push/` | 100 | Push token registration is the open gap |
| Admin Portal — Eval Reports | Done | P1 | CI eval pass rates surfaced | `e45d9d5` | `admin/app/(authed)/evals/` | 100 | — |
| Agentic Routine Builder + RAG | Done | P0 | propose → critique → commit, history retrieval | `c3e4852` `ed1a4f6` | `src/ai/agent/planner.ts` `src/ai/rag/` | 95 | Deterministic guards added 2026-05-14 |
| Model Router + Cost Ledger | Done | P1 | Per-task model selection, cost accumulators | `ed1a4f6` | `src/ai/modelRouter.ts` `src/ai/costLedger.ts` | 90 | Cost ledger not surfaced — punch-list §P2-11 |
| Evals harness | Done | P1 | 10 cases, grader, CI reports | `33291a0` `5cd1b50` | `evals/` | 100 | — |
| Web bundle parity | Done | P0 | `index.web.ts`, webStorage, import.meta neutraliser | `bd1ea75` `ee43bab` `dc37eec` | `src/db/webStorage.ts` `scripts/post-export-web.js` | 100 | — |
| Domain Priorities Editor | Done | P0 | User-editable priority order; feeds AI weighting | `7fb86f6` `a39261c` | `app/edit-priorities.tsx` | 100 | Shipped 2026-05-14 |
| Routine Time Bounds Hardening | Done | P0 | Honour wake/sleep, deterministic guards, picker fix | `cedaf2a` `3944ddd` `d2e4d27` | `src/ai/agent/planner.ts` `src/components/ui/WheelTimePicker.tsx` | 100 | Shipped 2026-05-14 |
| HexRadar redesign (v1) | Done | P1 | Removed labels/numbers, yesterday faint outline, green delta | `1930b10` | `src/components/gamification/HexRadar.tsx` | 100 | Superseded by Aurora v2 |
| Hex Radar Tap-through + Reflection Habits | Done | P1 | Dots route to matching tab; evening-reflect surfaces drop/keep/smaller habit proposal | `e00809c` | `app/(tabs)/index.tsx` `app/evening-reflect.tsx` `src/components/gamification/HexRadar.tsx` | 100 | Shipped 2026-05-14 |
| **Aurora Refined v2** | Done | P0 | Quieter glow + unified motion vocabulary + craft moments (long-press-complete, typed briefing reveal, mount stagger). 10 commits ending `4427722`. | `7144a02..4427722` | `src/theme/*` `src/components/gamification/*` `src/components/shared/*` `src/hooks/useTypedText.ts` `app/(tabs)/index.tsx` | 100 | Shipped 2026-05-14 evening. Glow audit clean. |
| React #185 loop fix + smoke seed hardening | Done | P0 | `yesterdaySnapshot` zustand selector now stable; smoke seed exercises the bug class | `0203eee` `912a5f5` | `app/(tabs)/index.tsx` `e2e/helpers.ts` | 100 | Shipped 2026-05-14 |
| OAuth callback whitelist | Done | P0 | Gmail/Calendar/Fit callbacks now allowed past auth guard | `70aaa07` | `app/_layout.tsx` | 100 | Shipped 2026-05-14 |
| analyseSkillGap sanitizer + UI error | Done | P1 | Coerce Gemini hallucinations; surface useAI error on Career screen | `b8ed72a` | `src/ai/functions.ts` `app/(tabs)/career.tsx` | 100 | Shipped 2026-05-14 |
| Supabase auth listener fix | Done | P0 | Only `SIGNED_OUT` resets local store (no more wiping legacy users on boot) | `3f9cd4b` | `app/_layout.tsx` | 100 | Shipped 2026-05-14 |
| Pre-commit verify gate | Done | P1 | `npm run smoke` + `verify` scripts + docs/TESTING.md gate | `91eb8eb` | `package.json` `docs/TESTING.md` | 100 | Shipped 2026-05-14 |
| scheduleSync extraction + tests | Done | P1 | SSOT mirroring centralised in `src/utils/scheduleSync.ts` with 6 invariant tests | `a529ba1` | `src/utils/scheduleSync.ts` `src/utils/__tests__/scheduleSync.test.ts` | 100 | Shipped 2026-05-14 |

## Pending / Backlog Epics

| Epic | Status | Priority | Description | Source |
|---|---|---|---|---|
| Architect punch-list — P0 | Done (except push verify) | P0 | TS errors ✅, indexes ✅, ErrorBoundary ✅, push verify ⏳ (needs EAS) | `docs/ARCHITECT_REVIEW_2026-05-13.md` |
| Architect punch-list — P1 | Mostly Done | P1 | Zombie tables ✅, webStorage split ✅, Drizzle baseline ✅, typed telemetry ✅; migrator swap ⏳ | same |
| Architect punch-list — P2 | Partial | P2 | Chat memo ✅, doc reconcile ✅; onboarding v2 graduation ⏳, costLedger decision ⏳ | same |
| ErrorBoundary at root | Done | P0 | Live `c63b83a` 2026-05-14; emits `EVENTS.uiCrash` | §P0-4 |
| Push-token end-to-end verify | Blocked | P0 | Wiring exists; needs EAS native build to validate | §P0-2 |
| Drizzle baseline migration | Done | P1 | `0000_classy_doctor_spectrum.sql` with `IF NOT EXISTS` clauses | §P1-7 part 1 |
| Drizzle migrator swap | Backlog | P1 | Needs Metro `.sql` resolver | §P1-7 part 2 |
| Typed telemetry events | Done | P1 | `EVENTS` map + worker allowlist sync `c613024` 2026-05-14 | §P1-8 |
| Zombie tables drop | Done | P1 | 6 tables dropped `c613024` 2026-05-14 | §P1-5 |
| webStorage per-entity split | Done | P1 | 695-line file → 12 per-entity modules + 2 helpers `f004e13` 2026-05-14 | §P1-6 |
| Schedule single source of truth | Done | P0 | User row canonical; both surfaces mirror `c63b83a` | Tech Debt #17 |
| Planner agent unit tests | Done | P0 | 5 tests cover wake/sleep bounds + module coercion `c63b83a` | Tech Debt #18 |
| Chat profile-context memo | Done | P2 | Cached per session `24edc46` 2026-05-14 | §P2-10 |
| Doc reconciliation | Mostly Done | P2 | MASTER_BRIEF ✅, AI_FUNCTIONS ✅; parent CLAUDE.md ref still open (auto-mode block) | §P2-12 |
| Onboarding v2 graduation | Backlog | P2 | Three flows active simultaneously — product call pending | §P2-9 |
| Costs surfaced in admin | Backlog | P2 | Or decision to demote costLedger to eval-only | §P2-11 |
| Native Gmail / OAuth | Backlog | P2 | Currently web-only | Inferred |
| Multi-device sync | Backlog | P2 | Phase 2 ask in CLAUDE.md | Inferred |
