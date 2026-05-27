/**
 * Priority-change orchestrator — pure logic for computing what changes when a
 * user reorders/adds/removes life-domain priorities, and what impact that has
 * on their routine, streaks, and expeditions. Every function is dependency-
 * injected and unit-testable.
 *
 * See implementation-plan/priority-change-routine-adjustment.md.
 */
import type { DomainId } from '@/store/useUserStore';
import { domainToModule } from './domainStagnation';

export interface PriorityDiff {
  added: DomainId[];
  removed: DomainId[];
  /** Domains that stayed but changed rank position. */
  reordered: DomainId[];
  unchanged: DomainId[];
  oldOrder: DomainId[];
  newOrder: DomainId[];
}

export function computePriorityDiff(oldDomains: DomainId[], newDomains: DomainId[]): PriorityDiff {
  const oldSet = new Set(oldDomains);
  const newSet = new Set(newDomains);
  const added = newDomains.filter((d) => !oldSet.has(d));
  const removed = oldDomains.filter((d) => !newSet.has(d));
  const kept = newDomains.filter((d) => oldSet.has(d));
  const reordered = kept.filter((d) => oldDomains.indexOf(d) !== newDomains.indexOf(d));
  const unchanged = kept.filter((d) => oldDomains.indexOf(d) === newDomains.indexOf(d));
  return { added, removed, reordered, unchanged, oldOrder: oldDomains, newOrder: newDomains };
}

export interface RoutineBlock {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  status: string; // upcoming | in_progress | completed | skipped
  linkedEntityId?: string;
}

export interface ActiveStreak { domain: DomainId; streakKey: string; count: number }
export interface ActiveExpedition { id: string; title: string; domain: string; status: string }
export interface DomainGoalCount { domain: DomainId; activeGoals: number }

export interface ImpactInput {
  diff: PriorityDiff;
  todayBlocks: RoutineBlock[];
  streaks: ActiveStreak[];
  expeditions: ActiveExpedition[];
  goalCounts: DomainGoalCount[];
}

export interface PriorityChangeImpact {
  /** Domains being added — blocks will appear. */
  gaining: DomainId[];
  /** Domains being removed — blocks will be dropped. */
  losing: DomainId[];
  /** Blocks in today's remaining (upcoming) that belong to removed domains. */
  blocksAtRisk: RoutineBlock[];
  /** Streaks that will naturally lapse because their domain is being removed. */
  streaksAtRisk: ActiveStreak[];
  /** Expeditions in a deprioritized domain (they keep running, but the user should know). */
  expeditionsSlowing: ActiveExpedition[];
  /** Goals in removed domains that remain active (suggest rebalance). */
  goalsOrphaned: DomainGoalCount[];
  /** true when < 60 min of the day remains — suggest tomorrow instead. */
  tooLateForToday: boolean;
  /** Remaining upcoming minutes. */
  remainingMinutes: number;
}

function blockMinutes(b: RoutineBlock): number {
  const [sh, sm] = b.startTime.split(':').map(Number);
  const [eh, em] = b.endTime.split(':').map(Number);
  return (eh! * 60 + em!) - (sh! * 60 + sm!);
}

const DOMAIN_TO_STREAK: Partial<Record<DomainId, string>> = {
  health: 'workout',
  polymath: 'learning',
  social: 'social',
};

export function assessImpact(input: ImpactInput): PriorityChangeImpact {
  const { diff, todayBlocks, streaks, expeditions, goalCounts } = input;
  const removedModules = new Set(diff.removed.map(domainToModule));

  const remaining = todayBlocks.filter((b) => b.status === 'upcoming');
  const blocksAtRisk = remaining.filter((b) => removedModules.has(b.module));
  const remainingMinutes = remaining.reduce((acc, b) => acc + blockMinutes(b), 0);

  const streaksAtRisk = streaks.filter(
    (s) => diff.removed.includes(s.domain) && s.count > 0,
  );

  const expeditionsSlowing = expeditions.filter(
    (e) => diff.removed.some((d) => domainToModule(d) === e.domain) && e.status === 'active',
  );

  const goalsOrphaned = goalCounts.filter(
    (g) => diff.removed.includes(g.domain) && g.activeGoals > 0,
  );

  return {
    gaining: diff.added,
    losing: diff.removed,
    blocksAtRisk,
    streaksAtRisk,
    expeditionsSlowing,
    goalsOrphaned,
    tooLateForToday: remainingMinutes < 60,
    remainingMinutes,
  };
}

/**
 * When less than 60 min of upcoming blocks remain, default to "start tomorrow"
 * rather than attempting a near-empty replan.
 */
export function shouldDefaultToTomorrow(remainingMinutes: number): boolean {
  return remainingMinutes < 60;
}

/**
 * Build the constraint set for the planner agent when replanning today:
 * completed + in-progress blocks become fixedBlocks the planner must not touch.
 */
export function buildReplanConstraints(todayBlocks: RoutineBlock[]) {
  const frozen = todayBlocks.filter((b) => b.status === 'completed' || b.status === 'in_progress');
  const remaining = todayBlocks.filter((b) => b.status === 'upcoming');
  return {
    fixedBlocks: frozen.map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      module: b.module,
    })),
    remainingSlots: remaining,
  };
}

/** Has anything actually changed? (Avoids triggering a replan for a no-op save.) */
export function hasMeaningfulChange(diff: PriorityDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.reordered.length > 0;
}
