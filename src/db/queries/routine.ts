import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../index';
import { routineBlocks } from '../schema';

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

export function createRoutineBlock(data: RoutineBlockInsert) {
  const id = nanoid();
  const now = new Date().toISOString();
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
  const values = blocks.map((b) => ({
    id: nanoid(),
    ...b,
    createdAt: now,
    updatedAt: now,
  }));
  for (const v of values) {
    db.insert(routineBlocks).values(v).run();
  }
  return values.map((v) => v.id);
}

export function getRoutineBlocksByDate(date: string) {
  return db.select().from(routineBlocks)
    .where(eq(routineBlocks.date, date))
    .all();
}

export function updateRoutineBlockStatus(id: string, status: string) {
  db.update(routineBlocks)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(routineBlocks.id, id))
    .run();
}

export function deleteRoutineBlocksByDate(date: string) {
  db.delete(routineBlocks).where(eq(routineBlocks.date, date)).run();
}
