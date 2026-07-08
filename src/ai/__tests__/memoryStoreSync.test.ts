/**
 * Storage-bound memory store tests (web mode) — the two behaviours added by
 * the memory-loop PR:
 *
 *  1. `searchFacts` WORKS on web (it used to hard-return [] there) — the web
 *     store rows are ranked by the same hash-embedding cosine as native.
 *  2. Every memory write records a mutation (entity `memory_facts` /
 *     `memory_suppressions`) so facts ride the existing cross-device sync.
 *
 * memoryStore computes `isWeb` at module load, so Platform.OS is forced to
 * 'web' BEFORE the module is required (no top-level import of the SUT).
 * The embedder is the real hash embedder (no VOYAGE_API_KEY in jest), which is
 * deterministic — same text ⇒ same vector — exactly what dedup relies on.
 */
import { Platform } from 'react-native';

jest.mock('@/sync/runtime', () => ({ recordMutation: jest.fn() }));

// Stateful in-memory stand-in for the localStorage-backed web store.
const factRows: Array<Record<string, unknown>> = [];
const suppressionRows: Array<Record<string, unknown>> = [];
jest.mock('@/db/webStorage/memory', () => ({
  webGetFactsByUser: (userId: string) => factRows.filter((r) => r.userId === userId),
  webGetFactById: (id: string) => factRows.find((r) => r.id === id) ?? null,
  webInsertFact: (row: Record<string, unknown>) => { factRows.push(row); },
  webUpdateFact: (id: string, patch: Record<string, unknown>) => {
    const idx = factRows.findIndex((r) => r.id === id);
    if (idx !== -1) factRows[idx] = { ...factRows[idx], ...patch };
  },
  webDeleteFact: (id: string) => {
    const idx = factRows.findIndex((r) => r.id === id);
    if (idx !== -1) factRows.splice(idx, 1);
  },
  webDeleteAllFactsForUser: (userId: string) => {
    for (let i = factRows.length - 1; i >= 0; i--) {
      if (factRows[i]!.userId === userId) factRows.splice(i, 1);
    }
  },
  webGetSuppressionsByUser: (userId: string) => suppressionRows.filter((r) => r.userId === userId),
  webInsertSuppression: (row: Record<string, unknown>) => { suppressionRows.push(row); },
  webUpsertFactById: jest.fn(),
  webUpsertSuppressionById: jest.fn(),
  webDeleteSuppression: jest.fn(),
}));

// The native drizzle path must not be touched in web mode.
jest.mock('@/db', () => ({ db: {} }));

import { recordMutation } from '@/sync/runtime';

const mRecord = recordMutation as jest.Mock;

// Required AFTER Platform.OS is forced, so module-load isWeb === true.
let store: typeof import('../rag/memoryStore');

beforeAll(() => {
  Platform.OS = 'web' as typeof Platform.OS;
  store = require('../rag/memoryStore');
});

afterAll(() => {
  Platform.OS = 'node' as typeof Platform.OS;
});

beforeEach(() => {
  jest.clearAllMocks();
  factRows.length = 0;
  suppressionRows.length = 0;
});

describe('searchFacts on web', () => {
  it('returns ranked live facts from the web store (no longer stubbed to [])', async () => {
    await store.upsertFact({ userId: 'u1', kind: 'pattern', text: 'runs every morning before work' });
    await store.upsertFact({ userId: 'u1', kind: 'constraint', text: 'never schedules meetings after nine pm' });

    const hits = await store.searchFacts('u1', 'morning running habit', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.text).toBe('runs every morning before work');
  });

  it('returns [] for a user with no facts', async () => {
    await expect(store.searchFacts('nobody', 'anything')).resolves.toEqual([]);
  });
});

describe('mutation instrumentation (sync spine)', () => {
  it('a new fact records an insert mutation with the stored-row snapshot', async () => {
    const id = await store.upsertFact({ userId: 'u1', kind: 'preference', text: 'prefers short blocks' });
    const call = mRecord.mock.calls.find(([m]) => m.entity === 'memory_facts' && m.op === 'insert');
    expect(call).toBeDefined();
    expect(call![0]).toMatchObject({
      entityId: id,
      before: null,
      after: expect.objectContaining({ id, userId: 'u1', text: 'prefers short blocks', salience: 1 }),
    });
    // Embedding travels as its stored JSON-string form (round-trips the fold).
    expect(typeof call![0].after.embedding).toBe('string');
  });

  it('a near-duplicate upsert records an update (salience bump), not a second insert', async () => {
    const id = await store.upsertFact({ userId: 'u1', kind: 'pattern', text: 'completes morning focus blocks' });
    mRecord.mockClear();
    const again = await store.upsertFact({ userId: 'u1', kind: 'pattern', text: 'completes morning focus blocks' });
    expect(again).toBe(id);
    const [m] = mRecord.mock.calls.find(([r]) => r.entity === 'memory_facts')!;
    expect(m.op).toBe('update');
    expect(m.after.salience).toBeGreaterThan(m.before.salience - 1e-9);
  });

  it('deleteFact records a delete with the before snapshot', async () => {
    const id = await store.upsertFact({ userId: 'u1', kind: 'milestone', text: 'ran a first 10k' });
    mRecord.mockClear();
    store.deleteFact(id);
    const [m] = mRecord.mock.calls.find(([r]) => r.entity === 'memory_facts')!;
    expect(m).toMatchObject({ op: 'delete', entityId: id, after: null });
    expect(m.before).toMatchObject({ id, text: 'ran a first 10k' });
  });

  it('forgetFact tombstones via a memory_suppressions insert (forget must sync too)', async () => {
    const id = await store.upsertFact({ userId: 'u1', kind: 'pattern', text: 'skips Friday workouts' });
    const fact = store.getFactsByUser('u1').find((f) => f.id === id)!;
    mRecord.mockClear();
    await store.forgetFact(fact);
    const ops = mRecord.mock.calls.map(([r]) => `${r.entity}:${r.op}`);
    expect(ops).toContain('memory_facts:delete');
    expect(ops).toContain('memory_suppressions:insert');
  });

  it('setFactPinned records an update carrying the new pinned value', async () => {
    const id = await store.upsertFact({ userId: 'u1', kind: 'constraint', text: 'no work on Sundays' });
    mRecord.mockClear();
    store.setFactPinned(id, true);
    const [m] = mRecord.mock.calls.find(([r]) => r.entity === 'memory_facts')!;
    expect(m.op).toBe('update');
    expect(m.after.pinned).toBe(true);
  });
});
