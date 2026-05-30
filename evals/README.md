# LifeOS AI Eval Harness

A lightweight regression harness for the AI functions in [`src/ai/functions.ts`](../src/ai/functions.ts). Catches:

- **Schema breaks** — Zod-validated shape per function.
- **Domain invariants** — e.g. financial plan milestones must not exceed the goal target.
- **Accuracy** (live mode only) — e.g. `categorizeMerchant` predictions vs labelled merchants.

## Run

```bash
npm run evals          # mock mode (default, no API key, runs in CI)
npm run evals:live     # live mode (EVAL_REAL=true) — calls the live AI proxy (Gemini provider)
```

Reports are written to `evals/reports/latest.json` and `evals/reports/latest.md` after every run.

## Suites

| Suite | What it grades | Threshold |
|---|---|---|
| `decomposeGoal` | Schema + non-empty hierarchy + valid primary-goal type | 90% |
| `generateFinancialPlan` | Schema + milestones ≤ target + monotone milestone amounts | 100% |
| `generateRoutine` | Schema + valid `HH:MM` times + start < end + valid module enum | 100% |
| `categorizeMerchant` | Schema (always) + accuracy on 10 labelled Indian merchants (live only) | 100% mock / 70% live |
| `ragRetrieve` | Top-k retrieval ranks the relevant note first | 100% |
| `planRoutineAgent` | Agentic planner — schema + traced `agent.planRoutine` spans | 100% |
| `parseBloodReportSafety` | Schema + no PII / injection echo + grounding & disclaimer (live) | 100% |
| `discoveryChat` | Schema + conversational turn invariants | 80% |
| `replanRemainingDay` | Schema + remaining-day blocks stay valid | 80% |
| `suggestTomorrowTweak` | Schema + tweak suggestion invariants | 80% |
| `dailyBriefing` | Schema + briefing content invariants | 80% |

## Adding a case

1. Open the relevant file in [`evals/cases/`](./cases).
2. Add `{ name, input, graders: [...] }` to the `cases` array.
3. Use `schemaValid(SomeZodSchema)` and `check('name', (out) => boolean)` from [`evals/grader.ts`](./grader.ts).

## Adding a suite

1. Create `evals/cases/<fnName>.ts` exporting a default `EvalSuite<I, O>`.
2. Import and append it to the `suites` array in [`evals/eval.test.ts`](./eval.test.ts).

## CI

`.github/workflows/evals.yml` runs `npm run evals` on every PR that touches `src/ai/**` or `evals/**` and uploads the reports as a build artifact. The workflow fails if any suite drops below its threshold.
