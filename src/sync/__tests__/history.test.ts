/**
 * Version-history read paths (P1-T7). Pure over an injected sink — no DB.
 */
import { getEntityHistory, stateAsOf, restoreEntityTo } from '../history';
import type { LocalSink } from '../sink';
import type { MutationRecord, MutationOp, EntitySnapshot } from '../mutationLog';

// restoreEntityTo lazy-imports these; mock so we assert the write + audit calls.
jest.mock('../reducer', () => ({ applyEntityState: jest.fn() }));
jest.mock('../runtime', () => ({ recordMutation: jest.fn() }));
import { applyEntityState } from '../reducer';
import { recordMutation } from '../runtime';

function m(id: string, op: MutationOp, lamport: number, after: EntitySnapshot, fields: string[] = []): MutationRecord {
  return {
    id, entity: 'goals', entityId: 'g1', op, before: null, after, fields,
    ts: new Date(lamport * 1000).toISOString(), lamport, deviceId: 'A', userId: 'u', prevHash: null, hash: id,
  };
}

function stubSink(muts: MutationRecord[]): LocalSink {
  return { readEntityHistory: async () => muts } as unknown as LocalSink;
}

// insert A → rename to B → delete
const HISTORY: MutationRecord[] = [
  m('m1', 'insert', 1, { id: 'g1', title: 'A' }),
  m('m2', 'update', 2, { id: 'g1', title: 'B' }, ['title']),
  m('m3', 'delete', 3, null),
];

describe('getEntityHistory', () => {
  test('returns the audit timeline oldest→newest regardless of input order', async () => {
    const sink = stubSink([...HISTORY].reverse());
    const h = await getEntityHistory('goals', 'g1', sink);
    expect(h.map((e) => e.lamport)).toEqual([1, 2, 3]);
    expect(h.map((e) => e.op)).toEqual(['insert', 'update', 'delete']);
  });
});

describe('stateAsOf', () => {
  test('folds mutations up to a lamport', async () => {
    const sink = stubSink(HISTORY);
    expect(await stateAsOf('goals', 'g1', { lamport: 1 }, sink)).toEqual({ id: 'g1', title: 'A' });
    expect(await stateAsOf('goals', 'g1', { lamport: 2 }, sink)).toEqual({ id: 'g1', title: 'B' });
  });

  test('null after a delete, but the row is recoverable from just before it (restore target)', async () => {
    const sink = stubSink(HISTORY);
    expect(await stateAsOf('goals', 'g1', { lamport: 3 }, sink)).toBeNull();
    expect(await stateAsOf('goals', 'g1', { lamport: 2 }, sink)).toEqual({ id: 'g1', title: 'B' });
  });

  test('a wall-clock ts bound also works', async () => {
    const sink = stubSink(HISTORY);
    const s = await stateAsOf('goals', 'g1', { ts: new Date(2 * 1000).toISOString() }, sink);
    expect(s).toEqual({ id: 'g1', title: 'B' });
  });

  test('no bound → current materialized state (here: null, ends in delete)', async () => {
    const sink = stubSink(HISTORY);
    expect(await stateAsOf('goals', 'g1', {}, sink)).toBeNull();
  });
});

describe('restoreEntityTo', () => {
  beforeEach(() => jest.clearAllMocks());

  test('restores the as-of state to the table AND records an auditable mutation', async () => {
    const sink = stubSink(HISTORY);
    const restored = await restoreEntityTo('goals', 'g1', { lamport: 2 }, sink); // just before the delete

    expect(restored).toEqual({ id: 'g1', title: 'B' });
    expect(applyEntityState).toHaveBeenCalledWith('goals', 'g1', { id: 'g1', title: 'B' });
    expect(recordMutation).toHaveBeenCalledWith({
      entity: 'goals', entityId: 'g1', op: 'update', before: null, after: { id: 'g1', title: 'B' },
    });
  });

  test("returns null and writes nothing when the entity didn't exist at that point", async () => {
    const sink = stubSink(HISTORY);
    const restored = await restoreEntityTo('goals', 'g1', { lamport: 3 }, sink); // at/after the delete
    expect(restored).toBeNull();
    expect(applyEntityState).not.toHaveBeenCalled();
    expect(recordMutation).not.toHaveBeenCalled();
  });
});
