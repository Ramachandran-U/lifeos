import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { getLocalSink } from '@/sync/sink';
import { getEntityHistory, restoreEntityTo, type HistoryEntry, type AsOfPoint } from '@/sync/history';
import { getDeviceId } from '@/utils/telemetry';
import { buildActivityFeed, type ActivityDay } from '@/sync/activityFeed';

export type ActivityStatus = 'loading' | 'ready' | 'error';

export interface UseActivityFeedResult {
  status: ActivityStatus;
  days: ActivityDay[];
  error: string | null;
  /** Re-read the log and rebuild the feed (also called after a restore). */
  reload: () => Promise<void>;
  /** The full timeline for one entity row, oldest→newest. */
  loadHistory: (entity: string, entityId: string) => Promise<HistoryEntry[]>;
  /** Restore an entity to an earlier point. Returns false if nothing to bring back. */
  restore: (entity: string, entityId: string, point: AsOfPoint) => Promise<boolean>;
}

// Local day key — matches the rest of the app's local-date convention so the
// feed groups by the user's calendar day, not UTC.
const dayKey = (ts: string): string => format(new Date(ts), 'yyyy-MM-dd');

/**
 * State for the Activity screen. Reads the mutation log via the sink, turns it
 * into a day-grouped feed (pure logic in activityFeed.ts), and exposes per-entity
 * history + restore (history.ts). Read-mostly: the only write is an explicit,
 * user-confirmed restore — which is itself recorded as an auditable mutation.
 */
export function useActivityFeed(): UseActivityFeedResult {
  const [status, setStatus] = useState<ActivityStatus>('loading');
  const [days, setDays] = useState<ActivityDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      if (deviceIdRef.current == null) {
        deviceIdRef.current = await getDeviceId().catch(() => null);
      }
      const rows = await getLocalSink().readAllWithState();
      setDays(buildActivityFeed(rows.map((r) => r.record), deviceIdRef.current, dayKey));
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your activity.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadHistory = useCallback(
    (entity: string, entityId: string) => getEntityHistory(entity, entityId),
    [],
  );

  const restore = useCallback(
    async (entity: string, entityId: string, point: AsOfPoint): Promise<boolean> => {
      const restored = await restoreEntityTo(entity, entityId, point);
      await reload();
      return restored !== null;
    },
    [reload],
  );

  return { status, days, error, reload, loadHistory, restore };
}
