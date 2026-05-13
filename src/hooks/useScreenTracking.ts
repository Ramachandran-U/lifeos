import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { logBehaviourEvent } from '@/db/queries/behaviour';

/**
 * Logs a `screen_view` behaviour event with duration in milliseconds when the
 * screen blurs. Used by the Profile screen's usage analytics.
 *
 * Pass a stable, lowercase module/screen identifier — e.g. `'today'`,
 * `'goals'`, `'profile'`. Used as the `module` field on the event row.
 */
export function useScreenTracking(screen: string): void {
  useFocusEffect(
    useCallback(() => {
      const start = Date.now();
      return () => {
        const durationMs = Date.now() - start;
        if (durationMs < 250) return; // ignore accidental flashes
        logBehaviourEvent('screen_view', screen, { durationMs });
      };
    }, [screen]),
  );
}
