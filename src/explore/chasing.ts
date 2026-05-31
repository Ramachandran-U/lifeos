/**
 * "Chasing now" pipeline (Explore redesign, slice 1).
 *
 * Replaces the day-rotated random Spark with 1-3 *live questions* the user is
 * already circling — each grounded in and DEFENDED by their real signal
 * (interests + the exploration sessions they actually logged, including their
 * own notes). The model must cite the evidence and may return nothing when the
 * signal is too thin: an honest empty answer beats a fabricated one.
 *
 * Pure guards + the mock builder are exported and unit-testable. The AI call
 * uses the project conventions (callAI + pickModel + extractJson + Zod + mock).
 */
import { z } from 'zod';
import { callAI } from '@/ai/client';
import { extractJson } from '@/ai/extractJson';
import { pickModel } from '@/ai/modelRouter';
import { CHASING_NOW_PROMPT } from '@/ai/prompts/polymath';

export const ChasingThreadSchema = z.object({
  question: z.string().min(8).max(160),
  rationale: z.string().min(8).max(280),
  seedInterest: z.string().min(1),
});
export type ChasingThread = z.infer<typeof ChasingThreadSchema>;

const ChasingNowSchema = z.object({ threads: z.array(ChasingThreadSchema) });

export interface ChasingInterest {
  name: string;
  category: string;
  explorationDepth: string;
}

export interface ChasingExploration {
  interest: string;
  minutes: number;
  notes?: string;
  daysAgo: number;
}

export interface ChasingSignal {
  interests: ChasingInterest[];
  recentExploration: ChasingExploration[];
}

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

// Hype/filler words that signal a low-quality, generic thread. The feature
// dies on trust if we ship these, so they are a hard reject.
const HYPE_PATTERNS = [
  /\bfascinating\b/i,
  /\bamazing\b/i,
  /\bincredible\b/i,
  /\bmind-?blowing\b/i,
  /\bjourney\b/i,
  /\bdive (deep|in)\b/i,
];

/** A thread is concrete when it asks a real question and isn't hype/filler. */
export function isConcreteThread(t: ChasingThread): boolean {
  if (!t.question.trim().endsWith('?')) return false;
  if (t.rationale.trim().length < 8) return false;
  const haystack = `${t.question} ${t.rationale}`;
  return !HYPE_PATTERNS.some((re) => re.test(haystack));
}

/**
 * Mock / fallback builder. Derives grounded-looking threads from the real
 * signal so mock mode still feels personalised. Returns [] when there's no
 * interest to anchor on — the screen renders nothing in that case.
 */
export function buildMockChasing(input: ChasingSignal): ChasingThread[] {
  const top = input.interests.slice(0, 2);
  if (top.length === 0) return [];
  return top.map((i) => {
    const logged = input.recentExploration.filter((e) => e.interest === i.name);
    const mins = logged.reduce((a, e) => a + e.minutes, 0);
    const rationale = mins > 0
      ? `You've logged ${mins} min on ${i.name} recently — there's an open question underneath that you keep circling.`
      : `You marked ${i.name} as ${i.explorationDepth} but haven't pushed past the surface lately.`;
    return {
      question: `What is the one idea in ${i.name} you keep returning to but haven't pinned down?`,
      rationale,
      seedInterest: i.name,
    };
  });
}

/**
 * Generate the user's live "chasing" threads. Mock-first; on the live path,
 * validates the schema and runs the anti-hype guard, falling back to the
 * grounded mock rather than surfacing weak content. An empty array is a valid
 * result (thin signal) and is passed through unchanged.
 */
export async function generateChasingNow(input: ChasingSignal): Promise<ChasingThread[]> {
  if (isMock()) return buildMockChasing(input);
  if (input.interests.length === 0) return [];

  try {
    const response = await callAI({
      system: CHASING_NOW_PROMPT,
      model: pickModel('chasingNow'),
      cacheSystem: true,
      task: 'chasingNow',
      maxTokens: 600,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    });
    const parsed = ChasingNowSchema.parse(extractJson(response));
    const interestNames = new Set(input.interests.map((i) => i.name));
    const clean = parsed.threads
      .filter(isConcreteThread)
      // seedInterest must be a real interest — drop hallucinated anchors.
      .filter((t) => interestNames.has(t.seedInterest))
      .slice(0, 3);
    // If the model honestly returned nothing, respect that. Only fall back to
    // the mock when parsing produced threads that all failed the guards.
    if (parsed.threads.length === 0) return [];
    return clean.length > 0 ? clean : buildMockChasing(input);
  } catch {
    return buildMockChasing(input); // parse/network failure → grounded fallback
  }
}
