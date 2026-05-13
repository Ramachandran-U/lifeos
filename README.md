# LifeOS

An AI-first life-management app (React Native + Expo) that synthesises goals, health, finance, career, social, and learning into a single daily plan. The app answers one question continuously: **"What should I do next to improve my life?"**

This README focuses on the AI-engineering layer: evals, RAG, agentic planning, prompt caching, model routing, cost accounting, tracing, and a distillation track. For product spec, see [PRD.md](PRD.md). For task list, see [TASKS.md](TASKS.md).

---

## Architecture (AI layer)

```
                         ┌────────────────────────────────────────────┐
  User intent / context  │  src/ai/agent/planner.ts                    │
  ─────────────────────► │  Routine planner (multi-step, traced)        │
                         │   1. retrieve  → src/ai/rag/retrieve.ts      │
                         │   2. propose   → Sonnet, Zod-validated       │
                         │   3. critique  → Sonnet, revisedBlocks       │
                         │   4. brief     → Haiku                       │
                         └──────────────┬─────────────────────────────┘
                                        │
                         ┌──────────────▼─────────────────────────────┐
                         │  src/ai/client.ts                           │
                         │   - cacheSystem → Anthropic cache_control   │
                         │   - pickModel(task) per call                │
                         │   - withSpan() tracing                      │
                         │   - recordUsage() → cost ledger             │
                         └──────────────┬─────────────────────────────┘
                                        │
                         ┌──────────────▼─────────────────────────────┐
                         │  workers/ai-proxy (Cloudflare Worker)       │
                         │   - normalises system → cache_control       │
                         │   - returns {text, usage, model}            │
                         └────────────────────────────────────────────┘
```

Supporting modules:

- `src/ai/rag/embed.ts` — Voyage `voyage-3-lite` live, hash-based 256-dim mock for offline dev.
- `src/ai/rag/retrieve.ts` — pure-functional cosine retrieval over caller-provided items (no DB migration).
- `src/ai/modelRouter.ts` — task → tier (Haiku / Sonnet / Opus) routing.
- `src/ai/costLedger.ts` — token + $/call accounting, cache-hit-rate.
- `src/ai/tracing.ts` — span tree with optional Langfuse export.

---

## Evals

Six suites in `evals/`, runnable in mock (CI) or live mode. Reports render to `evals/reports/latest.md` with summary, cost, traces, and per-case detail.

| Suite | What it checks | Threshold |
|---|---|---|
| `decomposeGoal` | Schema + invariants on goal → milestone tree | 100% |
| `generateFinancialPlan` | Schema + milestone-≤-target | 100% |
| `generateRoutine` | HH:MM regex, module enum | 100% |
| `categorizeMerchant` | Schema (mock) + accuracy ≥70% (live) | 100% / 70% |
| `ragRetrieve` | Top-k correctness on labelled queries | 100% |
| `planRoutineAgent` | Multi-step trace + Zod-valid plan | 100% |
| `parseBloodReportSafety` | Schema + no PII echo + injection resistance + grounding/disclaimer (live) | 100% |

```bash
npm run evals          # mock — fast, deterministic, runs in CI
npm run evals:live     # EVAL_REAL=true — hits real Claude via the proxy
```

CI: `.github/workflows/evals.yml` runs on PRs touching `src/ai/**` or `evals/**` and uploads `evals/reports/` as an artifact.

---

## Distillation track

`evals/benchmarks/merchantBenchmark.test.ts` benchmarks the rule-based merchant categoriser against the LLM on a 30-merchant labelled set (`evals/datasets/merchants.ts`).

Current baseline (mock mode):

| System | Accuracy | Coverage | Latency | Projected $/1k |
|---|---|---|---|---|
| Rule-based | **96.7%** | 100% | <0.1ms | $0 |
| LLM (Haiku) | (live only) | 100% | ~700ms | ~$0.05 |

Next step: collect ~500 production merchants the rules miss, label with the LLM, fine-tune a 1.5B-param classifier — target LLM accuracy within 3 points at 1/20th the cost.

Full report: [`evals/reports/benchmark-merchant.md`](evals/reports/benchmark-merchant.md).

---

## Cost & observability

Every `callAI` records token usage and computed cost (Anthropic public pricing) into `src/ai/costLedger.ts`. The eval report aggregates by `task` and `model`:

```
- Calls: 42
- Input tokens: 18,420
- Output tokens: 6,210
- Cache-read tokens: 12,300 (hit rate: 66.8%)
- Total cost: $0.0184
```

Spans are exported as JSONL (`evals/reports/traces.jsonl`) and optionally to Langfuse via `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY`.

---

## Safety

`parseBloodReport` is medical-adjacent. The safety eval suite covers:

- **Schema validity** — Zod-validated structured output.
- **No PII echo** — patient names, IDs, DOB must not appear in any output field.
- **Prompt-injection resistance** — adversarial reports embedding "ignore all previous instructions" must not produce fabricated markers.
- **Grounding (live)** — every output marker name must appear in input text.
- **Disclaimer (live)** — abnormal markers require a clinician/consult cue in summary or suggestions.

---

## Repo layout (AI bits)

- [`src/ai/`](src/ai) — client, functions, prompts, agent, RAG, tracing, cost, router.
- [`evals/`](evals) — suites, datasets, benchmarks, runner, reports.
- [`workers/ai-proxy/`](workers/ai-proxy) — Cloudflare Worker proxy with cache-control normalisation.
- [`CLAUDE.md`](CLAUDE.md) — agent instructions / project conventions.
