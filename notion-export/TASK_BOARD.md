# Task Board

> Kanban-style — paste into Notion as separate toggle/section blocks. Sourced from the architect-review punch-list, recent commits, and TODOs found in code.

## Backlog

- [ ] **Push token end-to-end verification** — confirm a device row in worker's `expo_push_tokens` after one app open (§P0-2). Needs EAS native build.
- [ ] **Swap `initDatabase` to Drizzle migrator** — baseline migration committed (§P1-7 part 2). Needs Metro `.sql` resolver setup.
- [ ] **Plan onboarding v2 graduation** — pick rollout % and retire day1-* + `discoverySeed` (§P2-9). Product decision pending.
- [ ] **Decide on cost ledger** — surface in admin OR demote to eval-only (§P2-11). Product decision pending.
- [ ] **Native Gmail / Calendar / Fit OAuth** — port web-only integrations to native (Expo SecureStore for tokens)
- [ ] **Offline web support** — service worker / PWA caching
- [ ] **Multi-device sync** — Phase 2 commitment from CLAUDE.md
- [ ] **Hex radar tap-through** — clicking a domain opens its module
- [ ] **Voice on web** — parity with native voice assistant
- [ ] **Native heightCm migration** — schema column exists; native UI to set/edit pending
- [ ] **CI deploy** — GitHub Action with `EXPO_PUBLIC_*` + `CLOUDFLARE_API_TOKEN` secrets (Tech Debt #12)
- [ ] **Parent `CLAUDE.md` `expo-health` reference removal** — outside repo, blocked by auto-mode classifier; manual edit needed

## Planned

- [ ] **Gate `evening-reflect` tomorrow-generator with same wake/sleep bounds** that day1-routine now enforces
- [ ] **Add `EXPO_PUBLIC_*` env vars to deploy docs** — `EXPO_PUBLIC_AI_PROXY_URL`, `EXPO_PUBLIC_SUPABASE_*` (gitignored today)
- [ ] **Goal comments surfacing** — table exists, UI pending
- [ ] **Native push registration verification + retries**
- [ ] **Tokens to Expo SecureStore on native** — OAuth tokens currently in plaintext localStorage (Tech Debt #14)
- [ ] **CI deploy** — GitHub Action with `EXPO_PUBLIC_*` + `CLOUDFLARE_API_TOKEN` secrets (Tech Debt #12)
- [ ] **Set `ANTHROPIC_API_KEY` on Worker** — redundancy against Gemini outage; Gemini works today

## In Progress

- [ ] _Nothing in flight._ Next session pick: CI deploy via GitHub Action, OR `BloodReportCard.tsx:20` minor tokenisation, OR a product call on §P2-9 / §P2-11.

## Blocked

- [ ] **Push delivery validation** (§P0-2) — requires an authenticated EAS native build; verification environment not codeable from desktop
- [ ] **Migrator swap** (§P1-7 part 2) — requires Metro `.sql` resolver wiring + a real native device to test against

## Done (Recent)

- [x] Eval reports refreshed; PR #22 merged (`ed95cbb`, 2026-05-14)
- [x] `scheduleSync.ts` helpers extracted from inline callbacks + 6 Jest tests (`a529ba1`, 2026-05-14)
- [x] Smoke seed gets 2-day domain history; React #185 class now catchable (`912a5f5`, 2026-05-14)
- [x] `analyseSkillGap` sanitizer + UI error surfacing on Career screen (`b8ed72a`, 2026-05-14)
- [x] OAuth callback whitelist — Gmail/Calendar/Fit callback routes allowed past auth guard (`70aaa07`, 2026-05-14)
- [x] React #185 infinite loop fix — `yesterdaySnapshot` zustand selector now stable via useMemo over entries (`0203eee`, 2026-05-14)
- [x] **Aurora Refined v2** — 10-commit design pass: theme z3 halo drop + radii scale, EASING tokens + MOTION_BUDGET, GlassCard quieter accent + XpBar/AvatarRing glow drop, HexRadar thinner stroke + flat dots + 3 grid rings, streak/flame/badge glow drop, RoutineBlock active-state glow drop, RoutineBlock long-press-to-complete with press-progress arc, Today mount stagger + scroll-driven sticky header, DailyBriefing typed reveal, unified sheets motion (10 commits ending `4427722`, 2026-05-14)
- [x] Hex radar tap-through (dots → matching tab) + reflection-driven habit acceptance (`e00809c`, 2026-05-14)
- [x] Supabase auth listener fixed — INITIAL_SESSION with null no longer wipes local user store; only SIGNED_OUT triggers reset (`3f9cd4b`, 2026-05-14)
- [x] `npm run smoke`, `smoke:local`, `verify` scripts + cross-env dep + `docs/TESTING.md` pre-commit gate (`91eb8eb`, 2026-05-14)
- [x] `.gitignore` covers `smoke-output/` + `playwright-report/` (`587e716`, 2026-05-14)
- [x] Split `src/db/webStorage.ts` (695 lines) into 12 per-entity modules + 2 shared helpers (§P1-6, `f004e13`, 2026-05-14)
- [x] Smoke nav test now waits + scrolls before clicking; fixes Privacy & data residency timeout (`24edc46`, 2026-05-14)
- [x] Doc reconciliation — `MASTER_BRIEF.md` differentiator #3 + `AI_FUNCTIONS.md` LLM_PROVIDER note (§P2-12, `24edc46`)
- [x] Chat profile-context memo per session (§P2-10, `24edc46`)
- [x] Drop zombie tables — `contacts`, `contact_interactions`, `habits`, `learning_resources`, `skill_gaps`, `career_profiles` (§P1-5, `c613024`, 2026-05-14)
- [x] Drizzle baseline migration generated + post-processed to be `IF NOT EXISTS` idempotent (§P1-7 part 1, `c613024`)
- [x] Typed telemetry events — `EVENTS` const map, `track()` is `EventName`, worker allowlist synced; previously 11 of 18 events silently 400'd in prod (§P1-8, `c613024`)
- [x] Root `ErrorBoundary` wrapping `<Stack>`; logs `EVENTS.uiCrash` (§P0-4, `c63b83a`, 2026-05-14)
- [x] Schedule single-source-of-truth — `what-lifeos-knows` + `day1-routine` both mirror to both stores (Tech Debt #17, `c63b83a`)
- [x] 5 `planRoutineAgent` unit tests — wake-bound filter, sleep-bound filter, module coercion, critique override, empty-plan fallback (Tech Debt #18, `c63b83a`)
- [x] Notion-import docs — 10 .md files reconstructing the project as an operational system (`c63b83a`)
- [x] Fix WheelTimePicker so web mouse-wheel/drag actually commits the selection (`d2e4d27`, 2026-05-14)
- [x] Sanitize AI module values to prevent Zod parse crash + friendly UI error (`3944ddd`, 2026-05-14)
- [x] Honour wake/sleep — seed pickers from saved user row + hard prompt + deterministic guard (`cedaf2a`, 2026-05-14)
- [x] Route `/edit-priorities` past the onboarded-user allowlist (`a39261c`, 2026-05-14)
- [x] User-editable domain priorities feeding routine weighting (`7fb86f6`, 2026-05-14)
- [x] OAuth callbacks return to the originating page (`1930b10`, 2026-05-14)
- [x] Daily XP no longer shows -100 for new users (`1930b10`)
- [x] HexRadar cleanup — drop labels + numbers, add yesterday outline + green delta (`1930b10`)
- [x] Remove duplicate `xpForLevel` block in gamification utils (`9faf071`, 2026-05-13)
- [x] Remove duplicate `XPBar.tsx` (case-collision) (`35fe008`, 2026-05-13)
- [x] T2: SQLite indexes on hot-path columns (`98c5d25`, 2026-05-13)
- [x] T1: 6 pre-existing TS errors fixed (`e635841`, 2026-05-13)
- [x] Design-bundle gamification merge (HexRadar, QuestCard, LevelRing, etc.) (`313cf4a` → `d5cbd08`, 2026-05-13)
- [x] Architect review punch-list authored (`docs/ARCHITECT_REVIEW_2026-05-13.md`)
- [x] Web camera barcode scanning via `BarcodeDetector` (`d9f4ca7`, 2026-05-13)
- [x] Food DB ~1,600 items (IFCT + INDB) (`8820d48`, 2026-05-13)
- [x] AchievementToast auto-dismiss (`696a0fa`, 2026-05-13)
- [x] First-blueprint badge retroactive award + real domain delta history (`bceae53`)
- [x] Web bundle hardening — `import.meta` neutraliser (`ee43bab`, 2026-05-13)
- [x] Worker CORS allowlist fixes (`6d8921e`, `04c5284`, 2026-05-12 → 13)
- [x] v2 conversational onboarding (`7fa58a7`, 2026-05-12)
- [x] Routine Builder becomes agentic + RAG (`c3e4852`, 2026-05-12)
- [x] Distilled local merchant classifier (`ffab3c9`, 2026-05-12)
- [x] Admin portal phases 3, 4a, 4b, 5 (`9fa52c0` → `e45d9d5`, 2026-05-12)
- [x] Cloudflare Pages PWA + Supabase Google OAuth (`85b8d19`, `dc37eec`, 2026-04-28)
- [x] Pre-production checklist, admin plan, AI test plan (`8e183e9`, 2026-04-28)
- [x] Voice assistant + Supabase auth + ai-proxy worker (`b018c57`, 2026-04-27)
- [x] Aurora Glass redesign + welcome-intent + evening reflect (`2f6af72`, 2026-04-21)
- [x] Sign in with Google (web) (`b329c5e`, 2026-04-21)
- [x] Google Calendar + Google Fit (`3d9513a`, 2026-04-21)
- [x] Elite Career Strategist + finance parser hardening + E2E scaffold (`713a6eb`, 2026-04-21)
- [x] Polymath / Explore tab (`532614a`)
- [x] Gamification + UI overhaul — Rewards tab, HexRadar, level system (`f29d3c7`)
- [x] Finance intelligence pipeline + web DB parity (`bd1ea75`)
- [x] Email/password auth with local storage (`517e5fa`)
- [x] All P1-01 through P1-14 milestone tasks (project foundation)
