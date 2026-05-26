# Phase 5 — Cognitive Orchestration (Design)

> The end state: a true life operating system that reasons across calendar, goals, energy, and context.
> Depends on: P1 (trusted multi-device state), P2 (cognition), P4 (memory). Last phase by design.

## PRD
**Thesis:** *"You're overcommitting this week relative to your sleep debt and interview-prep goal — here's the rebalanced plan."* Orchestration is cognition applied to the calendar and the full goal portfolio, autonomously.

**Capabilities**
1. **Calendar reasoning** — ingest Google/Apple calendar (clients exist, logic minimal); understand commitments, travel, focus time.
2. **Cross-goal optimization** — allocate scarce time/energy across competing goals by priority, deadline, and momentum.
3. **Energy-aware scheduling** — place high-energy work in the user's productive hours (signals exist: `energyRequired`, `productiveHours`, sleep logs).
4. **Autonomous plan suggestions** — proactively propose next-week structure; gated, never silent auto-apply.
5. **Contextual prioritization** — "given today's reality (low sleep, packed calendar), here's the one thing that matters."

## Key technical decisions
- **Reuse the planner agent** as the optimization core; extend its inputs with calendar events + cognitive-load index (P2) + memory (P4).
- **Constraint-solver, not just LLM**: deterministic scheduler places fixed/calendar blocks and enforces hard constraints (wake/sleep/work, energy windows); the LLM proposes *what* to do, the solver decides *when*. Mirrors the planner's existing deterministic post-guard, scaled up.
- **Conflict detection** reuses P2 goal-conflict reasoning over the *scheduled* week, not just goals in the abstract.
- **Calendar reads only** at first (no write-back) until trust is proven; write-back is a later gated step.

## Schema changes
- `calendar_events_cache(id, userId, source, externalId, start, end, title, busy, syncedAt)` — local cache; never the source of truth.
- `plan_suggestions(id, userId, weekOf, plan JSON, rationale, status[proposed|accepted|dismissed], createdAt)`.
- Reuse `routine_blocks` for committed plans (already synced/versioned via P1).

## AI pipeline
- **Weekly orchestration agent**: gather (calendar + goals + cognitive load + memory) → propose allocation → solver places blocks → critique (conflicts, overload) → present. Traced; propose-not-apply.
- **Daily contextual prioritizer**: cheap, mostly deterministic (today's load + calendar + top-priority goal) → one-line "what matters most".

## Observability
- Counters: `orchestration.suggestion.proposed|accepted|dismissed`, `calendar.sync.ok|fail`, `schedule.conflict.detected`.
- Spans: weekly orchestration run, solver, calendar sync.
- Quality: suggestion acceptance rate; overcommitment incidents *after* a plan was accepted (did it actually help?).

## Edge cases / failure modes
- Calendar API down → degrade to last cache + flag staleness.
- Over-optimization (robotic days) → enforce slack/rest minimums; respect protected interests/time.
- Timezone/DST in calendar math → normalize to user tz; test DST boundaries.
- Conflicting hard constraints (impossible week) → surface the conflict honestly rather than producing a broken plan.

## Acceptance criteria
- [ ] Given a packed calendar + sleep debt, the orchestrator produces a rebalanced week that respects all hard constraints and reduces overcommitment vs. naive.
- [ ] Energy-aware: high-energy blocks land in productive hours on fixtures.
- [ ] Cross-goal: when two goals compete, the suggestion explains the tradeoff and defers by priority/deadline.
- [ ] Nothing auto-applies; calendar is read-only this phase.

## Risks
| Risk | Mitigation |
|---|---|
| Autonomous suggestions feel out of control | Gated, explainable, never silent; user accepts |
| Calendar write-back corrupts external calendars | Read-only in P5; write-back is a separate gated phase |
| Solver produces robotic/inhumane schedules | Hard slack/rest minimums; protect interests; humane-by-constraint |
| Compounding errors from P2/P4 inputs | Orchestration cites its inputs; bad input surfaces as low-confidence, not bad plan |
```
