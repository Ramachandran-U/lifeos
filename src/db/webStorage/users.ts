import { load, save } from './_io';
import {
  USERS_KEY,
  SESSION_KEY,
  GOALS_KEY,
  GOAL_COMMENTS_KEY,
  GAMIFICATION_KEY,
  INTERESTS_KEY,
  CONTACTS_KEY,
  USER_PROFILES_KEY,
  CHAT_MESSAGES_KEY,
  DISCOVERY_IMPORTS_KEY,
} from './_keys';

// Every web store whose records carry a `userId` foreign key. When an account's
// local id changes (e.g. an email/password signup later linked to a Supabase
// auth id), these must be migrated in lockstep with the user row — otherwise
// the records are orphaned and the user appears to lose all their data on
// re-login. (Stores without a userId — routine blocks, health logs, food,
// blood reports — are global and unaffected.)
const USER_SCOPED_KEYS = [
  GOALS_KEY,
  GOAL_COMMENTS_KEY,
  GAMIFICATION_KEY,
  INTERESTS_KEY,
  CONTACTS_KEY,
  USER_PROFILES_KEY,
  CHAT_MESSAGES_KEY,
  DISCOVERY_IMPORTS_KEY,
] as const;

function migrateUserScopedData(oldId: string, newId: string): void {
  for (const key of USER_SCOPED_KEYS) {
    const rows = load<{ userId?: string }>(key);
    let changed = false;
    for (const row of rows) {
      if (row.userId === oldId) {
        row.userId = newId;
        changed = true;
      }
    }
    if (changed) save(key, rows);
  }
}

export interface WebUser {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  age?: number;
  heightCm?: number;
  sex?: string;
  activityLevel?: string;
  visionStatement?: string;
  wakeTime?: string;
  sleepTime?: string;
  workStartTime?: string;
  workEndTime?: string;
  sleepTargetHours?: number;
  healthGoalType?: string;
  avatarUri?: string;
  avatarSourceUri?: string;
  onboardingStage: number;
  primaryDomains?: string[];
  activatedModules?: string[];
  installDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function webCreateUser(user: WebUser): void {
  const users = load<WebUser>(USERS_KEY);
  users.push(user);
  save(USERS_KEY, users);
}

export function webGetUser(): WebUser | undefined {
  try {
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return undefined;
    return load<WebUser>(USERS_KEY).find((u) => u.id === sessionId && !u.deletedAt);
  } catch {
    return undefined;
  }
}

export function webGetUserByEmail(email: string): WebUser | undefined {
  return load<WebUser>(USERS_KEY).find(
    (u) => u.email === email.toLowerCase() && !u.deletedAt,
  );
}

export function webUpdateUser(
  id: string,
  data: Partial<Omit<WebUser, 'id' | 'email' | 'passwordHash' | 'passwordSalt' | 'createdAt'>>,
): void {
  const users = load<WebUser>(USERS_KEY);
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) {
    // Previously a silent no-op, which is how a height/weight save could vanish
    // without a trace when the id drifted from the stored rows. Surface it.
    console.warn(`[users] webUpdateUser: no row for id "${id}" — update dropped`);
    return;
  }
  users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
  save(USERS_KEY, users);
}

/**
 * Migrate a local-only user row onto an authoritative auth-provider user id.
 * Used when the email already exists locally but under a different id (e.g. a
 * pre-Supabase install that just signed in). Behaviour-preserving: keeps email,
 * password fields, and createdAt; rewrites id and bumps updatedAt.
 */
export function webRewriteUserId(oldId: string, newId: string, name?: string): void {
  const users = load<WebUser>(USERS_KEY);
  const idx = users.findIndex((u) => u.id === oldId);
  if (idx === -1) return;
  users[idx] = {
    ...users[idx],
    id: newId,
    ...(name ? { name } : {}),
    updatedAt: new Date().toISOString(),
  };
  save(USERS_KEY, users);
  // Migrate every userId-scoped record so goals, streaks, contacts, interests,
  // and the profile survive the id change instead of being orphaned.
  migrateUserScopedData(oldId, newId);
}

export function webSetSession(userId: string | null): void {
  if (userId) {
    localStorage.setItem(SESSION_KEY, userId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}
