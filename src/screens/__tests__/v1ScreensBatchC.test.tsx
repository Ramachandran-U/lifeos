/**
 * W4 batch C V1 tree (Finance, module_hierarchy_v1 ON) — the unit halves of
 * AC5 (the dead caps eyebrows render nowhere on any inner tab), AC8 (no ₹0
 * display: the spend numerals render only when connected AND transactions
 * exist), the §3.0.3 Gmail status row (committed status copy + the press-target
 * sheet holding Disconnect one level in), and AC11 (no streak/XP strings).
 *
 * Mock seams mirror v1ScreensBatchB.test.tsx: useFocusEffect RUNS (the screen
 * loads data on focus), the finance query module is stubbed over the
 * otherwise-real module, and the two Dexie-backed zustand stores
 * (useTransactionStore / useRecurringStore) are replaced with plain zustand
 * fixtures — IndexedDB does not exist in jest. Platform.OS is pinned to 'web'
 * per test (Finance is web-primary; the native branch is covered by the
 * FinanceHero unit suite).
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      useEffect(() => cb(), [cb]);
    },
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('@/hooks/useScreenTracking', () => ({ useScreenTracking: jest.fn() }));

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Stubbed finance queries over the otherwise-real module (no SQLite in jest).
jest.mock('@/db/queries/finance', () => ({
  ...jest.requireActual('@/db/queries/finance'),
  getFinancialGoals: jest.fn(() => []),
  getMilestonesByGoal: jest.fn(() => []),
}));

// Dexie-backed stores → plain zustand fixtures (IndexedDB is absent in jest).
jest.mock('@/finance/store/useTransactionStore', () => {
  const { create } = require('zustand');
  return {
    useTransactionStore: create(() => ({
      transactions: [],
      gmailConnected: false,
      lastSyncedAt: null,
      syncing: false,
      syncError: null,
      ingestedCount: 0,
      skippedCount: 0,
      load: async () => {},
      refreshConnection: () => {},
      sync: async () => 0,
      setCategory: async () => {},
      disconnect: async () => {},
    })),
  };
});

jest.mock('@/finance/store/useRecurringStore', () => {
  const { create } = require('zustand');
  return {
    useRecurringStore: create(() => ({
      items: [],
      syncing: false,
      syncError: null,
      load: async () => {},
      refreshConnection: () => {},
      sync: async () => 0,
      dismiss: async () => {},
    })),
  };
});

import { Platform } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import FinanceScreen from '../../../app/(tabs)/finance';
import { useFlagStore } from '@/store/useFlagStore';
import { useUserStore } from '@/store/useUserStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useTransactionStore } from '@/finance/store/useTransactionStore';
import { getFinancialGoals, getMilestonesByGoal } from '@/db/queries/finance';
import type { TxRecord } from '@/finance/db/transactionDb';

const goalsMock = getFinancialGoals as jest.Mock;
const milestonesMock = getMilestonesByGoal as jest.Mock;

const today = new Date().toISOString().slice(0, 10);

function tx(over: Partial<TxRecord>): TxRecord {
  return {
    id: 'tx1',
    date: today,
    amount: 123_400, // ₹1,234
    direction: 'debit',
    merchant: 'Fresh Mart Test',
    category: 'groceries',
    source: 'hdfc',
    rawEmailId: 'tx1',
    confidence: 1,
    userCorrected: false,
    ...over,
  };
}

// One debit (groceries ₹1,234) + one credit (income ₹5,000), both today.
const SEEDED_TX: TxRecord[] = [
  tx({ id: 'tx1', rawEmailId: 'tx1' }),
  tx({ id: 'tx2', rawEmailId: 'tx2', direction: 'credit', amount: 500_000, merchant: 'Acme Payroll Test', category: 'income' }),
];

// The §5.5 strings the Finance tabs used to shout.
const FINANCE_BANNED = [
  'GMAIL CONNECTED',
  'THIS MONTH SO FAR',
  'SPENDING MIX',
  'TOP CATEGORIES',
  'TRUE SAVINGS RATE',
  'STRATEGY',
  'WEEKLY TIPS',
  'SUBSCRIPTIONS & BILLS',
  'MILESTONES',
  'WEEKLY INSIGHT',
] as const;

/** Collect every rendered text string from the test-renderer JSON tree. */
function renderedText(): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(screen.toJSON());
  return out.join('\n');
}

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'web';
  goalsMock.mockReturnValue([]);
  milestonesMock.mockReturnValue([]);
  useTransactionStore.setState({
    transactions: [],
    gmailConnected: false,
    lastSyncedAt: null,
    syncing: false,
    syncError: null,
    ingestedCount: 0,
    skippedCount: 0,
  });
  useFlagStore.setState((s) => ({ flags: { ...s.flags, module_hierarchy_v1: true } }));
  useUserStore.setState({ userId: 'u1' });
  usePreferencesStore.setState({ gamification: 'full', theme: 'dark' });
});

afterEach(() => {
  useFlagStore.setState((s) => ({ flags: { ...s.flags, module_hierarchy_v1: false } }));
  useUserStore.setState({ userId: null });
});

describe('Finance V1 — disconnected Overview (§3.5 keeper)', () => {
  it('hero slot leads with the EmptyState keeper; no spend numerals; no sync row', () => {
    render(<FinanceScreen />);
    expect(screen.getByTestId('finance-hero')).toBeTruthy();
    expect(screen.getByText('Connect your inbox')).toBeTruthy();
    expect(screen.getByText('Connect Gmail')).toBeTruthy();
    expect(
      screen.getByText('Only transaction emails are scanned — nothing is uploaded.'),
    ).toBeTruthy();
    // AC8: the spend hero renders ONLY when connected — no ₹ anywhere.
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText('spent so far this month')).toBeNull();
    expect(screen.queryByText('Sync now')).toBeNull();
    expect(screen.queryByTestId('connect-row-gmail')).toBeNull();
  });
});

describe('Finance V1 — connected Overview (§3.5 / §3.0.3)', () => {
  it('zero transactions: first-value line in the hero, no ₹0, Gmail status row present', () => {
    useTransactionStore.setState({ gmailConnected: true });
    render(<FinanceScreen />);
    expect(screen.getByTestId('finance-hero')).toBeTruthy();
    expect(
      screen.getByText(
        'No transactions yet. Tap Sync now after connecting an inbox with bank alert emails.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/₹/)).toBeNull();
    // §3.0.3 committed copy: status + action; skipped suffix only when > 0.
    expect(screen.getByTestId('connect-row-gmail')).toBeTruthy();
    expect(screen.getByText('Connections')).toBeTruthy();
    expect(screen.getByText('Sync now')).toBeTruthy();
    expect(screen.getByText('Synced never · 0 new')).toBeTruthy();
  });

  it('appends the skipped suffix only when skippedCount > 0', () => {
    useTransactionStore.setState({
      gmailConnected: true,
      ingestedCount: 14,
      skippedCount: 3,
      lastSyncedAt: new Date().toISOString(),
    });
    render(<FinanceScreen />);
    expect(screen.getByText('Synced just now · 14 new · 3 skipped')).toBeTruthy();
  });

  it('with transactions: spend headline + Where it went; the caps eyebrows render nowhere', () => {
    useTransactionStore.setState({ gmailConnected: true, transactions: SEEDED_TX });
    render(<FinanceScreen />);
    // The hero numerals (display ₹ + h3) — the answer leads.
    expect(screen.getAllByText('₹1,234').length).toBeGreaterThan(0);
    expect(screen.getByText('spent so far this month')).toBeTruthy();
    expect(screen.getByText('Where it went')).toBeTruthy();
    const text = renderedText();
    for (const banned of FINANCE_BANNED) {
      expect(text).not.toContain(banned);
    }
  });

  it('the Gmail row press target opens the sheet holding Sync now + Disconnect Gmail', () => {
    useTransactionStore.setState({ gmailConnected: true });
    render(<FinanceScreen />);
    // Disconnect never renders on the row (§3.0.3 — one level in).
    expect(screen.queryByText('Disconnect Gmail')).toBeNull();
    fireEvent.press(screen.getByTestId('connect-row-gmail'));
    expect(screen.getByText('Disconnect Gmail')).toBeTruthy();
    // Sync now appears twice while open: the row action + the sheet row.
    expect(screen.getAllByText('Sync now').length).toBeGreaterThanOrEqual(2);
  });
});

describe('Finance V1 — Goals tab swaps (§3.5)', () => {
  it('empty goals state keeps the EmptyState CTA', () => {
    render(<FinanceScreen />);
    fireEvent.press(screen.getByText('Goals'));
    expect(screen.getByText('Take control of your finances')).toBeTruthy();
    expect(screen.getByText('Set up my financial goal')).toBeTruthy();
  });

  it('populated goals: sentence-case sections, display savings numeral, zero caps', () => {
    goalsMock.mockReturnValue([
      {
        id: 'g1',
        title: 'Emergency Fund',
        goalType: 'emergency_fund',
        targetAmount: 500000,
        monthlySavings: 20000,
        incomeBracket: '',
        riskProfile: 'moderate',
        targetDate: '2028-06-01',
      },
    ]);
    milestonesMock.mockReturnValue([
      { id: 'm1', title: 'First quarter saved', targetAmount: 125000, targetDate: '2027-06-01', completedAt: null },
    ]);
    useTransactionStore.setState({ gmailConnected: true, transactions: SEEDED_TX });
    render(<FinanceScreen />);
    fireEvent.press(screen.getByText('Goals'));

    // §3.5: TRUE SAVINGS RATE → SectionTitle + display numeral.
    expect(screen.getByText('True savings rate')).toBeTruthy();
    // Net = ₹5,000 in − ₹1,234 out = +₹3,766.
    expect(screen.getByText('+₹3,766')).toBeTruthy();
    // §3.0.7 swaps inside the child cards.
    expect(screen.getByText('Milestones')).toBeTruthy();
    const text = renderedText();
    for (const banned of FINANCE_BANNED) {
      expect(text).not.toContain(banned);
    }
    expect(text).not.toContain('YOUR GOAL');
  });
});

describe('AC11 (unit half) — no streak/XP strings in the Finance V1 tree', () => {
  for (const gamification of ['full', 'off'] as const) {
    it(`overview carries no streak/XP copy (gamification: ${gamification})`, () => {
      usePreferencesStore.setState({ gamification });
      useTransactionStore.setState({ gmailConnected: true, transactions: SEEDED_TX });
      render(<FinanceScreen />);
      const text = renderedText();
      expect(text).not.toMatch(/streak/i);
      expect(text).not.toMatch(/xp/i);
    });
  }
});
