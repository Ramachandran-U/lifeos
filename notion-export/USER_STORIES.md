# User Stories Database

> Status options: Backlog · Planned · In Progress · Done. Stories inferred from features, commits, and routing.

## Onboarding & Auth

| Story | Epic | Status | User Value | Technical Notes | Dependencies |
|---|---|---|---|---|---|
| As a new user, I want to sign up with email/password so I can start using LifeOS without third-party accounts | Auth (email/password) | Done | Friction-free entry | `app/(auth)/sign-up.tsx`; SQLite users table | — |
| As a returning user, I want to sign in with Google so I don't have to remember another password | Auth (Supabase + Google) | Done | Trust + speed | Supabase OAuth + `google-auth-callback` | Supabase project |
| As a new user, I want to pick 1–3 life domains so the app builds my day around what I care about | Onboarding v1 | Done | Personal relevance | `app/welcome-intent.tsx`; persists `primaryDomains` | — |
| As a returning user, I want to import my existing ChatGPT/Claude profile so onboarding feels instant | Onboarding v2 | Done | Time saved | `app/(onboarding)/discovery-paste.tsx`; AI extracts profile | — |
| As a returning user, I want a conversational onboarding so I don't have to fill long forms | Onboarding v2 | Done | Better completion rate | `discovery-chat.tsx`; behind `onboarding_v2` flag | Feature flag |

## Routine & Today

| Story | Epic | Status | User Value | Technical Notes | Dependencies |
|---|---|---|---|---|---|
| As a user, I want a daily routine generated from my wake/sleep/work times so my day is realistic | Routine Builder | Done | Time-respecting plans | `planRoutineAgent` (propose → critique → commit) | Worker AI proxy |
| As a user, I want my priorities to weight my routine so what matters most gets the best slots | Priorities Editor | Done | Adaptive focus | `app/edit-priorities.tsx`; prompt updated to ranked allocation | — |
| As a user, I want to see today's blocks at a glance with a hex radar of my life balance | Today screen | Done | One-look daily state | HexRadar + RoutineBlock grid | — |
| As a user, I want to complete a routine block in one tap so progress feels effortless | Today screen | Done | Habit reinforcement | `useGameStore.completeBlock` awards XP + advances quest | — |
| As a user, I want my routine to never start before I wake up | Routine Time Bounds | Done | Trust in the AI | Hard prompt constraint + deterministic post-filter | — |
| As a user, I want validation if my wake/sleep/work times are inconsistent | Routine Time Bounds | Done | Avoid generating broken plans | Inline error before Generate is enabled | — |
| As a user, I want to edit my routine and have my wake/sleep times pre-filled with what I previously saved | Routine editor | Done | No double entry | `getUser()` seeds pickers on mount | — |

## Health

| Story | Epic | Status | User Value | Technical Notes | Dependencies |
|---|---|---|---|---|---|
| As a user, I want to log food fast with a calorie ring so I can see daily intake at a glance | Health Engine | Done | Friction-free tracking | `CalorieRing` + `AddFoodSheet` | — |
| As a user, I want to search Indian foods that match my diet | Health Engine | Done | Cultural relevance | IFCT 2017 (528 items) + INDB recipes (~1,000 items) bundled | — |
| As a user, I want barcode scanning so logging packaged food is effortless | Health Engine | Done | Speed | `BarcodeScannerWeb` + Open Food Facts lookup | Web BarcodeDetector |
| As a user, I want my weight and height persisted so I don't re-enter them every visit | Health Engine | Done | Continuity | `users.heightCm`, per-day `healthLogs.weight` | — |
| As a user, I want to upload a blood report and get safety-checked AI suggestions | Health Engine | Done | Catch outliers | `parseBloodReportSafety` eval; `bloodReports` table | — |
| As a user, I want my Google Fit data pulled automatically | Google Fit integration | Done | No manual logging | `syncFitDailyData` (14 days steps/sleep/HR/weight) | — |

## Finance

| Story | Epic | Status | User Value | Technical Notes | Dependencies |
|---|---|---|---|---|---|
| As a user, I want to set a financial goal with a target amount and a plan to reach it | Finance Engine | Done | Goal-driven savings | `FinanceGoalCard` + `generateFinancialPlan` | — |
| As a user, I want my transactions categorised automatically | Finance Engine | Done | No manual labelling | Rule-based + distilled local classifier + Claude tier | — |
| As a user, I want to connect Gmail so my bank transactions flow in without screenshots | Gmail integration | Done | Big time save | `src/finance/gmail/fetcher.ts` + bank parsers (HDFC/ICICI/Axis) | Worker token bridge |
| As a user, I want weekly insights about my spending so I can spot patterns | Finance Engine | Done | Behaviour change | `WeeklyInsightCard` + 4 Tier-1 detectors | — |
| As a user, I want to correct a category and have the system learn | Finance Engine | Partial | Trust + accuracy | XP awarded for corrections; classifier update path TBD | — |

## Career & Polymath

| Story | Epic | Status | User Value | Technical Notes | Dependencies |
|---|---|---|---|---|---|
| As a user, I want a skill-gap chart showing what to learn next for my target role | Career Engine | Done | Direction | `SkillGapChart` + `CareerStrategistView` | — |
| As a user, I want learning resources I can save and track | Career Engine | Done | Reduced choice fatigue | `LearningResourceCard` + Save/Load/Clear | — |
| As a user, I want to log curiosity-driven explorations so my mind stays sharp | Polymath Engine | Done | Identity reinforcement | `AddInterestSheet` + `LogExplorationSheet` + weekly target | — |

## Gamification

| Story | Epic | Status | User Value | Technical Notes | Dependencies |
|---|---|---|---|---|---|
| As a user, I want XP and levels so progress feels tangible | Gamification | Done | Motivation | `useGameStore` + `levelFromXP` + `xpProgressInLevel` | — |
| As a user, I want streaks for habits I care about | Gamification | Done | Loss aversion → consistency | `Streaks` updated by `updateStreak` | — |
| As a user, I want unlockable badges that mean something | Gamification | Done | Achievement loop | `checkBadges` runs on every significant action | — |
| As a user, I want daily and weekly quests as soft targets | Gamification | Done | Light structure | `useGameStore.advanceQuest` + daily reset | — |
| As a user, I want a "delta from yesterday" view on my life balance | HexRadar | Done | Reinforce growth | Dashed yesterday outline + green delta tint | History store |

## Settings & Privacy

| Story | Epic | Status | User Value | Technical Notes | Dependencies |
|---|---|---|---|---|---|
| As a user, I want to toggle gamification off if it's distracting | Settings | Done | Respect different mindsets | `usePreferencesStore.rewards` | — |
| As a user, I want to switch theme between light and dark | Settings | Done | Comfort | `useThemeStore` (with system option) | — |
| As a user, I want to control which notifications I get | Notifications | Done | Avoid notification fatigue | `scheduleDailyRoutineNotification` etc + Settings switches | — |
| As a user, I want to see what data LifeOS knows about me and edit it | Privacy + Profile | Done | Trust | `app/what-lifeos-knows.tsx` (profile slot editor) | — |
| As a user, I want to control where my data lives and who sees telemetry | Privacy | Done | Trust | `app/data-residency.tsx` + telemetry opt-in | — |
| As a user, I want to export or delete all my data | Privacy | Done | Right to leave | `app/settings.tsx` export + delete flows | — |

## Voice & Chat

| Story | Epic | Status | User Value | Technical Notes | Dependencies |
|---|---|---|---|---|---|
| As a user, I want to ask LifeOS questions about my own profile in a chatbot | Ask LifeOS | Done | Conversational reflection | `app/chat.tsx` + `buildProfileContext` | — |
| As a user, I want voice-driven journaling and quick capture | Voice Assistant | Done | Hands-free | `voiceClient.ts` (WebSocket) + `VoiceAssistantSheet` | Worker realtime |

## Backlog (not yet shipped)

| Story | Epic | Priority |
|---|---|---|
| As a user, I want LifeOS to never start before my chosen wake time on **every** subsystem (incl. evening reflect's tomorrow generation) | Routine Time Bounds | P0 |
| As a user, I want offline access on web | Web parity | P2 |
| As a user, I want my data synced across devices | Multi-device sync | P2 |
| As a user, I want push notifications to actually reach my device | Push delivery | P0 |
| As a user, I want a UI to inspect my AI cost over time | Cost transparency | P2 |
| As a user, I want only ONE onboarding flow that adapts to me | Onboarding v2 graduation | P2 |
| As a developer-operator, I want telemetry events to be typed | Typed telemetry events | P1 |
