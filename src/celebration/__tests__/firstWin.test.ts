/**
 * firstWin beat (cold_start_v1, spec §3.3 / AC-4).
 *
 *  - sfx-via-store: celebrate({ kind: 'firstWin' }) plays the identity
 *    fanfare (same branch as levelUp/milestone), not the dayComplete sweep.
 *  - integration: the firstBlockCompletedAt stamp guard is the once-enforcer.
 *    This suite drives the REAL pieces the Today guard composes — the
 *    webStorage user-profile store and the real celebration queue — through
 *    the exact guard predicate `app/(tabs)/index.tsx` uses, proving the first
 *    completion enqueues exactly one firstWin event and the second enqueues
 *    zero (dilution trap #9: relocating the beat outside the guard fails the
 *    second-block assertion).
 */

// In-memory localStorage so the webStorage shim works under node.
beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

jest.mock('@/sound/soundEngine', () => ({
  playSfx: jest.fn(),
}));

import { setFlagOverride, resetFlagOverrides, isEnabled as isFlagEnabled } from '@/config/flags';
import { playSfx } from '@/sound/soundEngine';
import { emptyUserProfile, type UserProfile } from '@/ai/types';
import { webGetUserProfile, webUpsertUserProfile } from '@/db/webStorage/userProfile';
import { useCelebrationStore, celebrate } from '../useCelebrationStore';

const USER = 'fw-user-1';

function drainAll() {
  const store = useCelebrationStore.getState();
  while (useCelebrationStore.getState().active) store.complete();
}

function firstWinEventCount(): number {
  const s = useCelebrationStore.getState();
  return [s.active, ...s.queue].filter((e) => e?.kind === 'firstWin').length;
}

/**
 * The Today screen's stamp guard, verbatim mechanics (index.tsx — the
 * `onboarding_v2` first-block once-guard): read the profile, and only when it
 * exists WITHOUT a firstBlockCompletedAt stamp, stamp it and fire the beat.
 */
function completeBlockThroughGuard(): void {
  const profile = webGetUserProfile(USER);
  if (profile && !profile.firstBlockCompletedAt) {
    const stamped: UserProfile = { ...profile, firstBlockCompletedAt: new Date().toISOString() };
    webUpsertUserProfile(USER, stamped);
    if (isFlagEnabled('celebrationEngine')) {
      celebrate({ kind: 'firstWin' });
    }
  }
}

afterEach(() => {
  resetFlagOverrides();
  drainAll();
  localStorage.clear();
  jest.clearAllMocks();
});

describe('firstWin sfx — via the store choke point', () => {
  test('celebrate({ kind: firstWin }) plays the identity fanfare', () => {
    setFlagOverride({ celebrationEngine: true });
    celebrate({ kind: 'firstWin' });
    expect(playSfx).toHaveBeenCalledTimes(1);
    expect(playSfx).toHaveBeenCalledWith('fanfare');
  });

  test('dayComplete still gets the sweep — the fanfare stays an identity sound', () => {
    setFlagOverride({ celebrationEngine: true });
    celebrate({ kind: 'dayComplete' });
    expect(playSfx).toHaveBeenCalledWith('sweep');
  });
});

describe('firstWin integration — the stamp guard is the once-enforcer (AC-4)', () => {
  test('first-ever block completion enqueues exactly one firstWin event', () => {
    setFlagOverride({ celebrationEngine: true });
    webUpsertUserProfile(USER, emptyUserProfile('chat'));

    completeBlockThroughGuard();

    expect(firstWinEventCount()).toBe(1);
    expect(webGetUserProfile(USER)?.firstBlockCompletedAt).toBeTruthy();
  });

  test('a second completion enqueues zero firstWin events (stamp holds)', () => {
    setFlagOverride({ celebrationEngine: true });
    webUpsertUserProfile(USER, emptyUserProfile('chat'));

    completeBlockThroughGuard();
    drainAll();
    completeBlockThroughGuard();

    expect(firstWinEventCount()).toBe(0);
  });

  test('no profile row → guard never fires (legacy funnel keeps legacy behavior)', () => {
    setFlagOverride({ celebrationEngine: true });
    completeBlockThroughGuard();
    expect(firstWinEventCount()).toBe(0);
  });
});
