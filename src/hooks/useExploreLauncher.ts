import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { track, EVENTS } from '@/utils/telemetry';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import {
  buildDiveParams,
  buildBridgeParams,
  type ExploreInterestRef,
} from '@/explore/exploreLaunch';

/**
 * Launches user-initiated exploration into the existing rabbit-hole screen.
 * Keeps the Explore screen's diff tiny: all the nav + telemetry + streak side
 * effects live here, seeded by the pure builders in exploreLaunch.ts.
 *
 * - dive(interest)   → one idea, deep
 * - bridge(a, b)     → two ideas, across
 */
export function useExploreLauncher() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const triggerStreak = useGameStore((s) => s.triggerStreak);

  const dive = useCallback(
    (interest: ExploreInterestRef) => {
      track(EVENTS.exploreDiveStarted, { interest: interest.name });
      if (userId) triggerStreak(userId, 'learning');
      router.push({ pathname: '/rabbit-hole', params: buildDiveParams(interest) });
    },
    [router, userId, triggerStreak],
  );

  const bridge = useCallback(
    (a: ExploreInterestRef, b: ExploreInterestRef) => {
      track(EVENTS.exploreBridgeStarted, { a: a.name, b: b.name });
      if (userId) triggerStreak(userId, 'learning');
      router.push({ pathname: '/rabbit-hole', params: buildBridgeParams(a, b) });
    },
    [router, userId, triggerStreak],
  );

  return { dive, bridge };
}
