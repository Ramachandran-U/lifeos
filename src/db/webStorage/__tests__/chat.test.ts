/**
 * webStorage/chat — user-scoped messages sorted ascending by createdAt, and a
 * user-scoped clear that leaves other users' history intact.
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
  webInsertChatMessage,
  webGetChatMessages,
  webClearChatMessages,
  type WebChatMessage,
} from '../chat';

function msg(over: Partial<WebChatMessage>): WebChatMessage {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-a',
    role: 'user',
    content: 'hello',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('webGetChatMessages', () => {
  it('returns the user\'s messages sorted ascending by createdAt', () => {
    webInsertChatMessage(msg({ id: 'm1', userId: 'user-a', createdAt: '2026-01-03T00:00:00.000Z' }));
    webInsertChatMessage(msg({ id: 'm2', userId: 'user-a', createdAt: '2026-01-01T00:00:00.000Z' }));
    webInsertChatMessage(msg({ id: 'm3', userId: 'user-b', createdAt: '2026-01-02T00:00:00.000Z' }));
    expect(webGetChatMessages('user-a').map((m) => m.id)).toEqual(['m2', 'm1']);
  });
});

describe('webClearChatMessages', () => {
  it('clears only the targeted user\'s messages', () => {
    webInsertChatMessage(msg({ id: 'm1', userId: 'user-a' }));
    webInsertChatMessage(msg({ id: 'm2', userId: 'user-b' }));
    webClearChatMessages('user-a');
    expect(webGetChatMessages('user-a')).toHaveLength(0);
    expect(webGetChatMessages('user-b').map((m) => m.id)).toEqual(['m2']);
  });
});
