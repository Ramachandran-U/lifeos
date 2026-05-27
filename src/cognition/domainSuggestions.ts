/**
 * Suggestion engine for the domain-stagnation nudge (Phase 2 increment 3).
 *
 * Quality rule (from the handover): mine the user's OWN unscheduled goals
 * first — those are the highest-trust suggestions because the user already
 * committed to them. Only fall back to AI invention when goal-mining yields
 * fewer than two, and guard the AI output to concrete, routine-shaped actions.
 *
 * Pure orchestrator: goal source, the "is it scheduled?" predicate, and the AI
 * fallback are all injected, so it is fully unit-testable with no DB or LLM.
 */
import type { DomainId } from '@/store/useUserStore';
import type { InsightSuggestion } from './types';
import { domainToModule, goalTypeToDomain } from './domainStagnation';

/** Minimal goal shape the engine needs (subset of the goals row). */
export interface MinableGoal {
  id: string;
  title: string;
  goalType: string;
  level: string; // life | yearly | monthly | weekly | daily
  status: string; // active | completed | ...
}

export interface SuggestionDeps {
  domain: DomainId;
  /** All of the user's goals (the engine filters by domain/level/status). */
  goals: MinableGoal[];
  /** True if a goal already has a routine block (by id or title match). */
  isGoalScheduled: (goal: MinableGoal) => boolean;
  /** AI fallback — invoked only when goal-mining yields < 2. */
  aiSuggest?: (domain: DomainId) => Promise<InsightSuggestion[]>;
}

export const MAX_SUGGESTIONS = 3;
const DEFAULT_BLOCK_MIN = 20;

/** A suggestion is usable only if it has a concrete title and a positive duration. */
export function isConcreteSuggestion(s: InsightSuggestion): boolean {
  return typeof s.title === 'string' && s.title.trim().length > 0 && s.durationMin > 0;
}

/** Goals that belong to this domain, are actionable (weekly/daily), active, and unscheduled. */
function mineGoals(deps: SuggestionDeps): InsightSuggestion[] {
  const module = domainToModule(deps.domain);
  return deps.goals
    .filter((g) =>
      g.status === 'active' &&
      (g.level === 'weekly' || g.level === 'daily') &&
      goalTypeToDomain(g.goalType) === deps.domain &&
      !deps.isGoalScheduled(g),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((g) => ({
      title: g.title,
      durationMin: DEFAULT_BLOCK_MIN,
      module,
      source: 'goal' as const,
      goalId: g.id,
    }));
}

/**
 * Build up to MAX_SUGGESTIONS actions for a stagnant domain: mined goals first,
 * AI fallback only to top up when fewer than two were mined. AI suggestions are
 * filtered to concrete ones and de-duplicated against mined titles.
 */
export async function buildDomainSuggestions(deps: SuggestionDeps): Promise<InsightSuggestion[]> {
  const mined = mineGoals(deps);
  if (mined.length >= 2 || !deps.aiSuggest) return mined.slice(0, MAX_SUGGESTIONS);

  let ai: InsightSuggestion[] = [];
  try {
    ai = await deps.aiSuggest(deps.domain);
  } catch {
    ai = []; // AI failure is non-fatal — fall back to whatever we mined
  }

  const seen = new Set(mined.map((s) => s.title.trim().toLowerCase()));
  const aiClean = ai
    .filter(isConcreteSuggestion)
    .filter((s) => !seen.has(s.title.trim().toLowerCase()))
    .map((s) => ({ ...s, source: 'ai' as const, module: s.module || domainToModule(deps.domain) }));

  return [...mined, ...aiClean].slice(0, MAX_SUGGESTIONS);
}
