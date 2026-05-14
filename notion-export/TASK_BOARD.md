# Task Board

> Kanban-style — paste into Notion as separate toggle/section blocks. Sourced from the architect-review punch-list, recent commits, and TODOs found in code.

## Backlog

- [ ] **Push token end-to-end verification** — confirm a device row in worker's `expo_push_tokens` after one app open (§P0-2)
- [ ] **Drop zombie tables** `contacts`, `contact_interactions`, `habits`, `learning_resources`, `career_profiles` (§P1-5)
- [ ] **Split `src/db/webStorage.ts`** (695 lines) into per-entity modules (§P1-6)
- [ ] **Generate + commit Drizzle migrations** — `src/db/migrations/` is referenced but doesn't exist (§P1-7)
- [ ] **Type telemetry event names** — promote to `EVENTS` const map; replace all `track('literal')` (§P1-8)
- [ ] **Plan onboarding v2 graduation** — pick rollout % and retire day1-* + `discoverySeed` (§P2-9)
- [ ] **Memoize `buildProfileContext`** in chat send loop (§P2-10)
- [ ] **Decide on cost ledger** — surface in admin OR demote to eval-only (§P2-11)
- [ ] **Reconcile docs** — `MASTER_BRIEF.md` differentiator #3, `CLAUDE.md` `expo-health` mention, `AI_FUNCTIONS.md` LLM_PROVIDER note (§P2-12)
- [ ] **Native Gmail OAuth** — port web-only finance integration to native
- [ ] **Offline web support** — service worker / PWA caching
- [ ] **Multi-device sync** — Phase 2 commitment from CLAUDE.md
- [ ] **Hex radar tap-through** — clicking a domain opens its module
- [ ] **Voice on web** — parity with native voice assistant
- [ ] **Native heightCm migration** — schema column exists; native UI to set/edit pending

## Planned

- [ ] **Root `ErrorBoundary`** — class component wrapping `<Stack>` in `app/_layout.tsx`; log via `track('ui_crash', ...)` (§P0-4)
- [ ] **Gate `evening-reflect` tomorrow-generator with same wake/sleep bounds** that day1-routine now enforces
- [ ] **Apply schedule sanitiser to `what-lifeos-knows.tsx`** edits so they update both `userProfile` AND user row's wake/sleep/work columns
- [ ] **Add `EXPO_PUBLIC_*` env vars to deploy docs** — `EXPO_PUBLIC_AI_PROXY_URL`, `EXPO_PUBLIC_SUPABASE_*` (gitignored today)
- [ ] **Smoke test fixes** — `import.meta` + Privacy-residency selector timeout (Discovered defects, doc-tracked)
- [ ] **Goal comments surfacing** — table exists, UI pending
- [ ] **Native push registration verification + retries**

## In Progress

- [ ] **Architect punch-list working session** — T1 (TS errors) ✅ merged, T2 (indexes) ✅ merged, T3 (push) closed-as-no-op, remainder open

## Blocked

- [ ] **E2E smoke green-pass** — `npx playwright test e2e/smoke.spec.ts` fails after Expo web is running due to `SyntaxError: Cannot use 'import.meta' outside a module` (logged as Discovered defect in architect review)
- [ ] **Push delivery validation** — requires authenticated native build + Supabase + worker access not available in CI

## Done (Recent)

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
