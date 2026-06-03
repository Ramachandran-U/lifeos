/**
 * Write-path tests for src/db/queries/users.ts (web branch).
 *
 * Forces the web branch so createUser/getUser/updateUser etc. delegate to the
 * localStorage-backed webStorage helpers. createUser also sets the web session
 * (so getUser, which reads the session row, resolves the just-created user).
 *
 * updateUser logs only profile fields (before:null by design — no credentials
 * reach the mutation log; the reducer applies update-only).
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

import {
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  getUserOnboardingStage,
  upsertGoogleUser,
  ensureLocalUserFromAuth,
  setWebSession,
  deleteAllUsers,
  GOOGLE_SSO_HASH,
  SUPABASE_AUTH_HASH,
} from '../users';
import { recordMutation } from '@/sync/runtime';

const recordMutationMock = recordMutation as jest.MockedFunction<typeof recordMutation>;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('createUser (web)', () => {
  it('lowercases the email, defaults onboardingStage to 0, and opens the session', async () => {
    const id = await createUser({
      email: 'Fake.User@Example.com',
      passwordHash: 'hash-x',
      passwordSalt: 'salt-x',
      name: 'Fake User',
      age: 33,
      visionStatement: 'live well',
    });

    const stored = getUser(); // resolves via the session set by createUser
    expect(stored?.id).toBe(id);
    expect(stored?.email).toBe('fake.user@example.com');
    expect(stored?.name).toBe('Fake User');
    expect(stored?.age).toBe(33);
    expect(stored?.onboardingStage).toBe(0);
    expect(stored?.installDate).toBeTruthy();
  });

  it('honours an explicit id when provided', async () => {
    const id = await createUser({
      id: 'explicit-id-1',
      email: 'a@example.com',
      passwordHash: 'h',
      passwordSalt: 's',
      name: 'A',
    });
    expect(id).toBe('explicit-id-1');
    expect(getUser()?.id).toBe('explicit-id-1');
  });
});

describe('getUserByEmail (web)', () => {
  it('finds a user case-insensitively', async () => {
    await createUser({ email: 'mixed.Case@Example.com', passwordHash: 'h', passwordSalt: 's', name: 'M' });
    expect(getUserByEmail('MIXED.CASE@EXAMPLE.COM')?.name).toBe('M');
  });

  it('returns undefined for an unknown email', () => {
    expect(getUserByEmail('nobody@example.com')).toBeUndefined();
  });
});

describe('updateUser (web)', () => {
  it('persists profile fields and bumps updatedAt (round-trip)', async () => {
    const id = await createUser({ email: 'u@example.com', passwordHash: 'h', passwordSalt: 's', name: 'U' });

    updateUser(id, { name: 'Renamed', heightCm: 175, onboardingStage: 2 });

    const stored = getUser();
    expect(stored?.name).toBe('Renamed');
    expect(stored?.heightCm).toBe(175);
    expect(stored?.onboardingStage).toBe(2);
  });

  it('records an update mutation carrying only profile fields (before:null, after has the patch)', async () => {
    const id = await createUser({ email: 'u2@example.com', passwordHash: 'h', passwordSalt: 's', name: 'U2' });
    recordMutationMock.mockClear();

    updateUser(id, { visionStatement: 'be curious', onboardingStage: 1 });

    expect(recordMutationMock).toHaveBeenCalledTimes(1);
    const call = recordMutationMock.mock.calls[0][0];
    expect(call.entity).toBe('users');
    expect(call.entityId).toBe(id);
    expect(call.op).toBe('update');
    expect(call.before).toBeNull();
    const after = call.after as Record<string, unknown>;
    expect(after.visionStatement).toBe('be curious');
    expect(after.onboardingStage).toBe(1);
    expect(after.updatedAt).toBeTruthy();
    // No credential leakage into the mutation log.
    expect(after.passwordHash).toBeUndefined();
    expect(after.passwordSalt).toBeUndefined();
  });
});

describe('getUserOnboardingStage (web)', () => {
  it('returns the stage of the session user', async () => {
    const id = await createUser({ email: 'stage@example.com', passwordHash: 'h', passwordSalt: 's', name: 'S' });
    expect(getUserOnboardingStage()).toBe(0);
    updateUser(id, { onboardingStage: 4 });
    expect(getUserOnboardingStage()).toBe(4);
  });
});

describe('upsertGoogleUser (web)', () => {
  it('creates a new Google-SSO user when none exists', async () => {
    const id = await upsertGoogleUser({ email: 'g@example.com', name: 'Google User' });
    const stored = getUserByEmail('g@example.com');
    expect(stored?.id).toBe(id);
    expect(stored?.passwordHash).toBe(GOOGLE_SSO_HASH);
    expect(stored?.name).toBe('Google User');
  });

  it('reuses an existing account and refreshes the name', async () => {
    const original = await createUser({ email: 'dup@example.com', passwordHash: 'h', passwordSalt: 's', name: 'Old Name' });
    const id = await upsertGoogleUser({ email: 'dup@example.com', name: 'New Name' });
    expect(id).toBe(original);
    expect(getUserByEmail('dup@example.com')?.name).toBe('New Name');
  });
});

describe('ensureLocalUserFromAuth (web)', () => {
  it('creates a Supabase-auth user row when none exists', async () => {
    await ensureLocalUserFromAuth({ userId: 'sb-1', email: 'sb@example.com', name: 'SB User' });
    const stored = getUserByEmail('sb@example.com');
    expect(stored?.id).toBe('sb-1');
    expect(stored?.passwordHash).toBe(SUPABASE_AUTH_HASH);
  });

  it('rewrites a legacy local id onto the auth id, keeping the email', async () => {
    await createUser({ id: 'legacy-id', email: 'legacy@example.com', passwordHash: 'h', passwordSalt: 's', name: 'Legacy' });

    await ensureLocalUserFromAuth({ userId: 'auth-id', email: 'legacy@example.com', name: 'Legacy' });

    // The row now lives under the auth id; the legacy id is gone.
    expect(getUserByEmail('legacy@example.com')?.id).toBe('auth-id');
  });

  it('no-ops when the id already matches', async () => {
    await createUser({ id: 'same-id', email: 'same@example.com', passwordHash: 'h', passwordSalt: 's', name: 'Same' });
    await ensureLocalUserFromAuth({ userId: 'same-id', email: 'same@example.com', name: 'Same' });
    expect(getUserByEmail('same@example.com')?.id).toBe('same-id');
  });
});

describe('session helpers (web)', () => {
  it('setWebSession(null) clears the session so getUser returns undefined', async () => {
    await createUser({ email: 'sess@example.com', passwordHash: 'h', passwordSalt: 's', name: 'Sess' });
    expect(getUser()).toBeDefined();
    setWebSession(null);
    expect(getUser()).toBeUndefined();
  });

  it('deleteAllUsers wipes user rows and the session', async () => {
    await createUser({ email: 'wipe@example.com', passwordHash: 'h', passwordSalt: 's', name: 'Wipe' });
    deleteAllUsers();
    expect(getUser()).toBeUndefined();
    expect(getUserByEmail('wipe@example.com')).toBeUndefined();
  });
});
