# LifeOS — Adaptive Cognition Program Roadmap

> Mission: transform LifeOS from "advanced productivity + goal system" into an **AI-native adaptive life operating system.**
> This is the master sequencing document. Each phase has a detailed design under `/implementation-plan` (P1) or `/docs/architecture` (P2–P5).

## Program status (updated 2026-05-30)

| Phase | What's shipped | What's pending | Detailed doc |
|---|---|---|---|
| **P0 Infra** | Typed feature-flag registry; mutation-log primitive (Lamport + hash chain); behaviour-events feed (pre-existing) | `metrics.ts` observability counters | — |
| **P1 Trust** | Mutation log **wired** into goal/routine/reflection writes (every write now logs) | Supabase push/pull sync engine; conflict resolver; version history; restore-to-timestamp; encrypted backup/export | [phase-1-trust-foundation.md](../implementation-plan/phase-1-trust-foundation.md) |
| **P2 Cognition** | Domain-stagnation detector end-to-end (engine + storage + suggestions + `DomainNudgeCard` in evening-reflect) | Burnout / overcommitment / goal-conflict detectors; cognitive-load index; WHY-engine; real callAI-backed suggestion fallback | [docs/architecture/phase-2-cognitive-engine.md](../docs/architecture/phase-2-cognitive-engine.md) |
| **P3 Coach** | — | Whole phase: emotional check-ins, journal analysis, proactive interventions, recovery planning, action-taking via tool-use | [docs/architecture/phase-3-ai-coach.md](../docs/architecture/phase-3-ai-coach.md) |
| **P4 Memory + Explore v2** | **Explore v2 shipped end-to-end**: multi-expedition engine + set-union merge (commutative/idempotent, property-tested) + storage + Daily Spark pipeline + spark storage + expedition generation + constellation projection + restructured Explore tab + `/expedition-detail` + 3 new badges + polymath score + 12 telemetry events | Rabbit-hole branching view; curiosity streak; full long-term memory graph (the constellation is the polymath-scoped version); identity-evolution snapshots; temporal-query agent | [phase-4-explore-sparks-expeditions.md](../implementation-plan/phase-4-explore-sparks-expeditions.md), [docs/architecture/phase-4-memory-graph.md](../docs/architecture/phase-4-memory-graph.md) |
| **Priority Change → Routine** | Phase A (two-option sheet, tomorrow regen) + Phase B (real same-day replan, 5-phase sheet, diff preview, 24h undo) | Phase C (`GOAL_REBALANCE_PROMPT` wiring, "why" capture, animated diff) | [priority-change-routine-adjustment.md](../implementation-plan/priority-change-routine-adjustment.md) |
| **P5 Orchestration** | — | Whole phase: calendar reasoning, cross-goal optimization, energy-aware scheduling, autonomous suggestions | [docs/architecture/phase-5-orchestration.md](../docs/architecture/phase-5-orchestration.md) |

**Category-completeness moved roughly 30 → 55** since the program kicked off — the cognitive moat (stagnation detector + Explore curiosity loop + priority adaptation) is now visible to a flag-enabled user, but the bigger moats (coach, memory graph, orchestration) are still ahead.

## 0. Strategic frame

We are **not** building features. We are building a **spine** (the mutation log) and **four projections** over it (sync, cognition, memory, orchestration). See [00-architecture-audit.md](./00-architecture-audit.md) §3.

The product test for every ticket: *"Does this make LifeOS more adaptive, intelligent, emotionally aware, trusted, or better-remembered?"* If not, it is cut.

## 1. Dependency map

```
              ┌────────────────────────────────────────────┐
              │  P0  Program infra (this turn)              │
              │  • typed feature-flag registry              │
              │  • mutation-log (CDC) primitive + tests     │
              │  • signal-stream interface (wraps behaviourEvents)
              └───────────────┬────────────────────────────┘
                              │ unlocks
        ┌─────────────────────┼─────────────────────────────┐
        ▼                     ▼                             ▼
┌───────────────┐   ┌───────────────────┐         ┌──────────────────┐
│ P1 TRUST      │   │ P2 COGNITIVE      │         │ P4 MEMORY GRAPH  │
│ FOUNDATION    │   │ ENGINE            │         │ (projection)     │
│ sync, conflict│   │ burnout, overcommit,        │ identity evol.,  │
│ versioning,   │   │ goal-conflict, reprioritize,│ temporal reason, │
│ restore, export│  │ WHY-engine, cog-load        │ narrative        │
└──────┬────────┘   └─────────┬─────────┘         └────────┬─────────┘
       │ trust enables         │ cognition enables          │
       │ multi-device          ▼                            │
       │            ┌───────────────────┐                   │
       └──────────► │ P3 AI COACH       │ ◄─────────────────┘
                    │ check-ins, journal│  (coach reads memory + cognition)
                    │ analysis, proactive│
                    │ interventions, act │
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │ P5 ORCHESTRATION  │  (needs trusted state + cognition + memory)
                    │ calendar reasoning,│
                    │ cross-goal optim., │
                    │ energy scheduling, │
                    │ autonomous suggest │
                    └───────────────────┘
```

**Hard dependencies**
- P0 (spine) → everything.
- P1 (trust) → P5 (you can't orchestrate across devices you can't sync).
- P2 (cognition) → P3 (a coach with nothing to reason about is a chatbot).
- P2 + P4 → P5 (orchestration optimizes using cognition + memory).
- P4 (memory) can begin as a **read projection** in parallel with P2 because it only consumes the signal stream.

**Soft / parallelizable**
- P4 memory-graph projection can be built alongside P2 (both read the spine, neither writes the other).
- P1 web-persistence work is independent of P2/P4 and can run in parallel by a second engineer.

## 2. Phase sequencing & milestones

| Phase | Sprints (2wk) | Exit milestone | Category-completeness target |
|---|---|---|---|
| **P0 Infra** | 0.5 | Mutation log writing for ≥3 entities behind flag, 90%+ covered | — |
| **P1 Trust** | 3 | 2-device sync demo, conflict resolution, restore-to-timestamp, encrypted export; web persists | trust: prod-grade |
| **P2 Cognition** | 3 | Burnout + overcommitment + goal-conflict detectors live, WHY-engine explains stalls, all proposals (never auto-apply) | 30 → 50 |
| **P3 Coach** | 3 | Emotional check-ins, journal analysis, proactive intervention queue, action-taking (gated), recovery plans | 50 → 65 |
| **P4 Memory** | 2 (parallel w/ P2 start) | Identity-evolution timeline, behavioral relationship map, temporal queries answer "what blocks me repeatedly" | moat |
| **P5 Orchestration** | 3 | Calendar-aware cross-goal optimizer, energy-aware scheduling, autonomous (gated) plan suggestions | moat |

Total ≈ 14–15 sprints (~7 months) for a 2–3 eng team, P2/P4 overlapped.

## 3. Cross-cutting standards (apply to every phase)

- **Code:** TypeScript strict, no `any`, Zod at every boundary, named exports for components / default for screens.
- **Every new subsystem ships behind a typed flag** (`src/config/flags.ts`), off by default.
- **Every AI pipeline** follows the planner template: traced (`withSpan`) discrete steps, Zod-validated output, deterministic post-guard, **propose-not-apply** by default, mock mode for `USE_AI_MOCK`.
- **Telemetry first:** a feature without a span + a counter is not done.
- **Tests:** pure logic ≥90%, AI pipelines have fixture-based deterministic tests + nightly live evals. New code may not drop coverage on changed files.
- **Migrations:** committed Drizzle migration + defensive runtime guard; never a destructive migration without a backup hook.
- **Sensitive data:** health/finance/contacts default **local-only**; only sync E2E-encrypted blobs.

## 4. Observability backbone (built in P0/P1, reused everywhere)

- **Spans:** extend `withSpan` to non-AI ops (sync round-trips, conflict resolutions, restores).
- **Counters/gauges:** a tiny `src/observability/metrics.ts` (P1) — `increment(name, tags)`, `gauge(name, value)`. Sinks: in-memory + optional Langfuse/Sentry.
- **Health signals to watch:** sync lag, conflict rate, restore success rate, cognitive-proposal acceptance rate, intervention dismiss rate, crash-free sessions.

## 5. Rollout philosophy

1. **Dogfood flag** → internal builds only.
2. **Shadow mode** for risky AI (cognition runs, logs proposals, shows nothing).
3. **Canary** 5% → 25% → 100% gated on the health signals above.
4. **Kill switch:** every flag is remotely disableable; sync engine has a "freeze writes, drain outbox" safe mode.

## 6. Definition of done for the program

- Trust: a user can lose their phone and fully restore on a new device, encrypted, with version history.
- Cognition: LifeOS can say *"You're overcommitted this week relative to your sleep debt and interview prep — here's why, and here's the adjustment,"* and explain the reasoning.
- Coach: proactive, emotionally aware, can take gated actions, plans recovery.
- Memory: the app remembers who the user was, who they're becoming, and what repeatedly blocks them.
- Orchestration: autonomous, calendar-aware, energy-aware, cross-goal plan suggestions.

Detailed designs: [P1](../implementation-plan/phase-1-trust-foundation.md) · [P2](../docs/architecture/phase-2-cognitive-engine.md) · [P3](../docs/architecture/phase-3-ai-coach.md) · [P4](../docs/architecture/phase-4-memory-graph.md) · [P5](../docs/architecture/phase-5-orchestration.md)
