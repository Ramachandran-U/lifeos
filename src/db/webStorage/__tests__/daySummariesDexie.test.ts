// fake-indexeddb gives Dexie a real (in-memory) IndexedDB so the Dexie-backed
// episodic store runs under the node test env. Must come before the module
// under test is imported.
import 'fake-indexeddb/auto';

import {
  webGetDaySummary,
  webGetRecentDaySummaries,
  webUpsertDaySummary,
  webDeleteAllDaySummariesForUser,
  type WebDaySummary,
} from '../daySummariesDexie';

function row(over: Partial<WebDaySummary> = {}): WebDaySummary {
  return {
    id: `id-${over.date ?? '2026-07-01'}`,
    userId: 'u1',
    date: '2026-07-01',
    summary: 'They completed their blocks.',
    statsJson: '{"blocksTotal":3,"blocksCompleted":3,"blocksSkipped":0,"mood":4,"decisions":[],"journalExcerpt":null}',
    source: 'ai',
    createdAt: '2026-07-01T21:00:00.000Z',
    updatedAt: '2026-07-01T21:00:00.000Z',
    ...over,
  };
}

beforeEach(async () => {
  await webDeleteAllDaySummariesForUser('u1');
  await webDeleteAllDaySummariesForUser('u2');
});

describe('daySummaries Dexie store', () => {
  it('round-trips a summary by (userId, date)', async () => {
    await webUpsertDaySummary(row());
    const got = await webGetDaySummary('u1', '2026-07-01');
    expect(got?.summary).toBe('They completed their blocks.');
    expect(await webGetDaySummary('u2', '2026-07-01')).toBeNull();
  });

  it('upsert on the same (userId, date) replaces content but keeps id/createdAt', async () => {
    await webUpsertDaySummary(row());
    const returnedId = await webUpsertDaySummary(
      row({ id: 'different-id', summary: 'Rewritten.', source: 'fallback', updatedAt: '2026-07-02T08:00:00.000Z' }),
    );
    const got = await webGetDaySummary('u1', '2026-07-01');
    expect(returnedId).toBe('id-2026-07-01'); // original id survives
    expect(got?.id).toBe('id-2026-07-01');
    expect(got?.createdAt).toBe('2026-07-01T21:00:00.000Z');
    expect(got?.summary).toBe('Rewritten.');
    expect(got?.source).toBe('fallback');
  });

  it('recent-summaries respects the since-date and sorts newest first (per user)', async () => {
    await webUpsertDaySummary(row({ id: 'a', date: '2026-06-01' }));
    await webUpsertDaySummary(row({ id: 'b', date: '2026-07-01' }));
    await webUpsertDaySummary(row({ id: 'c', date: '2026-07-03' }));
    await webUpsertDaySummary(row({ id: 'd', date: '2026-07-02', userId: 'u2' }));

    const got = await webGetRecentDaySummaries('u1', '2026-06-15');
    expect(got.map((r) => r.date)).toEqual(['2026-07-03', '2026-07-01']);
  });
});
