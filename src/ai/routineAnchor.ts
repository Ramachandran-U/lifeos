import type { GeneratedRoutine } from './types';

type RoutineBlock = GeneratedRoutine['blocks'][number];

/** A routine that starts within this many minutes of wake already "starts at
 *  wake" — no anchor needed. */
export const WAKE_GAP_THRESHOLD_MIN = 30;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Guarantee the day visibly begins at the user's wake time.
 *
 * The planner is only told the first block must be "at or after" wakeTime, and
 * the window-guards only DROP out-of-range blocks — so a model can legitimately
 * leave the early morning empty and start the day late (the "wake 10:00 →
 * routine starts 12:00" bug). If the earliest block starts more than
 * WAKE_GAP_THRESHOLD_MIN after wakeTime, prepend a light opening block spanning
 * wakeTime → that first block, so the routine always begins when the user is up.
 *
 * Pure and deterministic — no model, no clock. Returns a NEW array; the input
 * is never mutated. A no-op when blocks are empty or already start near wake.
 */
export function anchorRoutineToWake(blocks: RoutineBlock[], wakeTime: string): RoutineBlock[] {
  if (blocks.length === 0) return blocks;

  const wakeMin = toMinutes(wakeTime);
  let earliest = blocks[0];
  for (const b of blocks) {
    if (toMinutes(b.startTime) < toMinutes(earliest.startTime)) earliest = b;
  }

  const gap = toMinutes(earliest.startTime) - wakeMin;
  // Already starts at/near wake (or, defensively, before it — the window guard
  // owns the before-wake case): leave the plan untouched.
  if (gap <= WAKE_GAP_THRESHOLD_MIN) return blocks;

  const opening: RoutineBlock = {
    startTime: wakeTime,
    endTime: earliest.startTime,
    title: 'Morning routine',
    module: 'rest',
    energyRequired: 'low',
  };
  return [opening, ...blocks];
}
