import { z } from 'zod';

// LLM-tolerant enum: lowercases + trims the input before checking membership.
// Smaller models (Llama via Groq, Gemma, Gemini-flash) frequently return
// capitalized values like "Low" / "Medium" / "High" or stray whitespace.
// `optional` controls whether unknown values become undefined or fail.
function tolerantEnum<T extends [string, ...string[]]>(values: T, opts: { passthrough?: boolean } = {}) {
  const set = new Set<string>(values);
  return z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const norm = v.trim().toLowerCase();
    if (set.has(norm)) return norm;
    return opts.passthrough ? norm : undefined;
  }, z.enum(values).optional());
}

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

// --- Social Types ---
// IMPORTANT: contact names NEVER appear in AI requests. Only relationship type
// + days since contact + optional context note are sent.

export const RelationshipTypeEnum = z.enum([
  'inner_circle',
  'close_friend',
  'family',
  'mentor',
  'colleague',
  'acquaintance',
]);

export const ConversationStartersSchema = z.object({
  openers: z.array(z.string()).min(2).max(4),
});

export type ConversationStarters = z.infer<typeof ConversationStartersSchema>;

export interface ConversationStartersInput {
  relationshipType: z.infer<typeof RelationshipTypeEnum>;
  daysSinceContact: number;
  contextNote?: string; // optional user-supplied context — must not include the contact's name
}

// --- Routine Types ---

export const RoutineBlockSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  title: z.string(),
  module: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal']),
  ),
  energyRequired: tolerantEnum(['low', 'medium', 'high']),
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
  // --- Onboarding v2 additions: all optional so legacy callers keep working ---
  chronotype?: 'lark' | 'balanced' | 'owl' | null;
  primaryDomains?: string[];
  fixedBlocks?: Array<{
    label: string;
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
    kind: 'work' | 'family' | 'commute' | 'meal' | 'sleep' | 'other';
  }>;
  constraints?: string[];
  struggles?: string[];
  currentHabits?: string[];
  communicationTone?: 'direct' | 'warm' | 'playful' | 'clinical' | null;
  /** Inferred from past behaviour — informs but does not override explicit profile. */
  inferredPreferences?: {
    preferredBlockMinutes?: number | null;
    productiveHours?: number[];
    droppedHabits?: string[];
    preferredRestDays?: number[];
  };
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

// --- UserProfile (Onboarding v2) ---
// Canonical "what LifeOS knows about you" structure. Populated by any onboarding
// path (chat, import, form) and continuously refined by behaviour-event inference.
// Routine generation is gated on confidence.overall >= 0.7.

export const ChronotypeEnum = z.enum(['lark', 'balanced', 'owl']);
export type Chronotype = z.infer<typeof ChronotypeEnum>;

export const PrimaryDomainEnum = z.enum(['goals', 'health', 'finance', 'career', 'social', 'polymath']);
export type PrimaryDomain = z.infer<typeof PrimaryDomainEnum>;

export const FixedBlockSchema = z.object({
  label: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  daysOfWeek: z.array(z.number().min(0).max(6)),
  kind: z.enum(['work', 'family', 'commute', 'meal', 'sleep', 'other']),
});
export type FixedBlock = z.infer<typeof FixedBlockSchema>;

export const ProfileSlotConfidenceSchema = z.object({
  identity: z.number().min(0).max(1),
  vision: z.number().min(0).max(1),
  schedule: z.number().min(0).max(1),
  chronotype: z.number().min(0).max(1),
  habits: z.number().min(0).max(1),
  constraints: z.number().min(0).max(1),
  primaryDomains: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
});
export type ProfileSlotConfidence = z.infer<typeof ProfileSlotConfidenceSchema>;

export const InferredPreferencesSchema = z.object({
  preferredBlockMinutes: z.number().nullable(),
  productiveHours: z.array(z.number().min(0).max(23)),
  droppedHabits: z.array(z.string()),
  preferredRestDays: z.array(z.number().min(0).max(6)),
  /** ISO timestamp of the last weekly inference run. Optional for legacy profiles. */
  lastInferredAt: z.string().nullable().optional(),
});
export type InferredPreferences = z.infer<typeof InferredPreferencesSchema>;

export const UserProfileSchema = z.object({
  version: z.literal(1),
  identity: z.object({
    firstName: z.string().nullable(),
    ageBand: z.string().nullable(),
    seasonOfLife: z.string().nullable(),
  }),
  vision: z.object({
    statement: z.string().nullable(),
    horizon: z.enum(['90d', '1y', '3y', 'lifetime']).nullable(),
    topGoals: z.array(z.string()).max(5),
  }),
  schedule: z.object({
    wakeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    sleepTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    workStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    workEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    fixedBlocks: z.array(FixedBlockSchema),
  }),
  chronotype: ChronotypeEnum.nullable(),
  primaryDomains: z.array(PrimaryDomainEnum).max(3),
  habits: z.object({
    current: z.array(z.string()),
    aspirational: z.array(z.string()),
  }),
  constraints: z.array(z.string()),
  struggles: z.array(z.string()),
  values: z.array(z.string()).max(5),
  communication: z.object({
    tone: z.enum(['direct', 'warm', 'playful', 'clinical']).nullable(),
    avoid: z.array(z.string()),
  }),
  confidence: ProfileSlotConfidenceSchema,
  inferredPreferences: InferredPreferencesSchema,
  source: z.enum(['chat', 'import', 'form', 'hybrid']),
  lastUpdated: z.string(),
  /** ISO timestamp of the first routine block the user ever completed post-v2. */
  firstBlockCompletedAt: z.string().nullable().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ROUTINE_CONFIDENCE_THRESHOLD = 0.7;

export function emptyUserProfile(source: UserProfile['source'] = 'chat'): UserProfile {
  return {
    version: 1,
    identity: { firstName: null, ageBand: null, seasonOfLife: null },
    vision: { statement: null, horizon: null, topGoals: [] },
    schedule: { wakeTime: null, sleepTime: null, workStartTime: null, workEndTime: null, fixedBlocks: [] },
    chronotype: null,
    primaryDomains: [],
    habits: { current: [], aspirational: [] },
    constraints: [],
    struggles: [],
    values: [],
    communication: { tone: null, avoid: [] },
    confidence: {
      identity: 0, vision: 0, schedule: 0, chronotype: 0,
      habits: 0, constraints: 0, primaryDomains: 0, overall: 0,
    },
    inferredPreferences: {
      preferredBlockMinutes: null,
      productiveHours: [],
      droppedHabits: [],
      preferredRestDays: [],
    },
    source,
    lastUpdated: new Date().toISOString(),
  };
}

// Partial slots returned by the conversational extractor — every field optional.
// The orchestrator merges these into the running UserProfile.
export const ProfileSlotsPatchSchema = z.object({
  identity: z.object({
    firstName: z.string().nullable().optional(),
    ageBand: z.string().nullable().optional(),
    seasonOfLife: z.string().nullable().optional(),
  }).optional(),
  vision: z.object({
    statement: z.string().nullable().optional(),
    horizon: z.enum(['90d', '1y', '3y', 'lifetime']).nullable().optional(),
    topGoals: z.array(z.string()).optional(),
  }).optional(),
  schedule: z.object({
    wakeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    sleepTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    workStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    workEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    fixedBlocks: z.array(FixedBlockSchema).optional(),
  }).optional(),
  chronotype: ChronotypeEnum.nullable().optional(),
  primaryDomains: z.array(PrimaryDomainEnum).optional(),
  habits: z.object({
    current: z.array(z.string()).optional(),
    aspirational: z.array(z.string()).optional(),
  }).optional(),
  constraints: z.array(z.string()).optional(),
  struggles: z.array(z.string()).optional(),
  values: z.array(z.string()).optional(),
  communication: z.object({
    tone: z.enum(['direct', 'warm', 'playful', 'clinical']).nullable().optional(),
    avoid: z.array(z.string()).optional(),
  }).optional(),
  confidenceDeltas: ProfileSlotConfidenceSchema.partial().optional(),
});
export type ProfileSlotsPatch = z.infer<typeof ProfileSlotsPatchSchema>;

export const DiscoveryChatTurnSchema = z.object({
  nextQuestion: z.string(),
  patch: ProfileSlotsPatchSchema,
  stage: z.enum(['identity', 'vision', 'schedule', 'habits', 'asks', 'done']),
  done: z.boolean(),
});
export type DiscoveryChatTurn = z.infer<typeof DiscoveryChatTurnSchema>;

export interface DiscoveryChatInput {
  profile: UserProfile;
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// --- Adaptive re-planning (Sprint 3) ---

export const ReplanRemainingDaySchema = z.object({
  /** Block IDs that should be removed from the rest of the day. */
  drop: z.array(z.string()),
  /** Patches to existing blocks. `id` must reference an existing block. */
  edits: z.array(z.object({
    id: z.string(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    title: z.string().optional(),
  })),
  /** New blocks to add for the remainder of the day. */
  add: z.array(z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    title: z.string(),
    module: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['goal', 'health', 'finance', 'career', 'social', 'polymath', 'rest', 'work', 'meal']),
  ),
    energyRequired: tolerantEnum(['low', 'medium', 'high']),
  })),
  /** One-line explanation shown to the user. */
  rationale: z.string().max(160),
});
export type ReplanRemainingDay = z.infer<typeof ReplanRemainingDaySchema>;

export interface ReplanRemainingDayInput {
  nowHHMM: string;
  remainingBlocks: Array<{
    id: string;
    startTime: string;
    endTime: string;
    title: string;
    module: string;
    status: 'upcoming' | 'in_progress' | 'completed' | 'skipped';
  }>;
  skippedToday: Array<{ id: string; title: string; module: string }>;
  primaryDomains: string[];
  chronotype: 'lark' | 'balanced' | 'owl' | null;
  /** Optional recovery hint — when true, drop high-energy blocks for the rest of the day. */
  softenForRecovery?: boolean;
}

// --- Tomorrow Routine (post-Reflect) ---

export const GenerateTomorrowRoutineSchema = GeneratedRoutineSchema;
export type GenerateTomorrowRoutine = z.infer<typeof GenerateTomorrowRoutineSchema>;

export interface GenerateTomorrowRoutineInput {
  tomorrowDate: string;
  profile: UserProfile;
  todayReview: {
    mood: number | null;
    blockReviews: Record<string, 'did' | 'skipped' | 'rescheduled'>;
    skippedTitles: string[];
    completedTitles: string[];
  };
  /** Optional recovery signal — true => soften the plan. */
  softenForRecovery?: boolean;
}
