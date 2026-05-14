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
| HexRadar redesign | Done | P1 | Removed labels/numbers, yesterday faint outline, green delta | `1930b10` | `src/components/gamification/HexRadar.tsx` | 100 | — |

## Pending / Backlog Epics

| Epic | Status | Priority | Description | Source |
|---|---|---|---|---|
| Architect punch-list — P0 | In Progress | P0 | TS errors (T1 done), indexes (T2 done), push token wiring, root ErrorBoundary | `docs/ARCHITECT_REVIEW_2026-05-13.md` |
| Architect punch-list — P1 | Planned | P1 | Drop zombie tables, split webStorage, Drizzle migrations, typed telemetry events | same |
| Architect punch-list — P2 | Planned | P2 | Onboarding v2 graduation, chat context memo, costLedger surface, doc reconciliation | same |
| ErrorBoundary at root | Backlog | P0 | CLAUDE.md claims it exists; none found in `app/` or `src/` | §P0-4 |
| Push-token end-to-end verify | Backlog | P0 | Wiring exists; device-side verification pending | §P0-2 |
| Drizzle migrations | Backlog | P1 | `drizzle.config.ts` points to non-existent dir | §P1-7 |
| Typed telemetry events | Backlog | P1 | Stringly-typed today; const map needed | §P1-8 |
| Zombie tables drop | Backlog | P1 | `contacts`, `habits`, `learning_resources`, `career_profiles` have no queries | §P1-5 |
| Onboarding v2 graduation | Backlog | P2 | Three flows active simultaneously | §P2-9 |
| Costs surfaced in admin | Backlog | P2 | Or decision to demote costLedger to eval-only | §P2-11 |
| Native Gmail / OAuth | Backlog | P2 | Currently web-only | Inferred |
| Multi-device sync | Backlog | P2 | Phase 2 ask in CLAUDE.md | Inferred |
