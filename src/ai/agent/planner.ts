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
import { anchorRoutineToWake } from '../routineAnchor';

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

// Valid module enum from GeneratedRoutineSchema. The AI occasionally
// hallucinates synonyms (e.g. "personal", "wellness") which would otherwise
// fail strict Zod parse and surface a raw error to the UI. We pre-process
// each block's module through this map BEFORE the schema sees it.
const VALID_MODULES = ['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal'] as const;
const MODULE_ALIASES: Record<string, (typeof VALID_MODULES)[number]> = {
  goals: 'goal',
  fitness: 'health',
  exercise: 'health',
  wellness: 'health',
  workout: 'health',
  sleep: 'rest',
  break: 'rest',
  relax: 'rest',
  recovery: 'rest',
  personal: 'rest',
  hobby: 'polymath',
  learning: 'polymath',
  study: 'polymath',
  reading: 'polymath',
  mind: 'polymath',
  money: 'finance',
  job: 'career',
  family: 'social',
  friends: 'social',
  food: 'meal',
  breakfast: 'meal',
  lunch: 'meal',
  dinner: 'meal',
  snack: 'meal',
};
const coerceModule = (m: unknown): string => {
  if (typeof m !== 'string') return 'rest';
  const k = m.toLowerCase().trim();
  if ((VALID_MODULES as readonly string[]).includes(k)) return k;
  return MODULE_ALIASES[k] ?? 'rest';
};
const sanitizeBlocks = (raw: unknown): unknown => {
  if (!Array.isArray(raw)) return raw;
  return raw.map((b) =>
    b && typeof b === 'object' ? { ...b, module: coerceModule((b as { module?: unknown }).module) } : b,
  );
};

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
      'You are a routine planner. Given the user wake/sleep/work times, goals, recent-history context, ' +
      'and optional profile signals (chronotype, primary domains, fixed blocks, constraints, struggles, ' +
      'current habits, productive hours, dropped habits), propose 6–10 time-blocked routine blocks for today. ' +
      'HARD CONSTRAINTS (never violate, even if defaults would be more natural): the FIRST block must start ' +
      'AT schedule.wakeTime — begin the day when the user wakes; NEVER leave the window between wakeTime and ' +
      'the first block empty. The LAST block must end AT OR BEFORE schedule.sleepTime. Block times ' +
      'between schedule.workStartTime and schedule.workEndTime should use module="work" unless a fixedBlock ' +
      'overrides them. Do NOT default to 07:00 or any other common time — read the provided wakeTime ' +
      'literally and start the first block exactly there or later. ' +
      'Honour fixed blocks verbatim. Place high-energy work inside the user\'s productive hours. Avoid ' +
      'reinstating dropped habits. If the recent-history context shows a pattern (e.g. skipped morning ' +
      'workouts, low-energy evenings), adapt the plan to it. ' +
      'Output JSON: {"blocks":[{startTime,endTime,title,module,energyRequired?}], "rationale": string}. ' +
      'Modules: goal|health|finance|career|social|polymath|rest|work|meal. Times in HH:MM. start < end.',
    model: pickModel('agent.propose'),
    cacheSystem: true,
    task: 'agent.propose',
    // A full day is up to ~10 blocks + a rationale. The proxy default cap
    // truncates that mid-JSON → extractJson throws "Unbalanced JSON in AI
    // response". A wider wake→sleep window (common after editing times) makes
    // it worse. Give the propose step room to finish the object.
    maxTokens: 3000,
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
          chronotype: input.chronotype,
          primaryDomains: input.primaryDomains,
          fixedBlocks: input.fixedBlocks,
          constraints: input.constraints,
          struggles: input.struggles,
          currentHabits: input.currentHabits,
          communicationTone: input.communicationTone,
          inferredPreferences: input.inferredPreferences,
          recentContext: contextBlock || '(none)',
        }),
      },
    ],
  });
  const proposedRaw = extractJson(proposeRaw) as { blocks?: unknown; rationale?: unknown };
  const proposed = ProposeSchema.parse({
    ...proposedRaw,
    blocks: sanitizeBlocks(proposedRaw.blocks),
  });
  trace.push({
    kind: 'propose',
    blockCount: proposed.blocks.length,
    rationale: proposed.rationale.slice(0, 200),
  });

  // Step 3 — critique. This step REFINES the proposed plan; it is not essential
  // to producing one. A failure here (AI error, truncated JSON, schema mismatch)
  // — or a degenerate response that drops every block — must NOT discard the
  // already-valid proposed routine. On any such case we fall back to the
  // proposed blocks unchanged rather than throwing the whole generation away.
  let critique: z.infer<typeof CritiqueSchema>;
  try {
    const critiqueRaw = await callAI({
      system:
        'You are a critical reviewer of routine plans. Given a proposed plan, list concrete issues ' +
        '(e.g. overlapping blocks, high-energy work after dinner, no rest, ignored goals, ' +
        'violations of fixed blocks, chronotype mismatch, reinstated dropped habits) and produce a ' +
        'revised block list. ' +
        'Output JSON: {"issues": string[], "revisedBlocks": [...same shape...]}. If no issues, return [] and the original blocks unchanged.',
      model: pickModel('agent.critique'),
      cacheSystem: true,
      task: 'agent.critique',
      // Critique echoes a full revised block list back, so it needs even more
      // headroom than propose — otherwise the revisedBlocks array truncates.
      maxTokens: 3500,
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
            chronotype: input.chronotype,
            fixedBlocks: input.fixedBlocks,
            inferredPreferences: input.inferredPreferences,
            proposedBlocks: proposed.blocks,
          }),
        },
      ],
    });
    const critiqueRawJson = extractJson(critiqueRaw) as { issues?: unknown; revisedBlocks?: unknown };
    critique = CritiqueSchema.parse({
      ...critiqueRawJson,
      revisedBlocks: sanitizeBlocks(critiqueRawJson.revisedBlocks),
    });
    // Degenerate critique guard: if it flagged issues but echoed back no blocks
    // (truncation / "here are the issues" with an empty list), keep the proposed
    // plan instead of committing nothing.
    if (critique.issues.length > 0 && critique.revisedBlocks.length === 0) {
      critique = { issues: [], revisedBlocks: proposed.blocks };
    }
  } catch (err) {
    console.warn('[planner] critique step failed — using proposed blocks unchanged:', err);
    critique = { issues: [], revisedBlocks: proposed.blocks };
  }
  trace.push({
    kind: 'critique',
    issues: critique.issues,
    revised: critique.issues.length > 0,
  });

  // Step 4 — commit
  // Deterministic guard: even if the LLM ignored the wake/sleep bounds, drop
  // anything outside the window so the generated routine never starts before
  // the user is awake (or after they're asleep). This is the last line of
  // defence — the propose+critique prompts already state the constraint.
  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
    return h * 60 + (m || 0);
  };
  const wakeMin = toMinutes(input.wakeTime);
  const sleepMin = toMinutes(input.sleepTime);
  const inWindow = (b: { startTime: string; endTime: string }): boolean => {
    const s = toMinutes(b.startTime);
    const e = toMinutes(b.endTime);
    return s >= wakeMin && e <= sleepMin && s < e;
  };
  const preFilter = critique.issues.length > 0 ? critique.revisedBlocks : proposed.blocks;
  let windowed = preFilter.filter(inWindow);
  if (preFilter.length !== windowed.length) {
    console.warn(
      `[planner] guard dropped ${preFilter.length - windowed.length} block(s) outside ` +
      `wake=${input.wakeTime}..sleep=${input.sleepTime} window. ` +
      `Pre-filter starts: ${preFilter.map((b) => b.startTime).join(',')}. ` +
      `Post-filter starts: ${windowed.map((b) => b.startTime).join(',')}.`,
    );
  }
  // If the window filter emptied a non-empty plan (the critique/model ignored the
  // bounds entirely), fall back to the proposed blocks within the window before
  // giving up — never discard a plan we successfully produced.
  if (windowed.length === 0 && proposed.blocks.length > 0) {
    windowed = proposed.blocks.filter(inWindow);
  }
  // Guarantee the day starts at wake — the prompt's "at or after wakeTime" lets
  // the model leave the morning empty (wake 10:00 → first block 12:00). If it
  // did, prepend an opening block from wakeTime. Deterministic; see routineAnchor.
  // NOTE: an empty `finalBlocks` is a deliberate, tested outcome — the planner
  // returns an empty plan (it does NOT throw) when every block falls outside the
  // wake–sleep window, and the screen surfaces that case. See planner.test.ts.
  const finalBlocks = anchorRoutineToWake(windowed, input.wakeTime);

  // Step 4b — briefing. Cosmetic: a 2–3 sentence summary. A failure here (the
  // token cap truncating the JSON, a parse error, an AI hiccup) must NOT throw
  // away the routine we just built — fall back to a synthesized briefing.
  let briefing: string;
  try {
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
      // 250 was tight enough that a slightly verbose model truncated the JSON
      // mid-string → extractJson threw → the whole generation failed. Give the
      // 2–3 sentences comfortable room.
      maxTokens: 400,
    });
    briefing = z.object({ briefing: z.string() }).parse(extractJson(briefingRaw)).briefing;
  } catch (err) {
    console.warn('[planner] briefing step failed — using a synthesized briefing:', err);
    const first = finalBlocks[0];
    briefing = first
      ? `Your day is mapped into ${finalBlocks.length} blocks, starting at ${first.startTime} with ${first.title.toLowerCase()}. Lead with that first block to build momentum.`
      : 'Your day is ready.';
  }

  const plan: GeneratedRoutine = GeneratedRoutineSchema.parse({
    blocks: finalBlocks,
    briefing,
  });
  trace.push({ kind: 'commit', briefingPreview: briefing.slice(0, 80) });

  return { plan, trace };
}
