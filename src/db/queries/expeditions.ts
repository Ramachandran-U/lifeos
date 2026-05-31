import { Platform } from 'react-native';
import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { expeditions, expeditionProgress } from '../schema';
import {
  webInsertExpedition,
  webGetExpedition,
  webListExpeditionsByUser,
  webUpsertExpeditionProgress,
  webGetExpeditionProgress,
  webListExpeditionProgressByUser,
  type WebExpedition,
  type WebExpeditionProgress,
} from '../webStorage';
import type { Expedition, ExpeditionProgress, ExpeditionStep } from '@/explore/expeditions';
import { recordMutation } from '@/sync/runtime';

const isWeb = Platform.OS === 'web';

const safeArr = <T,>(s: string): T[] => { try { return JSON.parse(s) as T[]; } catch { return []; } };

function expeditionFromWeb(r: WebExpedition): Expedition {
  return {
    id: r.id, userId: r.userId, title: r.title, theme: r.theme, domain: r.domain,
    steps: safeArr<ExpeditionStep>(r.steps), totalSteps: r.totalSteps,
    source: r.source as Expedition['source'], seedSparkId: r.seedSparkId, createdAt: r.createdAt,
  };
}
function progressFromWeb(r: WebExpeditionProgress): ExpeditionProgress {
  return {
    id: r.id, userId: r.userId, expeditionId: r.expeditionId,
    status: r.status as ExpeditionProgress['status'], currentStep: r.currentStep,
    completedSteps: safeArr<number>(r.completedSteps),
    startedAt: r.startedAt, lastActivityAt: r.lastActivityAt,
    completedAt: r.completedAt, updatedAt: r.updatedAt,
  };
}

// --- definitions ---
export function createExpedition(e: Expedition): void {
  const row: WebExpedition = { ...e, steps: JSON.stringify(e.steps) };
  if (isWeb) { webInsertExpedition(row); }
  else { db.insert(expeditions).values(row).run(); }
  recordMutation({ entity: 'expeditions', entityId: e.id, op: 'insert', before: null, after: row as unknown as Record<string, unknown> });
}

export function getExpedition(id: string): Expedition | undefined {
  if (isWeb) { const r = webGetExpedition(id); return r ? expeditionFromWeb(r) : undefined; }
  const row = db.select().from(expeditions).where(eq(expeditions.id, id)).get();
  return row ? expeditionFromWeb(row as WebExpedition) : undefined;
}

export function listExpeditions(userId: string): Expedition[] {
  if (isWeb) return webListExpeditionsByUser(userId).map(expeditionFromWeb);
  return db.select().from(expeditions).where(eq(expeditions.userId, userId)).all()
    .map((r) => expeditionFromWeb(r as WebExpedition));
}

// --- progress (upsert keyed by user+expedition) ---
export function saveExpeditionProgress(p: ExpeditionProgress): void {
  const row: WebExpeditionProgress = { ...p, completedSteps: JSON.stringify(p.completedSteps) };
  if (isWeb) {
    webUpsertExpeditionProgress(row);
  } else {
    const existing = db.select().from(expeditionProgress)
      .where(and(eq(expeditionProgress.userId, p.userId), eq(expeditionProgress.expeditionId, p.expeditionId)))
      .get();
    if (existing) {
      db.update(expeditionProgress).set(row).where(eq(expeditionProgress.id, existing.id)).run();
    } else {
      db.insert(expeditionProgress).values(row).run();
    }
  }
  // Per-user-per-expedition singleton → sync entityId is the composite key, so
  // both devices' progress on the same expedition merge (CRDT, never loses a step).
  recordMutation({
    entity: 'expedition_progress',
    entityId: `${p.userId}#${p.expeditionId}`,
    op: 'update',
    before: null,
    after: row as unknown as Record<string, unknown>,
  });
}

export function getExpeditionProgress(userId: string, expeditionId: string): ExpeditionProgress | undefined {
  if (isWeb) { const r = webGetExpeditionProgress(userId, expeditionId); return r ? progressFromWeb(r) : undefined; }
  const row = db.select().from(expeditionProgress)
    .where(and(eq(expeditionProgress.userId, userId), eq(expeditionProgress.expeditionId, expeditionId)))
    .get();
  return row ? progressFromWeb(row as WebExpeditionProgress) : undefined;
}

export function listActiveExpeditionProgress(userId: string): ExpeditionProgress[] {
  const all = isWeb
    ? webListExpeditionProgressByUser(userId).map(progressFromWeb)
    : db.select().from(expeditionProgress).where(eq(expeditionProgress.userId, userId)).all()
        .map((r) => progressFromWeb(r as WebExpeditionProgress));
  return all.filter((p) => p.status === 'active');
}
