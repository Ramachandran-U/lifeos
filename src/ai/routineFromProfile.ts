import { format } from 'date-fns';
import { planRoutineWithContext } from './routinePlanner';
import type { UserProfile, RoutineInput, GeneratedRoutine } from './types';
import { ROUTINE_CONFIDENCE_THRESHOLD } from './types';
import { createRoutineBlocks } from '@/db/queries/routine';

export class ProfileNotReadyError extends Error {
  constructor(public confidenceOverall: number) {
    super(
      `Profile confidence ${(confidenceOverall * 100).toFixed(0)}% is below the ${(ROUTINE_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% threshold needed to generate a routine.`,
    );
    this.name = 'ProfileNotReadyError';
  }
}

const DEFAULT_WAKE = '07:00';
const DEFAULT_SLEEP = '23:00';
const DEFAULT_WORK_START = '09:30';
const DEFAULT_WORK_END = '18:30';

/** Schedule fields from the users table — the canonical source when the
 *  UserProfile's schedule fields are null (the mirror can silently fail). */
export interface UserScheduleFallback {
  wakeTime?: string | null;
  sleepTime?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
}

export function profileToRoutineInput(
  profile: UserProfile,
  userFallback?: UserScheduleFallback | null,
): RoutineInput {
  const fb = userFallback ?? {};
  return {
    wakeTime: profile.schedule.wakeTime ?? fb.wakeTime ?? DEFAULT_WAKE,
    sleepTime: profile.schedule.sleepTime ?? fb.sleepTime ?? DEFAULT_SLEEP,
    workStartTime: profile.schedule.workStartTime ?? fb.workStartTime ?? DEFAULT_WORK_START,
    workEndTime: profile.schedule.workEndTime ?? fb.workEndTime ?? DEFAULT_WORK_END,
    goals: profile.vision.topGoals,
    chronotype: profile.chronotype,
    primaryDomains: profile.primaryDomains,
    fixedBlocks: profile.schedule.fixedBlocks,
    constraints: profile.constraints,
    struggles: profile.struggles,
    currentHabits: profile.habits.current,
    communicationTone: profile.communication.tone,
    inferredPreferences: {
      preferredBlockMinutes: profile.inferredPreferences.preferredBlockMinutes,
      productiveHours: profile.inferredPreferences.productiveHours,
      droppedHabits: profile.inferredPreferences.droppedHabits,
      preferredRestDays: profile.inferredPreferences.preferredRestDays,
    },
  };
}

/**
 * Generate a routine from a UserProfile and persist today's blocks.
 * Gated on profile.confidence.overall >= ROUTINE_CONFIDENCE_THRESHOLD.
 */
export async function generateRoutineFromProfile(profile: UserProfile): Promise<GeneratedRoutine> {
  if (profile.confidence.overall < ROUTINE_CONFIDENCE_THRESHOLD) {
    throw new ProfileNotReadyError(profile.confidence.overall);
  }
  // Read the users table as a schedule fallback — the profile's schedule fields
  // may be null if the mirror from day1-routine failed silently.
  let userFb: UserScheduleFallback | null = null;
  try {
    const { getUser } = await import('@/db/queries/users');
    const user = getUser();
    if (user) userFb = user;
  } catch { /* non-fatal */ }
  const input = profileToRoutineInput(profile, userFb);
  return planRoutineWithContext(input);
}

export async function generateAndSaveRoutineForToday(profile: UserProfile): Promise<GeneratedRoutine> {
  const routine = await generateRoutineFromProfile(profile);
  const today = format(new Date(), 'yyyy-MM-dd');
  createRoutineBlocks(
    routine.blocks.map((b) => ({
      date: today,
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      module: b.module,
      energyRequired: b.energyRequired,
    })),
  );
  return routine;
}
