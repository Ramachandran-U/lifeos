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

/** Curated fallback so a "pull thread" tap never dead-ends. */
export function buildMockNode(input: RabbitHoleInput): GeneratedNode {
  const anchor = input.anchor.title;
  const seed = input.anchor.seedInterest || anchor;
  const adj = input.anchor.adjacentField || 'systems thinking';
  if (input.direction === 'deeper') {
    return {
      title: `The mechanism beneath ${seed}`,
      body: `Under every visible move in ${seed} there's a smaller, more universal rule doing the work. Naming that rule explicitly is often what separates a practitioner from a teacher — and once you see it, you can transfer it to fields that look nothing like ${seed}.`,
      goDeeperHint: `the underlying invariant`,
      goSidewaysHint: `where else this mechanism shows up`,
    };
  }
  return {
    title: `${seed} meets ${adj}`,
    body: `The patterns that make ${seed} hard to master often show up — sharper, easier to study — in ${adj}. Borrowing one mental model across this gap is the quickest way to make both feel less mysterious.`,
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
