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
  /** Titles of every node from root → current parent, in order. The real-AI path
   * uses this to avoid repeating concepts. Ignored by the mock (which uses the
   * parent title hash for variety instead). */
  pathHistory?: string[];
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

// --- Variety pool for the curated fallback -----------------------------------

type NodeTemplate = (p: string, seed: string, adj: string) => GeneratedNode;

// Deterministic hash — maps a parent title to a stable template index so the
// same node always produces the same child in the mock, while different nodes
// (at different depths or on different branches) produce different content.
function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    // (31 * h + char) as 32-bit integer: 31*h = (h<<5) - h, avoids Math.imul
    h = (((h << 5) - h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Six distinct "deeper" lenses — each zooms into a different angle of the
// parent concept. All reference `seed` in the title (tests assert this) and
// embed `p` (parentTitle) in the body so consecutive levels feel different.
const DEEPER_TEMPLATES: NodeTemplate[] = [
  (p, seed) => ({
    title: `The mechanism beneath ${seed}`,
    body: `What ${p} is really pointing at is a smaller, more universal rule doing the work. Naming that rule explicitly separates a practitioner from a teacher — and once you see it, you can transfer it to fields that look nothing like ${seed}.`,
    goDeeperHint: `the underlying invariant`,
    goSidewaysHint: `where else this rule appears`,
  }),
  (p, seed) => ({
    title: `Where ${seed} breaks unexpectedly`,
    body: `The edge cases of ${p} reveal what the normal cases hide. Every practitioner eventually hits the same two or three failure modes — and those failures point directly at the structural assumptions the whole system was built on.`,
    goDeeperHint: `the assumption causing the failure`,
    goSidewaysHint: `a field that solved this failure mode first`,
  }),
  (p, seed) => ({
    title: `The feedback loop in ${seed}`,
    body: `${p} only stabilises — or improves — because of a feedback loop most practitioners never consciously notice. Identifying that loop lets you intervene at the right point instead of pushing symptoms around indefinitely.`,
    goDeeperHint: `what breaks the loop`,
    goSidewaysHint: `control theory's version of this`,
  }),
  (p, seed) => ({
    title: `The expert blindspot in ${seed}`,
    body: `People deep in ${p} stop questioning the same assumption everyone else also stopped questioning. That blindspot is usually a convention that solved a problem nobody remembers — understanding it is the fastest shortcut to genuine novelty.`,
    goDeeperHint: `the forgotten problem it was solving`,
    goSidewaysHint: `where this blindspot costs the most`,
  }),
  (p, seed) => ({
    title: `The load-bearing constraint in ${seed}`,
    body: `Remove one constraint from ${p} and it either trivialises or stops functioning altogether. Constraints are often invisible until you try to eliminate them — the ones you cannot remove tell you something real about what the domain is actually optimising for.`,
    goDeeperHint: `which constraint is load-bearing`,
    goSidewaysHint: `design theory's view of productive constraints`,
  }),
  (p, seed) => ({
    title: `What compresses badly in ${seed}`,
    body: `If you had to explain ${p} in one sentence, what would you lose? That gap between the long version and the short version is usually where the interesting complexity lives — the part that resists reduction and keeps surprising even experts.`,
    goDeeperHint: `the irreducible core`,
    goSidewaysHint: `information theory's parallel`,
  }),
];

// Six distinct "sideways" lenses — each jumps to an adjacent concept with a
// different framing. All reference `adj` in the title (tests assert this) and
// embed `p` (parentTitle) in the body.
const SIDEWAYS_TEMPLATES: NodeTemplate[] = [
  (p, seed, adj) => ({
    title: `${seed} meets ${adj}`,
    body: `The patterns that make ${p} hard to master often show up — sharper, easier to study — in ${adj}. Borrowing one mental model across this gap is the quickest way to make both feel less mysterious.`,
    goDeeperHint: `the shared structural primitive`,
    goSidewaysHint: `a third field with the same shape`,
  }),
  (p, _seed, adj) => ({
    title: `How ${adj} solved ${p}'s core problem`,
    body: `${adj} encountered a version of the same challenge ${p} raises — earlier, and in a cleaner form — and arrived at a solution practitioners on the other side are still rediscovering. The solution does not transfer directly, but the framing does.`,
    goDeeperHint: `why direct transfer fails`,
    goSidewaysHint: `a third field still wrestling with this`,
  }),
  (p, _seed, adj) => ({
    title: `The structural twin in ${adj}`,
    body: `In ${adj}, there is a concept that plays exactly the same role ${p} plays here — same position in the system, same trade-offs, same failure modes. Seeing both at once makes the abstract structure concrete and transferable.`,
    goDeeperHint: `the trade-off that defines both`,
    goSidewaysHint: `where this structure breaks down`,
  }),
  (p, seed, adj) => ({
    title: `${adj}'s vocabulary for this idea`,
    body: `Every field names its core tensions differently, but the underlying dynamics repeat. What ${seed} calls ${p}, ${adj} has been arguing about under a different name — usually with a richer vocabulary for the edge cases that are hardest to describe.`,
    goDeeperHint: `the edge case that prompted the new name`,
    goSidewaysHint: `a third naming that splits the difference`,
  }),
  (p, seed, adj) => ({
    title: `${adj} took the other path`,
    body: `At the point where ${seed} settled on its current approach — visible in ${p} — ${adj} made a different choice. Tracing both from their common origin clarifies what each field actually optimises for, and what each had to sacrifice to get there.`,
    goDeeperHint: `what was sacrificed in the choice`,
    goSidewaysHint: `a hybrid approach someone has tried`,
  }),
  (p, _seed, adj) => ({
    title: `How ${adj} names the same tension`,
    body: `The tension inside ${p} is not unique — every mature field hits the same underlying problem and has had to name it. ${adj} arrived at its own label for the same dynamic, and its vocabulary for the edge cases is often sharper than what you find here.`,
    goDeeperHint: `the sharpest edge case in ${adj}'s framing`,
    goSidewaysHint: `a fourth field using a third name`,
  }),
];

/**
 * Curated fallback — never dead-ends, and varies by position so consecutive
 * taps feel different. When pathHistory is present (the normal runtime path),
 * the template index cycles by depth, guaranteeing no two consecutive nodes
 * in a chain share the same framing. When pathHistory is absent (tests, or
 * edge callers), falls back to a hash of the parent title.
 */
export function buildMockNode(input: RabbitHoleInput): GeneratedNode {
  const anchor = input.anchor.title;
  const seed = input.anchor.seedInterest || anchor;
  const adj = input.anchor.adjacentField || 'systems thinking';
  const p = input.parent.title;
  const templates = input.direction === 'deeper' ? DEEPER_TEMPLATES : SIDEWAYS_TEMPLATES;
  const idx = input.pathHistory != null
    ? input.pathHistory.length % templates.length   // sequential cycling by depth
    : hashCode(p) % templates.length;               // hash-based fallback
  return templates[idx]!(p, seed, adj);
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
