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

// syncFinance lazy-imports the gmail oauth check + the shared orchestrator. Mock
// both so the tool's guard + happy path are exercised without a real Gmail /
// network round-trip. (`mock`-prefixed so jest's hoist guard allows the closure.)
let mockGmailConnected = true;
jest.mock('@/finance/gmail/oauth', () => ({
  isGmailConnected: () => mockGmailConnected,
}));
jest.mock('@/finance/gmail/sync', () => ({
  syncFinanceFromGmail: jest.fn(async () => ({ total: 3, parsed: 2, skipped: 1, ingested: 2 })),
}));

import { Platform } from 'react-native';
import { financeDb, upsertTransactions, type TxRecord } from '@/finance/db/transactionDb';
import { buildVoiceTools, type VoiceAgentDeps } from '@/ai/agent/voiceTools';
import { createActionQueue, commitActions, type ProposedAction, type CommitDeps } from '@/ai/agent/actionQueue';
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
    expect(names).not.toContain('proposeExploreIdea');
    expect(names).not.toContain('syncGoogleFit');
  });

  it('grounds explore, career, contacts and money goals too — read-only', () => {
    const names = buildVoiceTools({ userId: 'u1', today: TODAY }).map((t) => t.declaration.name);
    expect(names).toEqual(
      expect.arrayContaining(['getMyInterests', 'getMyExpeditions', 'getCareerState', 'getContacts', 'getFinancialGoals']),
    );
  });

  it('getCareerState reports no path when none is saved', () => {
    const tool = buildVoiceTools({ userId: 'u1', today: TODAY }).find(
      (t) => t.declaration.name === 'getCareerState',
    )!;
    const res = tool.execute({}) as { hasPath: boolean; note?: string };
    expect(res.hasPath).toBe(false);
    expect(res.note).toMatch(/build one|Career/i);
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
        'proposeExploreIdea',
        'proposeLogFood',
        'proposeLogWeight',
        'proposeLogContact',
        'proposeSetFinancialGoal',
        'proposeReplanToday',
        'proposePlanAhead',
        'syncGoogleFit',
        'syncFinance',
        'commitProposedActions',
      ]),
    );
  });

  it('syncFinance is web+config+connection guarded and returns an instant summary on success', async () => {
    const prevEnv = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    const prevOS = Platform.OS;
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'client-123';
    Platform.OS = 'web'; // finance sync is web-only (Dexie store)
    try {
      const res = await tool('syncFinance').execute({});
      // Gmail mocked as connected; orchestrator mocked → pass-through summary.
      expect(res).toEqual({ synced: true, total: 3, parsed: 2, skipped: 1, ingested: 2 });
    } finally {
      Platform.OS = prevOS;
      if (prevEnv === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = prevEnv;
    }
  });

  it('syncFinance reports a friendly error when Gmail is not connected', async () => {
    const prevEnv = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    const prevOS = Platform.OS;
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'client-123';
    Platform.OS = 'web';
    mockGmailConnected = false;
    try {
      const res = await tool('syncFinance').execute({});
      expect(res).toMatchObject({ synced: false });
      expect((res as { error: string }).error).toMatch(/Finance screen/);
    } finally {
      mockGmailConnected = true;
      Platform.OS = prevOS;
      if (prevEnv === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = prevEnv;
    }
  });

  it('proposeSetFinancialGoal / proposeReplanToday / proposePlanAhead stage their actions', () => {
    const { tools, queue } = agenticTools();
    const find = (n: string) => tools.find((t) => t.declaration.name === n)!;
    expect(find('proposeSetFinancialGoal').execute({ title: 'Emergency fund', goalType: 'emergency_fund', targetAmount: 500000 })).toEqual({ proposed: true });
    find('proposeReplanToday').execute({});
    find('proposePlanAhead').execute({});
    expect(queue.list().map((a) => a.kind)).toEqual(
      expect.arrayContaining(['setFinancialGoal', 'replanToday', 'planAhead']),
    );
    // title + goalType are required for a financial goal.
    expect(find('proposeSetFinancialGoal').execute({ goalType: 'savings' })).toMatchObject({ proposed: false });
  });

  it('proposeLogFood / proposeLogWeight / proposeLogContact stage logging actions', () => {
    const { tools, queue } = agenticTools();
    const find = (n: string) => tools.find((t) => t.declaration.name === n)!;
    expect(find('proposeLogFood').execute({ foodName: '2 eggs', quantityG: 100, calories: 150, protein: 12, carbs: 1, fat: 10 })).toEqual({ proposed: true });
    expect(find('proposeLogWeight').execute({ weightKg: 70.5 })).toEqual({ proposed: true });
    expect(find('proposeLogContact').execute({ ref: 'c1', type: 'call' })).toEqual({ proposed: true });
    expect(queue.list().map((a) => a.kind)).toEqual(
      expect.arrayContaining(['logFood', 'logWeight', 'logContactInteraction']),
    );
    // logFood needs all macros — a missing one is rejected (drives the model to estimate it).
    const bad = find('proposeLogFood').execute({ foodName: 'x', quantityG: 100, calories: 150, protein: 12, carbs: 1 }) as { proposed: boolean };
    expect(bad.proposed).toBe(false);
    // proposeLogContact defaults an unknown type to "other".
    find('proposeLogContact').execute({ ref: 'c2', type: 'telepathy' });
    const c2 = queue.list().find(
      (a) => a.kind === 'logContactInteraction' && (a.payload as { ref: string }).ref === 'c2',
    );
    expect(c2 && (c2.payload as { type: string }).type).toBe('other');
  });

  it('proposeExploreIdea stages an exploreIdea action — single idea and bridge', () => {
    const { tools, queue } = agenticTools();
    const explore = tools.find((t) => t.declaration.name === 'proposeExploreIdea')!;
    expect(explore.execute({ topic: 'how cities grow' })).toEqual({ proposed: true });
    expect(queue.list()[0]).toMatchObject({ kind: 'exploreIdea', payload: { topic: 'how cities grow' } });
    explore.execute({ topic: 'cooking', bridgeWith: 'chemistry' });
    expect(queue.list()[1]).toMatchObject({
      kind: 'exploreIdea',
      payload: { topic: 'cooking', bridgeWith: 'chemistry' },
    });
  });

  it('commitActions refuses exploreIdea — it is a navigation intent, not a DB write', async () => {
    const [res] = await commitActions([
      { kind: 'exploreIdea', summary: 'Explore space', payload: { topic: 'space' } },
    ]);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/navigation/i);
  });

  describe('logging writes commit to the right DB path', () => {
    function stubDeps() {
      const calls = { food: [] as unknown[], weight: [] as unknown[], contact: [] as unknown[], finance: [] as unknown[] };
      const deps: CommitDeps = {
        createRoutineBlock: () => {},
        updateRoutineBlockStatus: () => {},
        updateGoalStatus: () => {},
        routineBlockExists: () => true,
        goalExists: () => true,
        createFoodEntry: (d) => { calls.food.push(d); },
        createHealthLog: (d) => { calls.weight.push(d); },
        logContactInteraction: (d) => { calls.contact.push(d); },
        contactExists: (id) => id !== 'gone',
        createFinancialGoal: (d) => { calls.finance.push(d); },
      };
      return { deps, calls };
    }

    it('logFood → createFoodEntry; logWeight → createHealthLog({weight})', async () => {
      const { deps, calls } = stubDeps();
      const r1 = (await commitActions([{ kind: 'logFood', summary: 'x', payload: { date: '2026-06-18', mealType: 'lunch', foodName: 'eggs', quantityG: 100, calories: 150, protein: 12, carbs: 1, fat: 10 } }], deps))[0];
      expect(r1.ok).toBe(true);
      expect(calls.food).toHaveLength(1);
      const r2 = (await commitActions([{ kind: 'logWeight', summary: 'x', payload: { date: '2026-06-18', weightKg: 70 } }], deps))[0];
      expect(r2.ok).toBe(true);
      expect(calls.weight[0]).toEqual({ date: '2026-06-18', weight: 70 });
    });

    it('logContactInteraction commits for a live ref, fails on a stale one', async () => {
      const { deps, calls } = stubDeps();
      const ok = (await commitActions([{ kind: 'logContactInteraction', summary: 'x', payload: { ref: 'c1', type: 'call' } }], deps))[0];
      expect(ok.ok).toBe(true);
      expect(calls.contact[0]).toMatchObject({ contactId: 'c1', type: 'call' });
      const stale = (await commitActions([{ kind: 'logContactInteraction', summary: 'x', payload: { ref: 'gone', type: 'call' } }], deps))[0];
      expect(stale.ok).toBe(false);
      expect(stale.error).toMatch(/no longer exists/i);
    });

    it('setFinancialGoal → createFinancialGoal', async () => {
      const { deps, calls } = stubDeps();
      const r = (await commitActions([{ kind: 'setFinancialGoal', summary: 'x', payload: { title: 'Emergency fund', goalType: 'emergency_fund', targetAmount: 500000 } }], deps))[0];
      expect(r.ok).toBe(true);
      expect(calls.finance[0]).toMatchObject({ title: 'Emergency fund', goalType: 'emergency_fund' });
    });

    it('replanToday / planAhead are navigation intents — commitActions refuses them', async () => {
      const { deps } = stubDeps();
      for (const kind of ['replanToday', 'planAhead'] as const) {
        const [res] = await commitActions([{ kind, summary: 'x', payload: {} }], deps);
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/navigation/i);
      }
    });
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
