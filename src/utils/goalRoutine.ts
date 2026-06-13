import { format, addDays } from 'date-fns';
import { createRoutineBlocks, getRoutineBlocksInRange } from '@/db/queries/routine';
import { GOALTYPE_TO_MODULE } from '@/utils/gamification';

/**
 * Turn a finalised goal into a recurring daily focus block on the routine.
 *
 * LifeOS has no first-class "recurring block" primitive — `routine_blocks` are
 * one row per date. So a recurring habit is modelled as a rolling window of
 * daily blocks, each linked back to the goal via `linkedEntityId`. The block's
 * `module` is derived from the goal's domain so it colours + scores correctly.
 *
 * Idempotent: dates that already carry a focus block for this goal are skipped,
 * so re-running (e.g. extending the window) never double-books a day.
 */
export interface AddGoalFocusBlocksOptions {
  goalId: string;
  goalType: string;
  title: string;
  /** HH:MM start. Defaults to an early-morning focus slot. */
  startTime?: string;
  /** Block length in minutes. Defaults to 45. */
  durationMin?: number;
  /** How many days forward to seed. Defaults to 14. */
  days?: number;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addDaysISO(base: Date, days: number): string {
  // LOCAL calendar day (date-fns `format`) — the convention the rest of the app
  // keys routine blocks by (e.g. starterRoutine, getRoutineBlocksByDate). The old
  // `toISOString().slice(0,10)` formatted in UTC, so for users whose local day
  // differs from UTC the focus blocks (and the idempotency range) landed on the
  // wrong calendar day — a habit could appear to skip "today" or double-book.
  return format(addDays(base, days), 'yyyy-MM-dd');
}

export function addGoalFocusBlocks(opts: AddGoalFocusBlocksOptions): string[] {
  const { goalId, goalType, title } = opts;
  const startTime = opts.startTime ?? '07:00';
  const durationMin = opts.durationMin ?? 45;
  const days = opts.days ?? 14;
  const endTime = fromMinutes(toMinutes(startTime) + durationMin);
  const module = GOALTYPE_TO_MODULE[goalType] ?? 'goal';

  const today = new Date();
  const startDate = addDaysISO(today, 0);
  const endDate = addDaysISO(today, days - 1);

  // Skip any day that already has a block linked to this goal (idempotency).
  const existing = getRoutineBlocksInRange(startDate, endDate);
  const takenDates = new Set(
    existing.filter((b) => b.linkedEntityId === goalId).map((b) => b.date),
  );

  const blocks = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(today, i);
    if (takenDates.has(date)) continue;
    blocks.push({
      date,
      startTime,
      endTime,
      title: `Goal: ${title}`,
      module,
      linkedEntityId: goalId,
      energyRequired: 'medium',
    });
  }

  if (blocks.length === 0) return [];
  return createRoutineBlocks(blocks);
}
