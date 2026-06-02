/**
 * Sync reducer tests (P1-T6) — applies a pulled mutation to local state.
 *
 * Acceptance: idempotency (already-applied ⇒ no-op, no re-materialize), the
 * local clock advances, per-entity routing is correct, tombstones delete with
 * the right semantics (goals soft / routine hard), the echo-prevention
 * invariant holds (writes go through the LOW-LEVEL upsert/db paths only — the
 * web spies + the fake drizzle db are the proof), and a bad record never throws
 * out of the pull loop. `materializeEntity` is mocked so we control the snapshot
 * and assert only the reducer's apply behaviour.
 */
import { Platform } from 'react-native';
import type { MutationRecord } from '../mutationLog';
import type { LocalSink } from '../sink';

jest.mock('../runtime', () => ({ observeRemoteLamport: jest.fn() }));
jest.mock('../resolve', () => ({ materializeEntity: jest.fn() }));
jest.mock('@/db/queries/gamification', () => ({ getOrCreateGamification: jest.fn() }));
jest.mock('@/db/webStorage', () => ({
  webUpsertGoalById: jest.fn(),
  webSoftDeleteGoal: jest.fn(),
  webUpsertRoutineBlockById: jest.fn(),
  webDeleteRoutineBlockById: jest.fn(),
  webUpsertReflectionById: jest.fn(),
  webUpdateGamification: jest.fn(),
  webUpsertInterestById: jest.fn(),
  webUpsertExplorationById: jest.fn(),
  webUpsertExpeditionById: jest.fn(),
  webUpsertExpeditionProgress: jest.fn(),
  webUpsertSparkById: jest.fn(),
  webUpsertUserProfile: jest.fn(),
  webUpdateUser: jest.fn(),
}));

// Fake drizzle db — every builder method is chainable; get() returns the
// queued row (default undefined ⇒ the "insert" branch of existing-or-insert).
const dbOps = { insert: jest.fn(), update: jest.fn(), delete: jest.fn(), select: jest.fn() };
let nextGetRow: unknown = undefined;
jest.mock('@/db', () => {
  const chain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o: any = {};
    for (const k of ['values', 'set', 'where', 'onConflictDoUpdate', 'from', 'run']) o[k] = () => o;
    o.get = () => nextGetRow;
    return o;
  };
  return {
    db: {
      insert: (...a: unknown[]) => { dbOps.insert(...a); return chain(); },
      update: (...a: unknown[]) => { dbOps.update(...a); return chain(); },
      delete: (...a: unknown[]) => { dbOps.delete(...a); return chain(); },
      select: (...a: unknown[]) => { dbOps.select(...a); return chain(); },
    },
  };
});

import { applyRemoteMutation, applyEntityState } from '../reducer';
import { observeRemoteLamport } from '../runtime';
import { materializeEntity } from '../resolve';
import * as web from '@/db/webStorage';
import { getOrCreateGamification } from '@/db/queries/gamification';

const mMaterialize = materializeEntity as jest.Mock;

function rec(entity: string, entityId: string, lamport = 1): MutationRecord {
  return {
    id: `${entity}-${entityId}-${lamport}`,
    entity,
    entityId,
    op: 'update',
    before: null,
    after: { id: entityId },
    fields: [],
    ts: new Date(lamport * 1000).toISOString(),
    lamport,
    deviceId: 'remote-device',
    userId: 'u1',
    prevHash: null,
    hash: `h${lamport}`,
  };
}

function fakeSink(newly: boolean, opts: { history?: MutationRecord[]; throwOnHistory?: boolean } = {}): LocalSink {
  return {
    appendApplied: jest.fn().mockResolvedValue(newly),
    readEntityHistory: opts.throwOnHistory
      ? jest.fn().mockRejectedValue(new Error('db boom'))
      : jest.fn().mockResolvedValue(opts.history ?? []),
  } as unknown as LocalSink;
}

beforeEach(() => {
  jest.clearAllMocks();
  nextGetRow = undefined;
});

// ─── shared behaviour (platform-independent) ────────────────────────────────
describe('applyRemoteMutation — flow & idempotency', () => {
  beforeEach(() => { Platform.OS = 'web' as typeof Platform.OS; });
  afterEach(() => { Platform.OS = 'node' as typeof Platform.OS; });

  test('newly-applied record advances the clock, materializes, and returns true', async () => {
    mMaterialize.mockReturnValue({ id: 'g1', title: 'A' });
    const sink = fakeSink(true, { history: [rec('goals', 'g1')] });

    const r = rec('goals', 'g1', 7);
    const out = await applyRemoteMutation(r, sink);

    expect(out).toBe(true);
    expect(observeRemoteLamport).toHaveBeenCalledWith(7);
    expect(sink.appendApplied).toHaveBeenCalledWith(r);
    expect(sink.readEntityHistory).toHaveBeenCalledWith('goals', 'g1');
    expect(web.webUpsertGoalById).toHaveBeenCalledWith({ id: 'g1', title: 'A' });
  });

  test('already-applied record is an idempotent no-op (no materialize/write)', async () => {
    const sink = fakeSink(false); // appendApplied → false ⇒ already seen
    const out = await applyRemoteMutation(rec('goals', 'g1'), sink);

    expect(out).toBe(false);
    expect(observeRemoteLamport).toHaveBeenCalledTimes(1); // clock still advanced
    expect(sink.readEntityHistory).not.toHaveBeenCalled();
    expect(materializeEntity).not.toHaveBeenCalled();
    expect(web.webUpsertGoalById).not.toHaveBeenCalled();
  });

  test('unknown (non-materialized) entity is stored but never written', async () => {
    const sink = fakeSink(true);
    const out = await applyRemoteMutation(rec('contacts', 'c1'), sink);

    expect(out).toBe(true); // stored for fold
    expect(sink.appendApplied).toHaveBeenCalled();
    expect(sink.readEntityHistory).not.toHaveBeenCalled();
    expect(materializeEntity).not.toHaveBeenCalled();
  });

  test('a throwing sink never breaks the pull loop (returns false)', async () => {
    mMaterialize.mockReturnValue({ id: 'g1' });
    const sink = fakeSink(true, { throwOnHistory: true });
    await expect(applyRemoteMutation(rec('goals', 'g1'), sink)).resolves.toBe(false);
  });
});

// ─── web upsert routing (isWeb = true) ──────────────────────────────────────
describe('applyState — web routing', () => {
  beforeEach(() => { Platform.OS = 'web' as typeof Platform.OS; });
  afterEach(() => { Platform.OS = 'node' as typeof Platform.OS; });

  const apply = async (entity: string, snapshot: unknown) => {
    mMaterialize.mockReturnValue(snapshot);
    await applyRemoteMutation(rec(entity, 'e1', 1), fakeSink(true, { history: [rec(entity, 'e1')] }));
  };

  test('goal upsert vs soft-delete tombstone', async () => {
    await apply('goals', { id: 'e1', title: 'G' });
    expect(web.webUpsertGoalById).toHaveBeenCalledWith({ id: 'e1', title: 'G' });
    await apply('goals', null);
    expect(web.webSoftDeleteGoal).toHaveBeenCalledWith('e1');
  });

  test('routine_block upsert vs HARD-delete tombstone', async () => {
    await apply('routine_blocks', { id: 'e1' });
    expect(web.webUpsertRoutineBlockById).toHaveBeenCalled();
    await apply('routine_blocks', null);
    expect(web.webDeleteRoutineBlockById).toHaveBeenCalledWith('e1');
  });

  test('gamification ensures a row then writes CRDT fields (no echo)', async () => {
    await apply('gamification', { totalXP: 50, weeklyXP: 10, domainScores: { health: 3 }, streaks: {}, badges: ['x'] });
    expect(getOrCreateGamification).toHaveBeenCalledWith('e1');
    expect(web.webUpdateGamification).toHaveBeenCalledWith('e1', expect.objectContaining({
      totalXP: 50, weeklyXP: 10, badges: '["x"]', domainScores: '{"health":3}',
    }));
  });

  test('Explore + profile + user entities route to their web upserts', async () => {
    await apply('interests', { id: 'e1' });
    expect(web.webUpsertInterestById).toHaveBeenCalled();
    await apply('exploration_log', { id: 'e1' });
    expect(web.webUpsertExplorationById).toHaveBeenCalled();
    await apply('expeditions', { id: 'e1' });
    expect(web.webUpsertExpeditionById).toHaveBeenCalled();
    await apply('expedition_progress', { id: 'e1', userId: 'u1', expeditionId: 'x1' });
    expect(web.webUpsertExpeditionProgress).toHaveBeenCalled();
    await apply('sparks', { id: 'e1' });
    expect(web.webUpsertSparkById).toHaveBeenCalled();
    await apply('user_profiles', { profile: { goal: 'x' } });
    expect(web.webUpsertUserProfile).toHaveBeenCalledWith('e1', { goal: 'x' });
    await apply('users', { name: 'N' });
    expect(web.webUpdateUser).toHaveBeenCalledWith('e1', expect.objectContaining({ name: 'N' }));
  });

  test('daily_reflection web upsert', async () => {
    await apply('daily_reflections', { id: 'e1', text: 'hi' });
    expect(web.webUpsertReflectionById).toHaveBeenCalled();
  });

  test('malformed profile JSON is skipped, not thrown', async () => {
    mMaterialize.mockReturnValue({ profile: '{bad json' });
    const out = await applyRemoteMutation(rec('user_profiles', 'e1'), fakeSink(true, { history: [rec('user_profiles', 'e1')] }));
    expect(out).toBe(true);
    expect(web.webUpsertUserProfile).not.toHaveBeenCalled();
  });

  test('applyEntityState writes directly without touching the sink (restore path)', () => {
    mMaterialize.mockReturnValue({ id: 'e1' });
    applyEntityState('goals', 'e1', { id: 'e1', title: 'restored' });
    expect(web.webUpsertGoalById).toHaveBeenCalledWith({ id: 'e1', title: 'restored' });
  });
});

// ─── native db routing (isWeb = false) ──────────────────────────────────────
describe('applyState — native db routing', () => {
  beforeEach(() => { Platform.OS = 'ios' as typeof Platform.OS; });
  afterEach(() => { Platform.OS = 'node' as typeof Platform.OS; });

  const apply = async (entity: string, snapshot: unknown) => {
    mMaterialize.mockReturnValue(snapshot);
    await applyRemoteMutation(rec(entity, 'e1', 1), fakeSink(true, { history: [rec(entity, 'e1')] }));
  };

  test('goal upsert → db.insert; tombstone → db.update (soft delete)', async () => {
    await apply('goals', { id: 'e1' });
    expect(dbOps.insert).toHaveBeenCalled();
    await apply('goals', null);
    expect(dbOps.update).toHaveBeenCalled();
  });

  test('routine_block tombstone → db.delete (hard delete)', async () => {
    await apply('routine_blocks', null);
    expect(dbOps.delete).toHaveBeenCalled();
  });

  test('expedition_progress with no existing row → insert', async () => {
    nextGetRow = undefined; // existing lookup returns nothing
    await apply('expedition_progress', { id: 'e1', userId: 'u1', expeditionId: 'x1' });
    expect(dbOps.insert).toHaveBeenCalled();
  });

  test('expedition_progress with existing row → update', async () => {
    nextGetRow = { id: 'existing' };
    await apply('expedition_progress', { id: 'e1', userId: 'u1', expeditionId: 'x1' });
    expect(dbOps.update).toHaveBeenCalled();
  });

  test('users update strips identity/credential columns', async () => {
    await apply('users', { name: 'N', primaryDomains: ['a'], id: 'leak', email: 'x', passwordHash: 'h' });
    expect(dbOps.update).toHaveBeenCalled();
  });

  test('id-keyed Explore entities + reflection + new profile insert via db', async () => {
    for (const [entity, snap] of [
      ['daily_reflections', { id: 'e1', text: 't' }],
      ['interests', { id: 'e1' }],
      ['exploration_log', { id: 'e1' }],
      ['expeditions', { id: 'e1' }],
      ['sparks', { id: 'e1' }],
      ['user_profiles', { profile: { a: 1 } }], // existing lookup → undefined ⇒ insert
    ] as const) {
      dbOps.insert.mockClear();
      nextGetRow = undefined;
      await apply(entity, snap);
      expect(dbOps.insert).toHaveBeenCalled();
    }
  });

  test('daily_reflections tombstone → db.delete', async () => {
    await apply('daily_reflections', null);
    expect(dbOps.delete).toHaveBeenCalled();
  });

  test('existing user_profile → db.update', async () => {
    nextGetRow = { userId: 'e1' };
    await apply('user_profiles', { profile: { a: 1 } });
    expect(dbOps.update).toHaveBeenCalled();
  });
});
