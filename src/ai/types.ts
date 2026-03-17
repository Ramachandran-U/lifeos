import { z } from 'zod';

export type AIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string | AIContentPart[];
}

export interface AIRequest {
  system?: string;
  messages: AIMessage[];
  maxTokens?: number;
}

// --- Goal Types ---

export const GoalHierarchySchema = z.object({
  primaryGoal: z.object({
    title: z.string(),
    type: z.enum(['career', 'health', 'finance', 'learning', 'personal']),
  }),
  yearly: z.object({
    title: z.string(),
    milestone: z.string(),
  }),
  monthly: z.array(z.object({
    month: z.number(),
    title: z.string(),
    milestone: z.string(),
  })),
  weekly: z.array(z.object({
    week: z.number(),
    focus: z.string(),
    tasks: z.array(z.string()),
  })),
  dailyTaskExamples: z.array(z.string()),
});

export type GoalHierarchy = z.infer<typeof GoalHierarchySchema>;

export interface GoalInput {
  visionStatement: string;
  name: string;
  age?: number;
}

// --- Health Types ---

export const MealSuggestionSchema = z.object({
  meals: z.array(z.object({
    name: z.string(),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    description: z.string(),
  })),
});

export type MealSuggestion = z.infer<typeof MealSuggestionSchema>;

export const BloodReportResultSchema = z.object({
  markers: z.array(z.object({
    marker: z.string(),
    value: z.number(),
    unit: z.string(),
    referenceRange: z.string(),
    status: z.enum(['normal', 'high', 'low']),
  })),
  summary: z.string(),
  suggestions: z.array(z.string()),
});

export type BloodReportResult = z.infer<typeof BloodReportResultSchema>;

// --- Career Types ---

export const SkillGapAnalysisSchema = z.object({
  gaps: z.array(z.object({
    skill: z.string(),
    currentLevel: z.enum(['none', 'beginner', 'intermediate', 'advanced']),
    requiredLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    priority: z.number(),
  })),
  resources: z.array(z.object({
    title: z.string(),
    type: z.enum(['course', 'book', 'project', 'person', 'practice']),
    estimatedHours: z.number(),
    url: z.string().optional(),
  })),
});

export type SkillGapAnalysis = z.infer<typeof SkillGapAnalysisSchema>;

export interface CareerInput {
  currentRole: string;
  targetRole: string;
  timelineMonths: number;
  currentSkills: string[];
}

// --- Routine Types ---

export const RoutineBlockSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  title: z.string(),
  module: z.enum(['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal']),
  energyRequired: z.enum(['low', 'medium', 'high']).optional(),
});

export const GeneratedRoutineSchema = z.object({
  blocks: z.array(RoutineBlockSchema),
  briefing: z.string(),
});

export type GeneratedRoutine = z.infer<typeof GeneratedRoutineSchema>;

export interface RoutineInput {
  wakeTime: string;
  sleepTime: string;
  workStartTime: string;
  workEndTime: string;
  goals?: string[];
  careerFocus?: string;
}

// --- Finance Types ---

export const FinancialPlanSchema = z.object({
  summary: z.string(),
  monthlyTarget: z.number(),
  strategy: z.array(z.object({
    category: z.enum(['savings', 'investment', 'debt', 'income', 'expense_reduction']),
    action: z.string(),
    monthlyImpact: z.number(),
    priority: z.number(),
  })),
  milestones: z.array(z.object({
    title: z.string(),
    targetAmount: z.number(),
    targetDate: z.string(),
  })),
  weeklyTips: z.array(z.string()),
});

export type FinancialPlan = z.infer<typeof FinancialPlanSchema>;

export const WeeklyFinanceInsightSchema = z.object({
  headline: z.string(),
  insight: z.string(),
  actionItem: z.string(),
  motivationalNote: z.string(),
});

export type WeeklyFinanceInsight = z.infer<typeof WeeklyFinanceInsightSchema>;

export interface FinanceInput {
  goalType: string;
  targetAmount: number;
  targetDate: string;
  monthlySavings: number;
  incomeBracket: string;
  riskProfile: string;
}

export interface FinanceInsightInput {
  goalTitle: string;
  targetAmount: number;
  currentSaved: number;
  monthlySavings: number;
  monthsRemaining: number;
}

// --- Food Recognition Types ---

export const FoodRecognitionSchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    quantity: z.string(),
    quantityG: z.number(),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  })),
});

export type FoodRecognition = z.infer<typeof FoodRecognitionSchema>;
