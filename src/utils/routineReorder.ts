/**
 * Fixed-slot reorder for the routine editor.
 *
 * The user drags an *activity* to a new position, but the time windows stay
 * pinned to their slots (the day's schedule never shifts). So we move the
 * content (title/module/energy) within the array, then re-pin each position's
 * start/end time from the original ascending slot order.
 *
 * Pure + dependency-free so it's trivially unit-testable.
 */

export interface SlotBlock {
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  energyRequired?: string;
}

/** Move the activity at `from` to `to`, keeping every slot's time window fixed. */
export function reorderBlocksFixedSlots<T extends SlotBlock>(blocks: T[], from: number, to: number): T[] {
  const n = blocks.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return blocks;

  // The fixed time windows, in their original positional order.
  const slots = blocks.map((b) => ({ startTime: b.startTime, endTime: b.endTime }));

  // Move the content (the whole block) within the array…
  const content = blocks.slice();
  const [moved] = content.splice(from, 1);
  content.splice(to, 0, moved);

  // …then re-pin each position to its original slot's time window.
  return content.map((b, i) => ({ ...b, startTime: slots[i].startTime, endTime: slots[i].endTime }));
}
