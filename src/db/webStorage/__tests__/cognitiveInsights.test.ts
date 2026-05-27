/**
 * Web cognitive-insights storage: insert, status update, latest-lookup (the
 * cooldown primitive). In-memory localStorage shim for the node test env.
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
  webInsertCognitiveInsight,
  webUpdateCognitiveInsightStatus,
  webGetLatestInsight,
  type WebCognitiveInsight,
} from '../cognitiveInsights';

function row(over: Partial<WebCognitiveInsight>): WebCognitiveInsight {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'u1',
    kind: 'domain_stagnation',
    domain: 'polymath',
    evidence: JSON.stringify({ delta: 0, daysFlat: 14, currentScore: 20 }),
    suggestions: '[]',
    status: 'proposed',
    createdAt: '2026-05-27T10:00:00.000Z',
    expiresAt: null,
    ...over,
  };
}

it('inserts and reads back the latest insight for a (user, kind, domain)', () => {
  webInsertCognitiveInsight(row({ createdAt: '2026-05-20T10:00:00.000Z' }));
  webInsertCognitiveInsight(row({ createdAt: '2026-05-26T10:00:00.000Z' }));
  const latest = webGetLatestInsight('u1', 'domain_stagnation', 'polymath');
  expect(latest?.createdAt).toBe('2026-05-26T10:00:00.000Z');
});

it('scopes latest-lookup by user, kind and domain', () => {
  webInsertCognitiveInsight(row({ domain: 'health' }));
  webInsertCognitiveInsight(row({ userId: 'u2' }));
  expect(webGetLatestInsight('u1', 'domain_stagnation', 'polymath')).toBeUndefined();
  webInsertCognitiveInsight(row({ domain: 'polymath' }));
  expect(webGetLatestInsight('u1', 'domain_stagnation', 'polymath')?.domain).toBe('polymath');
});

it('updates status in place', () => {
  const r = row({ id: 'fixed-id' });
  webInsertCognitiveInsight(r);
  webUpdateCognitiveInsightStatus('fixed-id', 'accepted');
  expect(webGetLatestInsight('u1', 'domain_stagnation', 'polymath')?.status).toBe('accepted');
});

it('returns undefined when nothing matches', () => {
  expect(webGetLatestInsight('nobody', 'domain_stagnation', 'finance')).toBeUndefined();
});
