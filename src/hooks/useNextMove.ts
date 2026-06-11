/**
 * The deterministic "next move" resolver behind Today's NextMoveHero
 * (docs/design-deep-dive/01-today-hero.md §3.2).
 *
 * Deterministic, synchronous, zero AI — this hook imports nothing from
 * `@/ai/` by contract (Acceptance #14 greps it). The agentic surface is
 * CoachActionsCard / WhatNextCard further down the scroll; this is the
 * answer, not the assistant.
 *
 * Resolution order:
 *   1. block   — first block with status === 'upcoming' after sorting by
 *                startTime (string compare, the exact Today's-flow sort).
 *                upNow = block.startTime <= now ('HH:mm' string comparison;
 *                equality counts as up-now).
 *   2. task    — else, dailyTasks[0] (the Goals-tab "Your next move" logic,
 *                lifted).
 *   3. dayDone — else, blocks exist and every one of them is completed.
 *   4. plan    — else (no blocks, no tasks).
 */
import { format } from 'date-fns';
import type { DomainKey } from '@/constants/gamification';

export type NextMoveKind = 'block' | 'task' | 'dayDone' | 'plan';

/** The slice of a routine block the resolver needs. */
export interface NextMoveBlock {
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  status: string;
}

/** The slice of an active daily goal the resolver needs. */
export interface NextMoveTask {
  title: string;
}

export interface NextMoveInput {
  blocks: NextMoveBlock[];
  dailyTasks: NextMoveTask[];
  now: Date;
}

export interface NextMove {
  kind: NextMoveKind;
  title: string;
  module?: string;
  /** The radar's DomainKey, or undefined for non-domain modules (no pulse). */
  radarKey?: DomainKey;
  startTime?: string;
  endTime?: string;
  upNow?: boolean;
  extraCount?: number;
}

// goal → 'goals'; the five other canonical domains map to themselves;
// non-domain modules (rest/meal/work/…) map to undefined — no pulse, no
// active vertex.
const MODULE_TO_RADAR_KEY: Record<string, DomainKey> = {
  goal: 'goals',
  health: 'health',
  finance: 'finance',
  career: 'career',
  social: 'social',
  polymath: 'polymath',
};

/** Pure resolver — exported for direct unit coverage. */
export function resolveNextMove({ blocks, dailyTasks, now }: NextMoveInput): NextMove {
  const nextBlock = [...blocks]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .find((b) => b.status === 'upcoming');
  if (nextBlock) {
    return {
      kind: 'block',
      title: nextBlock.title,
      module: nextBlock.module,
      radarKey: MODULE_TO_RADAR_KEY[nextBlock.module],
      startTime: nextBlock.startTime,
      endTime: nextBlock.endTime,
      upNow: nextBlock.startTime <= format(now, 'HH:mm'),
    };
  }

  const task = dailyTasks[0];
  if (task) {
    return {
      kind: 'task',
      title: task.title,
      module: 'goal',
      radarKey: MODULE_TO_RADAR_KEY['goal'],
      extraCount: dailyTasks.length - 1,
    };
  }

  const completedCount = blocks.filter((b) => b.status === 'completed').length;
  if (blocks.length > 0 && completedCount === blocks.length) {
    return { kind: 'dayDone', title: 'Every block done. Outstanding.' };
  }

  return { kind: 'plan', title: "Let's build your first day." };
}

/**
 * Hook form for Today. A plain pass-through to the pure resolver — cheap
 * enough to run every render, and `now` is a fresh Date by design so an
 * up-now boundary crossing repaints on the next state change.
 */
export function useNextMove(input: NextMoveInput): NextMove {
  return resolveNextMove(input);
}
