import { useState, useCallback, useEffect, useMemo } from 'react';
import { isEnabled as isCompileFlagEnabled } from '@/config/flags';
import { FinanceBreakdownChart } from '@/components/charts/FinanceBreakdownChart';
import { View, ScrollView, StyleSheet, Pressable, Platform, Modal, TextInput } from 'react-native';
import {
  ACTIVE_CURRENCY,
  getCurrency,
  formatMoney,
  formatMoneyCompact,
  parseMoneyInput,
  formatIncomeBracketLabel,
} from '@/utils/currency';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Button3D } from '@/components/ui/Button3D';
import { Body, Label, Caption, Heading } from '@/components/ui/Typography';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { RotatingPlaceholder } from '@/components/ui/RotatingPlaceholder';
import { FinanceGoalCard } from '@/components/modules/finance/FinanceGoalCard';
import { MilestoneTracker } from '@/components/modules/finance/MilestoneTracker';
import { WeeklyInsightCard } from '@/components/modules/finance/WeeklyInsightCard';
import { SubscriptionsBillsCard } from '@/components/modules/finance/SubscriptionsBillsCard';
import { useAI } from '@/hooks/useAI';
import { generateFinancialPlan, getWeeklyFinanceInsight } from '@/ai/functions';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import {
  getFinancialGoals,
  createFinancialGoal,
  createMilestone,
  getMilestonesByGoal,
  completeMilestone,
  deleteMilestonesByGoal,
} from '@/db/queries/finance';
import { buildMockFinancialPlan } from '@/ai/mocks/finance';
import type { FinancialPlan, WeeklyFinanceInsight, TransactionCategory } from '@/ai/types';
import { TRANSACTION_CATEGORIES } from '@/ai/types';
import { useTransactionStore } from '@/finance/store/useTransactionStore';
import { startGmailOAuth } from '@/finance/gmail/oauth';
import {
  isConsumptionSpend,
  totalConsumptionSpend,
  spendByGroup,
  GROUP_META,
} from '@/finance/categoryGroups';
import { CATEGORY_COLORS, formatInr, prettyCategory } from '@/finance/display';
import { runAllDetectors, type Insight } from '@/finance/insights';
import { splitTxByPeriod } from '@/finance/analytics';
import type { TxRecord } from '@/finance/db/transactionDb';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';

const webTextInputOutline = Platform.select({
  web: { outlineStyle: 'none' as const } as object,
  default: {},
});

// Rotating prompts for the empty transaction-search box.
const TXN_SEARCH_PLACEHOLDERS = [
  'Search merchant or category',
  'Try "Swiggy" or "groceries"…',
  'Find a transaction…',
  'Coffee, rent, Amazon…',
];

const GOAL_TYPES = [
  { value: 'home', label: 'Home Down Payment', icon: 'home' },
  { value: 'retirement', label: 'Retirement', icon: 'umbrella' },
  { value: 'emergency_fund', label: 'Emergency Fund', icon: 'shield-checkmark' },
  { value: 'financial_freedom', label: 'Financial Freedom', icon: 'rocket' },
  { value: 'education', label: 'Education', icon: 'school' },
  { value: 'business', label: 'Start a Business', icon: 'storefront' },
] as const;

const INCOME_BRACKETS = getCurrency().incomeBrackets.map((b) => ({
  value: b.value,
  label: formatIncomeBracketLabel(b),
}));

const TARGET_PRESETS = getCurrency().targetPresets;
const SAVINGS_PRESETS = getCurrency().savingsPresets;

const RISK_PROFILES = [
  { value: 'conservative', label: 'Conservative', desc: 'Steady and safe' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced growth' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Maximum growth' },
];

type FinanceTab = 'overview' | 'transactions' | 'goals';
type SetupStep = 'type' | 'details' | 'generating' | null;

type FinanceMilestone = {
  id: string;
  title: string;
  targetAmount: number;
  targetDate: string;
  completedAt: string | null;
};

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function FinanceScreen() {
  useScreenTracking('finance');
  const c = useColors();
  const { call, loading, error } = useAI();
  const { userId } = useUserStore();
  const addXP = useGameStore((s) => s.addXP);
  const styles = makeStyles(c);

  const [tab, setTab] = useState<FinanceTab>('overview');

  // Gmail / transactions
  const {
    transactions,
    gmailConnected,
    lastSyncedAt,
    syncing,
    syncError,
    ingestedCount,
    skippedCount,
    load,
    refreshConnection,
    sync,
    setCategory,
    disconnect,
  } = useTransactionStore();

  // Goals
  const [setupStep, setSetupStep] = useState<SetupStep>(null);
  const [hasGoal, setHasGoal] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [insightText, setInsightText] = useState<WeeklyFinanceInsight | null>(null);
  const [milestones, setMilestones] = useState<FinanceMilestone[]>([]);

  const [selectedType, setSelectedType] = useState('');
  const [targetAmount, setTargetAmount] = useState(String(TARGET_PRESETS[2]));
  const [monthlySavings, setMonthlySavings] = useState(String(SAVINGS_PRESETS[2]));
  const [incomeBracket, setIncomeBracket] = useState(INCOME_BRACKETS[2]?.value ?? '');
  const [riskProfile, setRiskProfile] = useState('moderate');

  // Dismissed insights
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Category edit modal
  const [editTx, setEditTx] = useState<TxRecord | null>(null);

  const awardXp = useCallback(
    (amount: number) => {
      if (userId) addXP(userId, amount);
    },
    [userId, addXP],
  );

  const loadExistingGoal = useCallback(() => {
    const goals = getFinancialGoals();
    if (goals.length > 0) {
      const g = goals[0];
      setHasGoal(true);
      setGoalId(g.id);
      setSelectedType(g.goalType);
      setTargetAmount(String(g.targetAmount ?? TARGET_PRESETS[2]));
      setMonthlySavings(String(g.monthlySavings ?? SAVINGS_PRESETS[2]));
      let ms: FinanceMilestone[] = getMilestonesByGoal(g.id).map((m) => ({
        id: m.id,
        title: m.title,
        targetAmount: m.targetAmount,
        targetDate: m.targetDate,
        completedAt: m.completedAt ?? null,
      }));

      // Migration: earlier versions persisted milestones from a static mock
      // that didn't scale to the user's target — some overshot the goal and
      // some had '$' in their titles. Rebuild them deterministically.
      const overshoot = (g.targetAmount ?? 0) > 0 && ms.some((m) => m.targetAmount > (g.targetAmount ?? 0));
      const staleCurrency = ms.some((m) => m.title.includes('$'));
      if (overshoot || staleCurrency) {
        deleteMilestonesByGoal(g.id);
        const fresh = buildMockFinancialPlan({
          goalType: g.goalType,
          targetAmount: g.targetAmount ?? TARGET_PRESETS[2],
          targetDate: g.targetDate ?? '2028-06-01',
          monthlySavings: g.monthlySavings ?? SAVINGS_PRESETS[2],
          incomeBracket: g.incomeBracket ?? '',
          riskProfile: g.riskProfile ?? 'moderate',
          currency: ACTIVE_CURRENCY,
        });
        const rebuilt: typeof milestones = [];
        for (const m of fresh.milestones) {
          const mId = createMilestone(g.id, m.title, m.targetAmount, m.targetDate);
          rebuilt.push({ id: mId, title: m.title, targetAmount: m.targetAmount, targetDate: m.targetDate, completedAt: null });
        }
        ms = rebuilt;
      }
      setMilestones(ms);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExistingGoal();
      load();
      refreshConnection();
    }, [loadExistingGoal, load, refreshConnection]),
  );

  // Insights — memoised from current transactions + active plan
  const insights: Insight[] = useMemo(() => {
    const savingsPlan = hasGoal && Number(monthlySavings) > 0
      ? { monthlyTarget: Number(monthlySavings) }
      : null;
    return runAllDetectors(transactions, savingsPlan).filter((i) => !dismissed.has(i.id));
  }, [transactions, hasGoal, monthlySavings, dismissed]);

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  // ─── Gmail handlers ────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (!clientId) {
      alert('EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured.');
      return;
    }
    await startGmailOAuth(clientId);
  };

  const handleSync = async () => {
    if (!clientId) return;
    const wasConnected = gmailConnected;
    const inserted = await sync(clientId);
    if (inserted > 0) {
      awardXp(wasConnected ? 25 : 75); // first connect gets 50 + first sync 25
    }
  };

  const handleDismissInsight = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    awardXp(3);
  };

  const handleSetCategory = async (tx: TxRecord, category: TransactionCategory) => {
    await setCategory(tx.id, category);
    setEditTx(null);
    awardXp(5);
  };

  // ─── Plan generation ───────────────────────────────────────────────────────

  const handleGeneratePlan = async () => {
    setSetupStep('generating');
    const result = await call(() =>
      generateFinancialPlan({
        goalType: selectedType,
        targetAmount: Number(targetAmount),
        targetDate: '2028-06-01',
        monthlySavings: Number(monthlySavings),
        incomeBracket,
        riskProfile,
        currency: ACTIVE_CURRENCY,
      }),
    );

    if (result) {
      setPlan(result);
      const id = createFinancialGoal({
        title: GOAL_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType,
        goalType: selectedType,
        targetAmount: Number(targetAmount),
        monthlySavings: Number(monthlySavings),
        incomeBracket,
        riskProfile,
        targetDate: '2028-06-01',
      });
      setGoalId(id);

      const createdMilestones: typeof milestones = [];
      for (const m of result.milestones) {
        const mId = createMilestone(id, m.title, m.targetAmount, m.targetDate);
        createdMilestones.push({
          id: mId,
          title: m.title,
          targetAmount: m.targetAmount,
          targetDate: m.targetDate,
          completedAt: null,
        });
      }
      setMilestones(createdMilestones);
      setHasGoal(true);
      setSetupStep(null);
    } else {
      setSetupStep('details');
    }
  };

  const handleCompleteMilestone = (id: string) => {
    completeMilestone(id);
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completedAt: new Date().toISOString() } : m)),
    );
    awardXp(100);
  };

  const handleGetInsight = async () => {
    const completedAmount = milestones.filter((m) => m.completedAt).reduce((sum, m) => sum + m.targetAmount, 0);
    const result = await call(() =>
      getWeeklyFinanceInsight({
        goalTitle: GOAL_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType,
        targetAmount: Number(targetAmount),
        currentSaved: completedAmount,
        monthlySavings: Number(monthlySavings),
        monthsRemaining: 24,
      }),
    );
    if (result) setInsightText(result);
  };

  // ─── Setup flow (unchanged) ────────────────────────────────────────────────

  if (!hasGoal && setupStep !== null) {
    if (setupStep === 'type') {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
            <ModuleHeader title="Finance" domain="finance" color={c.finance} />
            <Heading style={styles.setupTitle}>What are you saving for?</Heading>
            <View style={styles.typeGrid}>
              {GOAL_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[styles.typeCard, selectedType === t.value && styles.typeCardSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedType(t.value);
                  }}
                >
                  <Ionicons
                    name={t.icon as keyof typeof Ionicons.glyphMap}
                    size={28}
                    color={selectedType === t.value ? c.finance : c.textSecondary}
                  />
                  <Caption style={selectedType === t.value ? styles.typeTextSelected : undefined}>
                    {t.label}
                  </Caption>
                </Pressable>
              ))}
            </View>
            {selectedType !== '' && (
              <Button3D title="Continue" onPress={() => setSetupStep('details')} style={styles.continueBtn} fullWidth />
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

    if (setupStep === 'details') {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
            <ModuleHeader title="Finance" domain="finance" color={c.finance} />
            <Heading style={styles.setupTitle}>Your financial details</Heading>

            <Label>Target amount ({getCurrency().symbol})</Label>
            <View style={styles.amountInputRow}>
              <Body style={styles.amountPrefix}>{getCurrency().symbol}</Body>
              <TextInput
                style={styles.amountInput}
                value={targetAmount === '0' ? '' : targetAmount}
                onChangeText={(t) => setTargetAmount(String(parseMoneyInput(t)))}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor={c.textMuted}
              />
              <Caption style={styles.amountHint}>
                {Number(targetAmount) > 0 ? formatMoneyCompact(Number(targetAmount)) : ''}
              </Caption>
            </View>
            <View style={styles.inputRow}>
              {TARGET_PRESETS.map((v) => (
                <Pressable
                  key={v}
                  style={[styles.chip, Number(targetAmount) === v && styles.chipSelected]}
                  onPress={() => setTargetAmount(String(v))}
                >
                  <Caption style={Number(targetAmount) === v ? styles.chipTextSelected : undefined}>
                    {formatMoneyCompact(v)}
                  </Caption>
                </Pressable>
              ))}
            </View>

            <Label style={styles.labelSpaced}>Monthly savings ({getCurrency().symbol})</Label>
            <View style={styles.amountInputRow}>
              <Body style={styles.amountPrefix}>{getCurrency().symbol}</Body>
              <TextInput
                style={styles.amountInput}
                value={monthlySavings === '0' ? '' : monthlySavings}
                onChangeText={(t) => setMonthlySavings(String(parseMoneyInput(t)))}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor={c.textMuted}
              />
              <Caption style={styles.amountHint}>
                {Number(monthlySavings) > 0 ? formatMoneyCompact(Number(monthlySavings)) : ''}
              </Caption>
            </View>
            <View style={styles.inputRow}>
              {SAVINGS_PRESETS.map((v) => (
                <Pressable
                  key={v}
                  style={[styles.chip, Number(monthlySavings) === v && styles.chipSelected]}
                  onPress={() => setMonthlySavings(String(v))}
                >
                  <Caption style={Number(monthlySavings) === v ? styles.chipTextSelected : undefined}>
                    {formatMoneyCompact(v)}
                  </Caption>
                </Pressable>
              ))}
            </View>

            <Label style={styles.labelSpaced}>Income bracket</Label>
            <View style={styles.inputRow}>
              {INCOME_BRACKETS.map((b) => (
                <Pressable
                  key={b.value}
                  style={[styles.chip, incomeBracket === b.value && styles.chipSelected]}
                  onPress={() => setIncomeBracket(b.value)}
                >
                  <Caption style={incomeBracket === b.value ? styles.chipTextSelected : undefined}>
                    {b.label}
                  </Caption>
                </Pressable>
              ))}
            </View>

            <Label style={styles.labelSpaced}>Risk profile</Label>
            <View style={styles.riskRow}>
              {RISK_PROFILES.map((r) => (
                <Pressable
                  key={r.value}
                  style={[styles.riskCard, riskProfile === r.value && styles.riskCardSelected]}
                  onPress={() => setRiskProfile(r.value)}
                >
                  <Body style={riskProfile === r.value ? styles.riskLabelSelected : styles.riskLabel}>
                    {r.label}
                  </Body>
                  <Caption>{r.desc}</Caption>
                </Pressable>
              ))}
            </View>

            {error && (
              <Body style={styles.planError}>
                {error} — please try again.
              </Body>
            )}
            <Button3D title="Generate my plan" onPress={handleGeneratePlan} style={styles.continueBtn} fullWidth />
          </ScrollView>
        </SafeAreaView>
      );
    }

    if (setupStep === 'generating') {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <LoadingDots />
            <Body style={styles.loadingText}>Building your financial plan...</Body>
          </View>
        </SafeAreaView>
      );
    }
  }

  // ─── Main screen ───────────────────────────────────────────────────────────

  const completedAmount = milestones
    .filter((m) => m.completedAt)
    .reduce((sum, m) => sum + m.targetAmount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <InkCanvas />
      <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <ModuleHeader title="Finance" domain="finance" color={c.finance} />

        {/* Tab switcher */}
        <View style={styles.tabBar}>
          {(['overview', 'transactions', 'goals'] as FinanceTab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tabPill, tab === t && styles.tabPillActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTab(t);
              }}
            >
              <Label style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'overview' ? 'Overview' : t === 'transactions' ? 'Transactions' : 'Goals'}
              </Label>
            </Pressable>
          ))}
        </View>

        {tab === 'overview' && (
          <OverviewTab
            c={c}
            styles={styles}
            transactions={transactions}
            insights={insights}
            gmailConnected={gmailConnected}
            lastSyncedAt={lastSyncedAt}
            syncing={syncing}
            syncError={syncError}
            ingestedCount={ingestedCount}
            skippedCount={skippedCount}
            clientId={clientId}
            onConnect={handleConnect}
            onSync={handleSync}
            onDismissInsight={handleDismissInsight}
            onDisconnect={disconnect}
          />
        )}

        {tab === 'transactions' && (
          <TransactionsTab
            c={c}
            styles={styles}
            transactions={transactions}
            gmailConnected={gmailConnected}
            onConnect={handleConnect}
            onEditTx={setEditTx}
          />
        )}

        {tab === 'goals' && (
          <GoalsTab
            c={c}
            styles={styles}
            hasGoal={hasGoal}
            setupStart={() => setSetupStep('type')}
            selectedType={selectedType}
            targetAmount={Number(targetAmount)}
            completedAmount={completedAmount}
            monthlySavings={Number(monthlySavings)}
            plan={plan}
            milestones={milestones}
            onCompleteMilestone={handleCompleteMilestone}
            insightText={insightText}
            onGetInsight={handleGetInsight}
            loadingInsight={loading}
            transactions={transactions}
          />
        )}
      </ScrollView>

      {/* Category edit modal */}
      <CategoryPickerModal
        tx={editTx}
        c={c}
        onClose={() => setEditTx(null)}
        onPick={(cat) => editTx && handleSetCategory(editTx, cat)}
      />
      </SafeAreaView>
    </View>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  c,
  styles,
  transactions,
  insights,
  gmailConnected,
  lastSyncedAt,
  syncing,
  syncError,
  ingestedCount,
  skippedCount,
  clientId,
  onConnect,
  onSync,
  onDismissInsight,
  onDisconnect,
}: {
  c: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
  transactions: TxRecord[];
  insights: Insight[];
  gmailConnected: boolean;
  lastSyncedAt: string | null;
  syncing: boolean;
  syncError: string | null;
  ingestedCount: number;
  skippedCount: number;
  clientId?: string;
  onConnect: () => void;
  onSync: () => void;
  onDismissInsight: (id: string) => void;
  onDisconnect: () => void;
}) {
  const router = useRouter();
  const now = new Date();
  // Like-for-like comparison: month-to-date vs the SAME elapsed day-range last
  // month (not the full previous month) — otherwise an in-progress month always
  // looks like a spend collapse. The boundary/TZ handling lives in splitTxByPeriod.
  const { thisMonth: thisMonthTx, lastPeriod: lastMonthTx } = splitTxByPeriod(transactions, now);

  const asMinimal = (t: TxRecord) => ({
    amount: t.amount,
    direction: t.direction,
    category: t.category as TransactionCategory,
  });

  // "Spend" = consumption only (self-transfers, investments and loan/card
  // repayments are excluded so they don't inflate the headline).
  const thisMonthSpend = totalConsumptionSpend(thisMonthTx.map(asMinimal));
  const lastMonthSpend = totalConsumptionSpend(lastMonthTx.map(asMinimal));
  const delta = lastMonthSpend > 0 ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 : 0;

  // Cashflow this month: income in vs consumption out → net.
  const thisMonthIncome = thisMonthTx
    .filter((t) => t.direction === 'credit')
    .reduce((s, t) => s + t.amount, 0);
  const netCashflow = thisMonthIncome - thisMonthSpend;

  // Top 5 consumption categories this month.
  const thisMonthDebits = thisMonthTx.filter((t) => isConsumptionSpend(t.category as TransactionCategory, t.direction));
  const byCategory = new Map<string, number>();
  for (const t of thisMonthDebits) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }
  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Group breakdown (Essentials / Lifestyle / …) for the spending-mix bar.
  const groupRows = spendByGroup(thisMonthTx.map(asMinimal));

  if (Platform.OS !== 'web') {
    return (
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card style={styles.connectCard}>
          <Ionicons name="information-circle-outline" size={28} color={c.textSecondary} />
          <Body style={styles.connectTitle}>Web-only feature</Body>
          <Caption style={styles.connectBody}>
            Gmail-powered transaction sync is currently available on the web build. Open the app at localhost:8081 to connect your inbox.
          </Caption>
        </Card>
      </Animated.View>
    );
  }

  if (!gmailConnected) {
    return (
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card style={styles.connectCard}>
          <View style={[styles.connectIcon, { backgroundColor: c.finance + '20' }]}>
            <Ionicons name="mail-outline" size={28} color={c.finance} />
          </View>
          <Body style={styles.connectTitle}>Connect your inbox</Body>
          <Caption style={styles.connectBody}>
            LifeOS reads HDFC, ICICI, and Axis bank alert emails to categorise spending and surface behavioural insights. Only transaction emails are scanned — nothing is uploaded.
          </Caption>
          <Button3D title="Connect Gmail" onPress={onConnect} style={styles.connectBtn} fullWidth />
        </Card>
      </Animated.View>
    );
  }

  return (
    <>
      {/* Sync status */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <Card style={styles.syncCard}>
          <View style={styles.syncRow}>
            <View style={{ flex: 1 }}>
              <Label color={c.finance}>GMAIL CONNECTED</Label>
              <Caption style={{ color: c.textMuted }}>
                Last synced {formatRelative(lastSyncedAt)}
                {ingestedCount > 0 && ` — ${ingestedCount} new`}
                {skippedCount > 0 && ` · ${skippedCount} skipped`}
              </Caption>
            </View>
            <Pressable
              onPress={onSync}
              disabled={syncing}
              style={[styles.syncBtn, { borderColor: c.finance }]}
            >
              {syncing ? (
                <LoadingDots />
              ) : (
                <>
                  <Ionicons name="refresh" size={14} color={c.finance} />
                  <Caption style={{ color: c.finance, fontWeight: '700' }}>Sync now</Caption>
                </>
              )}
            </Pressable>
          </View>
          {syncError && (
            <Caption style={{ color: c.error, marginTop: spacing.xs }}>{syncError}</Caption>
          )}
          <Pressable onPress={onDisconnect} hitSlop={6}>
            <Caption style={{ color: c.textMuted, marginTop: spacing.xs }}>Disconnect Gmail</Caption>
          </Pressable>
        </Card>
      </Animated.View>

      {/* Spend summary */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Card style={styles.spendCard}>
          <Label color={c.finance}>THIS MONTH SO FAR</Label>
          <Heading style={{ color: c.textPrimary, fontSize: fontSizes.xxxl }}>
            {formatInr(thisMonthSpend)}
          </Heading>
          {lastMonthSpend > 0 && (
            <View style={styles.deltaRow}>
              <Ionicons
                name={delta >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={delta >= 0 ? c.error : c.success}
              />
              <Caption style={{ color: delta >= 0 ? c.error : c.success }}>
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(1)}% vs same period last month ({formatInr(lastMonthSpend)})
              </Caption>
            </View>
          )}

          {/* Cashflow strip: income in vs spend out → net */}
          {thisMonthIncome > 0 && (
            <View style={styles.cashflowRow}>
              <View style={styles.cashflowCell}>
                <Caption style={{ color: c.textMuted }}>In</Caption>
                <Body style={{ color: c.success, fontFamily: fonts.heading }}>{formatInr(thisMonthIncome)}</Body>
              </View>
              <View style={styles.cashflowCell}>
                <Caption style={{ color: c.textMuted }}>Out</Caption>
                <Body style={{ color: c.error, fontFamily: fonts.heading }}>{formatInr(thisMonthSpend)}</Body>
              </View>
              <View style={styles.cashflowCell}>
                <Caption style={{ color: c.textMuted }}>Net</Caption>
                <Body style={{ color: netCashflow >= 0 ? c.success : c.error, fontFamily: fonts.heading }}>
                  {netCashflow >= 0 ? '+' : '−'}{formatInr(Math.abs(netCashflow))}
                </Body>
              </View>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Spending mix by group */}
      {groupRows.length > 0 && thisMonthSpend > 0 && (
        <Animated.View entering={FadeInDown.delay(130).duration(400)}>
          <Card style={styles.catCard}>
            <Label color={c.finance}>SPENDING MIX</Label>
            <View style={styles.groupBar}>
              {groupRows.map((g) => (
                <View
                  key={g.group}
                  style={{
                    width: `${(g.amount / thisMonthSpend) * 100}%`,
                    backgroundColor: GROUP_META[g.group].colorKey,
                    height: '100%',
                  }}
                />
              ))}
            </View>
            <View style={styles.groupLegend}>
              {groupRows.map((g) => (
                <View key={g.group} style={styles.groupLegendItem}>
                  <View style={[styles.catDot, { backgroundColor: GROUP_META[g.group].colorKey }]} />
                  <Caption style={{ color: c.textSecondary }}>
                    {GROUP_META[g.group].label} {Math.round((g.amount / thisMonthSpend) * 100)}%
                  </Caption>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>
      )}

      {/* Top categories — M4 (animatedCharts): donut + legend via
          FinanceBreakdownChart (Skia on native, proportional-bar legend on
          web). Flag off keeps the legacy pressable rows, unchanged. */}
      {topCategories.length > 0 && isCompileFlagEnabled('animatedCharts') && (
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Card style={styles.catCard}>
            <Label color={c.finance}>TOP CATEGORIES</Label>
            <FinanceBreakdownChart
              slices={topCategories.map(([cat, amt]) => ({
                label: prettyCategory(cat as TransactionCategory),
                value: amt,
                color: CATEGORY_COLORS[cat as TransactionCategory] ?? c.textSecondary,
              }))}
              formatValue={(v) => formatInr(v)}
            />
          </Card>
        </Animated.View>
      )}
      {topCategories.length > 0 && !isCompileFlagEnabled('animatedCharts') && (
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Card style={styles.catCard}>
            <Label color={c.finance}>TOP CATEGORIES</Label>
            {topCategories.map(([cat, amt]) => {
              const share = thisMonthSpend > 0 ? amt / thisMonthSpend : 0;
              const col = CATEGORY_COLORS[cat as TransactionCategory] ?? c.textSecondary;
              return (
                <Pressable
                  key={cat}
                  style={styles.catRow}
                  onPress={() => router.push({ pathname: '/finance-category', params: { category: cat } })}
                >
                  <View style={[styles.catDot, { backgroundColor: col }]} />
                  <View style={{ flex: 1 }}>
                    <Body style={styles.catLabel}>{prettyCategory(cat as TransactionCategory)}</Body>
                    <View style={styles.catBarTrack}>
                      <View
                        style={[
                          styles.catBarFill,
                          { width: `${Math.max(share * 100, 4)}%`, backgroundColor: col },
                        ]}
                      />
                    </View>
                  </View>
                  <Caption style={{ color: c.textPrimary, fontWeight: '700' }}>
                    {formatInr(amt)}
                  </Caption>
                  <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
                </Pressable>
              );
            })}
          </Card>
        </Animated.View>
      )}

      {/* Subscriptions & bills audit (Gmail) */}
      <SubscriptionsBillsCard clientId={clientId} />

      {/* Monthly Money Review entry */}
      {transactions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(170).duration(400)}>
          <Pressable onPress={() => router.push('/finance-review')}>
            <Card style={StyleSheet.flatten([styles.reviewCta, { borderColor: c.border }])}>
              <View style={[styles.reviewIcon, { backgroundColor: c.finance + '20' }]}>
                <Ionicons name="sparkles-outline" size={18} color={c.finance} />
              </View>
              <View style={{ flex: 1 }}>
                <Body style={{ color: c.textPrimary, fontFamily: fonts.heading }}>Monthly Money Review</Body>
                <Caption style={{ color: c.textMuted }}>AI breakdown of where your money went</Caption>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Card>
          </Pressable>
        </Animated.View>
      )}

      {/* Insights */}
      {insights.map((ins, i) => (
        <Animated.View key={ins.id} entering={FadeInDown.delay(200 + i * 80).duration(400)}>
          <Card style={StyleSheet.flatten([styles.insightCard, { borderLeftWidth: 4, borderLeftColor: severityColor(ins.severity, c) }])}>
            <View style={styles.insightHeader}>
              <Ionicons
                name={severityIcon(ins.severity)}
                size={18}
                color={severityColor(ins.severity, c)}
              />
              <Label style={{ color: severityColor(ins.severity, c), flex: 1 }}>{ins.title}</Label>
              <Pressable onPress={() => onDismissInsight(ins.id)} hitSlop={10}>
                <Ionicons name="close" size={16} color={c.textMuted} />
              </Pressable>
            </View>
            <Caption style={{ color: c.textSecondary, lineHeight: 20 }}>{ins.body}</Caption>
          </Card>
        </Animated.View>
      ))}

      {transactions.length === 0 && (
        <Caption style={{ color: c.textMuted, textAlign: 'center', paddingTop: spacing.lg }}>
          No transactions yet. Tap Sync now after connecting an inbox with bank alert emails.
        </Caption>
      )}
    </>
  );
}

// ─── Transactions tab ─────────────────────────────────────────────────────────

type TxFilter = 'all' | 'debit' | 'credit';

function TransactionsTab({
  c,
  styles,
  transactions,
  gmailConnected,
  onConnect,
  onEditTx,
}: {
  c: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
  transactions: TxRecord[];
  gmailConnected: boolean;
  onConnect: () => void;
  onEditTx: (tx: TxRecord) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<TxFilter>('all');
  const [query, setQuery] = useState('');

  if (!gmailConnected && transactions.length === 0) {
    return (
      <Card style={styles.connectCard}>
        <Ionicons name="receipt-outline" size={28} color={c.textSecondary} />
        <Body style={styles.connectTitle}>No transactions yet</Body>
        <Caption style={styles.connectBody}>
          Connect Gmail on the Overview tab to start ingesting bank alert emails.
        </Caption>
        {Platform.OS === 'web' && (
          <Button3D title="Connect Gmail" onPress={onConnect} style={styles.connectBtn} fullWidth />
        )}
      </Card>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = transactions.filter(
    (t) =>
      (filter === 'all' || t.direction === filter) &&
      (q === '' ||
        t.merchant.toLowerCase().includes(q) ||
        prettyCategory(t.category as TransactionCategory).toLowerCase().includes(q)),
  );

  // Group by date
  const groups = new Map<string, TxRecord[]>();
  for (const t of filtered) {
    const list = groups.get(t.date) ?? [];
    list.push(t);
    groups.set(t.date, list);
  }
  const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <View style={[styles.searchRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.textMuted} />
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
          />
          <RotatingPlaceholder
            phrases={TXN_SEARCH_PLACEHOLDERS}
            active={!query}
            color={c.textMuted}
            style={styles.searchHint}
          />
        </View>
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        {(['all', 'debit', 'credit'] as TxFilter[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Caption style={filter === f ? styles.filterTextActive : undefined}>
              {f === 'all' ? 'All' : f === 'debit' ? 'Spend' : 'Income'}
            </Caption>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <Caption style={{ color: c.textMuted, textAlign: 'center', paddingTop: spacing.lg }}>
          No transactions match this filter.
        </Caption>
      ) : (
        sortedDates.map((date) => (
          <View key={date} style={styles.dateGroup}>
            <Caption style={{ color: c.textMuted, paddingHorizontal: spacing.xs }}>{formatDateHeader(date)}</Caption>
            {groups.get(date)!.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.txRow, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => onEditTx(t)}
              >
                <View
                  style={[
                    styles.txBadge,
                    { backgroundColor: (CATEGORY_COLORS[t.category as TransactionCategory] ?? c.textSecondary) + '22' },
                  ]}
                >
                  <Ionicons
                    name={t.direction === 'debit' ? 'arrow-up' : 'arrow-down'}
                    size={14}
                    color={CATEGORY_COLORS[t.category as TransactionCategory] ?? c.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={styles.txMerchant}>{t.merchant}</Body>
                  <Caption style={{ color: c.textMuted }}>
                    {prettyCategory(t.category as TransactionCategory)} · {t.source.toUpperCase()}
                  </Caption>
                </View>
                <Body
                  style={{
                    color: t.direction === 'debit' ? c.error : c.success,
                    fontFamily: fonts.bodyMedium,
                  }}
                >
                  {t.direction === 'debit' ? '-' : '+'}
                  {formatInr(t.amount)}
                </Body>
              </Pressable>
            ))}
          </View>
        ))
      )}
    </>
  );
}

// ─── Goals tab ────────────────────────────────────────────────────────────────

function GoalsTab({
  c,
  styles,
  hasGoal,
  setupStart,
  selectedType,
  targetAmount,
  completedAmount,
  monthlySavings,
  plan,
  milestones,
  onCompleteMilestone,
  insightText,
  onGetInsight,
  loadingInsight,
  transactions,
}: {
  c: ReturnType<typeof useColors>;
  styles: ReturnType<typeof makeStyles>;
  hasGoal: boolean;
  setupStart: () => void;
  selectedType: string;
  targetAmount: number;
  completedAmount: number;
  monthlySavings: number;
  plan: FinancialPlan | null;
  milestones: FinanceMilestone[];
  onCompleteMilestone: (id: string) => void;
  insightText: WeeklyFinanceInsight | null;
  onGetInsight: () => void;
  loadingInsight: boolean;
  transactions: TxRecord[];
}) {
  // True savings rate from transactions (if available)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const thisMonth = transactions.filter((t) => t.date >= monthStart);
  const credits = thisMonth.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);
  const debits = thisMonth.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount, 0);
  const netPaise = credits - debits;

  if (!hasGoal) {
    return (
      <Animated.View entering={FadeInDown.duration(400)}>
        <EmptyState
          icon="wallet-outline"
          title="Take control of your finances"
          caption="Set a financial goal and get an AI-powered savings plan with milestones, strategies, and weekly insights."
          accent={c.finance}
          cta={{ label: 'Set up my financial goal', onPress: setupStart }}
        />
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View entering={FadeInDown.duration(400)}>
        <FinanceGoalCard
          title={GOAL_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType}
          goalType={selectedType}
          targetAmount={targetAmount}
          currentSaved={completedAmount}
          monthlyTarget={monthlySavings}
          targetDate="2028-06-01"
        />
      </Animated.View>

      {transactions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Card style={styles.rateCard}>
            <Label color={c.finance}>TRUE SAVINGS RATE — THIS MONTH</Label>
            <Heading style={{ color: netPaise >= 0 ? c.success : c.error, fontSize: fontSizes.xxxl }}>
              {netPaise >= 0 ? '+' : '-'}
              {formatInr(Math.abs(netPaise))}
            </Heading>
            <Caption style={{ color: c.textMuted }}>
              From real transactions: {formatInr(credits)} in, {formatInr(debits)} out.
            </Caption>
          </Card>
        </Animated.View>
      )}

      {plan && (
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Card style={styles.strategyCard}>
            <Label color={c.finance}>STRATEGY</Label>
            {plan.strategy.map((s, i) => (
              <View key={i} style={styles.strategyRow}>
                <View style={[styles.strategyDot, { backgroundColor: c.finance }]} />
                <View style={styles.strategyContent}>
                  <Body style={styles.strategyAction}>{s.action}</Body>
                  <Caption>+{formatMoney(s.monthlyImpact)}/mo</Caption>
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {milestones.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <MilestoneTracker milestones={milestones} onComplete={onCompleteMilestone} />
        </Animated.View>
      )}

      {plan && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Card style={styles.tipsCard}>
            <Label color={c.finance}>WEEKLY TIPS</Label>
            {plan.weeklyTips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Ionicons name="bulb-outline" size={16} color={c.finance} />
                <Caption style={styles.tipText}>{tip}</Caption>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {insightText ? (
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <WeeklyInsightCard insight={insightText} />
        </Animated.View>
      ) : (
        <Button
          title="Get weekly insight"
          loadingTitle="Loading…"
          loading={loadingInsight}
          variant="secondary"
          onPress={onGetInsight}
          style={styles.insightButton}
        />
      )}
    </>
  );
}

// ─── Category picker modal ────────────────────────────────────────────────────

function CategoryPickerModal({
  tx,
  c,
  onClose,
  onPick,
}: {
  tx: TxRecord | null;
  c: ReturnType<typeof useColors>;
  onClose: () => void;
  onPick: (cat: TransactionCategory) => void;
}) {
  if (!tx) return null;
  return (
    <Modal visible={!!tx} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[modalStyles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose}>
        <Pressable style={[modalStyles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Label color={c.finance}>RECATEGORISE</Label>
          <Body style={{ color: c.textPrimary, marginVertical: spacing.xs }}>{tx.merchant}</Body>
          <Caption style={{ color: c.textMuted }}>
            Currently: {prettyCategory(tx.category as TransactionCategory)}
          </Caption>
          <ScrollView style={modalStyles.catList} contentContainerStyle={modalStyles.catListContent}>
            {TRANSACTION_CATEGORIES.map((cat) => {
              const isActive = cat === tx.category;
              const col = CATEGORY_COLORS[cat];
              return (
                <Pressable
                  key={cat}
                  style={[
                    modalStyles.catChip,
                    {
                      borderColor: isActive ? col : c.border,
                      backgroundColor: isActive ? col + '22' : c.surface,
                    },
                  ]}
                  onPress={() => onPick(cat)}
                >
                  <View style={[modalStyles.catChipDot, { backgroundColor: col }]} />
                  <Caption style={{ color: isActive ? col : c.textPrimary, fontWeight: '600' }}>
                    {prettyCategory(cat)}
                  </Caption>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(s: Insight['severity'], c: ReturnType<typeof useColors>): string {
  switch (s) {
    case 'alert':
      return c.error;
    case 'warning':
      return c.warning;
    case 'notice':
      return c.finance;
    default:
      return c.primary;
  }
}

function severityIcon(s: Insight['severity']): keyof typeof Ionicons.glyphMap {
  switch (s) {
    case 'alert':
      return 'alert-circle';
    case 'warning':
      return 'warning';
    case 'notice':
      return 'notifications';
    default:
      return 'information-circle';
  }
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400_000);
  if (iso === today.toISOString().slice(0, 10)) return 'Today';
  if (iso === yest.toISOString().slice(0, 10)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    // Tabs
    tabBar: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    tabPill: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: 10,
    },
    tabPillActive: {
      backgroundColor: c.finance + '22',
    },
    tabLabel: {
      color: c.textSecondary,
      fontSize: fontSizes.sm,
    },
    tabLabelActive: {
      color: c.finance,
      fontWeight: '700',
    },
    // Setup
    setupTitle: { fontSize: fontSizes.xxl, marginBottom: spacing.md },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    typeCard: {
      width: '47%',
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
    },
    typeCardSelected: {
      borderColor: c.finance,
      backgroundColor: c.finance + '15',
    },
    typeTextSelected: { color: c.finance },
    continueBtn: { marginTop: spacing.lg },
    inputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
    amountInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
      gap: spacing.sm,
    },
    amountPrefix: { color: c.textSecondary, fontSize: fontSizes.lg },
    amountInput: {
      flex: 1,
      color: c.textPrimary,
      fontFamily: fonts.body,
      fontSize: fontSizes.lg,
      paddingVertical: 0,
      ...webTextInputOutline,
    },
    amountHint: { color: c.textMuted },
    chip: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipSelected: { borderColor: c.finance, backgroundColor: c.finance + '15' },
    chipTextSelected: { color: c.finance },
    labelSpaced: { marginTop: spacing.md },
    riskRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    riskCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: spacing.sm,
      alignItems: 'center',
      gap: 2,
    },
    riskCardSelected: { borderColor: c.finance, backgroundColor: c.finance + '15' },
    riskLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
    riskLabelSelected: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.finance },
    // Empty goals state
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
    emptyIcon: {
      width: 80, height: 80, borderRadius: 40,
      alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { textAlign: 'center' },
    emptyBody: { textAlign: 'center', color: c.textSecondary, paddingHorizontal: spacing.lg },
    setupButton: { marginTop: spacing.sm, width: '100%' },
    // Connect card
    connectCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
    connectIcon: {
      width: 60, height: 60, borderRadius: 30,
      alignItems: 'center', justifyContent: 'center',
    },
    connectTitle: { fontFamily: fonts.heading, fontSize: fontSizes.lg, color: c.textPrimary },
    connectBody: { textAlign: 'center', color: c.textSecondary, paddingHorizontal: spacing.sm },
    connectBtn: { marginTop: spacing.sm, width: '100%' },
    // Sync card
    syncCard: { gap: spacing.xs },
    syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    syncBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 10,
      borderWidth: 1.5,
      minWidth: 110,
      justifyContent: 'center',
    },
    // Spend summary
    spendCard: { gap: spacing.xs },
    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    cashflowRow: {
      flexDirection: 'row',
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    cashflowCell: { flex: 1, gap: 2 },
    groupBar: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      marginTop: spacing.sm,
      backgroundColor: c.border,
    },
    groupLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    groupLegendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    reviewCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    reviewIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    // Categories
    catCard: { gap: spacing.sm },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    catDot: { width: 10, height: 10, borderRadius: 5 },
    catLabel: { fontSize: fontSizes.sm, color: c.textPrimary },
    catBarTrack: {
      height: 6,
      backgroundColor: c.surface,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: 4,
    },
    catBarFill: { height: '100%', borderRadius: 3 },
    // Insight card
    insightCard: { gap: spacing.xs },
    insightHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    // Transactions
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    searchInputWrap: {
      flex: 1,
      justifyContent: 'center',
    },
    searchInput: {
      color: c.textPrimary,
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      padding: 0,
    },
    // Overlay aligned to the search text (row is vertically centered).
    searchHint: {
      left: 0,
      fontSize: fontSizes.md,
    },
    filterRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    filterChipActive: {
      backgroundColor: c.finance + '22',
      borderColor: c.finance,
    },
    filterTextActive: { color: c.finance, fontWeight: '700' },
    dateGroup: { gap: spacing.xs },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: 14,
      borderWidth: 1,
    },
    txBadge: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
    },
    txMerchant: { fontSize: fontSizes.sm, color: c.textPrimary, fontFamily: fonts.bodyMedium },
    // True savings rate
    rateCard: { gap: spacing.xs },
    // Strategy (reused)
    strategyCard: { gap: spacing.sm },
    strategyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    strategyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    strategyContent: { flex: 1 },
    strategyAction: { fontSize: fontSizes.sm },
    tipsCard: { gap: spacing.sm },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    tipText: { flex: 1, color: c.textSecondary },
    insightButton: { marginTop: spacing.sm },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    loadingText: { color: c.textSecondary },
    planError: { color: c.error, textAlign: 'center', marginBottom: spacing.sm },
  });
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '70%',
    gap: spacing.xs,
  },
  catList: {
    marginTop: spacing.sm,
  },
  catListContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  catChipDot: {
    width: 8, height: 8, borderRadius: 4,
  },
});
