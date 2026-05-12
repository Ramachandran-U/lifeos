import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userProfiles } from '@/db/schema';
import { emptyUserProfile, UserProfile, UserProfileSchema } from '@/ai/types';
import { webGetUserProfile, webUpsertUserProfile } from '@/db/webStorage';

const isWeb = Platform.OS === 'web';

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (isWeb) return webGetUserProfile(userId);
  const row = db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
  if (!row) return null;
  const parsed = UserProfileSchema.safeParse(JSON.parse(row.profile));
  return parsed.success ? parsed.data : null;
}

export async function upsertUserProfile(userId: string, profile: UserProfile): Promise<void> {
  const next: UserProfile = { ...profile, lastUpdated: new Date().toISOString() };
  if (isWeb) {
    webUpsertUserProfile(userId, next);
    return;
  }
  const existing = db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
  const now = new Date().toISOString();
  if (existing) {
    db.update(userProfiles)
      .set({
        profile: JSON.stringify(next),
        source: next.source,
        confidenceOverall: next.confidence.overall,
        routineUnlocked: next.confidence.overall >= 0.7,
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, userId))
      .run();
  } else {
    db.insert(userProfiles)
      .values({
        userId,
        profile: JSON.stringify(next),
        source: next.source,
        confidenceOverall: next.confidence.overall,
        routineUnlocked: next.confidence.overall >= 0.7,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

export async function getOrInitUserProfile(
  userId: string,
  source: UserProfile['source'] = 'chat',
): Promise<UserProfile> {
  const existing = await getUserProfile(userId);
  if (existing) return existing;
  const fresh = emptyUserProfile(source);
  await upsertUserProfile(userId, fresh);
  return fresh;
}
