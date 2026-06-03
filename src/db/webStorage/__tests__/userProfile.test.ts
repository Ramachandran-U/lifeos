/**
 * webStorage/userProfile — user-scoped get and upsert-by-userId idempotency.
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

import { emptyUserProfile } from '@/ai/types';
import { webGetUserProfile, webUpsertUserProfile } from '../userProfile';

beforeEach(() => { localStorage.clear(); });

describe('userProfile', () => {
  it('returns null before any upsert', () => {
    expect(webGetUserProfile('user-a')).toBeNull();
  });

  it('upserts and reads back the profile for the matching user only', () => {
    const profile = emptyUserProfile('chat');
    profile.identity.firstName = 'Persona';
    webUpsertUserProfile('user-a', profile);
    expect(webGetUserProfile('user-a')?.identity.firstName).toBe('Persona');
    expect(webGetUserProfile('user-b')).toBeNull();
  });

  it('replaces in place on a second upsert for the same user (no duplicate row)', () => {
    const first = emptyUserProfile('chat');
    first.identity.firstName = 'First';
    webUpsertUserProfile('user-a', first);

    const second = emptyUserProfile('chat');
    second.identity.firstName = 'Second';
    webUpsertUserProfile('user-a', second);

    expect(webGetUserProfile('user-a')?.identity.firstName).toBe('Second');
    expect(localStorage.getItem('lifeos_user_profiles')).toContain('Second');
    expect(localStorage.getItem('lifeos_user_profiles')).not.toContain('First');
  });
});
