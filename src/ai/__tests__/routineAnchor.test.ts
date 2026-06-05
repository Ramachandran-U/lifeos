/**
 * Wake-anchor — guarantees a generated routine begins at the user's wake time
 * (regressioning the "wake 10:00 → routine starts 12:00" bug). Pure + deterministic.
 */
import { anchorRoutineToWake, WAKE_GAP_THRESHOLD_MIN } from '../routineAnchor';
import type { GeneratedRoutine } from '../types';

type Block = GeneratedRoutine['blocks'][number];

const blk = (startTime: string, endTime: string, over: Partial<Block> = {}): Block => ({
  startTime,
  endTime,
  title: 'Work',
  module: 'work',
  energyRequired: 'medium',
  ...over,
});

describe('anchorRoutineToWake', () => {
  it('prepends a morning block when the day starts well after wake (the reported bug)', () => {
    const blocks = [blk('12:00', '13:00'), blk('14:00', '15:00')];
    const out = anchorRoutineToWake(blocks, '10:00');
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({
      startTime: '10:00',
      endTime: '12:00',
      title: 'Morning routine',
      module: 'rest',
      energyRequired: 'low',
    });
    // original blocks preserved, in order, after the opening
    expect(out.slice(1)).toEqual(blocks);
  });

  it('anchors to the first block even when work starts an hour after wake', () => {
    const out = anchorRoutineToWake([blk('11:00', '18:00')], '10:00');
    expect(out[0].startTime).toBe('10:00');
    expect(out[0].endTime).toBe('11:00');
    expect(out).toHaveLength(2);
  });

  it('does nothing when the first block already starts at wake', () => {
    const blocks = [blk('10:00', '11:00')];
    expect(anchorRoutineToWake(blocks, '10:00')).toBe(blocks);
  });

  it('does nothing when the first block is within the gap threshold of wake', () => {
    const blocks = [blk('10:25', '11:00')]; // 25 min < 30
    expect(anchorRoutineToWake(blocks, '10:00')).toBe(blocks);
  });

  it('treats the threshold as inclusive (exactly WAKE_GAP_THRESHOLD_MIN = no anchor)', () => {
    expect(WAKE_GAP_THRESHOLD_MIN).toBe(30);
    const blocks = [blk('10:30', '11:00')]; // exactly 30 min
    expect(anchorRoutineToWake(blocks, '10:00')).toBe(blocks);
  });

  it('anchors one minute past the threshold', () => {
    const out = anchorRoutineToWake([blk('10:31', '11:00')], '10:00');
    expect(out).toHaveLength(2);
    expect(out[0].startTime).toBe('10:00');
  });

  it('uses the EARLIEST block as the anchor target regardless of array order', () => {
    const out = anchorRoutineToWake([blk('15:00', '16:00'), blk('12:00', '13:00')], '10:00');
    expect(out[0].endTime).toBe('12:00'); // opens up to the earliest (12:00), not 15:00
  });

  it('does nothing for an empty routine', () => {
    expect(anchorRoutineToWake([], '10:00')).toEqual([]);
  });

  it('does nothing if a block somehow starts before wake (window guard owns that)', () => {
    const blocks = [blk('09:00', '10:00')];
    expect(anchorRoutineToWake(blocks, '10:00')).toBe(blocks);
  });

  it('does not mutate the input array', () => {
    const blocks = [blk('12:00', '13:00')];
    const snapshot = [...blocks];
    anchorRoutineToWake(blocks, '10:00');
    expect(blocks).toEqual(snapshot);
    expect(blocks).toHaveLength(1);
  });
});
