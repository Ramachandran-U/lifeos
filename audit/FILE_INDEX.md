# FILE_INDEX — LifeOS source files

Categorized index. Excludes `node_modules/`, `dist/`, `test-results/`, `smoke-output/`, `tmp/`, generated reports, binary assets. Categories: route | layout | store | ai | prompt | mock | component | hook | db | query | webstore | migration | integration | finance | explore | cognition | sync | theme | util | test | eval | worker | admin | script | doc | config.

## Routes & layouts (`app/`)

| Path | Category | Subsystem | Description |
|------|---------|-----------|-------------|
| `app/_layout.tsx` | layout | routing | Root Expo Router layout — providers, theme hydration |
| `app/+html.tsx` | layout | routing/web | HTML shell for web build |
| `app/(auth)/_layout.tsx` | layout | auth | Auth group layout |
| `app/(auth)/welcome.tsx` | route | auth | Welcome screen |
| `app/(auth)/sign-in.tsx` | route | auth | Email/Google/Apple sign-in |
| `app/(auth)/sign-up.tsx` | route | auth | Account creation |
| `app/(onboarding)/_layout.tsx` | layout | onboarding | Onboarding group layout |
| `app/(onboarding)/day1-vision.tsx` | route | onboarding | Day 1 — vision statement |
| `app/(onboarding)/day1-career.tsx` | route | onboarding | Day 1 — career questions |
| `app/(onboarding)/day1-routine.tsx` | route | onboarding | Day 1 — initial routine build |
| `app/(onboarding)/day3-health.tsx` | route | onboarding | Day 3 — health goal |
| `app/(onboarding)/day7-finance.tsx` | route | onboarding | Day 7 — finance setup |
| `app/(onboarding)/day7-social.tsx` | route | onboarding | Day 7 — social setup |
| `app/(onboarding)/day14-polymath.tsx` | route | onboarding | Day 14 — polymath / interests |
| `app/(onboarding)/discovery-intro.tsx` | route | onboarding | Discovery onboarding intro |
| `app/(onboarding)/discovery-paste.tsx` | route | onboarding | Paste-existing-context route |
| `app/(onboarding)/discovery-chat.tsx` | route | onboarding | AI discovery chat |
| `app/(onboarding)/discovery-confirm.tsx` | route | onboarding | Discovery summary + confirm |
| `app/(tabs)/_layout.tsx` | layout | tabs | Tab bar layout |
| `app/(tabs)/index.tsx` | route | tabs/home | Home/Today — Routine Builder (1124 LOC) |
| `app/(tabs)/goals.tsx` | route | tabs/goals | Goals tab |
| `app/(tabs)/health.tsx` | route | tabs/health | Health tab |
| `app/(tabs)/finance.tsx` | route | tabs/finance | Finance tab (1530 LOC — largest) |
| `app/(tabs)/career.tsx` | route | tabs/career | Career & Upskill |
| `app/(tabs)/social.tsx` | route | tabs/social | Social intelligence |
| `app/(tabs)/explore.tsx` | route | tabs/polymath | Polymath explorer |
| `app/(tabs)/life.tsx` | route | tabs/life | Life dashboard |
| `app/(tabs)/rewards.tsx` | route | tabs/gamification | Rewards / XP / badges |
| `app/(tabs)/profile.tsx` | route | tabs/profile | Profile + settings entrypoint |
| `app/chat.tsx` | route | chat | Standalone AI chat |
| `app/evening-reflect.tsx` | route | reflection | Evening reflection flow |
| `app/annual-review.tsx` | route | reflection | Annual review screen |
| `app/monthly-insight.tsx` | route | reflection | Monthly insight report |
| `app/expedition-detail.tsx` | route | polymath | Expedition detail |
| `app/feedback.tsx` | route | feedback | User feedback form |
| `app/settings.tsx` | route | settings | Settings hub |
| `app/notifications-settings.tsx` | route | settings | Notifications prefs |
| `app/data-residency.tsx` | route | settings | Data residency info |
| `app/terms-privacy.tsx` | route | settings | Legal page |
| `app/welcome-intent.tsx` | route | onboarding | Initial domain selection |
| `app/how-it-works.tsx` | route | marketing | How LifeOS works explainer |
| `app/edit-priorities.tsx` | route | settings | Priority editor |
| `app/what-lifeos-knows.tsx` | route | profile | User profile knowledge dump (839 LOC) |
| `app/finance-category.tsx` | route | finance | Finance category drill-in |
| `app/finance-merchant.tsx` | route | finance | Finance merchant detail |
| `app/finance-review.tsx` | route | finance | Money review screen |
| `app/contact/[id].tsx` | route | social | Contact detail (dynamic) |
| `app/calendar-callback.tsx` | route | integration | Google Calendar OAuth callback |
| `app/fit-callback.tsx` | route | integration | Google Fit OAuth callback |
| `app/gmail-callback.tsx` | route | integration | Gmail OAuth callback |
| `app/google-auth-callback.tsx` | route | integration | Google sign-in OAuth callback |

## AI core (`src/ai/`)

| Path | Category | Description |
|------|---------|-------------|
| `src/ai/client.ts` | ai | `callAI` HTTP wrapper → Cloudflare worker |
| `src/ai/functions.ts` | ai | 27 AI functions (831 LOC) |
| `src/ai/types.ts` | ai | Zod schemas + TS types (930 LOC) |
| `src/ai/modelRouter.ts` | ai | Per-task tier→Gemini model |
| `src/ai/extractJson.ts` | ai | Robust JSON extraction |
| `src/ai/costLedger.ts` | ai | Token + USD cost ledger |
| `src/ai/tracing.ts` | ai | Span start/end → telemetry |
| `src/ai/behaviourApply.ts` | ai | Apply behaviour suggestions |
| `src/ai/replanApply.ts` | ai | Apply replan output to routine |
| `src/ai/routineFromProfile.ts` | ai | Derive routine from profile |
| `src/ai/routinePlanner.ts` | ai | Routine planning helpers |
| `src/ai/profileContext.ts` | ai | Build prompt-time profile slice |
| `src/ai/profileLearning.ts` | ai | Update profile from observations |
| `src/ai/profileMerge.ts` | ai | Merge partial profile updates |
| `src/ai/historyContext.ts` | ai | Recent-event window builder |
| `src/ai/micCapture.ts` | ai | Mic stream capture (web+native) |
| `src/ai/voiceClient.ts` | ai | Gemini Live voice client |
| `src/ai/agent/planner.ts` | ai | propose/critique/brief agent loop |
| `src/ai/rag/embed.ts` | ai | Embedding generation |
| `src/ai/rag/retrieve.ts` | ai | Vector retrieval |

## Prompts (`src/ai/prompts/`)

17 files — `annualReview.ts`, `behaviour.ts`, `briefing.ts`, `career.ts`, `chatbot.ts`, `discovery.ts`, `discoveryChat.ts`, `finance.ts`, `goals.ts`, `health.ts`, `moneyReview.ts`, `polymath.ts`, `reflection.ts`, `routine.ts`, `social.ts`, `trajectory.ts`. Each: `prompt | ai | System prompt for the matching domain function`.

## Mocks (`src/ai/mocks/`)

16 files — same names as prompts (no `chatbot`, no `discovery-vs-discoveryChat` separation for some). Category: `mock | ai | Static response for USE_AI_MOCK=true`.

## AI tests (`src/ai/__tests__/`)

`careerStrategy.test.ts`, `costLedger.test.ts`, `extractJson.test.ts`, `financialPlan.test.ts`, `goalInjection.test.ts`, `micCapture.test.ts`, `planner.test.ts`, `routineFromProfile.test.ts`, `skillGapSanitize.test.ts`, `tracing.test.ts`. Plus `mocks/__tests__/{annualReview,briefing}.test.ts`, `rag/__tests__/retrieve.test.ts`. Category: `test | ai`.

## Stores (`src/store/`)

| Path | Category | Description |
|------|---------|-------------|
| `src/store/useUserStore.ts` | store | Logged-in user + onboarding stage |
| `src/store/useGameStore.ts` | store | Gamification (XP, streaks, badges, quests) |
| `src/store/useGoalStore.ts` | store | Goals cache |
| `src/store/usePolymathStore.ts` | store | Interests + suggestion caches |
| `src/store/useTrajectoryStore.ts` | store | Trajectory assessment cache |
| `src/store/useDomainHistoryStore.ts` | store | Domain score history |
| `src/store/useFlagStore.ts` | store | Feature flags |
| `src/store/useMotivationStore.ts` | store | Motivation copy cache |
| `src/store/usePreferencesStore.ts` | store | Theme/density/motion prefs |
| `src/store/usePromptStore.ts` | store | Live prompt overrides |
| `src/store/useRewardQueueStore.ts` | store | XP/badge reward beat queue |
| `src/store/useTelemetryStore.ts` | store | Legacy telemetry buffer shim |
| `src/store/useThemeStore.ts` | store | Theme mode (custom signature) |
| `src/store/useBehaviourSuggestionsStore.ts` | store | Behaviour suggestion cache |
| `src/store/useAnnualReviewStore.ts` | store | Annual review cache |
| `src/store/__tests__/useDomainHistoryStore.test.ts` | test | store test |
| `src/store/__tests__/useTrajectoryStore.test.ts` | test | store test |

## Hooks (`src/hooks/`)

| Path | Description |
|------|-------------|
| `src/hooks/useAI.ts` | Generic AI call hook |
| `src/hooks/useDailyBriefing.ts` | Daily briefing fetch+cache |
| `src/hooks/useNotifications.ts` | expo-notifications scheduling |
| `src/hooks/useOnboardingNarration.ts` | ElevenLabs narration |
| `src/hooks/useScreenTracking.ts` | Screen-view telemetry |
| `src/hooks/useTypedText.ts` | Typewriter effect |
| `src/hooks/useVoice.ts` | Voice session glue |

## DB schema + queries (`src/db/`)

| Path | Category | Description |
|------|---------|-------------|
| `src/db/schema.ts` | db | Drizzle table definitions (317 LOC) |
| `src/db/index.ts` | db | Native SQLite client + migration runner (360 LOC) |
| `src/db/index.web.ts` | db | Web stub routing to webStorage |
| `src/db/webStorage.ts` | db | Web key/value bootstrap |
| `src/db/careerStorage.ts` | db | Career-specific persistence |
| `src/db/migrations/0000_classy_doctor_spectrum.sql` | migration | Initial schema |
| `src/db/migrations/0001_social.sql` | migration | Social tables |
| `src/db/migrations/0002_polymath.sql` | migration | Polymath tables |
| `src/db/migrations/0003_health_onboarding.sql` | migration | Health onboarding additions |
| `src/db/migrations/meta/_journal.json` | migration | Drizzle journal |
| `src/db/migrations/meta/0000_snapshot.json` | migration | Drizzle snapshot |
| `src/db/migrations/migrations.js` | migration | Migration runner stub |

### Native queries (`src/db/queries/`)
17 files: `behaviour`, `chat`, `cognitiveInsights`, `discovery`, `discoverySeed`, `expeditions`, `finance`, `gamification`, `goalComments`, `goals`, `health`, `interests`, `reflections`, `routine`, `social`, `sparks`, `userProfile`, `users`. Category: `query | db | CRUD for matching entity (SQLite/Drizzle)`.

### Web queries (`src/db/webStorage/`)
Mirror set: `_io.ts`, `_keys.ts`, `chat`, `cognitiveInsights`, `discovery`, `expeditions`, `finance`, `gamification`, `goals`, `health`, `polymath`, `reflections`, `routine`, `social`, `sparks`, `userProfile`, `users`. Category: `webstore | db | Web parity (Dexie/AsyncStorage)`. Tests: `__tests__/{cognitiveInsights,expeditions,routine,sparks}.test.ts`.

### DB tests
`src/db/__tests__/goalComments.test.ts`, `src/db/__tests__/social.test.ts`.

## Components (`src/components/`)

### UI primitives (`src/components/ui/`)
19 files: `AuroraGlow`, `Badge`, `Button`, `Card`, `DomainChip`, `DomainGlyph`, `GlassCard`, `Input`, `LoadingDots`, `ModuleHeader`, `ProgressBar`, `SectionLabel`, `Skeleton`, `Sparkline`, `StreakCounter`, `Text`, `Typography`, `WheelTimePicker`, `index.ts`. Category: `component | ui | Base design-system primitive`.

### Shared composites (`src/components/shared/`)
20 files: `AchievementToast`, `AdaptationCard`, `AuroraAnimatedBackground`, `AuroraBackground`, `Confetti`, `DailyBriefing`, `DailySummarySheet`, `DomainNudgeCard`, `ErrorBoundary`, `LifeBalanceDashboard`, `LifeHubSheet`, `LifeScoreHero`, `MotivationBanner`, `NarrationToggle`, `OAuthCallbackView`, `ProfileSidebar`, `RoutineBlock`, `VoiceAssistantSheet`, `WeeklyBalanceCard`, `YesterdayLogSheet`. Category: `component | shared | Cross-module composite`.

### Ambient UX (`src/components/shared/ambient/`)
`EnergySweep`, `GradientMesh`, `ParticleField`, `PulseHalo`, `presets.ts`, `useAmbientEventStore.ts`, `useAmbientState.ts`. Category: `component | ambient`.

### Gamification (`src/components/gamification/`)
16 files: `AvatarRing`, `BadgeCard`, `BadgeTile`, `DomainMiniCard`, `HexRadar`, `LevelLadder`, `LevelRing`, `LevelUpOverlay`, `QuestCard`, `QuestDetailSheet`, `RewardOrchestrator`, `Sparkline`, `StreakFlame`, `StreakRow`, `XpBar`, `XpChip`. Category: `component | gamification`.

### Module-specific
- `components/modules/career/` — `CareerStrategyView`, `LearningResourceCard`, `SkillGapChart`
- `components/modules/finance/` — `FinanceGoalCard`, `MilestoneTracker`, `WeeklyInsightCard`
- `components/modules/goals/` — `AddGoalSheet`, `GoalCard`, `GoalDetailSheet`, `GoalHierarchy`, `TrajectoryCard`
- `components/modules/health/` — `AddFoodSheet`, `BarcodeScannerWeb`, `BloodReportCard`, `CalorieRing`, `EditVitalsSheet`, `FitDashboard`, `FoodEntryRow`, `HealthSummaryCard`, `StatTile`, `VitalsCard`, `WeightChart`
- `components/modules/polymath/` — `AddInterestSheet`, `ConstellationView`, `CrossDisciplineCard`, `DepthSheet`, `DiscoverGrid`, `ExpeditionProgressRow`, `InterestCard`, `LogExplorationSheet`, `SparkHeroCard`, `discoverArea.ts`
- `components/modules/social/` — `AddContactSheet`, `ContactRow`, `SocialScoreCard`

## Theme (`src/theme/`)

`colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`, `shadows.ts`, `elevation.ts`, `motion.ts`, `density.ts`, `surfaces.ts`, `index.ts`. Category: `theme | design-system`.

## Integrations (`src/integrations/`)

| Path | Description |
|------|-------------|
| `src/integrations/google/oauth.ts` | Shared Google PKCE factory (220 LOC) |
| `src/integrations/googleAuth/oauth.ts` | Google sign-in OAuth |
| `src/integrations/googleAuth/client.ts` | Google sign-in REST |
| `src/integrations/googleCalendar/oauth.ts` | Calendar OAuth |
| `src/integrations/googleCalendar/client.ts` | Calendar REST client |
| `src/integrations/googleFit/oauth.ts` | Fit OAuth |
| `src/integrations/googleFit/client.ts` | Fit REST (314 LOC) |
| `src/integrations/supabase/auth.ts` | Supabase auth helpers |
| `src/integrations/supabase/client.ts` | Supabase client init |
| `src/integrations/supabase/session.ts` | Access-token vendor |
| `src/integrations/elevenlabs/client.ts` | ElevenLabs TTS client |
| `src/integrations/elevenlabs/scripts.ts` | Onboarding narration scripts |

## Finance subsystem (`src/finance/`)

| Path | Description |
|------|-------------|
| `src/finance/analytics.ts` | Finance analytics |
| `src/finance/categorizer.ts` | Rule-based categoriser (281 LOC) |
| `src/finance/categoryGroups.ts` | Category taxonomy |
| `src/finance/display.ts` | Display formatters |
| `src/finance/insights.ts` | Insight derivations |
| `src/finance/merchantClassifier.ts` | Merchant classification (238 LOC) |
| `src/finance/moneyReview.ts` | Money review input builder |
| `src/finance/db/transactionDb.ts` | Transaction persistence |
| `src/finance/gmail/fetcher.ts` | Gmail email fetcher |
| `src/finance/gmail/oauth.ts` | Gmail OAuth (parallel to shared driver) |
| `src/finance/parsers/emailParsers.ts` | Bank email parsers |
| `src/finance/store/useTransactionStore.ts` | Transaction Zustand store |
| `src/finance/store/useMoneyReviewStore.ts` | Money review cache store |

Tests: `analytics`, `categorizer`, `categoryGroups`, `merchantClassifier`, `moneyReview`, `storeHelpers`, `parsers/emailParsers`.

## Explore (`src/explore/`)

`constellation.ts`, `expeditions.ts`, `expeditionGen.ts`, `spark.ts`. Tests: all four.

## Cognition (`src/cognition/`)

`domainStagnation.ts`, `domainSuggestions.ts`, `types.ts`. Tests for both behaviours.

## Sync (`src/sync/`)

`hashChain.ts`, `lamport.ts`, `mutationLog.ts` + tests + `testHasher.ts` helper.

## Config & constants

| Path | Description |
|------|-------------|
| `src/config/flags.ts` | Feature flag definitions |
| `src/config/__tests__/flags.test.ts` | Flag tests |
| `src/constants/gamification.ts` | XP curve, badge thresholds |

## Data

| Path | Description |
|------|-------------|
| `src/data/foods/index.ts` | Food DB entry |
| `src/data/foods/seed.ts` | Inline food seed (355 LOC — should be generated) |
| `src/data/foods/types.ts` | Food types |
| `src/data/foods/ifct.json` | IFCT raw data |
| `src/data/foods/indb.json` | INDB raw data |

## Utils (`src/utils/`)

`annualReviewBuilder.ts`, `auth.ts`, `behaviourPatterns.ts` (332 LOC), `currency.ts`, `feedback.ts`, `fitInsights.ts`, `foodSearch.ts`, `gamification.ts` (283 LOC), `goalTypeColor.ts`, `health.ts`, `id.ts`, `lifeScore.ts`, `monthlyInsightBuilder.ts`, `openFoodFacts.ts`, `persistHierarchy.ts`, `polymath.ts`, `pushRegister.ts`, `routeGuard.ts`, `routineBalance.ts`, `scheduleSync.ts`, `signOut.ts`, `starterRoutine.ts`, `telemetry.ts`, `trajectory.ts`, `upgradeFoodRecognition.ts`. Tests for 10 of these.

## Worker (`workers/ai-proxy/src/`)

| Path | Description |
|------|-------------|
| `workers/ai-proxy/src/index.ts` | Worker entry (362 LOC) |
| `workers/ai-proxy/src/auth.ts` | Supabase JWT verify |
| `workers/ai-proxy/src/claude.ts` | Anthropic call + cache_control (340 LOC) |
| `workers/ai-proxy/src/gemini.ts` | Gemini call |
| `workers/ai-proxy/src/rateLimit.ts` | Daily limit enforcement |
| `workers/ai-proxy/wrangler.toml` | config | Cloudflare worker config |
| `workers/ai-proxy/tsconfig.json` | config | |
| `workers/ai-proxy/package.json` | config | |
| `workers/ai-proxy/README.md` | doc | |

## Admin portal (`admin/`)

| Path | Description |
|------|-------------|
| `admin/app/layout.tsx` | Next.js layout |
| `admin/app/page.tsx` | Landing page |
| `admin/app/globals.css` | Global styles |
| `admin/app/sign-in/page.tsx` | Sign-in |
| `admin/app/auth/callback/route.ts` | Auth callback |
| `admin/app/(authed)/layout.tsx` | Authed layout |
| `admin/app/(authed)/SignOutButton.tsx` | Sign-out button |
| `admin/app/(authed)/evals/page.tsx` | Evals dashboard |
| `admin/app/(authed)/feedback/page.tsx` | Feedback list |
| `admin/app/(authed)/flags/page.tsx` | Feature flags editor |
| `admin/app/(authed)/prompts/page.tsx` | Prompts list |
| `admin/app/(authed)/prompts/[key]/page.tsx` | Prompt editor |
| `admin/app/(authed)/push/page.tsx` | Push notifications |
| `admin/app/(authed)/schema-failures/page.tsx` | AI schema-failure feed |
| `admin/app/(authed)/telemetry/page.tsx` | Telemetry feed |
| `admin/lib/supabase-server.ts` | Supabase server client |
| `admin/lib/supabase.ts` | Supabase browser client |
| `admin/lib/worker.ts` | Worker REST client |
| `admin/middleware.ts` | Next middleware (auth gate) |
| `admin/next.config.mjs` | config |
| `admin/package.json` | config |
| `admin/tsconfig.json` | config |
| `admin/README.md` | doc |
| `admin/.env.local.example` | config |

## Evals (`evals/`)

| Path | Description |
|------|-------------|
| `evals/eval.test.ts` | Main eval runner |
| `evals/grader.ts` | Grading helpers |
| `evals/types.ts` | Eval types |
| `evals/benchmarks/merchantBenchmark.test.ts` | Merchant bench |
| `evals/cases/decomposeGoal.ts` | Case set |
| `evals/cases/generateRoutine.ts` | Case set |
| `evals/cases/generateFinancialPlan.ts` | Case set |
| `evals/cases/categorizeMerchant.ts` | Case set |
| `evals/cases/discoveryChat.ts` | Case set |
| `evals/cases/parseBloodReportSafety.ts` | Safety case set |
| `evals/cases/planRoutineAgent.ts` | Agent loop case |
| `evals/cases/ragRetrieve.ts` | RAG retrieval case |
| `evals/cases/replanRemainingDay.ts` | Replan case |
| `evals/datasets/merchants.ts` | Merchant fixtures |
| `evals/README.md` | doc |

## E2E (`e2e/`)

`smoke.spec.ts`, `auth.setup.ts`, `helpers.ts`, `routes.json`, `create-test-user.ts`, `ambient.spec.ts`, `career-strategy.spec.ts`, `notifications-prefs.spec.ts`, `voice-assistant.spec.ts`.

## Scripts (`scripts/`)

| Path | Description |
|------|-------------|
| `scripts/ai-proxy.js` | Local worker launcher |
| `scripts/build-food-db.js` | Build food seed |
| `scripts/build-food-db.md` | Build doc |
| `scripts/build-indb.js` | INDB import |
| `scripts/generate-onboarding-audio.js` | Generate ElevenLabs narration |
| `scripts/post-export-web.js` | Post-build web fixups |

## Supabase migrations (`supabase/migrations/`)

`0001_admin_init.sql`, `0002_admin_prompts.sql`, `0003_telemetry.sql`, `0004_feedback_and_push.sql`, `0005_eval_reports.sql`.

## Docs (`docs/`)

`README.md`, `MASTER_BRIEF.md`, `PRODUCT_TECHNICAL_DOC.md`, `PRE_PRODUCTION_CHECKLIST.md`, `MANUAL_OPS_TODO.md`, `BUG_LOG.md`, `TESTING.md`, `SECURITY.md`, `WEB_VS_NATIVE.md`, `AI_FUNCTIONS.md`, `AI_TEST_PLAN.md`, `ADMIN_PORTAL_PLAN.md`, `FINANCE_PIPELINE.md`, `GAMIFICATION.md`, `ARCHITECT_REVIEW_2026-05-13.md`, `claude-design-prompt-mobile.md`, `claude-design-prompt-web.md`. Architecture: `docs/architecture/phase-{2-cognitive-engine,3-ai-coach,4-memory-graph,5-orchestration}.md`. Aurora design: `docs/aurora-refined-v2/{README,DELTA,MOTION,PROMPTS,USER-INSTRUCTIONS}.md`.

## Implementation plans / roadmap / qa

| Path | |
|------|--|
| `implementation-plan/phase-1-trust-foundation.md` | doc |
| `implementation-plan/phase-2-domain-stagnation-detector.md` | doc |
| `implementation-plan/phase-4-explore-sparks-expeditions.md` | doc |
| `roadmap/00-architecture-audit.md` | doc |
| `roadmap/01-program-roadmap.md` | doc |
| `qa/debug-handover.md` | doc |

## Root config

`package.json`, `tsconfig.json`, `jest.config.js`, `playwright.config.ts`, `app.json`, `drizzle.config.ts`, `README.md`, `jest.mocks/*` (3 files). `.github/workflows/{e2e,evals}.yml`.

---

**Indexed source files (excluding node_modules/dist/test-results/smoke-output/tmp/binaries):** ~520 files. Breakdown: `app/` 51 + `src/` 343 + `admin/` 26 + `workers/ai-proxy/src/` 5 + `evals/` 20 + `e2e/` 9 + `scripts/` 6 + `supabase/migrations/` 5 + `docs/` 27 + `implementation-plan/` 3 + `roadmap/` 2 + `qa/` 1 + `.github/workflows/` 2 + `jest.mocks/` 3 + root configs ~10.
