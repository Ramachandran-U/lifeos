/**
 * Web storage layer — localStorage-backed substitute for SQLite on web.
 * Mirrors the shape of the native Drizzle query functions used by auth and onboarding.
 * Only stores what the app actually needs on web (users + session).
 */

const USERS_KEY = 'lifeos_users';
const SESSION_KEY = 'lifeos_session';

export interface WebUser {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  age?: number;
  visionStatement?: string;
  wakeTime?: string;
  sleepTime?: string;
  workStartTime?: string;
  workEndTime?: string;
  onboardingStage: number;
  installDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

function loadUsers(): WebUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveUsers(users: WebUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function webCreateUser(user: WebUser): void {
  const users = loadUsers();
  users.push(user);
  saveUsers(users);
}

export function webGetUser(): WebUser | undefined {
  // Return the persisted session user if one exists
  try {
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return undefined;
    return loadUsers().find((u) => u.id === sessionId && !u.deletedAt);
  } catch {
    return undefined;
  }
}

export function webGetUserByEmail(email: string): WebUser | undefined {
  return loadUsers().find(
    (u) => u.email === email.toLowerCase() && !u.deletedAt,
  );
}

export function webUpdateUser(
  id: string,
  data: Partial<Omit<WebUser, 'id' | 'email' | 'passwordHash' | 'passwordSalt' | 'createdAt'>>,
): void {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
  saveUsers(users);
}

/** Persist which user is currently signed in so the session survives a page refresh. */
export function webSetSession(userId: string | null): void {
  if (userId) {
    localStorage.setItem(SESSION_KEY, userId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}
