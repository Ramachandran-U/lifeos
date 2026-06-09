import { subDays, format } from 'date-fns';
import { load, save } from './_io';
import { QUESTS_KEY } from './_keys';

export interface WebQuest {
  id: string;
  userId: string;
  dayLocal: string;
  kind: string; // 'daily' | 'weekly'
  title: string;
  module: string;
  metricKey: string;
  target: number;
  progress: number;
  xp: number;
  status: string; // 'active' | 'completed' | 'claimed' | 'rerolled'
  source: string; // 'template' | 'ai'
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** History UI never looks back further than ~30 days. */
const QUEST_RETENTION_DAYS = 35;

function prune(all: WebQuest[]): WebQuest[] {
  const cutoff = format(subDays(new Date(), QUEST_RETENTION_DAYS), 'yyyy-MM-dd');
  return all.filter((q) => q.dayLocal >= cutoff);
}

export function webInsertQuest(quest: WebQuest): void {
  const all = prune(load<WebQuest>(QUESTS_KEY));
  all.push(quest);
  try {
    save(QUESTS_KEY, all);
  } catch {
    /* best-effort — losing a quest row must never break the UI */
  }
}

export function webUpdateQuest(id: string, data: Partial<Omit<WebQuest, 'id' | 'userId' | 'createdAt'>>): void {
  const all = load<WebQuest>(QUESTS_KEY);
  const idx = all.findIndex((q) => q.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  try {
    save(QUESTS_KEY, all);
  } catch {
    /* best-effort */
  }
}

export function webGetQuestById(id: string): WebQuest | undefined {
  return load<WebQuest>(QUESTS_KEY).find((q) => q.id === id);
}

export function webGetQuestsByDay(userId: string, dayLocal: string): WebQuest[] {
  return load<WebQuest>(QUESTS_KEY).filter(
    (q) => q.userId === userId && q.dayLocal === dayLocal && !q.deletedAt,
  );
}
