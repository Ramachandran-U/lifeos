/**
 * Daily Spark pipeline (Explore v2, step 2).
 *
 * One AI-generated, ~2-minute curiosity hit per day, grounded in a real
 * interest and stretched to an adjacent field. Quality is the whole product —
 * generic filler erodes trust fast — so the AI output passes hard guards
 * (specificity, anti-filler, dedup) and falls back to a curated spark rather
 * than ever showing nothing.
 *
 * Pure guards + seed selection are exported and unit-tested. The AI call uses
 * the project conventions (callAI + pickModel + extractJson + Zod + mock).
 */
import { z } from 'zod';
import { callAI } from '@/ai/client';
import { extractJson } from '@/ai/extractJson';
import { pickModel } from '@/ai/modelRouter';
import { DAILY_SPARK_PROMPT } from '@/ai/prompts/polymath';

export const GeneratedSparkSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(20),
  threadStarter: z.string().min(5),
  seedInterest: z.string().default(''),
  adjacentField: z.string().default(''),
});
export type GeneratedSpark = z.infer<typeof GeneratedSparkSchema>;

export interface SparkInterest { name: string; category: string }

export type SparkStatus = 'new' | 'seen' | 'saved' | 'dismissed' | 'explored';

/** A spark persisted for a user on a given day. */
export interface Spark extends GeneratedSpark {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: SparkStatus;
  threadId: string | null; // set when the user pulls the thread into a rabbit hole
  createdAt: string;
}

export interface DailySparkInput {
  interests: SparkInterest[];
  /** Titles of recently-shown sparks — used for in-prompt + post-hoc dedup. */
  recentSparkTitles: string[];
  profileSummary?: string;
}

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

// Filler phrases that signal a low-quality, generic spark. The whole feature
// dies on trust if we ship these, so they are a hard reject.
const FILLER_PATTERNS = [
  /everything is connected/i,
  /\bdid you know\b/i,
  /stay curious/i,
  /the possibilities are endless/i,
  /\bunlock your potential\b/i,
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** A spark is concrete when it has real substance and a proper thread question, and isn't filler. */
export function isConcreteSpark(s: GeneratedSpark): boolean {
  if (s.title.trim().length < 3 || s.title.trim().length > 80) return false;
  if (s.body.trim().length < 40) return false; // needs real substance
  if (!s.threadStarter.trim().endsWith('?')) return false;
  const haystack = `${s.title} ${s.body} ${s.threadStarter}`;
  return !FILLER_PATTERNS.some((re) => re.test(haystack));
}

/** True when this title hasn't been shown recently (case/space-insensitive). */
export function isFreshSpark(title: string, recentTitles: string[]): boolean {
  const seen = new Set(recentTitles.map(norm));
  return !seen.has(norm(title));
}

/** Pick up to two interests to seed the spark, rotating by day so it varies. */
export function pickSparkSeeds(interests: SparkInterest[], dayIndex: number): SparkInterest[] {
  if (interests.length === 0) return [];
  if (interests.length <= 2) return interests;
  const a = interests[dayIndex % interests.length]!;
  const b = interests[(dayIndex + 1) % interests.length]!;
  return [a, b];
}

/** Curated fallback so the user never sees an empty or rejected spark. */
export function buildMockSpark(input: DailySparkInput, dayIndex = 0): GeneratedSpark {
  const seeds = pickSparkSeeds(input.interests, dayIndex);
  const seed = seeds[0]?.name ?? 'your curiosity';
  const stretch = seeds[1]?.name ?? 'systems thinking';
  const pool: GeneratedSpark[] = [
    {
      title: `${seed}, seen through ${stretch}`,
      body: `The constraints that make ${seed} hard are often the same constraints studied formally in ${stretch}. Borrowing one idea across the gap tends to dissolve a problem you'd been brute-forcing.`,
      threadStarter: `What is one rule in ${seed} that might just be a special case of something in ${stretch}?`,
      seedInterest: seed,
      adjacentField: stretch,
    },
    {
      title: `The hidden grammar of ${seed}`,
      body: `Most skilled practitioners of ${seed} follow a structure they could never articulate — a grammar learned by feel. Naming that grammar explicitly is often what separates a hobbyist from someone who can teach it.`,
      threadStarter: `If you had to write down the three unspoken rules of ${seed}, what would the first one be?`,
      seedInterest: seed,
      adjacentField: stretch,
    },
  ];
  return pool[dayIndex % pool.length]!;
}

/**
 * Generate today's spark. Mock-first; on the live path, validates the schema
 * and runs the quality + freshness guards, falling back to a curated spark
 * rather than surfacing weak or duplicate content.
 */
export async function generateDailySpark(input: DailySparkInput, dayIndex = 0): Promise<GeneratedSpark> {
  if (isMock()) return buildMockSpark(input, dayIndex);

  let candidate: GeneratedSpark | null = null;
  try {
    const response = await callAI({
      system: DAILY_SPARK_PROMPT,
      model: pickModel('generateDailySpark'),
      cacheSystem: true,
      task: 'generateDailySpark',
      maxTokens: 500,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            interests: pickSparkSeeds(input.interests, dayIndex),
            recentSparkTitles: input.recentSparkTitles.slice(0, 10),
            profileSummary: input.profileSummary ?? '',
          }),
        },
      ],
    });
    candidate = GeneratedSparkSchema.parse(extractJson(response));
  } catch {
    candidate = null; // parse/network failure → curated fallback below
  }

  if (candidate && isConcreteSpark(candidate) && isFreshSpark(candidate.title, input.recentSparkTitles)) {
    return candidate;
  }
  return buildMockSpark(input, dayIndex); // never show nothing
}
