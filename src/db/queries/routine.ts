import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { routineBlocks } from '../schema';
import {
  webInsertRoutineBlock,
  webGetRoutineBlocksByDate,
  webGetRoutineBlocksInRange,
  webUpdateRoutineBlockStatus,
  webUpdateRoutineBlock,
  webDeleteRoutineBlocksByDate,
  webDeleteRoutineBlockById,
  webSetRoutineBlockCalendarEventId,
  type WebRoutineBlock,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

type RoutineBlockInsert = {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  linkedEntityId?: string;
  energyRequired?: string;
  notes?: string;
};

function toWebBlock(id: string, data: RoutineBlockInsert, now: string): WebRoutineBlock {
  return {
    id,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    title: data.title,
    module: data.module,
    linkedEntityId: data.linkedEntityId,
    status: 'upcoming',
    energyRequired: data.energyRequired,
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export function createRoutineBlock(data: RoutineBlockInsert) {
  const id = nanoid();
  const now = new Date().toISOString();
  if (isWeb) {
    webInsertRoutineBlock(toWebBlock(id, data, now));
    return id;
  }
  db.insert(routineBlocks).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

export function createRoutineBlocks(blocks: RoutineBlockInsert[]) {
  const now = new Date().toISOString();
  const ids = blocks.map(() => nanoid());
  if (isWeb) {
    blocks.forEach((b, i) => webInsertRoutineBlock(toWebBlock(ids[i], b, now)));
    return ids;
  }
  for (let i = 0; i < blocks.length; i++) {
    db.insert(routineBlocks).values({
      id: ids[i],
      ...blocks[i],
      createdAt: now,
      updatedAt: now,
    }).run();
  }
  return ids;
}

export function getRoutineBlocksByDate(date: string) {
  if (isWeb) return webGetRoutineBlocksByDate(date);
  return db.select().from(routineBlocks)
    .where(eq(routineBlocks.date, date))
    .all();
}

import { and, gte, lte } from 'drizzle-orm';

export function getRoutineBlocksInRange(startDate: string, endDate: string) {
  if (isWeb) {
    return webGetRoutineBlocksInRange(startDate, endDate);
  }
  return db.select().from(routineBlocks)
    .where(and(gte(routineBlocks.date, startDate), lte(routineBlocks.date, endDate)))
    .all();
}

export function updateRoutineBlockStatus(id: string, status: string) {
  if (isWeb) {
    webUpdateRoutineBlockStatus(id, status);
    return;
  }
  db.update(routineBlocks)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(routineBlocks.id, id))
    .run();
}

export function updateRoutineBlock(id: string, patch: {
  startTime?: string;
  endTime?: string;
  title?: string;
  module?: string;
}) {
  if (isWeb) {
    webUpdateRoutineBlock(id, patch);
    return;
  }
  db.update(routineBlocks)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(routineBlocks.id, id))
    .run();
}

export function setRoutineBlockCalendarEventId(id: string, calendarEventId: string | null) {
  if (isWeb) {
    webSetRoutineBlockCalendarEventId(id, calendarEventId);
    return;
  }
  db.update(routineBlocks)
    .set({ calendarEventId: calendarEventId ?? null, updatedAt: new Date().toISOString() })
    .where(eq(routineBlocks.id, id))
    .run();
}

export function deleteRoutineBlocksByDate(date: string) {
  if (isWeb) {
    webDeleteRoutineBlocksByDate(date);
    return;
  }
  db.delete(routineBlocks).where(eq(routineBlocks.date, date)).run();
}

export function deleteRoutineBlock(id: string) {
  if (isWeb) {
    webDeleteRoutineBlockById(id);
    return;
  }
  db.delete(routineBlocks).where(eq(routineBlocks.id, id)).run();
}
