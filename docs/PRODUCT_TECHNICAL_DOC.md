# LifeOS — Product Technical Document

## 1. Overview & Problem Statement

**What is LifeOS?** A React Native/Expo app (iOS, Android, and web from one codebase) that acts as a "Digital Life Architect" — an AI-powered system that understands six dimensions of a user's life and synthesizes them into a livable daily structure.

**Problem:** People juggle goals, health, finances, career growth, social relationships, and personal interests across disconnected tools. No single system provides a unified, AI-driven plan that answers: *"What should I do next to improve my life?"*

**Target User:** Ambitious individuals who want to optimize multiple life domains simultaneously — not just productivity, but holistic life management.

**Current Phase:** Phase 1.5 — local-first, with a thin Cloudflare Workers backend (`workers/ai-proxy/`) brokering all AI traffic and Supabase handling auth. Core onboarding, goals, health, finance, career, and routine engines are implemented. A full gamification overhaul has shipped **and is default-on (June 2026)**: Rewards tab, level progression (XP → levels 1–12+), DB-backed procedural daily quests with claim/reroll, badges with gallery, 5 streak types with earned streak shields + milestone tiers + 24h recovery, variable-reward chests, a companion (Rive runtime + designed glyph fallback), comeback flow, the "Your journey" ProgressPath, and a full-screen level-up overlay — all gamification speaks gold/ember, never violet. The Polymath (Explore) module ships: interests CRUD, weekly-target tracking, exploration log with minute chips, and gamification hooks. **The visual layer is Ink + Signal (June 2026 recommit — `docs/DESIGN_MANIFESTO.md`, dossier at `docs/design-deep-dive/`)**: true-black ground, full-bleed domain-hue module headers, type-led hierarchy, zero decorative washes (the former Aurora Glass layer and `AuroraBackground` are deleted; `InkCanvas` is the one background primitive), CI-enforced by the Guard A–E ratchets. The first-run experience is the cold-start arc (day-1 Rewards = one First Win; every zero is an invitation; first-ever block completion = epic celebration), and Today opens answer-first: fixed greeting header, the frozen hex radar with a live hub readout, and the deterministic NextMoveHero. Evening reflect — a nightly 60s ritual (review blocks → mood → AI-suggested tweak for tomorrow) — ships behind an 18:00 "Wrap up today" CTA on Home. Discovery Import lets users paste a ChatGPT/Claude self-description and have it extracted into a structured profile (raw stashed in `discovery_imports`, structured output surfaced on a confidence-scored preview screen). **Chatbot** ("Ask LifeOS") ships at `app/chat.tsx`, persisted to the `chat_messages` table. **Voice assistant** prototype (Gemini Live, WebSocket via the worker) is wired in `src/ai/voiceClient.ts` + `src/components/shared/VoiceAssistantSheet.tsx`. **Goal comments** add an asynchronous review thread per goal (`goal_comments`). The Social module ships (conversation starters, contact cadence, overdue-reconnect signals). A cognitive layer now sits above the engines and is live behind feature flags: an **event-sourced mutation log** (`src/sync/`, hash-chained) recording every goal/routine/reflection write; a **domain-stagnation nudge** in evening reflect; **Explore v2** (daily Spark + concurrent Expeditions with conflict-free merge + Constellation); and **Priority Change → Routine Adjustment** (adjust-today diff preview + 24h undo, or start-fresh-tomorrow). A cross-platform `kvStore` abstraction and the Dexie-backed web storage shim (`src/db/webStorage/`) support the web build alongside native.

---

## 2. Technical Architecture

| Layer | Technology |
|-------|-----------|
| **Runtime** | React Native 0.81.5 + Expo 54 |
| **Language** | TypeScript 5.9 (strict mode) |
| **Navigation** | Expo Router 6 (file-based) |
| **State** | Zustand 5 |
| **Database** | SQLite (expo-sqlite 16) + Drizzle ORM 0.45 |
| **Transaction DB** | Dexie (IndexedDB) — web-first, for finance transactions |
| **AI** | Claude (Anthropic) + Gemini Live (Google), brokered by `workers/ai-proxy` (Cloudflare Workers). The app never holds API keys; bearer is a Supabase JWT. |
| **Backend** | Cloudflare Workers (`workers/ai-proxy/`) — `/claude` proxy, `/gemini-live` WebSocket, `/v1/config`, `/v1/prompts`, `/v1/admin/*`, KV-backed daily rate limits. |
| **Auth** | Supabase Auth (email/password + Google OAuth + Apple) — JWT verified inside the worker via JWKS. Local SQLite users row mirrors the auth identity. |
| **Data Fetching** | TanStack React Query 5 |
| **Animations** | Reanimated 4 |
| **Validation** | Zod |
| **Notifications** | expo-notifications |
| **Theme** | Zustand store (`useThemeStore`) + `useColors()` reactive hook; dark/light persisted via `kvStore` (localStorage on web, AsyncStorage on native) |
| **Cross-platform KV** | `src/utils/kvStore.ts` — async wrapper over localStorage / sessionStorage on web; `expo-secure-store` (sensitive keys) + `@react-native-async-storage/async-storage` on native |
| **Charts & Gamification Visuals** | `react-native-svg` — HexRadar (Life Balance), LevelRing / AvatarRing (progress rings), Sparkline (XP history). All animated via Reanimated. |

**Architecture pattern:** Local-first client + thin auth/AI broker. Domain data persists on-device in SQLite (web mirrors via localStorage/IndexedDB). All AI traffic routes through `workers/ai-proxy`, which verifies a Supabase JWT, enforces per-user daily rate limits in Workers KV, and forwards to Anthropic or Gemini. Admin-managed feature flags + system prompts are fetched at boot from the worker (`/v1/config`, `/v1/prompts`) and cached in Zustand stores. The app never embeds AI provider keys.

### Folder Structure

```
lifeos/
├── app/                           # Expo Router file-based screens
│   ├── (auth)/
│   │   ├── welcome.tsx            # First-launch entry point
│   │   ├── sign-in.tsx            # Email/password sign-in
│   │   └── sign-up.tsx            # Email/password sign-up
│   ├── welcome-intent.tsx         # New-flow entry: pick 1–3 domains that matter this season; "Import from ChatGPT/Claude" shortcut
│   ├── evening-reflect.tsx        # Nightly 60s ritual: review today's blocks → mood → AI tweak for tomorrow
│   ├── (onboarding)/              # 3-screen progressive onboarding (+ discovery sub-flows: text + voice)
│   │   ├── day1-vision.tsx        # Vision → AI goal decomposition
│   │   ├── day1-career.tsx        # Career → AI skill gap analysis
│   │   ├── day1-routine.tsx       # Schedule → AI routine generation
│   │   ├── discovery-intro.tsx    # Show canned Discovery prompt + Copy / Open ChatGPT / Open Claude
│   │   ├── discovery-paste.tsx    # Paste Discovery Prompt output from ChatGPT/Claude
│   │   ├── discovery-chat.tsx     # Areas-first AI Q&A (text "talk it through", no-mic fallback)
│   │   ├── discovery-voice.tsx    # Spoken "talk it through" — Gemini Live, persona-aware; same extract pipeline
│   │   └── discovery-confirm.tsx  # Preview of extracted profile (grouped sections + confidence dots)
│   ├── (tabs)/                    # Main app (7 tabs)
│   │   ├── index.tsx              # Today: AvatarRing + HexRadar + streaks + quests + routine
│   │   ├── goals.tsx              # Goal hierarchy & daily tasks
│   │   ├── health.tsx             # Calories, weight, blood reports
│   │   ├── finance.tsx            # Transactions + goals (Gmail-integrated)
│   │   ├── career.tsx             # Skill gaps & learning resources
│   │   ├── explore.tsx            # Polymath: Instagram-style Discover grid + tracked interests
│   │   └── rewards.tsx            # Gamification: LevelRing, ladder, badges, streaks, quests
│   ├── gmail-callback.tsx         # OAuth redirect handlers (one per Google integration)
│   ├── chat.tsx                   # "Ask LifeOS" chatbot (persisted to chat_messages)
│   ├── how-it-works.tsx           # Static product explainer
│   ├── terms-privacy.tsx          # Legal copy
│   ├── settings.tsx
│   └── _layout.tsx                # Root: fonts, DB init, theme hydrate, Supabase session, flags/prompts fetch, auth routing
├── src/
│   ├── ai/
│   │   ├── client.ts              # Claude proxy client (sends Supabase JWT to /claude)
│   │   ├── voiceClient.ts         # Gemini Live WebSocket wrapper (?token=<jwt>)
│   │   ├── functions.ts           # AI orchestration functions (decompose, plan, etc.)
│   │   ├── modelRouter.ts         # Picks model + maxTokens per task
│   │   ├── costLedger.ts          # Per-task token + USD cost accumulator
│   │   ├── tracing.ts             # startSpan/endSpan structured trace events
│   │   ├── extractJson.ts         # Robust JSON extractor for AI replies
│   │   ├── types.ts               # Zod schemas for AI responses
│   │   ├── agent/                 # Multi-step agent scaffolding
│   │   ├── rag/                   # RAG retrieval helpers
│   │   ├── prompts/               # System prompts per domain (chatbot, goals, …)
│   │   └── mocks/                 # Static mock responses for dev
│   ├── integrations/
│   │   ├── supabase/              # Supabase client + session token helpers
│   │   ├── google/                # Shared PKCE OAuth driver
│   │   ├── googleAuth/            # Google SSO
│   │   ├── googleCalendar/        # Calendar API client
│   │   └── googleFit/             # Fit aggregate + sessions client
│   ├── db/
│   │   ├── schema.ts              # Drizzle table definitions (26 tables)
│   │   ├── index.ts               # DB init (WAL mode, foreign keys)
│   │   ├── webStorage.ts          # localStorage user + session store (web)
│   │   ├── careerStorage.ts       # Named career path snapshots
│   │   └── queries/               # CRUD per entity — each branches on Platform.OS for web
│   │                              # (users, goals, goalComments, routine, health, finance,
│   │                              #  behaviour, gamification, reflections, discovery, chat,
│   │                              #  interests)
│   ├── finance/                   # Finance intelligence layer
│   │   ├── gmail/                 # OAuth (PKCE) + Gmail API fetcher
│   │   ├── parsers/               # HDFC / ICICI / Axis regex parsers
│   │   ├── db/                    # Dexie (IndexedDB) transaction schema
│   │   ├── categorizer.ts         # Rule-based + Claude fallback categorizer
│   │   ├── insights.ts            # Behavioural insight detectors
│   │   └── store/                 # Zustand: transactions, sync state, token
│   ├── store/                     # Zustand: useUserStore, useGoalStore, useGameStore,
│   │                              # useThemeStore, useFlagStore, usePromptStore,
│   │                              # useMotivationStore, usePolymathStore
│   ├── hooks/                     # useAI, useNotifications, useVoice
│   ├── components/
│   │   ├── ui/                    # Design system (Button, Card, Input, Typography, …)
│   │   ├── shared/                # InkCanvas, TodayHeader, NextMoveHero, DailyBriefing, RoutineBlock,
│   │   │                          # LifeBalanceDashboard, LifeHubSheet, ProfileSidebar,
│   │   │                          # OAuthCallbackView, MotivationBanner, VoiceAssistantSheet
│   │   ├── gamification/          # LevelUpOverlay, level/avatar rings, hex radar
│   │   └── modules/               # Domain-specific (goals/, health/, finance/, career/, social/, polymath/)
│   ├── theme/                     # Colors (dark+light), typography, spacing, shadows
│   └── utils/                     # kvStore (cross-platform KV), gamification, IDs, sign-out, …
├── workers/
│   └── ai-proxy/                  # Cloudflare Worker: auth, rate limit, Claude/Gemini proxy,
│                                  # admin portal API (flags + prompts), public /v1/config
```

---

## 3. End-to-End Features & User Flows

### 3.1 Onboarding (3 screens → full routine)

| Step | Screen | AI Call | Outcome |
|------|--------|---------|---------|
| 1 | `app/(onboarding)/day1-vision.tsx` | `decomposeGoal()` | Vision → yearly/monthly/weekly/daily goals saved to DB |
| 2 | `app/(onboarding)/day1-career.tsx` | `analyseSkillGap()` | Role + skills → skill gaps + learning resources saved |
| 3 | `app/(onboarding)/day1-routine.tsx` | `generateRoutine()` | Schedule → 24 time-blocked routine blocks for today |

Routing logic in `app/_layout.tsx`: no user → auth, stage < 100 → onboarding, stage 100 → tabs.

**Fast-start discovery flows** (alternative entry, both yield the same extracted profile → `discovery-confirm`):

| Flow | Screens | Path |
|------|---------|------|
| Text import | `discovery-intro` → `discovery-paste` | paste a ChatGPT/Claude self-description → `extractDiscoveryProfile()` |
| Talk it through (text) | `discovery-chat` | areas-first AI Q&A, no-mic fallback |
| Talk it through (voice) | `discovery-voice` | a real Gemini Live conversation in the user's chosen voice **persona** → same extract pipeline |

The voice surfaces (spoken onboarding + the persistent companion), personas, and the voice tools are documented in [`docs/VOICE_FEATURES.md`](VOICE_FEATURES.md).

### 3.2 Today Screen (`app/(tabs)/index.tsx`)

- **Avatar + Profile Sidebar** — tap the header avatar (initials) to open `ProfileSidebar` (left-slide animation). Sidebar has Settings (theme toggle, notifications, privacy), Help, and Logout. Implemented in `src/components/shared/ProfileSidebar.tsx`.
- **Life Balance Dashboard** — now an **SVG hexagonal radar chart** built on `react-native-svg`. Responsive via `useWindowDimensions`, theme-reactive via `useColors()`. Implemented in `src/components/shared/LifeBalanceDashboard.tsx`.
- **Streak + XP chips** — live from `useGameStore`, shown in the header next to the avatar.
- **Daily Briefing** — AI-generated text from behavior analytics
- **Weekly Insight** — computed from `behaviourEvents` (peak hours, completion rate)
- **Routine Blocks** — time-sorted, tap to complete → logs event + awards XP + checks badges
- **Google Calendar card** — `Connect Google Calendar` button triggers OAuth; once connected, `Sync N blocks` pushes today's routine to the primary calendar as events with a 10-minute popup reminder (no `expo-notifications` needed — Google delivers the native push). Event IDs persist on each routine block via `setRoutineBlockCalendarEventId()` so subsequent syncs update in place rather than duplicate. The connection is now **read + write**: the planner also *reads* the primary calendar (`listCalendarEvents()`, same `calendar.events` scope) so the Routine Builder and what-next agent schedule around real meetings instead of into a vacuum.

### 3.3 Goals (`app/(tabs)/goals.tsx`)

- Displays goal hierarchy (life → yearly → monthly → weekly → daily)
- Complete daily tasks → updates parent progress
- Add new goals via `src/components/modules/goals/AddGoalSheet.tsx`

### 3.4 Health (`app/(tabs)/health.tsx`)

- **Calorie Ring** — consumed vs 2000 target with macro breakdown
- **Food Entry** — manual or **AI photo recognition** (`recogniseFood()` with base64 image)
- **Weight Chart** — 7-day trend via `src/components/modules/health/WeightChart.tsx`
- **Blood Reports** — upload → `parseBloodReport()` AI → markers, summary, suggestions
- **Google Fit dashboard** — after Connect + Sync, renders `src/components/modules/health/FitDashboard.tsx` with:
  - Hero step-goal ring (today vs 8K target + weekly hit rate)
  - 6-tile stat grid (steps, active minutes, heart points, calories burned, distance, avg HR) with 7-day sparklines + week-over-week trend arrows
  - Sleep block (deep/REM/light breakdown + 7-day sparkline)
  - Vitals tiles: SpO2, body fat %, blood pressure (render only when samples exist)
  - Workouts list with activity-type icons mapped by `ACTIVITY_LABELS`
  - Rule-based insight cards via `src/utils/fitInsights.ts` (no AI call) — e.g. "You sleep 28min more on active days", "Resting HR down 5% this week"

### 3.5 Finance (`app/(tabs)/finance.tsx`)

- Setup: goal type + amount + savings + income + risk profile
- **INR-native with multi-currency scaffolding** — all amounts denominated in `ACTIVE_CURRENCY` from `src/utils/currency.ts`. Preset chips are scaled to INR (₹5L/₹10L/₹25L target, ₹10K/₹25K/₹50K savings, LPA income brackets). Free-form amount input accepts typing; `parseMoneyInput()` handles lakhs/crores suffixes. Swapping the currency is a one-line change.
- AI generates plan via `generateFinancialPlan(input)` — input carries `currency` so the prompt emits INR-scaled amounts and uses "lakhs/crores" in prose fields.
- `src/ai/mocks/finance.ts` scales milestones off `input.targetAmount` (fractions 0.1/0.25/0.5/0.75/1.0) so values never overshoot the target — locked with 9 invariant tests in `src/ai/__tests__/financialPlan.test.ts`.
- One-time migration in `loadExistingGoal()` detects stale `$`-prefixed titles or milestones > target and rebuilds via `deleteMilestonesByGoal()` + mock plan.
- Gmail transaction ingestion: UPI merchants normalized via `normalizeUpiMerchant()` so `UPI/P2A/<refId>/NAME` collapses to `{merchant: 'NAME', channel: 'p2a'}`; p2a transactions route deterministically to the `transfers` category. Migration guarded by `lifeos_upi_migration_v1` localStorage flag.
- **Subscriptions & bills audit** — beyond bank alerts, the same Gmail scope is mined for subscription renewals and bills/invoices (`BILLS_SUBSCRIPTIONS_QUERY` → `parseBillOrSubscription()` → `recurringItems` Dexie table → `useRecurringStore`). The Overview `SubscriptionsBillsCard` shows a "₹X/mo across N subscriptions" total + upcoming bill due-dates with a per-item dismiss; the same data feeds the planner / what-next agent via `src/ai/billsContext.ts`. Detection is regex-only (no AI).
- **Spend comparison is like-for-like** — the "this month so far" delta and the Monthly Money Review (`momDeltaPct`) compare month-to-date against the **same elapsed day-range** last month via `samePeriodMonthWindows()`, not the full previous month (which made an in-progress month read as a spend collapse).
- Track milestone completion, get weekly AI insights

### 3.6 Career (`app/(tabs)/career.tsx`)

- State machine flow: **setup form → analysing → results**
- Displays skill gap chart from onboarding analysis
- Learning resources with status tracking (not_started → in_progress → completed)
- **Save Path modal** — names a career path snapshot and persists it to localStorage via `src/db/careerStorage.ts`
- **Load / Delete** saved paths from both setup and results views
- **Clear** button returns to blank setup form

### 3.7 Authentication

Supabase Auth is the source of truth for identity. The local SQLite `users` row mirrors the Supabase user (id, email, name) and continues to back domain queries — Supabase never stores LifeOS domain data.

| Concern | File | Notes |
|---------|------|-------|
| Sign-in screen | `app/(auth)/sign-in.tsx` | Email/password + Google SSO + Apple SSO via Supabase |
| Sign-up screen | `app/(auth)/sign-up.tsx` | Calls `supabase.auth.signUp`; mirrors row into local DB |
| Supabase client | `src/integrations/supabase/client.ts` | Reads `EXPO_PUBLIC_SUPABASE_URL` + anon key |
| Session token | `src/integrations/supabase/session.ts` | `getSupabaseAccessToken()` — used by every AI call + worker request |
| Local mirror | `src/db/queries/users.ts` `ensureLocalUserFromAuth()` | Creates/migrates the local row from a Supabase session at boot |
| Worker JWT verification | `workers/ai-proxy/src/auth.ts` | Verifies the JWT against the Supabase JWKS on every protected route |

Boot flow (`app/_layout.tsx`): `supabase.auth.getSession()` → if a session exists, `ensureLocalUserFromAuth` writes the local row and `setWebSession(authUser.id)` flags the session; an `onAuthStateChange` listener resets state on logout. Routing remains: no session → `(auth)/sign-in`; `onboardingStage < 100` → onboarding; otherwise `(tabs)`.

**Auth sentinels.** `src/db/queries/users.ts` declares two sentinel `passwordHash` values for legacy rows: `GOOGLE_SSO_HASH = '__GOOGLE_SSO__'` and `SUPABASE_AUTH_HASH = '__SUPABASE_AUTH__'`. New installs only ever see the Supabase sentinel; the Google one is preserved for historical local-only accounts created before Supabase was wired up. Login flows skip password verification on either sentinel.

**ID rewrite.** When an email already exists locally (legacy install) and the user signs in via Supabase for the first time, `webRewriteUserId(oldId, newId)` (web) / its SQLite equivalent (native) rewrites the primary id to the Supabase user id while preserving email, password fields, and `createdAt`. `ensureLocalUserFromAuth` invokes this whenever the local id and Supabase user id disagree.

### 3.8 Web Storage Layer

Web builds cannot use SQLite. A parallel localStorage-based layer mirrors the query API surface.

| File | Purpose |
|------|---------|
| `src/db/webStorage.ts` | Full localStorage implementation for users + session (mirrors SQLite API surface) |
| `src/db/careerStorage.ts` | Named career path snapshots in localStorage |
| `src/finance/db/transactionDb.ts` | Dexie (IndexedDB) for transactions — used only on web |

**Pattern:** every query file branches on `Platform.OS === 'web'` to route to the appropriate storage backend. Example from `users.ts`:

```typescript
const isWeb = Platform.OS === 'web';
export function getUser() {
  if (isWeb) return webGetUser();
  return db.select().from(users).limit(1).get();
}
```

**ID migration helper.** `webUpdateUser(id, data)` treats `id`, `email`, `passwordHash`, `passwordSalt`, and `createdAt` as immutable. To migrate a legacy local-only user row onto an authoritative auth-provider id (typical case: an email that already exists locally signs in via Supabase for the first time), use `webRewriteUserId(oldId, newId, name?)` from `src/db/webStorage.ts`. It rewrites the `id` and bumps `updatedAt` while preserving email, password fields, and `createdAt`. `ensureLocalUserFromAuth` calls it whenever the local id and Supabase user id disagree.

### 3.9 Gamification (cross-cutting)

- **XP** awards on every action (5-200 XP per action type)
- **Streaks** with 1-day grace period (workout, learning, foodTracking, journaling, social)
- **8 Badges**: first_blueprint, first_blood_report, streak_30_any, skill_mastery, life_balance, goal_complete, week_1, food_photo
- **Achievement Toast** via `src/components/shared/AchievementToast.tsx` — auto-dismiss with animation

### 3.10 Notifications (`src/hooks/useNotifications.ts`)

- Onboarding nudges at day 3, 7, 14
- Daily routine reminder at wake time
- Goal reminder at 3 PM, streak-at-risk at 8 PM
- Weight reminder 21 days after last log

### 3.11 Third-party Integrations (`src/integrations/`)

All Google integrations share a single PKCE OAuth driver at `src/integrations/google/oauth.ts`. The driver exposes a `createGoogleOAuthClient(cfg)` factory; each integration (Auth/SSO, Fit, Calendar, Gmail) calls it once with its own `{ scopes, tokenKey, verifierKey, redirectPath }` and re-exports the bound surface — `start`, `complete`, `clear`, `isConnected`, `getAccessToken` — so per-module code never repeats the `cfg` argument or duplicates the handshake.

```typescript
// src/integrations/googleAuth/oauth.ts
import { createGoogleOAuthClient } from '@/integrations/google/oauth';

const client = createGoogleOAuthClient({
  scopes: 'openid email profile',
  tokenKey: 'lifeos_gauth_tokens',
  verifierKey: 'lifeos_gauth_pkce_verifier',
  redirectPath: '/google-auth-callback',
});

export const startGoogleAuthOAuth = client.start;
export const handleGoogleAuthCallback = client.complete;
export const getGoogleAuthAccessToken = client.getAccessToken;
```

| Integration | Scope(s) | Redirect | Module | Callback screen |
|-------------|----------|----------|--------|------------------|
| Gmail (finance sync) | `gmail.readonly` | `/gmail-callback` | `src/finance/gmail/` | `app/gmail-callback.tsx` |
| Google Calendar (routine blocks) | `calendar.events` | `/calendar-callback` | `src/integrations/googleCalendar/` | `app/calendar-callback.tsx` |
| Google Fit (health metrics) | `fitness.activity.read`, `fitness.heart_rate.read`, `fitness.sleep.read`, `fitness.body.read`, `fitness.location.read`, `fitness.oxygen_saturation.read`, `fitness.blood_pressure.read` | `/fit-callback` | `src/integrations/googleFit/` | `app/fit-callback.tsx` |

**Google Calendar** — `syncBlocksToCalendar()` in `client.ts` creates new events for routine blocks missing a `calendarEventId`, updates the rest in place. 10-minute popup reminder is set via `reminders.overrides` so native push notifications come directly from Google's infra. `listCalendarEvents()` (same `calendar.events` scope) reads the primary calendar so the planner and what-next agent can work around real commitments — see `src/ai/calendarContext.ts` (`buildCalendarContext` + the `getTodayCalendar` agent tool).

**Google Fit** — `syncFitDailyData(clientId, days=14)` pulls everything via two aggregate calls + one sessions call:
- Core aggregate: steps, active minutes, heart points, calories, distance, HR (avg/max/min), weight, body fat %, SpO2, blood pressure
- Sleep aggregate: `com.google.sleep.segment` → minutes per stage (deep/REM/light/awake)
- Sessions API: non-sleep workouts mapped to display names via `ACTIVITY_LABELS`. Each emitted workout's `iconName` is typed as `keyof typeof Ionicons.glyphMap`, not an arbitrary string, so the renderer is compile-time safe.

The empty-state copy ("Hit Sync to pull the last 14 days") matches the `syncFitDailyData(clientId, days=14)` default — both should move together if the window is ever re-tuned.

Setup: both Calendar and Fit require (a) enabling the respective API in Google Cloud Console, (b) adding the callback URL to Authorized redirect URIs, (c) providing `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in `.env` for the app, and (d) setting `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` as Wrangler secrets on the Worker (web-type OAuth clients still require the secret even with PKCE — but it now stays server-side, exchanged via the Worker's `/v1/google/token` endpoint, never in the app bundle).

**OAuth callback routes — shared view.** All four Google callback screens (`app/google-auth-callback.tsx`, `app/fit-callback.tsx`, `app/calendar-callback.tsx`, `app/gmail-callback.tsx`) are now ≈20-line wrappers around a single presentational component, `src/components/shared/OAuthCallbackView.tsx`. Each route file passes `exchange` (the bound `complete` from its integration's oauth module), an `onSuccess` follow-up (e.g. fetch profile + upsert user), and `redirectTo`. `OAuthCallbackView` owns the working/ok/error UI states, reads `code`/`error` from `window.location.search`, calls `exchange(code, clientId)` then `onSuccess(clientId)`, and finally `router.replace(await redirectTo())` after `redirectDelayMs`.

Prop contract:

| Prop | Type | Notes |
|------|------|-------|
| `workingTitle` | `string` | Shown while the handshake runs |
| `okTitle` / `okSubtitle` | `string` | Shown after success, before redirect |
| `errorTitle` | `string` | Shown on any failure |
| `nativeUnsupportedMsg` | `string` | Web-only feature gate copy if hit on native |
| `exchange` | `(code: string, clientId: string) => Promise<void>` | Token-exchange call (typically the bound `complete`) |
| `onSuccess` | `(clientId: string) => Promise<void> \| void` (optional) | Post-exchange follow-up (profile fetch, user upsert, ...) |
| `redirectTo` | `() => Promise<string> \| string` | Resolves the destination route; called after `onSuccess` |
| `redirectDelayMs` | `number` (optional, default `500`) | Delay before `router.replace` |
| `router` | `{ replace: (href: string) => void }` | Pass `useRouter()` from `expo-router` |

---

## 4. Data Model

**26 tables** defined in `src/db/schema.ts`. All use UUID primary keys (`expo-crypto`), `createdAt`/`updatedAt` timestamps, and soft deletes where applicable. Tables added in recent revisions: `goal_comments`, `daily_reflections`, `discovery_imports`, `chat_messages`, plus the Explore-v2 + cognition spine (`sparks`, `expeditions`, `expedition_progress`, `cognitive_insights`, mutation log) and health additions (`recovery_score` column on `health_logs`).

### Entity Relationship Diagram

```
users (1) ──── (N) goals
  │                  │ parentId (self-referential hierarchy)
  │                  └── goals (children)
  │
  ├──── (N) routineBlocks (date-partitioned, linkedEntityId → goal)
  ├──── (1) gamification (domainScores, streaks, badges, XP as JSON)
  ├──── (N) behaviourEvents (event log for analytics)
  │
  ├──── (N) healthLogs (weight, sleep, steps, energy)
  ├──── (N) foodEntries (per-meal macros)
  ├──── (N) bloodReports (parsedMarkers + aiSuggestions as JSON)
  │
  ├──── (N) financialGoals
  │          └──── (N) financeMilestones
  │
  ├──── (N) careerProfiles
  │          ├──── (N) skillGaps
  │          └──── (N) learningResources
  │
  ├──── (N) contacts
  │          └──── (N) contactInteractions
  │
  ├──── (N) interests
  │          └──── (N) explorationLog
  │
  └──── (N) habits
```

### Table Details

#### Users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | text | |
| age | integer | nullable |
| visionStatement | text | nullable |
| wakeTime, sleepTime, workStartTime, workEndTime | text | HH:MM format |
| onboardingStage | integer | 0-100, 100 = complete |
| installDate, createdAt, updatedAt, deletedAt | text | ISO timestamps |

#### Goals
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| userId | UUID (FK → users) | |
| title, description | text | |
| goalType | text | career, health, finance, learning, personal, social |
| parentId | UUID (FK → goals) | self-referential hierarchy |
| level | text | life, yearly, monthly, weekly, daily |
| status | text | active, completed, paused, abandoned |
| aiGenerated | integer | boolean flag |
| metadata | text | JSON string |

#### Routine Blocks
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| date | text | YYYY-MM-DD |
| startTime, endTime | text | HH:MM |
| title | text | |
| module | text | goal, health, finance, career, social, polymath, rest, work, meal |
| linkedEntityId | UUID | nullable, FK to goal |
| status | text | upcoming, in_progress, completed, skipped |
| energyRequired | text | low, medium, high |

#### Health Logs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| date | text | YYYY-MM-DD |
| weight | real | kg, nullable |
| sleepHours | real | nullable |
| steps | integer | nullable |
| energyLevel | integer | 1-5, nullable |
| source | text | manual, healthkit, health_connect |

#### Food Entries
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| date | text | YYYY-MM-DD |
| mealType | text | breakfast, lunch, dinner, snack |
| foodName | text | |
| quantityG | real | |
| calories, protein, carbs, fat, fibre | real | |
| source | text | manual, search, photo |

#### Blood Reports
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| date | text | YYYY-MM-DD |
| reportName | text | |
| parsedMarkers | text | JSON (marker details) |
| aiSummary | text | nullable |
| aiSuggestions | text | JSON (action items) |
| rawFileUri | text | nullable |

#### Financial Goals
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| title | text | |
| goalType | text | home, retirement, education, business, emergency_fund, financial_freedom, other |
| targetAmount, monthlySavings | real | nullable |
| currency | text | default 'USD' |
| targetDate | text | YYYY-MM-DD, nullable |
| incomeBracket | text | nullable |
| riskProfile | text | conservative, moderate, aggressive |
| status | text | active, completed, paused |

#### Finance Milestones
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| goalId | UUID (FK → financialGoals) | |
| title | text | |
| targetAmount | real | |
| targetDate | text | YYYY-MM-DD |
| completedAt | text | nullable |

#### Career Profiles
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| currentRole, targetRole | text | |
| timelineMonths | integer | |
| currentSkills | text | JSON string array |
| status | text | active, completed |

#### Skill Gaps
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| careerProfileId | UUID (FK) | |
| skill | text | |
| currentLevel | text | none, beginner, intermediate, advanced |
| requiredLevel | text | beginner, intermediate, advanced, expert |
| priority | integer | |

#### Learning Resources
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| careerProfileId | UUID (FK) | |
| title | text | |
| type | text | course, book, project, person, practice |
| url | text | nullable |
| estimatedHours | real | nullable |
| status | text | not_started, in_progress, completed |

#### Gamification
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| userId | UUID (FK) | |
| domainScores | text | JSON: { goals, health, finance, career, social, mind: 0-100 } |
| streaks | text | JSON: { workout, learning, foodTracking, journaling, social } |
| badges | text | JSON string array of BadgeIds |
| totalXP, weeklyXP | integer | |

#### Behaviour Events
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| eventType | text | block_completed, goal_completed, food_logged, etc. |
| module | text | goal, health, finance, career, social, polymath |
| metadata | text | JSON, nullable |
| hour | integer | 0-23 |
| dayOfWeek | integer | 0-6, Sunday=0 |

#### Contacts, Contact Interactions, Interests, Exploration Log, Habits
Backing tables for the Social (contacts, interactions) and Polymath/Explore (interests, exploration log, expeditions) modules, both shipped.

### Key Design Decisions

- **JSON columns** for flexible data: `goals.metadata`, `gamification.domainScores/streaks/badges`, `bloodReports.parsedMarkers`
- **Self-referential goals**: `parentId` FK enables life → yearly → monthly → weekly → daily hierarchy
- **Behavior events**: denormalized log with `hour` + `dayOfWeek` for analytics queries without date parsing
- **Soft deletes**: `deletedAt` column on users, goals, contacts — never hard-delete user data

---

## 5. API / Interface Summary

### AI Functions (`src/ai/functions.ts`)

| Function | Input | Output | Used In |
|----------|-------|--------|---------|
| `decomposeGoal()` | vision, name, age | GoalHierarchy (yearly/monthly/weekly/daily) | Onboarding |
| `analyseSkillGap()` | current/target role, skills | SkillGapAnalysis (gaps + resources) | Onboarding, Career |
| `generateRoutine()` | wake/sleep/work times, goals | GeneratedRoutine (time blocks + briefing) | Onboarding |
| `suggestMeals()` | calorie target, macros eaten, prefs | MealSuggestion[] | Health |
| `recogniseFood()` | base64 image + media type | FoodRecognition (items + macros) | Health |
| `parseBloodReport()` | report text | BloodReportResult (markers + suggestions) | Health |
| `generateFinancialPlan()` | goal details + income + risk | FinancialPlan (strategies + milestones) | Finance |
| `getWeeklyFinanceInsight()` | goal progress data | WeeklyFinanceInsight | Finance |

All functions validate output with Zod schemas, support mock mode via `EXPO_PUBLIC_USE_AI_MOCK=true`, and route through the AI proxy at `${EXPO_PUBLIC_AI_PROXY_URL}/claude` with a Supabase JWT bearer. The chatbot screen (`app/chat.tsx`) and voice assistant (`src/ai/voiceClient.ts`) share the same auth/transport.

### Workers (`workers/ai-proxy`)

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /v1/config` | public | Boot-time config — feature flags + non-sensitive settings |
| `GET /v1/prompts` | Bearer | System prompts overridable by admin portal |
| `POST /claude` | Bearer | Forward to Anthropic; rate-limited per user via `RATE_LIMIT` KV |
| `WS /gemini-live?token=` | Token in query | Gemini Live WebSocket pipe (browsers can't set headers on WS) |
| `GET /health` | Bearer | Liveness |
| `/v1/admin/flags`, `/v1/admin/prompts` | Bearer + admin row | Admin portal endpoints; admin allowlist in DB |

Daily quotas come from `DAILY_AI_REQUEST_LIMIT` and `DAILY_VOICE_MINUTES_LIMIT`. CORS origin is locked to `ALLOWED_ORIGIN`. JWTs are verified against the Supabase JWKS — no shared secrets, no API keys ever leave the worker.

### DB Query Modules (`src/db/queries/`)

| File | Key Functions |
|------|--------------|
| `users.ts` | `createUser`, `getUser`, `updateOnboardingStage`, `ensureLocalUserFromAuth`, `setWebSession` |
| `goals.ts` | `createGoal`, `getGoalsByUser`, `completeGoal`, `getGoalChildren` |
| `goalComments.ts` | `addGoalComment`, `getGoalComments`, `deleteGoalComment` |
| `routine.ts` | `createRoutineBlock`, `getRoutineBlocksForDate`, `updateRoutineBlockStatus`, `setRoutineBlockCalendarEventId` |
| `health.ts` | `createHealthLog`, `createFoodEntry`, `getFoodEntriesForDate`, `createBloodReport`, `getWeightHistory` |
| `finance.ts` | `createFinancialGoal`, `getActiveFinancialGoal`, `createMilestone`, `completeMilestone` |
| `behaviour.ts` | `logBehaviourEvent`, `getRecentEvents`, `generateWeeklyInsight` |
| `gamification.ts` | `getGamification`, `updateGamification`, `initializeGamification` |
| `reflections.ts` | `saveReflection`, `getReflectionForDate` |
| `discovery.ts` | `saveDiscoveryImport`, `getLatestDiscoveryImport` |
| `chat.ts` | `appendChatMessage`, `listChatMessages`, `clearChatMessages` |
| `interests.ts` | `createInterest`, `logExploration`, `getInterestsByUser` |

### Zustand Stores (`src/store/`)

| Store | State | Key Methods |
|-------|-------|-------------|
| `useUserStore` | userId, name, onboardingStage, primaryDomains, activatedModules | `setUser()`, `setOnboardingStage()`, `setPrimaryDomains()`, `markModuleActivated()`, `reset()` |
| `useGoalStore` | goals[] | `loadGoals()`, `addGoal()`, `completeGoal()` |
| `useGameStore` | domainScores, streaks, badges, XP, pendingBadges, pendingLevelUp | `loadFromDB()`, `completeBlock()`, `addXP()`, `triggerStreak()`, `awardBadge()`, `popBadge()`, `dismissLevelUp()` |
| `useThemeStore` | mode, hydrated | `setMode()`, `toggle()`, `hydrate()` (called once on boot) |
| `useFlagStore` | flags map | `fetchFlags()` from `/v1/config` at boot |
| `usePromptStore` | prompts map | `fetchPrompts()`, `getPrompt(key, fallback)` |
| `useMotivationStore` | banner copy | Surface CTAs / nudges on Home |
| `usePolymathStore` | interests, exploration log | CRUD + weekly target tracking |

---

## 6. Developer Onboarding

### Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- iOS Simulator (macOS) or Android Emulator

### Setup

```bash
git clone <repo> && cd lifeos
npm install
cp .env.example .env
# Set EXPO_PUBLIC_USE_AI_MOCK=true for dev without API key
```

### Run

```bash
npx expo start          # Dev server
# Press 'i' for iOS, 'a' for Android, 'w' for web
```

### Environment Variables

App (`.env`):

| Variable | Purpose | Default |
|----------|---------|---------|
| `EXPO_PUBLIC_USE_AI_MOCK` | Use static mock AI responses | `false` |
| `EXPO_PUBLIC_AI_PROXY_URL` | Cloudflare Worker base URL | `http://localhost:8787` |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | (required) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | (required) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Web OAuth client (Calendar/Fit/Gmail) | (required for integrations) |

Worker (`workers/ai-proxy/wrangler.toml` / secrets):

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Server-only Claude key |
| `GEMINI_API_KEY` | Server-only Gemini key |
| `SUPABASE_JWKS_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | JWT verification + admin row lookups |
| `DAILY_AI_REQUEST_LIMIT`, `DAILY_VOICE_MINUTES_LIMIT` | Per-user daily quotas |
| `ALLOWED_ORIGIN` | CORS lock |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Server-only Google OAuth credentials for `/v1/google/token` exchange |
| `RATE_LIMIT` (KV) | Daily counter store |

### Development Notes

- **Mock mode** (`EXPO_PUBLIC_USE_AI_MOCK=true`): legacy switch retained for unit tests; production AI is brokered by the worker
- **Worker dev**: `cd workers/ai-proxy && npm run dev` — point `EXPO_PUBLIC_AI_PROXY_URL` at the printed `http://localhost:8787`
- **Database**: SQLite auto-initializes on first launch via `src/db/index.ts` with WAL mode + foreign keys enabled
- **TypeScript strict**: No `any`, all AI responses validated with Zod
- **Theme tokens**: All visual values come from `src/theme/` — never use inline style values
- **Component conventions**: `StyleSheet.create()` only, haptic feedback on interactions, Reanimated for animations

### Testing

- Jest + ts-jest configured (`npm test`); evals with `npm run evals` (live providers via `EVAL_REAL=true`)
- Playwright (`@playwright/test`) for web e2e (e.g. `e2e/voice-assistant.spec.ts`)
- TypeScript strict compilation catches type errors
- Manual testing via Expo dev client; mock mode for offline UI work

### Current Branch

`lifeosv1` is the trunk. Active feature work happens on short-lived `claude/*` / `feat/*` branches merged back via PR. Check `git branch` for what's current rather than relying on a branch name here.

---

## Appendix: Data Flow Examples

### Onboarding → Routine Creation

1. User enters vision on `day1-vision.tsx`
2. AI decomposes into GoalHierarchy → goals created in DB
3. User enters role/skills on `day1-career.tsx`
4. AI analyzes skill gaps → career profile + skill gaps saved
5. User selects schedule on `day1-routine.tsx`
6. AI generates daily routine → routine blocks created for today
7. `onboardingStage` set to 100 → router redirects to `/(tabs)`

### Completing a Routine Block

1. User taps routine block on Today screen
2. `updateRoutineBlockStatus(blockId, 'completed')`
3. `logBehaviourEvent('block_completed', module)`
4. `completeBlock()` in GameStore → domain score update + XP + badge check
5. UI refreshes, achievement toast appears if badge earned

### Adding Food via Photo

1. User taps "Add" on Health screen → AddFoodSheet opens
2. User captures/picks photo
3. `recogniseFood(base64, mediaType)` → AI identifies items + macros
4. User confirms → `createFoodEntry()` per item
5. `logBehaviourEvent('photo_food', 'health')` → food_photo badge check
6. Calorie ring updates
