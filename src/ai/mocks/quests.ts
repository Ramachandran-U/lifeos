import type { DailyQuestGenInput, DailyQuestGenResult } from '../types';

/**
 * Mock for USE_AI_MOCK mode: echo the template drafts back with a light
 * "personalized" retitle on the first one, so the upgrade path (replace
 * progress-0 quests) is exercised without an AI call.
 */
export function buildMockDailyQuests(input: DailyQuestGenInput): DailyQuestGenResult {
  return {
    quests: input.drafts.map((d, i) => ({
      templateId: d.templateId,
      title: i === 0 && input.topGoal
        ? `${d.title} — for "${input.topGoal}"`.slice(0, 64)
        : d.title,
      metricKey: d.metricKey,
      target: d.target,
      xp: d.xp,
    })),
  };
}
