# LifeOS — Architecture Audit (Pre-Program)

> Date: 2026-05-27 · Author: program engineering · Status: baseline for the Adaptive Cognition program
> Read this before touching any phase. It is the ground truth the roadmap is sequenced against.

## Update 2026-05-30 — what shipped against this audit

The thesis ("one event-sourced spine + four projections") survived contact with implementation. Concretely, the spine is now real and **wired**:

- **Mutation log primitive** (Lamport clock + canonical hashing + chained, ID-stable append) lives in `src/sync/{lamport,hashChain,mutationLog}.ts` — pure, fully covered, platform-free.
- **Wired into the write path** (`8470439`): `goals`, `routine_blocks`, and `daily_reflections` query modules now emit mutation entries on every write. So the audit's §2.4 finding ("Sync / trust — effectively absent") is no longer quite right: the *log* is built and recording; the *sync engine* (push/pull, conflict resolver, restore) is still ahead.
- **`mergeExpeditionProgress`** — the first conflict-free per-entity resolver — is built and property-tested, ready to register when `src/sync/resolve.ts` lands.

Projections built so far:
- **Cognition stream** (audit §3): the `cognitive_insights` table + the domain-stagnation detector + `DomainNudgeCard` are live. First detector in the cognitive engine.
- **Memory projection** (audit §3): the Explore v2 *constellation* is the first projection of this shape — pure, deterministic, rebuildable from `interests ∪ sparks ∪ expeditions`. It's polymath-scoped today; the broader memory graph hasn't started.

Other concrete deltas vs. the audit:
- The "schema.ts ↔ runtime drift" item (§5 risk table) is largely reconciled by the BUG-009 work + the other session's pre-beta polish; `contacts` table is canonically dropped.
- The web persistence concern (§5 risk table) is handled by the per-entity `webStorage/*` layer rather than an IndexedDB-Drizzle adapter — different mechanism, same outcome (web no longer drops data).
- Beyond our program: the other session shipped a pre-beta retention probe, worker cost ledger, route-guard refactor, and significant E2E test coverage. None invalidate the audit's findings.

What still holds verbatim: the leverage-point thesis (§3), the insertion strategy (§4: wrap the write path, not the call sites — which is exactly how the wiring landed), and most of the risk register.

---

## 1. Purpose

Before writing a line of new code we audited the existing system to answer three questions:

1. **What already exists that we must reuse** (execution rule #2, #4)?
2. **Where is the single highest-leverage primitive** that unlocks multiple phases at once (execution rule #6)?
3. **What is genuinely missing** vs. what merely needs extension?

The conclusion drives the entire program: **LifeOS does not need five new subsystems. It needs one event-sourced spine, and four projections over it.**

---

## 2. What exists today (verified by code inspection)

### 2.1 Data layer — `src/db/`
- **Native:** Expo SQLite + Drizzle ORM. WAL mode, FKs on, `enableChangeListener: true` ([src/db/index.ts:16](../src/db/index.ts#L16)).
- **Web:** a chainable **no-op proxy** — `.all()→[]`, `.get()→undefined` ([src/db/index.ts:24](../src/db/index.ts#L24)). **Web has no persistence today.** This is a major Phase 1 gap, not a minor one.
- **Migrations:** dual path — committed Drizzle migrations (`src/db/migrations/0000…0003`) **and** a defensive runtime `initDatabase()` with `CREATE TABLE IF NOT EXISTS` + `safeAlter()` for late columns ([src/db/index.ts:52](../src/db/index.ts#L52)). Schema drift exists: `schema.ts` still declares `contacts`/`contactInteractions` while `initDatabase()` **drops** them as zombie tables ([src/db/index.ts:296](../src/db/index.ts#L296)). **Action: reconcile schema.ts with reality during Phase 1.**
- **Write path:** one-file-per-entity query modules in `src/db/queries/` (15 files). All writes funnel through these. **This is the clean injection point for change-capture** — we do not need to touch call sites.
- **ID strategy:** `text('id')` + nanoid everywhere. `createdAt`/`updatedAt` near-universal; `deletedAt` (soft delete) only on `users`, `goals`, `contacts(dropped)`. **No table has a version, vector clock, dirty flag, or origin-device column.**

### 2.2 AI layer — `src/ai/` (the strongest part of the codebase, ~45% covered)
- **`callAI`** unified client — CLI proxy / API / mock, prompt caching, token accounting.
- **`pickModel(task)`** model router — per-task model selection. Reuse for cognition tasks.
- **Agent pattern** — `src/ai/agent/planner.ts`: `retrieve → propose → critique → commit`, each a discrete traced LLM call, Zod-validated, with a **deterministic post-guard** (window filter) as last line of defence. **This is the template for every cognitive pipeline in Phases 2–3.**
- **RAG** — `src/ai/rag/{embed,retrieve}.ts`: cosine-similarity retrieval over `RagItem[]`; `historyContext.ts` builds items from recent routine blocks. **This is the seed of the memory graph (Phase 4).**
- **Tracing** — `withSpan()` with nesting, token/cost capture, optional Langfuse export ([src/ai/tracing.ts](../src/ai/tracing.ts)). **This is our observability substrate for the whole program — do not build a second one.**
- **Prompts** — one file per domain in `src/ai/prompts/` (12 files, incl. `behaviour.ts`, `reflection.ts`).

### 2.3 Signal layer — `behaviourEvents` + adaptation
- **`behaviourEvents`** table: append-only `{eventType, module, metadata, hour, dayOfWeek, createdAt}`, indexed on time ([schema.ts:253](../src/db/schema.ts#L253)).
- **`src/utils/behaviourPatterns.ts`** — 5 local detectors (workout_timing, session_length, weekend_drift, dropped_habit, productive_hour_shift).
- **`dailyReflections`** — mood(1–5) + block reviews + AI tweak payload.
- **`profileLearning.ts`** — infers productive hours, dropped habits, rest days.
- **Verdict:** this is a *proto-cognitive-engine*. Phase 2 **extends** it; it does not replace it.

### 2.4 Sync / trust — effectively absent
- Supabase client is configured for **auth/session only** (`src/integrations/supabase/`). **No data replication, no outbox, no conflict policy, no version history, no backup/export.**
- This is the largest true gap and the program's Phase 1.

### 2.5 Feature flags — absent
- Flags today = ad-hoc `process.env.EXPO_PUBLIC_*` reads scattered across files. No typed registry, no runtime toggle, no per-user gating. **Phase 1 establishes a typed flag primitive** (execution rule #8: every risky system ships behind a flag).

---

## 3. The leverage point — one spine, four projections

The five requested phases look independent. They are not. Four of the five want the **same underlying capability: an ordered, durable log of state changes.**

| Phase | What it actually needs | …which is a function of |
|---|---|---|
| P1 Sync | Know what changed locally → push; apply remote changes → resolve | an **append-only mutation log** (outbox + inbox) |
| P1 Version history / snapshot restore | Replay or revert past states | the **same mutation log**, queried by time |
| P2 Cognitive engine | Longitudinal stream of "what the user did & when" | **mutations ∪ behaviourEvents** = a unified signal stream |
| P4 Memory graph | Temporal reasoning, identity evolution over time | a **projection** over the signal stream |
| P5 Orchestration | Consistent current-state to optimize against | the materialized state the log keeps coherent |

**Decision:** build a single primitive — the **Mutation Log (Change Data Capture)** — and derive sync, versioning, cognition signals, and memory from it. This is the moat. Everything else is a read-model over it.

```
                        ┌─────────────────────────────┐
   query-layer writes → │      MUTATION LOG (CDC)      │ ← append-only, per-row, hash-chained
                        │  {entity,op,before,after,    │
                        │   ts, deviceId, lamport, ver}│
                        └──────────────┬──────────────┘
            ┌──────────────┬───────────┴───────┬────────────────────┐
            ▼              ▼                   ▼                    ▼
      SYNC ENGINE    VERSION HISTORY      SIGNAL STREAM         MEMORY GRAPH
      (P1 push/pull) (P1 restore)      (P2 cognition feed)    (P4 projection)
        ▲                                    │
        └── conflict resolver (LWW + merge)  └── + behaviourEvents (existing)
```

### Why this respects every execution rule
- **Reuse, no duplicate infra:** sync, versioning, cognition signals, and memory all read one table.
- **Extensible primitive over hardcoded features:** the log is entity-agnostic; new tables get sync/versioning/cognition *for free* by routing through the wrapped write helper.
- **Minimize debt:** we do *not* bolt a sync field onto every table or write five bespoke change-trackers.
- **Moat over surface:** the spine is invisible to users but is the thing competitors can't copy in a sprint.

---

## 4. Insertion strategy (how we add the spine without a rewrite)

1. **Wrap the write path, not the call sites.** Introduce `recordMutation()` invoked from a thin `mutate()` helper that the `src/db/queries/*` modules adopt incrementally. Unconverted queries keep working (backward compatible).
2. **Hash-chain entries** (`prevHash → hash`) for tamper-evidence and cheap integrity checks on restore/sync.
3. **Lamport clock + deviceId** per entry for deterministic conflict ordering without wall-clock trust.
4. **Everything behind `flags.syncEngine` / `flags.versionHistory`** — off by default, no behavioural change until explicitly enabled.

---

## 5. Risks identified up front

| Risk | Severity | Mitigation (designed into the roadmap) |
|---|---|---|
| Web has no DB — sync can't be "cross-device" until web persists | High | Phase 1 task 0: replace web no-op with IndexedDB-backed adapter (`src/db/webStorage/` already exists as a stub) |
| Schema.ts ↔ runtime drift (`contacts`) | Medium | Reconcile in Phase 1 migration; add a CI check that diffs declared vs. created tables |
| Mutation log unbounded growth | Medium | Compaction policy: keep full entries N days, then fold to per-entity snapshots (designed in Phase 1 §telemetry) |
| LLM cognitive outputs are non-deterministic / unsafe | High | Reuse planner's pattern: Zod schema + deterministic post-guard + `withSpan` eval; never auto-apply, always propose |
| Sensitive data (health, finance) leaving device via sync | Critical | Per-table sync policy; health/finance default **local-only**; E2E-encrypted blobs for anything that does sync |

---

## 6. What we will NOT do (anti-scope)

- No second observability stack — extend `withSpan`/Langfuse.
- No second event table — generalize `behaviourEvents` into the signal stream; don't fork it.
- No rewrite of the planner agent — clone its shape for new cognitive agents.
- No per-table bespoke sync code — one CDC spine, entity-agnostic.
- No cosmetic UI expansion — every ticket must answer "does this increase adaptive cognition, trust, memory, or orchestration?"

---

## 7. Baseline metrics (so we can prove progress)

- Test coverage: **15.2% lines** (1,021/6,713); `src/ai` 45.6%, `src/db` 13.6%, components 0%.
- Vision completeness (prior assessment): raw build ~48/100; **category-defining ~30/100**.
- The program's north-star metric: move category-defining completeness 30 → 65 by end of Phase 3, with trust infrastructure (Phase 1) at production-grade first.
