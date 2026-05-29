# Phase 2 — Cognitive Engine (Design)

> The differentiator. Today this is ~40% (local pattern detectors). This phase makes LifeOS *reason* about the user.
> Depends on: P0 signal stream. Feeds: P3 coach, P5 orchestration. Parallel: P4 memory.

## Status (updated 2026-05-30)

| Capability | Status |
|---|---|
| `cognitive_insights` table + cooldown gate (the core infra for every detector) | ✅ Shipped |
| Domain-stagnation detector (the "5. Adaptive reprioritization" capability, narrow form) | ✅ Shipped end-to-end with `DomainNudgeCard` |
| Two-tier architecture (deterministic detector → LLM only on candidates) | ✅ Pattern established by the stagnation detector |
| Burnout detection | ⏳ Not started |
| Overcommitment detection | ⏳ Partial — `priorityChangeHandler.assessImpact` surfaces overcommitment *at the moment of priority change*; no continuous detector |
| Goal-conflict reasoning | ⏳ Not started |
| Behavioural pattern engine (generalized detector registry) | ⏳ Not started — five legacy detectors in `behaviourPatterns.ts` still in use |
| "WHY" explanation engine | ⏳ Not started |
| Cognitive-load index | ⏳ Not started |

Detailed shipped breakdown: [implementation-plan/phase-2-domain-stagnation-detector.md](../../implementation-plan/phase-2-domain-stagnation-detector.md).

---

## PRD
**Thesis:** competitors optimize productivity; LifeOS optimizes *sustainable human progress*. That requires reasoning about load, conflict, and causation — not just tracking completion.

**Capabilities**
1. **Burnout detection** — sustained decline in completion + mood + energy + rising skip rate over a rolling window.
2. **Overcommitment detection** — planned load (block-minutes, high-energy blocks) vs. demonstrated capacity & sleep debt.
3. **Goal-conflict reasoning** — two goals competing for the same scarce resource (time/energy/money) → surface the tradeoff.
4. **Behavioral pattern engine** — generalize the 5 existing detectors in `behaviourPatterns.ts` into a pluggable detector registry over the signal stream.
5. **Adaptive reprioritization** — when load > capacity, propose which goals to defer (uses goal `priority` + energy + deadlines). Wire the **already-existing-but-unused** `GOAL_REBALANCE_PROMPT`.
6. **"WHY" explanation engine** — for any stalled goal/dropped habit, produce a causal, evidence-cited explanation ("you skip workouts on days you sleep < 6h, 7 of last 9").
7. **Cognitive load estimation** — a 0–100 daily load index from planned blocks, deadlines, recent sleep/energy, mood trend.

## Key technical decisions
- **Reuse the planner agent template** (`retrieve → propose → critique → commit`, traced, Zod-validated, propose-not-apply). Each cognitive capability is an agent of this shape under `src/ai/cognition/`.
- **Two-tier architecture**: cheap **deterministic detectors** (local, no LLM) run continuously over the signal stream and raise *candidate signals*; the **LLM reasoning layer** only runs on candidates to explain/contextualize. This keeps cost down and latency low (most signals never need an LLM).
- **Signal stream** = `mutations ∪ behaviourEvents ∪ dailyReflections`, exposed via `src/cognition/signals.ts` as a unified typed iterator. Do **not** fork a new event table.
- **Never auto-apply.** The engine emits `CognitiveInsight` proposals into an `insights` table; the coach (P3) surfaces them; the user accepts.

## Schema changes
- `cognitive_insights(id, userId, kind, severity, evidence JSON, explanation, proposedAction JSON, status[proposed|shown|accepted|dismissed|expired], createdAt, expiresAt)`
- `cognitive_load_daily(userId, date, loadIndex, components JSON)` — cached daily estimate.
- No changes to existing tables.

## AI pipeline & prompts
- `cognition/burnout.ts`, `overcommitment.ts`, `goalConflict.ts`, `whyEngine.ts` — each: detector → (if candidate) LLM explain → Zod parse → deterministic guard (severity bounds, evidence must reference real rows) → insight.
- Prompt design principle: **evidence-grounded, falsifiable, non-clinical**. The WHY-engine must cite specific logged events; forbidden from diagnosing ("you have depression") — bounded to behavioral observation.
- Models via `pickModel('cognition.*')`; reasoning steps may use a stronger model, detectors use none.

## Observability
- Spans per detector + per LLM explain. Counters: `cognition.insight.{kind}.raised|shown|accepted|dismissed`. Gauge: `cognition.load.index`.
- **Shadow mode**: detectors run and log insights with `status=proposed` but UI shows nothing — lets us measure precision before exposing.

## Telemetry
- Acceptance rate per insight kind (the core quality metric — low acceptance = noisy detector, tune or kill).
- False-positive review queue: dismissed insights sampled for analysis.

## Edge cases / failure modes
- Sparse data (new user) → detectors require min-sample thresholds; below threshold = silent.
- Over-alerting → per-kind rate limits + cooldowns; max N insights/day.
- LLM hallucinated evidence → deterministic guard rejects any insight whose cited event ids don't exist.
- Mood data missing → burnout falls back to behavioral-only signal with lower confidence.

## Acceptance criteria
- [ ] Burnout/overcommitment/goal-conflict detectors raise insights on seeded fixtures and stay silent on healthy fixtures.
- [ ] WHY-engine output cites only real event ids (guard-enforced) in 100% of tests.
- [ ] Cognitive load index correlates with planned-minutes + sleep debt on fixtures.
- [ ] All insights are proposals; nothing auto-mutates state.
- [ ] Shadow-mode telemetry shows per-kind precision before any UI exposure.

## Risks
| Risk | Mitigation |
|---|---|
| Noisy/creepy insights erode trust | Shadow mode + acceptance-rate gating + cooldowns; never diagnose |
| Cost blowup from per-event LLM calls | Two-tier: LLM only on candidates, not raw events |
| Reasoning feels generic ("touch grass") | Evidence-citation requirement makes every insight specific & falsifiable |
| Emotional harm from burnout framing | Non-clinical language guard; supportive tone; link to recovery (P3) not just diagnosis |
