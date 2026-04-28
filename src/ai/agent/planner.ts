import { z } from 'zod';
import { callAI } from '../client';
import { extractJson } from '../extractJson';
import { pickModel } from '../modelRouter';
import { retrieveContext, type RagItem } from '../rag/retrieve';
import { withSpan } from '../tracing';
import {
  GeneratedRoutineSchema,
  type GeneratedRoutine,
  type RoutineInput,
} from '../types';
import { MOCK_ROUTINE } from '../mocks/routine';

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

export type AgentStep =
  | { kind: 'retrieve'; query: string; hits: Array<{ id: string; score: number; text: string }> }
  | { kind: 'propose'; blockCount: number; rationale: string }
  | { kind: 'critique'; issues: string[]; revised: boolean }
  | { kind: 'commit'; briefingPreview: string };

export interface AgentResult {
  plan: GeneratedRoutine;
  trace: AgentStep[];
}

export interface PlanRoutineAgentInput extends RoutineInput {
  /** Free-form recent-history items the agent can search for context. */
  contextItems?: RagItem[];
}

const ProposeSchema = z.object({
  blocks: GeneratedRoutineSchema.shape.blocks,
  rationale: z.string(),
});

const CritiqueSchema = z.object({
  issues: z.array(z.string()),
  revisedBlocks: GeneratedRoutineSchema.shape.blocks,
});

/**
 * Multi-step planner: retrieve user context → propose blocks → critique →
 * commit. Each step is a discrete LLM call (or a deterministic mock step).
 *
 * This is an *agent* in the operational sense — multi-turn reasoning with
 * intermediate state and self-critique — not in the strict Anthropic
 * tool-use protocol sense (the project's AI proxy doesn't expose tool use
 * yet). Migrating to native tool-use is a one-step swap of `callAI`.
 */
export async function planRoutineAgent(
  input: PlanRoutineAgentInput,
): Promise<AgentResult> {
  return withSpan('agent.planRoutine', (_span) => planRoutineAgentInner(input), {
    goalCount: input.goals?.length ?? 0,
    contextItemCount: input.contextItems?.length ?? 0,
  });
}

async function planRoutineAgentInner(
  input: PlanRoutineAgentInput,
): Promise<AgentResult> {
  const trace: AgentStep[] = [];
  const contextItems = input.contextItems ?? [];

  // Step 1 — retrieve
  const query = `routine planning for: ${(input.goals ?? []).join(', ')} | ${input.careerFocus ?? ''}`.trim();
  const { hits, formatted: contextBlock } =
    contextItems.length > 0
      ? await retrieveContext(query, contextItems, 5)
      : { hits: [], formatted: '' };
  trace.push({
    kind: 'retrieve',
    query,
    hits: hits.map((h) => ({ id: h.id, score: h.score, text: h.text })),
  });

  if (isMock()) {
    // Deterministic mock trace: propose → critique → commit
    trace.push({
      kind: 'propose',
      blockCount: MOCK_ROUTINE.blocks.length,
      rationale: 'mock: derived from MOCK_ROUTINE template',
    });
    trace.push({ kind: 'critique', issues: [], revised: false });
    trace.push({
      kind: 'commit',
      briefingPreview: MOCK_ROUTINE.briefing.slice(0, 80),
    });
    return { plan: MOCK_ROUTINE, trace };
  }

  // Step 2 — propose
  const proposeRaw = await callAI({
    system:
      'You are a routine planner. Given the user wake/sleep/work times, goals, and recent-history context, ' +
      'propose 6–10 time-blocked routine blocks for today. Output JSON: {"blocks":[{startTime,endTime,title,module,energyRequired?}], "rationale": string}. ' +
      'Modules: goal|health|finance|career|social|polymath|rest|work|meal. Times in HH:MM. start < end.',
    model: pickModel('agent.propose'),
    cacheSystem: true,
    task: 'agent.propose',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          schedule: {
            wakeTime: input.wakeTime,
            sleepTime: input.sleepTime,
            workStartTime: input.workStartTime,
            workEndTime: input.workEndTime,
          },
          goals: input.goals,
          careerFocus: input.careerFocus,
          recentContext: contextBlock || '(none)',
        }),
      },
    ],
  });
  const proposed = ProposeSchema.parse(extractJson(proposeRaw));
  trace.push({
    kind: 'propose',
    blockCount: proposed.blocks.length,
    rationale: proposed.rationale.slice(0, 200),
  });

  // Step 3 — critique
  const critiqueRaw = await callAI({
    system:
      'You are a critical reviewer of routine plans. Given a proposed plan, list concrete issues ' +
      '(e.g. overlapping blocks, high-energy work after dinner, no rest, ignored goals) and produce a revised block list. ' +
      'Output JSON: {"issues": string[], "revisedBlocks": [...same shape...]}. If no issues, return [] and the original blocks unchanged.',
    model: pickModel('agent.critique'),
    cacheSystem: true,
    task: 'agent.critique',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          schedule: {
            wakeTime: input.wakeTime,
            sleepTime: input.sleepTime,
            workStartTime: input.workStartTime,
            workEndTime: input.workEndTime,
          },
          goals: input.goals,
          proposedBlocks: proposed.blocks,
        }),
      },
    ],
  });
  const critique = CritiqueSchema.parse(extractJson(critiqueRaw));
  trace.push({
    kind: 'critique',
    issues: critique.issues,
    revised: critique.issues.length > 0,
  });

  // Step 4 — commit
  const finalBlocks = critique.issues.length > 0 ? critique.revisedBlocks : proposed.blocks;
  const briefingRaw = await callAI({
    system:
      'Write a 2–3 sentence briefing for the user explaining the shape of their day and the ' +
      'one thing that matters most. Output JSON: {"briefing": string}.',
    model: pickModel('agent.brief'),
    task: 'agent.brief',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ blocks: finalBlocks, goals: input.goals }),
      },
    ],
    maxTokens: 250,
  });
  const briefing = z
    .object({ briefing: z.string() })
    .parse(extractJson(briefingRaw)).briefing;

  const plan: GeneratedRoutine = GeneratedRoutineSchema.parse({
    blocks: finalBlocks,
    briefing,
  });
  trace.push({ kind: 'commit', briefingPreview: briefing.slice(0, 80) });

  return { plan, trace };
}
