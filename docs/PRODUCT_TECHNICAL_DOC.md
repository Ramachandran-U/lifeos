# LifeOS — Product Technical Document

## 1. Overview & Problem Statement

**What is LifeOS?** A React Native/Expo mobile app that acts as a "Digital Life Architect" — an AI-powered system that understands six dimensions of a user's life and synthesizes them into a livable daily structure.

**Problem:** People juggle goals, health, finances, career growth, social relationships, and personal interests across disconnected tools. No single system provides a unified, AI-driven plan that answers: *"What should I do next to improve my life?"*

**Target User:** Ambitious individuals who want to optimize multiple life domains simultaneously — not just productivity, but holistic life management.

**Current Phase:** Phase 1 (local-only, no cloud sync). Core onboarding, goals, health, finance, career, and routine engines are implemented. A full gamification overhaul has shipped: Rewards tab, level progression (XP → levels 1–12+), daily/weekly quests, 8 badges with gallery, 5 streak types with grace period, hexagonal radar "Life Balance" chart, and a full-screen level-up overlay. The Polymath (Explore) module now ships: interests CRUD, weekly-target tracking, exploration log with minute chips, and gamification hooks (XP + learning streak + mind domain score). The Aurora Glass redesign has shipped across Home/Welcome/Reflect with unified motion tokens (`SPRING`, `TIMING`) and a shared `AuroraBackground` component. Evening reflect — a nightly 60s ritual (review blocks → mood → AI-suggested tweak for tomorrow) — ships behind an 18:00 "Wrap up today" CTA on Home. Discovery Import lets users paste a ChatGPT/Claude self-description and have it extracted into a structured profile (raw stashed in `discovery_imports`, structured output surfaced on a confidence-scored preview screen — seeding the engines from that preview is next). Social module is still WIP.

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
| **AI** | Claude API (Anthropic REST, claude-sonnet-4-20250514) |
| **Data Fetching** | TanStack React Query 5 |
| **Animations** | Reanimated 4 |
| **Validation** | Zod |
| **Notifications** | expo-notifications |
| **Auth** | localStorage-backed email/password with expo-crypto SHA-256 hashing + per-user salt |
| **Theme** | Zustand store (`useThemeStore`) + `useColors()` reactive hook; dark/light persisted to localStorage |
| **Charts & Gamification Visuals** | `react-native-svg` — HexRadar (Life Balance), LevelRing / AvatarRing (progress rings), Sparkline (XP history). All animated via Reanimated. |

**Architecture pattern:** Fully client-side. No backend server. All data persists in on-device SQLite. AI calls go directly to Anthropic's API (or use mock responses in dev). Zustand stores sync state between UI and DB.

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
│   ├── (onboarding)/              # 3-screen progressive onboarding (+ discovery import sub-flow)
│   │   ├── day1-vision.tsx        # Vision → AI goal decomposition
│   │   ├── day1-career.tsx        # Career → AI skill gap analysis
│   │   ├── day1-routine.tsx       # Schedule → AI routine generation
│   │   ├── discovery-paste.tsx    # Paste Discovery Prompt output from ChatGPT/Claude
│   │   └── discovery-confirm.tsx  # Preview of extracted profile (grouped sections + confidence dots)
│   ├── (tabs)/                    # Main app (7 tabs)
│   │   ├── index.tsx              # Today: AvatarRing + HexRadar + streaks + quests + routine
│   │   ├── goals.tsx              # Goal hierarchy & daily tasks
│   │   ├── health.tsx             # Calories, weight, blood reports
│   │   ├── finance.tsx            # Transactions + goals (Gmail-integrated)
│   │   ├── career.tsx             # Skill gaps & learning resources
│   │   ├── explore.tsx            # Polymath (WIP)
│   │   └── rewards.tsx            # Gamification: LevelRing, ladder, badges, streaks, quests
│   ├── gmail-callback.tsx         # OAuth redirect handler (finance)
│   ├── settings.tsx
│   └── _layout.tsx                # Root: font loading, DB init, auth routing, session restore
├── src/
│   ├── ai/                        # AI layer
│   │   ├── client.ts              # Claude API client (API key or mock)
│   │   ├── functions.ts           # AI orchestration functions (incl. categorizeMerchant)
│   │   ├── types.ts               # Zod schemas for all AI responses
│   │   ├── prompts/               # System prompts per domain
│   │   └── mocks/                 # Static mock responses for dev
│   ├── db/
│   │   ├── schema.ts              # Drizzle table definitions (native SQLite)
│   │   ├── index.ts               # DB init (WAL mode, foreign keys)
│   │   ├── webStorage.ts          # localStorage user + session store (web)
│   │   ├── careerStorage.ts       # Named career path snapshots (localStorage)
│   │   └── queries/               # CRUD per entity — each branches on Platform.OS for web
│   ├── finance/                   # Finance intelligence layer
│   │   ├── gmail/                 # OAuth (PKCE) + Gmail API fetcher
│   │   ├── parsers/               # HDFC / ICICI / Axis regex parsers
│   │   ├── db/                    # Dexie (IndexedDB) transaction schema
│   │   ├── categorizer.ts         # Rule-based + Claude fallback categorizer
│   │   ├── insights.ts            # Behavioural insight detectors
│   │   └── store/                 # Zustand: transactions, sync state, token
│   ├── store/                     # Zustand stores (user, goals, game, theme)
│   ├── hooks/                     # useAI, useNotifications
│   ├── components/
│   │   ├── ui/                    # Design system (Button, Card, Input, etc.)
│   │   ├── shared/                # DailyBriefing, RoutineBlock, LifeBalanceDashboard, ProfileSidebar
│   │   └── modules/               # Domain-specific (goals/, health/, finance/, career/, social/, polymath/)
│   ├── theme/                     # Colors (dark+light), typography, spacing, shadows
│   └── utils/                     # Gamification logic, ID generation, auth (password hashing)
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

### 3.2 Today Screen (`app/(tabs)/index.tsx`)

- **Avatar + Profile Sidebar** — tap the header avatar (initials) to open `ProfileSidebar` (left-slide animation). Sidebar has Settings (theme toggle, notifications, privacy), Help, and Logout. Implemented in `src/components/shared/ProfileSidebar.tsx`.
- **Life Balance Dashboard** — now an **SVG hexagonal radar chart** built on `react-native-svg`. Responsive via `useWindowDimensions`, theme-reactive via `useColors()`. Implemented in `src/components/shared/LifeBalanceDashboard.tsx`.
- **Streak + XP chips** — live from `useGameStore`, shown in the header next to the avatar.
- **Daily Briefing** — AI-generated text from behavior analytics
- **Weekly Insight** — computed from `behaviourEvents` (peak hours, completion rate)
- **Routine Blocks** — time-sorted, tap to complete → logs event + awards XP + checks badges
- **Google Calendar card** — `Connect Google Calendar` button triggers OAuth; once connected, `Sync N blocks` pushes today's routine to the primary calendar as events with a 10-minute popup reminder (no `expo-notifications` needed — Google delivers the native push). Event IDs persist on each routine block via `setRoutineBlockCalendarEventId()` so subsequent syncs update in place rather than duplicate.

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
- Track milestone completion, get weekly AI insights

### 3.6 Career (`app/(tabs)/career.tsx`)

- State machine flow: **setup form → analysing → results**
- Displays skill gap chart from onboarding analysis
- Learning resources with status tracking (not_started → in_progress → completed)
- **Save Path modal** — names a career path snapshot and persists it to localStorage via `src/db/careerStorage.ts`
- **Load / Delete** saved paths from both setup and results views
- **Clear** button returns to blank setup form

### 3.7 Authentication

Email/password authentication, local-first — no backend.

| Concern | File | Notes |
|---------|------|-------|
| Sign-in screen | `app/(auth)/sign-in.tsx` | Validates against stored hash+salt |
| Sign-up screen | `app/(auth)/sign-up.tsx` | Generates salt, hashes, persists |
| Password utility | `src/utils/auth.ts` | `generateSalt()`, `hashPassword()`, `verifyPassword()` via `expo-crypto` SHA-256 |
| Native storage | `src/db/queries/users.ts` | SQLite branch (via Drizzle) when `Platform.OS !== 'web'` |
| Web storage | `src/db/webStorage.ts` | localStorage-backed user store with session |
| Session | `webSetSession(userId)` | Called on login; checked on app launch in `app/_layout.tsx` |

Routing in `app/_layout.tsx`: if no session, redirect to `(auth)/sign-in`; if session but `onboardingStage < 100`, redirect to `(onboarding)`; otherwise `(tabs)`.

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

All three Google integrations share a single PKCE OAuth driver at `src/integrations/google/oauth.ts` — parametrised by scopes, localStorage token key, sessionStorage verifier key, and redirect path. Adding a new Google product is ~40 lines of wrapper.

| Integration | Scope(s) | Redirect | Module | Callback screen |
|-------------|----------|----------|--------|------------------|
| Gmail (finance sync) | `gmail.readonly` | `/gmail-callback` | `src/finance/gmail/` | `app/gmail-callback.tsx` |
| Google Calendar (routine blocks) | `calendar.events` | `/calendar-callback` | `src/integrations/googleCalendar/` | `app/calendar-callback.tsx` |
| Google Fit (health metrics) | `fitness.activity.read`, `fitness.heart_rate.read`, `fitness.sleep.read`, `fitness.body.read`, `fitness.location.read`, `fitness.oxygen_saturation.read`, `fitness.blood_pressure.read` | `/fit-callback` | `src/integrations/googleFit/` | `app/fit-callback.tsx` |

**Google Calendar** — `syncBlocksToCalendar()` in `client.ts` creates new events for routine blocks missing a `calendarEventId`, updates the rest in place. 10-minute popup reminder is set via `reminders.overrides` so native push notifications come directly from Google's infra.

**Google Fit** — `syncFitDailyData(clientId, days=14)` pulls everything via two aggregate calls + one sessions call:
- Core aggregate: steps, active minutes, heart points, calories, distance, HR (avg/max/min), weight, body fat %, SpO2, blood pressure
- Sleep aggregate: `com.google.sleep.segment` → minutes per stage (deep/REM/light/awake)
- Sessions API: non-sleep workouts mapped to display names via `ACTIVITY_LABELS`

Setup: both Calendar and Fit require (a) enabling the respective API in Google Cloud Console, (b) adding the callback URL to Authorized redirect URIs, (c) providing `EXPO_PUBLIC_GOOGLE_CLIENT_ID` + `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` in `.env` (web-type OAuth clients still require the secret even with PKCE).

---

## 4. Data Model

**18 tables** defined in `src/db/schema.ts` (incl. `daily_reflections` and `discovery_imports`). All use UUID primary keys (`expo-crypto`), `createdAt`/`updatedAt` timestamps, and soft deletes where applicable.

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
Schema defined but modules not yet fully implemented (Social and Polymath are WIP).

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

All functions validate output with Zod schemas, support mock mode via `EXPO_PUBLIC_USE_AI_MOCK=true`, and call the Claude API at `https://api.anthropic.com/v1/messages`.

### DB Query Modules (`src/db/queries/`)

| File | Key Functions |
|------|--------------|
| `users.ts` | `createUser`, `getUser`, `updateOnboardingStage` |
| `goals.ts` | `createGoal`, `getGoalsByUser`, `completeGoal`, `getGoalChildren` |
| `routine.ts` | `createRoutineBlock`, `getRoutineBlocksForDate`, `updateRoutineBlockStatus` |
| `health.ts` | `createHealthLog`, `createFoodEntry`, `getFoodEntriesForDate`, `createBloodReport`, `getWeightHistory` |
| `finance.ts` | `createFinancialGoal`, `getActiveFinancialGoal`, `createMilestone`, `completeMilestone` |
| `behaviour.ts` | `logBehaviourEvent`, `getRecentEvents`, `generateWeeklyInsight` |
| `gamification.ts` | `getGamification`, `updateGamification`, `initializeGamification` |

### Zustand Stores (`src/store/`)

| Store | State | Key Methods |
|-------|-------|-------------|
| `useUserStore` | userId, name, onboardingStage | `setUser()`, `setOnboardingStage()`, `reset()` |
| `useGoalStore` | goals[] | `loadGoals()`, `addGoal()`, `completeGoal()` |
| `useGameStore` | domainScores, streaks, badges, XP, pendingBadges | `loadFromDB()`, `completeBlock()`, `addXP()`, `triggerStreak()`, `awardBadge()`, `popBadge()` |

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

| Variable | Purpose | Default |
|----------|---------|---------|
| `EXPO_PUBLIC_USE_AI_MOCK` | Use static mock AI responses | `false` |
| `ANTHROPIC_API_KEY` | Claude API key for real AI calls | (empty) |

### Development Notes

- **Mock mode** (`EXPO_PUBLIC_USE_AI_MOCK=true`): All AI functions return plausible static data from `src/ai/mocks/` — no API key needed
- **Database**: SQLite auto-initializes on first launch via `src/db/index.ts` with WAL mode + foreign keys enabled
- **No backend**: Everything runs on-device. No server to deploy.
- **TypeScript strict**: No `any`, all AI responses validated with Zod
- **Theme tokens**: All visual values come from `src/theme/` — never use inline style values
- **Component conventions**: `StyleSheet.create()` only, haptic feedback on interactions, Reanimated for animations

### Testing

- Manual testing via Expo dev client
- Mock data functions enable offline development
- TypeScript strict compilation catches type errors
- No automated test suite yet (recommended: Jest + React Native Testing Library)

### Current Branch

`lifeosv1` — Phase 1 implementation. Cloud sync (Supabase) is deferred to Phase 2.

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
