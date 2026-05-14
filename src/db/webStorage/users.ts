import { load, save } from './_io';
import { USERS_KEY, SESSION_KEY } from './_keys';

export interface WebUser {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  age?: number;
  heightCm?: number;
  visionStatement?: string;
  wakeTime?: string;
  sleepTime?: string;
  workStartTime?: string;
  workEndTime?: string;
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
  if (idx === -1) return;
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
}

export function webSetSession(userId: string | null): void {
  if (userId) {
    localStorage.setItem(SESSION_KEY, userId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}
