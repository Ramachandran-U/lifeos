import { load, save } from './_io';
import { CONTACTS_KEY, CONTACT_INTERACTIONS_KEY } from './_keys';

export interface WebContact {
  id: string;
  userId: string;
  name: string;
  nickname?: string | null;
  relationshipType: string;
  preferredCadenceDays: number;
  lastContactDate?: string | null;
  notes?: string | null;
  birthday?: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface WebContactInteraction {
  id: string;
  contactId: string;
  date: string;
  type: string;
  notes?: string | null;
  createdAt: string;
}

export function webInsertContact(c: WebContact): void {
  const all = load<WebContact>(CONTACTS_KEY);
  all.push(c);
  save(CONTACTS_KEY, all);
}

export function webGetContactsByUser(userId: string): WebContact[] {
  return load<WebContact>(CONTACTS_KEY).filter(
    (c) => c.userId === userId && !c.deletedAt,
  );
}

export function webGetContact(id: string): WebContact | undefined {
  return load<WebContact>(CONTACTS_KEY).find((c) => c.id === id && !c.deletedAt);
}

export function webUpdateContact(id: string, data: Partial<WebContact>): void {
  const all = load<WebContact>(CONTACTS_KEY);
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  save(CONTACTS_KEY, all);
}

export function webSoftDeleteContact(id: string): void {
  webUpdateContact(id, { deletedAt: new Date().toISOString() });
}

export function webInsertInteraction(i: WebContactInteraction): void {
  const all = load<WebContactInteraction>(CONTACT_INTERACTIONS_KEY);
  all.push(i);
  save(CONTACT_INTERACTIONS_KEY, all);
}

export function webGetInteractionsByContact(contactId: string): WebContactInteraction[] {
  return load<WebContactInteraction>(CONTACT_INTERACTIONS_KEY)
    .filter((i) => i.contactId === contactId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function webGetInteractionsForUser(userId: string): WebContactInteraction[] {
  const contactIds = new Set(
    load<WebContact>(CONTACTS_KEY)
      .filter((c) => c.userId === userId)
      .map((c) => c.id),
  );
  return load<WebContactInteraction>(CONTACT_INTERACTIONS_KEY).filter((i) =>
    contactIds.has(i.contactId),
  );
}
