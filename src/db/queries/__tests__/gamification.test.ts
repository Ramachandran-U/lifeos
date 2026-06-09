/**
 * Write-path tests for src/db/queries/gamification.ts (web branch).
 *
 * getOrCreateGamification lazily seeds a default row; updateGamification reads
 * the full row first (so the mutation carries a complete before snapshot) then
 * logs an 'update' keyed by USERID — gamification is a per-user singleton, so
 * the sync entityId is the userId (not the random per-device row id), or two
 * devices' rows would never merge. (Mirrors the updateGamification assertion in
 * src/store/__tests__/useGameStore.completeBlock.test.ts but at the DB layer.)
 *
 * Echo-safety: webUpsertGamification (the sync reducer's apply path) must NEVER
 * fire recordMutation.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/sync/runtime', () => ({ recordMutation: jest.fn() }));

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import { getOrCreateGamification, updateGamification } from '../gamification';
import { webUpsertGamification, webGetGamification, type WebGamification } from '../../webStorage';
import { recordMutation } from '@/sync/runtime';

const recordMutationMock = recordMutation as jest.MockedFunction<typeof recordMutation>;

const USER = 'user-fake-1';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('getOrCreateGamification (web)', () => {
  it('seeds a default row on first call (zeroed scores/streaks, empty badges, 0 XP)', () => {
    const row = getOrCreateGamification(USER);

    expect(row.userId).toBe(USER);
    expect(row.totalXP).toBe(0);
    expect(row.weeklyXP).toBe(0);
    expect(row.badges).toBe('[]');
    expect(JSON.parse(row.domainScores)).toEqual({
      goals: 0, health: 0, finance: 0, career: 0, social: 0, polymath: 0,
    });
    const streaks = JSON.parse(row.streaks) as Record<string, { count: number }>;
    expect(streaks.workout.count).toBe(0);
    expect(streaks.learning.count).toBe(0);
    // Seeding is a read-or-create; it must not emit a mutation.
    expect(recordMutationMock).not.toHaveBeenCalled();
  });

  it('returns the same persisted row on a second call (does not duplicate)', () => {
    const first = getOrCreateGamification(USER);
    const second = getOrCreateGamification(USER);
    expect(second.id).toBe(first.id);
    expect(webGetGamification(USER)?.id).toBe(first.id);
  });
});

describe('updateGamification (web)', () => {
  it('persists the patch (XP + scores) and round-trips through storage', () => {
    getOrCreateGamification(USER);
    const scores = JSON.stringify({ goals: 10, health: 20, finance: 0, career: 0, social: 0, polymath: 0 });

    updateGamification(USER, { totalXP: 150, weeklyXP: 40, domainScores: scores });

    const stored = webGetGamification(USER);
    expect(stored?.totalXP).toBe(150);
    expect(stored?.weeklyXP).toBe(40);
    expect(JSON.parse(stored!.domainScores)).toMatchObject({ goals: 10, health: 20 });
  });

  it('logs an update mutation keyed by USERID with a complete before + merged after', () => {
    getOrCreateGamification(USER);
    recordMutationMock.mockClear();

    updateGamification(USER, { totalXP: 99, weeklyXP: 9 });

    expect(recordMutationMock).toHaveBeenCalledTimes(1);
    const call = recordMutationMock.mock.calls[0][0];
    expect(call.entity).toBe('gamification');
    // Singleton: entityId is the userId, NOT the random per-device row id.
    expect(call.entityId).toBe(USER);
    expect(call.op).toBe('update');
    // before is the full prior row (complete snapshot for CRDT merge).
    const before = call.before as Record<string, unknown>;
    expect(before.userId).toBe(USER);
    expect(before.totalXP).toBe(0);
    // after merges the patch over before.
    const after = call.after as Record<string, unknown>;
    expect(after.totalXP).toBe(99);
    expect(after.weeklyXP).toBe(9);
    expect(after.updatedAt).toBeTruthy();
  });

  it('seeds-then-updates when no row exists yet (getOrCreate inside update)', () => {
    // No prior getOrCreateGamification call — update must still work because it
    // reads-or-creates the before snapshot internally.
    updateGamification(USER, { badges: '["first-step"]' });

    expect(webGetGamification(USER)?.badges).toBe('["first-step"]');
    const call = recordMutationMock.mock.calls[0][0];
    expect((call.after as Record<string, unknown>).badges).toBe('["first-step"]');
  });
});

describe('echo-safety: webUpsertGamification (sync reducer path)', () => {
  it('does NOT record a mutation when applying a remote gamification row', () => {
    const remote: WebGamification = {
      id: 'remote-gam-1',
      userId: USER,
      domainScores: JSON.stringify({ goals: 5, health: 5, finance: 5, career: 5, social: 5, polymath: 5 }),
      streaks: '{}',
      badges: '["synced"]',
      totalXP: 500,
      weeklyXP: 50,
      streakFreezes: 0,
      freezeProgressXP: 0,
      cosmetics: '[]',
      companion: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    webUpsertGamification(remote);

    expect(recordMutationMock).not.toHaveBeenCalled();
    expect(webGetGamification(USER)?.totalXP).toBe(500);
  });
});
