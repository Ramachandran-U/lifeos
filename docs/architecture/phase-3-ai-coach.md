# Phase 3 — AI Coach (Design)

> Turns the read-only chatbot into a proactive, emotionally aware, action-taking coach.
> Depends on: P2 cognition (something to reason about), P4 memory (continuity). Today: chat is read-only v1.

## Status (updated 2026-05-30)

⏳ **Not started.** Dependencies are now partially in place:

- The **cognitive engine** has its first detector live (domain stagnation), and the `cognitive_insights` table is the substrate this phase's interventions will read from.
- The **mutation log** wired into goal/routine/reflection writes (the substrate for "action-taking with full auditability") is shipped.
- Chat remains read-only; no tool-use loop has been wired.

The next-up unit for this phase is probably the **journaling-analysis pipeline** (it's the cheapest path to the memory graph too) and the **intervention timing engine** that surfaces existing cognitive insights at the right moment.

---

## PRD
**Thesis:** the difference between "another AI app" and the vision is a coach that *understands, reasons, adapts, coaches, and acts* — grounded in the user's real history and emotional state.

**Capabilities**
1. **Emotional check-ins** — lightweight, well-timed (post-reflection, after a missed streak, low-energy days). Tracks emotional state over time, not just mood(1–5).
2. **Reflective journaling analysis** — free-text journal → themes, recurring blockers, sentiment trajectory; feeds memory graph.
3. **Proactive interventions** — coach surfaces P2 insights at the right moment with the right tone (not a notification dump).
4. **Recovery planning** — on burnout signal, generate a lighter, restorative plan; protect sleep/rest; scale back commitments.
5. **AI-generated routine adjustments** — reuse the planner agent; coach proposes concrete block edits tied to an insight.
6. **Action-taking assistant** — upgrade chat from read-only to **gated tool-use**: create/edit goals, reschedule blocks, log reflections — with confirmation and full mutation-log auditability.

## Key technical decisions
- **Action-taking = native tool-use.** The planner doc already notes migrating `callAI` to tool-use is a one-step swap. Define a typed tool registry (`src/ai/coach/tools.ts`); each tool is a guarded wrapper over an existing `mutate()` query (so every coach action is synced + versioned + reversible by P1). **No new write paths.**
- **Confirmation gating:** destructive/visible actions require explicit user confirm; read/compute actions auto-run. Same risk model as the harness's own action policy.
- **Emotional state model:** `emotional_state` time series derived from check-ins + journal sentiment + mood; never a clinical label.
- **Tone/persona:** single source-of-truth persona prompt (also the named-AI from the branding track). Coach reads memory graph (P4) for continuity ("last month you said interviews stress you — how's that going?").

## Schema changes
- `journal_entries(id, userId, date, body, analysis JSON, createdAt)` — body local-only by default; analysis is structured.
- `emotional_state(userId, date, valence, arousal, themes JSON, confidence)`.
- `interventions(id, userId, insightId, channel, shownAt, response[acted|dismissed|snoozed], createdAt)`.
- `coach_actions(id, userId, tool, args JSON, status, mutationId, createdAt)` — audit of every tool call, linked to its mutation.

## AI pipeline & prompts
- **Journaling analysis agent**: entry → themes + blockers + sentiment → Zod → guard (no diagnosis) → store + emit memory nodes (P4).
- **Intervention timing engine**: deterministic policy (when to surface) + LLM phrasing (how). Right moment > clever message.
- **Recovery planner**: planner agent variant constrained to reduce load, protect rest, defer low-priority goals (reads P2 cognitive-load index).
- **Coach tool-use loop**: traced; each tool call Zod-validated args → confirmation gate → `mutate()` → audit row.

## Observability
- Counters: `coach.checkin.shown|completed`, `coach.intervention.acted|dismissed|snoozed`, `coach.action.{tool}.proposed|confirmed|executed`, `journal.analyzed`.
- Spans: journaling analysis, recovery plan, each tool call.
- Quality metric: **intervention acted-rate** and **action confirm-rate**.

## Telemetry & privacy
- Journal bodies are local-only; only derived analysis (themes, sentiment scores) is eligible for sync (E2E-encrypted).
- Emotional state is sensitive — never sent to telemetry; only aggregate counts.

## Edge cases / failure modes
- User in genuine crisis → crisis-resource fallback + hard stop on "optimize" framing; never act as therapist.
- Coach proposes a harmful action (e.g., delete goals) → confirmation gate + mutation-log reversibility.
- Tool-use hallucinated args → Zod reject + re-ask, never execute unvalidated.
- Notification fatigue → intervention rate limits shared with P2 cooldowns.

## Acceptance criteria
- [ ] Coach can create a goal and reschedule a block via gated tool-use; both appear in the mutation log and are restorable.
- [ ] Journaling analysis extracts themes and never emits a clinical diagnosis (guard test).
- [ ] Burnout insight → recovery plan that demonstrably lowers planned load vs. the original.
- [ ] Every coach action has a confirmation gate (visible/destructive) and an audit row.
- [ ] Crisis language triggers resource fallback, not optimization.

## Risks
| Risk | Mitigation |
|---|---|
| Coach takes unwanted actions | Confirmation gating + mutation-log reversibility (P1) + audit table |
| Emotional/clinical overreach | Non-clinical guards, crisis fallback, supportive-not-diagnostic tone |
| Creepy proactivity | Timing policy + rate limits + acted-rate gating; shadow before exposure |
| Privacy of journal/emotional data | Local-only bodies; E2E-encrypted derived data; never in telemetry |
