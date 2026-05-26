import { MutationLog, diffFields, type MutationRecord, type MutationLogOptions } from '../mutationLog';
import { validateChain } from '../hashChain';
import { compareLamport } from '../lamport';
import { testHasher } from './testHasher';

function makeLog(deviceId = 'devA', opts: Partial<MutationLogOptions> = {}) {
  let n = 0;
  return new MutationLog({
    hasher: testHasher,
    deviceId,
    userId: 'user1',
    now: () => new Date('2026-05-27T00:00:00.000Z'),
    newId: () => `id_${++n}`,
    ...opts,
  });
}

describe('diffFields', () => {
  it('returns all keys for an insert', () => {
    expect(diffFields(null, { a: 1, b: 2 }).sort()).toEqual(['a', 'b']);
  });
  it('returns [] for a delete', () => {
    expect(diffFields({ a: 1 }, null)).toEqual([]);
  });
  it('returns only changed keys for an update', () => {
    expect(diffFields({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, c: 3 })).toEqual(['b']);
  });
  it('detects added and removed keys', () => {
    expect(diffFields({ a: 1 }, { a: 1, b: 2 })).toEqual(['b']);
  });
  it('compares nested values structurally', () => {
    expect(diffFields({ a: { x: 1 } }, { a: { x: 1 } })).toEqual([]);
    expect(diffFields({ a: { x: 1 } }, { a: { x: 2 } })).toEqual(['a']);
  });
});

describe('MutationLog', () => {
  it('records an insert with lamport 1 and null prevHash', async () => {
    const log = makeLog();
    const rec = await log.record({ entity: 'goals', entityId: 'g1', op: 'insert', before: null, after: { title: 'x' } });
    expect(rec.lamport).toBe(1);
    expect(rec.prevHash).toBeNull();
    expect(rec.fields).toEqual([]); // fields tracked for updates only; inserts create the whole row
    expect(rec.op).toBe('insert');
    expect(log.head).toBe(rec.hash);
  });

  it('chains records: each prevHash equals the prior hash', async () => {
    const log = makeLog();
    const r1 = await log.record({ entity: 'goals', entityId: 'g1', op: 'insert', before: null, after: { title: 'a' } });
    const r2 = await log.record({ entity: 'goals', entityId: 'g1', op: 'update', before: { title: 'a' }, after: { title: 'b' } });
    expect(r2.prevHash).toBe(r1.hash);
    expect(r2.lamport).toBe(2);
    expect(r2.fields).toEqual(['title']);
  });

  it('produces a chain that validates intact', async () => {
    const log = makeLog();
    const recs: MutationRecord[] = [];
    recs.push(await log.record({ entity: 'b', entityId: '1', op: 'insert', before: null, after: { v: 1 } }));
    recs.push(await log.record({ entity: 'b', entityId: '1', op: 'update', before: { v: 1 }, after: { v: 2 } }));
    recs.push(await log.record({ entity: 'b', entityId: '1', op: 'delete', before: { v: 2 }, after: null }));
    const chain = recs.map((r) => ({
      prevHash: r.prevHash,
      hash: r.hash,
      payload: { entity: r.entity, entityId: r.entityId, op: r.op, before: r.before, after: r.after, fields: r.fields, lamport: r.lamport, deviceId: r.deviceId, userId: r.userId },
    }));
    expect(await validateChain(chain, testHasher)).toBe(-1);
  });

  it('forwards every record to the sink', async () => {
    const sink: MutationRecord[] = [];
    const log = makeLog('devA', { sink: (r) => { sink.push(r); } });
    await log.record({ entity: 'goals', entityId: 'g1', op: 'insert', before: null, after: { t: 1 } });
    await log.record({ entity: 'goals', entityId: 'g1', op: 'update', before: { t: 1 }, after: { t: 2 } });
    expect(sink).toHaveLength(2);
    expect(sink[0]!.op).toBe('insert');
  });

  it('observeRemote advances logical time so next local append is ordered after', async () => {
    const log = makeLog();
    log.observeRemote(50);
    const rec = await log.record({ entity: 'goals', entityId: 'g1', op: 'insert', before: null, after: { t: 1 } });
    expect(rec.lamport).toBe(51);
  });

  it('rejects malformed insert/delete', async () => {
    const log = makeLog();
    await expect(log.record({ entity: 'g', entityId: '1', op: 'insert', before: null, after: null })).rejects.toThrow();
    await expect(log.record({ entity: 'g', entityId: '1', op: 'delete', before: null, after: null })).rejects.toThrow();
  });

  it('two devices editing different fields concurrently both survive a merge (field-level)', async () => {
    // Device A and B start from the same row, edit disjoint fields offline.
    const base = { title: 'plan', notes: 'old', startTime: '09:00' };
    const logA = makeLog('devA');
    const logB = makeLog('devB');

    const a = await logA.record({ entity: 'routine_blocks', entityId: 'b1', op: 'update', before: base, after: { ...base, title: 'PLAN A' } });
    const b = await logB.record({ entity: 'routine_blocks', entityId: 'b1', op: 'update', before: base, after: { ...base, notes: 'note B' } });

    expect(a.fields).toEqual(['title']);
    expect(b.fields).toEqual(['notes']);

    // Field-merge: disjoint fields => both apply cleanly on top of base.
    const ordered = [a, b].sort(compareLamport);
    const merged = { ...base };
    for (const m of ordered) {
      for (const f of m.fields) (merged as Record<string, unknown>)[f] = (m.after as Record<string, unknown>)[f];
    }
    expect(merged).toEqual({ title: 'PLAN A', notes: 'note B', startTime: '09:00' });
  });
});
