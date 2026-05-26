import { callAI } from './client';
import { extractJson } from './extractJson';
import { pickModel } from './modelRouter';
import { track, EVENTS } from '@/utils/telemetry';

/**
 * Emit an `ai_schema_failure` telemetry event and rethrow. Called from
 * every Zod-parse catch so production failures end up in the admin's
 * schema-failure feed and seed future eval fixtures.
 *
 * Props:
 *   - task         the AI function tag (e.g. 'decomposeGoal')
 *   - schema       the Zod schema name that failed
 *   - error        first 200 chars of the Zod error message
 *   - raw_preview  first 500 chars of the raw AI response
 *
 * Never includes any user input — the response is the model's output, not
 * the user's prompt, so it's the safest place to log content for debugging.
 */
function recordSchemaFailure(
  task: string,
  schema: string,
  raw: unknown,
  err: unknown,
): never {
  const detail = err instanceof Error ? err.message : String(err);
  const rawText = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  track(EVENTS.aiSchemaFailure, {
    task,
    schema,
    error: detail.slice(0, 200),
    raw_preview: rawText.slice(0, 500),
  });
  throw new Error(`AI returned invalid ${schema}: ${detail.slice(0, 120)}`);
}
import {
  GoalInput,
  GoalHierarchy,
  GoalHierarchySchema,
  CareerInput,
  SkillGapAnalysis,
  SkillGapAnalysisSchema,
  RoutineInput,
  GeneratedRoutine,
  GeneratedRoutineSchema,
  BloodReportResult,
  BloodReportResultSchema,
  MealSuggestion,
  MealSuggestionSchema,
  FinanceInput,
  FinancialPlan,
  FinancialPlanSchema,
  FinanceInsightInput,
  WeeklyFinanceInsight,
  WeeklyFinanceInsightSchema,
  FoodRecognition,
  FoodRecognitionSchema,
  CategorizeMerchantResult,
  CategorizeMerchantSchema,
  CategorizeMerchantBatchResult,
  CategorizeMerchantBatchSchema,
  TransactionCategory,
  CareerStrategy,
  CareerStrategySchema,
  CareerStrategyInput,
  Motivation,
  MotivationSchema,
  MotivationInput,
  GoalDescription,
  GoalDescriptionSchema,
  GoalDescriptionInput,
  TomorrowTweak,
  TomorrowTweakSchema,
  TomorrowTweakInput,
  DiscoveryExtraction,
  DiscoveryExtractionSchema,
  DiscoveryChatInput,
  DiscoveryChatTurn,
  DiscoveryChatTurnSchema,
  ReplanRemainingDay,
  ReplanRemainingDayInput,
  ReplanRemainingDaySchema,
  GenerateTomorrowRoutineInput,
  GenerateTomorrowRoutineSchema,
  ConversationStarters,
  ConversationStartersSchema,
  ConversationStartersInput,
  InterestSuggestions,
  InterestSuggestionsSchema,
  InterestSuggestionsInput,
  CrossDisciplineLink,
  CrossDisciplineLinkSchema,
  CrossDisciplineLinkInput,
  GeneratedWeekRoutine,
  GeneratedWeekRoutineSchema,
  GenerateWeekRoutineInput,
  MonthlyInsightReport,
  MonthlyInsightReportSchema,
  MonthlyInsightReportInput,
} from './types';
import { DISCOVERY_EXTRACTION_PROMPT } from './prompts/discovery';
import { DISCOVERY_CHAT_SYSTEM_PROMPT } from './prompts/discoveryChat';
import { buildMockDiscoveryChatTurn } from './mocks/discoveryChat';
import { usePromptStore } from '@/store/usePromptStore';
import { MOCK_DISCOVERY_EXTRACTION } from './mocks/discovery';
import { TOMORROW_TWEAK_PROMPT } from './prompts/reflection';
import { buildMockTomorrowTweak } from './mocks/reflection';
import { GOAL_DECOMPOSITION_PROMPT, GOAL_DESCRIPTION_PROMPT } from './prompts/goals';
import { SKILL_GAP_PROMPT, CAREER_STRATEGY_PROMPT, MOTIVATION_PROMPT } from './prompts/career';
import { ROUTINE_GENERATION_PROMPT, REPLAN_REMAINING_DAY_PROMPT, GENERATE_TOMORROW_ROUTINE_PROMPT, GENERATE_WEEK_ROUTINE_PROMPT } from './prompts/routine';
import { BLOOD_REPORT_PROMPT, MEAL_SUGGESTION_PROMPT, FOOD_RECOGNITION_PROMPT } from './prompts/health';
import {
  FINANCIAL_PLAN_PROMPT,
  WEEKLY_FINANCE_INSIGHT_PROMPT,
  MERCHANT_CATEGORIZE_PROMPT,
  MERCHANT_CATEGORIZE_BATCH_PROMPT,
} from './prompts/finance';
import { buildMockGoalHierarchy, buildMockGoalDescription } from './mocks/goals';
import { buildMockSkillGap, buildMockCareerStrategy, buildMockMotivation } from './mocks/career';
import { CONVERSATION_STARTERS_PROMPT } from './prompts/social';
import { buildMockConversationStarters } from './mocks/social';
import { INTEREST_SUGGESTIONS_PROMPT, CROSS_DISCIPLINE_LINK_PROMPT } from './prompts/polymath';
import { buildMockInterestSuggestions, buildMockCrossDisciplineLink } from './mocks/polymath';
import { MONTHLY_INSIGHT_REPORT_PROMPT } from './prompts/behaviour';
import { buildMockMonthlyInsightReport } from './mocks/behaviour';
import { MOCK_ROUTINE, buildMockReplanRemainingDay, buildMockTomorrowRoutine, buildMockWeekRoutine } from './mocks/routine';
import { MOCK_BLOOD_REPORT, MOCK_MEAL_SUGGESTION, MOCK_FOOD_RECOGNITION } from './mocks/health';
import { MOCK_FINANCIAL_PLAN, MOCK_WEEKLY_INSIGHT, buildMockFinancialPlan } from './mocks/finance';

const isMock = process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

export async function decomposeGoal(
  input: GoalInput,
  opts?: { signal?: AbortSignal },
): Promise<GoalHierarchy> {
  if (isMock) return buildMockGoalHierarchy(input.visionStatement, input.name);

  const response = await callAI({
    system: GOAL_DECOMPOSITION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('decomposeGoal'),
    cacheSystem: true,
    task: 'decomposeGoal',
    // Full hierarchy = 12 monthly + ~12-52 weekly entries with task arrays +
    // yearly + daily examples. A verbose model can exceed 4k tokens and
    // truncate mid-JSON ("Unbalanced JSON in AI response"). With the worker
    // cap raised to 8000, give it real headroom.
    maxTokens: 6000,
    signal: opts?.signal,
  });

  try {
    return GoalHierarchySchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('decomposeGoal', 'GoalHierarchy', response, err);
  }
}

// Common AI hallucinations — coerce to the closest valid enum before Zod parse.
const CURRENT_LEVEL_ALIASES: Record<string, 'none' | 'beginner' | 'intermediate' | 'advanced'> = {
  novice: 'beginner',
  basic: 'beginner',
  junior: 'beginner',
  intermediary: 'intermediate',
  proficient: 'intermediate',
  senior: 'advanced',
  expert: 'advanced',
  master: 'advanced',
};
const REQUIRED_LEVEL_ALIASES: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'expert'> = {
  none: 'beginner',
  novice: 'beginner',
  basic: 'beginner',
  junior: 'beginner',
  intermediary: 'intermediate',
  proficient: 'intermediate',
  senior: 'advanced',
  master: 'expert',
};
const RESOURCE_TYPE_ALIASES: Record<string, 'course' | 'book' | 'project' | 'person' | 'practice'> = {
  video: 'course',
  tutorial: 'course',
  article: 'book',
  blog: 'book',
  paper: 'book',
  podcast: 'book',
  mentor: 'person',
  community: 'person',
  exercise: 'practice',
  drill: 'practice',
  challenge: 'project',
  task: 'project',
};
const coerceCurrentLevel = (v: unknown): string => {
  if (typeof v !== 'string') return 'none';
  const k = v.toLowerCase().trim();
  if (['none', 'beginner', 'intermediate', 'advanced'].includes(k)) return k;
  return CURRENT_LEVEL_ALIASES[k] ?? 'none';
};
const coerceRequiredLevel = (v: unknown): string => {
  if (typeof v !== 'string') return 'beginner';
  const k = v.toLowerCase().trim();
  if (['beginner', 'intermediate', 'advanced', 'expert'].includes(k)) return k;
  return REQUIRED_LEVEL_ALIASES[k] ?? 'intermediate';
};
const coerceResourceType = (v: unknown): string => {
  if (typeof v !== 'string') return 'course';
  const k = v.toLowerCase().trim();
  if (['course', 'book', 'project', 'person', 'practice'].includes(k)) return k;
  return RESOURCE_TYPE_ALIASES[k] ?? 'course';
};
const coercePriorityNumber = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
    const t = v.toLowerCase().trim();
    if (t === 'high' || t === 'must') return 1;
    if (t === 'medium' || t === 'should') return 2;
    if (t === 'low' || t === 'nice') return 3;
  }
  return 5;
};
const coerceHours = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
};
function sanitizeSkillGap(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as { gaps?: unknown; resources?: unknown };
  const gaps = Array.isArray(r.gaps)
    ? r.gaps.map((g) => {
        if (!g || typeof g !== 'object') return g;
        const x = g as Record<string, unknown>;
        return {
          ...x,
          skill: typeof x.skill === 'string' ? x.skill : String(x.skill ?? ''),
          currentLevel: coerceCurrentLevel(x.currentLevel),
          requiredLevel: coerceRequiredLevel(x.requiredLevel),
          priority: coercePriorityNumber(x.priority),
        };
      })
    : [];
  const resources = Array.isArray(r.resources)
    ? r.resources.map((res) => {
        if (!res || typeof res !== 'object') return res;
        const x = res as Record<string, unknown>;
        return {
          ...x,
          title: typeof x.title === 'string' ? x.title : String(x.title ?? ''),
          type: coerceResourceType(x.type),
          estimatedHours: coerceHours(x.estimatedHours),
        };
      })
    : [];
  return { gaps, resources };
}

export async function analyseSkillGap(input: CareerInput): Promise<SkillGapAnalysis> {
  if (isMock) return buildMockSkillGap(input.currentRole, input.targetRole, input.currentSkills);

  const response = await callAI({
    system: SKILL_GAP_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('analyseSkillGap'),
    cacheSystem: true,
    task: 'analyseSkillGap',
    maxTokens: 4000,
  });

  try {
    const sanitized = sanitizeSkillGap(extractJson(response));
    return SkillGapAnalysisSchema.parse(sanitized);
  } catch (err) {
    recordSchemaFailure('analyseSkillGap', 'SkillGapAnalysis', response, err);
  }
}

export async function generateRoutine(input: RoutineInput): Promise<GeneratedRoutine> {
  if (isMock) return MOCK_ROUTINE;

  const response = await callAI({
    system: ROUTINE_GENERATION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('generateRoutine'),
    cacheSystem: true,
    task: 'generateRoutine',
    maxTokens: 4000,
  });

  try {
    return GeneratedRoutineSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('generateRoutine', 'GeneratedRoutine', response, err);
  }
}

export async function parseBloodReport(reportText: string): Promise<BloodReportResult> {
  if (isMock) return MOCK_BLOOD_REPORT;

  const response = await callAI({
    system: BLOOD_REPORT_PROMPT,
    messages: [{ role: 'user', content: reportText }],
    model: pickModel('parseBloodReport'),
    cacheSystem: true,
    task: 'parseBloodReport',
  });

  try {
    return BloodReportResultSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('parseBloodReport', 'BloodReportResult', response, err);
  }
}

export async function suggestMeals(context: string): Promise<MealSuggestion> {
  if (isMock) return MOCK_MEAL_SUGGESTION;

  const response = await callAI({
    system: MEAL_SUGGESTION_PROMPT,
    messages: [{ role: 'user', content: context }],
    model: pickModel('suggestMeals'),
    cacheSystem: true,
    task: 'suggestMeals',
  });

  try {
    return MealSuggestionSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('suggestMeals', 'MealSuggestion', response, err);
  }
}

export async function generateFinancialPlan(input: FinanceInput): Promise<FinancialPlan> {
  if (isMock) return buildMockFinancialPlan(input);

  const response = await callAI({
    system: FINANCIAL_PLAN_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('generateFinancialPlan'),
    cacheSystem: true,
    task: 'generateFinancialPlan',
  });

  try {
    return FinancialPlanSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('generateFinancialPlan', 'FinancialPlan', response, err);
  }
}

export async function getWeeklyFinanceInsight(input: FinanceInsightInput): Promise<WeeklyFinanceInsight> {
  if (isMock) return MOCK_WEEKLY_INSIGHT;

  const response = await callAI({
    system: WEEKLY_FINANCE_INSIGHT_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('getWeeklyFinanceInsight'),
    cacheSystem: true,
    task: 'getWeeklyFinanceInsight',
  });

  try {
    return WeeklyFinanceInsightSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('getWeeklyFinanceInsight', 'WeeklyFinanceInsight', response, err);
  }
}

export async function categorizeMerchant(
  merchant: string,
  amountRupees: number,
): Promise<CategorizeMerchantResult> {
  if (isMock) {
    return { category: 'other' as TransactionCategory, confidence: 0.5 };
  }

  const response = await callAI({
    system: MERCHANT_CATEGORIZE_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify({ merchant, amountRupees }) }],
    maxTokens: 80,
    model: pickModel('categorizeMerchant'),
    cacheSystem: true,
    task: 'categorizeMerchant',
  });

  try {
    return CategorizeMerchantSchema.parse(extractJson(response));
  } catch {
    return { category: 'other' as TransactionCategory, confidence: 0 };
  }
}

/**
 * Batched categorizer — one AI round-trip for up to ~25 merchants. Cuts
 * per-minute request count by ~25x vs. calling `categorizeMerchant` in a
 * loop, which keeps free-tier Gemini (20 RPM) viable for normal-size syncs.
 *
 * On mock mode, on parse failure, or on length mismatch, returns 'other'
 * with zero confidence for every item — caller decides whether to retry.
 */
export async function categorizeMerchantsBatch(
  items: Array<{ merchant: string; amountRupees: number }>,
): Promise<CategorizeMerchantBatchResult> {
  if (items.length === 0) return [];
  if (isMock) {
    return items.map(() => ({ category: 'other' as TransactionCategory, confidence: 0.5 }));
  }

  const response = await callAI({
    system: MERCHANT_CATEGORIZE_BATCH_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(items) }],
    // ~30 tokens per output × items, plus JSON overhead. Cap generously.
    maxTokens: Math.min(60 * items.length + 200, 2000),
    model: pickModel('categorizeMerchant'),
    cacheSystem: true,
    task: 'categorizeMerchant',
  });

  try {
    const parsed = CategorizeMerchantBatchSchema.parse(extractJson(response));
    if (parsed.length !== items.length) {
      // Order/length contract violated — safer to bail than misalign categories.
      return items.map(() => ({ category: 'other' as TransactionCategory, confidence: 0 }));
    }
    return parsed;
  } catch {
    return items.map(() => ({ category: 'other' as TransactionCategory, confidence: 0 }));
  }
}

export async function recogniseFood(imageBase64: string, mediaType: string): Promise<FoodRecognition> {
  if (isMock) return MOCK_FOOD_RECOGNITION;

  const response = await callAI({
    system: FOOD_RECOGNITION_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: 'Identify all food items in this photo and estimate their nutritional information.' },
      ],
    }],
    model: pickModel('recogniseFood'),
    cacheSystem: true,
    task: 'recogniseFood',
  });

  try {
    return FoodRecognitionSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('recogniseFood', 'FoodRecognition', response, err);
  }
}

export async function generateCareerStrategy(input: CareerStrategyInput): Promise<CareerStrategy> {
  if (isMock) return buildMockCareerStrategy(input);

  const response = await callAI({
    system: CAREER_STRATEGY_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 2500,
    model: pickModel('generateCareerStrategy'),
    cacheSystem: true,
    task: 'generateCareerStrategy',
  });

  try {
    return CareerStrategySchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('generateCareerStrategy', 'CareerStrategy', response, err);
  }
}

export async function describeGoal(input: GoalDescriptionInput): Promise<GoalDescription> {
  if (isMock) return buildMockGoalDescription(input);

  const response = await callAI({
    system: GOAL_DESCRIPTION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 200,
    model: pickModel('describeGoal'),
    cacheSystem: true,
    task: 'describeGoal',
  });

  try {
    return GoalDescriptionSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('describeGoal', 'GoalDescription', response, err);
  }
}

export async function generateMotivation(input: MotivationInput): Promise<Motivation> {
  if (isMock) return buildMockMotivation(input);

  const response = await callAI({
    system: MOTIVATION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 200,
    model: pickModel('generateMotivation'),
    cacheSystem: true,
    task: 'generateMotivation',
  });

  try {
    return MotivationSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('generateMotivation', 'Motivation', response, err);
  }
}


export async function extractDiscoveryProfile(raw: string): Promise<DiscoveryExtraction> {
  if (isMock) return MOCK_DISCOVERY_EXTRACTION;

  const systemPrompt = usePromptStore.getState().getPrompt('discovery_extraction', DISCOVERY_EXTRACTION_PROMPT);
  const response = await callAI({
    system: systemPrompt,
    messages: [{ role: 'user', content: raw }],
    maxTokens: 4000,
    model: pickModel('extractDiscoveryProfile'),
    cacheSystem: true,
    task: 'extractDiscoveryProfile',
  });

  try {
    return DiscoveryExtractionSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('extractDiscoveryProfile', 'DiscoveryExtraction', response, err);
  }
}

export async function suggestTomorrowTweak(input: TomorrowTweakInput): Promise<TomorrowTweak> {
  if (isMock) return buildMockTomorrowTweak(input);

  const response = await callAI({
    system: TOMORROW_TWEAK_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 400,
    model: pickModel('suggestTomorrowTweak'),
    cacheSystem: true,
    task: 'suggestTomorrowTweak',
  });

  try {
    return TomorrowTweakSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('suggestTomorrowTweak', 'TomorrowTweak', response, err);
  }
}

export async function discoveryChatTurn(input: DiscoveryChatInput): Promise<DiscoveryChatTurn> {
  if (isMock) return buildMockDiscoveryChatTurn(input);

  const systemPrompt = usePromptStore
    .getState()
    .getPrompt('discovery_chat', DISCOVERY_CHAT_SYSTEM_PROMPT);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    {
      role: 'user',
      content: `Current profile snapshot:\n${JSON.stringify(input.profile, null, 2)}`,
    },
    ...input.transcript,
  ];

  const response = await callAI({
    system: systemPrompt,
    messages,
    maxTokens: 800,
    model: pickModel('discoveryChatTurn'),
    cacheSystem: true,
    task: 'discoveryChatTurn',
  });

  try {
    return DiscoveryChatTurnSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('discoveryChatTurn', 'DiscoveryChatTurn', response, err);
  }
}

export async function replanRemainingDay(input: ReplanRemainingDayInput): Promise<ReplanRemainingDay> {
  if (isMock) return buildMockReplanRemainingDay(input);

  const response = await callAI({
    system: REPLAN_REMAINING_DAY_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 800,
    model: pickModel('replanRemainingDay'),
    cacheSystem: true,
    task: 'replanRemainingDay',
  });

  try {
    return ReplanRemainingDaySchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('replanRemainingDay', 'ReplanRemainingDay', response, err);
  }
}

export async function generateTomorrowRoutine(input: GenerateTomorrowRoutineInput): Promise<GeneratedRoutine> {
  if (isMock) return buildMockTomorrowRoutine(input);

  const response = await callAI({
    system: GENERATE_TOMORROW_ROUTINE_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 1500,
    model: pickModel('generateTomorrowRoutine'),
    cacheSystem: true,
    task: 'generateTomorrowRoutine',
  });

  try {
    return GenerateTomorrowRoutineSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('generateTomorrowRoutine', 'GeneratedRoutine', response, err);
  }
}

export async function generateConversationStarters(input: ConversationStartersInput): Promise<ConversationStarters> {
  if (isMock) return buildMockConversationStarters(input);

  // Privacy guard — strip anything that might leak a name from the optional
  // context note before sending. Names are NEVER part of the payload.
  const safePayload = {
    relationshipType: input.relationshipType,
    daysSinceContact: input.daysSinceContact,
    contextNote: input.contextNote ? input.contextNote.slice(0, 200) : undefined,
  };

  const response = await callAI({
    system: CONVERSATION_STARTERS_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(safePayload) }],
    model: pickModel('generateConversationStarters'),
    cacheSystem: true,
    task: 'generateConversationStarters',
  });

  try {
    return ConversationStartersSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('generateConversationStarters', 'ConversationStarters', response, err);
  }
}

export async function suggestInterestAreas(input: InterestSuggestionsInput): Promise<InterestSuggestions> {
  if (isMock) return buildMockInterestSuggestions(input);

  const response = await callAI({
    system: INTEREST_SUGGESTIONS_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('suggestInterestAreas'),
    cacheSystem: true,
    task: 'suggestInterestAreas',
  });

  try {
    return InterestSuggestionsSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('suggestInterestAreas', 'InterestSuggestions', response, err);
  }
}

export async function suggestCrossDisciplineLink(
  input: CrossDisciplineLinkInput,
): Promise<CrossDisciplineLink> {
  if (isMock) return buildMockCrossDisciplineLink(input);

  const response = await callAI({
    system: CROSS_DISCIPLINE_LINK_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('suggestCrossDisciplineLink'),
    cacheSystem: true,
    task: 'suggestCrossDisciplineLink',
  });

  try {
    return CrossDisciplineLinkSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('suggestCrossDisciplineLink', 'CrossDisciplineLink', response, err);
  }
}

export async function generateWeekRoutine(input: GenerateWeekRoutineInput): Promise<GeneratedWeekRoutine> {
  if (isMock) return buildMockWeekRoutine(input);

  const response = await callAI({
    system: GENERATE_WEEK_ROUTINE_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('generateWeekRoutine'),
    cacheSystem: true,
    task: 'generateWeekRoutine',
    // 7 days of blocks comfortably exceeds the default; bump the cap.
    maxTokens: 6000,
  });

  try {
    return GeneratedWeekRoutineSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('generateWeekRoutine', 'GeneratedWeekRoutine', response, err);
  }
}

export async function generateMonthlyInsightReport(
  input: MonthlyInsightReportInput,
): Promise<MonthlyInsightReport> {
  if (isMock) return buildMockMonthlyInsightReport(input);

  const response = await callAI({
    system: MONTHLY_INSIGHT_REPORT_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    model: pickModel('generateMonthlyInsightReport'),
    cacheSystem: true,
    task: 'generateMonthlyInsightReport',
  });

  try {
    return MonthlyInsightReportSchema.parse(extractJson(response));
  } catch (err) {
    recordSchemaFailure('generateMonthlyInsightReport', 'MonthlyInsightReport', response, err);
  }
}
