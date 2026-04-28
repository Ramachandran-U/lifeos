import { Platform } from 'react-native';
import { asc, eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { chatMessages } from '../schema';
import {
  webInsertChatMessage,
  webGetChatMessages,
  webClearChatMessages,
  type WebChatMessage,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export function appendChatMessage(userId: string, role: 'user' | 'assistant', content: string): ChatMessage {
  const id = nanoid();
  const createdAt = new Date().toISOString();
  const record: WebChatMessage = { id, userId, role, content, createdAt };
  if (isWeb) {
    webInsertChatMessage(record);
  } else {
    db.insert(chatMessages).values({ id, userId, role, content, createdAt }).run();
  }
  return { id, userId, role, content, createdAt };
}

export function listChatMessages(userId: string): ChatMessage[] {
  if (isWeb) {
    return webGetChatMessages(userId).map((m) => ({ ...m, role: m.role as 'user' | 'assistant' }));
  }
  const rows = db.select().from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(asc(chatMessages.createdAt))
    .all();
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    role: r.role as 'user' | 'assistant',
    content: r.content,
    createdAt: r.createdAt,
  }));
}

export function clearChatMessages(userId: string): void {
  if (isWeb) {
    webClearChatMessages(userId);
    return;
  }
  db.delete(chatMessages).where(eq(chatMessages.userId, userId)).run();
}
