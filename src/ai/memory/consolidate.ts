/**
 * Memory consolidation pass — the "each night, copy the lasting bits into the
 * diary" step. Reads the recent window (behaviour events + reflections),
 * summarises it with ONE AI call into durable facts, and upserts them into the
 * memory store (which dedups + embeds). Closes the LEARN side of the loop for
 * long-horizon memory.
 *
 * Runs out-of-band (end-of-day / app-open) — no background daemon (RN has no
 * reliable cron). Pure orchestrator core with injected deps for testing; the
 * live adapter wires real queries + AI.
 */
import { z } from 'zod';
import { format, subDays } from 'date-fns';
import { callAI } from '../client';
import { extractJson } from '../extractJson';
import { pickModel } from '../modelRouter';
import { CONSOLIDATE_MEMORY_PROMPT } from '../prompts/memory';
import { getEventsLastNDays } from '@/db/queries/behaviour';
import { getRecentReflections } from '@/db/queries/reflections';
import { upsertFact, isEmbeddingSuppressed, type MemoryFactKind } from '../rag/memoryStore';
import { embedText } from '../rag/embed';
import { getRecentDaySummaries } from '@/db/queries/daySummaries';
import { isEpisodicMemoryEnabled } from '../episodic/daySummary';

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

export const ConsolidatedFactsSchema = z.object({
  facts: z
    .array(
      z.object({
        kind: z.enum(['preference', 'pattern', 'milestone', 'constraint']),
        text: z.string().min(1).max(200),
      }),
    )
    .max(5),
});

export type ConsolidatedFact = { kind: MemoryFactKind; text: string };

export interface ConsolidateDeps {
  /** Compact text summary of the window to consolidate. Empty string = skip. */
  gatherSignal: () => string;
  /** Summarise the window into durable facts. */
  consolidate: (signalText: string) => Promise<ConsolidatedFact[]>;
  /** Persist one fact (dedups + embeds). */
  upsert: (fact: ConsolidatedFact) => Promise<void>;
  /** Optional: skip a proposed fact the user has previously deleted (tombstone). */
  shouldSuppress?: (fact: ConsolidatedFact) => Promise<boolean>;
}

export interface ConsolidateResult {
  written: number;
  facts: ConsolidatedFact[];
}

/** Pure orchestrator: gather → summarise → (skip suppressed) → upsert. */
export async function runConsolidation(deps: ConsolidateDeps): Promise<ConsolidateResult> {
  const signal = deps.gatherSignal();
  if (!signal.trim()) return { written: 0, facts: [] };

  const proposed = await deps.consolidate(signal);
  const written: ConsolidatedFact[] = [];
  for (const f of proposed) {
    if (deps.shouldSuppress && (await deps.shouldSuppress(f))) continue;
    await deps.upsert(f);
    written.push(f);
  }
  return { written: written.length, facts: written };
}

/**
 * Build the compact window summary from behaviour events + reflections, plus
 * (when episodic memory is on) the most recent day-summary narratives —
 * qualitative texture the count lines can't carry. `episodes` is pre-fetched
 * by the caller: the day-summary store is async while this stays sync.
 */
function buildWindowSignal(
  windowDays: number,
  episodes: Array<{ date: string; summary: string }> = [],
): string {
  const lines: string[] = [];

  for (const ep of episodes.slice(0, 7)) {
    lines.push(`Day ${ep.date}: ${ep.summary.slice(0, 200)}`);
  }

  try {
    const events = getEventsLastNDays(windowDays);
    const counts: Record<string, number> = {};
    for (const ev of events) {
      // Decisions carry their verb in metadata.action — surface it, or the
      // signal collapses every choice into an opaque "N× decision".
      let type = ev.eventType;
      if (type === 'decision' && ev.metadata) {
        try {
          const action = (JSON.parse(ev.metadata) as { action?: string }).action;
          if (action) type = `decision:${action}`;
        } catch {
          /* keep the bare type */
        }
      }
      const key = `${type}${ev.module && ev.module !== 'goal' ? ` (${ev.module})` : ''}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    for (const [key, n] of Object.entries(counts)) lines.push(`${n}× ${key}`);
  } catch {
    /* table may be empty/unavailable */
  }

  try {
    for (const r of getRecentReflections(windowDays)) {
      const reviews = r.blockReviews ?? {};
      const skipped = Object.values(reviews).filter((v) => v === 'skipped').length;
      const did = Object.values(reviews).filter((v) => v === 'did').length;
      lines.push(
        `Reflection ${r.date}: mood ${r.mood ?? '?'}/5, completed ${did}, skipped ${skipped}` +
          (r.notes ? ` — note: ${r.notes.slice(0, 120)}` : ''),
      );
    }
  } catch {
    /* reflections may be empty/unavailable */
  }

  return lines.join('\n');
}

/** AI summarisation with Zod validation; returns [] on parse failure (never throws). */
async function consolidateViaAI(signalText: string): Promise<ConsolidatedFact[]> {
  if (isMock()) {
    return [{ kind: 'pattern', text: 'They consistently complete morning focus blocks.' }];
  }
  try {
    const response = await callAI({
      system: CONSOLIDATE_MEMORY_PROMPT,
      messages: [{ role: 'user', content: signalText }],
      model: pickModel('consolidateMemory'),
      cacheSystem: true,
      task: 'consolidateMemory',
    });
    return ConsolidatedFactsSchema.parse(extractJson(response)).facts;
  } catch {
    // A consolidation failure must never break the app — just record nothing.
    return [];
  }
}

export interface ConsolidateMemoryOptions {
  /** How many days of history to consolidate. Default 30. */
  windowDays?: number;
  /** Today, YYYY-MM-DD, for the recorded source window. Defaults to today. */
  today?: string;
}

/** Live entry point. Call from end-of-day / app-open. */
export async function consolidateMemory(
  userId: string,
  opts: ConsolidateMemoryOptions = {},
): Promise<ConsolidateResult> {
  const windowDays = opts.windowDays ?? 30;
  const today = opts.today ?? format(new Date(), 'yyyy-MM-dd');
  const sourceWindow = `${format(subDays(new Date(today), windowDays), 'yyyy-MM-dd')}..${today}`;

  // Episodic texture (flag `episodic_memory`): pre-fetch the last week of
  // day-summary narratives for the (sync) signal builder. Never fatal.
  let episodes: Array<{ date: string; summary: string }> = [];
  try {
    if (isEpisodicMemoryEnabled()) {
      episodes = (await getRecentDaySummaries(userId, 7)).map((s) => ({
        date: s.date,
        summary: s.summary,
      }));
    }
  } catch {
    /* episodic store unavailable — consolidate from counts alone */
  }

  // Embed each proposed fact's text only once, shared between the suppression
  // check and the upsert (both need the same embedding).
  const embedCache = new Map<string, number[]>();
  const embedOnce = async (text: string): Promise<number[]> => {
    let e = embedCache.get(text);
    if (!e) {
      e = await embedText(text);
      embedCache.set(text, e);
    }
    return e;
  };

  return runConsolidation({
    gatherSignal: () => buildWindowSignal(windowDays, episodes),
    consolidate: consolidateViaAI,
    shouldSuppress: async (fact) => isEmbeddingSuppressed(userId, await embedOnce(fact.text)),
    upsert: async (fact) => {
      await upsertFact({ userId, kind: fact.kind, text: fact.text, sourceWindow }, undefined, await embedOnce(fact.text));
    },
  });
}
