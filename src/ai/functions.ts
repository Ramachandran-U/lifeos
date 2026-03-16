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
} from './types';
import { GOAL_DECOMPOSITION_PROMPT } from './prompts/goals';
import { SKILL_GAP_PROMPT } from './prompts/career';
import { ROUTINE_GENERATION_PROMPT } from './prompts/routine';
import { BLOOD_REPORT_PROMPT, MEAL_SUGGESTION_PROMPT } from './prompts/health';
import { MOCK_GOAL_HIERARCHY } from './mocks/goals';
import { MOCK_SKILL_GAP } from './mocks/career';
import { MOCK_ROUTINE } from './mocks/routine';
import { MOCK_BLOOD_REPORT, MOCK_MEAL_SUGGESTION } from './mocks/health';

const isMock = process.env.USE_AI_MOCK === 'true';

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
