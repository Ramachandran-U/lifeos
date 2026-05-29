import { z } from 'zod';
import { callAI } from '../client';
import { extractJson } from '../extractJson';
import { pickModel } from '../modelRouter';
import { withSpan } from '../tracing';
import {
  GoalHierarchySchema,
  type GoalHierarchy,
  type GoalInput,
} from '../types';
import { buildMockGoalHierarchy } from '../mocks/goals';

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

export type GoalAgentStep =
  | { kind: 'propose'; monthlyCount: number; weeklyCount: number }
  | { kind: 'critique'; issues: string[]; revised: boolean }
  | { kind: 'commit'; primaryTitle: string };

export interface GoalAgentResult {
  hierarchy: GoalHierarchy;
  trace: GoalAgentStep[];
}

const GOAL_TYPES = ['career', 'health', 'finance', 'learning', 'personal'] as const;
const TYPE_ALIASES: Record<string, (typeof GOAL_TYPES)[number]> = {
  job: 'career',
  work: 'career',
  fitness: 'health',
  wellness: 'health',
  money: 'finance',
  wealth: 'finance',
  learn: 'learning',
  education: 'learning',
  study: 'learning',
  life: 'personal',
  family: 'personal',
  social: 'personal',
};
function coerceType(v: unknown): (typeof GOAL_TYPES)[number] {
  if (typeof v !== 'string') return 'personal';
  const k = v.toLowerCase().trim();
  if ((GOAL_TYPES as readonly string[]).includes(k)) return k as (typeof GOAL_TYPES)[number];
  return TYPE_ALIASES[k] ?? 'personal';
}

const ProposeSchema = GoalHierarchySchema;

const CritiqueSchema = z.object({
  issues: z.array(z.string()),
  revised: GoalHierarchySchema,
});

const PROPOSE_SYSTEM = `
You are LifeOS's Elite Life Strategist. Given a user's vision, propose a full execution hierarchy.

HARD RULES:
- Every milestone is a verifiable artefact ("3 system design docs published", not "research system design").
- 12 monthly entries, months 1..12, no gaps, no duplicates.
- 4 weekly entries representing the first 4 weeks (weeks 1..4).
- 3 daily task examples, each a 30–90 minute imperative producing something concrete.
- Use the user's own words for the primary goal title.
- Imperative or present-tense; never past tense.

Output JSON matching GoalHierarchy:
{
  "primaryGoal": { "title": string, "type": "career"|"health"|"finance"|"learning"|"personal" },
  "yearly": { "title": string, "milestone": string },
  "monthly": [{ "month": number, "title": string, "milestone": string }],
  "weekly": [{ "week": number, "focus": string, "tasks": string[] }],
  "dailyTaskExamples": string[]
}
`.trim();

const CRITIQUE_SYSTEM = `
You are a strict reviewer of goal-decomposition plans. Given a proposed hierarchy, list concrete
issues and produce a revised hierarchy that fixes them.

Check for:
- Monthly entries: must be exactly 12, months 1..12, no duplicates, milestones are verifiable artefacts (not activities).
- Weekly entries: must cover weeks 1..4; each task is concrete and 5-day-completable.
- Past-tense titles ("Shipped X", "Built Y") — rewrite to imperative.
- Vague milestones ("Research foundation", "Learn basics") — replace with artefacts.
- Yearly milestone is concrete (a signed offer, a deployed system, a measured metric).
- DailyTaskExamples: exactly 3, imperative, 30–90 min scope.

Output JSON: { "issues": string[], "revised": <full hierarchy> }.
If no issues, return [] and echo the proposed hierarchy unchanged in "revised".
`.trim();

/**
 * Multi-step goal decomposer: propose → critique → commit (with deterministic guard).
 *
 * Mirrors the structure of `planRoutineAgent` in `./planner.ts`. There is no
 * retrieve step here — goal decomposition takes a fresh vision and does not
 * need user-history context. If we later add personalisation off historical
 * goals, that's where to plug retrieval in.
 *
 * Flag-gated by `agent_goal_decomp` (see `useFlagStore`). When the flag is
 * off, callers fall through to the single-shot `decomposeGoal` in `functions.ts`.
 */
export async function decomposeGoalAgent(
  input: GoalInput,
  opts?: { signal?: AbortSignal },
): Promise<GoalAgentResult> {
  return withSpan(
    'agent.decomposeGoal',
    () => decomposeGoalAgentInner(input, opts),
    { hasName: !!input.name, hasAge: input.age != null },
  );
}

async function decomposeGoalAgentInner(
  input: GoalInput,
  opts?: { signal?: AbortSignal },
): Promise<GoalAgentResult> {
  const trace: GoalAgentStep[] = [];

  if (isMock()) {
    const mock = buildMockGoalHierarchy(input.visionStatement, input.name);
    trace.push({ kind: 'propose', monthlyCount: mock.monthly.length, weeklyCount: mock.weekly.length });
    trace.push({ kind: 'critique', issues: [], revised: false });
    trace.push({ kind: 'commit', primaryTitle: mock.primaryGoal.title });
    return { hierarchy: mock, trace };
  }

  // Step 1 — propose
  const proposeRaw = await callAI({
    system: PROPOSE_SYSTEM,
    model: pickModel('agent.goal.propose'),
    cacheSystem: true,
    task: 'agent.goal.propose',
    maxTokens: 6000,
    signal: opts?.signal,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          vision: input.visionStatement,
          name: input.name,
          age: input.age,
        }),
      },
    ],
  });
  const proposedRawJson = extractJson(proposeRaw) as { primaryGoal?: { type?: unknown } };
  const proposed = ProposeSchema.parse({
    ...proposedRawJson,
    primaryGoal: {
      ...(proposedRawJson.primaryGoal ?? {}),
      type: coerceType(proposedRawJson.primaryGoal?.type),
    },
  });
  trace.push({
    kind: 'propose',
    monthlyCount: proposed.monthly.length,
    weeklyCount: proposed.weekly.length,
  });

  // Step 2 — critique
  const critiqueRaw = await callAI({
    system: CRITIQUE_SYSTEM,
    model: pickModel('agent.goal.critique'),
    cacheSystem: true,
    task: 'agent.goal.critique',
    maxTokens: 6000,
    signal: opts?.signal,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ vision: input.visionStatement, proposed }),
      },
    ],
  });
  const critiqueRawJson = extractJson(critiqueRaw) as {
    issues?: unknown;
    revised?: { primaryGoal?: { type?: unknown } };
  };
  const critique = CritiqueSchema.parse({
    ...critiqueRawJson,
    revised: {
      ...(critiqueRawJson.revised ?? {}),
      primaryGoal: {
        ...(critiqueRawJson.revised?.primaryGoal ?? {}),
        type: coerceType(critiqueRawJson.revised?.primaryGoal?.type),
      },
    },
  });
  trace.push({
    kind: 'critique',
    issues: critique.issues,
    revised: critique.issues.length > 0,
  });

  // Step 3 — commit (deterministic guard)
  const chosen = critique.issues.length > 0 ? critique.revised : proposed;

  // Months 1..12 must all be present. If the LLM dropped any, the schema
  // already accepted whatever count came back — we re-validate here as a
  // last-line check so downstream code doesn't crash on a missing month.
  const monthSet = new Set(chosen.monthly.map((m) => m.month));
  const allMonthsPresent = Array.from({ length: 12 }, (_, i) => i + 1).every((m) =>
    monthSet.has(m),
  );
  if (!allMonthsPresent) {
    // Surface this as a critique issue rather than throwing — the caller will
    // record the schema-failure telemetry, but the hierarchy is still usable.
    trace.push({
      kind: 'critique',
      issues: [`monthly entries incomplete: have ${chosen.monthly.length}, expected 12`],
      revised: false,
    });
  }

  const hierarchy = GoalHierarchySchema.parse(chosen);
  trace.push({ kind: 'commit', primaryTitle: hierarchy.primaryGoal.title });
  return { hierarchy, trace };
}
