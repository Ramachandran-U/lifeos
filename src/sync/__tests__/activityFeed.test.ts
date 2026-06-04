/**
 * Activity-feed presentation — pure summarize/group/restorable logic over the
 * mutation log. Deterministic: day key + device id are injected.
 */
import {
  isRestorable,
  RESTORABLE_ENTITIES,
  entityLabel,
  prettifyKey,
  snapshotTitle,
  summarizeMutation,
  buildActivityFeed,
} from '../activityFeed';
import type { MutationRecord, MutationOp, EntitySnapshot } from '../mutationLog';

function rec(over: Partial<MutationRecord> = {}): MutationRecord {
  return {
    id: 'm1',
    entity: 'goals',
    entityId: 'g1',
    op: 'update',
    before: null,
    after: { id: 'g1', title: 'Run a marathon' },
    fields: ['title'],
    ts: '2026-06-04T10:00:00.000Z',
    lamport: 1,
    deviceId: 'A',
    userId: 'u',
    prevHash: null,
    hash: 'h',
    ...over,
  };
}

const dayOf = (ts: string) => ts.slice(0, 10); // deterministic UTC-day key for tests

describe('restorable gate', () => {
  it('allows document entities, blocks counter/CRDT entities', () => {
    expect(isRestorable('goals')).toBe(true);
    expect(isRestorable('routine_blocks')).toBe(true);
    expect(isRestorable('user_profiles')).toBe(true);
    // monotonic merge — restore can't lower these, so they're not restorable
    expect(isRestorable('gamification')).toBe(false);
    expect(isRestorable('interests')).toBe(false);
    expect(isRestorable('expedition_progress')).toBe(false);
  });

  it('expeditions (document) are restorable but expedition_progress (counter) is not', () => {
    expect(RESTORABLE_ENTITIES.has('expeditions')).toBe(true);
    expect(RESTORABLE_ENTITIES.has('expedition_progress')).toBe(false);
  });
});

describe('entityLabel / prettifyKey', () => {
  it('maps known entities to friendly labels', () => {
    expect(entityLabel('goals')).toBe('Goal');
    expect(entityLabel('routine_blocks')).toBe('Routine block');
    expect(entityLabel('user_profiles')).toBe('Profile');
    expect(entityLabel('gamification')).toBe('Progress');
  });

  it('falls back to a prettified form for unknown entities (never raw snake_case)', () => {
    expect(entityLabel('some_new_table')).toBe('some new table');
  });

  it('prettifies snake_case and camelCase', () => {
    expect(prettifyKey('weekly_minutes_target')).toBe('weekly minutes target');
    expect(prettifyKey('weeklyMinutesTarget')).toBe('weekly minutes target');
  });
});

describe('snapshotTitle', () => {
  it('reads the natural name field per entity', () => {
    expect(snapshotTitle('goals', { title: 'Run' })).toBe('Run');
    expect(snapshotTitle('routine_blocks', { title: 'Focus' })).toBe('Focus');
    expect(snapshotTitle('interests', { name: 'Piano' })).toBe('Piano');
    expect(snapshotTitle('daily_reflections', { date: '2026-06-04' })).toBe('for 2026-06-04');
  });

  it('returns null for a null snapshot, missing field, or unmapped entity', () => {
    expect(snapshotTitle('goals', null as EntitySnapshot)).toBeNull();
    expect(snapshotTitle('goals', { description: 'no title here' })).toBeNull();
    expect(snapshotTitle('gamification', { totalXp: 100 })).toBeNull();
    expect(snapshotTitle('goals', { title: '   ' })).toBeNull(); // blank trimmed → null
  });
});

describe('summarizeMutation', () => {
  it('maps the op to a verb and derives the title from the after snapshot', () => {
    const item = summarizeMutation(rec({ op: 'update' }), 'A');
    expect(item.verb).toBe('Updated');
    expect(item.entityLabel).toBe('Goal');
    expect(item.title).toBe('Run a marathon');
    expect(item.restorable).toBe(true);
  });

  it('uses the before snapshot for a delete (after is null)', () => {
    const item = summarizeMutation(
      rec({ op: 'delete', after: null, before: { id: 'g1', title: 'Old goal' } }),
      'A',
    );
    expect(item.verb).toBe('Removed');
    expect(item.title).toBe('Old goal');
  });

  it('reports Created for an insert', () => {
    const item = summarizeMutation(rec({ op: 'insert', before: null, after: { title: 'New' } }), 'A');
    expect(item.verb).toBe('Created');
    expect(item.changedFields).toEqual([]); // only updates carry changed fields
  });

  it('hides bookkeeping columns from the changed-fields detail', () => {
    const item = summarizeMutation(
      rec({ op: 'update', fields: ['title', 'updatedAt', 'id', 'status', 'created_at'] }),
      'A',
    );
    expect(item.changedFields).toEqual(['title', 'status']);
  });

  it('flags device origin only when the device id matches', () => {
    expect(summarizeMutation(rec({ deviceId: 'A' }), 'A').fromThisDevice).toBe(true);
    expect(summarizeMutation(rec({ deviceId: 'B' }), 'A').fromThisDevice).toBe(false);
    expect(summarizeMutation(rec({ deviceId: 'A' }), null).fromThisDevice).toBe(false);
  });

  it('marks non-document entities as not restorable', () => {
    const item = summarizeMutation(rec({ entity: 'gamification', after: { totalXp: 10 } }), 'A');
    expect(item.restorable).toBe(false);
    expect(item.entityLabel).toBe('Progress');
  });
});

describe('buildActivityFeed', () => {
  const mk = (id: string, ts: string, lamport: number, op: MutationOp = 'update') =>
    rec({ id, ts, lamport, op });

  it('orders newest-first by wall clock, lamport as tiebreak, grouped by day', () => {
    const records = [
      mk('a', '2026-06-03T09:00:00.000Z', 1),
      mk('b', '2026-06-04T08:00:00.000Z', 2),
      mk('c', '2026-06-04T08:00:00.000Z', 5), // same ts as b, higher lamport → before b
    ];
    const days = buildActivityFeed(records, 'A', dayOf);

    expect(days.map((d) => d.day)).toEqual(['2026-06-04', '2026-06-03']); // newest day first
    expect(days[0].items.map((i) => i.id)).toEqual(['c', 'b']); // lamport tiebreak within same ts
    expect(days[1].items.map((i) => i.id)).toEqual(['a']);
  });

  it('returns an empty array for no records', () => {
    expect(buildActivityFeed([], 'A', dayOf)).toEqual([]);
  });

  it('threads the device id through to each item', () => {
    const days = buildActivityFeed([mk('a', '2026-06-04T08:00:00.000Z', 1)], 'A', dayOf);
    expect(days[0].items[0].fromThisDevice).toBe(true);
  });
});
