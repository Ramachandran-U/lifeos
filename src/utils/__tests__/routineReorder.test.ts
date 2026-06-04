import { reorderBlocksFixedSlots, type SlotBlock } from '../routineReorder';

const block = (start: string, end: string, title: string, module = 'goal'): SlotBlock => ({
  startTime: start, endTime: end, title, module,
});

// Three slots of deliberately different lengths, so we can prove the time
// windows stay pinned to positions while the activities move between them.
const base: SlotBlock[] = [
  block('09:00', '10:00', 'Deep work', 'career'),   // 60m slot
  block('12:30', '13:00', 'Walk', 'health'),         // 30m slot
  block('18:00', '19:30', 'Read', 'polymath'),       // 90m slot
];

describe('reorderBlocksFixedSlots', () => {
  it('moves activity content down while time windows stay pinned to slots', () => {
    const out = reorderBlocksFixedSlots(base, 0, 2);
    expect(out.map((b) => b.title)).toEqual(['Walk', 'Read', 'Deep work']);
    // Time windows unchanged, in original positional order.
    expect(out.map((b) => `${b.startTime}-${b.endTime}`)).toEqual(['09:00-10:00', '12:30-13:00', '18:00-19:30']);
    // The activity that moved adopts its new slot's window.
    expect(out[2]).toMatchObject({ title: 'Deep work', startTime: '18:00', endTime: '19:30' });
  });

  it('moves an activity up', () => {
    const out = reorderBlocksFixedSlots(base, 2, 0);
    expect(out.map((b) => b.title)).toEqual(['Read', 'Deep work', 'Walk']);
    expect(out.map((b) => b.startTime)).toEqual(['09:00', '12:30', '18:00']);
  });

  it('is a no-op when from === to or indices are out of range', () => {
    expect(reorderBlocksFixedSlots(base, 1, 1)).toBe(base);
    expect(reorderBlocksFixedSlots(base, -1, 2)).toBe(base);
    expect(reorderBlocksFixedSlots(base, 0, 9)).toBe(base);
  });

  it('does not mutate the input array', () => {
    const snapshot = base.map((b) => ({ ...b }));
    reorderBlocksFixedSlots(base, 0, 2);
    expect(base).toEqual(snapshot);
  });
});
