/**
 * Agentic "pull thread" (Explore redesign, slice 2).
 *
 * The single-shot rabbit-hole node (`generateRabbitHoleNode`) confabulates the
 * next idea from the model's weights with no knowledge of what the user has
 * actually explored. This path instead runs a tool-use loop: the model can read
 * the user's real interests, recent sparks, and expeditions, then produce a
 * next node grounded in that history. Same output shape (`GeneratedNode`) so it
 * is a drop-in for the rabbit-hole screen, gated by `exploreAgenticThread`.
 *
 * The agent returns its final answer as JSON; we parse + guard + fall back to
 * the curated mock node so a thread never dead-ends — mirroring the single-shot
 * pipeline's safety contract. The parse/guard step is a pure, tested function.
 */
import { pickModel } from '../modelRouter';
import { extractJson } from '../extractJson';
import { runToolAgent } from './runtime';
import { buildExploreTools } from './exploreTools';
import {
  GeneratedNodeSchema,
  isConcreteNode,
  buildMockNode,
  type GeneratedNode,
  type RabbitHoleInput,
} from '@/explore/rabbitHole';

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

const EXPLORE_THREAD_SYSTEM = `
You are LifeOS's Curiosity & Polymath Engine running as a tool-using agent. The user is pulling a thread on an idea and chose a direction. Produce ONE next "node" — a small, surprising, ~30-second concept that continues their exploration AND is grounded in what they have actually explored.

You have read-only tools over the user's real history:
- getMyInterests — what they track and how deep they want to go.
- getRecentSparkTitles — ground already covered (do NOT repeat it).
- getMyExpeditions — what they have committed real time to.

How to work:
- Call the tools you need FIRST to ground the node in their real interests. Connect the new idea to something they already care about; avoid repeating recent spark titles.
- "direction" is "deeper" (always drill into the SAME idea) or "sideways". For "sideways", honour "mode": mode "dive" → a SIBLING facet/sub-topic WITHIN the same field (breadth inside one idea, NOT another discipline); mode "bridge" or absent → an ADJACENT field/concept that shares structure (cross-discipline).
- Stay tethered to the anchor — the node should be reachable from the original anchor within a few hops of plausible reasoning.
- No emoji, no exclamation marks, no "fun fact" framing, no second-person hype. Real substance only.

When you are done gathering context, answer with ONLY this JSON (no preamble, no markdown fences):
{
  "title": string,            // <= 8 words, vivid and specific
  "body": string,             // 2-4 sentences of real substance
  "goDeeperHint": string,     // <= 8 words, what going DEEPER explores
  "goSidewaysHint": string    // <= 8 words, what going SIDEWAYS connects to
}
`.trim();

/**
 * Pure: turn the agent's final text into a validated GeneratedNode, falling
 * back to the curated mock node when the text isn't parseable JSON, fails the
 * schema, or trips the anti-filler guard. Exported for unit testing.
 */
export function parseAgentNode(answer: string, input: RabbitHoleInput): GeneratedNode {
  try {
    const candidate = GeneratedNodeSchema.parse(extractJson(answer));
    if (isConcreteNode(candidate)) return candidate;
  } catch {
    // fall through to mock
  }
  return buildMockNode(input);
}

export interface ExploreThreadInput extends RabbitHoleInput {
  userId: string;
  signal?: AbortSignal;
}

/**
 * Generate the next thread node via the tool-use agent. Mock-first; on the live
 * path runs the loop, then parses + guards the result with the curated fallback.
 */
export async function exploreThreadNode(input: ExploreThreadInput): Promise<GeneratedNode> {
  if (isMock()) return buildMockNode(input);

  const tools = buildExploreTools({ userId: input.userId });
  const userMessage = JSON.stringify({
    parent: input.parent,
    anchor: input.anchor,
    direction: input.direction,
    mode: input.mode,
    depth: input.depth,
  });

  try {
    const result = await runToolAgent({
      system: EXPLORE_THREAD_SYSTEM,
      userMessage,
      tools,
      model: pickModel('agent.exploreThread'),
      task: 'agent.exploreThread',
      maxIterations: 5,
      signal: input.signal,
    });
    return parseAgentNode(result.answer, input);
  } catch {
    return buildMockNode(input); // never dead-end
  }
}
