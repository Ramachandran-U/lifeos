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
  | 'importYouTubeInterests'
  | 'suggestCrossDisciplineLink'
  | 'frontier'
  | 'generateDailySpark'
  | 'chasingNow'
  | 'generateExpedition'
  | 'generateRabbitHoleNode'
  | 'generateMonthlyInsightReport'
  | 'generateDailyBriefing'
  | 'assessTrajectory'
  | 'generateAnnualReview'
  | 'generateMoneyReview'
  | 'consolidateMemory'
  | 'rebalanceGoals'
  | 'agent.propose'
  | 'agent.critique'
  | 'agent.brief'
  | 'agent.goal.propose'
  | 'agent.goal.critique'
  | 'agent.whatNext'
  | 'agent.exploreThread';

const TASK_TIER: Record<AITask, Tier> = {
  categorizeMerchant: 'cheap',
  describeGoal: 'cheap',
  generateMotivation: 'cheap',
  discoveryChatTurn: 'cheap',
  generateConversationStarters: 'cheap',
  suggestInterestAreas: 'planning',
  importYouTubeInterests: 'planning', // cluster subscriptions into interests — structure matters
  suggestCrossDisciplineLink: 'planning',
  frontier: 'planning', // ranks the best unexplored edge across all interests — reasoning-ish
  generateDailySpark: 'cheap', // one short call per day — keep it cheap
  chasingNow: 'planning', // synthesises real history into live questions — quality is the whole point
  generateExpedition: 'planning', // structure matters — worth the better model
  generateRabbitHoleNode: 'cheap', // short interactive calls; cost adds up if user pulls 10 threads
  generateMonthlyInsightReport: 'planning',
  generateDailyBriefing: 'cheap',
  assessTrajectory: 'planning',
  generateAnnualReview: 'reasoning',
  generateMoneyReview: 'planning',
  consolidateMemory: 'planning', // one summarisation pass over the window — quality matters
  rebalanceGoals: 'planning', // reallocates weekly hours across goals — reasoning-ish
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
  'agent.goal.propose': 'planning',
  'agent.goal.critique': 'planning',
  // Tool-use loop: needs the better model to choose tools + synthesise well.
  'agent.whatNext': 'planning',
  // Exploration tool-loop: grounds the next thread in the user's real history.
  'agent.exploreThread': 'planning',

  parseBloodReport: 'reasoning',
};

export function pickModel(task: AITask): string {
  const override = process.env.EXPO_PUBLIC_MODEL_OVERRIDE;
  if (override) return override;
  return MODELS[TASK_TIER[task] ?? 'planning'];
}

/**
 * Per-task output-token DEFAULT, used only when a caller omits its own
 * `maxTokens` (most callers in functions.ts pass an explicit value, which wins
 * via `request.maxTokens ?? pickMaxTokens(...)`). The worker also hard-caps
 * everything at MAX_TOKENS_CAP.
 *
 * NOTE: maxOutputTokens is a CEILING, not a target — a short structured response
 * stops early regardless, so a tighter cap only cuts latency on a runaway/verbose
 * generation. We therefore set conservative bounds (no truncation regression)
 * rather than aggressive cuts; tune from the per-task `output_tokens` telemetry.
 */
const TIER_MAX_TOKENS: Record<Tier, number> = {
  // 768 (down from the worker's blanket 1200) bounds the worst case while
  // leaving comfortable margin for the cheap tier's normally-short outputs.
  cheap: 768,
  planning: 1200,
  reasoning: 2048,
};

// Defensive overrides — consulted ONLY when a caller omits maxTokens. The
// long-form tasks below need more than the tier default so an omitted budget
// doesn't truncate a report/plan. Cheap tasks deliberately have NO override:
// they inherit the 768 cap (their real outputs are well under it).
const TASK_MAX_TOKENS: Partial<Record<AITask, number>> = {
  generateRoutine: 2048,
  generateExpedition: 2048,
  generateFinancialPlan: 2048,
  generateCareerStrategy: 2048,
  generateMonthlyInsightReport: 2560,
  generateWeekRoutine: 3072,
  generateAnnualReview: 3072,
};

/** Default output-token budget for a task; callers may still pass their own `maxTokens`. */
export function pickMaxTokens(task: string | undefined): number {
  if (!task) return TIER_MAX_TOKENS.planning;
  const t = task as AITask;
  return TASK_MAX_TOKENS[t] ?? TIER_MAX_TOKENS[TASK_TIER[t] ?? 'planning'];
}
