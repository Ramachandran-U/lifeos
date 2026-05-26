# Timeline & Sprint Reconstruction

> Phases reconstructed from git history. Dates from commit timestamps. Each phase = a coherent body of work delivered together.

## Phase 0 · Scaffolding (Initial commits, pre-Feb 2026)

**Goals:** stand up the project skeleton — Expo Router, theme tokens, design system primitives, database schema, AI client, mock mode, navigation shell.

**Major commits (P1-01 → P1-14):**

| Tag | Title | Commit |
|---|---|---|
| P1-01 | Project initialisation | `4ca7668` |
| P1-02 | Design system — theme tokens, base UI components | `55c3a92` |
| P1-03 | Database schema and query layer | `4f701f9` |
| P1-04 | AI client, prompts, mock system, useAI hook | `d449449` |
| P1-05 | Navigation shell with auth, onboarding, tab routes | `5101a2a` |
| P1-06 | Day 1 onboarding — vision, career, routine screens | `cfc13de` |
| P1-07 | Today screen with routine blocks and life balance dashboard | `b1a8513` |
| P1-08 | Goal Intelligence Engine — hub, hierarchy, add sheet | `a9b4b43` |
| P1-09 | Health Intelligence Engine — calorie ring, food tracking, blood reports | `321855d` |
| P1-10 | Career & Upskill Engine — skill gap chart, learning path | `4b2b3ba` |
| P1-11 | Gamification Engine — domain scores, streaks, badges, XP | `a735cdb` |
| P1-12 | Notifications system | `0412198` |
| P1-13 | Settings and profile screen | `5fbd96f` |
| P1-14 | QA pass — web compatibility and env fixes | `dcb5e07` |

**Outcomes:** running app on iOS + Android + web; all six engines have a basic surface; foundation for everything that follows.

## Phase 1 · Engine deepening + finance pipeline

**Goals:** elevate two engines from skeleton to functional product — Health (food DB, blood reports) and Finance (Gmail ingestion, parsers, categoriser, insights).

**Major commits:**

| Date | Title | Commit |
|---|---|---|
| — | Finance intelligence pipeline + web DB parity | `bd1ea75` |
| — | Light/dark theme toggle and profile sidebar | `e9b656a` |
| — | Hexagonal life balance radar (initial) | `c2a33eb` |
| — | Career path save/load/clear | `de156f2` |
| — | Gamification + UI overhaul (Rewards tab, hex radar, level system) | `f29d3c7` |
| — | Polymath / Explore tab | `532614a` |
| — | Personalise AI mocks with actual user input | `fb35ef4` |
| — | Replace `nanoid` with `expo-crypto` ID helper | `0b1a7b7` |

**Outcomes:** every engine has a real surface; gamification is a first-class layer; web parity for the DB layer (`webStorage.ts` introduced).

## Phase 2 · Integration sprint (2026-04-21)

**Goals:** ship the integrations users actually want — Google Calendar, Google Fit, Sign in with Google, Discovery import.

**Major commits (single date, 2026-04-21):**

| Title | Commit |
|---|---|
| Elite Career Strategist + finance parser hardening + E2E scaffold | `713a6eb` |
| Google Calendar + Google Fit integrations, INR finance, UPI parser fixes | `3d9513a` |
| Sign in with Google (web) | `b329c5e` |
| Aurora Glass redesign + welcome-intent + evening reflect | `2f6af72` |
| Discovery Import — paste ChatGPT/Claude profile to seed LifeOS | `1dbe631` |

**Outcomes:** the app now connects to the user's real life — calendar, fitness, finance. Visual rebrand to Aurora Glass. Welcome-intent becomes the canonical entry.

## Phase 3 · Platform sprint (2026-04-27 → 2026-04-28)

**Goals:** voice, auth, worker proxy, admin portal v1, evals, docs.

**Major commits:**

| Date | Title | Commit |
|---|---|---|
| 2026-04-27 | Voice assistant + Supabase auth + Cloudflare ai-proxy worker | `b018c57` |
| 2026-04-27 | 5-tab nav with Life hub + Profile screen with usage analytics | `9670a2b` |
| 2026-04-28 | Phase 1+2 admin portal — flags and prompt registry | `0681ed2` |
| 2026-04-28 | Worker admin prompts + flags routes, prompts read endpoint | `e2e261d` |
| 2026-04-28 | Live flag + prompt fetch from Worker with bundled fallback | `c26f1de` |
| 2026-04-28 | Ask LifeOS chatbot v1 — read-only Q&A from Profile sidebar | `ddc6ce9` |
| 2026-04-28 | Discovery intro screen with copyable prompt | `065f01a` |
| 2026-04-28 | AI cost ledger, model router, tracing, agent + RAG scaffolds | `ed1a4f6` |
| 2026-04-28 | how-it-works + terms-privacy screens, evals scaffold, repo readme | `5cd1b50` |
| 2026-04-28 | Pre-production checklist, admin portal plan, AI test plan | `8e183e9` |
| 2026-04-28 | Seed extracted profile into SQLite on confirm | `c9eba9a` |
| 2026-04-28 | PWA shell — manifest, iOS standalone meta tags, static output | `dc37eec` |

**Outcomes:** voice client (WebSocket) + Supabase identity + Worker proxy go live together. Admin portal phases 1+2 ship. Evals scaffold introduced. Documentation pass.

## Phase 4 · Web deploy + admin maturation (2026-05-07 → 2026-05-12)

**Goals:** ship to a real URL, expand admin tooling, harden CI evals, build conversational onboarding.

**Major commits:**

| Date | Title | Commit |
|---|---|---|
| 2026-05-07 | Deploy PWA to Cloudflare Pages with Supabase Google OAuth | `85b8d19` |
| 2026-05-12 | Reactive theme, gamification fixes, server-side OAuth, admin hardening | `f32df25` |
| 2026-05-12 | Phase 3 telemetry + finance categorizer batching + persisted flag/prompt caches | `9fa52c0` |
| 2026-05-12 | Phase 4a — schema failure feed | `ae4cb12` |
| 2026-05-12 | Phase 5 — in-app feedback inbox + push broadcast | `e0f2bfc` |
| 2026-05-12 | Unblock eval harness — Node-side stubs for RN modules | `33291a0` |
| 2026-05-12 | Routine Builder becomes context-aware (agentic + RAG wiring) | `c3e4852` |
| 2026-05-12 | Distilled local merchant classifier (tier 2.5) | `ffab3c9` |
| 2026-05-12 | Phase 4b — surface CI eval pass rates | `e45d9d5` |
| 2026-05-12 | v2 conversational onboarding + profile-aware AI suite | `7fa58a7` |

**Outcomes:** Web app live at `lifeos-6r5-eqa.pages.dev`. Admin portal has telemetry, schema failures, feedback, push, eval reports. Routine Builder upgraded from single-shot to agent.

## Phase 5 · Hardening + design-bundle merge + Codex collaboration (2026-05-13)

**Goals:** import the design-bundle gamification components, work through architect-review punch-list with Codex, fix conflicts.

**Major commits:**

| Title | Commit |
|---|---|
| Worker CORS allowlist fix | `04c5284` |
| Worker — keep both Pages URLs in CORS | `6d8921e` |
| Neutralize `import.meta.env` in dist bundle | `ee43bab` |
| first_blueprint badge retroactive + real domain delta/history | `bceae53` |
| AchievementToast auto-dismiss after 4s | `696a0fa` |
| Food DB — IFCT (528 items), INDB (~1,000 recipes), search-as-you-type | `12e21fa` `7269d87` `8820d48` |
| Barcode lookup via Open Food Facts + AI upgrade | `17eb72b` |
| Web camera barcode scanning | `d9f4ca7` |
| Architect-review punch-list (design system, RewardOrchestrator, data residency, e2e smoke) | `e3a9545` |
| Design-bundle gamification merge | `313cf4a` → `d5cbd08` (PR #10) |
| Codex T1 — 6 TS errors fixed | `e635841` |
| Codex T2 — SQLite indexes | `98c5d25` |
| Remove duplicate XPBar.tsx (case-collision) | `35fe008` |
| Remove duplicate `xpForLevel` block | `9faf071` |

**Outcomes:** design-bundle components merged in (lifeosv1 side won all conflicts). T1 + T2 from Codex shipped. Architect review punch-list authored. Multiple correctness fixes (badges, toast, web bundle).

## Phase 6 · UX bug fix sprint (2026-05-14 morning)

**Goals:** fix four user-reported UX bugs and ship a priorities editor.

**Major commits:**

| Title | Commit |
|---|---|
| 3 UX bugs — OAuth return path, negative XP, HexRadar cleanup | `1930b10` |
| User-editable domain priorities feed the routine generator | `7fb86f6` |
| Allow `/edit-priorities` for onboarded users (router fix) | `a39261c` |
| Honor user wake/sleep times + add schedule validation | `cedaf2a` |
| Sanitize AI module values + friendlier UI error | `3944ddd` |
| WheelTimePicker — commit selection on drag-end + tap-to-select | `d2e4d27` |

**Outcomes:** real bug discovered behind the routine-time bug — the WheelTimePicker on web wasn't propagating selection. Priorities editor goes live. Routine planner now has both prompt-level and deterministic guards on wake/sleep bounds.

## Phase 7 · Architect punch-list solo sweep (2026-05-14 afternoon)

**Goals:** burn down the architect-review punch-list with Codex out for the week. Solo run by Claude.

**Major commits:**

| Title | Commit |
|---|---|
| Root `ErrorBoundary` + schedule SSOT + 5 planner tests + Notion export | `c63b83a` |
| Drop zombie tables (contacts, contact_interactions, habits, learning_resources, skill_gaps, career_profiles) + Drizzle baseline migration + typed `EVENTS` map + worker allowlist sync | `c613024` |
| Chat profile-context memo + MASTER_BRIEF + AI_FUNCTIONS reconcile + smoke nav scroll/click fix | `24edc46` |
| `webStorage.ts` 695-line split into 12 per-entity modules + 2 shared helpers | `f004e13` |

**Outcomes (architect-review items closed):**
- §P0-4 ErrorBoundary
- §P1-5 zombie tables
- §P1-6 webStorage split
- §P1-7 Drizzle baseline (migrator swap still pending)
- §P1-8 typed telemetry events (also fixed prod silent-drop bug: 11 of 18 events were 400'd at the worker)
- §P2-10 chat context memo
- §P2-12 doc reconciliation (parent CLAUDE.md still has stale `expo-health` ref — blocked by auto-mode classifier)
- Tech Debt #17 schedule SSOT
- Tech Debt #18 planner unit tests
- Discovered defects — smoke nav fix

**Remaining open:** §P0-2 push verify (needs EAS), §P1-7 part 2 migrator swap (needs Metro plugin), §P2-9 onboarding v2 graduation (product call), §P2-11 cost ledger (product call).

## Phase 8 · Aurora Refined v2 + post-merge stabilisation (2026-05-14 evening)

**Goals:** redesign pass to quiet ambient glow and unify motion vocabulary; fix the bugs the redesign + earlier session work surfaced.

**Aurora v2 design pass (10 commits, ending `4427722`):**

| # | Title | Commit |
|---|---|---|
| 1 | Theme — drop primary halo on z3 elevation, extend radii scale | `7144a02` |
| 2 | Motion — EASING tokens + MOTION_BUDGET constants | `0db66f8` |
| 3 | UI — quiet GlassCard accent, drop XpBar / AvatarRing glow | `0f87111` |
| 4 | HexRadar — thinner stroke, flat dots, three grid rings | `1ef0d2e` |
| 5 | Gamification — drop glow from streak rows, flames, badges | `7792085` |
| 6 | RoutineBlock — drop active-state glow shadows | `85f6faf` |
| 7 | RoutineBlock — long-press-to-complete with press-progress arc | `637bd6d` |
| 8 | Today — mount stagger + scroll-driven sticky header | `c75d550` |
| 9 | Briefing — typed reveal for AI insight body | `27dc1cc` |
| 10 | Sheets — unify enter/exit motion vocabulary | `4427722` |

**Post-merge stabilisation:**

| Title | Commit |
|---|---|
| Supabase auth listener — only react to SIGNED_OUT (legacy users were being wiped on boot) | `3f9cd4b` |
| `npm run smoke` + `smoke:local` + `verify` scripts + cross-env dep + docs/TESTING.md gate | `91eb8eb` |
| `.gitignore` covers smoke-output/ and playwright-report/ | `587e716` |
| Hex radar tap-through + reflection-driven habit acceptance | `e00809c` |
| React #185 infinite loop — yesterdaySnapshot zustand selector now stable via useMemo | `0203eee` |
| OAuth callback whitelist — Gmail/Calendar/Fit allowed past auth guard | `70aaa07` |
| analyseSkillGap sanitizer + UI error surfacing | `b8ed72a` |
| Smoke seed gets 2-day domain history; selector-loop bug class now catchable | `912a5f5` |
| scheduleSync.ts helpers extracted + 6 invariant tests | `a529ba1` |
| Eval reports timestamp refresh | `ed95cbb` |

**Outcomes:**
- PRs #16 (Aurora v2 + fixes), #18 (smoke seed + scheduleSync tests), #22 (eval refresh) **all merged** to `lifeosv1`.
- 6 new tech-debt entries resolved (zustand selectors, OAuth whitelist, supabase listener, analyseSkillGap, Aurora glow audit, schedule SSOT tested).
- Smoke now catches the class of bug that escaped earlier (selector returning new object reference → infinite loop).
- Unit test count 335 → 356 (+5 planner, +5 sanitizer, +6 scheduleSync, +5 misc).
- `npm run verify` is the documented pre-commit gate.

## Velocity Heatmap

| Week starting | Approx commits | Theme |
|---|---|---|
| 2026-04-21 | 6 | Integrations + Aurora redesign |
| 2026-04-27 | 12 | Voice + Supabase + worker + admin v1 + evals scaffold |
| 2026-04-28 | 6 | PWA shell + Cloudflare prep |
| 2026-05-07 | 1 | Production deploy |
| 2026-05-12 | 11 | Admin portal phases 3–5 + agentic AI + onboarding v2 |
| 2026-05-13 | 14 | Architect punch-list + design merge + Codex T1/T2 + correctness fixes |
| 2026-05-14 | ~14 | UX bug fixes (morning) + architect punch-list solo sweep (afternoon): ErrorBoundary, schedule SSOT, 5 planner tests, drop 6 zombie tables, Drizzle baseline, typed `EVENTS` map + worker allowlist sync, chat memo, doc reconcile, smoke nav fix, webStorage 695-line split |

## Recurring Incident Themes

| Theme | Examples |
|---|---|
| Web/native parity gaps | `webStorage.ts` introduction, `index.web.ts` proxy, `import.meta.env` neutralizer, WheelTimePicker drag fix |
| AI schema fragility | `extractJson`, schema-failure feed, module coercion |
| Onboarding state drift | Retroactive `first_blueprint` award, three-flow coexistence |
| OAuth UX | Return-path stashing, CORS allowlist fixes |
| Visual / design correctness | Aurora redesign, HexRadar cleanup, AchievementToast dismiss |

## Velocity Trend

- Steady scaffolding pace through P1-* tasks (~one commit/feature each).
- Two big-bang dates: 2026-04-21 (integrations) and 2026-04-28 (platform). Each landed ~6 features in a day.
- Recent shift (post 2026-05-12): smaller, more focused commits — bug fixes and architect-review punch-list items rather than green-field features.
- Net direction: from "build the app" to "make the app reliable".
