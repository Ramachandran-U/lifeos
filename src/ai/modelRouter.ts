/**
 * Per-task model routing (Gemini provider — the worker runs LLM_PROVIDER=gemini).
 *
 * Tier 1 (cheap, high-volume): Gemini 2.5 Flash — categorization, short copy.
 * Tier 2 (planning) + Tier 3 (reasoning): Gemini 3.5 Flash — structured plans,
 *   insights, and the quality/accuracy-sensitive calls. (Tier 3 is collapsed
 *   onto 3.5 Flash for now; if its quota bites, split Tier 1 onto
 *   gemini-2.5-flash-lite and Tier 3 back to 2.5 Flash.)
 *
 * NOTE: the worker only honours a requested model whose ID starts with
 * `gemini-`; an unrecognised gemini-* ID falls back to `gemini-flash-latest`
 * worker-side, so a wrong preview ID degrades gracefully instead of 400-ing.
 *
 * Override globally with EXPO_PUBLIC_MODEL_OVERRIDE for evals/benchmarking.
 */

export const MODELS = {
  cheap: 'gemini-2.5-flash',
  planning: 'gemini-3.5-flash',
  reasoning: 'gemini-3.5-flash',
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
  | 'generateWeekRoutine'
  | 'generateConversationStarters'
  | 'suggestInterestAreas'
  | 'suggestCrossDisciplineLink'
  | 'generateMonthlyInsightReport'
  | 'generateDailyBriefing'
  | 'assessTrajectory'
  | 'generateAnnualReview'
  | 'generateMoneyReview'
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
  generateMonthlyInsightReport: 'planning',
  generateDailyBriefing: 'cheap',
  assessTrajectory: 'planning',
  generateAnnualReview: 'reasoning',
  generateMoneyReview: 'planning',
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
  generateWeekRoutine: 'planning',
  'agent.propose': 'planning',
  'agent.critique': 'planning',

  parseBloodReport: 'reasoning',
};

export function pickModel(task: AITask): string {
  const override = process.env.EXPO_PUBLIC_MODEL_OVERRIDE;
  if (override) return override;
  return MODELS[TASK_TIER[task] ?? 'planning'];
}
