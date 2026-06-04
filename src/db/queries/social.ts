import { Platform } from 'react-native';
import { eq, and, isNull } from 'drizzle-orm';
import { differenceInCalendarDays } from 'date-fns';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { contacts, contactInteractions } from '../schema';
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
} from '../webStorage';

const isWeb = Platform.OS === 'web';

export type Contact = WebContact;
export type ContactInteraction = WebContactInteraction;

export type RelationshipType =
  | 'inner_circle'
  | 'close_friend'
  | 'family'
  | 'mentor'
  | 'colleague'
  | 'acquaintance';

export type InteractionType = 'call' | 'message' | 'in_person' | 'email' | 'other';

export const RELATIONSHIP_TIERS: RelationshipType[] = [
  'inner_circle',
  'close_friend',
  'family',
  'mentor',
  'colleague',
  'acquaintance',
];

export const RELATIONSHIP_META: Record<RelationshipType, { label: string; defaultCadenceDays: number }> = {
  inner_circle:  { label: 'Inner circle',  defaultCadenceDays: 7  },
  close_friend:  { label: 'Close friend',  defaultCadenceDays: 14 },
  family:        { label: 'Family',        defaultCadenceDays: 14 },
  mentor:        { label: 'Mentor',        defaultCadenceDays: 30 },
  colleague:     { label: 'Colleague',     defaultCadenceDays: 21 },
  acquaintance:  { label: 'Acquaintance',  defaultCadenceDays: 60 },
};

export const INTERACTION_META: Record<InteractionType, { label: string; icon: string }> = {
  call:      { label: 'Call',      icon: 'call'           },
  message:   { label: 'Message',   icon: 'chatbubble'     },
  in_person: { label: 'In person', icon: 'people'         },
  email:     { label: 'Email',     icon: 'mail'           },
  other:     { label: 'Other',     icon: 'ellipsis-horizontal' },
};

export interface CreateContactInput {
  userId: string;
  name: string;
  nickname?: string;
  relationshipType: RelationshipType;
  preferredCadenceDays?: number;
  notes?: string;
  birthday?: string;
  source?: 'manual' | 'phone_import';
}

export function createContact(input: CreateContactInput): string {
  const id = nanoid();
  const now = new Date().toISOString();
  const cadence = input.preferredCadenceDays ?? RELATIONSHIP_META[input.relationshipType].defaultCadenceDays;
  const record: Contact = {
    id,
    userId: input.userId,
    name: input.name,
    nickname: input.nickname ?? null,
    relationshipType: input.relationshipType,
    preferredCadenceDays: cadence,
    lastContactDate: null,
    notes: input.notes ?? null,
    birthday: input.birthday ?? null,
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  if (isWeb) {
    webInsertContact(record);
    return id;
  }
  db.insert(contacts).values({
    id: record.id,
    userId: record.userId,
    name: record.name,
    nickname: record.nickname ?? undefined,
    relationshipType: record.relationshipType,
    preferredCadenceDays: record.preferredCadenceDays,
    lastContactDate: record.lastContactDate ?? undefined,
    notes: record.notes ?? undefined,
    birthday: record.birthday ?? undefined,
    source: record.source,
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

export function getContactsByUser(userId: string): Contact[] {
  if (isWeb) return webGetContactsByUser(userId);
  const rows = db
    .select()
    .from(contacts)
    .where(and(eq(contacts.userId, userId), isNull(contacts.deletedAt)))
    .all();
  return rows as unknown as Contact[];
}

export function getContact(id: string): Contact | undefined {
  if (isWeb) return webGetContact(id);
  const rows = db.select().from(contacts).where(eq(contacts.id, id)).all();
  const row = rows[0] as unknown as Contact | undefined;
  if (row && row.deletedAt) return undefined;
  return row;
}

export function updateContact(id: string, data: Partial<Contact>): void {
  if (isWeb) {
    webUpdateContact(id, data);
    return;
  }
  db.update(contacts)
    .set({ ...data, updatedAt: new Date().toISOString() } as Partial<typeof contacts.$inferInsert>)
    .where(eq(contacts.id, id))
    .run();
}

export function softDeleteContact(id: string): void {
  if (isWeb) {
    webSoftDeleteContact(id);
    return;
  }
  db.update(contacts)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(contacts.id, id))
    .run();
}

export interface LogInteractionInput {
  contactId: string;
  date?: string; // YYYY-MM-DD, defaults to today
  type: InteractionType;
  notes?: string;
}

export function logInteraction(input: LogInteractionInput): string {
  const id = nanoid();
  const now = new Date().toISOString();
  const date = input.date ?? now.slice(0, 10);
  const record: ContactInteraction = {
    id,
    contactId: input.contactId,
    date,
    type: input.type,
    notes: input.notes ?? null,
    createdAt: now,
  };
  if (isWeb) {
    webInsertInteraction(record);
  } else {
    db.insert(contactInteractions).values({
      id,
      contactId: input.contactId,
      date,
      type: input.type,
      notes: input.notes ?? undefined,
      createdAt: now,
    }).run();
  }

  // Bump the contact's lastContactDate if this is the newest interaction.
  const existing = getContact(input.contactId);
  if (existing && (!existing.lastContactDate || existing.lastContactDate < date)) {
    updateContact(input.contactId, { lastContactDate: date });
  }
  return id;
}

export function getInteractionsByContact(contactId: string): ContactInteraction[] {
  if (isWeb) return webGetInteractionsByContact(contactId);
  const rows = db
    .select()
    .from(contactInteractions)
    .where(eq(contactInteractions.contactId, contactId))
    .all() as unknown as ContactInteraction[];
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getInteractionsForUser(userId: string): ContactInteraction[] {
  if (isWeb) return webGetInteractionsForUser(userId);
  const userContacts = getContactsByUser(userId);
  const ids = new Set(userContacts.map((c) => c.id));
  if (ids.size === 0) return [];
  const rows = db.select().from(contactInteractions).all() as unknown as ContactInteraction[];
  return rows.filter((r) => ids.has(r.contactId));
}

// ─── Overdue + score helpers ─────────────────────────────────────────────────

export interface OverdueInfo {
  daysSinceContact: number | null;
  isOverdue: boolean;
  overdueBy: number; // 0 if not overdue
}

const OVERDUE_MULTIPLIER = 1.2;

export function computeOverdue(contact: Contact, today: Date = new Date()): OverdueInfo {
  const anchor = contact.lastContactDate ?? contact.createdAt.slice(0, 10);
  const daysSinceContact = differenceInCalendarDays(today, new Date(anchor));
  const threshold = contact.preferredCadenceDays * OVERDUE_MULTIPLIER;
  const isOverdue = daysSinceContact > threshold;
  return {
    daysSinceContact,
    isOverdue,
    overdueBy: isOverdue ? Math.round(daysSinceContact - contact.preferredCadenceDays) : 0,
  };
}

/**
 * Social health score (0-100): share of contacts that are inside their
 * preferred cadence window. Empty contact list → null so the UI can render a
 * "no data" state rather than a misleading 0.
 */
export function computeSocialScore(contactsList: Contact[]): number | null {
  if (contactsList.length === 0) return null;
  const inCadence = contactsList.filter((c) => !computeOverdue(c).isOverdue).length;
  return Math.round((inCadence / contactsList.length) * 100);
}

// ─── Birthdays ────────────────────────────────────────────────────────────────

/** Parse a stored birthday ("YYYY-MM-DD" or year-less "MM-DD") → {month, day}, or null. */
export function parseBirthday(birthday: string | null | undefined): { month: number; day: number } | null {
  if (!birthday) return null;
  const m = birthday.match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

/**
 * Days until the NEXT occurrence of a birthday from `today` (0 = today,
 * 1 = tomorrow). Year-agnostic — works for "MM-DD". null if unparseable.
 */
export function daysUntilBirthday(birthday: string | null | undefined, today: Date = new Date()): number | null {
  const md = parseBirthday(birthday);
  if (!md) return null;
  const y = today.getFullYear();
  let next = new Date(y, md.month - 1, md.day);
  if (differenceInCalendarDays(next, today) < 0) {
    // Already passed this year → next occurrence is next year.
    next = new Date(y + 1, md.month - 1, md.day);
  }
  return differenceInCalendarDays(next, today);
}

export interface UpcomingBirthday {
  contact: Contact;
  daysUntil: number;
}

/** Contacts whose birthday falls within `withinDays`, soonest first. Pure. */
export function upcomingBirthdays(
  contactsList: Contact[],
  today: Date = new Date(),
  withinDays = 30,
): UpcomingBirthday[] {
  return contactsList
    .map((contact) => ({ contact, daysUntil: daysUntilBirthday(contact.birthday, today) }))
    .filter((x): x is UpcomingBirthday => x.daysUntil !== null && x.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
