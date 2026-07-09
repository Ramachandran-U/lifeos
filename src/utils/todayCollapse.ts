/**
 * Collapse-completed segmentation for Today's flow (flag `today_collapse_done_v1`).
 *
 * Finished blocks are history occupying prime screen space — "Answer first,
 * rest quiet". Maximal runs of consecutive finished blocks collapse into one
 * summary strip ("✓ 4 done · 2h 35m") that expands in place.
 *
 * The completion beat is protected by construction: only blocks that were
 * ALREADY finished when the screen loaded (`collapsibleIds`, captured in
 * loadData) collapse — a block completed during this visit stays expanded
 * (celebration + undo intact) and folds on the next visit.
 *
 * Pure — exported for unit tests; the Today screen owns all state/rendering.
 */

export interface CollapsibleBlock {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  status: string;
}

export type TodaySegment<B extends CollapsibleBlock = CollapsibleBlock> =
  | { kind: 'block'; block: B }
  | {
      kind: 'collapsed';
      /** Stable key = first block's id (used for expand/collapse state). */
      key: string;
      blocks: B[];
      doneCount: number;
      skippedCount: number;
      totalMinutes: number;
      /** True when the user expanded this run (strip still renders, blocks follow). */
      expanded: boolean;
    };

const FINISHED = new Set(['completed', 'skipped']);

export function isFinished(status: string): boolean {
  return FINISHED.has(status);
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** Sum of block durations (not wall-clock span — gaps between blocks don't count). */
export function totalBlockMinutes(blocks: Array<{ startTime: string; endTime: string }>): number {
  return blocks.reduce((sum, b) => sum + Math.max(0, toMin(b.endTime) - toMin(b.startTime)), 0);
}

/** "2h 35m" / "45m" / "2h" — compact strip duration. */
export function formatStripDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Split sorted blocks into render segments. A maximal run of consecutive
 * blocks that are finished AND in `collapsibleIds` becomes one 'collapsed'
 * segment; everything else passes through as 'block'.
 */
export function segmentTodayBlocks<B extends CollapsibleBlock>(
  sortedBlocks: B[],
  collapsibleIds: ReadonlySet<string>,
  expandedKeys: ReadonlySet<string>,
  allExpanded: boolean,
): Array<TodaySegment<B>> {
  const segments: Array<TodaySegment<B>> = [];
  let run: B[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    const key = run[0]!.id;
    segments.push({
      kind: 'collapsed',
      key,
      blocks: run,
      doneCount: run.filter((b) => b.status === 'completed').length,
      skippedCount: run.filter((b) => b.status === 'skipped').length,
      totalMinutes: totalBlockMinutes(run),
      expanded: allExpanded || expandedKeys.has(key),
    });
    run = [];
  };

  for (const block of sortedBlocks) {
    if (isFinished(block.status) && collapsibleIds.has(block.id)) {
      run.push(block);
    } else {
      flushRun();
      segments.push({ kind: 'block', block });
    }
  }
  flushRun();
  return segments;
}
