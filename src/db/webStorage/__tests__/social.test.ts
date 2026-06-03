/**
 * webStorage/social — contact user-scoping + soft-delete exclusion, update,
 * interaction listing ordered date DESC, and the contact→interaction join
 * used by webGetInteractionsForUser.
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
  webInsertContact,
  webGetContactsByUser,
  webGetContact,
  webUpdateContact,
  webSoftDeleteContact,
  webInsertInteraction,
  webGetInteractionsByContact,
  webGetInteractionsForUser,
  type WebContact,
  type WebContactInteraction,
} from '../social';

function contact(over: Partial<WebContact>): WebContact {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-a',
    name: 'Friend',
    relationshipType: 'friend',
    preferredCadenceDays: 14,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function interaction(over: Partial<WebContactInteraction>): WebContactInteraction {
  return {
    id: Math.random().toString(36).slice(2),
    contactId: 'c1',
    date: '2026-05-01',
    type: 'call',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('contacts', () => {
  it('scopes by user and excludes soft-deleted', () => {
    webInsertContact(contact({ id: 'c1', userId: 'user-a' }));
    webInsertContact(contact({ id: 'c2', userId: 'user-b' }));
    webInsertContact(contact({ id: 'c3', userId: 'user-a' }));
    webSoftDeleteContact('c3');
    expect(webGetContactsByUser('user-a').map((c) => c.id)).toEqual(['c1']);
    expect(webGetContact('c3')).toBeUndefined(); // soft-deleted hidden from single get
    expect(webGetContact('c1')?.id).toBe('c1');
  });

  it('updates a contact field and bumps updatedAt', () => {
    webInsertContact(contact({ id: 'c1', nickname: null, updatedAt: '2026-01-01T00:00:00.000Z' }));
    webUpdateContact('c1', { nickname: 'Bestie' });
    const after = webGetContact('c1');
    expect(after?.nickname).toBe('Bestie');
    expect(after?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('interactions', () => {
  it('lists interactions for a contact newest-date-first', () => {
    webInsertInteraction(interaction({ id: 'i1', contactId: 'c1', date: '2026-05-01' }));
    webInsertInteraction(interaction({ id: 'i2', contactId: 'c1', date: '2026-05-10' }));
    webInsertInteraction(interaction({ id: 'i3', contactId: 'c1', date: '2026-05-05' }));
    expect(webGetInteractionsByContact('c1').map((i) => i.id)).toEqual(['i2', 'i3', 'i1']);
  });

  it('joins interactions to a user through their contacts', () => {
    webInsertContact(contact({ id: 'c1', userId: 'user-a' }));
    webInsertContact(contact({ id: 'c2', userId: 'user-b' }));
    webInsertInteraction(interaction({ id: 'i1', contactId: 'c1' }));
    webInsertInteraction(interaction({ id: 'i2', contactId: 'c2' }));
    expect(webGetInteractionsForUser('user-a').map((i) => i.id)).toEqual(['i1']);
  });
});
