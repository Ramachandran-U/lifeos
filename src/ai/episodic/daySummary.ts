/**
 * Day-summary generation — the WRITE side of episodic memory.
 *
 * Once per day (piggybacked on evening-reflect, like consolidation — RN has no
 * reliable cron) this distils the day's raw signal into one narrative
 * paragraph in `day_summaries`: blocks done/skipped, mood, the user's journal
 * note, and any decisions taken. behaviour_events can say "3× block_completed";
 * this record can say what the day was actually like — the substrate for
 * "what did last Tuesday look like?" recall, richer consolidation, and the
 * getRecentDays agent tool.
 *
 * One CHEAP-tier AI call; any failure falls back to a deterministic sentence
 * built from the stats, so a summary row always lands (source: 'fallback').
 * Gated by `episodic_memory` (default off) at the entry point.
 */
import { z } from 'zod';
import { format } from 'date-fns';
import { callAI } from '../client';
import { extractJson } from '../extractJson';
import { pickModel } from '../modelRouter';
import { SUMMARIZE_DAY_PROMPT } from '../prompts/episodic';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { getReflectionByDate } from '@/db/queries/reflections';
import { getEventsLastNDays } from '@/db/queries/behaviour';
import {
  upsertDaySummary,
  type DaySummaryStats,
} from '@/db/queries/daySummaries';
import { useFlagStore } from '@/store/useFlagStore';

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

const DaySummarySchema = z.object({ summary: z.string().min(1).max(500) });

const MOOD_LABELS: Record<number, string> = {
  1: 'rough',
  2: 'meh',
  3: 'okay',
  4: 'good',
  5: 'great',
};

export interface DaySignal {
  date: string;
  blocks: Array<{ title: string; module: string; status: string }>;
  mood: number | null;
  journal: string | null;
  decisions: string[];
}

/** Read the day's raw signal from local storage. Defensive: empty on failure. */
export function gatherDaySignal(date: string): DaySignal {
  let blocks: DaySignal['blocks'] = [];
  try {
    blocks = getRoutineBlocksByDate(date).map((b) => ({
      title: b.title,
      module: b.module,
      status: b.status,
    }));
  } catch {
    /* table unavailable */
  }

  let mood: number | null = null;
  let journal: string | null = null;
  try {
    const r = getReflectionByDate(date);
    mood = r?.mood ?? null;
    journal = r?.notes?.trim() ? r.notes.trim() : null;
  } catch {
    /* reflections unavailable */
  }

  let decisions: string[] = [];
  try {
    const daysBack = Math.max(
      1,
      Math.ceil((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86_400_000) + 1,
    );
    decisions = getEventsLastNDays(daysBack)
      .filter((e) => e.eventType === 'decision' && e.createdAt.slice(0, 10) === date)
      .map((e) => {
        try {
          return (JSON.parse(e.metadata ?? '{}') as { action?: string }).action ?? 'decision';
        } catch {
          return 'decision';
        }
      });
  } catch {
    /* behaviour unavailable */
  }

  return { date, blocks, mood, journal, decisions };
}

export function buildStats(signal: DaySignal): DaySummaryStats {
  return {
    blocksTotal: signal.blocks.length,
    blocksCompleted: signal.blocks.filter((b) => b.status === 'completed').length,
    blocksSkipped: signal.blocks.filter((b) => b.status === 'skipped').length,
    mood: signal.mood,
    decisions: signal.decisions,
    journalExcerpt: signal.journal ? signal.journal.slice(0, 200) : null,
  };
}

/** Is there anything worth recording? An untouched day writes no row. */
export function hasSignal(signal: DaySignal): boolean {
  return (
    signal.blocks.length > 0 ||
    signal.mood !== null ||
    signal.journal !== null ||
    signal.decisions.length > 0
  );
}

/** Compact prompt payload — titles and statuses, not raw rows. */
export function formatSignal(signal: DaySignal): string {
  const lines: string[] = [`Date: ${signal.date}`];
  for (const b of signal.blocks) {
    lines.push(`Block: ${b.title} (${b.module}) — ${b.status}`);
  }
  if (signal.mood !== null) {
    lines.push(`Mood: ${signal.mood}/5 (${MOOD_LABELS[signal.mood] ?? ''})`);
  }
  if (signal.journal) lines.push(`Journal: ${signal.journal.slice(0, 400)}`);
  for (const d of signal.decisions) lines.push(`Decision: ${d}`);
  return lines.join('\n');
}

/**
 * Deterministic summary from the stats alone — the always-works fallback so a
 * day's record never depends on the AI being reachable.
 */
export function fallbackSummary(signal: DaySignal): string {
  const stats = buildStats(signal);
  const parts: string[] = [];
  if (stats.blocksTotal > 0) {
    parts.push(
      `They completed ${stats.blocksCompleted} of ${stats.blocksTotal} planned blocks` +
        (stats.blocksSkipped > 0 ? ` and skipped ${stats.blocksSkipped}` : '') +
        '.',
    );
  }
  if (stats.mood !== null) {
    parts.push(`The day felt ${MOOD_LABELS[stats.mood] ?? `${stats.mood}/5`}.`);
  }
  if (signal.journal) {
    parts.push(`They noted: "${signal.journal.slice(0, 120)}".`);
  }
  if (stats.decisions.length > 0) {
    parts.push(`Decisions: ${stats.decisions.join(', ').replace(/_/g, ' ')}.`);
  }
  return parts.join(' ') || 'A quiet day with no recorded activity.';
}

async function summarizeViaAI(signal: DaySignal): Promise<string | null> {
  if (isMock()) {
    return 'They completed their morning focus block and a workout, and felt good about the day.';
  }
  try {
    const response = await callAI({
      system: SUMMARIZE_DAY_PROMPT,
      messages: [{ role: 'user', content: formatSignal(signal) }],
      model: pickModel('summarizeDay'),
      cacheSystem: true,
      task: 'summarizeDay',
    });
    return DaySummarySchema.parse(extractJson(response)).summary;
  } catch {
    return null; // caller falls back deterministically
  }
}

export interface GenerateDaySummaryResult {
  written: boolean;
  source?: 'ai' | 'fallback';
}

/** Generate + persist one day's summary. Skips silently on an empty day. */
export async function generateDaySummary(
  userId: string,
  date: string,
): Promise<GenerateDaySummaryResult> {
  const signal = gatherDaySignal(date);
  if (!hasSignal(signal)) return { written: false };

  const aiSummary = await summarizeViaAI(signal);
  const source: 'ai' | 'fallback' = aiSummary ? 'ai' : 'fallback';
  await upsertDaySummary({
    userId,
    date,
    summary: aiSummary ?? fallbackSummary(signal),
    stats: buildStats(signal),
    source,
  });
  return { written: true, source };
}

/** Is episodic memory on? Read per call — the Worker can flip it remotely. */
export function isEpisodicMemoryEnabled(): boolean {
  try {
    return useFlagStore.getState().isEnabled('episodic_memory');
  } catch {
    return false;
  }
}

/**
 * Flag-gated entry point for the evening-reflect piggyback. Never throws —
 * episodic memory is an observer of the day, never a blocker of the flow.
 */
export async function runDaySummaryForToday(userId: string, today?: string): Promise<void> {
  if (!isEpisodicMemoryEnabled()) return;
  try {
    await generateDaySummary(userId, today ?? format(new Date(), 'yyyy-MM-dd'));
  } catch {
    /* observer-only */
  }
}
