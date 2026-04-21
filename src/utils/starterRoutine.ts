import { format } from 'date-fns';
import { createRoutineBlocks, getRoutineBlocksByDate } from '@/db/queries/routine';
import type { DomainId } from '@/store/useUserStore';

/**
 * Seeds a plausible starter day so a new user lands on a populated Today view
 * instead of a blank one. Blocks reflect the user's primaryDomains choice.
 * User is expected to tap-to-edit — these are deliberately generic defaults.
 */
export function seedStarterRoutine(primaryDomains: DomainId[]): void {
  const today = format(new Date(), 'yyyy-MM-dd');

  const blocks: Array<{ startTime: string; endTime: string; title: string; module: string }> = [
    { startTime: '07:00', endTime: '07:30', title: 'Wake + morning routine', module: 'rest' },
    { startTime: '09:00', endTime: '12:00', title: 'Deep work', module: 'career' },
    { startTime: '12:00', endTime: '13:00', title: 'Lunch', module: 'meal' },
    { startTime: '14:00', endTime: '17:00', title: 'Focus work', module: 'work' },
    { startTime: '22:00', endTime: '23:00', title: 'Wind down', module: 'rest' },
  ];

  if (primaryDomains.includes('health')) {
    blocks.push({ startTime: '18:00', endTime: '18:45', title: 'Workout', module: 'health' });
  }
  if (primaryDomains.includes('polymath')) {
    blocks.push({ startTime: '20:00', endTime: '20:30', title: 'Explore something new', module: 'polymath' });
  }
  if (primaryDomains.includes('social')) {
    blocks.push({ startTime: '19:00', endTime: '19:30', title: 'Reach out to someone', module: 'social' });
  }
  if (primaryDomains.includes('goals')) {
    blocks.push({ startTime: '08:00', endTime: '08:30', title: 'Review top goal', module: 'goal' });
  }

  createRoutineBlocks(blocks.map((b) => ({ date: today, ...b })));
}

/**
 * Ensures the given date has at least some routine blocks. If it's empty,
 * clones today's blocks (minus status) over to that date. Used by evening
 * reflect to guarantee a tomorrow preview exists.
 */
export function cloneRoutineToDate(targetDate: string, sourceDate: string): void {
  const existing = getRoutineBlocksByDate(targetDate);
  if (existing.length > 0) return;
  const source = getRoutineBlocksByDate(sourceDate);
  if (source.length === 0) return;
  createRoutineBlocks(source.map((b) => ({
    date: targetDate,
    startTime: b.startTime,
    endTime: b.endTime,
    title: b.title,
    module: b.module,
    energyRequired: b.energyRequired ?? undefined,
    notes: b.notes ?? undefined,
  })));
}
