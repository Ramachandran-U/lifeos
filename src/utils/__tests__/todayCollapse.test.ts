/**
 * Collapse-completed segmentation (PARKED 16.11, flag today_collapse_done_v1).
 * Pure logic only — the Today screen owns state/rendering.
 */
import {
  segmentTodayBlocks,
  totalBlockMinutes,
  formatStripDuration,
  isFinished,
  type CollapsibleBlock,
} from '../todayCollapse';

const b = (id: string, status: string, startTime = '09:00', endTime = '10:00'): CollapsibleBlock => ({
  id,
  startTime,
  endTime,
  title: `Block ${id}`,
  module: 'goal',
  status,
});

const ids = (...xs: string[]) => new Set(xs);
const NONE = new Set<string>();

describe('segmentTodayBlocks', () => {
  it('folds a maximal run of collapsible finished blocks into one strip', () => {
    const blocks = [
      b('a', 'completed', '07:00', '07:30'),
      b('b', 'skipped', '07:30', '08:00'),
      b('c', 'upcoming', '08:00', '09:00'),
      b('d', 'completed', '09:00', '10:00'),
    ];
    const segs = segmentTodayBlocks(blocks, ids('a', 'b', 'd'), NONE, false);
    expect(segs.map((s) => s.kind)).toEqual(['collapsed', 'block', 'collapsed']);
    const first = segs[0]!;
    if (first.kind !== 'collapsed') throw new Error('expected collapsed');
    expect(first.key).toBe('a');
    expect(first.doneCount).toBe(1);
    expect(first.skippedCount).toBe(1);
    expect(first.totalMinutes).toBe(60);
    expect(first.expanded).toBe(false);
  });

  it('a finished block NOT in collapsibleIds stays a normal block (completed this visit)', () => {
    const segs = segmentTodayBlocks(
      [b('a', 'completed'), b('fresh', 'completed')],
      ids('a'), // 'fresh' finished during this visit — protected
      NONE,
      false,
    );
    expect(segs.map((s) => s.kind)).toEqual(['collapsed', 'block']);
  });

  it('upcoming / in_progress blocks never collapse even if listed as collapsible', () => {
    const segs = segmentTodayBlocks([b('a', 'upcoming')], ids('a'), NONE, false);
    expect(segs).toEqual([{ kind: 'block', block: b('a', 'upcoming') }]);
  });

  it('expandedKeys and allExpanded mark runs expanded (strip stays as the collapse handle)', () => {
    const blocks = [b('a', 'completed'), b('b', 'completed')];
    const byKey = segmentTodayBlocks(blocks, ids('a', 'b'), ids('a'), false)[0]!;
    if (byKey.kind !== 'collapsed') throw new Error('expected collapsed');
    expect(byKey.expanded).toBe(true);

    const byAll = segmentTodayBlocks(blocks, ids('a', 'b'), NONE, true)[0]!;
    if (byAll.kind !== 'collapsed') throw new Error('expected collapsed');
    expect(byAll.expanded).toBe(true);
    expect(byAll.blocks).toHaveLength(2);
  });

  it('empty collapsibleIds (flag off) is an identity passthrough', () => {
    const blocks = [b('a', 'completed'), b('c', 'upcoming')];
    expect(segmentTodayBlocks(blocks, NONE, NONE, false)).toEqual([
      { kind: 'block', block: blocks[0] },
      { kind: 'block', block: blocks[1] },
    ]);
  });
});

describe('duration helpers', () => {
  it('sums block durations, ignoring gaps between them', () => {
    expect(
      totalBlockMinutes([
        { startTime: '07:00', endTime: '07:30' },
        { startTime: '09:00', endTime: '10:15' }, // 90-min gap not counted
      ]),
    ).toBe(105);
  });

  it('formats compactly', () => {
    expect(formatStripDuration(45)).toBe('45m');
    expect(formatStripDuration(120)).toBe('2h');
    expect(formatStripDuration(155)).toBe('2h 35m');
    expect(formatStripDuration(0)).toBe('0m');
  });
});

describe('isFinished', () => {
  it('completed + skipped are finished; the rest are not', () => {
    expect(isFinished('completed')).toBe(true);
    expect(isFinished('skipped')).toBe(true);
    expect(isFinished('upcoming')).toBe(false);
    expect(isFinished('in_progress')).toBe(false);
  });
});
