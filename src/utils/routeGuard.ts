/**
 * Pure routing-guard decision for the root layout.
 *
 * Extracted from `app/_layout.tsx`'s focus effect so the redirect rules are
 * unit-testable in isolation — the inline version had no coverage, which is
 * how BUG-010 (chat bounced to Today) and the BUG-013 "fresh-account
 * onboarding bypass" concern slipped through. Given the auth + onboarding
 * state and the current route segments, this returns the path to
 * `router.replace()` to, or `null` to stay put.
 *
 * Keep this in sync with the allowlist below; adding a new post-onboarding
 * full-screen route means adding it to POST_ONBOARDING_ROUTES (and a test).
 */

import { ONBOARDING_COMPLETE } from '@/store/useUserStore';

export interface GuardState {
  userId: string | null;
  onboardingStage: number;
  /** segments[0] from expo-router useSegments(). */
  seg0: string;
  /** segments[1] — the nested route within a group, if any. */
  seg1: string;
}

/** Top-level routes an onboarded user may visit outside the tab navigator. */
const POST_ONBOARDING_ROUTES = new Set([
  '(tabs)',
  'evening-reflect',
  'monthly-insight',
  'annual-review',
  'contact',
  'data-residency',
  'what-lifeos-knows',
  'settings',
  'terms-privacy',
  'edit-priorities',
  'notifications-settings',
  'how-it-works',
  'feedback',
  'chat',
]);

/** Progressive onboarding screens reachable AFTER main onboarding completes. */
const PROGRESSIVE_ONBOARDING = new Set([
  'day3-health',
  'day7-finance',
  'day7-social',
  'day14-polymath',
  'discovery-paste',
  'discovery-confirm',
]);

function isOAuthCallback(seg0: string): boolean {
  return seg0 === 'google-auth-callback' || seg0.endsWith('-callback');
}

export function resolveGuardRedirect(s: GuardState): string | null {
  const { userId, onboardingStage, seg0, seg1 } = s;
  const inAuth = seg0 === '(auth)';
  const inOnboarding = seg0 === '(onboarding)';
  const inGoogleCallback = isOAuthCallback(seg0);

  // Unauthenticated → only auth screens + OAuth callbacks are allowed.
  if (!userId) {
    return inAuth || inGoogleCallback ? null : '/(auth)/sign-in';
  }

  // New flow: no intent captured yet → short welcome screen.
  if (onboardingStage === 0) {
    return seg0 === 'welcome-intent' || inOnboarding ? null : '/welcome-intent';
  }

  // Legacy flow: mid-onboarding users are pinned to the onboarding group.
  // This is the BUG-013 guard — a fresh/partly-onboarded account cannot reach
  // (tabs) or any post-onboarding route until the stage reaches COMPLETE.
  if (onboardingStage < ONBOARDING_COMPLETE) {
    return inOnboarding ? null : '/(onboarding)/day1-vision';
  }

  // Onboarded → allow the tab navigator, the explicit post-onboarding routes,
  // progressive onboarding screens, the routine editor, and OAuth callbacks.
  const inEditRoutine = inOnboarding && seg1 === 'day1-routine';
  const inProgressiveOnboarding = inOnboarding && PROGRESSIVE_ONBOARDING.has(seg1);
  const allowed =
    POST_ONBOARDING_ROUTES.has(seg0) ||
    inEditRoutine ||
    inProgressiveOnboarding ||
    inGoogleCallback;

  return allowed ? null : '/(tabs)';
}
