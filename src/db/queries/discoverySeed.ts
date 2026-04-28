import type { DiscoveryExtraction } from '@/ai/types';
import { createGoal } from './goals';
import { createInterest } from './interests';

const DOMAIN_TO_GOAL_TYPE: Record<string, string> = {
  goals: 'personal',
  health: 'health',
  finance: 'finance',
  career: 'career',
  social: 'social',
  polymath: 'learning',
};

const HORIZON_TO_LEVEL: Record<string, string> = {
  '90d': 'monthly',
  '1y': 'yearly',
  '3y': 'yearly',
  lifetime: 'life',
};

export interface DiscoverySeedResult {
  goalsCreated: number;
  interestsCreated: number;
}

export function seedFromDiscovery(
  userId: string,
  extracted: DiscoveryExtraction,
  importId: string,
): DiscoverySeedResult {
  let goalsCreated = 0;
  let interestsCreated = 0;

  for (const g of extracted.goals) {
    createGoal({
      userId,
      title: g.title,
      description: g.why ?? undefined,
      goalType: DOMAIN_TO_GOAL_TYPE[g.domain] ?? 'personal',
      level: HORIZON_TO_LEVEL[g.horizon] ?? 'yearly',
      timeline: g.horizon,
      aiGenerated: true,
      metadata: JSON.stringify({
        source: 'discovery',
        importId,
        confidence: g.confidence,
        quote: g.quote,
      }),
    });
    goalsCreated += 1;
  }

  for (const name of extracted.curiosity.activeInterests) {
    if (!name?.trim()) continue;
    createInterest({
      userId,
      name: name.trim(),
      category: 'general',
      weeklyMinutesTarget: 60,
      explorationDepth: 'taste',
      discoveredBy: 'discovery',
    });
    interestsCreated += 1;
  }

  return { goalsCreated, interestsCreated };
}
