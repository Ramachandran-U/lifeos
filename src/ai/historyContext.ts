/**
 * Pulls recent user history into a flat `RagItem[]` for the agentic
 * Routine Planner's retrieve step. Each item is a short natural-language
 * sentence so the embedder can score relevance against the day's goals.
 *
 * Sources:
 *   - durable memory facts (long-horizon — beyond the 14-day window below)
 *   - last 14 days of behaviour events (block_completed, reflection_completed,
 *     food_logged, transaction_synced, etc.)
 *   - last 7 reflections (per-block reviews + mood)
 *   - the most recent blood report summary (truncated)
 *
 * Durable facts (from the consolidation pass) are prepended so relevant
 * long-term signal isn't crowded out by the recent-window cap; the agent's
 * `retrieveTopK` then ranks the whole pool against the day's query. This is how
 * the planner "remembers" things older than 14 days.
 *
 * The function is sync where the DB layer is sync and async where async —
 * matches the existing pattern so callers don't pay an unnecessary tick.
 *
 * Returns at most ~30 recent items + up to a dozen durable facts.
 */

import type { RagItem } from './rag/retrieve';
import { getEventsLastNDays } from '@/db/queries/behaviour';
import { getRecentReflections } from '@/db/queries/reflections';
import { getBloodReports } from '@/db/queries/health';
import { getFactsByUser, isFactLive } from './rag/memoryStore';
import { useUserStore } from '@/store/useUserStore';

const MAX_ITEMS = 30;
/** Durable facts are few and high-signal; a dozen is plenty per assembly. */
const MEMORY_FACT_LIMIT = 12;

export function buildHistoryContext(): RagItem[] {
  const items: RagItem[] = [];

  try {
    const reflections = getRecentReflections(7);
    for (const r of reflections) {
      const reviewSummary = summarizeBlockReviews(r.blockReviews);
      const moodLabel = MOOD_LABELS[r.mood ?? 0] ?? '';
      const sentence = [
        `On ${r.date}`,
        moodLabel ? `felt ${moodLabel}` : '',
        reviewSummary,
      ]
        .filter(Boolean)
        .join(' — ');
      if (sentence.trim()) {
        items.push({ id: `reflect:${r.date}`, text: sentence });
      }
    }
  } catch {
    // Reflections table might be empty / unavailable; skip.
  }

  try {
    const events = getEventsLastNDays(14);
    const grouped = groupEventsByDay(events);
    for (const [date, summary] of grouped) {
      items.push({ id: `behaviour:${date}`, text: `On ${date}: ${summary}` });
    }
  } catch {
    // Same here.
  }

  try {
    const reports = getBloodReports();
    const latest = reports[0];
    const summary = latest?.aiSummary;
    if (summary) {
      items.push({
        id: `blood:${latest.id}`,
        text: `Recent blood report (${latest.date?.slice(0, 10) ?? 'undated'}): ${summary.slice(0, 200)}`,
      });
    }
  } catch {
    // Blood reports unavailable; skip.
  }

  const recent = items.slice(0, MAX_ITEMS);

  // Prepend durable long-horizon facts (not subject to the recent-window cap).
  let factItems: RagItem[] = [];
  try {
    const userId = useUserStore.getState().userId;
    if (userId) {
      const now = Date.now();
      factItems = getFactsByUser(userId)
        .filter((f) => isFactLive(f, now))
        .sort((a, b) => b.salience - a.salience)
        .slice(0, MEMORY_FACT_LIMIT)
        .map((f) => ({ id: `memory:${f.id}`, text: f.text, metadata: { kind: f.kind } }));
    }
  } catch {
    // Memory store unavailable (web / fresh install); skip.
  }

  return [...factItems, ...recent];
}

const MOOD_LABELS: Record<number, string> = {
  1: 'rough',
  2: 'meh',
  3: 'okay',
  4: 'good',
  5: 'great',
};

function summarizeBlockReviews(reviews: Record<string, string>): string {
  const counts = { did: 0, skipped: 0, rescheduled: 0 } as Record<string, number>;
  for (const v of Object.values(reviews)) {
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const parts: string[] = [];
  if (counts.did) parts.push(`completed ${counts.did} block${counts.did === 1 ? '' : 's'}`);
  if (counts.skipped) parts.push(`skipped ${counts.skipped}`);
  if (counts.rescheduled) parts.push(`rescheduled ${counts.rescheduled}`);
  return parts.join(', ');
}

function groupEventsByDay(events: Array<{ eventType: string; module: string; createdAt: string }>): Map<string, string> {
  const byDay = new Map<string, Record<string, number>>();
  for (const ev of events) {
    const day = ev.createdAt.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, {});
    const dayMap = byDay.get(day)!;
    const key = `${ev.eventType}:${ev.module}`;
    dayMap[key] = (dayMap[key] ?? 0) + 1;
  }
  const result = new Map<string, string>();
  for (const [day, counts] of byDay) {
    const parts: string[] = [];
    for (const [key, n] of Object.entries(counts)) {
      const [evType, mod] = key.split(':');
      parts.push(`${n}× ${evType}${mod && mod !== 'goal' ? ` (${mod})` : ''}`);
    }
    result.set(day, parts.slice(0, 5).join(', '));
  }
  return result;
}
