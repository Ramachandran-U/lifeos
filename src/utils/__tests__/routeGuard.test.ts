import { resolveGuardRedirect, type GuardState } from '../routeGuard';
import { ONBOARDING_COMPLETE } from '@/store/useUserStore';

const state = (over: Partial<GuardState>): GuardState => ({
  userId: 'u1',
  onboardingStage: ONBOARDING_COMPLETE,
  seg0: '(tabs)',
  seg1: '',
  ...over,
});

describe('resolveGuardRedirect — unauthenticated', () => {
  it('redirects to sign-in from a normal route', () => {
    expect(resolveGuardRedirect(state({ userId: null, seg0: '(tabs)' }))).toBe('/(auth)/sign-in');
  });
  it('stays put on an auth screen', () => {
    expect(resolveGuardRedirect(state({ userId: null, seg0: '(auth)' }))).toBeNull();
  });
  it('stays put on an OAuth callback (code exchange must finish)', () => {
    expect(resolveGuardRedirect(state({ userId: null, seg0: 'google-auth-callback' }))).toBeNull();
    expect(resolveGuardRedirect(state({ userId: null, seg0: 'calendar-callback' }))).toBeNull();
  });
});

describe('resolveGuardRedirect — onboarding (BUG-013 fresh-account guard)', () => {
  it('stage 0 → welcome-intent', () => {
    expect(resolveGuardRedirect(state({ onboardingStage: 0, seg0: '(tabs)' }))).toBe('/welcome-intent');
  });
  it('stage 0 stays on welcome-intent / onboarding', () => {
    expect(resolveGuardRedirect(state({ onboardingStage: 0, seg0: 'welcome-intent' }))).toBeNull();
    expect(resolveGuardRedirect(state({ onboardingStage: 0, seg0: '(onboarding)' }))).toBeNull();
  });
  it('a partly-onboarded account CANNOT reach the tabs', () => {
    expect(resolveGuardRedirect(state({ onboardingStage: 50, seg0: '(tabs)' }))).toBe('/(onboarding)/day1-vision');
  });
  it('a partly-onboarded account CANNOT deep-link a post-onboarding route', () => {
    expect(resolveGuardRedirect(state({ onboardingStage: 50, seg0: 'annual-review' }))).toBe('/(onboarding)/day1-vision');
    expect(resolveGuardRedirect(state({ onboardingStage: 50, seg0: 'settings' }))).toBe('/(onboarding)/day1-vision');
  });
  it('mid-onboarding stays inside the onboarding group', () => {
    expect(resolveGuardRedirect(state({ onboardingStage: 50, seg0: '(onboarding)' }))).toBeNull();
  });
});

describe('resolveGuardRedirect — onboarded allowlist', () => {
  it('allows the tab navigator', () => {
    expect(resolveGuardRedirect(state({ seg0: '(tabs)' }))).toBeNull();
  });
  it.each([
    'annual-review', 'monthly-insight', 'chat', 'settings', 'feedback',
    'contact', 'evening-reflect', 'how-it-works', 'notifications-settings',
    'activity',
  ])('allows post-onboarding route: %s', (seg0) => {
    expect(resolveGuardRedirect(state({ seg0 }))).toBeNull();
  });
  it('bounces an unknown top-level route back to tabs', () => {
    expect(resolveGuardRedirect(state({ seg0: 'totally-unknown' }))).toBe('/(tabs)');
  });
  it('allows the routine editor (onboarding/day1-routine) post-completion', () => {
    expect(resolveGuardRedirect(state({ seg0: '(onboarding)', seg1: 'day1-routine' }))).toBeNull();
  });
  it('allows progressive onboarding screens post-completion', () => {
    expect(resolveGuardRedirect(state({ seg0: '(onboarding)', seg1: 'day3-health' }))).toBeNull();
    expect(resolveGuardRedirect(state({ seg0: '(onboarding)', seg1: 'day14-polymath' }))).toBeNull();
  });
  it('bounces an arbitrary onboarding sub-route back to tabs', () => {
    expect(resolveGuardRedirect(state({ seg0: '(onboarding)', seg1: 'day1-vision' }))).toBe('/(tabs)');
  });
});
