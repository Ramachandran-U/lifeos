import { load, save } from './_io';
import { EXPEDITIONS_KEY, EXPEDITION_PROGRESS_KEY } from './_keys';

/** Journey definition row (steps stored as JSON, mirroring SQLite). */
export interface WebExpedition {
  id: string;
  userId: string;
  title: string;
  theme: string;
  domain: string;
  steps: string; // JSON ExpeditionStep[]
  totalSteps: number;
  source: string;
  seedSparkId: string | null;
  createdAt: string;
}

/** Per-(user,expedition) progress row. completedSteps as JSON int[]. */
export interface WebExpeditionProgress {
  id: string;
  userId: string;
  expeditionId: string;
  status: string;
  currentStep: number;
  completedSteps: string; // JSON int[]
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  updatedAt: string;
}

// --- definitions ---
export function webInsertExpedition(row: WebExpedition): void {
  const all = load<WebExpedition>(EXPEDITIONS_KEY);
  all.push(row);
  save(EXPEDITIONS_KEY, all);
}

export function webGetExpedition(id: string): WebExpedition | undefined {
  return load<WebExpedition>(EXPEDITIONS_KEY).find((e) => e.id === id);
}

export function webListExpeditionsByUser(userId: string): WebExpedition[] {
  return load<WebExpedition>(EXPEDITIONS_KEY).filter((e) => e.userId === userId);
}

// --- progress (upsert keyed by (userId, expeditionId)) ---
export function webUpsertExpeditionProgress(row: WebExpeditionProgress): void {
  const all = load<WebExpeditionProgress>(EXPEDITION_PROGRESS_KEY);
  const idx = all.findIndex((p) => p.userId === row.userId && p.expeditionId === row.expeditionId);
  if (idx === -1) all.push(row);
  else all[idx] = row;
  save(EXPEDITION_PROGRESS_KEY, all);
}

export function webGetExpeditionProgress(userId: string, expeditionId: string): WebExpeditionProgress | undefined {
  return load<WebExpeditionProgress>(EXPEDITION_PROGRESS_KEY)
    .find((p) => p.userId === userId && p.expeditionId === expeditionId);
}

export function webListExpeditionProgressByUser(userId: string): WebExpeditionProgress[] {
  return load<WebExpeditionProgress>(EXPEDITION_PROGRESS_KEY).filter((p) => p.userId === userId);
}
