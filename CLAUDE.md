# LifeOS — Claude Code Master Context

> Read this file at the start of every session. It is the single source of truth for architecture, conventions, and constraints.
>
> **This file is mirrored at `lifeos/CLAUDE.md` (version-controlled). Keep both copies identical.** A second clone of this repo lives at `lifeos-cognition/` on its own branch — only edit docs in the primary `lifeos/` tree unless told otherwise.

---

## Working in parallel — worktree protocol (READ FIRST)

This repo is worked on by **several concurrent sessions** (local **and** cloud). A `git switch` or an edit inside a *shared* checkout rewrites files under whoever else is in that folder — the #1 cause of "files changed under me" collisions and wasted/duplicated work. So: **every session works in its OWN git worktree; the shared root checkout is read-only reference.**

- **Golden rule:** never edit / commit / `git switch` / build in the shared root checkout (`C:\personal\Project X\lifeos`). Leave it on `lifeosv1`.
- **Session-start self-check (before your first edit):** run `git rev-parse --show-toplevel`. If it ends in `\lifeos` (the shared root), STOP and move into a dedicated worktree first — do not edit there.
- **Start a new worktree** (do this when asked to "start a new worktree", or before your first edit if you don't have one):
  1. `git -C "C:/personal/Project X/lifeos" fetch origin`
  2. `git -C "C:/personal/Project X/lifeos" worktree add "../lifeos-<feature>" -b <branch> origin/lifeosv1` — unique `<feature>` folder + `<branch>` name, based off the latest `origin/lifeosv1`.
  3. `cd "C:/personal/Project X/lifeos-<feature>"` → `npm ci` → copy `.env` from the shared root (`cp "../lifeos/.env" .env`).
  4. Verify isolation: `git rev-parse --show-toplevel` ends in `lifeos-<feature>` and `git branch --show-current` is `<branch>`. Work ONLY in this folder for the rest of the session.
- **Stay in your lane:** never `git switch <branch>` in a folder another session uses; build `dist/` only in your own worktree (never rebuild the shared root's `dist/`); keep edits to shared **hub files** small + additive — `src/store/useUserStore.ts`, `app/_layout.tsx`, `src/store/useFlagStore.ts`, `src/utils/telemetry.ts`, `src/db/schema.ts`, `src/db/index.ts`; rebase onto `origin/lifeosv1` before opening a PR; commit + push your branch early so work is never trapped only in a working tree. Avoid repo-wide git ops (`git stash`, `git gc`, force-push to shared branches) while other sessions are active.

---

## What We're Building

**LifeOS** is a bold, expressive AI-first life management app. It runs on iOS, Android, **and the web** from one React Native + Expo codebase (the web build ships to Cloudflare Pages). It is not a productivity app. It is a **Digital Life Architect** — a system that understands every dimension of a person's life and synthesises them into a liveable daily structure.

The app answers one question continuously: **"What should I do next to improve my life?"**

It does this through 6 specialised engines feeding into 1 master planner:
1. Goal Intelligence Engine
2. Health Intelligence Engine
3. Financial Goal Engine
4. Career & Upskill Engine
5. Social Life Intelligence
6. Curiosity & Polymath Engine (Explore)
→ All feed into: **The Routine Builder (Master Planner)**

The differentiating layer sits *above* the engines: a cognitive layer that notices when a chosen domain has gone quiet, replans the remaining day when priorities change (diff preview + undo), and records every state change to an event-sourced mutation log. Much of this is live behind feature flags today.

Product spec: `docs/PRODUCT_TECHNICAL_DOC.md` (marketing distillation in `docs/MASTER_BRIEF.md`). Active backlog & deferred work: `docs/PARKED_ITEMS.md`. Program sequencing: `roadmap/` and `implementation-plan/`. Deeper architecture lives in `docs/`.

---

## Project Structure

> Directory-level map — accurate as of June 2026. Sub-files change often; trust the tree on disk over any file list here. `__tests__/` folders are co-located throughout and omitted below.

```
lifeos/
├── app/                        # Expo Router file-based routing (iOS / Android / web)
│   ├── (auth)/                 # welcome, sign-in, sign-up + _layout
│   ├── (onboarding)/           # Progressive onboarding + discovery flow
│   │   ├── day1-vision / day1-career / day1-routine
│   │   ├── day3-health / day7-finance / day7-social / day14-polymath
│   │   └── discovery-intro / discovery-paste / discovery-chat / discovery-confirm
│   ├── (tabs)/                 # index (Today), goals, health, finance, career,
│   │   │                       #   social, explore, life, profile, rewards
│   ├── *-callback.tsx          # google-auth / gmail / calendar / fit / contacts / youtube
│   ├── chat / feedback / settings / annual-review / evening-reflect / rabbit-hole
│   ├── finance-* / expedition-detail / monthly-insight / edit-priorities / activity
│   ├── contact/[id] / notifications-settings / welcome-intent / what-lifeos-knows
│   ├── what-lifeos-remembers / data-residency / how-it-works / terms-privacy
│   └── _layout.tsx / +html.tsx
├── src/
│   ├── ai/
│   │   ├── client.ts           # The AI client — callAI / callAIRaw → proxy (see below)
│   │   ├── modelRouter.ts      # Per-task model tier selection (pickModel)
│   │   ├── functions.ts        # Single-shot AI functions (mock-gated)
│   │   ├── agent/              # Tool-use agent loop
│   │   │   ├── runtime.ts      #   runToolAgent — model↔tool loop, runs tools on-device
│   │   │   ├── tools.ts        #   buildLifeOsTools — read-only tools over local data
│   │   │   ├── writeTools.ts   #   buildLifeOsWriteTools — propose-only, never mutates
│   │   │   ├── actionQueue.ts  #   ProposedAction queue + commitActions
│   │   │   ├── whatNext.ts     #   "What should I do next?" agent
│   │   │   ├── planner.ts / goalDecomposer.ts
│   │   │   └── exploreThread.ts / exploreTools.ts / voiceTools.ts
│   │   ├── planner/            # Named facade over the day-plan pipeline
│   │   │   └── orchestrator.ts #   thin wrapper — change the underlying module, not this
│   │   ├── memory/             # Profile-level memory consolidation
│   │   │   └── consolidate.ts
│   │   ├── outcomes/           # Production outcome measurement (kill/keep verdicts)
│   │   │   └── measure.ts
│   │   ├── rag/                # Retrieval for grounding AI calls
│   │   ├── prompts/            # System prompts, one file per module/task
│   │   ├── mocks/              # USE_AI_MOCK responses, one file per domain
│   │   ├── costLedger.ts / tracing.ts / extractJson.ts
│   │   ├── replanApply.ts / routinePlanner.ts / historyContext.ts
│   │   ├── productionOutcomes.ts / variantPolicy.ts / profileLearning.ts
│   │   ├── voiceClient.ts      # Gemini Live voice path (separate from callAI)
│   │   └── types.ts
│   ├── cognition/              # Domain-stagnation detect, priority-change handler,
│   │   │                       #   overcommitment detect, replan stash
│   ├── sync/                   # Event-sourced spine: mutationLog, hashChain, lamport,
│   │   │                       #   runtime, sink
│   ├── explore/                # Curiosity engine: spark, expeditions, expeditionGen,
│   │   │                       #   constellation, chasing, frontier, rabbitHoleActions
│   ├── finance/                # Categorizer, merchantClassifier, moneyReview,
│   │   │                       #   analytics + gmail/ + parsers/ + db/ + store/
│   ├── observability/          # App-level metrics (perf, error rates, usage signals)
│   ├── config/                 # flags.ts — typed compile-time flags; runtime flags → useFlagStore
│   ├── components/
│   │   ├── ui/                 # Base design system (Button, Card, Input, ...)
│   │   ├── gamification/       # XP / badge / streak components
│   │   ├── modules/            # goals / health / finance / career / social / polymath / profile
│   │   └── shared/             # LifeBalanceDashboard, RoutineBlock, OAuthCallbackView,
│   │       │                   #   DailyBriefing, ambient/ ...
│   ├── db/
│   │   ├── schema.ts           # SQLite schema (Drizzle ORM)
│   │   ├── migrations/         # Drizzle migrations + meta
│   │   ├── queries/            # One file per entity
│   │   ├── webStorage/         # Synchronous localStorage shim for web (per-entity stores; finance uses Dexie)
│   │   └── index.ts
│   ├── store/                  # Zustand stores (useGameStore, useFlagStore,
│   │   │                       #   useUserStore, usePreferencesStore, ... — see dir)
│   ├── integrations/
│   │   ├── google/             # Shared PKCE OAuth driver
│   │   ├── googleAuth / googleCalendar / googleFit / googleContacts / youtube
│   │   ├── supabase/           # Auth + session + sync client
│   │   └── elevenlabs/         # Dev-time onboarding-audio generation only
│   ├── hooks/ · theme/ · utils/ · constants/ · data/
├── workers/ai-proxy/           # Cloudflare Worker — the only thing that holds AI keys
├── evals/                      # Eval harness + datasets + reports
├── e2e/                        # Playwright end-to-end + smoke tests
├── admin/                      # Admin portal
├── scripts/                    # Node utility scripts (food DB build, audio gen, post-export web)
├── supabase/                   # Supabase migrations (admin, telemetry, ai_cost_events, mutations)
├── docs/ · roadmap/ · implementation-plan/ · audit/
├── .env.example · app.json · babel.config.js · tsconfig.json · drizzle.config.ts
```

---

## AI Client — The Most Important File

LifeOS uses an LLM for all intelligent features. **Every AI call goes through one path**: the client in `src/ai/client.ts`, which POSTs to a server-side Cloudflare Worker authenticated with the user's Supabase session.

### How it actually works (see `src/ai/client.ts`)

```
app ──→ callAI / callAIRaw ──→ POST {PROXY_URL}/claude ──→ Worker ──→ LLM provider
                                 ↑ Bearer = Supabase access token
```

- **Two client entry points, one transport:**
  - `callAI(request)` → returns text. Used by all single-shot functions.
  - `callAIRaw(request)` → returns `{ text, functionCalls, model }`. Used by the tool-use agent runtime, which needs to see tool calls to dispatch them on-device.
  Both go through the same internal `callViaProxy`, so cost/telemetry/tracing fire either way.
- **Provider:** the Worker runs `LLM_PROVIDER` (currently **Gemini** by default — see `modelRouter.ts`), with the API keys held server-side. The `/claude` endpoint name is historical; the body is provider-neutral. The model is chosen per-task by `pickModel(task)` in `src/ai/modelRouter.ts` (cheap / planning / reasoning tiers).
- **No on-device API key in the client path.** Keys live on the Worker, never bundled into the app. If the user is not signed in, `callViaProxy` throws `"Sign in required to use AI features."` (`EXPO_PUBLIC_ANTHROPIC_API_KEY` / `ANTHROPIC_API_KEY` in `.env` are for Node-side scripts and live evals only — never the app's runtime path.)
- **No CLI / `child_process` path.** React Native cannot spawn processes.
- **Proxy URL** comes from `EXPO_PUBLIC_AI_PROXY_URL` (defaults to `http://localhost:8787` for dev).
- **Cost, telemetry, tracing** are recorded on every call: `recordUsage()` (`src/ai/costLedger.ts`), `track(EVENTS.aiCall, ...)`, `startSpan/endSpan` (`src/ai/tracing.ts`). Any new AI entry point must go through `callAI`/`callAIRaw` so these stay populated. The client ledger is a **convenience estimate** (priced per `PRICING` in `costLedger.ts`, which now carries Gemini rates); the server-side `ai_cost_events` table written by the Worker is the **source of truth** for billing.
- **Rate limit:** proxy returns 429 → surfaced as `"You've hit today's AI limit. Try again tomorrow."`
- **Voice is a separate path.** `src/ai/voiceClient.ts` drives the Gemini Live WebSocket (via the Worker's `/gemini-live`) and does *not* go through `callAI`. It is the one intentional exception.

### Tool-use agent

`src/ai/agent/runtime.ts` runs a tool loop: ask the model → if it requests tool calls, execute them on-device against local data → feed results back → repeat until it answers or the iteration cap (clamped to [1,10], default 6) is hit. The Worker executes no tools — it's a passthrough. Two on-device tool sets feed the loop: **read tools** (`buildLifeOsTools` in `agent/tools.ts`) read the user's real state, and **propose-only write tools** (`buildLifeOsWriteTools` in `agent/writeTools.ts`) that **never mutate** — each pushes a `ProposedAction` onto an in-memory queue (`agent/actionQueue.ts`) and returns `{ proposed: true }`. Only on explicit user confirmation does `commitActions` map a proposal to an existing DB query (which calls `recordMutation`, so the sync/audit layer keeps working) — "always confirm" holds by construction; no tool touches the DB. Consumers: `whatShouldIDoNext` (read-only, gated by `agent_what_next`) and the propose-capable `whatShouldIDoNextWithActions` (gated by `aiCoachActions`, default off; the per-action confirm UI is still being wired — parked item 3.1).

### Planning pipeline (the "master planner")

There is **no monolithic master-planner class** — the "6 engines → 1 Routine Builder" picture is realised as an **emergent pipeline** across several modules. `src/ai/planner/orchestrator.ts` is a thin **named facade** over those stages (it adds no logic; change the underlying module, not the facade):

1. **Retrieve** context — `buildHistoryContext()` (`src/ai/historyContext.ts`)
2. **Plan** the full day — `planDay` → `planRoutineWithContext` (propose → critique → commit, `agent/planner.ts`)
3. **Replan** intra-day — `replanRestOfToday` → `rebalanceRestOfToday` (`replanApply.ts`)
4. **Plan** tomorrow — `planTomorrow` → `generateAndSaveTomorrow` (`replanApply.ts`)
5. **Decide** next action — `whatNext` → `whatShouldIDoNext` (tool-use agent, `agent/whatNext.ts`)
6. **Detect** — cognitive detectors in `src/cognition/*` (stagnation, overcommitment, …)
7. **Learn** — kill/keep verdicts in `src/ai/productionOutcomes.ts` (human-toggled, never silent)

Steps 6–7 run out-of-band (end-of-day / app-open), not inline in one call.

### Mock mode

For UI work without hitting the proxy, set `EXPO_PUBLIC_USE_AI_MOCK=true` (or `USE_AI_MOCK=true`). Mocks live in `src/ai/mocks/`. Functions in `src/ai/functions.ts` and the agents check the flag and return the mock before calling the client.

### When changing this file

- Do **not** add an on-device API-key branch to the client path. Keys belong on the Worker.
- Do **not** add transports that bypass `recordUsage` / `track` / spans — that breaks the cost ledger and eval reports.
- New per-call options go on `AIRequest` in `src/ai/types.ts` and need a corresponding field on the Worker.

---

## Design System

### Philosophy
**Answer First, Celebrate Loud, Rest Quiet** — the canonical manifesto is
`docs/DESIGN_MANIFESTO.md`; read it before any UI work. The visual language is
**Ink + Signal**: true-black resting base, zero decorative washes, domain hues
at full saturation used structurally (never as atmosphere tint), type-led
hierarchy, and loud flag-gated celebration that always ends. The five locked
rules — never open a screen on a visualization; never three equal cards where
one hero belongs; never tint for atmosphere; never let glow idle; never a
border/label-cap/card where a headline would do — are enforced in CI by the
compliance ratchets in `src/theme/__tests__/*Compliance.test.ts` plus
`manifestoLock.test.ts`. Weakening a guard regex or growing an allowlist
requires a founder-approved PR labelled `manifesto-change`.
(`docs/aurora-refined-v2/` is superseded — historical reference only.)

### Typography
- **Display font**: `Nunito` (rounded, friendly, strong) — headings, module titles, gamification numbers
- **Body font**: `DM Sans` — clean, readable, modern
- Load via `@expo-google-fonts/*`

### Colour Tokens
Tokens live in `src/theme/colors.ts`, alongside `elevation.ts`, `motion.ts`, `density.ts`, `radii.ts`, `surfaces.ts`, `typography.ts`, and `spacing.ts`. True-black ground (`background: '#000000'` dark), six full-saturation domain hues (goal orange, health green, finance gold, career blue, social pink, polymath cyan) with per-mode `*Text` forms and `*Dim` containers, and gamification gold/ember (`xp`/`streak`/`badge` — never violet). **Violet (`primary`) is a voice, not a paint** (founder ruling 2026-06-14, spec 03 amendment): it means *the brand or the AI is speaking* — the wordmark, the front door, planner/AI surfaces, the companion, the install ask — never a default button, a selection state, or gamification. Guard E (`violetVoiceCompliance.test.ts`) enforces the file allowlist. **Always read tokens from `src/theme/` — never hard-code values.**

### Spacing (4pt grid)
`spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 }`

### Component Conventions
- Cards are neutral ink surfaces (`radii.card`, hairline `colors.border`) — domain identity is an R3 `DomainGlyph` inside the content, never a coloured card edge; a 4px domain rail is legal only on a screen's single hero (resolution 9)
- Buttons: large touch targets (`minHeight: 56`, `radii.control`); `Button`/`Button3D` **require** an explicit `variant`/`tone` — pick the context's voice (domain hue / `xp` gold / ink), never default to violet
- Module screens open on a full-bleed `ModuleHeader` block (R1) in the solid domain hue with `inkOnColor` content
- Progress fills are the solid domain hue on `c.track` — gradients died with the recommit (resolution 3)
- Selection states are ink (`surfaceAlt` fill / `textPrimary`), not brand-coloured
- Always use `StyleSheet.create()` — never inline style literals
- Haptic feedback on every meaningful interaction (`expo-haptics`)
- Micro-animations on state changes (`react-native-reanimated`)

---

## Tech Stack (key packages)

> Verify exact versions against `package.json` — it is the source of truth. Snapshot as of May 2026:

| Package | Version |
|---|---|
| expo | ~54.0.0 |
| expo-router | ~6.0.23 |
| react / react-dom | 19.1.0 |
| react-native | 0.81.5 |
| react-native-reanimated | ~4.1.1 |
| react-native-gesture-handler | ~2.28.0 |
| react-native-web | ^0.21.0 |
| expo-sqlite | ~16.0.10 |
| dexie (web storage) | ^4.4.2 |
| drizzle-orm / drizzle-kit | ^0.45.1 / ^0.31.9 |
| @supabase/supabase-js | ^2.104.0 |
| zustand | ^5.0.12 |
| @tanstack/react-query | ^5.90.21 |
| zod | ^4.3.6 |
| typescript | ~5.9.2 |
| jest / @playwright/test | ^30.3.0 / ^1.59.1 |

---

## Database — SQLite (mobile) / localStorage + Dexie (web), with Drizzle ORM

### Storage layers
| Data type | Where | Why |
|-----------|-------|-----|
| Health logs, blood reports, contacts | Local (SQLite on native, **synchronous localStorage** on web) | Sensitive — stays on device |
| Goals, tasks, routine blocks, habits | Local + optional Supabase sync via the mutation log | Cross-device, recoverable |
| Finance transactions | Local (SQLite on native, **Dexie/IndexedDB** on web) | Larger volume; outgrows localStorage's ~5 MB quota |
| Gamification state | Local | Fast reads for home screen |
| User preferences | Local | |
| Finance transactions | Local (SQLite on native, **Dexie/IndexedDB** on web) | Larger volume; outgrows localStorage's ~5 MB quota |

> **Web storage is two different backends — don't conflate them.** The **per-entity stores** (users, health, goals, gamification, contacts, …) use a **synchronous `localStorage`** shim in `src/db/webStorage/` (`_io.ts` = `JSON.parse(localStorage.getItem(…))`), so web reads like `getUser()` return a value, **not a Promise** — the query layer (and the render/voice paths) rely on this synchrony. Only the **finance** transaction store (`src/finance/db/transactionDb.ts`) is **Dexie/IndexedDB (async)**. Native uses `expo-sqlite`; Drizzle sits over the native path. **Migrating a per-entity store to Dexie would break the synchronous read contract** — `src/db/queries/__tests__/syncReadContract.test.ts` guards it (a Promise-returning read fails CI). State changes flow through the event-sourced mutation log in `src/sync/` (hash-chained), the substrate for Supabase sync, version history, and memory.

### Schema principles
- `text('id')` with `nanoid()` for all primary keys — never auto-increment integers
- Every table has `createdAt` and `updatedAt`
- Soft deletes: `deletedAt` column, never hard-delete user data
- JSON columns for flexible data (goal metadata, blood report markers)

---

## State Management

- **Zustand** for global UI state (see `src/store/` — current user, flags, preferences, gamification, etc.)
- **React Query** for async data with caching
- **Drizzle** queries via custom hooks — no Redux, no Context for data

---

## Onboarding Architecture

Onboarding is **progressive** — not a single form. Route group `(onboarding)/`. There is also a fast-start **discovery** flow (paste/chat → extracted profile → confirm) for users who want to bootstrap quickly.

```
Day 1  → day1-vision → day1-career → day1-routine
Day 3  → notification → day3-health
Day 7  → notification → day7-finance → day7-social
Day 14 → notification → day14-polymath
```

Each onboarding screen: asks ≤3 questions, makes one AI call to personalise the next step, previews the value just unlocked, celebrates completion with animation + haptic. Stage tracked in `useUserStore` and the SQLite `users` table.

---

## Gamification Architecture

Gamification lives in `useGameStore` + a `gamification` table: per-domain scores (0–100, rolling 30-day), streaks (workout/learning/foodTracking/journaling/social), badges, and XP (total + weekly). Badge evaluation runs on every significant user action; an earned badge triggers `AchievementToast` with animation and haptic.

---

## AI Prompt Conventions

Every AI call must:
1. Have a typed input and output interface
2. Include a mock response for mock mode
3. Handle errors gracefully — never show raw AI errors to users
4. Include the relevant *slice* of user context (not the whole profile)
5. Request JSON output for structured data; validate with Zod, wrap parsing in try/catch

```typescript
export async function decomposeGoal(input: GoalInput): Promise<GoalHierarchy> {
  if (process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true') return MOCK_GOAL_HIERARCHY;

  const response = await callAI({
    system: GOAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    task: 'decomposeGoal',
    model: pickModel('decomposeGoal'),
  });

  try {
    return GoalHierarchySchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid goal structure');
  }
}
```

New tasks must be added to the `AITask` union and `TASK_TIER` map in `src/ai/modelRouter.ts`.

---

## Code Conventions

- **TypeScript strict mode** — no `any`, no `as unknown`
- **Zod** for all runtime validation (AI responses, API responses, storage reads)
- **No class components** — functional only
- **Named exports** for components, **default exports** for screens
- **Absolute imports** via `tsconfig` paths — `@/components/ui/Button`
- **File naming**: `PascalCase` for components, `camelCase` for utilities
- One component per file. Co-locate styles in the same file.
- Error boundaries on every screen
- Loading skeletons instead of spinners where possible

---

## Environment Variables

See `.env.example` for the authoritative, commented list. Highlights:

```bash
# AI proxy (Cloudflare Worker) — holds the LLM keys server-side
EXPO_PUBLIC_AI_PROXY_URL=

# Mock mode — no AI calls, static responses
EXPO_PUBLIC_USE_AI_MOCK=false

# Supabase — auth + encrypted backups (shipped). Anon key is safe in the bundle.
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Google OAuth (Calendar / Fit / Gmail) — web. Token exchange runs server-side
# on the Worker (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET via `wrangler secret`).
EXPO_PUBLIC_GOOGLE_CLIENT_ID=

# Node-side scripts/evals only — NOT the app runtime path
ANTHROPIC_API_KEY=

# ElevenLabs — dev-time onboarding-audio generation only (not a runtime dependency)
ELEVENLABS_API_KEY=
```

---

## Adding a new Google integration

All Google integrations share the PKCE driver in `src/integrations/google/oauth.ts`. The token exchange runs server-side via the Worker's `/v1/google/token` route. The canonical recipe is three steps:

1. **OAuth module** — `src/integrations/<name>/oauth.ts` calls `createGoogleOAuthClient({ scopes, tokenKey, verifierKey, redirectPath })` once, then re-exports the bound surface (`start`, `complete`, `clear`, `isConnected`, `getAccessToken`).
2. **REST client** — `src/integrations/<name>/client.ts` reads the bearer via `getAccessToken` from the oauth module above.
3. **Callback route** — `app/<name>-callback.tsx` (≈20 lines) returns `<OAuthCallbackView exchange={...} onSuccess={...} redirectTo={...} … />`, wiring `exchange` to the bound `complete`.

Reference implementation: `src/integrations/googleAuth/oauth.ts` and `app/google-auth-callback.tsx`.

---

## What Claude Code Should Never Do

- Use `any` in TypeScript
- Make AI calls synchronously on the main thread
- Store sensitive health or contact data anywhere other than the local store (SQLite / Dexie)
- Use `StyleSheet` inline value literals — all values must come from `theme/`
- Skip error handling on AI calls
- Add an on-device API-key branch to the AI client path — keys belong on the Worker
- Add a new AI entry point that bypasses `callAI`/`callAIRaw` (and thus cost/telemetry/tracing)
- Add mock data that looks like real PII (use obviously fake names/values)
- Add Plaid or a vector DB without checking the roadmap — those are later-phase

---

## Session Startup Checklist

1. Read `CLAUDE.md` (this file)
2. Read the current phase in `roadmap/01-program-roadmap.md` / `implementation-plan/` and the backlog in `docs/PARKED_ITEMS.md`
3. Check `src/` structure on disk — understand what already exists
4. Never re-scaffold what already exists — always check first
5. Run `npx expo start` (iOS / Android / web) and/or `npm run evals` to verify the build before making changes
