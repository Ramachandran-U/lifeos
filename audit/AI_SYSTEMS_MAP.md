# AI_SYSTEMS_MAP — LifeOS

All LLM I/O passes through `callAI` → Cloudflare Worker `ai-proxy` → Gemini (active) or Claude (legacy path). Mock mode (`EXPO_PUBLIC_USE_AI_MOCK=true` / `USE_AI_MOCK=true`) short-circuits each function in `src/ai/functions.ts`.

## Entry point

**File:** `src/ai/client.ts`

```
callAI(request) → POST {PROXY_URL}/claude
  headers: Authorization: Bearer <supabase JWT>
  body: { system, messages, maxTokens, model, cacheSystem, task }
  → recordUsage (costLedger), track(EVENTS.aiCall), endSpan(tracing)
  → returns data.text
```

- `PROXY_URL` from `EXPO_PUBLIC_AI_PROXY_URL` (default `http://localhost:8787`)
- Auth via `getSupabaseAccessToken()` (mandatory)
- 429 → friendly limit message
- Every call wrapped in a tracing span; failures emit `ai_schema_failure` telemetry from `functions.ts:recordSchemaFailure`.

## Model routing (`src/ai/modelRouter.ts`)

Three tiers → Gemini model IDs:
- `cheap` → `gemini-2.5-flash`
- `planning` → `gemini-3.5-flash`
- `reasoning` → `gemini-3.5-flash` (collapsed onto planning model for now)

`EXPO_PUBLIC_MODEL_OVERRIDE` overrides globally (used for evals).

| Tier | Tasks |
|------|-------|
| cheap | `categorizeMerchant`, `describeGoal`, `generateMotivation`, `discoveryChatTurn`, `generateConversationStarters`, `generateDailySpark`, `generateDailyBriefing`, `agent.brief` |
| planning | `decomposeGoal`, `analyseSkillGap`, `generateRoutine`, `suggestMeals`, `recogniseFood`, `generateFinancialPlan`, `getWeeklyFinanceInsight`, `generateCareerStrategy`, `extractDiscoveryProfile`, `suggestTomorrowTweak`, `replanRemainingDay`, `generateTomorrowRoutine`, `generateWeekRoutine`, `suggestInterestAreas`, `suggestCrossDisciplineLink`, `generateExpedition`, `generateMonthlyInsightReport`, `assessTrajectory`, `generateMoneyReview`, `agent.propose`, `agent.critique` |
| reasoning | `parseBloodReport`, `generateAnnualReview` |

## AI functions (`src/ai/functions.ts`, 831 LOC, 27 exports)

| Function | Tier | Prompt module | Mock |
|----------|------|---------------|------|
| `decomposeGoal` | planning | `prompts/goals.ts` (`GOAL_DECOMPOSITION_PROMPT`) | `mocks/goals.ts` |
| `describeGoal` | cheap | `prompts/goals.ts` (`GOAL_DESCRIPTION_PROMPT`) | `mocks/goals.ts` |
| `analyseSkillGap` | planning | `prompts/career.ts` (`SKILL_GAP_PROMPT`) | `mocks/career.ts` |
| `generateCareerStrategy` | planning | `prompts/career.ts` (`CAREER_STRATEGY_PROMPT`) | `mocks/career.ts` |
| `generateMotivation` | cheap | `prompts/career.ts` (`MOTIVATION_PROMPT`) | `mocks/career.ts` |
| `generateRoutine` | planning | `prompts/routine.ts` (`ROUTINE_GENERATION_PROMPT`) | `mocks/routine.ts` |
| `replanRemainingDay` | planning | `prompts/routine.ts` (`REPLAN_REMAINING_DAY_PROMPT`) | `mocks/routine.ts` |
| `generateTomorrowRoutine` | planning | `prompts/routine.ts` (`GENERATE_TOMORROW_ROUTINE_PROMPT`) | `mocks/routine.ts` |
| `generateWeekRoutine` | planning | `prompts/routine.ts` (`GENERATE_WEEK_ROUTINE_PROMPT`) | `mocks/routine.ts` |
| `parseBloodReport` | reasoning | `prompts/health.ts` (`BLOOD_REPORT_PROMPT`) | `mocks/health.ts` |
| `suggestMeals` | planning | `prompts/health.ts` (`MEAL_SUGGESTION_PROMPT`) | `mocks/health.ts` |
| `recogniseFood` | planning | `prompts/health.ts` (`FOOD_RECOGNITION_PROMPT`) | `mocks/health.ts` |
| `generateFinancialPlan` | planning | `prompts/finance.ts` (`FINANCIAL_PLAN_PROMPT`) | `mocks/finance.ts` |
| `getWeeklyFinanceInsight` | planning | `prompts/finance.ts` (`WEEKLY_FINANCE_INSIGHT_PROMPT`) | `mocks/finance.ts` |
| `categorizeMerchant` | cheap | `prompts/finance.ts` (`MERCHANT_CATEGORIZE_PROMPT`) | inline |
| `categorizeMerchantsBatch` | cheap | `prompts/finance.ts` (`MERCHANT_CATEGORIZE_BATCH_PROMPT`) | inline |
| `generateMoneyReview` | planning | `prompts/moneyReview.ts` (`MONEY_REVIEW_PROMPT`) | `mocks/moneyReview.ts` |
| `extractDiscoveryProfile` | planning | `prompts/discovery.ts` (`DISCOVERY_EXTRACTION_PROMPT`) | `mocks/discovery.ts` |
| `discoveryChatTurn` | cheap | `prompts/discoveryChat.ts` (`DISCOVERY_CHAT_SYSTEM_PROMPT`) | `mocks/discoveryChat.ts` |
| `suggestTomorrowTweak` | planning | `prompts/reflection.ts` (`TOMORROW_TWEAK_PROMPT`) | `mocks/reflection.ts` |
| `generateConversationStarters` | cheap | `prompts/social.ts` (`CONVERSATION_STARTERS_PROMPT`) | `mocks/social.ts` |
| `suggestInterestAreas` | planning | `prompts/polymath.ts` (`INTEREST_SUGGESTIONS_PROMPT`) | `mocks/polymath.ts` |
| `suggestCrossDisciplineLink` | planning | `prompts/polymath.ts` (`CROSS_DISCIPLINE_LINK_PROMPT`) | `mocks/polymath.ts` |
| `generateMonthlyInsightReport` | planning | `prompts/behaviour.ts` (`MONTHLY_INSIGHT_REPORT_PROMPT`) | `mocks/behaviour.ts` |
| `generateDailyBriefing` | cheap | `prompts/briefing.ts` (`DAILY_BRIEFING_PROMPT`) | `mocks/briefing.ts` |
| `assessTrajectory` | planning | `prompts/trajectory.ts` (`TRAJECTORY_PROMPT`) | `mocks/trajectory.ts` |
| `generateAnnualReview` | reasoning | `prompts/annualReview.ts` (`ANNUAL_REVIEW_PROMPT`) | `mocks/annualReview.ts` |

Two additional task IDs (`generateDailySpark`, `generateExpedition`) live outside `functions.ts`:
- `src/explore/spark.ts` → `generateDailySpark`
- `src/explore/expeditionGen.ts` → `generateExpedition`

And `src/components/shared/DailySummarySheet.tsx` calls `callAI` directly (chatbot turns — uses `prompts/chatbot.ts`).

## Agent loop (`src/ai/agent/planner.ts`, 293 LOC)

Three-step propose → critique → brief:
- `agent.propose` — generates a candidate plan
- `agent.critique` — flags issues
- `agent.brief` — final human-readable brief
Comment notes this is a stub for future native tool-use migration ("Migrating to native tool-use is a one-step swap of `callAI`.").

## Prompts inventory (`src/ai/prompts/`)

17 files — one per domain/subdomain: `annualReview`, `behaviour`, `briefing`, `career`, `chatbot`, `discovery`, `discoveryChat`, `finance`, `goals`, `health`, `moneyReview`, `polymath`, `reflection`, `routine`, `social`, `trajectory`. Each exports `_PROMPT` string constants. Live override is possible via `usePromptStore` (admin portal can ship updated prompts without re-deploy).

## Mocks (`src/ai/mocks/`)

16 files mirroring prompts. Triggered when `EXPO_PUBLIC_USE_AI_MOCK=true`. Tests in `src/ai/mocks/__tests__/{annualReview,briefing}.test.ts`.

## Telemetry & observability

- `src/ai/tracing.ts` — `startSpan/endSpan` with model, cost, token counts
- `src/ai/costLedger.ts` — in-memory token + USD ledger; tests in `src/ai/__tests__/costLedger.test.ts`
- `src/utils/telemetry.ts` — `track(event, props)` + `EVENTS` enum
- Schema failure path: `functions.ts:recordSchemaFailure` → `EVENTS.aiSchemaFailure` (task, schema, error preview, raw_preview ≤500 chars). Sink: Supabase (`supabase/migrations/0003_telemetry.sql`).
- Admin pages: `admin/app/(authed)/{telemetry,evals,schema-failures}/page.tsx`.

## Evaluation system (`evals/`)

- `eval.test.ts` — orchestrator
- `benchmarks/merchantBenchmark.test.ts` — domain-specific bench
- `grader.ts` — scoring
- `cases/` — 9 case files: `decomposeGoal`, `generateFinancialPlan`, `generateRoutine`, `categorizeMerchant`, `discoveryChat`, `planRoutineAgent`, `ragRetrieve`, `parseBloodReportSafety`, `replanRemainingDay`
- `datasets/merchants.ts` — fixture
- `reports/` — `latest.json`, `latest.md`, `benchmark-merchant.md`, `traces.jsonl`
- Live mode: `EVAL_REAL=true npm run evals` (real model calls)
- CI: `.github/workflows/evals.yml`

## Memory / context systems

| Module | Role |
|--------|------|
| `src/ai/profileContext.ts` | Builds the user-profile slice injected into prompts |
| `src/ai/profileLearning.ts` | Updates the persisted profile from new observations |
| `src/ai/profileMerge.ts` | Reconciles partial profile updates |
| `src/ai/historyContext.ts` | Recent-event window (routine completions, reflections) |
| `src/utils/behaviourPatterns.ts` (332 LOC) | Derives long-running behavioural patterns |
| `src/db/queries/{userProfile,reflections,behaviour,cognitiveInsights}.ts` | Persistent stores |
| `src/db/queries/discoverySeed.ts` | Seed profile from discovery onboarding |

## RAG (`src/ai/rag/`)

- `embed.ts` — embedding generation (scaffold)
- `retrieve.ts` — vector retrieval
- Tests: `rag/__tests__/retrieve.test.ts`
- Eval case: `evals/cases/ragRetrieve.ts`

Not yet wired into production calls — appears to be a scaffold for Phase 4 (`docs/architecture/phase-4-memory-graph.md`).

## Voice subsystem

| File | Role |
|------|------|
| `src/ai/voiceClient.ts` (193 LOC) | Gemini Live API session client |
| `src/ai/micCapture.ts` | Mic stream capture (web + native), tested in `__tests__/micCapture.test.ts` |
| `src/hooks/useVoice.ts` | React hook |
| `src/components/shared/VoiceAssistantSheet.tsx` | UI |
| `workers/ai-proxy/src/gemini.ts` | Server-side Gemini bridge |

## Cloudflare Worker (`workers/ai-proxy/src/`)

| File | Role |
|------|------|
| `index.ts` (362 LOC) | Routes (`/claude`, health), CORS, request shape |
| `auth.ts` | Supabase JWT verification (via `jose`) |
| `claude.ts` (340 LOC) | Anthropic API + cache_control |
| `gemini.ts` (64 LOC) | Gemini API |
| `rateLimit.ts` | Daily limit enforcement |

Provider switched via `LLM_PROVIDER=gemini` env on the worker.

## Tests

- `src/ai/__tests__/`: `careerStrategy`, `costLedger`, `extractJson`, `financialPlan`, `goalInjection`, `micCapture`, `planner`, `routineFromProfile`, `skillGapSanitize`, `tracing`
- `src/ai/mocks/__tests__/`: `annualReview`, `briefing`
- `src/ai/rag/__tests__/`: `retrieve`
