# ARCHITECTURE_MAP — LifeOS

Subsystem-by-subsystem map. Paths are repo-relative.

---

## 1. Routing & Screens (`app/`)

**Purpose:** Expo Router file-based routes; web + native shells.

**Entry points:**
- `app/_layout.tsx` — root layout, providers, theme hydration
- `app/(auth)/_layout.tsx`, `app/(onboarding)/_layout.tsx`, `app/(tabs)/_layout.tsx`
- `app/+html.tsx` — web HTML shell

**Route groups:**
| Group | Files |
|-------|-------|
| `(auth)/` | `welcome.tsx`, `sign-in.tsx`, `sign-up.tsx` |
| `(onboarding)/` | `day1-vision`, `day1-career`, `day1-routine`, `day3-health`, `day7-finance`, `day7-social`, `day14-polymath`, `discovery-intro`, `discovery-paste`, `discovery-chat`, `discovery-confirm` |
| `(tabs)/` | `index` (home/today), `goals`, `health`, `finance`, `career`, `social`, `explore`, `life`, `rewards`, `profile` |
| Standalone | `chat`, `evening-reflect`, `annual-review`, `monthly-insight`, `expedition-detail`, `feedback`, `settings`, `notifications-settings`, `data-residency`, `terms-privacy`, `welcome-intent`, `how-it-works`, `edit-priorities`, `what-lifeos-knows`, `finance-category`, `finance-merchant`, `finance-review`, `contact/[id]` |
| OAuth callbacks | `calendar-callback`, `fit-callback`, `gmail-callback`, `google-auth-callback` (all use shared `OAuthCallbackView`) |

**Dependencies:** every store, AI functions module, db queries, UI/component libraries.

**Architectural responsibilities:** route-level data loading, sheet/modal orchestration, user flows. Several screens are very large (see TECH_DEBT_CANDIDATES — finance.tsx 1530 LOC, index.tsx 1124 LOC).

---

## 2. AI Layer (`src/ai/`)

**Purpose:** Single ingress (`callAI`) → Cloudflare Worker proxy → Gemini (and Claude). All structured-output AI functions + prompts + mocks + telemetry + cost tracking + agent loop + RAG live here.

**Entry points:**
- `src/ai/client.ts` — `callAI(request)`; thin HTTP wrapper around `/claude` endpoint of proxy, with Supabase JWT
- `src/ai/functions.ts` (831 LOC) — 27 exported AI functions (decomposeGoal, analyseSkillGap, generateRoutine, parseBloodReport, suggestMeals, generateFinancialPlan, generateMoneyReview, getWeeklyFinanceInsight, categorizeMerchant[+Batch], recogniseFood, generateCareerStrategy, describeGoal, generateMotivation, extractDiscoveryProfile, suggestTomorrowTweak, discoveryChatTurn, replanRemainingDay, generateTomorrowRoutine, generateConversationStarters, suggestInterestAreas, suggestCrossDisciplineLink, generateWeekRoutine, generateMonthlyInsightReport, generateDailyBriefing, assessTrajectory, generateAnnualReview)
- `src/ai/agent/planner.ts` (293 LOC) — propose / critique / brief loop (`agent.propose`, `agent.critique`, `agent.brief`)
- `src/ai/voiceClient.ts` — Gemini Live voice session
- `src/ai/micCapture.ts` — mic stream capture

**Supporting modules:**
- `modelRouter.ts` — per-task tier (`cheap`/`planning`/`reasoning`) → Gemini model id
- `extractJson.ts` — robust JSON extraction from model output
- `costLedger.ts` — in-memory token + USD ledger keyed by model/task
- `tracing.ts` — span start/end → telemetry
- `profileContext.ts`, `profileLearning.ts`, `profileMerge.ts` — long-running user-profile derivation
- `historyContext.ts` — recent-event context window builder
- `behaviourApply.ts`, `replanApply.ts`, `routineFromProfile.ts`, `routinePlanner.ts` — apply/derive logic that wraps AI output
- `prompts/` — 17 prompt files (annualReview, behaviour, briefing, career, chatbot, discovery, discoveryChat, finance, goals, health, moneyReview, polymath, reflection, routine, social, trajectory)
- `mocks/` — 16 mock files mirroring prompt files
- `rag/embed.ts`, `rag/retrieve.ts` — embedding + retrieval scaffold
- `types.ts` (930 LOC) — every Zod schema + TS type for AI inputs/outputs

**Dependencies:** `@/integrations/supabase/session` (JWT), `@/utils/telemetry`, `@/store/usePromptStore` (live prompt overrides from admin portal), `zod`.

**Dependents:** screens (via direct imports), `useDailyBriefing` hook, `DailySummarySheet`, `explore/spark.ts`, `explore/expeditionGen.ts`, `finance/moneyReview.ts`, gamification orchestrator.

**Responsibilities:** All LLM I/O, schema validation, fallback to mocks (`EXPO_PUBLIC_USE_AI_MOCK=true`), cost & schema-failure observability, model selection.

---

## 3. AI Proxy Worker (`workers/ai-proxy/`)

**Purpose:** Cloudflare Worker that fronts Gemini + Claude with Supabase JWT auth and rate limiting.

**Entry points:** `src/index.ts` (362 LOC — routes `/claude`, health, etc.).

**Files:** `auth.ts` (Supabase JWT verify, 18 LOC), `claude.ts` (340 LOC — Anthropic call + cache_control), `gemini.ts` (64 LOC — Gemini call), `rateLimit.ts` (15 LOC).

**Dependencies:** `jose` (JWT verify), Cloudflare Workers types.

**Dependents:** every `callAI` from the app.

---

## 4. State Management (`src/store/`)

**Purpose:** Zustand stores for global UI / domain state. See `STORE_TOPOLOGY.md` for the full graph.

**Stores:** `useUserStore`, `useGameStore`, `useGoalStore`, `usePolymathStore`, `useTrajectoryStore`, `useDomainHistoryStore`, `useFlagStore`, `useMotivationStore`, `usePreferencesStore`, `usePromptStore`, `useRewardQueueStore`, `useTelemetryStore`, `useThemeStore`, `useBehaviourSuggestionsStore`, `useAnnualReviewStore`.

**Extra stores outside `src/store/`:** `src/finance/store/{useTransactionStore,useMoneyReviewStore,useRecurringStore}.ts`, `src/components/shared/ambient/useAmbientEventStore.ts` and `useAmbientState.ts`.

---

## 5. Persistence (`src/db/`)

**Purpose:** SQLite (native) + IndexedDB-via-Dexie (web) with Drizzle ORM schema. Web parity layer is a hand-rolled key/value mirror.

**Entry points:**
- `src/db/index.ts` (360 LOC) — native Drizzle client + migration runner
- `src/db/index.web.ts` — web stub routing to `webStorage`
- `src/db/schema.ts` (317 LOC) — every table (users, goals, plus joined entities)

**Subdirs:**
- `queries/` — 17 files, one per entity (behaviour, chat, cognitiveInsights, discovery, discoverySeed, expeditions, finance, gamification, goalComments, goals, health, interests, reflections, routine, social, sparks, userProfile, users)
- `webStorage/` — 16 files mirroring `queries/` for the web build via Dexie/AsyncStorage
- `migrations/` — Drizzle SQL (`0000`…`0003`)

**Dependents:** every screen + AI function that reads/writes user data.

---

## 6. Hooks (`src/hooks/`)

| File | LOC | Purpose |
|------|----:|---------|
| `useAI.ts` | 26 | Generic AI call wrapper |
| `useDailyBriefing.ts` | 91 | Wraps `generateDailyBriefing` |
| `useNotifications.ts` | 246 | expo-notifications scheduling + permission |
| `useOnboardingNarration.ts` | 99 | ElevenLabs onboarding voice |
| `useScreenTracking.ts` | 23 | Telemetry on screen view |
| `useTypedText.ts` | 48 | Typewriter effect |
| `useVoice.ts` | 132 | Mic capture + voice session glue |

---

## 7. Components (`src/components/`)

**Layout:**
- `ui/` — design-system primitives: Button, Card, Input, ProgressBar, Badge, Skeleton, Sparkline, StreakCounter, Typography, Text, GlassCard, AuroraGlow, DomainChip, DomainGlyph, LoadingDots, ModuleHeader, SectionLabel, WheelTimePicker
- `shared/` — cross-module composites: `LifeBalanceDashboard`, `LifeScoreHero`, `LifeHubSheet`, `RoutineBlock`, `DailyBriefing`, `DailySummarySheet`, `WeeklyBalanceCard`, `YesterdayLogSheet`, `AchievementToast`, `AdaptationCard`, `DomainNudgeCard`, `MotivationBanner`, `NarrationToggle`, `ProfileSidebar`, `VoiceAssistantSheet`, `OAuthCallbackView`, `Confetti`, `ErrorBoundary`, `Aurora{Animated,}Background`
- `shared/ambient/` — `EnergySweep`, `GradientMesh`, `ParticleField`, `PulseHalo`, `presets.ts`, `useAmbientEventStore`, `useAmbientState`
- `gamification/` — `XpBar`, `XpChip`, `LevelRing`, `LevelLadder`, `LevelUpOverlay`, `BadgeCard`, `BadgeTile`, `QuestCard`, `QuestDetailSheet`, `HexRadar`, `StreakFlame`, `StreakRow`, `Sparkline`, `AvatarRing`, `DomainMiniCard`, `RewardOrchestrator`
- `modules/<domain>/` — per-engine widgets (career, finance, goals, health, polymath, social)

---

## 8. Design System (`src/theme/`)

`colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`, `shadows.ts`, `elevation.ts`, `motion.ts`, `density.ts`, `surfaces.ts`, `index.ts`. Dark-mode-first token system (see CLAUDE.md).

---

## 9. Cognition & Insights (`src/cognition/`)

- `domainStagnation.ts` — detects stagnant domains over rolling window
- `domainSuggestions.ts` — emits Adaptation/Nudge prompts
- `types.ts`

**Dependents:** `AdaptationCard`, `DomainNudgeCard`, `useBehaviourSuggestionsStore`.

---

## 10. Explore / Polymath engine (`src/explore/`)

- `constellation.ts` — interest-graph layout
- `expeditions.ts` + `expeditionGen.ts` — multi-step exploration plans (`generateExpedition` task)
- `spark.ts` — daily spark generation (`generateDailySpark` task)

Backed by `src/db/queries/{sparks,expeditions,interests}.ts`.

---

## 11. Finance subsystem (`src/finance/`)

Self-contained domain: `analytics.ts` (+ `samePeriodMonthWindows`), `categorizer.ts`, `merchantClassifier.ts`, `categoryGroups.ts`, `display.ts`, `insights.ts`, `moneyReview.ts`, `recurringSummary.ts`, `parsers/{emailParsers,billParsers}.ts`, `gmail/{fetcher,oauth}.ts`, `db/transactionDb.ts`, `store/{useTransactionStore,useMoneyReviewStore,useRecurringStore}.ts`. Feeds `app/(tabs)/finance.tsx` and AI prompts (finance, moneyReview). Bills/subscriptions also feed the planner + what-next agent via `src/ai/billsContext.ts`.

---

## 12. Sync layer (`src/sync/`)

`hashChain.ts`, `lamport.ts`, `mutationLog.ts` — append-only mutation log + Lamport clocks + hash chaining, designed for future Supabase sync. Not yet wired into main writes (tests in `src/sync/__tests__/`).

---

## 13. Integrations (`src/integrations/`)

| Module | Files | Notes |
|--------|-------|-------|
| `google/oauth.ts` | 220 LOC | Shared PKCE factory `createGoogleOAuthClient` |
| `googleAuth/{client,oauth}.ts` | | Sign-in via Google |
| `googleCalendar/{client,oauth}.ts` | | Calendar read/write for routine sync |
| `googleFit/{client,oauth}.ts` | 314 LOC client | Fit metrics ingestion |
| `supabase/{auth,client,session}.ts` | | Anon client + session token vendor |
| `elevenlabs/{client,scripts}.ts` | | Onboarding TTS |

`src/finance/gmail/oauth.ts` is a parallel Gmail OAuth (not yet on the shared driver).

---

## 14. Gamification

State: `useGameStore` (281 LOC) + `useRewardQueueStore` + `useDomainHistoryStore`.
Components: `src/components/gamification/*`, `RewardOrchestrator` (composes XP/streak/level reward beats), `AchievementToast`.
Constants/Utils: `src/constants/gamification.ts`, `src/utils/gamification.ts`, `src/utils/lifeScore.ts`.
Persistence: `src/db/queries/gamification.ts`, `src/db/webStorage/gamification.ts`.

---

## 15. Telemetry & Observability

- `src/utils/telemetry.ts` — `track(event, props)` API + `EVENTS` enum
- `src/ai/tracing.ts` — span start/end → telemetry
- `src/ai/costLedger.ts` — token/$$ accounting
- `useTelemetryStore` — local buffer
- Admin portal pages: `admin/app/(authed)/telemetry/`, `evals/`, `schema-failures/`, `feedback/`, `push/`

Supabase migration `0003_telemetry.sql` defines the sink.

---

## 16. Evals (`evals/`)

- `eval.test.ts` — main runner
- `cases/*` — per-AI-function test cases (decomposeGoal, generateRoutine, generateFinancialPlan, categorizeMerchant, discoveryChat, planRoutineAgent, ragRetrieve, parseBloodReportSafety, replanRemainingDay)
- `datasets/merchants.ts`
- `grader.ts`, `types.ts`
- `benchmarks/merchantBenchmark.test.ts`
- `reports/` — latest.json + latest.md + traces.jsonl

Run via `npm run evals` (`EVAL_REAL=true` for live). CI: `.github/workflows/evals.yml`.

---

## 17. Voice subsystem

- `src/ai/voiceClient.ts` (193 LOC) — Gemini Live API wrapper
- `src/ai/micCapture.ts` — Web/Native mic stream
- `src/hooks/useVoice.ts` — hook glue
- `src/components/shared/VoiceAssistantSheet.tsx` (239 LOC) — UI
- Worker: `workers/ai-proxy/src/gemini.ts` — proxy

---

## 18. Admin Portal (`admin/`)

Next.js 14 + Supabase. Pages: prompts (`prompts/[key]`), telemetry, evals, schema-failures, feedback, push, flags. Hits the worker via `admin/lib/worker.ts`.

---

## 19. Memory / Agent abstractions

- Profile memory: `src/ai/profileContext.ts`, `profileLearning.ts`, `profileMerge.ts`
- History context: `src/ai/historyContext.ts`
- RAG: `src/ai/rag/{embed,retrieve}.ts`
- Agent loop: `src/ai/agent/planner.ts` (propose → critique → brief)
- Long-running behaviour patterns: `src/utils/behaviourPatterns.ts` (332 LOC), `src/db/queries/behaviour.ts`, `useBehaviourSuggestionsStore`
