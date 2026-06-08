# LifeOS — Adaptive Cognition Program Roadmap

> Mission: transform LifeOS from "advanced productivity + goal system" into an **AI-native adaptive life operating system.**
> This is the master sequencing document. Each phase has a detailed design under `/implementation-plan` (P1) or `/docs/architecture` (P2–P5).

## Program status (updated 2026-06-09)

> The P0–P5 table is the original "Adaptive Cognition Program." Several rows advanced after the 2026-05-30 freeze — refreshed below against the merged PRs (a corrected snapshot, not a re-plan). A second, **opportunistic workstream** (free-data integrations, voice, prod-readiness) shipped in parallel and was never in this P0–P5 plan — captured in its own section below and in [docs/PARKED_ITEMS.md](../docs/PARKED_ITEMS.md).

| Phase | What's shipped | What's pending | Detailed doc |
|---|---|---|---|
| **P0 Infra** | Typed feature-flag registry; mutation-log primitive (Lamport + hash chain); behaviour-events feed | `metrics.ts` observability counters | — |
| **P1 Trust** | Mutation log wired into goal/routine/reflection writes; **Supabase push/pull sync engine (global-on) + conflict resolver + cross-device sync (E2E-proven, #113/#115); version history + "what changed" activity feed (#120); backup/compaction chain-integrity hardened (#93)** | Encrypted backup/restore + compaction *enablement* (code shipped; `backup_enabled`/`compaction_enabled` gated on a native two-device smoke test — PARKED 1.3/2.5); restore-to-timestamp UI | [phase-1-trust-foundation.md](../implementation-plan/phase-1-trust-foundation.md) |
| **P2 Cognition** | Domain-stagnation detector end-to-end (`DomainNudgeCard`); **overcommitment detector** | Burnout / goal-conflict detectors; cognitive-load index; WHY-engine; callAI-backed suggestion fallback | [docs/architecture/phase-2-cognitive-engine.md](../docs/architecture/phase-2-cognitive-engine.md) |
| **P3 Coach** | **Started — propose-and-confirm AI coach card on Today: action-taking via propose-only write tools + `commitActions`, behind `aiCoachActions` (#121, hardened #123); voice agent with live on-device data tools incl. nutrition (#117/#118/#133); confirm-card UI polished (§3.1 ✅ 2026-06-06)** | Emotional check-ins; journal analysis; proactive intervention queue; recovery planning | [docs/architecture/phase-3-ai-coach.md](../docs/architecture/phase-3-ai-coach.md) |
| **P4 Memory + Explore v2** | **Explore v2** (multi-expedition engine + set-union merge + Daily Spark + expedition gen + constellation + badges/score/telemetry); **durable memory layer — `memory_facts` with consolidation, salience decay, embedding dedup, suppression tombstones, pin, edit, user-added facts, provenance, and the "What LifeOS remembers" surface (#114 + follow-ons); Rabbit Hole v3 — persistent branchable tree-map (Phases 1–7, #150); "Your Maps" gallery polished (§12.2, 2026-06-09)** | Full life-graph (`entity_edges`, 1-hop — PARKED 3.4); identity-evolution snapshots; temporal-query agent; curiosity streak | [phase-4-explore-sparks-expeditions.md](../implementation-plan/phase-4-explore-sparks-expeditions.md), [docs/architecture/phase-4-memory-graph.md](../docs/architecture/phase-4-memory-graph.md) |
| **Priority Change → Routine** | Phase A (two-option sheet, tomorrow regen) + Phase B (real same-day replan, 5-phase sheet, diff preview, 24h undo) + **goal-rebalance UI shipped (`GoalRebalanceSheet`, §3.3 ✅ 2026-06-06); `priorityAdjust` flag ON (2026-06-09)** | Phase C — "why" capture; animated diff | [priority-change-routine-adjustment.md](../implementation-plan/priority-change-routine-adjustment.md) |
| **P5 Orchestration** | — *(the free-data calendar/bills feed into the planner is a precursor, not the autonomous reasoner)* | Whole phase: calendar reasoning, cross-goal optimization, energy-aware scheduling, autonomous suggestions | [docs/architecture/phase-5-orchestration.md](../docs/architecture/phase-5-orchestration.md) |

**Where the moat stands:** P0 done; **P1 now substantially prod-grade** (sync + conflict + version history live; backup/restore code-complete but native-gated); P2 partial; **P3 and P4 have both *advanced*** — coach confirm-card fully polished, goal-rebalance intelligence wired, Rabbit Hole v3 shipped, "Your Maps" gallery polished. The remaining moat depth is the broader coach (emotional check-ins, journal analysis, proactive interventions), the life-graph, and orchestration.

### Parallel workstream — Data leverage, voice & production-readiness (not in the original P0–P5 plan)
Shipped opportunistically 2026-06-01 → 06-09, advancing the six engines via free external data + prod hardening:
- **Free Google data into the engines (web-only OAuth, keys server-side):** Calendar read → planner + what-next; Gmail subscriptions/bills → Finance audit + planner; YouTube subscriptions → Explore interests (all #114); Google Contacts + birthdays → Social (#128).
- **Voice agent** with live on-device data tools (#117/#118/#133).
- **Coverage/CI hardening** (coverage-gate folds + import-card render tests, #130/#136) and the [pre-production checklist](../docs/PRE_PRODUCTION_CHECKLIST.md) / [manual-ops list](../docs/MANUAL_OPS_TODO.md).
- **LLM latency — fully shipped (§10.1–10.3, 2026-06-08):** `Server-Timing` instrumentation; cheap-tier Groq routing active (`EXPO_PUBLIC_CHEAP_PROVIDER=groq`, `llama-3.1-8b-instant` for cheap tasks); **SSE streaming** for all prose surfaces — `callGeminiStream`/`callGroqStream` in Worker, `callAIStream` in client, live-bubble chat; tool-use and JSON calls remain non-streaming. Cost ledger + telemetry preserved on the stream path.
- **Goals page revamp — fully shipped (§11.1–11.4, 2026-06-06/09):** Action-first layout (Now/Build/Archive), editable goals, render-perf O(1) comment counts, `priorityAdjust` flag ON.
- **Goal intelligence wired (§3.3, 2026-06-06):** `GoalRebalanceSheet` + `detectDomainDivergence` on Goals focus; `recoverGoal` 7-day recovery plan in `GoalDetailSheet`.
- **ED-safety code items (§9.1, 2026-06-09):** `CalorieRing` shaming color removed; NEDA crisis off-ramp added; gamification audited (clean). Human sign-off (copy review + range-display decision) remains the promotion gate.
- **Scoped, not started:** Google Maps Platform (PARKED §8), Adaptive TDEE / nutrition v2 (§9.2 — gated on §9.1 sign-off), O*NET + Adzuna career grounding (§5.2).

Canonical backlog + un-park triggers for everything above: [docs/PARKED_ITEMS.md](../docs/PARKED_ITEMS.md).

**Parked decisions:** External interop via MCP (Model Context Protocol — server *and* client) was evaluated 2026-05-31 and deliberately deferred — see [mcp-interop-decision.md](../docs/architecture/mcp-interop-decision.md). The tool layer is already MCP-shaped, so adoption is a later thin adapter, not a rewrite; an agent-to-agent bridge, if ever built, lives at P5+.

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
