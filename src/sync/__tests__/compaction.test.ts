/**
 * Log-compaction planning (P1-T9). Pure — the safety rules live here, so they
 * get the heaviest tests (the actual delete/insert in the sink is mechanical).
 */
import { planCompaction, COMMUTATIVE_ENTITIES, type CompactionEntry, type CompactionOpts } from '../compaction';
import type { MutationRecord, MutationOp, EntitySnapshot } from '../mutationLog';
import type { SyncState } from '../sink';

const RECENT = '2026-05-31T10:00:00.000Z';
const OLD = '2026-04-01T00:00:00.000Z';
const OPTS: CompactionOpts = {
  minMutations: 3,
  retainCutoffTs: '2026-05-01T00:00:00.000Z',
  commutative: COMMUTATIVE_ENTITIES,
};

function entry(
  entity: string, entityId: string, id: string, lamport: number,
  after: EntitySnapshot, syncState: SyncState, ts: string, op: MutationOp = 'update',
): CompactionEntry {
  const record: MutationRecord = {
    id, entity, entityId, op, before: null, after,
    fields: after ? Object.keys(after) : [], ts, lamport, deviceId: 'A', userId: 'u', prevHash: null, hash: id,
  };
  return { record, syncState };
}

const gami = (id: string, l: number, xp: number, ts: string, sync: SyncState = 'acked') =>
  entry('gamification', 'u', id, l, { id: 'grow', userId: 'u', totalXP: xp, weeklyXP: 0, badges: '[]', streaks: '{}', domainScores: '{}', updatedAt: ts }, sync, ts);

const goal = (entityId: string, id: string, l: number, title: string, ts: string, sync: SyncState = 'acked') =>
  entry('goals', entityId, id, l, { id: entityId, title, updatedAt: ts }, sync, ts);

describe('planCompaction', () => {
  test('collapses a commutative entity (gamification) anytime, checkpoint = folded state', () => {
    const plan = planCompaction([gami('a', 1, 100, RECENT), gami('b', 2, 120, RECENT), gami('c', 3, 110, RECENT)], OPTS);
    expect(plan.deleteIds.sort()).toEqual(['a', 'b', 'c']);
    expect(plan.checkpoints).toHaveLength(1);
    expect(plan.checkpoints[0].id).toBe('ckpt:gamification:u');
    expect((plan.checkpoints[0].after as Record<string, unknown>).totalXP).toBe(120); // max, not last
  });

  test('leaves an ACTIVE document entity alone (recent, not commutative)', () => {
    const plan = planCompaction([goal('g1', 'a', 1, 'A', RECENT), goal('g1', 'b', 2, 'B', RECENT), goal('g1', 'c', 3, 'C', RECENT)], OPTS);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.checkpoints).toEqual([]);
  });

  test('collapses a DORMANT document entity (newest write older than the cutoff)', () => {
    const plan = planCompaction([goal('g2', 'a', 1, 'A', OLD), goal('g2', 'b', 2, 'B', OLD), goal('g2', 'c', 3, 'C', OLD)], OPTS);
    expect(plan.checkpoints).toHaveLength(1);
    expect(plan.checkpoints[0].id).toBe('ckpt:goals:g2');
    expect((plan.checkpoints[0].after as Record<string, unknown>).title).toBe('C');
    expect(plan.deleteIds.sort()).toEqual(['a', 'b', 'c']);
  });

  test('NEVER compacts a group containing a pending (un-pushed) mutation', () => {
    const plan = planCompaction([
      goal('g3', 'a', 1, 'A', OLD),
      goal('g3', 'b', 2, 'B', OLD),
      goal('g3', 'c', 3, 'C', OLD, 'pending'),
    ], OPTS);
    expect(plan.deleteIds).toEqual([]);
  });

  test('skips groups below minMutations', () => {
    const plan = planCompaction([goal('g4', 'a', 1, 'A', OLD), goal('g4', 'b', 2, 'B', OLD)], OPTS);
    expect(plan.deleteIds).toEqual([]);
  });
});
