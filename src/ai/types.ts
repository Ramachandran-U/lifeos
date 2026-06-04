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

// Gemini function-calling parts. Used only by the tool-use agent runtime
// (src/ai/agent/runtime.ts); the proxy passes these through verbatim.
export type AIToolPart =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string | AIContentPart[] | AIToolPart[];
}

/** A tool the model may call. Mirrors Gemini's FunctionDeclaration. */
export interface AIToolDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
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
  /** Optional cancellation — aborts the underlying fetch. (BUG-012) */
  signal?: AbortSignal;
  /** When present, enables Gemini function-calling (tool-use, Gemini-only). */
  tools?: AIToolDeclaration[];
}

/** Structured proxy response — text plus any tool calls the model requested. */
export interface AIToolResponse {
  text: string;
  functionCalls: Array<{ name: string; args: Record<string, unknown> }>;
  model: string;
}

/** Input to the avatar image-generation path (nano banana via the proxy). */
export interface AvatarGenInput {
  /** Base64-encoded source photo (no `data:` prefix). */
  imageBase64: string;
  /** MIME type of the source photo. Defaults to image/jpeg. */
  mimeType?: string;
  /** Optional override for the cartoon-ification instruction. */
  stylePrompt?: string;
  /** Optional cancellation — aborts the underlying fetch. */
  signal?: AbortSignal;
}

/** Generated-avatar result — a base64 image, not text. */
export interface AvatarGenResult {
  imageBase64: string;
  mimeType: string;
  model: string;
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

// --- Polymath / Curiosity Types ---

export const InterestCategoryEnum = z.enum([
  'arts',
  'science',
  'tech',
  'sports',
  'music',
  'writing',
  'language',
  'philosophy',
  'other',
]);
export type InterestCategory = z.infer<typeof InterestCategoryEnum>;

export const ExplorationDepthEnum = z.enum(['taste', 'hobbyist', 'deep_dive']);
export type ExplorationDepth = z.infer<typeof ExplorationDepthEnum>;

export const SuggestedAreaSchema = z.object({
  name: z.string().min(1),
  category: InterestCategoryEnum,
  blurb: z.string().min(1),
  whyThisFits: z.string().min(1),
});
export type SuggestedArea = z.infer<typeof SuggestedAreaSchema>;

export const InterestSuggestionsSchema = z.object({
  areas: z.array(SuggestedAreaSchema).min(4).max(10),
});
export type InterestSuggestions = z.infer<typeof InterestSuggestionsSchema>;

export interface InterestSuggestionsInput {
  existingInterests: Array<{ name: string; category: string }>;
}

// --- YouTube interest import ---

export const YouTubeInterestSchema = z.object({
  name: z.string().min(1).max(60),
  category: InterestCategoryEnum,
  weeklyMinutesTarget: z.number().int().min(15).max(600),
  why: z.string().min(1).max(160),
});
export type YouTubeImportedInterest = z.infer<typeof YouTubeInterestSchema>;

export const YouTubeImportSchema = z.object({
  interests: z.array(YouTubeInterestSchema).max(8),
});
export type YouTubeImport = z.infer<typeof YouTubeImportSchema>;

export interface YouTubeImportInput {
  /** Subscribed channels (title + short description). */
  channels: Array<{ title: string; description?: string }>;
  /** Existing interest names — don't propose duplicates. */
  existingInterests: string[];
}

export const CrossDisciplineLinkSchema = z.object({
  headline: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
  starterAction: z.string().min(1).max(160),
});
export type CrossDisciplineLink = z.infer<typeof CrossDisciplineLinkSchema>;

export interface CrossDisciplineLinkInput {
  interestA: { name: string; category: string };
  interestB: { name: string; category: string };
}

// --- Proactive Daily Briefing (P4-02) ---

export const DailyBriefingSchema = z.object({
  // 1-3 short lines the user reads first thing. Joined with newlines for display.
  lines: z.array(z.string()).min(1).max(3),
});
export type DailyBriefingResult = z.infer<typeof DailyBriefingSchema>;

export interface DailyBriefingInput {
  name: string | null;
  topGoal: string | null;          // primary/life goal title, if any
  blocksToday: number;
  overdueContacts: number;         // social nudge driver (no names)
  lifeScore: number;               // 0-100 composite
  lifeScoreBand: string;           // e.g. "Building"
  weeklyInsight: string | null;    // the existing behaviour-v1 insight, if any
  topDomainYesterday: string | null; // domain that got the most time yesterday
}

// --- Monthly Money Review (finance) ---

export const MonthlyMoneyReviewSchema = z.object({
  headline: z.string().min(1),
  wins: z.array(z.string()).min(1).max(3),
  leaks: z.array(z.string()).min(1).max(3),
  oneAdjustment: z.string().min(1),
});
export type MonthlyMoneyReview = z.infer<typeof MonthlyMoneyReviewSchema>;

// --- Annual Life Review (P4-03) ---

export const AnnualReviewSchema = z.object({
  // One honest, celebratory sentence summing up the year.
  headline: z.string().min(1),
  // Per-domain narrative (1-2 sentences each).
  domains: z
    .array(z.object({ domain: z.string().min(1), summary: z.string().min(1) }))
    .min(1)
    .max(6),
  biggestWin: z.string().min(1),
  growthArea: z.string().min(1),
  themeForNextYear: z.string().min(1),
});
export type AnnualReview = z.infer<typeof AnnualReviewSchema>;

export interface AnnualReviewInput {
  windowDays: number;
  name: string | null;
  goals: { total: number; completed: number };
  routine: { blocksPlanned: number; blocksCompleted: number; completionRate: number };
  domainMinutes: Record<string, number>;
  lifeScore: { current: number; start: number };
  topStreaks: { key: string; count: number }[];
  totalXP: number;
  badgeCount: number;
  social: { contacts: number; inCadencePct: number | null };
}

// --- Long-Term Trajectory (P4-04) ---

export const TrajectoryAssessmentSchema = z.object({
  // One-sentence verdict the user reads first.
  verdict: z.string().min(1),
  // 1-3 concrete recalibration steps for the coming quarter.
  recalibration: z.array(z.string()).min(1).max(3),
});
export type TrajectoryAssessment = z.infer<typeof TrajectoryAssessmentSchema>;

export interface TrajectoryAssessmentInput {
  visionTitle: string;
  horizonMonths: number;
  elapsedMonths: number;
  expectedProgressPct: number; // 0-100
  actualProgressPct: number; // 0-100
  status: 'ahead' | 'on_track' | 'behind';
  completedSubGoals: number;
  totalSubGoals: number;
  laggingTitles: string[];
}

// --- Behaviour Intelligence v2 Types ---

export const MonthlyInsightReportSchema = z.object({
  wins: z.array(z.string()).min(1).max(5),
  patterns: z.array(z.string()).min(1).max(5),
  slipping: z.array(z.string()).max(5),
  oneAdjustment: z.string().min(1),
});
export type MonthlyInsightReport = z.infer<typeof MonthlyInsightReportSchema>;

export interface MonthlyInsightReportInput {
  windowDays: number;
  totals: {
    blocksCompleted: number;
    blocksSkipped: number;
    blocksPlanned: number;
    completionRate: number; // 0..1
  };
  domainMinutes: Partial<{
    goals: number; health: number; finance: number; career: number; social: number; polymath: number;
  }>;
  inferredPreferences: {
    productiveHours: number[];
    preferredBlockMinutes: number | null;
    droppedHabits: string[];
    preferredRestDays: number[];
  };
  /** Top behaviour-event types over the window — derived from behaviour_events. */
  topEvents: Array<{ type: string; count: number }>;
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
  /** Polymath interests the user has flagged "protect time" — the planner must
   *  reserve at least the given weekly minutes for each, spread across the week. */
  protectedInterests?: Array<{ name: string; weeklyMinutes: number }>;
  /** Minutes spent per domain over the last 7 days. Used by the planner to
   *  soften the dominant domain and bump silent primary domains. */
  lastWeekDomainMinutes?: Partial<{
    goals: number; health: number; finance: number; career: number; social: number; polymath: number;
  }>;
  /** Day of the week for the routine being generated. 0 = Sunday … 6 = Saturday.
   *  Used so weekend plans differ from weekday plans. */
  dayOfWeek?: number;
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
  /** Titles of goals the user just removed or postponed. The rebalancer should
   *  free the time those blocks were taking and reallocate it, not reinstate them. */
  droppedGoals?: string[];
  /** Titles of goals the user just added. The rebalancer should work a focused
   *  block toward each into the remaining day (without overloading it). */
  addedGoals?: string[];
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
  /** Minutes spent per domain over the last 7 days — used for adaptive rebalancing. */
  lastWeekDomainMinutes?: Partial<{
    goals: number; health: number; finance: number; career: number; social: number; polymath: number;
  }>;
}

// --- Week Routine (multi-day batch generation) ---

export const WeekRoutineDaySchema = z.object({
  date: z.string(),              // YYYY-MM-DD
  dayOfWeek: z.number().min(0).max(6),
  blocks: z.array(RoutineBlockSchema),
  briefing: z.string(),
});

export const GeneratedWeekRoutineSchema = z.object({
  days: z.array(WeekRoutineDaySchema).length(7),
  weeklyOutline: z.string(), // 1-3 sentences explaining the week's shape
});

export type GeneratedWeekRoutine = z.infer<typeof GeneratedWeekRoutineSchema>;

export interface GenerateWeekRoutineInput {
  startDate: string;          // YYYY-MM-DD — first day in the week
  profile: UserProfile;
  primaryDomains: string[];
  protectedInterests?: Array<{ name: string; weeklyMinutes: number }>;
  lastWeekDomainMinutes?: Partial<{
    goals: number; health: number; finance: number; career: number; social: number; polymath: number;
  }>;
}
