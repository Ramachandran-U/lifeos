/**
 * Per-task model routing. Cheap classification → Haiku. Default planning →
 * Sonnet. Reasoning-heavy / safety-sensitive (medical-adjacent) → Opus.
 *
 * Override globally with EXPO_PUBLIC_MODEL_OVERRIDE for evals/benchmarking.
 */

export const MODELS = {
  cheap: 'claude-haiku-4-5-20251001',
  planning: 'claude-sonnet-4-6',
  reasoning: 'claude-opus-4-7',
} as const;

export type Tier = keyof typeof MODELS;

export type AITask =
  | 'decomposeGoal'
  | 'analyseSkillGap'
  | 'generateRoutine'
  | 'parseBloodReport'
  | 'suggestMeals'
  | 'recogniseFood'
  | 'generateFinancialPlan'
  | 'getWeeklyFinanceInsight'
  | 'categorizeMerchant'
  | 'generateCareerStrategy'
  | 'describeGoal'
  | 'generateMotivation'
  | 'extractDiscoveryProfile'
  | 'discoveryChatTurn'
  | 'suggestTomorrowTweak'
  | 'replanRemainingDay'
  | 'generateTomorrowRoutine'
  | 'generateConversationStarters'
  | 'suggestInterestAreas'
  | 'suggestCrossDisciplineLink'
  | 'agent.propose'
  | 'agent.critique'
  | 'agent.brief';

const TASK_TIER: Record<AITask, Tier> = {
  categorizeMerchant: 'cheap',
  describeGoal: 'cheap',
  generateMotivation: 'cheap',
  discoveryChatTurn: 'cheap',
  generateConversationStarters: 'cheap',
  suggestInterestAreas: 'planning',
  suggestCrossDisciplineLink: 'planning',
  'agent.brief': 'cheap',

  decomposeGoal: 'planning',
  analyseSkillGap: 'planning',
  generateRoutine: 'planning',
  suggestMeals: 'planning',
  recogniseFood: 'planning',
  generateFinancialPlan: 'planning',
  getWeeklyFinanceInsight: 'planning',
  generateCareerStrategy: 'planning',
  extractDiscoveryProfile: 'planning',
  suggestTomorrowTweak: 'planning',
  replanRemainingDay: 'planning',
  generateTomorrowRoutine: 'planning',
  'agent.propose': 'planning',
  'agent.critique': 'planning',

  parseBloodReport: 'reasoning',
};

export function pickModel(task: AITask): string {
  const override = process.env.EXPO_PUBLIC_MODEL_OVERRIDE;
  if (override) return override;
  return MODELS[TASK_TIER[task] ?? 'planning'];
}
