/**
 * "The frontier" pipeline (Explore redesign, slice 3).
 *
 * Replaces the Discover grid (which suggests *adjacent topics to add*) with the
 * single most fertile UNEXPLORED edge between two interests the user ALREADY
 * has. Novelty lives in the gap between things you know, not in another topic
 * on the pile. Unlike `suggestCrossDisciplineLink` — which is handed a fixed
 * pair chosen dumbly by the screen — here the MODEL ranks which gap is most
 * worth crossing across all interests, and may honestly return nothing.
 *
 * Pure guards + the mock builder are exported and unit-testable. The AI call
 * uses the project conventions (callAI + pickModel + extractJson + Zod + mock).
 */
import { z } from 'zod';
import { callAI } from '@/ai/client';
import { extractJson } from '@/ai/extractJson';
import { pickModel } from '@/ai/modelRouter';
import { FRONTIER_PROMPT } from '@/ai/prompts/polymath';

export const FrontierSchema = z.object({
  interestA: z.string().min(1),
  interestB: z.string().min(1),
  headline: z.string().min(3).max(80),
  insight: z.string().min(20).max(360),
  bridgeAction: z.string().min(8).max(200),
});
export type Frontier = z.infer<typeof FrontierSchema>;

// Model may legitimately answer "no honest edge exists" → frontier: null.
const FrontierResponseSchema = z.object({ frontier: FrontierSchema.nullable() });

export interface FrontierInterest {
  name: string;
  category: string;
  explorationDepth: string;
  recentMinutes: number;
}

export interface FrontierSignal {
  interests: FrontierInterest[];
}

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

const HYPE_PATTERNS = [
  /\bfascinating\b/i,
  /\bamazing\b/i,
  /\bincredible\b/i,
  /where .* meets .*/i, // "where art meets science" cliche
  /\bjourney\b/i,
  /\bdive (deep|in)\b/i,
];

/**
 * Validate a frontier against the real signal: both interests must be real and
 * DISTINCT, and the copy must clear the anti-hype bar. Exported for testing.
 */
export function isValidFrontier(f: Frontier, interestNames: Set<string>): boolean {
  if (!interestNames.has(f.interestA) || !interestNames.has(f.interestB)) return false;
  if (f.interestA === f.interestB) return false;
  const haystack = `${f.headline} ${f.insight} ${f.bridgeAction}`;
  return !HYPE_PATTERNS.some((re) => re.test(haystack));
}

/** Pick the two most-developed interests from different categories, else the two most-developed overall. */
function pickFrontierPair(interests: FrontierInterest[]): [FrontierInterest, FrontierInterest] | null {
  if (interests.length < 2) return null;
  // Rank by footing: depth weight + recent time.
  const depthWeight: Record<string, number> = { taste: 1, hobbyist: 2, deep_dive: 3 };
  const ranked = [...interests].sort(
    (a, b) =>
      (depthWeight[b.explorationDepth] ?? 1) + b.recentMinutes / 60 -
      ((depthWeight[a.explorationDepth] ?? 1) + a.recentMinutes / 60),
  );
  const top = ranked[0]!;
  // Prefer a partner in a different category.
  const partner = ranked.slice(1).find((i) => i.category !== top.category) ?? ranked[1]!;
  return [top, partner];
}

/**
 * Mock / fallback builder. Derives a grounded-looking frontier from the two
 * best-developed interests so mock mode stays personalised. Returns null when
 * there aren't two interests to bridge.
 */
export function buildMockFrontier(input: FrontierSignal): Frontier | null {
  const pair = pickFrontierPair(input.interests);
  if (!pair) return null;
  const [a, b] = pair;
  return {
    interestA: a.name,
    interestB: b.name,
    headline: `The shared structure of ${a.name} and ${b.name}`,
    insight:
      `${a.name} and ${b.name} both turn on how a system handles constraint under pressure — ` +
      `a pattern you've built intuition for in ${a.name} but never carried across to ${b.name}.`,
    bridgeAction:
      `Spend 45 minutes mapping one principle from ${a.name} onto ${b.name}, and write the single paragraph where it holds.`,
  };
}

/**
 * Generate the user's frontier. Mock-first; on the live path validates the
 * schema and the real-interest/anti-hype guards. An honest null (no edge) is
 * passed through; a malformed-but-non-null response falls back to the grounded
 * mock rather than surfacing weak content.
 */
export async function generateFrontier(input: FrontierSignal): Promise<Frontier | null> {
  if (isMock()) return buildMockFrontier(input);
  if (input.interests.length < 2) return null;

  try {
    const response = await callAI({
      system: FRONTIER_PROMPT,
      model: pickModel('frontier'),
      cacheSystem: true,
      task: 'frontier',
      maxTokens: 500,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    });
    const parsed = FrontierResponseSchema.parse(extractJson(response));
    if (parsed.frontier === null) return null; // honest "no edge" — respect it
    const interestNames = new Set(input.interests.map((i) => i.name));
    return isValidFrontier(parsed.frontier, interestNames)
      ? parsed.frontier
      : buildMockFrontier(input);
  } catch {
    return buildMockFrontier(input); // parse/network failure → grounded fallback
  }
}
