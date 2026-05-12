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
  /** Override the proxy default model. See `src/ai/modelRouter.ts`. */
  model?: string;
  /** When true, the proxy wraps the system prompt with cache_control so it
   *  hits Anthropic's prompt cache (only effective for system >= 1024 chars). */
  cacheSystem?: boolean;
  /** Tag used for cost-ledger attribution. */
  task?: string;
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

export const GoalDescriptionSchema = z.object({
  description: z.string().min(1),
});
export type GoalDescription = z.infer<typeof GoalDescriptionSchema>;

export interface GoalDescriptionInput {
  title: string;
  goalType: string;
  level?: string;
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

// --- Career Strategy (Elite Strategist output) ---

export const CareerStrategySchema = z.object({
  realityCheck: z.string(),
  skillGaps: z.array(z.object({
    skill: z.string(),
    currentLevel: z.string(),
    requiredLevel: z.string(),
    priority: z.enum(['must', 'should', 'nice']),
  })),
  phases: z.array(z.object({
    name: z.enum(['Foundation', 'Build', 'Proof']),
    weeks: z.string(),
    focus: z.string(),
    milestones: z.array(z.string()),
  })).length(3),
  dailyPlan: z.object({
    deepWork: z.array(z.string()),
    build: z.array(z.string()),
    review: z.array(z.string()),
  }),
  weeklyOutput: z.array(z.object({
    week: z.number(),
    artifact: z.string(),
    description: z.string(),
  })),
  failurePoints: z.array(z.string()),
  mvs: z.object({
    metric: z.string(),
    outcome: z.string(),
  }),
});

export type CareerStrategy = z.infer<typeof CareerStrategySchema>;

export interface CareerStrategyInput {
  currentRole: string;
  targetRole: string;
  currentSkills: string[];
  timeframeWeeks: number;
  weeklyHours: number;
  constraints?: string;
}

// --- Motivation (contextual quote + tip) ---

export const MotivationSchema = z.object({
  quote: z.string(),
  microTip: z.string(),
});

export type Motivation = z.infer<typeof MotivationSchema>;

export interface MotivationInput {
  module: 'goals' | 'career' | 'health' | 'finance' | 'social' | 'polymath';
  context: string; // free-text summary of relevant user state
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
  /** ISO 4217 code (e.g. 'INR'). Defaults to 'INR' when omitted. */
  currency?: string;
}

export interface FinanceInsightInput {
  goalTitle: string;
  targetAmount: number;
  currentSaved: number;
  monthlySavings: number;
  monthsRemaining: number;
}

// --- Transaction Categorization ---

export const TRANSACTION_CATEGORIES = [
  'food_delivery',
  'groceries',
  'dining_out',
  'transport',
  'fuel',
  'shopping',
  'subscriptions',
  'utilities',
  'rent',
  'entertainment',
  'health',
  'education',
  'travel',
  'investments',
  'insurance',
  'debt_repayment',
  'transfers',
  'income',
  'gifts',
  'charity',
  'cash_withdrawal',
  'fees_charges',
  'personal_care',
  'other',
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const CategorizeMerchantSchema = z.object({
  category: z.enum(TRANSACTION_CATEGORIES),
  confidence: z.number().min(0).max(1),
});

export type CategorizeMerchantResult = z.infer<typeof CategorizeMerchantSchema>;

export const CategorizeMerchantBatchSchema = z.array(CategorizeMerchantSchema);

export type CategorizeMerchantBatchResult = z.infer<typeof CategorizeMerchantBatchSchema>;

export interface ParsedTransaction {
  id: string;
  date: string;
  amount: number;
  direction: 'debit' | 'credit';
  merchant: string;
  category: TransactionCategory;
  source: 'hdfc' | 'icici' | 'axis' | 'manual';
  rawEmailId: string;
  confidence: number;
  userCorrected: boolean;
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

// --- Tomorrow Tweak (evening reflect) ---

export const TomorrowTweakModuleEnum = z.enum(['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal']);

export const TomorrowTweakSchema = z.object({
  kind: z.enum(['move', 'resize', 'swap', 'add']),
  blockId: z.string().nullable(),
  patch: z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    title: z.string().optional(),
    module: TomorrowTweakModuleEnum.optional(),
  }),
  rationale: z.string().max(200),
});

export type TomorrowTweak = z.infer<typeof TomorrowTweakSchema>;

export interface TomorrowTweakInput {
  today: {
    date: string;
    mood: number | null;
    blockReviews: Record<string, 'did' | 'skipped' | 'rescheduled'>;
  };
  tomorrow: {
    date: string;
    blocks: Array<{
      id: string;
      startTime: string;
      endTime: string;
      title: string;
      module: string;
    }>;
  };
  primaryDomains: string[];
}

export type FoodRecognition = z.infer<typeof FoodRecognitionSchema>;

// --- Discovery Extraction ---

const ConfidenceEnum = z.enum(['high', 'medium', 'low']);

export const DiscoveryExtractionSchema = z.object({
  identity: z.object({
    firstName: z.string().nullable(),
    ageBand: z.string().nullable(),
    location: z.string().nullable(),
    seasonOfLife: z.string().nullable(),
    confidence: ConfidenceEnum,
  }),
  goals: z.array(z.object({
    title: z.string(),
    domain: z.enum(['goals', 'health', 'finance', 'career', 'social', 'polymath']),
    horizon: z.enum(['90d', '1y', '3y', 'lifetime']),
    why: z.string().nullable(),
    quote: z.string().nullable(),
    confidence: ConfidenceEnum,
  })).max(5),
  health: z.object({
    conditions: z.array(z.string()),
    constraints: z.array(z.string()),
    currentHabits: z.array(z.string()),
    energyPattern: z.string().nullable(),
    confidence: ConfidenceEnum,
  }),
  finance: z.object({
    currency: z.string().nullable(),
    monthlyIncomeBand: z.string().nullable(),
    topGoals: z.array(z.string()),
    anxieties: z.array(z.string()),
    confidence: ConfidenceEnum,
  }),
  career: z.object({
    role: z.string().nullable(),
    seniority: z.string().nullable(),
    aspirations: z.array(z.string()),
    skillsLearning: z.array(z.string()),
    confidence: ConfidenceEnum,
  }),
  relationships: z.object({
    keyPeople: z.array(z.object({
      firstName: z.string(),
      role: z.string(),
      cadence: z.string().nullable(),
    })),
    socialEnergy: z.enum(['introvert', 'ambivert', 'extrovert']).nullable(),
    confidence: ConfidenceEnum,
  }),
  curiosity: z.object({
    activeInterests: z.array(z.string()),
    dormantInterests: z.array(z.string()),
    confidence: ConfidenceEnum,
  }),
  values: z.array(z.string()).max(5),
  workingStyle: z.object({
    peakHours: z.string().nullable(),
    focusBlocks: z.string().nullable(),
    restNeeds: z.string().nullable(),
    confidence: ConfidenceEnum,
  }),
  communication: z.object({
    tone: z.enum(['direct', 'warm', 'playful', 'clinical']).nullable(),
    avoid: z.array(z.string()),
    confidence: ConfidenceEnum,
  }),
  struggles: z.array(z.object({
    area: z.string(),
    description: z.string(),
    quote: z.string().nullable(),
  })),
  triedAlready: z.array(z.string()),
  asks: z.array(z.string()),
});

export type DiscoveryExtraction = z.infer<typeof DiscoveryExtractionSchema>;
