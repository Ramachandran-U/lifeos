import { callAI } from './client';
import { extractJson } from './extractJson';
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
} from './types';
import { GOAL_DECOMPOSITION_PROMPT, GOAL_DESCRIPTION_PROMPT } from './prompts/goals';
import { SKILL_GAP_PROMPT, CAREER_STRATEGY_PROMPT, MOTIVATION_PROMPT } from './prompts/career';
import { ROUTINE_GENERATION_PROMPT } from './prompts/routine';
import { BLOOD_REPORT_PROMPT, MEAL_SUGGESTION_PROMPT, FOOD_RECOGNITION_PROMPT } from './prompts/health';
import {
  FINANCIAL_PLAN_PROMPT,
  WEEKLY_FINANCE_INSIGHT_PROMPT,
  MERCHANT_CATEGORIZE_PROMPT,
} from './prompts/finance';
import { buildMockGoalHierarchy, buildMockGoalDescription } from './mocks/goals';
import { buildMockSkillGap, buildMockCareerStrategy, buildMockMotivation } from './mocks/career';
import { MOCK_ROUTINE } from './mocks/routine';
import { MOCK_BLOOD_REPORT, MOCK_MEAL_SUGGESTION, MOCK_FOOD_RECOGNITION } from './mocks/health';
import { MOCK_FINANCIAL_PLAN, MOCK_WEEKLY_INSIGHT, buildMockFinancialPlan } from './mocks/finance';

const isMock = process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

export async function decomposeGoal(input: GoalInput): Promise<GoalHierarchy> {
  if (isMock) return buildMockGoalHierarchy(input.visionStatement, input.name);

  const response = await callAI({
    system: GOAL_DECOMPOSITION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return GoalHierarchySchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    throw new Error('AI returned invalid goal structure: ' + detail.slice(0, 120));
  }
}

export async function analyseSkillGap(input: CareerInput): Promise<SkillGapAnalysis> {
  if (isMock) return buildMockSkillGap(input.currentRole, input.targetRole, input.currentSkills);

  const response = await callAI({
    system: SKILL_GAP_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return SkillGapAnalysisSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    throw new Error('AI returned invalid skill gap analysis: ' + detail.slice(0, 120));
  }
}

export async function generateRoutine(input: RoutineInput): Promise<GeneratedRoutine> {
  if (isMock) return MOCK_ROUTINE;

  const response = await callAI({
    system: ROUTINE_GENERATION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return GeneratedRoutineSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    throw new Error('AI returned invalid routine: ' + detail.slice(0, 120));
  }
}

export async function parseBloodReport(reportText: string): Promise<BloodReportResult> {
  if (isMock) return MOCK_BLOOD_REPORT;

  const response = await callAI({
    system: BLOOD_REPORT_PROMPT,
    messages: [{ role: 'user', content: reportText }],
  });

  try {
    return BloodReportResultSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    throw new Error('AI returned invalid blood report analysis: ' + detail.slice(0, 120));
  }
}

export async function suggestMeals(context: string): Promise<MealSuggestion> {
  if (isMock) return MOCK_MEAL_SUGGESTION;

  const response = await callAI({
    system: MEAL_SUGGESTION_PROMPT,
    messages: [{ role: 'user', content: context }],
  });

  try {
    return MealSuggestionSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    throw new Error('AI returned invalid meal suggestions: ' + detail.slice(0, 120));
  }
}

export async function generateFinancialPlan(input: FinanceInput): Promise<FinancialPlan> {
  if (isMock) return buildMockFinancialPlan(input);

  const response = await callAI({
    system: FINANCIAL_PLAN_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return FinancialPlanSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    throw new Error('AI returned invalid financial plan: ' + detail.slice(0, 120));
  }
}

export async function getWeeklyFinanceInsight(input: FinanceInsightInput): Promise<WeeklyFinanceInsight> {
  if (isMock) return MOCK_WEEKLY_INSIGHT;

  const response = await callAI({
    system: WEEKLY_FINANCE_INSIGHT_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return WeeklyFinanceInsightSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    throw new Error('AI returned invalid finance insight: ' + detail.slice(0, 120));
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
  });

  try {
    return CategorizeMerchantSchema.parse(extractJson(response));
  } catch {
    return { category: 'other' as TransactionCategory, confidence: 0 };
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
  });

  try {
    return FoodRecognitionSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);

    throw new Error('AI returned invalid food recognition: ' + detail.slice(0, 120));
  }
}

export async function generateCareerStrategy(input: CareerStrategyInput): Promise<CareerStrategy> {
  if (isMock) return buildMockCareerStrategy(input);

  const response = await callAI({
    system: CAREER_STRATEGY_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 2500,
  });

  try {
    return CareerStrategySchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error('AI returned invalid career strategy: ' + detail.slice(0, 120));
  }
}

export async function describeGoal(input: GoalDescriptionInput): Promise<GoalDescription> {
  if (isMock) return buildMockGoalDescription(input);

  const response = await callAI({
    system: GOAL_DESCRIPTION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 200,
  });

  try {
    return GoalDescriptionSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error('AI returned invalid goal description: ' + detail.slice(0, 120));
  }
}

export async function generateMotivation(input: MotivationInput): Promise<Motivation> {
  if (isMock) return buildMockMotivation(input);

  const response = await callAI({
    system: MOTIVATION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    maxTokens: 200,
  });

  try {
    return MotivationSchema.parse(extractJson(response));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error('AI returned invalid motivation: ' + detail.slice(0, 120));
  }
}
