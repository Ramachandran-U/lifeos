import type { UserProfile } from '@/ai/types';
import { load, save } from './_io';
import { USER_PROFILES_KEY } from './_keys';

interface WebUserProfileRecord {
  userId: string;
  profile: UserProfile;
}

export function webGetUserProfile(userId: string): UserProfile | null {
  const all = load<WebUserProfileRecord>(USER_PROFILES_KEY);
  const found = all.find((r) => r.userId === userId);
  return found ? found.profile : null;
}

export function webUpsertUserProfile(userId: string, profile: UserProfile): void {
  const all = load<WebUserProfileRecord>(USER_PROFILES_KEY);
  const idx = all.findIndex((r) => r.userId === userId);
  const record: WebUserProfileRecord = { userId, profile };
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  save(USER_PROFILES_KEY, all);
}
