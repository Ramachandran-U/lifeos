# AI Functions Reference

All AI calls go through [`src/ai/client.ts`](../src/ai/client.ts) → the `workers/ai-proxy` Cloudflare Worker (`POST /claude`, Bearer = Supabase JWT, `task` field forwarded for per-feature rate-limit bucketing) → the configured LLM. The Worker has routes for Anthropic Claude (`/claude`) and Google Gemini (`/gemini`); the per-task `pickModel()` in [`src/ai/modelRouter.ts`](../src/ai/modelRouter.ts) chooses which provider/model a given task hits. **As of 2026-05-14 only the Anthropic path is exercised in production** — Gemini code paths exist and are wired but unverified end-to-end against live traffic. `LLM_PROVIDER` as a single switch on the Worker is not currently honoured; provider selection happens per-task client-side via `pickModel()`. The chatbot (`app/chat.tsx`) and voice assistant (Gemini Live, `src/ai/voiceClient.ts`) share the same auth/transport. Every function:
- Has a Zod schema in [`src/ai/types.ts`](../src/ai/types.ts)
- Has a prompt in [`src/ai/prompts/`](../src/ai/prompts/)
- Has a mock in [`src/ai/mocks/`](../src/ai/mocks/) (`EXPO_PUBLIC_USE_AI_MOCK=true` serves these)
- On Zod-parse failure: emits an `ai_schema_failure` telemetry event (task + schema + first 500 chars of raw output), then throws. Failures surface in the admin's Schema failures tab so production breaks become eval-fixture candidates.
- Is covered by a suite in [`evals/cases/`](../evals/cases/) that runs in CI on every PR touching `src/ai/**`. Pass rates land in the admin's Evals tab.

## Functions ([`src/ai/functions.ts`](../src/ai/functions.ts))

| Function | Input | Output | Used in |
|----------|-------|--------|---------|
| `decomposeGoal` | `{ vision, name, age }` | `GoalHierarchy` (yearly/monthly/weekly/daily) | Onboarding vision. Prompt is **Elite Life Strategist**-toned — every milestone is an artifact, not a theme; weekly tasks are 5-day shippable outputs; daily examples are verb-led and time-boxed. |
| `analyseSkillGap` | `{ currentRole, targetRole, timeline, skills }` | `SkillGapAnalysis` (gaps + resources) | Onboarding career, Career tab |
| `generateCareerStrategy` | `{ currentRole, targetRole, timeframe, hoursPerWeek, constraints, skills }` | `CareerStrategy` (reality check + phased plan + weekly/daily artifacts) | Career tab Elite Strategist. Output feeds [`CareerStrategyView`](../src/components/modules/career/CareerStrategyView.tsx); `Commit all` converts weekly/daily items into prioritised goals. |
| `generateMotivation` | context slice | short strategist-tone banner | Home motivation banner |
| `describeGoal` | `{ title, level, parentTitle?, vision? }` | `GoalDescription` (short outcome-focused description) | AddGoalSheet — fills the description field when the user only types a title |
| `generateRoutine` | `{ wake, sleep, work*, goals }` | `GeneratedRoutine` (blocks + briefing) | Legacy single-shot — kept for the eval suite. **Production callers use `planRoutineWithContext` instead.** |
| `planRoutineWithContext` ([`src/ai/routinePlanner.ts`](../src/ai/routinePlanner.ts)) | extended `RoutineInput` (+ implicitly pulls recent history) | `GeneratedRoutine` | Onboarding day-1 routine + profile-driven routine generation. Wraps `planRoutineAgent` from [`src/ai/agent/planner.ts`](../src/ai/agent/planner.ts) — 4-step retrieve → propose → critique → commit loop, RAG context seeded by [`historyContext.ts`](../src/ai/historyContext.ts) (last 7 reflections + 14 days of behaviour events + latest blood-report `aiSummary`). Each step is traced. |
| `parseBloodReport` | raw report text | `BloodReportResult` (markers, summary, suggestions) | Health upload |
| `suggestMeals` | context string (target + eaten + prefs) | `MealSuggestion` | Health |
| `generateFinancialPlan` | `{ goal, income, savings, risk }` | `FinancialPlan` (strategies + milestones) | Finance setup |
| `getWeeklyFinanceInsight` | progress snapshot | `WeeklyFinanceInsight` | Finance weekly refresh |
| `categorizeMerchant` | merchant string | `{ category, confidence }` | Legacy single-shot; retained for backwards-compat. **Production callers use `categorizeMerchantsBatch` instead.** |
| `categorizeMerchantsBatch` | `Array<{ merchant, amountRupees }>` (≤25 per call) | `Array<{ category, confidence }>` | Finance categorizer AI tier — one round-trip per batch. Sits behind the local k-NN classifier in [`src/finance/merchantClassifier.ts`](../src/finance/merchantClassifier.ts), so only true coverage gaps escalate to AI. |
| `recogniseFood` | `(base64, mediaType)` | `FoodRecognition` (items + macros) | Health photo food |
| `suggestTomorrowTweak` | `{ today, tomorrow, primaryDomains }` | `TomorrowTweak` (move/resize/swap/add + rationale) | Evening reflect — one-tap tweak for tomorrow's plan |
| `extractDiscoveryProfile` | raw Discovery Prompt paste (string) | `DiscoveryExtraction` (identity, goals, health, finance, career, relationships, curiosity, values, workingStyle, communication, struggles, triedAlready, asks + per-section confidence) | Welcome-intent → `(onboarding)/discovery-intro` (copy `DISCOVERY_USER_PROMPT` + deep-link to ChatGPT/Claude) → `discovery-paste` → extract into strict JSON, stash raw in `discovery_imports` → `discovery-confirm` preview |

## Conventions

- System prompts return JSON only — parsed then `.parse()`-d through Zod.
- Long prompts go in `src/ai/prompts/*.ts`; functions just compose them.
- Never pass the full user profile — only the slice the prompt needs.
- Mock responses are **obviously fake** (no real-looking PII).

## Adding a new AI function

1. Define input + output Zod schemas in `src/ai/types.ts`.
2. Write system prompt in `src/ai/prompts/<domain>.ts`.
3. Add mock in `src/ai/mocks/<domain>.ts`.
4. Add function in `src/ai/functions.ts` — mock guard first, then `callAI()`, then `Schema.parse(JSON.parse(...))`.
5. Wrap call sites in the `useAI()` hook (loading/error state).
