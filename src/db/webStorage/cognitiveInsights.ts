import { load, save } from './_io';
import { COGNITIVE_INSIGHTS_KEY } from './_keys';

/** Row shape on web (JSON columns stored as strings, mirroring SQLite). */
export interface WebCognitiveInsight {
  id: string;
  userId: string;
  kind: string;
  domain: string;
  evidence: string; // JSON
  suggestions: string; // JSON
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

export function webInsertCognitiveInsight(row: WebCognitiveInsight): void {
  const all = load<WebCognitiveInsight>(COGNITIVE_INSIGHTS_KEY);
  all.push(row);
  save(COGNITIVE_INSIGHTS_KEY, all);
}

export function webUpdateCognitiveInsightStatus(id: string, status: string): void {
  const all = load<WebCognitiveInsight>(COGNITIVE_INSIGHTS_KEY);
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx]!, status };
  save(COGNITIVE_INSIGHTS_KEY, all);
}

/**
 * Most recent insight for a (user, kind, domain), or undefined. Used for the
 * cooldown check — we look at the newest one regardless of status.
 */
export function webGetLatestInsight(
  userId: string,
  kind: string,
  domain: string,
): WebCognitiveInsight | undefined {
  return load<WebCognitiveInsight>(COGNITIVE_INSIGHTS_KEY)
    .filter((r) => r.userId === userId && r.kind === kind && r.domain === domain)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
