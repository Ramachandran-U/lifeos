import { load, save } from './_io';
import { ROUTINE_KEY } from './_keys';

export interface WebRoutineBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  linkedEntityId?: string;
  status: string;
  calendarEventId?: string;
  energyRequired?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export function webInsertRoutineBlock(block: WebRoutineBlock): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  all.push(block);
  save(ROUTINE_KEY, all);
}

// Sort on read (not write) for parity with an eventual SQL `ORDER BY date,
// start_time`. Storage stays insertion-ordered; callers always get a stable
// chronological order regardless of insert sequence. (BUG-014)
function byDateThenStart(a: WebRoutineBlock, b: WebRoutineBlock): number {
  return a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date);
}

export function webGetRoutineBlocksByDate(date: string): WebRoutineBlock[] {
  return load<WebRoutineBlock>(ROUTINE_KEY).filter((b) => b.date === date).sort(byDateThenStart);
}

export function webGetRoutineBlocksInRange(startDate: string, endDate: string): WebRoutineBlock[] {
  return load<WebRoutineBlock>(ROUTINE_KEY)
    .filter((b) => b.date >= startDate && b.date <= endDate)
    .sort(byDateThenStart);
}

export function webUpdateRoutineBlockStatus(id: string, status: string): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() };
  save(ROUTINE_KEY, all);
}

export function webDeleteRoutineBlocksByDate(date: string): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY).filter((b) => b.date !== date);
  save(ROUTINE_KEY, all);
}

export function webDeleteRoutineBlockById(id: string): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY).filter((b) => b.id !== id);
  save(ROUTINE_KEY, all);
}

/** Upsert a full routine-block row by id. Used by the sync reducer to apply
 *  remote state directly (echo-safe — never records a mutation). */
export function webUpsertRoutineBlockById(block: WebRoutineBlock): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  const idx = all.findIndex((b) => b.id === block.id);
  if (idx === -1) all.push(block);
  else all[idx] = block;
  save(ROUTINE_KEY, all);
}

export function webUpdateRoutineBlock(id: string, data: Partial<WebRoutineBlock>): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  save(ROUTINE_KEY, all);
}

export function webSetRoutineBlockCalendarEventId(id: string, calendarEventId: string | null): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return;
  all[idx] = {
    ...all[idx],
    calendarEventId: calendarEventId ?? undefined,
    updatedAt: new Date().toISOString(),
  };
  save(ROUTINE_KEY, all);
}
