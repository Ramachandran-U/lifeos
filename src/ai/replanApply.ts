import { format } from 'date-fns';
import {
  createRoutineBlocks,
  deleteRoutineBlock,
  deleteRoutineBlocksByDate,
  getRoutineBlocksByDate,
  updateRoutineBlock,
} from '@/db/queries/routine';
import { replanRemainingDay, generateTomorrowRoutine, generateWeekRoutine } from './functions';
import type {
  ReplanRemainingDay,
  ReplanRemainingDayInput,
  GenerateTomorrowRoutineInput,
  GeneratedRoutine,
  GeneratedWeekRoutine,
  UserProfile,
} from './types';

function nowHHMM(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Pull today's blocks, build the AI input, call the AI, and write the result back.
 * Returns the rationale so the UI can surface it.
 */
export async function rebalanceRestOfToday(opts: {
  profile: UserProfile;
  softenForRecovery?: boolean;
}): Promise<{ rationale: string; changeCount: number }> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = nowHHMM();
  const allBlocks = getRoutineBlocksByDate(today);

  const remaining = allBlocks
    .filter((b) => b.startTime >= now)
    .map((b) => ({
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      module: b.module,
      status: b.status as 'upcoming' | 'in_progress' | 'completed' | 'skipped',
    }));
  const skippedToday = allBlocks
    .filter((b) => b.status === 'skipped')
    .map((b) => ({ id: b.id, title: b.title, module: b.module }));

  const input: ReplanRemainingDayInput = {
    nowHHMM: now,
    remainingBlocks: remaining,
    skippedToday,
    primaryDomains: opts.profile.primaryDomains,
    chronotype: opts.profile.chronotype,
    softenForRecovery: opts.softenForRecovery,
  };

  const plan: ReplanRemainingDay = await replanRemainingDay(input);
  applyReplan(plan, today);

  const changeCount = plan.drop.length + plan.edits.length + plan.add.length;
  return { rationale: plan.rationale, changeCount };
}

export function applyReplan(plan: ReplanRemainingDay, date: string): void {
  for (const id of plan.drop) deleteRoutineBlock(id);
  for (const edit of plan.edits) {
    const { id, ...patch } = edit;
    updateRoutineBlock(id, patch);
  }
  if (plan.add.length > 0) {
    createRoutineBlocks(
      plan.add.map((b) => ({
        date,
        startTime: b.startTime,
        endTime: b.endTime,
        title: b.title,
        module: b.module,
        energyRequired: b.energyRequired,
      })),
    );
  }
}

/**
 * Generate tomorrow's routine off the user's profile + the just-finished Reflect
 * record, and persist its blocks under tomorrow's date.
 */
export async function generateAndSaveTomorrow(opts: {
  profile: UserProfile;
  todayReview: GenerateTomorrowRoutineInput['todayReview'];
  softenForRecovery?: boolean;
}): Promise<GeneratedRoutine> {
  const tomorrow = format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  // Pull last-week domain minutes so the tomorrow planner can rebalance.
  // Dynamic import to avoid pulling the DB layer into modules that don't
  // already touch it (keeps Metro happy on web).
  const { computeLastWeekDomainMinutes } = await import('@/utils/routineBalance');
  let lastWeekDomainMinutes: GenerateTomorrowRoutineInput['lastWeekDomainMinutes'] | undefined;
  try {
    lastWeekDomainMinutes = computeLastWeekDomainMinutes();
  } catch { /* DB might not be ready on first launch — non-fatal */ }
  const routine = await generateTomorrowRoutine({
    tomorrowDate: tomorrow,
    profile: opts.profile,
    todayReview: opts.todayReview,
    softenForRecovery: opts.softenForRecovery,
    lastWeekDomainMinutes,
  });
  createRoutineBlocks(
    routine.blocks.map((b) => ({
      date: tomorrow,
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      module: b.module,
      energyRequired: b.energyRequired,
    })),
  );
  return routine;
}

/**
 * Lightweight recovery heuristic — true => the user looks depleted, so soften plans.
 * Uses: latest sleepHours + recent skipped-block count + last mood.
 * We deliberately keep this local (no AI call) so it's cheap to call from any screen.
 */
export function isRecoveryLow(opts: {
  lastSleepHours: number | null;
  skippedTodayCount: number;
  lastMood: number | null;
}): boolean {
  if (opts.lastSleepHours !== null && opts.lastSleepHours < 6) return true;
  if (opts.skippedTodayCount >= 3) return true;
  if (opts.lastMood !== null && opts.lastMood <= 2) return true;
  return false;
}

/**
 * Generate a full 7-day routine starting from `startDate` and persist every day's
 * blocks. Existing blocks on overlapping dates are deleted first so the user
 * never ends up with duplicates. Returns the AI response for UI rendering.
 *
 * Pulls protectedInterests + lastWeekDomainMinutes automatically so callers
 * only need to pass the profile and primaryDomains.
 */
export async function generateAndSaveWeek(opts: {
  userId: string;
  startDate: string;
  profile: UserProfile;
  primaryDomains: string[];
}): Promise<GeneratedWeekRoutine> {
  let protectedInterests: { name: string; weeklyMinutes: number }[] | undefined;
  try {
    const { getInterestsByUser } = await import('@/db/queries/interests');
    protectedInterests = getInterestsByUser(opts.userId)
      .filter((i) => i.timeProtected && i.status !== 'deleted')
      .map((i) => ({ name: i.name, weeklyMinutes: i.weeklyMinutesTarget }));
    if (protectedInterests.length === 0) protectedInterests = undefined;
  } catch { /* non-fatal */ }

  let lastWeekMinutes:
    | { goals?: number; health?: number; finance?: number; career?: number; social?: number; mind?: number }
    | undefined;
  try {
    const { computeLastWeekDomainMinutes } = await import('@/utils/routineBalance');
    lastWeekMinutes = computeLastWeekDomainMinutes();
  } catch { /* non-fatal */ }

  const week = await generateWeekRoutine({
    startDate: opts.startDate,
    profile: opts.profile,
    primaryDomains: opts.primaryDomains,
    protectedInterests,
    lastWeekDomainMinutes: lastWeekMinutes,
  });

  // Persist — wipe each day first to avoid duplicates if the user regenerates.
  for (const day of week.days) {
    deleteRoutineBlocksByDate(day.date);
    createRoutineBlocks(
      day.blocks.map((b) => ({
        date: day.date,
        startTime: b.startTime,
        endTime: b.endTime,
        title: b.title,
        module: b.module,
        energyRequired: b.energyRequired,
      })),
    );
  }

  return week;
}
