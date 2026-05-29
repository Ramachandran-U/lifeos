import {
  stashReplan,
  readStash,
  clearStash,
  hasUndoableStash,
  stashRemainingMinutes,
  STASH_TTL_MS,
  type StashStorage,
  type ReplanStashEntry,
} from '../replanStash';

function inMemoryStorage(): StashStorage & { snapshot: () => Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    read: (k) => (k in store ? store[k]! : null),
    write: (k, v) => { store[k] = v; },
    remove: (k) => { delete store[k]; },
    snapshot: () => ({ ...store }),
  };
}

const payload: Omit<ReplanStashEntry, 'stashedAt'> = {
  droppedBlocks: [{ id: 'b1', date: '2026-05-30', startTime: '14:00', endTime: '15:00', title: 'Old', module: 'finance', status: 'upcoming' }],
  insertedBlockIds: ['new-1', 'new-2'],
  priorPriorities: ['goals', 'finance', 'health'],
};

describe('replanStash', () => {
  it('stashes and reads back a fresh entry', () => {
    const s = inMemoryStorage();
    stashReplan(s, 'u1', '2026-05-30', payload);
    const got = readStash(s, 'u1', '2026-05-30');
    expect(got?.insertedBlockIds).toEqual(['new-1', 'new-2']);
    expect(got?.priorPriorities).toEqual(['goals', 'finance', 'health']);
  });

  it('returns null when nothing is stashed', () => {
    expect(readStash(inMemoryStorage(), 'u1', '2026-05-30')).toBeNull();
  });

  it('auto-expires after the 24h TTL and removes the entry', () => {
    const s = inMemoryStorage();
    stashReplan(s, 'u1', '2026-05-30', payload, new Date('2026-05-30T00:00:00.000Z'));
    const tooLate = new Date('2026-05-31T00:00:01.000Z'); // just past 24h
    expect(readStash(s, 'u1', '2026-05-30', tooLate)).toBeNull();
    expect(s.snapshot()).toEqual({}); // cleaned
  });

  it('still readable just before the TTL boundary', () => {
    const s = inMemoryStorage();
    stashReplan(s, 'u1', '2026-05-30', payload, new Date('2026-05-30T00:00:00.000Z'));
    const justInTime = new Date(`2026-05-30T00:00:00.000Z`); // same moment
    const oneMinLater = new Date(justInTime.getTime() + 60 * 1000);
    expect(readStash(s, 'u1', '2026-05-30', oneMinLater)).not.toBeNull();
  });

  it('scopes by user and date', () => {
    const s = inMemoryStorage();
    stashReplan(s, 'u1', '2026-05-30', payload);
    expect(readStash(s, 'u2', '2026-05-30')).toBeNull();
    expect(readStash(s, 'u1', '2026-05-31')).toBeNull();
  });

  it('clearStash removes an entry', () => {
    const s = inMemoryStorage();
    stashReplan(s, 'u1', '2026-05-30', payload);
    expect(hasUndoableStash(s, 'u1', '2026-05-30')).toBe(true);
    clearStash(s, 'u1', '2026-05-30');
    expect(hasUndoableStash(s, 'u1', '2026-05-30')).toBe(false);
  });

  it('hasUndoableStash returns false when expired', () => {
    const s = inMemoryStorage();
    stashReplan(s, 'u1', '2026-05-30', payload, new Date('2026-05-30T00:00:00.000Z'));
    expect(hasUndoableStash(s, 'u1', '2026-05-30', new Date('2026-06-01T00:00:00.000Z'))).toBe(false);
  });

  it('stashRemainingMinutes counts down toward the TTL', () => {
    const s = inMemoryStorage();
    const t0 = new Date('2026-05-30T00:00:00.000Z');
    stashReplan(s, 'u1', '2026-05-30', payload, t0);
    expect(stashRemainingMinutes(s, 'u1', '2026-05-30', t0)).toBe(STASH_TTL_MS / 60000);
    const halfWay = new Date(t0.getTime() + STASH_TTL_MS / 2);
    expect(stashRemainingMinutes(s, 'u1', '2026-05-30', halfWay)).toBe(STASH_TTL_MS / 2 / 60000);
  });

  it('survives corrupt JSON gracefully', () => {
    const s = inMemoryStorage();
    s.write('lifeos_replan_stash:u1:2026-05-30', '{not json');
    expect(readStash(s, 'u1', '2026-05-30')).toBeNull();
  });
});
