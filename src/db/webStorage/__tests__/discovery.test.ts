/**
 * webStorage/discovery — latest-import-per-user selection (createdAt DESC,
 * user-scoped).
 */

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import {
  webInsertDiscoveryImport,
  webGetLatestDiscoveryImport,
  type WebDiscoveryImport,
} from '../discovery';

function imp(over: Partial<WebDiscoveryImport>): WebDiscoveryImport {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-a',
    rawText: 'pasted profile',
    extracted: '{}',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('webGetLatestDiscoveryImport', () => {
  it('returns the most recent import for the user', () => {
    webInsertDiscoveryImport(imp({ id: 'd1', userId: 'user-a', createdAt: '2026-01-01T00:00:00.000Z' }));
    webInsertDiscoveryImport(imp({ id: 'd2', userId: 'user-a', createdAt: '2026-03-01T00:00:00.000Z' }));
    webInsertDiscoveryImport(imp({ id: 'd3', userId: 'user-b', createdAt: '2026-05-01T00:00:00.000Z' }));
    expect(webGetLatestDiscoveryImport('user-a')?.id).toBe('d2');
  });

  it('returns undefined when the user has no imports', () => {
    webInsertDiscoveryImport(imp({ id: 'd1', userId: 'user-a' }));
    expect(webGetLatestDiscoveryImport('user-b')).toBeUndefined();
  });
});
