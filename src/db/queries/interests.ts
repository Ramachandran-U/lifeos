import { Platform } from 'react-native';
import { eq, and, ne } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { interests, explorationLog } from '../schema';
import {
  webInsertInterest,
  webGetInterestsByUser,
  webUpdateInterest,
  webSoftDeleteInterest,
  webInsertExploration,
  webGetExplorationByInterest,
  webGetExplorationForUser,
  type WebInterest,
  type WebExplorationLog,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

export type Interest = WebInterest;
export type ExplorationLog = WebExplorationLog;

export interface CreateInterestInput {
  userId: string;
  name: string;
  category: string;
  weeklyMinutesTarget: number;
  enjoymentLevel?: number;
  explorationDepth?: string;
  discoveredBy?: string;
}

export function createInterest(input: CreateInterestInput): string {
  const id = nanoid();
  const now = new Date().toISOString();
  const record: Interest = {
    id,
    userId: input.userId,
    name: input.name,
    category: input.category,
    weeklyMinutesTarget: input.weeklyMinutesTarget,
    weeklyMinutesActual: 0,
    enjoymentLevel: input.enjoymentLevel,
    explorationDepth: input.explorationDepth ?? 'taste',
    status: 'active',
    discoveredBy: input.discoveredBy ?? 'user',
    timeProtected: false,
    createdAt: now,
    updatedAt: now,
  };
  if (isWeb) {
    webInsertInterest(record);
    return id;
  }
  db.insert(interests).values({
    id,
    userId: record.userId,
    name: record.name,
    category: record.category,
    weeklyMinutesTarget: record.weeklyMinutesTarget,
    weeklyMinutesActual: 0,
    enjoymentLevel: record.enjoymentLevel,
    explorationDepth: record.explorationDepth,
    status: record.status,
    discoveredBy: record.discoveredBy,
    timeProtected: false,
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

export function getInterestsByUser(userId: string): Interest[] {
  if (isWeb) return webGetInterestsByUser(userId);
  const rows = db
    .select()
    .from(interests)
    .where(and(eq(interests.userId, userId), ne(interests.status, 'deleted')))
    .all();
  return rows as Interest[];
}

export function updateInterest(id: string, data: Partial<Interest>): void {
  if (isWeb) {
    webUpdateInterest(id, data);
    return;
  }
  db.update(interests)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(interests.id, id))
    .run();
}

export function softDeleteInterest(id: string): void {
  if (isWeb) {
    webSoftDeleteInterest(id);
    return;
  }
  db.update(interests)
    .set({ status: 'deleted', updatedAt: new Date().toISOString() })
    .where(eq(interests.id, id))
    .run();
}

export interface CreateExplorationInput {
  interestId: string;
  date: string; // YYYY-MM-DD
  minutesSpent: number;
  notes?: string;
}

export function logExploration(input: CreateExplorationInput): string {
  const id = nanoid();
  const now = new Date().toISOString();
  const record: ExplorationLog = {
    id,
    interestId: input.interestId,
    date: input.date,
    minutesSpent: input.minutesSpent,
    notes: input.notes,
    createdAt: now,
  };
  if (isWeb) {
    webInsertExploration(record);
    return id;
  }
  db.insert(explorationLog).values(record).run();
  return id;
}

export function getExplorationByInterest(interestId: string): ExplorationLog[] {
  if (isWeb) return webGetExplorationByInterest(interestId);
  const rows = db
    .select()
    .from(explorationLog)
    .where(eq(explorationLog.interestId, interestId))
    .all();
  return rows as ExplorationLog[];
}

export function getExplorationForUser(userId: string): ExplorationLog[] {
  if (isWeb) return webGetExplorationForUser([userId]);
  // Native: join via interests table
  const userInterests = getInterestsByUser(userId);
  const ids = userInterests.map((i) => i.id);
  if (ids.length === 0) return [];
  const rows = db
    .select()
    .from(explorationLog)
    .all() as ExplorationLog[];
  return rows.filter((r) => ids.includes(r.interestId));
}
