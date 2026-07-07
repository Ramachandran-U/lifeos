/**
 * Episodic context for the Routine Planner's retrieve step — mirrors
 * calendarContext / billsContext: an async builder that NEVER throws and
 * returns [] when there's nothing (flag off, signed out, no summaries yet).
 *
 * Each recent day-summary becomes one RagItem ("On 2026-07-05: They completed
 * ..."), so the agent's retrieveTopK can rank whole lived days against the
 * plan query — narrative recall the behaviour-event counters can't provide.
 */
import type { RagItem } from './rag/retrieve';
import { getRecentDaySummaries } from '@/db/queries/daySummaries';
import { isEpisodicMemoryEnabled } from './episodic/daySummary';
import { useUserStore } from '@/store/useUserStore';

/** How many recent days to offer the retrieval pool. */
const EPISODE_WINDOW_DAYS = 7;

export async function buildEpisodicContext(): Promise<RagItem[]> {
  try {
    if (!isEpisodicMemoryEnabled()) return [];
    const userId = useUserStore.getState().userId;
    if (!userId) return [];
    const summaries = await getRecentDaySummaries(userId, EPISODE_WINDOW_DAYS);
    return summaries.map((s) => ({
      id: `episode:${s.date}`,
      text: `On ${s.date}: ${s.summary}`,
      metadata: { source: s.source },
    }));
  } catch {
    return [];
  }
}
