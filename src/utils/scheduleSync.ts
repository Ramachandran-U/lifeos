/**
 * Schedule single-source-of-truth helpers.
 *
 * Wake / sleep / work times live in two stores by design:
 *   1. `users` row (canonical) — read by the routine planner, notifications
 *      scheduler, and the day1-routine editor's prefill.
 *   2. `userProfile.schedule` — read by the discovery-chat / v2 onboarding
 *      flow and shown in the "What LifeOS knows" editor.
 *
 * Whenever the user edits a schedule field in either surface, BOTH stores
 * must end up consistent. Until 2026-05-14 these stayed out of sync, which
 * caused a real bug ("wake = 10am → routine starts at 7am") because the
 * planner read from one store while the user thought they edited the
 * other.
 *
 * Centralising the mirror here:
 *   - makes the contract explicit
 *   - is unit-testable (the live screen-level save() callbacks aren't)
 *   - means new surfaces that edit schedule call ONE helper, not two
 */

import { updateUser } from '@/db/queries/users';
import { getUserProfile, upsertUserProfile } from '@/db/queries/userProfile';

export interface ScheduleSlots {
  wakeTime?: string | null;
  sleepTime?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
}

/**
 * Mirror schedule fields onto the `users` row. Only fields that are
 * non-null/undefined are written — passing `{ wakeTime: '10:00' }` updates
 * only that column. Returns the field names that were actually written.
 */
export function mirrorScheduleToUser(userId: string, schedule: ScheduleSlots): string[] {
  const userUpdate: Parameters<typeof updateUser>[1] = {};
  const written: string[] = [];
  if (schedule.wakeTime) {
    userUpdate.wakeTime = schedule.wakeTime;
    written.push('wakeTime');
  }
  if (schedule.sleepTime) {
    userUpdate.sleepTime = schedule.sleepTime;
    written.push('sleepTime');
  }
  if (schedule.workStartTime) {
    userUpdate.workStartTime = schedule.workStartTime;
    written.push('workStartTime');
  }
  if (schedule.workEndTime) {
    userUpdate.workEndTime = schedule.workEndTime;
    written.push('workEndTime');
  }
  if (written.length > 0) updateUser(userId, userUpdate);
  return written;
}

/**
 * Mirror schedule fields onto `userProfile.schedule`. No-ops if no profile
 * exists for the user (the profile is only seeded after onboarding v2 or
 * discovery import). Returns the field names that were actually written.
 *
 * Async because `getUserProfile` / `upsertUserProfile` are async.
 */
export async function mirrorScheduleToProfile(
  userId: string,
  schedule: ScheduleSlots,
): Promise<string[]> {
  const profile = await getUserProfile(userId);
  if (!profile) return [];
  const next = {
    ...profile,
    schedule: {
      ...profile.schedule,
      ...(schedule.wakeTime !== undefined ? { wakeTime: schedule.wakeTime } : {}),
      ...(schedule.sleepTime !== undefined ? { sleepTime: schedule.sleepTime } : {}),
      ...(schedule.workStartTime !== undefined ? { workStartTime: schedule.workStartTime } : {}),
      ...(schedule.workEndTime !== undefined ? { workEndTime: schedule.workEndTime } : {}),
    },
  };
  await upsertUserProfile(userId, next);
  const written: string[] = [];
  for (const k of ['wakeTime', 'sleepTime', 'workStartTime', 'workEndTime'] as const) {
    if (schedule[k] !== undefined) written.push(k);
  }
  return written;
}
