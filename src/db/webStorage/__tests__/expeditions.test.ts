/**
 * Web expedition storage: definitions + per-(user,expedition) progress upsert.
 * Multiple concurrent expeditions must persist independently.
 */
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import {
  webInsertExpedition,
  webGetExpedition,
  webListExpeditionsByUser,
  webUpsertExpeditionProgress,
  webGetExpeditionProgress,
  webListExpeditionProgressByUser,
  type WebExpedition,
  type WebExpeditionProgress,
} from '../expeditions';

function exp(over: Partial<WebExpedition>): WebExpedition {
  return {
    id: 'e1', userId: 'u1', title: 'History of Jazz', theme: 'jazz', domain: 'polymath',
    steps: '[]', totalSteps: 7, source: 'ai', seedSparkId: null, createdAt: '2026-05-27T00:00:00.000Z', ...over,
  };
}
function prog(over: Partial<WebExpeditionProgress>): WebExpeditionProgress {
  return {
    id: 'p1', userId: 'u1', expeditionId: 'e1', status: 'active', currentStep: 0,
    completedSteps: '[]', startedAt: '2026-05-27T00:00:00.000Z', lastActivityAt: '2026-05-27T00:00:00.000Z',
    completedAt: null, updatedAt: '2026-05-27T00:00:00.000Z', ...over,
  };
}

it('stores and reads back an expedition definition', () => {
  webInsertExpedition(exp({}));
  expect(webGetExpedition('e1')?.title).toBe('History of Jazz');
  expect(webListExpeditionsByUser('u1')).toHaveLength(1);
});

it('upserts progress keyed by (user, expedition) — no duplicate rows', () => {
  webUpsertExpeditionProgress(prog({ currentStep: 1 }));
  webUpsertExpeditionProgress(prog({ currentStep: 2, completedSteps: '[0,1]' }));
  const list = webListExpeditionProgressByUser('u1');
  expect(list).toHaveLength(1);
  expect(list[0]!.currentStep).toBe(2);
  expect(webGetExpeditionProgress('u1', 'e1')?.completedSteps).toBe('[0,1]');
});

it('tracks multiple concurrent expeditions independently', () => {
  webUpsertExpeditionProgress(prog({ id: 'pa', expeditionId: 'e1', currentStep: 3 }));
  webUpsertExpeditionProgress(prog({ id: 'pb', expeditionId: 'e2', currentStep: 1 }));
  expect(webListExpeditionProgressByUser('u1')).toHaveLength(2);
  expect(webGetExpeditionProgress('u1', 'e1')?.currentStep).toBe(3);
  expect(webGetExpeditionProgress('u1', 'e2')?.currentStep).toBe(1);
});

it('scopes by user', () => {
  webUpsertExpeditionProgress(prog({ userId: 'u2', expeditionId: 'e1' }));
  expect(webGetExpeditionProgress('u1', 'e1')).toBeUndefined();
  expect(webListExpeditionProgressByUser('u2')).toHaveLength(1);
});
