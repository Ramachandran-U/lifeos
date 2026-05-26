import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import {
  users,
  goals,
  goalComments,
  interests,
  gamification,
  contacts,
  userProfiles,
  chatMessages,
  discoveryImports,
} from '../schema';
import {
  webCreateUser,
  webGetUser,
  webGetUserByEmail,
  webRewriteUserId,
  webUpdateUser,
  webSetSession,
  type WebUser,
} from '../webStorage';

// ─── Types ───────────────────────────────────────────────────────────────────

type CreateUserData = {
  id?: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  age?: number;
  visionStatement?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isWeb = Platform.OS === 'web';

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function createUser(data: CreateUserData): Promise<string> {
  const id = data.id ?? nanoid();
  const now = new Date().toISOString();

  if (isWeb) {
    const webUser: WebUser = {
      id,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      passwordSalt: data.passwordSalt,
      name: data.name,
      age: data.age,
      visionStatement: data.visionStatement,
      onboardingStage: 0,
      installDate: now,
      createdAt: now,
      updatedAt: now,
    };
    webCreateUser(webUser);
    webSetSession(id);
    return id;
  }

  db.insert(users).values({
    id,
    email: data.email.toLowerCase(),
    passwordHash: data.passwordHash,
    passwordSalt: data.passwordSalt,
    name: data.name,
    age: data.age,
    visionStatement: data.visionStatement,
    installDate: now,
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

export function getUser() {
  if (isWeb) return webGetUser();
  return db.select().from(users).limit(1).get();
}

export function getUserByEmail(email: string) {
  if (isWeb) return webGetUserByEmail(email.toLowerCase());
  return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
}

export function setWebSession(userId: string | null): void {
  if (isWeb) webSetSession(userId);
}

export function updateUser(
  id: string,
  data: Partial<{
    name: string;
    age: number;
    heightCm: number;
    visionStatement: string;
    wakeTime: string;
    sleepTime: string;
    workStartTime: string;
    workEndTime: string;
    sleepTargetHours: number;
    healthGoalType: string;
    onboardingStage: number;
    primaryDomains: string[];
    activatedModules: string[];
  }>,
): void {
  if (isWeb) {
    webUpdateUser(id, data);
    return;
  }
  const { primaryDomains, activatedModules, ...rest } = data;
  const native: Record<string, unknown> = { ...rest, updatedAt: new Date().toISOString() };
  if (primaryDomains !== undefined) native.primaryDomains = JSON.stringify(primaryDomains);
  if (activatedModules !== undefined) native.activatedModules = JSON.stringify(activatedModules);
  db.update(users).set(native).where(eq(users.id, id)).run();
}

export function getUserOnboardingStage(): number | undefined {
  if (isWeb) return webGetUser()?.onboardingStage;
  const user = db.select({ onboardingStage: users.onboardingStage }).from(users).limit(1).get();
  return user?.onboardingStage;
}

/**
 * Sentinel stored in passwordHash for accounts that only authenticate via Google.
 * Password sign-in paths must check for this and redirect to Google sign-in.
 */
export const GOOGLE_SSO_HASH = '__GOOGLE_SSO__';

/** Sentinel stored in passwordHash for Supabase-authenticated accounts. */
export const SUPABASE_AUTH_HASH = '__SUPABASE_AUTH__';

/**
 * Upsert a user from a Google profile. Returns the user id. If an account with
 * the same email already exists (whether password or Google), reuses it; no
 * account linking prompt yet — we trust Google's verified email.
 */
export async function upsertGoogleUser(profile: {
  email: string;
  name?: string;
}): Promise<string> {
  const existing = getUserByEmail(profile.email);
  if (existing) {
    if (profile.name && profile.name !== existing.name) {
      updateUser(existing.id, { name: profile.name });
    }
    return existing.id;
  }
  const id = await createUser({
    email: profile.email,
    passwordHash: GOOGLE_SSO_HASH,
    passwordSalt: '',
    name: profile.name || profile.email.split('@')[0],
  });
  return id;
}

/**
 * Create-or-update a local user row keyed on a Supabase auth user id. Existing
 * queries read from this table so the rest of the app does not need to know
 * where the id originated.
 */
/**
 * Native (SQLite) twin of webRewriteUserId. Rewrites the user row id AND every
 * userId-scoped foreign key so goals, streaks, contacts, interests, and the
 * profile survive the id change instead of being orphaned (the data-loss the
 * web fix already closed; this is the native parity — BUG-001 #1).
 */
function rewriteUserIdNative(oldId: string, newId: string, name?: string): void {
  db.update(users).set(name ? { id: newId, name } : { id: newId }).where(eq(users.id, oldId)).run();
  db.update(goals).set({ userId: newId }).where(eq(goals.userId, oldId)).run();
  db.update(goalComments).set({ userId: newId }).where(eq(goalComments.userId, oldId)).run();
  db.update(interests).set({ userId: newId }).where(eq(interests.userId, oldId)).run();
  db.update(gamification).set({ userId: newId }).where(eq(gamification.userId, oldId)).run();
  db.update(contacts).set({ userId: newId }).where(eq(contacts.userId, oldId)).run();
  db.update(userProfiles).set({ userId: newId }).where(eq(userProfiles.userId, oldId)).run();
  db.update(chatMessages).set({ userId: newId }).where(eq(chatMessages.userId, oldId)).run();
  db.update(discoveryImports).set({ userId: newId }).where(eq(discoveryImports.userId, oldId)).run();
}

export async function ensureLocalUserFromAuth(params: {
  userId: string;
  email: string;
  name: string;
}): Promise<void> {
  const existing = getUserByEmail(params.email) ?? (isWeb ? webGetUser() : db.select().from(users).where(eq(users.id, params.userId)).get());
  if (existing) {
    if (existing.id === params.userId) {
      if (params.name && params.name !== existing.name) {
        updateUser(existing.id, { name: params.name });
      }
      return;
    }
    // Email exists under a different id (legacy local account). Rewrite its id
    // so subsequent queries keyed on the Supabase user id resolve correctly.
    if (isWeb) {
      webRewriteUserId(existing.id, params.userId, params.name);
      return;
    }
    rewriteUserIdNative(existing.id, params.userId, params.name);
    return;
  }
  await createUser({
    id: params.userId,
    email: params.email,
    name: params.name,
    passwordHash: SUPABASE_AUTH_HASH,
    passwordSalt: '',
  });
}

export function deleteAllUsers(): void {
  if (isWeb) {
    localStorage.removeItem('lifeos_users');
    localStorage.removeItem('lifeos_session');
    return;
  }
  db.delete(users).run();
}
