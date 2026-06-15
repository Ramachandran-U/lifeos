/**
 * Rabbit-hole branching node generator (Explore v2, in-app exploration loop).
 *
 * The user pulls a thread from a spark and walks down a chain of small,
 * connected concepts — each ~30 seconds — choosing "Go deeper" (drill into the
 * same idea) or "Branch sideways" (jump to an adjacent concept). This module
 * generates ONE next node given the parent + direction + anchor (original spark).
 *
 * Mock-first, hard quality guards (anti-filler, real substance, non-empty
 * hints), curated fallback so a "pull thread" tap never dead-ends.
 */
import { z } from 'zod';
import { callAI } from '@/ai/client';
import { extractJson } from '@/ai/extractJson';
import { pickModel } from '@/ai/modelRouter';
import { RABBIT_HOLE_NODE_PROMPT } from '@/ai/prompts/polymath';

export const GeneratedNodeSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(20),
  goDeeperHint: z.string().min(2),
  goSidewaysHint: z.string().min(2),
});
export type GeneratedNode = z.infer<typeof GeneratedNodeSchema>;

export type RabbitHoleDirection = 'deeper' | 'sideways';

export interface RabbitHoleInput {
  parent: { title: string; body: string };
  /** The original spark that started this thread — keeps wanderings tethered. */
  anchor: { title: string; seedInterest?: string; adjacentField?: string };
  direction: RabbitHoleDirection;
  /**
   * Exploration mode. 'dive' = stay within ONE idea (sideways = a sibling facet
   * of the SAME topic, breadth-in-idea); 'bridge'/undefined = cross-discipline
   * (sideways jumps to an adjacent field). Defaults to bridge for back-compat.
   */
  mode?: 'dive' | 'bridge';
  /** Hop depth of the node being generated (root = 0). Lets the curated fallback
   *  vary by level so a run of AI misses never renders the same card twice, and
   *  gives the live model an explicit "how deep am I" signal. */
  depth?: number;
}

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

const FILLER_PATTERNS = [
  /everything is connected/i,
  /\bdid you know\b/i,
  /stay curious/i,
  /the possibilities are endless/i,
  /\bunlock your potential\b/i,
];

/** A node has real substance and concrete hints, not generic filler. */
export function isConcreteNode(n: GeneratedNode): boolean {
  if (n.title.trim().length < 3 || n.title.trim().length > 80) return false;
  if (n.body.trim().length < 40) return false;
  if (n.goDeeperHint.trim().length < 2 || n.goSidewaysHint.trim().length < 2) return false;
  const haystack = `${n.title} ${n.body}`;
  return !FILLER_PATTERNS.some((re) => re.test(haystack));
}

// Depth-rotated framings so consecutive fallback nodes never read identically,
// even when the live AI path repeatedly misses. (The bug this fixes: a static,
// anchor-only mock rendered the SAME card at every depth — "go deeper" showed
// the depth-1 result again.) Each frame supplies a distinct title + lead so both
// the heading AND the body change hop-to-hop.
const DEEPER_FRAMES: { title: (t: string) => string; lead: (t: string) => string }[] = [
  { title: (t) => `The mechanism beneath ${t}`, lead: (t) => `Under "${t}" sits a smaller, more universal rule doing the real work` },
  { title: (t) => `What actually drives ${t}`, lead: (t) => `Strip the surface off "${t}" and one driver is doing most of the lifting` },
  { title: (t) => `The hidden constraint in ${t}`, lead: (t) => `Every version of "${t}" bends around one constraint people rarely name` },
  { title: (t) => `The smallest rule behind ${t}`, lead: (t) => `The whole of "${t}" collapses to one rule small enough to carry anywhere` },
  { title: (t) => `One level under ${t}`, lead: (t) => `Go one level under "${t}" and the moving parts get simpler, not noisier` },
];
const SIDEWAYS_FRAMES: { title: (t: string, a: string) => string; lead: (t: string, a: string) => string }[] = [
  { title: (t, a) => `${t} meets ${a}`, lead: (t, a) => `The pattern that makes "${t}" hard to master shows up — sharper — in ${a}` },
  { title: (t, a) => `${t}, seen through ${a}`, lead: (t, a) => `Look at "${t}" through ${a} and the parts that felt arbitrary start to line up` },
  { title: (t, a) => `${a}'s version of ${t}`, lead: (t, a) => `${a} solved a problem shaped exactly like "${t}", just with different words` },
  { title: (t, a) => `Where ${t} and ${a} rhyme`, lead: (t, a) => `"${t}" and ${a} rhyme structurally; borrowing one model across the gap clarifies both` },
];
// Dive-mode sideways: stay INSIDE the one idea — a sibling facet / sub-topic, not
// a jump to another discipline. This is what makes a "Dive" breadth-within-one-idea
// rather than the cross-discipline wander a spark/frontier seeds.
const DIVE_SIDEWAYS_FRAMES: { title: (t: string) => string; lead: (t: string) => string }[] = [
  { title: (t) => `Another face of ${t}`, lead: (t) => `Step sideways within "${t}" to a sibling idea most accounts never connect to it` },
  { title: (t) => `A quieter corner of ${t}`, lead: (t) => `Inside "${t}" sits a less-told sub-topic that rewards a closer look` },
  { title: (t) => `${t}, from a new angle`, lead: (t) => `The same "${t}" reads differently from an angle the mainstream version skips` },
  { title: (t) => `The edge of ${t}`, lead: (t) => `At the edge of "${t}" is a related thread that widens the whole picture without leaving it` },
];

/** Reduce a parent title to its core concept (strip our own framings) and bound
 * its length, so chained fallbacks stay readable and don't nest prefixes. */
function coreTopic(title: string): string {
  let t = title
    .trim()
    .replace(/^(the mechanism beneath|what actually drives|the hidden constraint in|the smallest rule behind|one level under)\s+/i, '')
    .replace(/^where\s+(.+?)\s+and\s+.+?\s+rhyme$/i, '$1')
    .replace(/,?\s*seen through .*/i, '')
    .replace(/\s+meets\s+.*/i, '')
    .replace(/^.+?'s version of\s+/i, '')
    .trim();
  if (!t) t = title.trim();
  return t.length > 42 ? `${t.slice(0, 41).trimEnd()}…` : t;
}

const cap = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Curated fallback so a "pull thread" tap never dead-ends. Built from the PARENT
 * node (which changes each hop) and a depth-rotated framing — NOT just the static
 * anchor — so going deeper always yields a distinct card even on a run of AI
 * misses. Stays tethered to the anchor in the body.
 */
export function buildMockNode(input: RabbitHoleInput): GeneratedNode {
  const depth = Math.max(0, Math.floor(input.depth ?? 0));
  const topic = coreTopic(input.parent.title || input.anchor.title);
  const anchor = cap(input.anchor.title, 48);
  const adj = cap(input.anchor.adjacentField || 'systems thinking', 36);
  if (input.direction === 'deeper') {
    const f = DEEPER_FRAMES[depth % DEEPER_FRAMES.length];
    return {
      title: f.title(topic),
      body: `${f.lead(topic)}. Naming it is often what separates a practitioner from a teacher — and once you see it here, you can carry it back toward ${anchor} and into fields that look nothing like it.`,
      goDeeperHint: `the invariant inside ${topic}`,
      goSidewaysHint: `where else this rule shows up`,
    };
  }
  // Dive mode: a sibling facet of the SAME topic (breadth within one idea).
  if (input.mode === 'dive') {
    const f = DIVE_SIDEWAYS_FRAMES[depth % DIVE_SIDEWAYS_FRAMES.length];
    return {
      title: f.title(topic),
      body: `${f.lead(topic)}. It stays inside ${anchor} — widening the idea without leaving it.`,
      goDeeperHint: `the core mechanism of ${topic}`,
      goSidewaysHint: `another facet of ${topic}`,
    };
  }
  // Bridge/default mode: cross to the adjacent field that shares structure.
  const f = SIDEWAYS_FRAMES[depth % SIDEWAYS_FRAMES.length];
  return {
    title: f.title(topic, adj),
    body: `${f.lead(topic, adj)}. Borrowing one model across that gap makes both clearer, without losing the thread back to ${anchor}.`,
    goDeeperHint: `the shared structural primitive`,
    goSidewaysHint: `a third field with the same shape`,
  };
}

/** Generate the next rabbit-hole node. Mock-first; rejects weak output to a curated fallback. */
export async function generateRabbitHoleNode(input: RabbitHoleInput): Promise<GeneratedNode> {
  if (isMock()) return buildMockNode(input);

  let candidate: GeneratedNode | null = null;
  try {
    const response = await callAI({
      system: RABBIT_HOLE_NODE_PROMPT,
      model: pickModel('generateRabbitHoleNode'),
      cacheSystem: true,
      task: 'generateRabbitHoleNode',
      maxTokens: 450,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    });
    candidate = GeneratedNodeSchema.parse(extractJson(response));
  } catch {
    candidate = null;
  }

  if (candidate && isConcreteNode(candidate)) return candidate;
  return buildMockNode(input); // never dead-end
}
