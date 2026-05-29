/**
 * Goal runtime replanning (#6) — wires the previously-unused GOAL_REBALANCE_PROMPT.
 *
 * Two parts:
 *   1. `detectDomainDivergence` — a pure trigger: has a primary domain been
 *      starved of time vs its fair share over the last week? (the "one goal
 *      starves while another over-receives" case the prompt addresses).
 *   2. `rebalanceGoals` — the AI call that PROPOSES a new weekly-hours split.
 *      Like the agent's write tools, this returns a proposal; it is NOT applied
 *      automatically — the UI confirms before anything changes.
 */
import { z } from 'zod';
import { callAI } from './client';
import { extractJson } from './extractJson';
import { pickModel } from './modelRouter';
import { GOAL_REBALANCE_PROMPT } from './prompts/goals';

const isMock = () =>
  process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

// --- AI proposal ---

export interface GoalRebalanceInput {
  goals: Array<{
    id: string;
    title: string;
    type: string;
    currentProgress: number; // 0..1
    weeklyHoursAllocated: number;
  }>;
  totalAvailableHours: number;
}

export const GoalRebalanceSchema = z.object({
  suggestions: z.array(
    z.object({
      goalId: z.string(),
      weeklyHours: z.number().min(0),
      reason: z.string().min(1),
    }),
  ),
  insight: z.string().min(1),
});

export type GoalRebalanceProposal = z.infer<typeof GoalRebalanceSchema>;

/**
 * Proposes a new weekly-hours allocation across goals. Returns the proposal for
 * the user to confirm — callers must NOT apply it without confirmation. Returns
 * null on an empty input or a parse failure (never throws into the caller).
 */
export async function rebalanceGoals(input: GoalRebalanceInput): Promise<GoalRebalanceProposal | null> {
  if (input.goals.length === 0) return null;

  if (isMock()) {
    return {
      suggestions: input.goals.map((g) => ({
        goalId: g.id,
        weeklyHours: Math.round((input.totalAvailableHours / input.goals.length) * 10) / 10,
        reason: 'Even split across active goals (mock).',
      })),
      insight: 'Mock rebalance: spread time evenly across your goals.',
    };
  }

  try {
    const response = await callAI({
      system: GOAL_REBALANCE_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
      model: pickModel('rebalanceGoals'),
      cacheSystem: true,
      task: 'rebalanceGoals',
    });
    return GoalRebalanceSchema.parse(extractJson(response));
  } catch {
    return null;
  }
}

// --- Pure divergence trigger ---

export interface DivergenceDeps {
  /** Domains the user declared they care about. Only these are checked. */
  primaryDomains: string[];
  /** Actual minutes spent per domain over the trailing window (e.g. last week). */
  actualMinutesByDomain: Record<string, number>;
  /** OK to surface a rebalance now (not within cooldown)? */
  cooldownOk: () => boolean;
}

export interface DivergenceCandidate {
  /** The starved primary domain. */
  domain: string;
  /** Its fair share (1 / number of primary domains). */
  fairShare: number;
  /** Its actual share of the week's tracked minutes. */
  actualShare: number;
}

/** A primary domain getting less than this fraction of its fair share is "starved". */
export const STARVE_RATIO = 0.5;
/** Need at least this many tracked minutes before judging shares (else too noisy). */
export const MIN_TRACKED_MINUTES = 120;

/**
 * Returns the most-starved primary domain to propose a rebalance for, or null.
 * Pure. A domain qualifies when its share of tracked time is below STARVE_RATIO
 * of its fair (even) share among primary domains.
 */
export function detectDomainDivergence(deps: DivergenceDeps): DivergenceCandidate | null {
  const domains = deps.primaryDomains;
  if (domains.length === 0) return null;
  if (!deps.cooldownOk()) return null;

  const total = Object.values(deps.actualMinutesByDomain).reduce((s, m) => s + (m > 0 ? m : 0), 0);
  if (total < MIN_TRACKED_MINUTES) return null; // not enough signal to judge

  const fairShare = 1 / domains.length;
  const threshold = fairShare * STARVE_RATIO;

  let worst: DivergenceCandidate | null = null;
  for (const domain of domains) {
    const actualShare = (deps.actualMinutesByDomain[domain] ?? 0) / total;
    if (actualShare < threshold) {
      if (!worst || actualShare < worst.actualShare) {
        worst = { domain, fairShare, actualShare };
      }
    }
  }
  return worst;
}
