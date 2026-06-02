/**
 * Log-compaction (P1-T9). Two concerns under test:
 *   1. PLANNING — the safety rules (min size, never-pending, commutative-or-
 *      dormant) decide WHAT collapses.
 *   2. HASH-CHAIN RE-CHAIN (the 2.4 fix) — after collapsing interior rows the
 *      local chain must stay contiguous: checkpoints carry REAL chain links and
 *      survivors are re-linked, so `validateChain` over the local subsequence is
 *      intact (-1) and `resume` gets a real head. These are the data-integrity
 *      tests, so they're the heaviest.
 *
 * The harness builds a REAL chain with the deterministic testHasher, applies a
 * plan exactly as the sink would (delete + rechain UPDATE + checkpoint insert),
 * and re-validates the local chain.
 */
import {
  planCompaction,
  COMMUTATIVE_ENTITIES,
  type CompactionEntry,
  type CompactionPlan,
  type CompactionOpts,
} from '../compaction';
import { chainHash, validateChain } from '../hashChain';
import { chainPayload, type MutationRecord, type MutationOp, type EntitySnapshot } from '../mutationLog';
import { compareMutationOrder } from '../resolve';
import type { SyncState } from '../sink';
import { testHasher } from './testHasher';

const RECENT = '2026-05-31T10:00:00.000Z';
const OLD = '2026-04-01T00:00:00.000Z';
const OPTS: CompactionOpts = {
  minMutations: 3,
  retainCutoffTs: '2026-05-01T00:00:00.000Z',
  commutative: COMMUTATIVE_ENTITIES,
};

interface Spec {
  entity: string;
  entityId: string;
  id: string;
  lamport: number;
  after: EntitySnapshot;
  syncState?: SyncState;
  ts?: string;
  op?: MutationOp;
  deviceId?: string;
}

function mkRec(s: Spec): MutationRecord {
  return {
    id: s.id,
    entity: s.entity,
    entityId: s.entityId,
    op: s.op ?? 'update',
    before: null,
    after: s.after,
    fields: s.after ? Object.keys(s.after) : [],
    ts: s.ts ?? RECENT,
    lamport: s.lamport,
    deviceId: s.deviceId ?? 'A',
    userId: 'u',
    prevHash: null,
    hash: '',
  };
}

/**
 * Build a VALID starting chain. Local (non-applied_remote) records are chained
 * in compareMutationOrder; applied_remote records get an independent link (they
 * belong to another device's chain fragment and aren't part of the local head).
 */
async function buildChain(specs: Spec[]): Promise<CompactionEntry[]> {
  const recs = specs.map(mkRec);
  const state = new Map<MutationRecord, SyncState>(recs.map((r, i) => [r, specs[i]!.syncState ?? 'acked']));
  const local = recs.filter((r) => state.get(r) !== 'applied_remote').sort(compareMutationOrder);
  let prev: string | null = null;
  for (const r of local) {
    r.prevHash = prev;
    r.hash = await chainHash(prev, chainPayload(r), testHasher);
    prev = r.hash;
  }
  for (const r of recs) {
    if (state.get(r) === 'applied_remote') {
      r.prevHash = `remote-prev:${r.id}`;
      r.hash = await chainHash(r.prevHash, chainPayload(r), testHasher);
    }
  }
  return recs.map((r) => ({ record: r, syncState: state.get(r)! }));
}

/** Apply a plan exactly as the sink does: delete, rechain UPDATE, insert ckpts. */
function applyPlan(entries: CompactionEntry[], plan: CompactionPlan): CompactionEntry[] {
  const del = new Set(plan.deleteIds);
  const re = new Map(plan.rechained.map((r) => [r.id, r] as const));
  const out: CompactionEntry[] = [];
  for (const e of entries) {
    if (del.has(e.record.id)) continue;
    const r = re.get(e.record.id);
    out.push({
      record: r ? { ...e.record, prevHash: r.prevHash, hash: r.hash } : e.record,
      syncState: e.syncState,
    });
  }
  for (const c of plan.checkpoints) out.push({ record: c, syncState: 'acked' });
  return out;
}

/** Break index of the LOCAL chain (non-applied_remote, in chain order); -1 = intact. */
async function localChainBreak(entries: CompactionEntry[]): Promise<number> {
  const local = entries
    .filter((e) => e.syncState !== 'applied_remote')
    .map((e) => e.record)
    .sort(compareMutationOrder);
  return validateChain(
    local.map((r) => ({ prevHash: r.prevHash, hash: r.hash, payload: chainPayload(r) })),
    testHasher,
  );
}

/** Append new local writes chained off the current head (simulates real writes). */
async function appendLocal(entries: CompactionEntry[], specs: Spec[]): Promise<CompactionEntry[]> {
  const local = entries
    .filter((e) => e.syncState !== 'applied_remote')
    .map((e) => e.record)
    .sort(compareMutationOrder);
  let prev: string | null = local.length ? local[local.length - 1]!.hash : null;
  const added: CompactionEntry[] = [];
  for (const s of specs) {
    const r = mkRec(s);
    r.prevHash = prev;
    r.hash = await chainHash(prev, chainPayload(r), testHasher);
    prev = r.hash;
    added.push({ record: r, syncState: s.syncState ?? 'acked' });
  }
  return [...entries, ...added];
}

const gami = (id: string, l: number, xp: number, ts = RECENT, sync: SyncState = 'acked'): Spec => ({
  entity: 'gamification',
  entityId: 'u',
  id,
  lamport: l,
  syncState: sync,
  ts,
  after: { id: 'grow', userId: 'u', totalXP: xp, weeklyXP: 0, badges: '[]', streaks: '{}', domainScores: '{}', updatedAt: ts },
});

const goal = (
  entityId: string, id: string, l: number, title: string,
  ts = RECENT, sync: SyncState = 'acked', op: MutationOp = 'update',
): Spec => ({
  entity: 'goals',
  entityId,
  id,
  lamport: l,
  syncState: sync,
  ts,
  op,
  after: op === 'delete' ? null : { id: entityId, title, updatedAt: ts },
});

describe('planCompaction — planning rules', () => {
  test('collapses a commutative entity (gamification) anytime; checkpoint = folded state', async () => {
    const e = await buildChain([gami('a', 1, 100), gami('b', 2, 120), gami('c', 3, 110)]);
    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan.deleteIds.sort()).toEqual(['a', 'b', 'c']);
    expect(plan.checkpoints).toHaveLength(1);
    expect(plan.checkpoints[0]!.id).toBe('ckpt:gamification:u');
    expect((plan.checkpoints[0]!.after as Record<string, unknown>).totalXP).toBe(120); // max, not last
  });

  test('leaves an ACTIVE document entity alone (recent, not commutative)', async () => {
    const e = await buildChain([goal('g1', 'a', 1, 'A'), goal('g1', 'b', 2, 'B'), goal('g1', 'c', 3, 'C')]);
    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan).toEqual({ checkpoints: [], deleteIds: [], rechained: [] });
  });

  test('collapses a DORMANT document entity (newest write older than the cutoff)', async () => {
    const e = await buildChain([goal('g2', 'a', 1, 'A', OLD), goal('g2', 'b', 2, 'B', OLD), goal('g2', 'c', 3, 'C', OLD)]);
    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan.checkpoints).toHaveLength(1);
    expect(plan.checkpoints[0]!.id).toBe('ckpt:goals:g2');
    expect((plan.checkpoints[0]!.after as Record<string, unknown>).title).toBe('C');
    expect(plan.deleteIds.sort()).toEqual(['a', 'b', 'c']);
  });

  test('NEVER compacts a group containing a pending (un-pushed) mutation', async () => {
    const e = await buildChain([
      goal('g3', 'a', 1, 'A', OLD),
      goal('g3', 'b', 2, 'B', OLD),
      goal('g3', 'c', 3, 'C', OLD, 'pending'),
    ]);
    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.rechained).toEqual([]);
  });

  test('skips groups below minMutations', async () => {
    const e = await buildChain([goal('g4', 'a', 1, 'A', OLD), goal('g4', 'b', 2, 'B', OLD)]);
    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan).toEqual({ checkpoints: [], deleteIds: [], rechained: [] });
  });
});

describe('hash-chain re-chain (the 2.4 fix)', () => {
  test('checkpoint is a REAL chain link, and the local chain validates end-to-end', async () => {
    const e = await buildChain([gami('a', 1, 100), gami('b', 2, 120), gami('c', 3, 110)]);
    expect(await localChainBreak(e)).toBe(-1); // premise: starts valid

    const plan = await planCompaction(e, OPTS, testHasher);
    const ckpt = plan.checkpoints[0]!;
    // Not the old synthetic `ckpt:<entity>:<id>:<lamport>` hash — a real digest.
    expect(ckpt.hash).not.toMatch(/^ckpt:/);
    expect(ckpt.hash).toBe(await chainHash(ckpt.prevHash, chainPayload(ckpt), testHasher));
    // All three collapsed into one checkpoint ⇒ it's the only local record ⇒ first link.
    expect(ckpt.prevHash).toBeNull();

    expect(await localChainBreak(applyPlan(e, plan))).toBe(-1);
  });

  test('re-links survivors AFTER an interior delete; leaves earlier survivors untouched', async () => {
    // keep(l1) │ gami(l2,l3,l4 → collapse) │ g(l5)
    const e = await buildChain([
      goal('keep', 'k1', 1, 'Keep'),
      gami('a', 2, 100),
      gami('b', 3, 120),
      gami('c', 4, 110),
      goal('g', 'g5', 5, 'After'),
    ]);
    const keepHashBefore = e.find((x) => x.record.id === 'k1')!.record.hash;

    const plan = await planCompaction(e, OPTS, testHasher);
    const reIds = plan.rechained.map((r) => r.id);
    expect(reIds).toContain('g5'); // after the collapse → re-linked
    expect(reIds).not.toContain('k1'); // before the collapse → unchanged

    const after = applyPlan(e, plan);
    expect(await localChainBreak(after)).toBe(-1);
    // k1's link is byte-for-byte unchanged (it precedes everything that moved).
    expect(after.find((x) => x.record.id === 'k1')!.record.hash).toBe(keepHashBefore);
  });

  test('applied_remote rows are excluded from the local chain and never re-chained', async () => {
    const e = await buildChain([
      goal('keep', 'k1', 1, 'Keep'),
      gami('a', 2, 100),
      gami('b', 3, 120),
      gami('c', 4, 110),
      goal('rem', 'r5', 5, 'Remote', RECENT, 'applied_remote'), // remote fragment
      goal('g', 'g6', 6, 'After'),
    ]);
    const remoteHashBefore = e.find((x) => x.record.id === 'r5')!.record.hash;

    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan.rechained.map((r) => r.id)).not.toContain('r5');

    const after = applyPlan(e, plan);
    expect(await localChainBreak(after)).toBe(-1); // local chain intact (remote excluded)
    const rem = after.find((x) => x.record.id === 'r5')!;
    expect(rem.syncState).toBe('applied_remote');
    expect(rem.record.hash).toBe(remoteHashBefore); // remote link untouched
  });

  test('net-deleted group: rows dropped, no checkpoint, survivors re-chained', async () => {
    const e = await buildChain([
      goal('gd', 'd1', 1, 'A', OLD, 'acked', 'insert'),
      goal('gd', 'd2', 2, 'B', OLD, 'acked', 'update'),
      goal('gd', 'd3', 3, 'B', OLD, 'acked', 'delete'), // folds to null
      goal('keep', 'k4', 4, 'Keep', RECENT),
    ]);
    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan.deleteIds.sort()).toEqual(['d1', 'd2', 'd3']);
    expect(plan.checkpoints).toEqual([]);
    expect(plan.rechained.map((r) => r.id)).toContain('k4');

    const after = applyPlan(e, plan);
    expect(await localChainBreak(after)).toBe(-1);
    // keep is now the first (only) local link → prevHash null.
    expect(after.find((x) => x.record.id === 'k4')!.record.prevHash).toBeNull();
  });

  test('net-deleting the highest-lamport (tail) group needs no re-chain — earlier survivors untouched', async () => {
    const e = await buildChain([
      goal('keep', 'k1', 1, 'Keep', RECENT),
      goal('gd', 'd2', 2, 'A', OLD, 'acked', 'insert'),
      goal('gd', 'd3', 3, 'B', OLD, 'acked', 'update'),
      goal('gd', 'd4', 4, 'B', OLD, 'acked', 'delete'), // folds to null, at the chain tail
    ]);
    const keepHashBefore = e.find((x) => x.record.id === 'k1')!.record.hash;
    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan.deleteIds.sort()).toEqual(['d2', 'd3', 'd4']);
    expect(plan.checkpoints).toEqual([]);
    expect(plan.rechained).toEqual([]); // the survivor precedes the deleted tail → nothing re-links
    const after = applyPlan(e, plan);
    expect(await localChainBreak(after)).toBe(-1);
    expect(after.find((x) => x.record.id === 'k1')!.record.hash).toBe(keepHashBefore);
  });

  test('re-compaction collapses the prior checkpoint and keeps the chain valid', async () => {
    const e1 = await buildChain([gami('a', 1, 100), gami('b', 2, 150), gami('c', 3, 120), goal('keep', 'k4', 4, 'Keep')]);
    const p1 = await planCompaction(e1, OPTS, testHasher);
    expect((p1.checkpoints[0]!.after as Record<string, unknown>).totalXP).toBe(150);
    const e2 = applyPlan(e1, p1);
    expect(await localChainBreak(e2)).toBe(-1);

    // Three more XP writes arrive, chained off the current head.
    const e2plus = await appendLocal(e2, [gami('d', 5, 200), gami('e', 6, 180), gami('f', 7, 210)]);
    expect(await localChainBreak(e2plus)).toBe(-1);

    const p2 = await planCompaction(e2plus, OPTS, testHasher);
    expect(p2.deleteIds).toContain('ckpt:gamification:u'); // the prior checkpoint is itself collapsed
    const e3 = applyPlan(e2plus, p2);
    expect(await localChainBreak(e3)).toBe(-1);
    expect(e3.filter((x) => x.record.id === 'ckpt:gamification:u')).toHaveLength(1); // exactly one survives
    expect((p2.checkpoints[0]!.after as Record<string, unknown>).totalXP).toBe(210); // global max
  });

  test('a new write chains cleanly off the post-compaction head', async () => {
    const e = await buildChain([gami('a', 1, 100), gami('b', 2, 120), gami('c', 3, 110), goal('g', 'g4', 4, 'After')]);
    const after = applyPlan(e, await planCompaction(e, OPTS, testHasher));
    const head = after
      .filter((x) => x.syncState !== 'applied_remote')
      .map((x) => x.record)
      .sort(compareMutationOrder)
      .pop()!;
    const next = await appendLocal(after, [goal('g', 'g5', 5, 'Next')]);
    expect(next.find((x) => x.record.id === 'g5')!.record.prevHash).toBe(head.hash);
    expect(await localChainBreak(next)).toBe(-1);
  });

  test('a group mixing LOCAL + applied_remote rows collapses: remote effect folds in, remote row is deleted, chain stays valid', async () => {
    const remoteGami: Spec = {
      entity: 'gamification', entityId: 'u', id: 'gr3', lamport: 3, syncState: 'applied_remote', deviceId: 'B', ts: RECENT,
      after: { id: 'grow', userId: 'u', totalXP: 200, weeklyXP: 0, badges: '[]', streaks: '{}', domainScores: '{}', updatedAt: RECENT },
    };
    const e = await buildChain([gami('g1', 1, 100), gami('g2', 2, 150), remoteGami, goal('keep', 'k4', 4, 'Keep')]);

    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan.deleteIds).toContain('gr3'); // the applied_remote row is collapsed too
    // The remote row's XP (200, the max) folded into the checkpoint snapshot.
    expect((plan.checkpoints[0]!.after as Record<string, unknown>).totalXP).toBe(200);

    const after = applyPlan(e, plan);
    expect(after.find((x) => x.record.id === 'gr3')).toBeUndefined(); // remote row gone
    expect(after.find((x) => x.record.id === 'ckpt:gamification:u')!.syncState).toBe('acked');
    expect(await localChainBreak(after)).toBe(-1);
  });

  test('two entities collapsing in one plan: a survivor between the two runs re-links to BOTH checkpoints', async () => {
    // dormant goal 'gd'(l1-3) → collapse │ active goal 'keep'(l4) survives │ gami(l5-7) → collapse
    const e = await buildChain([
      goal('gd', 'd1', 1, 'A', OLD),
      goal('gd', 'd2', 2, 'B', OLD),
      goal('gd', 'd3', 3, 'C', OLD),
      goal('keep', 'k4', 4, 'Keep', RECENT),
      gami('m5', 5, 100),
      gami('m6', 6, 150),
      gami('m7', 7, 120),
    ]);
    const plan = await planCompaction(e, OPTS, testHasher);
    expect(plan.checkpoints.map((c) => c.id).sort()).toEqual(['ckpt:gamification:u', 'ckpt:goals:gd']);

    const after = applyPlan(e, plan);
    expect(await localChainBreak(after)).toBe(-1);
    const ckptGd = after.find((x) => x.record.id === 'ckpt:goals:gd')!.record;
    const ckptGami = after.find((x) => x.record.id === 'ckpt:gamification:u')!.record;
    const keep = after.find((x) => x.record.id === 'k4')!.record;
    // chain order: ckptGd(3) → keep(4) → ckptGami(7)
    expect(keep.prevHash).toBe(ckptGd.hash);
    expect(ckptGami.prevHash).toBe(keep.hash);
  });

  test('lamport tie between a checkpoint and a survivor resolves deterministically and validates', async () => {
    // Survivor 'gtie' shares lamport 3 + deviceId 'A' with the checkpoint; the id
    // tiebreak ('ckpt:gamification:u' < 'gtie') puts the checkpoint first.
    const tie: Spec = {
      entity: 'goals', entityId: 'gtie', id: 'gtie', lamport: 3, deviceId: 'A', ts: RECENT,
      after: { id: 'gtie', title: 'Tie', updatedAt: RECENT },
    };
    const e = await buildChain([gami('m1', 1, 100), gami('m2', 2, 150), gami('m3', 3, 120), tie]);
    const plan = await planCompaction(e, OPTS, testHasher);
    const after = applyPlan(e, plan);

    expect(await localChainBreak(after)).toBe(-1);
    const ckpt = after.find((x) => x.record.id === 'ckpt:gamification:u')!.record;
    const survivor = after.find((x) => x.record.id === 'gtie')!.record;
    // Checkpoint sorts before the survivor (id tiebreak), so the survivor links to it
    // and is the chain head.
    expect(survivor.prevHash).toBe(ckpt.hash);
    const head = after.map((x) => x.record).sort(compareMutationOrder).pop()!;
    expect(head.id).toBe('gtie');
  });
});
