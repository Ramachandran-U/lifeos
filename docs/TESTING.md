# Testing

Minimal Jest + ts-jest setup for pure-logic tests. Component/integration tests need `jest-expo` later.

## Run

```bash
npm test             # unit tests (pure logic) — ~12s, 335 tests
npm run test:watch   # watch mode
npm run evals        # AI eval harness (mock mode, free, ~2s)
npm run evals:live   # same but hits real LLMs (sets EVAL_REAL=true)
npm run smoke        # Playwright deploy smoke against the canonical Pages URL
npm run smoke:local  # smoke against local Expo web (start `npm run web` first)
npm run verify       # tsc + jest + smoke — pre-commit gate
```

## Pre-commit gate

Before every commit/push that touches user-facing surfaces:

```bash
npm run verify
```

This runs `tsc --noEmit && jest && npm run smoke` in order. Each gate must be green:
- `tsc` — 0 errors (strict mode)
- `jest` — full suite (currently 335 tests; planner agent, gamification, finance parsers, etc.)
- `smoke` — Playwright against `https://lifeos-6r5-eqa.pages.dev` (currently 14 tests; ~45s)

The smoke runs against the deployed canonical URL, not the local build — so it catches CORS misconfigs, missing env vars, and bundle-vs-runtime drift that `npm run web` would mask.

## Layout

Tests live next to the code they cover in `__tests__/` folders:

```
src/utils/__tests__/gamification.test.ts
src/finance/parsers/__tests__/emailParsers.test.ts
```

Config: [`jest.config.js`](../jest.config.js). Paths:
- `@/` → `src/`
- `testEnvironment: 'node'` (no DOM)
- `app/` and `src/components/` are ignored — RN JSX needs jest-expo.
- `moduleNameMapper` for `react-native`, `expo-constants`, `@react-native-async-storage/async-storage` → tiny stubs under [`jest.mocks/`](../jest.mocks/) so consumer modules that import RN at the top level can be exercised in pure Node.

## Coverage today

- **gamification.ts** — XP curve, streak grace logic, badge awards, domain score weighting
- **emailParsers.ts** — HDFC/ICICI/Axis regex + dispatcher

## AI eval harness ([`evals/`](../evals/))

A second test layer dedicated to AI surfaces. Lives in [`evals/`](../evals/), runs under the same Jest config, but with its own runner ([`evals/eval.test.ts`](../evals/eval.test.ts)) that emits a markdown report + cost ledger + tracing summary to [`evals/reports/`](../evals/reports/).

**Suites today (28+ graded cases):**

| Suite | Coverage |
|-------|----------|
| `decomposeGoal` | Schema + structural checks (monthly/weekly non-empty, daily examples ≥ 3) |
| `generateFinancialPlan` | Schema + currency handling + milestone counts |
| `generateRoutine` | Schema + block validity |
| `categorizeMerchant` | Schema (accuracy reported separately) |
| `ragRetrieve` | Top-hit correctness over a small in-memory corpus |
| `planRoutineAgent` | Trace shape (retrieve → propose → critique → commit) + plan validity |
| `parseBloodReportSafety` | Schema + **PII non-echo** + **prompt-injection resistance** + (live only) marker grounding + clinician disclaimer when abnormal |

**Benchmarks** ([`evals/benchmarks/`](../evals/benchmarks/)):
- `merchantBenchmark.test.ts` — side-by-side rule / classifier / LLM / stacked pipeline accuracy + projected $/1k inputs.

**CI gating:** [`.github/workflows/evals.yml`](../.github/workflows/evals.yml) runs on every PR touching `src/ai/**`. When `EVAL_REPORTER_URL` + `EVAL_REPORTER_TOKEN` repo secrets are set, the workflow POSTs the summary to the Worker, which surfaces it in the admin's Evals tab.

## Adding tests

1. Add the file under `<module>/__tests__/<name>.test.ts`.
2. Only import pure-logic modules (no `react-native`, no `expo-*`, no DB).
3. For time-dependent logic, use `date-fns` helpers with a `today()` helper rather than hard-coded strings.

## E2E (Playwright)

Happy-path browser tests for the web build live in [`e2e/`](../e2e/). Config: [`playwright.config.ts`](../playwright.config.ts).

```bash
# Terminal 1 — start the web build in mock mode
EXPO_PUBLIC_USE_AI_MOCK=true npx expo start --web

# Terminal 2
npx playwright test
```

Notes:
- `baseURL` is `http://localhost:8081`; start Expo web first.
- `EXPO_PUBLIC_USE_AI_MOCK=true` is required — specs assert mock-response content.
- RN-web renders `Pressable` as `generic` (not `role=button`); use `page.getByText(...)` selectors rather than `getByRole('button', ...)`.
- Auth/onboarding state is seeded directly into `localStorage` via `addInitScript` — see [`e2e/helpers.ts`](../e2e/helpers.ts).

Current specs include `career-strategy.spec.ts` and `voice-assistant.spec.ts` under [`e2e/`](../e2e/). Add new specs there with the helpers in [`e2e/helpers.ts`](../e2e/helpers.ts).

## AI Evals

The eval harness lives under [`evals/`](../evals/) and is the primary regression net for the AI layer (RAG retrieval, agentic planner, prompt caching, model routing, cost ledger, tracing, merchant categorisation benchmark, blood-report safety).

```bash
npm run evals             # mock-mode, no keys needed — fast and deterministic
EVAL_REAL=true npm run evals:live   # live providers via the Worker (real cost)
```

Reports land in `evals/reports/`:
- `latest.md` / `latest.json` — last run summary (per-suite pass rate, cost/token usage, model routing, tracing)
- `traces.jsonl` — structured spans for every AI call
- `benchmark-merchant.md` — categoriser accuracy

See [`AI_TEST_PLAN.md`](AI_TEST_PLAN.md) for the full manual test matrix.

## Worker tests

`workers/ai-proxy/test/` carries happy-path tests per route — run via `npm test` inside `workers/ai-proxy/`. New endpoints must add at least one test before phase sign-off (see [`ADMIN_PORTAL_PLAN.md`](ADMIN_PORTAL_PLAN.md) § 8).

## CI

GitHub Actions runs typecheck, Jest, and evals on PRs touching `src/ai/**` or `evals/**`. See the workflow file under `.github/workflows/`.

## Next steps

- `jest-expo` preset so components + hooks can be tested
- `@testing-library/react-native` for Rewards/Today/Goals screens
- Mock `expo-sqlite` + `expo-crypto` for DB query tests
