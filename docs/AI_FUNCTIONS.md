# AI Functions Reference

All AI calls go through [`src/ai/client.ts`](../src/ai/client.ts) → Claude Sonnet 4 REST API. Every function:
- Has a Zod schema in [`src/ai/types.ts`](../src/ai/types.ts)
- Has a prompt in [`src/ai/prompts/`](../src/ai/prompts/)
- Has a mock in [`src/ai/mocks/`](../src/ai/mocks/) (`EXPO_PUBLIC_USE_AI_MOCK=true` serves these)
- Throws on invalid JSON — UI layer catches and renders a friendly error

## Functions ([`src/ai/functions.ts`](../src/ai/functions.ts))

| Function | Input | Output | Used in |
|----------|-------|--------|---------|
| `decomposeGoal` | `{ vision, name, age }` | `GoalHierarchy` (yearly/monthly/weekly/daily) | Onboarding vision |
| `analyseSkillGap` | `{ currentRole, targetRole, timeline, skills }` | `SkillGapAnalysis` (gaps + resources) | Onboarding career, Career tab |
| `generateRoutine` | `{ wake, sleep, work*, goals }` | `GeneratedRoutine` (blocks + briefing) | Onboarding routine |
| `parseBloodReport` | raw report text | `BloodReportResult` (markers, summary, suggestions) | Health upload |
| `suggestMeals` | context string (target + eaten + prefs) | `MealSuggestion` | Health |
| `generateFinancialPlan` | `{ goal, income, savings, risk }` | `FinancialPlan` (strategies + milestones) | Finance setup |
| `getWeeklyFinanceInsight` | progress snapshot | `WeeklyFinanceInsight` | Finance weekly refresh |
| `categorizeMerchant` | merchant string | `{ category }` | Finance categorizer fallback |
| `recogniseFood` | `(base64, mediaType)` | `FoodRecognition` (items + macros) | Health photo food |

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
