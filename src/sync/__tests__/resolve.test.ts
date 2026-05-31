/**
 * Conflict-resolver tests (P1-T6). foldEntity is pure, so these are the real
 * acceptance bar for convergence (criterion J): the same set of mutations folds
 * to identical state regardless of arrival order, with field-merge + LWW.
 */
import { foldEntity, compareMutationOrder, mergeGamification, materializeEntity } from '../resolve';
import type { MutationRecord } from '../mutationLog';

type M = {
  id: string;
  op: MutationRecord['op'];
  lamport: number;
  deviceId: string;
  after?: Record<string, unknown> | null;
  fields?: string[];
};

function m(x: M): MutationRecord {
  return {
    id: x.id,
    entity: 'goals',
    entityId: 'g1',
    op: x.op,
    before: null,
    after: x.after ?? null,
    fields: x.fields ?? [],
    ts: new Date(x.lamport * 1000).toISOString(),
    lamport: x.lamport,
    deviceId: x.deviceId,
    userId: 'u',
    prevHash: null,
    hash: x.id,
  };
}

// Deterministic shuffles (no Math.random — unavailable in this environment).
function rotations<T>(arr: T[]): T[][] {
  return arr.map((_, i) => [...arr.slice(i), ...arr.slice(0, i)]);
}

describe('foldEntity', () => {
  test('insert materializes the full snapshot', () => {
    const state = foldEntity([
      m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'Run', notes: 'x' } }),
    ]);
    expect(state).toEqual({ id: 'g1', title: 'Run', notes: 'x' });
  });

  test('update applies only its changed fields onto prior state', () => {
    const state = foldEntity([
      m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'Run', notes: 'x' } }),
      m({ id: 'b', op: 'update', lamport: 2, deviceId: 'A', fields: ['title'], after: { id: 'g1', title: 'Run 5k', notes: 'x' } }),
    ]);
    expect(state).toEqual({ id: 'g1', title: 'Run 5k', notes: 'x' });
  });

  test('field-merge: concurrent edits to different fields both survive', () => {
    const insert = m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'Run', notes: 'x' } });
    // Device A edits notes; device B edits title — concurrent, different fields.
    const editNotes = m({ id: 'b', op: 'update', lamport: 2, deviceId: 'A', fields: ['notes'], after: { id: 'g1', title: 'Run', notes: 'y' } });
    const editTitle = m({ id: 'c', op: 'update', lamport: 3, deviceId: 'B', fields: ['title'], after: { id: 'g1', title: 'Sprint', notes: 'x' } });
    expect(foldEntity([insert, editNotes, editTitle])).toEqual({ id: 'g1', title: 'Sprint', notes: 'y' });
  });

  test('LWW: concurrent edits to the SAME field — higher lamport wins', () => {
    const base = m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'A' } });
    const lo = m({ id: 'b', op: 'update', lamport: 2, deviceId: 'A', fields: ['title'], after: { id: 'g1', title: 'B' } });
    const hi = m({ id: 'c', op: 'update', lamport: 3, deviceId: 'B', fields: ['title'], after: { id: 'g1', title: 'C' } });
    expect(foldEntity([base, lo, hi])?.title).toBe('C');
  });

  test('LWW tiebreak on equal lamport uses deviceId', () => {
    const base = m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'A' } });
    const devA = m({ id: 'b', op: 'update', lamport: 2, deviceId: 'A', fields: ['title'], after: { id: 'g1', title: 'fromA' } });
    const devB = m({ id: 'c', op: 'update', lamport: 2, deviceId: 'B', fields: ['title'], after: { id: 'g1', title: 'fromB' } });
    // deviceId 'B' > 'A', so B is ordered last and wins.
    expect(foldEntity([base, devA, devB])?.title).toBe('fromB');
  });

  test('delete tombstones the entity', () => {
    const state = foldEntity([
      m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'Run' } }),
      m({ id: 'b', op: 'delete', lamport: 2, deviceId: 'A' }),
    ]);
    expect(state).toBeNull();
  });

  test('a higher-lamport update resurrects a deleted entity from its snapshot', () => {
    const state = foldEntity([
      m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'Run' } }),
      m({ id: 'b', op: 'delete', lamport: 2, deviceId: 'A' }),
      m({ id: 'c', op: 'update', lamport: 3, deviceId: 'B', fields: ['title'], after: { id: 'g1', title: 'Reborn' } }),
    ]);
    expect(state).toEqual({ id: 'g1', title: 'Reborn' });
  });

  test('empty history folds to null', () => {
    expect(foldEntity([])).toBeNull();
  });

  test('CONVERGENCE: arrival order does not affect the result', () => {
    const mutations = [
      m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'Run', notes: 'x', mood: 1 } }),
      m({ id: 'b', op: 'update', lamport: 2, deviceId: 'A', fields: ['notes'], after: { id: 'g1', title: 'Run', notes: 'y', mood: 1 } }),
      m({ id: 'c', op: 'update', lamport: 3, deviceId: 'B', fields: ['title'], after: { id: 'g1', title: 'Sprint', notes: 'x', mood: 1 } }),
      m({ id: 'd', op: 'update', lamport: 3, deviceId: 'C', fields: ['mood'], after: { id: 'g1', title: 'Run', notes: 'x', mood: 5 } }),
    ];
    const canonical = foldEntity(mutations);
    // Every rotation (different "arrival order") must converge identically.
    for (const order of rotations(mutations)) {
      expect(foldEntity(order)).toEqual(canonical);
    }
    // And the converged value is the field-merge of all edits.
    expect(canonical).toEqual({ id: 'g1', title: 'Sprint', notes: 'y', mood: 5 });
  });

  test('idempotency: replaying the same set twice yields the same state', () => {
    const mutations = [
      m({ id: 'a', op: 'insert', lamport: 1, deviceId: 'A', after: { id: 'g1', title: 'Run' } }),
      m({ id: 'b', op: 'update', lamport: 2, deviceId: 'A', fields: ['title'], after: { id: 'g1', title: 'Run 5k' } }),
    ];
    expect(foldEntity([...mutations, ...mutations])).toEqual(foldEntity(mutations));
  });
});

describe('compareMutationOrder', () => {
  test('orders by lamport, then deviceId, then id', () => {
    const a = m({ id: 'x', op: 'update', lamport: 1, deviceId: 'A' });
    const b = m({ id: 'y', op: 'update', lamport: 2, deviceId: 'A' });
    expect(compareMutationOrder(a, b)).toBeLessThan(0);

    const sameLamportA = m({ id: 'x', op: 'update', lamport: 5, deviceId: 'A' });
    const sameLamportB = m({ id: 'y', op: 'update', lamport: 5, deviceId: 'B' });
    expect(compareMutationOrder(sameLamportA, sameLamportB)).toBeLessThan(0);

    const idLo = m({ id: 'aaa', op: 'update', lamport: 5, deviceId: 'A' });
    const idHi = m({ id: 'bbb', op: 'update', lamport: 5, deviceId: 'A' });
    expect(compareMutationOrder(idLo, idHi)).toBeLessThan(0);
  });
});

// Gamification is counters (XP) + sets (badges) + gauges (scores) — merged with
// a CRDT, not field-LWW. These guard against silent XP/badge loss.
function gami(o: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'g',
    userId: 'u',
    domainScores: JSON.stringify({ health: 10 }),
    streaks: JSON.stringify({ workout: { count: 2, lastDate: '2026-05-30' } }),
    badges: JSON.stringify(['first_goal']),
    totalXP: 100,
    weeklyXP: 20,
    createdAt: 't0',
    updatedAt: '2026-05-31T10:00:00.000Z',
    ...o,
  };
}

describe('mergeGamification', () => {
  test('badges union, XP/streak max, scores last-writer-by-updatedAt', () => {
    const a = gami({
      badges: JSON.stringify(['a', 'b']), totalXP: 110, weeklyXP: 30,
      streaks: JSON.stringify({ workout: { count: 5 } }),
      domainScores: JSON.stringify({ health: 50 }),
      updatedAt: '2026-05-31T12:00:00.000Z',
    });
    const b = gami({
      badges: JSON.stringify(['b', 'c']), totalXP: 105, weeklyXP: 10,
      streaks: JSON.stringify({ workout: { count: 3 } }),
      domainScores: JSON.stringify({ health: 20 }),
      updatedAt: '2026-05-31T09:00:00.000Z',
    });
    const merged = mergeGamification(a, b);
    expect(new Set(JSON.parse(merged.badges as string))).toEqual(new Set(['a', 'b', 'c']));
    expect(merged.totalXP).toBe(110);
    expect(merged.weeklyXP).toBe(30);
    expect(JSON.parse(merged.streaks as string).workout.count).toBe(5);
    // `a` has the later updatedAt, so its domainScores win (gauge = LWW).
    expect(JSON.parse(merged.domainScores as string).health).toBe(50);
  });

  test('commutative and idempotent (so two devices converge)', () => {
    const a = gami({ badges: JSON.stringify(['a']), totalXP: 110, updatedAt: '2026-05-31T12:00:00.000Z' });
    const b = gami({ badges: JSON.stringify(['c']), totalXP: 105, updatedAt: '2026-05-31T09:00:00.000Z' });
    expect(mergeGamification(a, b)).toEqual(mergeGamification(b, a));
    expect(mergeGamification(a, a).totalXP).toBe(110);
  });
});

describe('materializeEntity', () => {
  function gamiMut(id: string, deviceId: string, xp: number, badges: string[], updatedAt: string): MutationRecord {
    return {
      id, entity: 'gamification', entityId: 'u', op: 'update',
      before: null,
      after: { id: `row-${deviceId}`, userId: 'u', totalXP: xp, weeklyXP: 0, badges: JSON.stringify(badges), streaks: '{}', domainScores: '{}', updatedAt },
      fields: ['totalXP', 'badges'],
      ts: updatedAt, lamport: 1, deviceId, userId: 'u', prevHash: null, hash: id,
    };
  }

  test('gamification history reduces via the CRDT merge (max XP, union badges)', () => {
    const state = materializeEntity('gamification', [
      gamiMut('m1', 'A', 110, ['x'], '2026-05-31T12:00:00.000Z'),
      gamiMut('m2', 'B', 105, ['y'], '2026-05-31T09:00:00.000Z'),
    ]) as Record<string, unknown>;
    expect(state.totalXP).toBe(110);
    expect(new Set(JSON.parse(state.badges as string))).toEqual(new Set(['x', 'y']));
  });

  test('document entities still use the default field-LWW fold', () => {
    const ins: MutationRecord = {
      id: 'a', entity: 'goals', entityId: 'g1', op: 'insert', before: null,
      after: { id: 'g1', title: 'A' }, fields: [], ts: 't', lamport: 1,
      deviceId: 'A', userId: 'u', prevHash: null, hash: 'a',
    };
    expect(materializeEntity('goals', [ins])).toEqual(foldEntity([ins]));
  });
});
