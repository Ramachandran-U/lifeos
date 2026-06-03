import {
  GoalHierarchySchema,
  GeneratedRoutineSchema,
  FinancialPlanSchema,
  BloodReportResultSchema,
  FoodRecognitionSchema,
  TrajectoryAssessmentSchema,
} from '../types';

// These tests exercise the Zod-parse / sanitize seam of the single-shot AI
// functions in functions.ts. We stub `callAI` (the only network seam) and feed
// it canonical-but-messy or garbage responses, then assert that:
//   • messy-but-recoverable JSON PARSES to the typed shape (coercion repairs it),
//   • truly malformed output never throws a RAW AI error to the caller — it
//     either surfaces the wrapped `AI returned invalid <Schema>` message (the
//     recordSchemaFailure path, a CLAUDE.md requirement) or, for the merchant
//     categorizers, returns the safe 'other' fallback.
//
// Mirrors the harness in skillGapSanitize.test.ts EXACTLY: mock only ../client,
// leave EXPO_PUBLIC_USE_AI_MOCK UNSET so the real parse path runs (isMock is
// read once at import time).

jest.mock('../client', () => ({
  callAI: jest.fn(),
  // generateGamifiedAvatar imports generateAvatarViaProxy from the same module;
  // stub it so the module graph resolves even though we never call it here.
  generateAvatarViaProxy: jest.fn(),
}));

import { callAI } from '../client';
import {
  decomposeGoal,
  generateRoutine,
  generateFinancialPlan,
  parseBloodReport,
  categorizeMerchant,
  categorizeMerchantsBatch,
  recogniseFood,
  assessTrajectory,
} from '../functions';
import type {
  GoalInput,
  RoutineInput,
  FinanceInput,
  TrajectoryAssessmentInput,
} from '../types';

const callAIMock = callAI as jest.MockedFunction<typeof callAI>;

beforeEach(() => callAIMock.mockReset());

// --------------------------------------------------------------------------
// decomposeGoal — single-shot path (agent_goal_decomp flag defaults off)
// --------------------------------------------------------------------------

describe('decomposeGoal — parse seam', () => {
  const input: GoalInput = {
    visionStatement: 'Become a staff engineer',
    name: 'Test User',
  };

  it('parses a fenced, prose-wrapped hierarchy into the typed shape', async () => {
    const hierarchy = {
      primaryGoal: { title: 'Staff Engineer', type: 'career' },
      yearly: { title: 'Year 1', milestone: 'Lead a project' },
      monthly: [{ month: 1, title: 'Foundations', milestone: 'Ship feature' }],
      weekly: [{ week: 1, focus: 'System design', tasks: ['Read DDIA ch. 1'] }],
      dailyTaskExamples: ['Review one design doc'],
    };
    callAIMock.mockResolvedValueOnce(
      'Here is your plan:\n```json\n' + JSON.stringify(hierarchy) + '\n```\nGood luck!',
    );
    const result = await decomposeGoal(input);
    expect(result.primaryGoal.type).toBe('career');
    expect(result.monthly).toHaveLength(1);
    expect(result.weekly[0].tasks).toEqual(['Read DDIA ch. 1']);
    expect(() => GoalHierarchySchema.parse(result)).not.toThrow();
  });

  it('throws a wrapped (never raw) error on non-JSON output', async () => {
    callAIMock.mockResolvedValueOnce('I cannot generate that plan right now.');
    await expect(decomposeGoal(input)).rejects.toThrow(/AI returned invalid GoalHierarchy/);
  });

  it('throws a wrapped error when a required field is the wrong type', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      primaryGoal: { title: 'X', type: 'not_a_real_type' },
      yearly: { title: 'Y', milestone: 'm' },
      monthly: [],
      weekly: [],
      dailyTaskExamples: [],
    }));
    await expect(decomposeGoal(input)).rejects.toThrow(/AI returned invalid GoalHierarchy/);
  });
});

// --------------------------------------------------------------------------
// generateRoutine — RoutineBlockSchema does its own coercion
// --------------------------------------------------------------------------

describe('generateRoutine — parse seam', () => {
  const input: RoutineInput = {
    wakeTime: '07:00',
    sleepTime: '23:00',
    workStartTime: '09:00',
    workEndTime: '17:00',
  };

  it('lowercases/trims the block module and tolerates messy energy casing', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      blocks: [
        { startTime: '07:00', endTime: '07:30', title: 'Workout', module: '  HEALTH ', energyRequired: 'HIGH' },
        { startTime: '09:00', endTime: '12:00', title: 'Deep work', module: 'Work', energyRequired: 'medium' },
      ],
      briefing: 'A balanced day.',
    }));
    const result = await generateRoutine(input);
    expect(result.blocks[0].module).toBe('health');
    expect(result.blocks[0].energyRequired).toBe('high');
    expect(result.blocks[1].module).toBe('work');
    expect(() => GeneratedRoutineSchema.parse(result)).not.toThrow();
  });

  it('drops an unrecognised energy value to undefined (tolerantEnum) rather than throwing', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      blocks: [
        { startTime: '07:00', endTime: '07:30', title: 'Meditate', module: 'rest', energyRequired: 'cosmic' },
      ],
      briefing: 'Easy morning.',
    }));
    const result = await generateRoutine(input);
    expect(result.blocks[0].energyRequired).toBeUndefined();
    expect(result.blocks[0].module).toBe('rest');
  });

  it('throws a wrapped error when the module enum is unrepairable', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      blocks: [
        { startTime: '07:00', endTime: '07:30', title: 'X', module: 'astrology', energyRequired: 'low' },
      ],
      briefing: 'b',
    }));
    await expect(generateRoutine(input)).rejects.toThrow(/AI returned invalid GeneratedRoutine/);
  });

  it('throws a wrapped error on garbage (not even JSON)', async () => {
    callAIMock.mockResolvedValueOnce('sorry, no routine }{[');
    await expect(generateRoutine(input)).rejects.toThrow(/AI returned invalid GeneratedRoutine/);
  });
});

// --------------------------------------------------------------------------
// generateFinancialPlan
// --------------------------------------------------------------------------

describe('generateFinancialPlan — parse seam', () => {
  const input: FinanceInput = {
    goalType: 'emergency_fund',
    targetAmount: 100000,
    targetDate: '2027-01-01',
    monthlySavings: 5000,
    incomeBracket: 'mid',
    riskProfile: 'balanced',
  };

  it('parses a fenced plan into the typed shape', async () => {
    const plan = {
      summary: 'Save steadily.',
      monthlyTarget: 5000,
      strategy: [
        { category: 'savings', action: 'Automate a transfer', monthlyImpact: 5000, priority: 1 },
      ],
      milestones: [
        { title: 'Halfway', targetAmount: 50000, targetDate: '2026-07-01' },
      ],
      weeklyTips: ['Pack lunch twice a week'],
    };
    callAIMock.mockResolvedValueOnce('```json\n' + JSON.stringify(plan) + '\n```');
    const result = await generateFinancialPlan(input);
    expect(result.monthlyTarget).toBe(5000);
    expect(result.strategy[0].category).toBe('savings');
    expect(() => FinancialPlanSchema.parse(result)).not.toThrow();
  });

  it('throws a wrapped error when a strategy category is invalid', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      summary: 's',
      monthlyTarget: 5000,
      strategy: [{ category: 'gambling', action: 'a', monthlyImpact: 1, priority: 1 }],
      milestones: [],
      weeklyTips: [],
    }));
    await expect(generateFinancialPlan(input)).rejects.toThrow(/AI returned invalid FinancialPlan/);
  });

  it('throws a wrapped error on non-JSON output', async () => {
    callAIMock.mockResolvedValueOnce('No plan available.');
    await expect(generateFinancialPlan(input)).rejects.toThrow(/AI returned invalid FinancialPlan/);
  });
});

// --------------------------------------------------------------------------
// parseBloodReport
// --------------------------------------------------------------------------

describe('parseBloodReport — parse seam', () => {
  it('parses a prose-wrapped report with marker statuses', async () => {
    const report = {
      markers: [
        { marker: 'Hemoglobin', value: 14.2, unit: 'g/dL', referenceRange: '13-17', status: 'normal' },
        { marker: 'LDL', value: 160, unit: 'mg/dL', referenceRange: '<100', status: 'high' },
      ],
      summary: 'LDL is elevated.',
      suggestions: ['Reduce saturated fat'],
    };
    callAIMock.mockResolvedValueOnce('Analysis follows:\n' + JSON.stringify(report));
    const result = await parseBloodReport('fake report text');
    expect(result.markers).toHaveLength(2);
    expect(result.markers[1].status).toBe('high');
    expect(() => BloodReportResultSchema.parse(result)).not.toThrow();
  });

  it('throws a wrapped error when a marker value is a string instead of number', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      markers: [{ marker: 'X', value: 'twelve', unit: 'g/dL', referenceRange: '1-2', status: 'normal' }],
      summary: 's',
      suggestions: [],
    }));
    await expect(parseBloodReport('x')).rejects.toThrow(/AI returned invalid BloodReportResult/);
  });

  it('throws a wrapped error on non-JSON output', async () => {
    callAIMock.mockResolvedValueOnce('Could not read the report.');
    await expect(parseBloodReport('x')).rejects.toThrow(/AI returned invalid BloodReportResult/);
  });
});

// --------------------------------------------------------------------------
// categorizeMerchant — swallows errors, returns safe 'other' fallback
// --------------------------------------------------------------------------

describe('categorizeMerchant — safe-fallback seam', () => {
  it('parses a valid fenced categorization', async () => {
    callAIMock.mockResolvedValueOnce('```json\n{"category":"groceries","confidence":0.9}\n```');
    const result = await categorizeMerchant('FreshMart', 1200);
    expect(result.category).toBe('groceries');
    expect(result.confidence).toBeCloseTo(0.9);
  });

  it('returns other/0 (never throws) on an invalid category', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({ category: 'space_travel', confidence: 0.9 }));
    const result = await categorizeMerchant('Acme', 50);
    expect(result.category).toBe('other');
    expect(result.confidence).toBe(0);
  });

  it('returns other/0 (never throws) on garbage output', async () => {
    callAIMock.mockResolvedValueOnce('not json at all');
    const result = await categorizeMerchant('Acme', 50);
    expect(result.category).toBe('other');
    expect(result.confidence).toBe(0);
  });
});

describe('categorizeMerchantsBatch — safe-fallback seam', () => {
  it('short-circuits to [] for an empty input without calling the model', async () => {
    const result = await categorizeMerchantsBatch([]);
    expect(result).toEqual([]);
    expect(callAIMock).not.toHaveBeenCalled();
  });

  it('parses a valid batch of the matching length', async () => {
    const items = [
      { merchant: 'FreshMart', amountRupees: 1200 },
      { merchant: 'MetroFuel', amountRupees: 800 },
    ];
    callAIMock.mockResolvedValueOnce(JSON.stringify([
      { category: 'groceries', confidence: 0.8 },
      { category: 'fuel', confidence: 0.7 },
    ]));
    const result = await categorizeMerchantsBatch(items);
    expect(result.map((r) => r.category)).toEqual(['groceries', 'fuel']);
  });

  it('returns all other/0 when the model returns the wrong number of rows', async () => {
    const items = [
      { merchant: 'FreshMart', amountRupees: 1200 },
      { merchant: 'MetroFuel', amountRupees: 800 },
    ];
    callAIMock.mockResolvedValueOnce(JSON.stringify([{ category: 'groceries', confidence: 0.8 }]));
    const result = await categorizeMerchantsBatch(items);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.category === 'other' && r.confidence === 0)).toBe(true);
  });

  it('returns all other/0 (never throws) on garbage output', async () => {
    const items = [{ merchant: 'Acme', amountRupees: 50 }];
    callAIMock.mockResolvedValueOnce('totally broken }{');
    const result = await categorizeMerchantsBatch(items);
    expect(result).toEqual([{ category: 'other', confidence: 0 }]);
  });
});

// --------------------------------------------------------------------------
// recogniseFood
// --------------------------------------------------------------------------

describe('recogniseFood — parse seam', () => {
  it('parses a fenced food recognition into the typed shape', async () => {
    const recognition = {
      items: [
        { name: 'Banana', quantity: '1 medium', quantityG: 118, calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
      ],
    };
    callAIMock.mockResolvedValueOnce('```json\n' + JSON.stringify(recognition) + '\n```');
    const result = await recogniseFood('ZmFrZQ==', 'image/jpeg');
    expect(result.items[0].name).toBe('Banana');
    expect(result.items[0].calories).toBe(105);
    expect(() => FoodRecognitionSchema.parse(result)).not.toThrow();
  });

  it('throws a wrapped error when a nutrient is missing', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({
      items: [{ name: 'Apple', quantity: '1', quantityG: 100, calories: 52, protein: 0.3, carbs: 14 }],
    }));
    await expect(recogniseFood('ZmFrZQ==', 'image/jpeg')).rejects.toThrow(/AI returned invalid FoodRecognition/);
  });

  it('throws a wrapped error on non-JSON output', async () => {
    callAIMock.mockResolvedValueOnce('I cannot identify the food.');
    await expect(recogniseFood('ZmFrZQ==', 'image/jpeg')).rejects.toThrow(/AI returned invalid FoodRecognition/);
  });
});

// --------------------------------------------------------------------------
// assessTrajectory
// --------------------------------------------------------------------------

describe('assessTrajectory — parse seam', () => {
  const input: TrajectoryAssessmentInput = {
    visionTitle: 'Run a marathon',
    horizonMonths: 12,
    elapsedMonths: 4,
    expectedProgressPct: 33,
    actualProgressPct: 20,
    status: 'behind',
    completedSubGoals: 2,
    totalSubGoals: 8,
    laggingTitles: ['Long runs'],
  };

  it('parses a fenced assessment with 1-3 recalibration steps', async () => {
    const assessment = {
      verdict: 'You are slightly behind but recoverable.',
      recalibration: ['Add one long run weekly', 'Cut rest days to one'],
    };
    callAIMock.mockResolvedValueOnce('```json\n' + JSON.stringify(assessment) + '\n```');
    const result = await assessTrajectory(input);
    expect(result.verdict).toMatch(/behind/);
    expect(result.recalibration).toHaveLength(2);
    expect(() => TrajectoryAssessmentSchema.parse(result)).not.toThrow();
  });

  it('throws a wrapped error when recalibration is empty (violates min(1))', async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({ verdict: 'On track', recalibration: [] }));
    await expect(assessTrajectory(input)).rejects.toThrow(/AI returned invalid TrajectoryAssessment/);
  });

  it('throws a wrapped error on non-JSON output', async () => {
    callAIMock.mockResolvedValueOnce('No assessment available.');
    await expect(assessTrajectory(input)).rejects.toThrow(/AI returned invalid TrajectoryAssessment/);
  });
});
