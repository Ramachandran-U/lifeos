import { Platform } from 'react-native';
import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { quests } from '../schema';
import {
  webInsertQuest,
  webUpdateQuest,
  webGetQuestById,
  webGetQuestsByDay,
  type WebQuest,
} from '../webStorage';
import { recordMutation } from '@/sync/runtime';
import type { QuestDraft } from '@/gamification/questEngine';

const isWeb = Platform.OS === 'web';

export type QuestStatus = 'active' | 'completed' | 'claimed' | 'rerolled';

export type QuestRecord = WebQuest;

/** Insert one quest row for a local day. Returns the new id. */
export function insertQuest(
  userId: string,
  dayLocal: string,
  draft: QuestDraft,
  // 'pinned' = the day-1 constructed first quest (cold_start_v1). The AI
  // personalization pass filters on source === 'template', so pinned rows are
  // excluded from retitle/retarget by construction.
  source: 'template' | 'ai' | 'pinned' = 'template',
): string {
  const id = nanoid();
  const now = new Date().toISOString();
  const row: WebQuest = {
    id,
    userId,
    dayLocal,
    kind: 'daily',
    title: draft.title,
    module: draft.module,
    metricKey: draft.metricKey,
    target: draft.target,
    progress: 0,
    xp: draft.xp,
    status: 'active',
    source,
    templateId: draft.templateId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  if (isWeb) {
    webInsertQuest(row);
  } else {
    db.insert(quests).values(row).run();
  }

  recordMutation({ entity: 'quests', entityId: id, op: 'insert', before: null, after: row as unknown as Record<string, unknown> });
  return id;
}

/** Today's (or any local day's) live quest rows, soft-deletes excluded. */
export function getQuestsByDay(userId: string, dayLocal: string): QuestRecord[] {
  if (isWeb) return webGetQuestsByDay(userId, dayLocal);
  return db.select().from(quests)
    .where(and(eq(quests.userId, userId), eq(quests.dayLocal, dayLocal), isNull(quests.deletedAt)))
    .all() as unknown as QuestRecord[];
}

export function getQuestById(id: string): QuestRecord | undefined {
  if (isWeb) return webGetQuestById(id);
  return db.select().from(quests).where(eq(quests.id, id)).get() as unknown as QuestRecord | undefined;
}

/** Field update + mutation log (full-snapshot before/after, like reflections). */
export function updateQuest(
  id: string,
  data: Partial<Pick<WebQuest, 'title' | 'target' | 'progress' | 'xp' | 'status' | 'source' | 'templateId'>>,
): void {
  const before = getQuestById(id);
  if (!before) return;
  const now = new Date().toISOString();

  if (isWeb) {
    webUpdateQuest(id, data);
  } else {
    db.update(quests).set({ ...data, updatedAt: now }).where(eq(quests.id, id)).run();
  }

  recordMutation({
    entity: 'quests',
    entityId: id,
    op: 'update',
    before: before as unknown as Record<string, unknown>,
    after: { ...(before as unknown as Record<string, unknown>), ...data, updatedAt: now },
  });
}
