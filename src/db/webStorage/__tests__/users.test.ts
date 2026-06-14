/**
 * webStorage/users — create/read-back, session-scoped current user, email
 * lookup (case-insensitive + soft-delete exclusion), partial update with the
 * missing-id warning, and the id-rewrite migration that re-homes every
 * userId-scoped record.
 */

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import {
  webCreateUser,
  webGetUser,
  webGetUserByEmail,
  webUpdateUser,
  webRewriteUserId,
  webSetSession,
  type WebUser,
} from '../users';
import { webInsertGoal, webGetGoalsByUser } from '../goals';
import { webInsertContact, webGetContactsByUser } from '../social';

function user(over: Partial<WebUser>): WebUser {
  return {
    id: 'user-a',
    email: 'fake@example.test',
    passwordHash: 'hash',
    passwordSalt: 'salt',
    name: 'Test Persona',
    onboardingStage: 0,
    installDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('webGetUser (session-scoped)', () => {
  it('returns the user matching the active session, undefined when no session', () => {
    webCreateUser(user({ id: 'user-a' }));
    expect(webGetUser()).toBeUndefined();
    webSetSession('user-a');
    expect(webGetUser()?.id).toBe('user-a');
    webSetSession(null);
    expect(webGetUser()).toBeUndefined();
  });

  it('does not return a soft-deleted user even with a matching session', () => {
    webCreateUser(user({ id: 'user-a', deletedAt: '2026-02-01T00:00:00.000Z' }));
    webSetSession('user-a');
    expect(webGetUser()).toBeUndefined();
  });
});

describe('webGetUserByEmail', () => {
  it('matches case-insensitively and skips soft-deleted rows', () => {
    webCreateUser(user({ id: 'user-a', email: 'lower@example.test' }));
    webCreateUser(user({ id: 'user-b', email: 'gone@example.test', deletedAt: '2026-02-01T00:00:00.000Z' }));
    expect(webGetUserByEmail('LOWER@EXAMPLE.TEST')?.id).toBe('user-a');
    expect(webGetUserByEmail('gone@example.test')).toBeUndefined();
  });
});

describe('webUpdateUser', () => {
  it('applies a partial update and bumps updatedAt', () => {
    webCreateUser(user({ id: 'user-a', onboardingStage: 0, updatedAt: '2026-01-01T00:00:00.000Z' }));
    webUpdateUser('user-a', { onboardingStage: 3, name: 'Renamed' });
    webSetSession('user-a');
    const after = webGetUser();
    expect(after?.onboardingStage).toBe(3);
    expect(after?.name).toBe('Renamed');
    expect(after?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('warns and drops the update for an unknown id', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    webUpdateUser('missing', { onboardingStage: 9 });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('persists the selected voice persona id', () => {
    webCreateUser(user({ id: 'user-a' }));
    webSetSession('user-a');
    expect(webGetUser()?.preferredVoiceId).toBeUndefined();
    webUpdateUser('user-a', { preferredVoiceId: 'sage' });
    expect(webGetUser()?.preferredVoiceId).toBe('sage');
  });
});

describe('webRewriteUserId', () => {
  it('rewrites the id (keeping email/createdAt), optionally renames, and migrates scoped data', () => {
    webCreateUser(user({ id: 'old', email: 'keep@example.test', createdAt: '2026-01-01T00:00:00.000Z' }));
    webInsertGoal({
      id: 'g1', userId: 'old', title: 'Goal', goalType: 'vision', level: 'vision',
      status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
    webInsertContact({
      id: 'c1', userId: 'old', name: 'Friend', relationshipType: 'friend',
      preferredCadenceDays: 14, source: 'manual',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });

    webRewriteUserId('old', 'new', 'New Name');

    webSetSession('new');
    const migrated = webGetUser();
    expect(migrated?.id).toBe('new');
    expect(migrated?.email).toBe('keep@example.test');
    expect(migrated?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(migrated?.name).toBe('New Name');

    // userId-scoped records follow the new id; nothing left under the old one.
    expect(webGetGoalsByUser('new').map((g) => g.id)).toEqual(['g1']);
    expect(webGetGoalsByUser('old')).toHaveLength(0);
    expect(webGetContactsByUser('new').map((c) => c.id)).toEqual(['c1']);
  });

  it('is a no-op when the old id does not exist', () => {
    webCreateUser(user({ id: 'user-a' }));
    webRewriteUserId('missing', 'new');
    webSetSession('user-a');
    expect(webGetUser()?.id).toBe('user-a');
  });
});
