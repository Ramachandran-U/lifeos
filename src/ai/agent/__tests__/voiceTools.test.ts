// fake-indexeddb gives Dexie a real (in-memory) IndexedDB so the Dexie-backed
// finance store runs under the node test env. MUST come before the module under
// test is imported, because `financeDb = new FinanceDb()` opens at load.
import 'fake-indexeddb/auto';

// Stub the read-tool set so this spec stays hermetic to the finance tool: the
// real buildLifeOsTools pulls in the app DB / query chain we don't need here.
// buildVoiceTools just composes [...readTools, recentSpendingTool], so an empty
// read set lets us exercise getRecentSpending in isolation.
jest.mock('@/ai/agent/tools', () => ({ buildLifeOsTools: () => [] }));

// getTodayNutrition reads the user row + weight logs + today's food entries.
// Mock those so the nutrition tool is exercised hermetically — calorieTargets in
// @/utils/health stays REAL (it's the engine under test).
jest.mock('@/db/queries/users', () => ({ getUser: jest.fn() }));
jest.mock('@/db/queries/health', () => ({
  getRecentWeightLogs: jest.fn(() => []),
  getFoodEntriesByDate: jest.fn(() => []),
}));

import { financeDb, upsertTransactions, type TxRecord } from '@/finance/db/transactionDb';
import { buildVoiceTools, type VoiceAgentDeps } from '@/ai/agent/voiceTools';
import { createActionQueue, type ProposedAction } from '@/ai/agent/actionQueue';
import { getUser } from '@/db/queries/users';
import { getRecentWeightLogs, getFoodEntriesByDate } from '@/db/queries/health';

const mockGetUser = getUser as jest.Mock;
const mockWeights = getRecentWeightLogs as jest.Mock;
const mockFood = getFoodEntriesByDate as jest.Mock;

function makeTx(overrides: Partial<TxRecord> = {}): TxRecord {
  return {
    id: 'tx-1',
    date: '2026-05-20',
    amount: 10000, // paise
    direction: 'debit',
    merchant: 'Test Merchant',
    category: 'other',
    source: 'manual',
    rawEmailId: 'email-1',
    confidence: 0.5,
    userCorrected: false,
    ...overrides,
  };
}

const TODAY = '2026-05-31';
function spendingTool() {
  const tool = buildVoiceTools({ userId: 'u1', today: TODAY }).find(
    (t) => t.declaration.name === 'getRecentSpending',
  );
  if (!tool) throw new Error('getRecentSpending tool not found');
  return tool;
}

beforeEach(async () => {
  await financeDb.transactions.clear();
});

afterAll(() => {
  financeDb.close();
});

describe('buildVoiceTools', () => {
  it('exposes the getRecentSpending tool', () => {
    const names = buildVoiceTools({ userId: 'u1', today: TODAY }).map((t) => t.declaration.name);
    expect(names).toContain('getRecentSpending');
  });

  it('stays read-only (no act tools) without agent deps', () => {
    const names = buildVoiceTools({ userId: 'u1', today: TODAY }).map((t) => t.declaration.name);
    expect(names).not.toContain('navigateTo');
    expect(names).not.toContain('proposeCreateGoal');
    expect(names).not.toContain('syncGoogleFit');
  });

  it('gates getMoneyWithPayee behind the financePayeeQuery option', () => {
    const off = buildVoiceTools({ userId: 'u1', today: TODAY }).map((t) => t.declaration.name);
    expect(off).not.toContain('getMoneyWithPayee');
    const on = buildVoiceTools({ userId: 'u1', today: TODAY }, undefined, {
      financePayeeQuery: true,
    }).map((t) => t.declaration.name);
    expect(on).toContain('getMoneyWithPayee');
  });
});

describe('buildVoiceTools (agentic)', () => {
  function agenticTools() {
    const queue = createActionQueue();
    const deps: VoiceAgentDeps = { queue, commitPending: async () => ({ committed: 0 }) };
    const ctx = {
      userId: 'u1',
      today: TODAY,
      navigate: () => {},
      currentScreen: () => 'today' as const,
    };
    return { tools: buildVoiceTools(ctx, deps), queue };
  }

  function tool(name: string) {
    const t = agenticTools().tools.find((x) => x.declaration.name === name);
    if (!t) throw new Error(`${name} not found`);
    return t;
  }

  it('appends nav + propose + sync + commit tools when wired', () => {
    const names = agenticTools().tools.map((t) => t.declaration.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'navigateTo',
        'getCurrentScreen',
        'proposeCreateRoutineBlock', // from buildLifeOsWriteTools
        'proposeCreateGoal',
        'proposeGenerateCareerPath',
        'syncGoogleFit',
        'commitProposedActions',
      ]),
    );
  });

  it('proposeCreateGoal stages a createGoalFromVision action (no immediate write)', () => {
    const { tools, queue } = agenticTools();
    const createGoal = tools.find((t) => t.declaration.name === 'proposeCreateGoal')!;
    const res = createGoal.execute({ visionStatement: 'I want to run a marathon' });
    expect(res).toEqual({ proposed: true });
    const staged = queue.list();
    expect(staged).toHaveLength(1);
    expect(staged[0]).toMatchObject<Partial<ProposedAction>>({
      kind: 'createGoalFromVision',
      payload: { visionStatement: 'I want to run a marathon' },
    } as Partial<ProposedAction>);
  });

  it('proposeGenerateCareerPath demands the required slots before staging', () => {
    const { tools, queue } = agenticTools();
    const career = tools.find((t) => t.declaration.name === 'proposeGenerateCareerPath')!;
    // Missing timeline → rejected, nothing staged (drives the model to ask).
    const bad = career.execute({ currentRole: 'SWE', targetRole: 'EM' }) as { proposed: boolean };
    expect(bad.proposed).toBe(false);
    expect(queue.list()).toHaveLength(0);
    // Complete → staged.
    const ok = career.execute({ currentRole: 'SWE', targetRole: 'EM', timelineMonths: 24 });
    expect(ok).toEqual({ proposed: true });
    expect(queue.list()[0]).toMatchObject({
      kind: 'generateCareerPath',
      payload: { currentRole: 'SWE', targetRole: 'EM', timelineMonths: 24 },
    });
  });

  it('navigateTo (instant) reports the screen without staging anything', () => {
    expect(tool('navigateTo').execute({ screen: 'career' })).toEqual({
      navigated: true,
      screen: 'career',
    });
  });
});

describe('getRecentSpending', () => {
  it('summarises in-window debits by category and merchant, in rupees', async () => {
    await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', date: '2026-05-20', amount: 50000, merchant: 'Swiggy', category: 'food_delivery' }),
      makeTx({ id: 'b', rawEmailId: 'e-b', date: '2026-05-21', amount: 30000, merchant: 'Swiggy', category: 'food_delivery' }),
      makeTx({ id: 'c', rawEmailId: 'e-c', date: '2026-05-22', amount: 20000, merchant: 'Uber', category: 'transport' }),
      // a credit (income) — must be excluded from "spending"
      makeTx({ id: 'inc', rawEmailId: 'e-inc', date: '2026-05-22', amount: 999999, direction: 'credit', merchant: 'Salary', category: 'income' }),
      // a debit outside the 30-day window — must be excluded
      makeTx({ id: 'old', rawEmailId: 'e-old', date: '2026-01-01', amount: 70000, merchant: 'OldShop', category: 'shopping' }),
    ]);

    const result = (await spendingTool().execute({ days: 30 })) as {
      currency: string;
      totalSpentRupees: number;
      byCategory: Array<{ category: string; amountRupees: number; pct: number }>;
      topMerchants: Array<{ merchant: string; amountRupees: number; count: number }>;
    };

    // (50000 + 30000 + 20000) paise = 100000 paise = ₹1000. Credit + old debit excluded.
    expect(result.currency).toBe('INR');
    expect(result.totalSpentRupees).toBe(1000);
    expect(result.byCategory[0]).toEqual({ category: 'food_delivery', amountRupees: 800, pct: 80 });
    expect(result.byCategory.find((c) => c.category === 'transport')).toEqual({
      category: 'transport',
      amountRupees: 200,
      pct: 20,
    });
    expect(result.topMerchants[0]).toEqual({ merchant: 'Swiggy', amountRupees: 800, count: 2 });
  });

  it('returns a zero summary with a sync hint when the window is empty', async () => {
    const result = (await spendingTool().execute({})) as {
      totalSpentRupees: number;
      byCategory: unknown[];
      topMerchants: unknown[];
      note?: string;
    };

    expect(result.totalSpentRupees).toBe(0);
    expect(result.byCategory).toEqual([]);
    expect(result.topMerchants).toEqual([]);
    expect(result.note).toMatch(/sync/i);
  });
});

function payeeTool() {
  const tool = buildVoiceTools({ userId: 'u1', today: TODAY }, undefined, {
    financePayeeQuery: true,
  }).find((t) => t.declaration.name === 'getMoneyWithPayee');
  if (!tool) throw new Error('getMoneyWithPayee tool not found');
  return tool;
}

describe('getMoneyWithPayee', () => {
  it('splits sent (debit) and received (credit) for a normalized payee match, in rupees', async () => {
    await upsertTransactions([
      makeTx({ id: 'a', rawEmailId: 'e-a', date: '2026-05-20', amount: 50000, direction: 'debit', merchant: 'Anjali Hari' }),
      // UPI-noisy label for the SAME person → normalizes to the same key.
      makeTx({ id: 'b', rawEmailId: 'e-b', date: '2026-05-22', amount: 30000, direction: 'debit', merchant: 'UPI/123456789/ANJALI HARI' }),
      makeTx({ id: 'c', rawEmailId: 'e-c', date: '2026-05-25', amount: 20000, direction: 'credit', merchant: 'Anjali Hari' }),
      // different payee — excluded by name
      makeTx({ id: 'd', rawEmailId: 'e-d', date: '2026-05-21', amount: 10000, direction: 'debit', merchant: 'Swiggy' }),
      // out of the 30-day window — excluded
      makeTx({ id: 'old', rawEmailId: 'e-old', date: '2026-01-01', amount: 99999, direction: 'debit', merchant: 'Anjali Hari' }),
    ]);

    const res = (await payeeTool().execute({ payeeQuery: 'Anjali', days: 30 })) as {
      found: boolean; currency: string; windowDays: number;
      sentRupees: number; sentCount: number; receivedRupees: number; receivedCount: number;
      netSentRupees: number; matchedPayees: string[]; ambiguous: boolean;
      firstDate: string; lastDate: string;
    };

    expect(res.found).toBe(true);
    expect(res.currency).toBe('INR');
    expect(res.windowDays).toBe(30);
    // 50000 + 30000 paise sent = ₹800 over 2 payments; the noisy UPI label collapses to one payee.
    expect(res.sentRupees).toBe(800);
    expect(res.sentCount).toBe(2);
    expect(res.receivedRupees).toBe(200);
    expect(res.receivedCount).toBe(1);
    expect(res.netSentRupees).toBe(600);
    expect(res.ambiguous).toBe(false);
    expect(res.matchedPayees).toHaveLength(1);
    expect(res.firstDate).toBe('2026-05-20');
    expect(res.lastDate).toBe('2026-05-25');
  });

  it('flags ambiguity when genuinely different payees match the same query', async () => {
    await upsertTransactions([
      makeTx({ id: 'p1', rawEmailId: 'e-p1', date: '2026-05-20', amount: 50000, direction: 'debit', merchant: 'Anjali Hari' }),
      makeTx({ id: 'p2', rawEmailId: 'e-p2', date: '2026-05-21', amount: 70000, direction: 'debit', merchant: 'Anjali Stores' }),
    ]);

    const res = (await payeeTool().execute({ payeeQuery: 'Anjali' })) as {
      found: boolean; ambiguous: boolean; matchedPayees: string[]; sentRupees: number;
    };

    expect(res.found).toBe(true);
    expect(res.ambiguous).toBe(true);
    expect(res.matchedPayees).toEqual(expect.arrayContaining(['Anjali Hari', 'Anjali Stores']));
    expect(res.sentRupees).toBe(1200);
  });

  it('returns found:false with a helpful note when nobody matches', async () => {
    await upsertTransactions([
      makeTx({ id: 's', rawEmailId: 'e-s', date: '2026-05-20', amount: 10000, direction: 'debit', merchant: 'Swiggy' }),
    ]);

    const res = (await payeeTool().execute({ payeeQuery: 'Bob' })) as { found: boolean; note?: string };
    expect(res.found).toBe(false);
    expect(res.note).toMatch(/no payments|sync/i);
  });

  it('requires a payee name', async () => {
    const res = (await payeeTool().execute({})) as { found: boolean; error?: string };
    expect(res.found).toBe(false);
    expect(res.error).toMatch(/payeeQuery/i);
  });
});

function nutritionTool() {
  const tool = buildVoiceTools({ userId: 'u1', today: TODAY }).find(
    (t) => t.declaration.name === 'getTodayNutrition',
  );
  if (!tool) throw new Error('getTodayNutrition tool not found');
  return tool;
}

describe('getTodayNutrition', () => {
  it('computes consumed + remaining against a personalised target', async () => {
    mockGetUser.mockReturnValue({ heightCm: 178, age: 30, sex: 'male', activityLevel: 'moderate', healthGoalType: 'maintain' });
    mockWeights.mockReturnValue([{ weight: 75 }]);
    mockFood.mockReturnValue([
      { calories: 500, protein: 30, carbs: 50, fat: 15 },
      { calories: 300, protein: 20, carbs: 40, fat: 8 },
    ]);

    const res = (await nutritionTool().execute({})) as {
      goal: string; personalised: boolean; mealsLoggedToday: number;
      target: { calories: number }; consumed: { calories: number; protein: number };
      remaining: { calories: number };
    };

    expect(res.personalised).toBe(true);
    expect(res.goal).toBe('maintain');
    // 75kg/178cm/30/male/moderate/maintain → 2660 kcal (matches the health.test case)
    expect(res.target.calories).toBe(2660);
    expect(res.consumed.calories).toBe(800);
    expect(res.consumed.protein).toBe(50);
    expect(res.remaining.calories).toBe(2660 - 800);
    expect(res.mealsLoggedToday).toBe(2);
  });

  it('returns the generic estimate flagged not-personalised when vitals are missing', async () => {
    mockGetUser.mockReturnValue({ heightCm: null, age: null });
    mockWeights.mockReturnValue([]);
    mockFood.mockReturnValue([]);

    const res = (await nutritionTool().execute({})) as {
      personalised: boolean; target: { calories: number }; note?: string;
    };

    expect(res.personalised).toBe(false);
    expect(res.target.calories).toBe(2000);
    expect(res.note).toMatch(/personalise/i);
  });
});
