// computeOverdue / computeSocialScore are pure, but they live in a module that
// also imports the drizzle-backed DB layer (ESM that jest doesn't transform).
// Mock those boundaries so only the pure logic loads.
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), and: jest.fn(), isNull: jest.fn() }));
jest.mock('@/db/index', () => ({ db: {} }));
jest.mock('@/db/schema', () => ({ contacts: {}, contactInteractions: {} }));
jest.mock('@/utils/id', () => ({ nanoid: () => 'test-id' }));
jest.mock('@/db/webStorage', () => ({}));

import {
  computeOverdue,
  computeSocialScore,
  RELATIONSHIP_META,
  type Contact,
} from '@/db/queries/social';

function contact(over: Partial<Contact> = {}): Contact {
  const now = '2026-05-01T00:00:00.000Z';
  return {
    id: 'c1',
    userId: 'u1',
    name: 'Test',
    nickname: null,
    relationshipType: 'inner_circle',
    preferredCadenceDays: 7,
    lastContactDate: '2026-05-01',
    notes: null,
    birthday: null,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...over,
  };
}

describe('computeOverdue', () => {
  const today = new Date('2026-05-20T12:00:00.000Z');

  it('is not overdue inside the cadence window', () => {
    const c = contact({ preferredCadenceDays: 7, lastContactDate: '2026-05-18' }); // 2 days ago
    const o = computeOverdue(c, today);
    expect(o.daysSinceContact).toBe(2);
    expect(o.isOverdue).toBe(false);
  });

  it('is not overdue exactly at the cadence × 1.2 threshold', () => {
    // cadence 10 → threshold 12 days. 12 days ago is NOT > 12, so not overdue.
    const c = contact({ preferredCadenceDays: 10, lastContactDate: '2026-05-08' }); // 12 days ago
    const o = computeOverdue(c, today);
    expect(o.daysSinceContact).toBe(12);
    expect(o.isOverdue).toBe(false);
  });

  it('is overdue just past the cadence × 1.2 threshold', () => {
    // cadence 10 → threshold 12. 13 days ago IS > 12 → overdue.
    const c = contact({ preferredCadenceDays: 10, lastContactDate: '2026-05-07' }); // 13 days ago
    const o = computeOverdue(c, today);
    expect(o.daysSinceContact).toBe(13);
    expect(o.isOverdue).toBe(true);
    expect(o.overdueBy).toBe(3); // 13 - 10
  });

  it('anchors on createdAt when there is no lastContactDate', () => {
    const c = contact({
      lastContactDate: null,
      createdAt: '2026-05-01T00:00:00.000Z', // 19 days before today
      preferredCadenceDays: 7,
    });
    const o = computeOverdue(c, today);
    expect(o.daysSinceContact).toBe(19);
    expect(o.isOverdue).toBe(true);
  });

  it('treats a future lastContactDate as not overdue (negative days)', () => {
    const c = contact({ lastContactDate: '2026-05-25', preferredCadenceDays: 7 });
    const o = computeOverdue(c, today);
    expect(o.daysSinceContact).toBeLessThan(0);
    expect(o.isOverdue).toBe(false);
    expect(o.overdueBy).toBe(0);
  });
});

describe('computeSocialScore', () => {
  const today = new Date('2026-05-20T12:00:00.000Z');

  it('returns null for an empty contact list (no data, not a misleading 0)', () => {
    expect(computeSocialScore([])).toBeNull();
  });

  it('is 100 when everyone is in cadence', () => {
    const list = [
      contact({ id: 'a', lastContactDate: '2026-05-19', preferredCadenceDays: 7 }),
      contact({ id: 'b', lastContactDate: '2026-05-18', preferredCadenceDays: 14 }),
    ];
    // Uses real "today" inside computeSocialScore (no injectable date), so use
    // recent dates relative to now would be flaky. Instead assert the helper
    // delegates to computeOverdue correctly by checking the math via a spy-free
    // proxy: both contacts contacted "today-ish" are in cadence.
    // To keep this deterministic we rebuild with dates near the real today:
    const realToday = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const recent = [
      contact({ id: 'a', lastContactDate: iso(realToday), preferredCadenceDays: 7 }),
      contact({ id: 'b', lastContactDate: iso(realToday), preferredCadenceDays: 14 }),
    ];
    expect(computeSocialScore(recent)).toBe(100);
    void list; void today;
  });

  it('is 50 when half are overdue', () => {
    const realToday = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const old = new Date(realToday);
    old.setDate(old.getDate() - 60);
    const list = [
      contact({ id: 'a', lastContactDate: iso(realToday), preferredCadenceDays: 7 }),
      contact({ id: 'b', lastContactDate: iso(old), preferredCadenceDays: 7 }), // way overdue
    ];
    expect(computeSocialScore(list)).toBe(50);
  });
});

describe('RELATIONSHIP_META', () => {
  it('has a default cadence for every relationship tier', () => {
    for (const tier of Object.keys(RELATIONSHIP_META) as Array<keyof typeof RELATIONSHIP_META>) {
      expect(RELATIONSHIP_META[tier].defaultCadenceDays).toBeGreaterThan(0);
      expect(RELATIONSHIP_META[tier].label.length).toBeGreaterThan(0);
    }
  });
});
