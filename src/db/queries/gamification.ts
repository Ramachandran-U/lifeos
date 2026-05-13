import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { gamification } from '../schema';
import {
  webGetGamification,
  webUpsertGamification,
  webUpdateGamification,
  type WebGamification,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

const DEFAULT_DOMAIN_SCORES = JSON.stringify({
  goals: 0,
  health: 0,
  finance: 0,
  career: 0,
  social: 0,
  mind: 0,
});

const DEFAULT_STREAKS = JSON.stringify({
  workout: { count: 0, lastDate: '', graceUsed: false },
  learning: { count: 0, lastDate: '', graceUsed: false },
  foodTracking: { count: 0, lastDate: '', graceUsed: false },
  journaling: { count: 0, lastDate: '', graceUsed: false },
  social: { count: 0, lastDate: '', graceUsed: false },
});

export function getOrCreateGamification(userId: string): WebGamification {
  if (isWeb) {
    const existing = webGetGamification(userId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const fresh: WebGamification = {
      id: nanoid(),
      userId,
      domainScores: DEFAULT_DOMAIN_SCORES,
      streaks: DEFAULT_STREAKS,
      badges: '[]',
      totalXP: 0,
      weeklyXP: 0,
      createdAt: now,
      updatedAt: now,
    };
    webUpsertGamification(fresh);
    return fresh;
  }

  const existing = db.select().from(gamification)
    .where(eq(gamification.userId, userId))
    .get();

  if (existing) return existing as unknown as WebGamification;

  const id = nanoid();
  const now = new Date().toISOString();
  db.insert(gamification).values({
    id,
    userId,
    domainScores: DEFAULT_DOMAIN_SCORES,
    streaks: DEFAULT_STREAKS,
    badges: '[]',
    totalXP: 0,
    weeklyXP: 0,
    createdAt: now,
    updatedAt: now,
  }).run();

  return db.select().from(gamification)
    .where(eq(gamification.userId, userId))
    .get()! as unknown as WebGamification;
}

export function updateGamification(userId: string, data: Partial<{
  domainScores: string;
  streaks: string;
  badges: string;
  totalXP: number;
  weeklyXP: number;
}>) {
  if (isWeb) {
    webUpdateGamification(userId, data);
    return;
  }
  db.update(gamification)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(gamification.userId, userId))
    .run();
}
