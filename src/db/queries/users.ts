import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { users } from '../schema';

export async function createUser(data: { name: string; age?: number; visionStatement?: string }) {
  const id = nanoid();
  const now = new Date().toISOString();
  db.insert(users).values({
    id,
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
  return db.select().from(users).limit(1).get();
}

export function updateUser(id: string, data: Partial<{
  name: string;
  age: number;
  visionStatement: string;
  wakeTime: string;
  sleepTime: string;
  workStartTime: string;
  workEndTime: string;
  onboardingStage: number;
}>) {
  db.update(users)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(users.id, id))
    .run();
}

export function getUserOnboardingStage(): number | undefined {
  const user = db.select({ onboardingStage: users.onboardingStage }).from(users).limit(1).get();
  return user?.onboardingStage;
}

export function deleteAllUsers() {
  db.delete(users).run();
}
