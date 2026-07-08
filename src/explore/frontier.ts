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
 * The user can also steer it (frontier controls): shuffle to a different pair,
 * regenerate a new take on the same pair, pin either endpoint (including an
 * ad-hoc name not in their list), or drop the second endpoint entirely —
 * `interestB: null` means a SOLO frontier, an unexplored facet WITHIN one
 * interest. All of that flows through `FrontierConstraints`.
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
  // null = solo frontier: an unexplored facet within interestA alone.
  interestB: z.string().min(1).nullable(),
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

/**
 * User steering for a generation. All fields optional; absent = the model
 * ranks freely (the original behaviour).
 */
export interface FrontierConstraints {
  /** Pin endpoint A by exact name (may be an ad-hoc name not in the list). */
  pinA?: string;
  /**
   * Pin endpoint B. `null` is meaningful: solo mode — no second interest,
   * find the frontier WITHIN pinA (or the current interestA).
   */
  pinB?: string | null;
  /** Order-insensitive pairs already shown this session — pick a different one. */
  excludePairs?: Array<[string, string]>;
  /** Regenerate: keep the endpoints but avoid this take. */
  avoidHeadline?: string;
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

/** Order-insensitive key for a pair of interest names. */
export function frontierPairKey(a: string, b: string): string {
  return [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join('::');
}

const isSolo = (c?: FrontierConstraints) => c !== undefined && c.pinB === null;

/**
 * Return a signal that also carries any pinned names the user typed ad-hoc
 * (not in their interest list) so the model and the real-interest guard both
 * see them. Ad-hoc entries are NEVER persisted — they exist only inside this
 * one generation. Exported for testing.
 */
export function withAdHocInterests(
  input: FrontierSignal,
  constraints?: FrontierConstraints,
): FrontierSignal {
  const pinned = [constraints?.pinA, constraints?.pinB].filter(
    (n): n is string => typeof n === 'string' && n.trim().length > 0,
  );
  const known = new Set(input.interests.map((i) => i.name.toLowerCase()));
  const adHoc = pinned
    .filter((n) => !known.has(n.trim().toLowerCase()))
    .map((name) => ({
      name: name.trim(),
      category: 'other',
      explorationDepth: 'taste',
      recentMinutes: 0,
    }));
  return adHoc.length === 0 ? input : { interests: [...input.interests, ...adHoc] };
}

/**
 * Validate a frontier against the real signal AND the user's constraints:
 * endpoints must be real (post ad-hoc augmentation) and distinct, pins must be
 * respected, excluded pairs and an avoided headline must not come back, and
 * the copy must clear the anti-hype bar. Exported for testing.
 */
export function isValidFrontier(
  f: Frontier,
  interestNames: Set<string>,
  constraints?: FrontierConstraints,
): boolean {
  const haystack = `${f.headline} ${f.insight} ${f.bridgeAction}`;
  if (HYPE_PATTERNS.some((re) => re.test(haystack))) return false;
  if (!interestNames.has(f.interestA)) return false;

  if (isSolo(constraints)) {
    if (f.interestB !== null) return false;
  } else {
    const bName = f.interestB;
    if (bName === null) return false;
    if (!interestNames.has(bName)) return false;
    if (f.interestA === bName) return false;
    if (
      constraints?.excludePairs?.some(
        ([a, b]) => frontierPairKey(a, b) === frontierPairKey(f.interestA, bName),
      )
    ) {
      return false;
    }
    if (constraints?.pinB && bName !== constraints.pinB) return false;
  }

  if (constraints?.pinA && f.interestA !== constraints.pinA) return false;
  if (constraints?.avoidHeadline && f.headline === constraints.avoidHeadline) return false;
  return true;
}

/** Rank interests by footing: depth weight + recent time. */
function rankByFooting(interests: FrontierInterest[]): FrontierInterest[] {
  const depthWeight: Record<string, number> = { taste: 1, hobbyist: 2, deep_dive: 3 };
  return [...interests].sort(
    (a, b) =>
      (depthWeight[b.explorationDepth] ?? 1) + b.recentMinutes / 60 -
      ((depthWeight[a.explorationDepth] ?? 1) + a.recentMinutes / 60),
  );
}

/**
 * Pick the pair for the mock/fallback path, honouring pins and exclusions.
 * When every candidate pair has been excluded, wraps around to the best pair
 * rather than dead-ending — a repeat beats an empty card on a user-initiated
 * refresh.
 */
function pickFrontierPair(
  interests: FrontierInterest[],
  constraints?: FrontierConstraints,
): [FrontierInterest, FrontierInterest] | null {
  if (interests.length < 2) return null;
  const byName = (name: string) =>
    interests.find((i) => i.name.toLowerCase() === name.toLowerCase());

  // Both endpoints pinned — nothing to rank.
  if (constraints?.pinA && constraints.pinB) {
    const a = byName(constraints.pinA);
    const b = byName(constraints.pinB);
    return a && b && a.name !== b.name ? [a, b] : null;
  }

  const ranked = rankByFooting(interests);
  const excluded = new Set(
    (constraints?.excludePairs ?? []).map(([a, b]) => frontierPairKey(a, b)),
  );
  const allowed = (a: FrontierInterest, b: FrontierInterest) =>
    !excluded.has(frontierPairKey(a.name, b.name));

  // One endpoint pinned — rank partners for it.
  const pinnedName = constraints?.pinA ?? (constraints?.pinB || undefined);
  if (pinnedName) {
    const pinned = byName(pinnedName);
    if (!pinned) return null;
    const partners = ranked.filter((i) => i.name !== pinned.name);
    const partner =
      partners.find((i) => i.category !== pinned.category && allowed(pinned, i)) ??
      partners.find((i) => allowed(pinned, i)) ??
      partners[0];
    return partner ? [pinned, partner] : null;
  }

  // Free pick: best cross-category pair not yet shown, else best remaining overall.
  for (let i = 0; i < ranked.length; i++) {
    const top = ranked[i]!;
    const partner =
      ranked.slice(i + 1).find((p) => p.category !== top.category && allowed(top, p)) ??
      ranked.slice(i + 1).find((p) => allowed(top, p));
    if (partner) return [top, partner];
  }
  // Every pair excluded → wrap around to the original best pair.
  const top = ranked[0]!;
  const partner = ranked.slice(1).find((i) => i.category !== top.category) ?? ranked[1]!;
  return [top, partner];
}

/**
 * Mock / fallback builder. Derives a grounded-looking frontier from the
 * best-developed interests (honouring pins/exclusions/solo) so mock mode stays
 * personalised AND steerable. Returns null when the request can't be met.
 */
export function buildMockFrontier(
  input: FrontierSignal,
  constraints?: FrontierConstraints,
): Frontier | null {
  if (isSolo(constraints)) {
    const name = constraints?.pinA;
    if (!name) return null;
    const solo: Frontier = {
      interestA: name,
      interestB: null,
      headline: `The untouched edge of ${name}`,
      insight:
        `Inside ${name} there is a sub-territory you have circled but never entered — ` +
        `the part practitioners argue about rather than the part beginners are shown.`,
      bridgeAction: `Spend 45 minutes finding one open disagreement inside ${name} and write a paragraph on where you land.`,
    };
    return constraints?.avoidHeadline === solo.headline
      ? { ...solo, headline: `What ${name} looks like from inside` }
      : solo;
  }

  const pair = pickFrontierPair(input.interests, constraints);
  if (!pair) return null;
  const [a, b] = pair;
  const first: Frontier = {
    interestA: a.name,
    interestB: b.name,
    headline: `The shared structure of ${a.name} and ${b.name}`,
    insight:
      `${a.name} and ${b.name} both turn on how a system handles constraint under pressure — ` +
      `a pattern you've built intuition for in ${a.name} but never carried across to ${b.name}.`,
    bridgeAction:
      `Spend 45 minutes mapping one principle from ${a.name} onto ${b.name}, and write the single paragraph where it holds.`,
  };
  if (constraints?.avoidHeadline !== first.headline) return first;
  // Regenerate on the same pair → a second deterministic take.
  return {
    ...first,
    headline: `What ${b.name} borrows from ${a.name}`,
    insight:
      `Practitioners of ${b.name} quietly rely on a move that ${a.name} makes explicit — ` +
      `naming it would change how you practise both.`,
    bridgeAction: `Spend 30 minutes listing three moves from ${a.name} and hunting for each one inside ${b.name}.`,
  };
}

/**
 * Generate the user's frontier. Mock-first; on the live path validates the
 * schema and the real-interest/anti-hype/constraint guards. An honest null
 * (no edge) is passed through; a malformed-but-non-null response falls back
 * to the grounded mock rather than surfacing weak content.
 */
export async function generateFrontier(
  input: FrontierSignal,
  constraints?: FrontierConstraints,
): Promise<Frontier | null> {
  const signal = withAdHocInterests(input, constraints);
  if (isMock()) return buildMockFrontier(signal, constraints);
  const solo = isSolo(constraints);
  if (solo && !constraints?.pinA) return null;
  if (!solo && signal.interests.length < 2) return null;

  try {
    const response = await callAI({
      system: FRONTIER_PROMPT,
      model: pickModel('frontier'),
      cacheSystem: true,
      task: 'frontier',
      maxTokens: 500,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            ...signal,
            ...(constraints
              ? {
                  constraints: {
                    ...(constraints.pinA ? { mustUseA: constraints.pinA } : {}),
                    ...(typeof constraints.pinB === 'string' ? { mustUseB: constraints.pinB } : {}),
                    ...(solo ? { solo: true } : {}),
                    ...(constraints.excludePairs?.length
                      ? { avoidPairs: constraints.excludePairs }
                      : {}),
                    ...(constraints.avoidHeadline
                      ? { avoidHeadline: constraints.avoidHeadline }
                      : {}),
                  },
                }
              : {}),
          }),
        },
      ],
    });
    const parsed = FrontierResponseSchema.parse(extractJson(response));
    if (parsed.frontier === null) return null; // honest "no edge" — respect it
    const interestNames = new Set(signal.interests.map((i) => i.name));
    return isValidFrontier(parsed.frontier, interestNames, constraints)
      ? parsed.frontier
      : buildMockFrontier(signal, constraints);
  } catch {
    return buildMockFrontier(signal, constraints); // parse/network failure → grounded fallback
  }
}
