import { load, save } from './_io';
import { CHAT_MESSAGES_KEY } from './_keys';

export interface WebChatMessage {
  id: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
}

export function webInsertChatMessage(m: WebChatMessage): void {
  const all = load<WebChatMessage>(CHAT_MESSAGES_KEY);
  all.push(m);
  save(CHAT_MESSAGES_KEY, all);
}

export function webGetChatMessages(userId: string): WebChatMessage[] {
  return load<WebChatMessage>(CHAT_MESSAGES_KEY)
    .filter((m) => m.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function webClearChatMessages(userId: string): void {
  const remaining = load<WebChatMessage>(CHAT_MESSAGES_KEY).filter((m) => m.userId !== userId);
  save(CHAT_MESSAGES_KEY, remaining);
}
