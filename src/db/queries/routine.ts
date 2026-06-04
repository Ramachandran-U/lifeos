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
import { recordMutation } from '@/sync/runtime';

const isWeb = Platform.OS === 'web';

function readBlockSnapshot(id: string): Record<string, unknown> | null {
  if (isWeb) {
    // Web has no by-id helper; scan the last ~31 days which covers the
    // Today/Reflect mutation surface. Older blocks won't be captured but
    // those aren't user-mutated.
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 31);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = today.toISOString().slice(0, 10);
    const found = webGetRoutineBlocksInRange(startStr, endStr).find((b) => b.id === id);
    return found ? (found as unknown as Record<string, unknown>) : null;
  }
  const row = db.select().from(routineBlocks).where(eq(routineBlocks.id, id)).get();
  return row ? (row as unknown as Record<string, unknown>) : null;
}

/**
 * A single routine block by id, or null. Used to re-validate a proposed coach
 * action's `ref` against current state before committing it (see
 * actionQueue.commitActions) — a ref captured at agent-run time may be stale by
 * the time the user confirms.
 */
export function getRoutineBlockById(id: string): Record<string, unknown> | null {
  return readBlockSnapshot(id);
}

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
  const snapshot = toWebBlock(id, data, now);
  if (isWeb) {
    webInsertRoutineBlock(snapshot);
  } else {
    db.insert(routineBlocks).values({
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    }).run();
  }
  recordMutation({ entity: 'routine_blocks', entityId: id, op: 'insert', before: null, after: snapshot as unknown as Record<string, unknown> });
  return id;
}

export function createRoutineBlocks(blocks: RoutineBlockInsert[]) {
  const now = new Date().toISOString();
  const ids = blocks.map(() => nanoid());
  if (isWeb) {
    blocks.forEach((b, i) => webInsertRoutineBlock(toWebBlock(ids[i], b, now)));
  } else {
    for (let i = 0; i < blocks.length; i++) {
      db.insert(routineBlocks).values({
        id: ids[i],
        ...blocks[i],
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }
  for (let i = 0; i < blocks.length; i++) {
    const snapshot = toWebBlock(ids[i], blocks[i], now);
    recordMutation({ entity: 'routine_blocks', entityId: ids[i], op: 'insert', before: null, after: snapshot as unknown as Record<string, unknown> });
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
  const before = readBlockSnapshot(id);
  const now = new Date().toISOString();
  if (isWeb) {
    webUpdateRoutineBlockStatus(id, status);
  } else {
    db.update(routineBlocks)
      .set({ status, updatedAt: now })
      .where(eq(routineBlocks.id, id))
      .run();
  }
  recordMutation({ entity: 'routine_blocks', entityId: id, op: 'update', before, after: { ...(before ?? {}), status, updatedAt: now } });
}

export function updateRoutineBlock(id: string, patch: {
  startTime?: string;
  endTime?: string;
  title?: string;
  module?: string;
}) {
  const before = readBlockSnapshot(id);
  const now = new Date().toISOString();
  if (isWeb) {
    webUpdateRoutineBlock(id, patch);
  } else {
    db.update(routineBlocks)
      .set({ ...patch, updatedAt: now })
      .where(eq(routineBlocks.id, id))
      .run();
  }
  recordMutation({ entity: 'routine_blocks', entityId: id, op: 'update', before, after: { ...(before ?? {}), ...patch, updatedAt: now } });
}

export function setRoutineBlockCalendarEventId(id: string, calendarEventId: string | null) {
  const before = readBlockSnapshot(id);
  const now = new Date().toISOString();
  if (isWeb) {
    webSetRoutineBlockCalendarEventId(id, calendarEventId);
  } else {
    db.update(routineBlocks)
      .set({ calendarEventId: calendarEventId ?? null, updatedAt: now })
      .where(eq(routineBlocks.id, id))
      .run();
  }
  recordMutation({ entity: 'routine_blocks', entityId: id, op: 'update', before, after: { ...(before ?? {}), calendarEventId, updatedAt: now } });
}

export function deleteRoutineBlocksByDate(date: string) {
  // Snapshot the deleted set before purging so each tombstone records the
  // prior row. Empty days are a no-op.
  const blocks = isWeb
    ? webGetRoutineBlocksByDate(date)
    : db.select().from(routineBlocks).where(eq(routineBlocks.date, date)).all();
  if (isWeb) {
    webDeleteRoutineBlocksByDate(date);
  } else {
    db.delete(routineBlocks).where(eq(routineBlocks.date, date)).run();
  }
  for (const b of blocks) {
    recordMutation({ entity: 'routine_blocks', entityId: b.id, op: 'delete', before: b as unknown as Record<string, unknown>, after: null });
  }
}

export function deleteRoutineBlock(id: string) {
  const before = readBlockSnapshot(id);
  if (isWeb) {
    webDeleteRoutineBlockById(id);
  } else {
    db.delete(routineBlocks).where(eq(routineBlocks.id, id)).run();
  }
  recordMutation({ entity: 'routine_blocks', entityId: id, op: 'delete', before, after: null });
}
