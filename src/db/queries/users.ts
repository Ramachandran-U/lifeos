import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { users } from '../schema';
import {
  webCreateUser,
  webGetUser,
  webGetUserByEmail,
  webUpdateUser,
  webSetSession,
  type WebUser,
} from '../webStorage';

// ─── Types ───────────────────────────────────────────────────────────────────

type CreateUserData = {
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
  const id = nanoid();
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
    visionStatement: string;
    wakeTime: string;
    sleepTime: string;
    workStartTime: string;
    workEndTime: string;
    onboardingStage: number;
  }>,
): void {
  if (isWeb) {
    webUpdateUser(id, data);
    return;
  }
  db.update(users)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(users.id, id))
    .run();
}

export function getUserOnboardingStage(): number | undefined {
  if (isWeb) return webGetUser()?.onboardingStage;
  const user = db.select({ onboardingStage: users.onboardingStage }).from(users).limit(1).get();
  return user?.onboardingStage;
}

export function deleteAllUsers(): void {
  if (isWeb) {
    localStorage.removeItem('lifeos_users');
    localStorage.removeItem('lifeos_session');
    return;
  }
  db.delete(users).run();
}
