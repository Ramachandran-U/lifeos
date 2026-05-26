# Phase 1 — Trust Foundation (Detailed Design)

> Status: design complete, implementation started (increment 1). Owner: program eng.
> Depends on: P0 spine (mutation log + flags). Blocks: P5 orchestration.

## A. PRD

### Problem
LifeOS asks users to store their dreams, health data, finances, and emotional reflections. Today that data lives in a single device's SQLite file with **no sync, no backup, no version history, and no web persistence**. A lost phone = a lost life history. The vision's #1 priority ("trust is foundational") is the product's weakest area. No trust → no permission to become the cognitive layer.

### Users & jobs
- *"I got a new phone — bring my whole LifeOS across, exactly."*
- *"I edited my routine on my laptop and phone — don't lose either."*
- *"I deleted a goal by accident yesterday — give it back."*
- *"Export everything, encrypted, so I own my data."*

### Goals (this phase)
1. Cross-device sync (native ⇄ web) with last-writer-wins + field-merge conflict resolution.
2. Offline-first reconciliation (queue locally, drain when online).
3. Per-entity version history + restore-to-timestamp.
4. Encrypted backup/export + import.
5. Reliability instrumentation (sync lag, conflict rate, restore success).

### Non-goals
- Real-time collaborative editing (CRDT text merge). LWW per field is enough.
- Syncing health/finance/contacts to the cloud by default (local-only; only encrypted blobs opt-in).
- Multi-user / sharing.

### Success metrics
- Restore success rate ≥ 99.5% (new-device restore completes with zero data loss).
- Sync convergence: two devices agree within 5s of both being online, p95.
- Conflict rate < 1% of synced mutations; 100% of conflicts resolved deterministically (no user-facing data loss).
- Web persistence: 0 data lost on web reload (today: 100% lost).

---

## B. Technical design

### B.1 The spine — Mutation Log (CDC)
Single append-only table, entity-agnostic. Every converted write emits one row.

```
mutations(
  id           text pk,           -- nanoid
  entity       text not null,     -- 'goals' | 'routine_blocks' | ...
  entityId     text not null,
  op           text not null,     -- 'insert' | 'update' | 'delete'
  before       text,              -- JSON snapshot (null on insert)
  after        text,              -- JSON snapshot (null on delete)
  fields       text,              -- JSON string[] of changed columns (update only) — enables field-merge
  ts           text not null,     -- ISO wall clock (display/debug only)
  lamport      integer not null,  -- monotonic logical clock — authoritative ordering
  deviceId     text not null,
  userId       text not null,
  prevHash     text,              -- hash chain
  hash         text not null,     -- sha256(prevHash + canonical(payload))
  syncState    text not null,     -- 'pending' | 'acked' | 'applied_remote'
  createdAt    text not null
)
-- indexes: (userId, lamport), (entity, entityId, lamport), (syncState)
```

- **Lamport clock** (`src/sync/lamport.ts`): `local = max(local, seenRemote) + 1` on every mutation. Survives clock skew; deterministic total order via `(lamport, deviceId)` tiebreak.
- **Hash chain**: tamper-evidence + O(1) "are these two devices in sync" check (compare head hash).
- **Insertion point**: a `mutate(entity, op, fn)` helper in `src/db/mutate.ts` that (1) reads `before`, (2) runs the Drizzle write, (3) reads `after`, (4) appends the mutation. `src/db/queries/*` adopt it incrementally — **unconverted queries keep working** (backward compatible; they just don't get sync/versioning until converted).

### B.2 Sync engine — `src/sync/engine.ts`
Outbox/inbox over Supabase (already authed).

- **Push**: select `syncState='pending'` ordered by lamport → upsert to Supabase `mutations` table (RLS by userId) → mark `acked`.
- **Pull**: fetch remote mutations with `lamport > lastPulledLamport` → apply via **reducer** (B.3) → mark `applied_remote`.
- **Transport**: Supabase Realtime channel for push notifications of new remote mutations; fallback poll every 30s.
- **Offline**: pure local writes accumulate as `pending`; engine drains on reconnect (`NetInfo` listener). No special offline mode — offline is the default and online is an optimization.

### B.3 Conflict resolution — `src/sync/resolve.ts`
Deterministic, no user prompts.
- **Insert/insert (same id)**: impossible (nanoid). If seen, higher `(lamport, deviceId)` wins.
- **Update/update**: **field-level merge** using the `fields` array — non-overlapping fields merge cleanly; overlapping fields resolve by higher `(lamport, deviceId)` (LWW). This is why we store `fields`.
- **Update/delete**: delete wins if its lamport ≥ update's; else update resurrects (tombstone with lower lamport is overridden).
- **Reducer purity**: applying the same remote mutation twice is idempotent (keyed by mutation id in an `applied_mutations` set).

### B.4 Version history & restore — `src/sync/history.ts`
- **History(entity, entityId)** = `mutations` filtered + ordered by lamport → reconstruct timeline of `after` snapshots.
- **Restore-to-timestamp(t)**: compute the state as-of lamport ≤ L(t) by folding mutations; write the diff as **new** mutations (restore is itself an auditable event, never a destructive rewind).
- **Snapshot compaction**: nightly job folds mutations older than `RETAIN_FULL_DAYS` (default 30) into a per-entity `snapshots` row; keeps the log bounded. History older than that is snapshot-granular, not field-granular.

### B.5 Encrypted backup/export — `src/sync/backup.ts`
- Full export = all entities + mutation head hash, serialized to JSON, AES-256-GCM encrypted with a key derived (PBKDF2/scrypt via `expo-crypto`) from a user passphrase.
- Export via `expo-file-system` + `expo-sharing`. Import validates hash chain before applying.

### B.6 Web persistence (prerequisite — audit §5)
Replace the web no-op proxy with an IndexedDB-backed Drizzle adapter (`src/db/webStorage/`, currently a stub) so "cross-device" includes web. Tracked as **P1-T0**, parallelizable.

---

## C. Schema changes & migration

- **New tables**: `mutations`, `snapshots`, `applied_mutations`, `sync_state` (per-device cursor: `lastPulledLamport`, `deviceId`).
- **No changes to existing entity tables** (the spine is external — this is the key debt-avoidance decision).
- **Reconcile drift**: remove `contacts`/`contactInteractions` from `schema.ts` to match `initDatabase`'s drop (audit §2.1).
- **Migration**: `0004_mutation_log.sql` (Drizzle) + matching `CREATE TABLE IF NOT EXISTS` in `initDatabase()`. Backfill: none — the log starts empty; existing rows are treated as lamport-0 baseline on first sync via a one-time `seedBaseline()`.
- **CI guard**: new test diffs `schema.ts` declared tables vs. `initDatabase` created tables; fails on drift.

## D. API / interface changes
- `mutate(entity, op, mutatorFn)` — new write primitive.
- `sync.start() / sync.stop() / sync.status()` — engine lifecycle.
- `history.list(entity, id) / history.restoreTo(ts)` — versioning surface.
- `backup.export(passphrase) / backup.import(blob, passphrase)`.
- All gated by `flags.syncEngine`, `flags.versionHistory`, `flags.encryptedBackup`.

## E. Observability plan
- **Spans** (`withSpan`): `sync.push`, `sync.pull`, `sync.resolveConflict`, `history.restore`, `backup.export`.
- **Counters** (`metrics.ts`): `sync.mutations.pushed`, `.pulled`, `.conflicts`, `.conflicts.resolved`, `backup.export.ok|fail`, `restore.ok|fail`.
- **Gauges**: `sync.lag.ms`, `sync.outbox.depth`, `mutations.log.size`.
- **Dashboards/alerts**: conflict rate > 1%, outbox depth > 500, restore failure any.

## F. Telemetry requirements
- Every mutation tagged with `entity`, `op`, `origin (local|remote)`.
- Sync round-trip timing histogram.
- Restore funnel: initiated → validated → applied → confirmed.
- Privacy: telemetry carries **counts and timings only — never payloads**.

## G. Edge cases & failure modes
| Case | Handling |
|---|---|
| Two devices edit same field offline | LWW by `(lamport, deviceId)`; loser's value retained in history for restore |
| Clock skew / device clock wrong | Lamport is authoritative; wall-clock `ts` is display-only |
| Partial push (network drop mid-batch) | Idempotent upsert by mutation id; resume from last acked |
| Corrupt remote mutation (hash mismatch) | Reject, quarantine in `mutations_quarantine`, alert; never apply |
| Log grows unbounded | Nightly compaction to `snapshots` past retention window |
| Restore to a corrupted point | Hash-chain validated before restore; abort if broken |
| User forgets backup passphrase | Cannot decrypt (by design); UX warns clearly at export time |
| Sensitive table accidentally synced | Per-entity allowlist; health/finance/contacts excluded at the `mutate` layer unless E2E-encrypted |

## H. Rollout
1. P0 spine behind `flags.mutationLog` (shadow — log only, no sync). **(this turn)**
2. Internal dogfood: `flags.syncEngine` on for team accounts; watch conflict rate.
3. Canary 5→25→100% gated on convergence p95 < 5s and conflict rate < 1%.
4. Kill switch: `sync.freeze()` drains outbox and stops accepting new remote mutations.

## I. Implementation tasks (sequenced)
- **P1-T0** Web IndexedDB persistence (parallel).
- **P1-T1** Feature-flag registry `src/config/flags.ts` + tests. ← *increment 1*
- **P1-T2** Mutation-log schema + `recordMutation` + hash chain + lamport + tests. ← *increment 1*
- **P1-T3** `mutate()` write helper; convert `goals` + `routine_blocks` queries; tests.
- **P1-T4** `metrics.ts` observability primitive + spans on writes.
- **P1-T5** Supabase `mutations` table + RLS + push/pull engine + NetInfo drain.
- **P1-T6** Conflict resolver + reducer + idempotency + property tests.
- **P1-T7** Version history list + restore-to-timestamp + tests.
- **P1-T8** Encrypted backup/export/import + hash validation + tests.
- **P1-T9** Compaction job + log-size gauge.
- **P1-T10** Schema-drift CI guard; reconcile `contacts`.

## J. Acceptance criteria
- [ ] Two simulated devices converge to identical head hash after concurrent edits (property test).
- [ ] Field-merge: device A edits `title`, device B edits `notes` on same block offline → both survive.
- [ ] Restore-to-timestamp reproduces exact prior state and is itself logged.
- [ ] Encrypted export → wipe → import = byte-identical state; tampered blob rejected.
- [ ] Web reload preserves all data.
- [ ] All of the above behind flags; flags off = zero behavioural change vs. today.
- [ ] Coverage on `src/sync/**` ≥ 90%.

## K. Risk analysis
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sync bugs corrupt user data | Med | Critical | Append-only log + hash chain + restore = data is never destroyed, only superseded; everything behind flag + shadow mode |
| Supabase RLS misconfig leaks cross-user data | Low | Critical | RLS policy tests in CI against a seeded multi-user fixture before any rollout |
| Encryption key handling bug | Low | Critical | Use vetted `expo-crypto` primitives; never store passphrase; security review of `backup.ts` |
| Compaction loses history users wanted | Low | Med | Retention window configurable; export before compaction; snapshots retain state (not field detail) |
| Scope creep into CRDT | Med | Med | Explicit non-goal; LWW+field-merge is the ceiling for P1 |
