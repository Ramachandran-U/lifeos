import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { cognitiveInsights } from '../schema';
import {
  webInsertCognitiveInsight,
  webUpdateCognitiveInsightStatus,
  webGetLatestInsight,
  type WebCognitiveInsight,
} from '../webStorage';
import type {
  CognitiveInsight,
  CognitiveInsightKind,
  InsightStatus,
  InsightSuggestion,
} from '@/cognition/types';
import type { DomainId } from '@/store/useUserStore';

const isWeb = Platform.OS === 'web';

export interface RecordInsightInput {
  userId: string;
  kind: CognitiveInsightKind;
  domain: DomainId;
  evidence: CognitiveInsight['evidence'];
  suggestions: InsightSuggestion[];
  /** Days until the insight goes stale (default 3). */
  ttlDays?: number;
}

function fromWeb(r: WebCognitiveInsight): CognitiveInsight {
  const safeParse = <T,>(s: string, fallback: T): T => {
    try { return JSON.parse(s) as T; } catch { return fallback; }
  };
  return {
    id: r.id,
    userId: r.userId,
    kind: r.kind as CognitiveInsightKind,
    domain: r.domain as DomainId,
    evidence: safeParse(r.evidence, { delta: 0, daysFlat: 0, currentScore: 0 }),
    suggestions: safeParse<InsightSuggestion[]>(r.suggestions, []),
    status: r.status as InsightStatus,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  };
}

export function recordInsight(input: RecordInsightInput): string {
  const id = nanoid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.ttlDays ?? 3) * 86_400_000).toISOString();
  const evidenceJson = JSON.stringify(input.evidence);
  const suggestionsJson = JSON.stringify(input.suggestions);

  if (isWeb) {
    webInsertCognitiveInsight({
      id,
      userId: input.userId,
      kind: input.kind,
      domain: input.domain,
      evidence: evidenceJson,
      suggestions: suggestionsJson,
      status: 'proposed',
      createdAt: now.toISOString(),
      expiresAt,
    });
    return id;
  }

  db.insert(cognitiveInsights).values({
    id,
    userId: input.userId,
    kind: input.kind,
    domain: input.domain,
    evidence: evidenceJson,
    suggestions: suggestionsJson,
    status: 'proposed',
    createdAt: now.toISOString(),
    expiresAt,
  }).run();
  return id;
}

export function updateInsightStatus(id: string, status: InsightStatus): void {
  if (isWeb) { webUpdateCognitiveInsightStatus(id, status); return; }
  db.update(cognitiveInsights).set({ status }).where(eq(cognitiveInsights.id, id)).run();
}

/** Newest insight for a (user, kind, domain), or undefined. */
export function getLatestInsight(
  userId: string,
  kind: CognitiveInsightKind,
  domain: DomainId,
): CognitiveInsight | undefined {
  if (isWeb) {
    const r = webGetLatestInsight(userId, kind, domain);
    return r ? fromWeb(r) : undefined;
  }
  const row = db.select().from(cognitiveInsights)
    .where(eq(cognitiveInsights.userId, userId))
    .all()
    .filter((r) => r.kind === kind && r.domain === domain)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return row ? fromWeb(row as WebCognitiveInsight) : undefined;
}

/**
 * Cooldown gate for the detector: true when it's OK to surface a new insight
 * for this (user, kind, domain) — i.e. none has been raised within
 * `cooldownDays` (default 7).
 */
export function isInsightCooldownOk(
  userId: string,
  kind: CognitiveInsightKind,
  domain: DomainId,
  cooldownDays = 7,
): boolean {
  const latest = getLatestInsight(userId, kind, domain);
  if (!latest) return true;
  const ageMs = Date.now() - new Date(latest.createdAt).getTime();
  return ageMs >= cooldownDays * 86_400_000;
}
