# Phase 4 — Memory Graph (Design)

> The long-term moat. A projection over the signal stream — can start in parallel with P2.
> Depends on: P0 signal stream, RAG foundations (`src/ai/rag`). Feeds: P3 coach continuity, P5 orchestration.

## Status (updated 2026-05-30)

⏳ **Not started as a general memory graph** — but a polymath-scoped version of the projection pattern shipped via **Explore v2's Constellation**:

- `src/explore/constellation.ts` is the first concrete instance of this phase's "projection, never source of truth" principle (§ Key technical decisions). It deterministically projects nodes/edges from `interests ∪ sparks ∪ expeditions`, dedupes by label, marks cross-discipline "synapses", and is rebuildable from inputs.
- This validates the architectural pattern. Generalizing it to people / projects / values / themes / behavioural patterns across all domains is the work this phase still owns.

What's pending for the broader memory graph:
- `memory_nodes` / `memory_edges` tables across non-polymath domains
- `identity_snapshots` capture
- Node-extraction agent over journal entries (depends on Phase 3 journal analysis)
- Salience decay + merge-on-similarity infra
- Temporal-query agent

---

## PRD
**Thesis:** the app should remember *who the user was, who they're becoming, and what repeatedly blocks them.* This is what makes coaching feel like a relationship, not a session.

**Capabilities**
1. **Long-term memory graph** — typed nodes (Person, Goal, Habit, Theme, Value, Event, Blocker) + edges (causes, blocks, relates-to, evolved-from).
2. **Identity evolution tracking** — snapshots of the user's stated identity/vision over time; surface drift ("6 months ago 'disciplined' mattered most; now it's 'present').
3. **Behavioral relationship mapping** — which habits/contexts cause which outcomes (e.g., "late workouts → next-day low energy").
4. **Temporal reasoning** — answer time-scoped questions ("what's blocked my fitness goal repeatedly this year?").
5. **User narrative continuity** — a coherent story the coach can reference across sessions.

## Key technical decisions
- **Graph as a projection, not a source of truth.** Nodes/edges are *derived* from the signal stream + journal analysis (P3) + goal hierarchy. Rebuildable from the spine → no divergence risk.
- **Storage**: lightweight relational graph in SQLite (`memory_nodes`, `memory_edges`) — **no vector DB** (CLAUDE.md Phase-1 constraint). Semantic recall reuses the **existing RAG cosine retriever** over node embeddings.
- **Extends RAG, not replaces it**: `historyContext.ts` already turns routine history into `RagItem[]`; generalize to emit memory nodes.
- **Incremental projector**: a `memory/projector.ts` consumes new mutations/events and upserts nodes/edges (idempotent, replay-safe).

## Schema changes
- `memory_nodes(id, userId, type, label, summary, embedding BLOB?, salience, firstSeenAt, lastSeenAt, sourceRefs JSON)`
- `memory_edges(id, userId, fromId, toId, relation, weight, evidence JSON, createdAt)`
- `identity_snapshots(id, userId, capturedAt, identity JSON, visionStatement, source)`
- All rebuildable; safe to drop & re-project.

## AI pipeline
- **Node extraction**: journal analysis (P3) + goal/reflection text → candidate nodes/edges → Zod → dedupe against existing (embedding similarity) → upsert.
- **Salience decay**: nodes lose salience over time unless reinforced (keeps the graph focused on what currently matters).
- **Temporal query agent**: question → retrieve relevant nodes/edges in time window → reason → cited answer.

## Observability
- Gauges: `memory.nodes.count`, `memory.edges.count`, projector lag.
- Counters: `memory.node.created|merged`, `memory.query.served`.
- Quality: dedupe precision (are we merging the right nodes), query groundedness (answers cite real nodes).

## Edge cases / failure modes
- Node explosion → salience decay + merge-on-similarity + caps per type.
- Wrong merges collapse distinct concepts → conservative similarity threshold + keep `sourceRefs` to split later.
- Stale identity snapshots → snapshot only on meaningful change (vision edit, major goal shift).
- Privacy: people-nodes are sensitive → local-only, never synced unencrypted.

## Acceptance criteria
- [ ] Graph rebuilds deterministically from the signal stream (drop + re-project = identical graph).
- [ ] Temporal query "what blocks goal X" returns evidence-cited blockers from real events.
- [ ] Identity-evolution view shows ≥2 snapshots with a diff after a vision change.
- [ ] Behavioral edges (cause→effect) are evidence-backed, not asserted.

## Risks
| Risk | Mitigation |
|---|---|
| Graph drifts from truth | Pure projection — rebuildable from spine, never authoritative |
| Privacy of relationship data | People-nodes local-only / E2E-encrypted; never telemetry |
| Vector-DB scope creep | Reuse existing cosine RAG; no new infra (CLAUDE.md constraint) |
| Hallucinated edges | Evidence-citation requirement + similarity-gated dedupe |
