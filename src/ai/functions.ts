import { callAI } from './client';
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
} from './types';
import { GOAL_DECOMPOSITION_PROMPT } from './prompts/goals';
import { SKILL_GAP_PROMPT } from './prompts/career';
import { ROUTINE_GENERATION_PROMPT } from './prompts/routine';
import { BLOOD_REPORT_PROMPT, MEAL_SUGGESTION_PROMPT, FOOD_RECOGNITION_PROMPT } from './prompts/health';
import { FINANCIAL_PLAN_PROMPT, WEEKLY_FINANCE_INSIGHT_PROMPT } from './prompts/finance';
import { MOCK_GOAL_HIERARCHY } from './mocks/goals';
import { MOCK_SKILL_GAP } from './mocks/career';
import { MOCK_ROUTINE } from './mocks/routine';
import { MOCK_BLOOD_REPORT, MOCK_MEAL_SUGGESTION, MOCK_FOOD_RECOGNITION } from './mocks/health';
import { MOCK_FINANCIAL_PLAN, MOCK_WEEKLY_INSIGHT } from './mocks/finance';

const isMock = process.env.EXPO_PUBLIC_USE_AI_MOCK === 'true' || process.env.USE_AI_MOCK === 'true';

export async function decomposeGoal(input: GoalInput): Promise<GoalHierarchy> {
  if (isMock) return MOCK_GOAL_HIERARCHY;

  const response = await callAI({
    system: GOAL_DECOMPOSITION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return GoalHierarchySchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid goal structure');
  }
}

export async function analyseSkillGap(input: CareerInput): Promise<SkillGapAnalysis> {
  if (isMock) return MOCK_SKILL_GAP;

  const response = await callAI({
    system: SKILL_GAP_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return SkillGapAnalysisSchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid skill gap analysis');
  }
}

export async function generateRoutine(input: RoutineInput): Promise<GeneratedRoutine> {
  if (isMock) return MOCK_ROUTINE;

  const response = await callAI({
    system: ROUTINE_GENERATION_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return GeneratedRoutineSchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid routine');
  }
}

export async function parseBloodReport(reportText: string): Promise<BloodReportResult> {
  if (isMock) return MOCK_BLOOD_REPORT;

  const response = await callAI({
    system: BLOOD_REPORT_PROMPT,
    messages: [{ role: 'user', content: reportText }],
  });

  try {
    return BloodReportResultSchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid blood report analysis');
  }
}

export async function suggestMeals(context: string): Promise<MealSuggestion> {
  if (isMock) return MOCK_MEAL_SUGGESTION;

  const response = await callAI({
    system: MEAL_SUGGESTION_PROMPT,
    messages: [{ role: 'user', content: context }],
  });

  try {
    return MealSuggestionSchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid meal suggestions');
  }
}

export async function generateFinancialPlan(input: FinanceInput): Promise<FinancialPlan> {
  if (isMock) return MOCK_FINANCIAL_PLAN;

  const response = await callAI({
    system: FINANCIAL_PLAN_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return FinancialPlanSchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid financial plan');
  }
}

export async function getWeeklyFinanceInsight(input: FinanceInsightInput): Promise<WeeklyFinanceInsight> {
  if (isMock) return MOCK_WEEKLY_INSIGHT;

  const response = await callAI({
    system: WEEKLY_FINANCE_INSIGHT_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  try {
    return WeeklyFinanceInsightSchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid finance insight');
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
    return FoodRecognitionSchema.parse(JSON.parse(response));
  } catch {
    throw new Error('AI returned invalid food recognition');
  }
}
