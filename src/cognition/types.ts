/**
 * Shared types for the Phase 2 cognitive engine. Kept platform-free so both
 * the pure detectors and the storage layer can import them.
 */
import type { DomainId } from '@/store/useUserStore';

export type CognitiveInsightKind = 'domain_stagnation' | 'overcommitment' | 'streak_at_risk';

export type InsightStatus = 'proposed' | 'shown' | 'accepted' | 'dismissed' | 'expired';

/** A single actionable suggestion attached to an insight. */
export interface InsightSuggestion {
  title: string;
  /** Suggested routine-block length, minutes. */
  durationMin: number;
  /** Routine module the action belongs to (goal|health|finance|career|social|polymath). */
  module: string;
  /** Where the suggestion came from — the user's own goals vs. AI invention. */
  source: 'goal' | 'ai';
  /** Set when source === 'goal'; lets the UI link the new block to the goal. */
  goalId?: string;
}

export interface CognitiveInsight {
  id: string;
  userId: string;
  kind: CognitiveInsightKind;
  /** The domain this insight is about (for domain_stagnation). */
  domain: DomainId;
  /** Structured, evidence-grounded detail — never free prose. */
  evidence: { delta: number; daysFlat: number; currentScore: number };
  suggestions: InsightSuggestion[];
  status: InsightStatus;
  createdAt: string;
  /** ISO; after this the insight is stale and should not be shown. */
  expiresAt: string | null;
}
