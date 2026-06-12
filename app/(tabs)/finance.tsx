import { useState, useCallback, useMemo } from 'react';
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
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { MOTION_BUDGET, useMotionScale, useStaggerDelay } from '@/theme/motion';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Button3D } from '@/components/ui/Button3D';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { Text } from '@/components/ui/Text';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ConnectRow } from '@/components/ui/ConnectRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { RotatingPlaceholder } from '@/components/ui/RotatingPlaceholder';
import { FinanceHero } from '@/components/modules/finance/FinanceHero';
import { FinanceGoalCard } from '@/components/modules/finance/FinanceGoalCard';
import { MilestoneTracker } from '@/components/modules/finance/MilestoneTracker';
import { WeeklyInsightCard } from '@/components/modules/finance/WeeklyInsightCard';
import { SubscriptionsBillsCard } from '@/components/modules/finance/SubscriptionsBillsCard';
import { FinanceScreenLegacy } from '@/screens/legacy/FinanceScreen.legacy';
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
import { useFlagStore } from '@/store/useFlagStore';

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

// Ink + Signal §3.0.1: the route branches exactly once on module_hierarchy_v1.
// Flag off → the byte-identical legacy tree; flag on → the recomposed
// hero-first tree below. The legacy file is deleted (not edited) when the flag
// graduates — see docs/PARKED_ITEMS.md §13.
export default function FinanceScreen() {
  const hierarchyV1 = useFlagStore((s) => s.isEnabled('module_hierarchy_v1'));
  if (!hierarchyV1) return <FinanceScreenLegacy />;
  return <FinanceScreenV1 />;
}

// §3.5 — the answer on Finance is the month's number, not sync plumbing. The
// hero (FinanceHero) sits directly under the kept inner tab bar; the Gmail
// status collapses to a ConnectRow under a `Connections` SectionTitle LAST.
function FinanceScreenV1() {
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

  // Gmail press-target sheet (§3.0.3: Disconnect lives one level in).
  const [gmailSheetOpen, setGmailSheetOpen] = useState(false);

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

  // ─── Setup flow (kept — Goals tab on-ramp) ─────────────────────────────────

  if (!hasGoal && setupStep !== null) {
    if (setupStep === 'type') {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
            <ModuleHeader title="Finance" domain="finance" color={c.finance} />
            <View style={styles.scrollInner}>
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
              <Button3D title="Continue" tone="finance" onPress={() => setSetupStep('details')} style={styles.continueBtn} fullWidth />
            )}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    if (setupStep === 'details') {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
            <ModuleHeader title="Finance" domain="finance" color={c.finance} />
            <View style={styles.scrollInner}>
            <Heading style={styles.setupTitle}>Your financial details</Heading>

            <Body style={styles.fieldLabel}>Target amount ({getCurrency().symbol})</Body>
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

            <Body style={[styles.fieldLabel, styles.labelSpaced]}>Monthly savings ({getCurrency().symbol})</Body>
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

            <Body style={[styles.fieldLabel, styles.labelSpaced]}>Income bracket</Body>
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

            <Body style={[styles.fieldLabel, styles.labelSpaced]}>Risk profile</Body>
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
            <Button3D title="Generate my plan" tone="finance" onPress={handleGeneratePlan} style={styles.continueBtn} fullWidth />
            </View>
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
        {/* R1 block — full-bleed, outside the padded inner container. */}
        <ModuleHeader title="Finance" domain="finance" color={c.finance} />
        <View style={styles.scrollInner}>

        {/* Tab switcher — kept as-is (§3.5); labels carry the same face the
            legacy Label gave them, set via Body (no Label in route files). */}
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
              <Body style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'overview' ? 'Overview' : t === 'transactions' ? 'Transactions' : 'Goals'}
              </Body>
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
            onOpenGmailSheet={() => setGmailSheetOpen(true)}
            onDismissInsight={handleDismissInsight}
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
        </View>
      </ScrollView>

      {/* Category edit modal */}
      <CategoryPickerModal
        tx={editTx}
        c={c}
        onClose={() => setEditTx(null)}
        onPick={(cat) => editTx && handleSetCategory(editTx, cat)}
      />

      {/* Gmail row press target (§3.0.3): Sync now + Disconnect live one level
          in — the row itself never carries a destructive action. */}
      <GmailActionsSheet
        visible={gmailSheetOpen}
        c={c}
        syncing={syncing}
        onSync={() => {
          setGmailSheetOpen(false);
          void handleSync();
        }}
        onDisconnect={() => {
          setGmailSheetOpen(false);
          void disconnect();
        }}
        onClose={() => setGmailSheetOpen(false)}
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
  onOpenGmailSheet,
  onDismissInsight,
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
  onOpenGmailSheet: () => void;
  onDismissInsight: (id: string) => void;
}) {
  const router = useRouter();

  // §3.0.6 motion contract: one hero-budget entry, tight stagger on the
  // supporting cast, all durations scaled so reduce-motion lands in one frame.
  const motionScale = useMotionScale();
  const stagger = useStaggerDelay();
  const scaled = (base: number) => (motionScale === 0 ? 0 : base / motionScale);

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

  // Cashflow this month: income in vs consumption out → net.
  const thisMonthIncome = thisMonthTx
    .filter((t) => t.direction === 'credit')
    .reduce((s, t) => s + t.amount, 0);

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

  const connected = Platform.OS === 'web' && gmailConnected;
  const statusLine =
    `Synced ${formatRelative(lastSyncedAt)} · ${ingestedCount} new` +
    (skippedCount > 0 ? ` · ${skippedCount} skipped` : '');

  return (
    <>
      {/* THE hero slot — always mounted, position 1 under the tab bar (§3.5/AC1). */}
      <Animated.View
        key={connected ? 'connected' : 'disconnected'}
        testID="finance-hero"
        entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}
      >
        <FinanceHero
          gmailConnected={gmailConnected}
          txCount={transactions.length}
          thisMonthSpendPaise={thisMonthSpend}
          lastMonthSpendPaise={lastMonthSpend}
          thisMonthIncomePaise={thisMonthIncome}
          onConnect={onConnect}
        />
      </Animated.View>

      {/* ─── Supporting cast — connected only (§3.5 items 2–7) ─── */}
      {connected && (
        <>
          {/* Where it went: spending mix + top categories, one plain section. */}
          {thisMonthSpend > 0 && (groupRows.length > 0 || topCategories.length > 0) && (
            <Animated.View
              entering={FadeIn.delay(stagger(0, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <SectionTitle>Where it went</SectionTitle>

              {groupRows.length > 0 && (
                <>
                  {/* R3: solid hues over c.track — no gradients, no Card. */}
                  <View style={[styles.groupBar, { backgroundColor: c.track }]}>
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
                </>
              )}

              {/* Top categories — M4 (animatedCharts): donut + legend via
                  FinanceBreakdownChart (Skia on native, proportional-bar legend
                  on web). Flag off keeps the pressable rows with their
                  press-through to /finance-category. CAPS header deleted. */}
              {topCategories.length > 0 && isCompileFlagEnabled('animatedCharts') && (
                <View style={styles.topCategories}>
                  <FinanceBreakdownChart
                    slices={topCategories.map(([cat, amt]) => ({
                      label: prettyCategory(cat as TransactionCategory),
                      value: amt,
                      color: CATEGORY_COLORS[cat as TransactionCategory] ?? c.textSecondary,
                    }))}
                    formatValue={(v) => formatInr(v)}
                  />
                </View>
              )}
              {topCategories.length > 0 && !isCompileFlagEnabled('animatedCharts') && (
                <View style={styles.topCategories}>
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
                          <View style={[styles.catBarTrack, { backgroundColor: c.track }]}>
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
                </View>
              )}
            </Animated.View>
          )}

          {/* Monthly Money Review entry — already row-shaped, kept (§3.5 item 4). */}
          {transactions.length > 0 && (
            <Animated.View
              entering={FadeIn.delay(stagger(1, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <Pressable onPress={() => router.push('/finance-review')}>
                <Card style={StyleSheet.flatten([styles.reviewCta, { borderColor: c.border }])}>
                  <View style={[styles.reviewIcon, { backgroundColor: c.financeDim }]}>
                    <Ionicons name="sparkles-outline" size={18} color={c.financeText} />
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

          {/* Insights — 4px severity rail kept (structural color), Card dropped:
              row + hairline, sentence-case title in the severity color (§3.5 item 5). */}
          {insights.map((ins, i) => (
            <Animated.View
              key={ins.id}
              entering={FadeIn.delay(stagger(2 + i, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
            >
              <View
                style={[
                  styles.insightRow,
                  { borderTopColor: c.border, borderLeftColor: severityColor(ins.severity, c) },
                ]}
              >
                <View style={styles.insightHeader}>
                  <Ionicons
                    name={severityIcon(ins.severity)}
                    size={18}
                    color={severityColor(ins.severity, c)}
                  />
                  <Body style={[styles.insightTitle, { color: severityColor(ins.severity, c) }]}>
                    {ins.title}
                  </Body>
                  <Pressable onPress={() => onDismissInsight(ins.id)} hitSlop={10}>
                    <Ionicons name="close" size={16} color={c.textMuted} />
                  </Pressable>
                </View>
                <Caption style={{ color: c.textSecondary, lineHeight: 20 }}>{ins.body}</Caption>
              </View>
            </Animated.View>
          ))}

          {/* Subscriptions & bills audit (Gmail) — §3.0.7 swaps live inside. */}
          <SubscriptionsBillsCard clientId={clientId} />

          {/* ─── Connections — always the LAST section (§3.5 item 7): sync
              plumbing demoted from position 1 to the bottom. ─── */}
          <View>
            <SectionTitle>Connections</SectionTitle>
            <ConnectRow
              icon="mail-outline"
              title="Gmail"
              caption={statusLine}
              status={statusLine}
              actionLabel="Sync now"
              accent={c.finance}
              onPress={onOpenGmailSheet}
              testID="connect-row-gmail"
              loading={syncing}
              error={syncError ?? undefined}
            />
          </View>
        </>
      )}
    </>
  );
}

// ─── Gmail actions sheet ──────────────────────────────────────────────────────

// The §3.0.3 press target for connect-row-gmail. "Disconnect" lives here — one
// level in — never on the row itself.
function GmailActionsSheet({
  visible,
  c,
  syncing,
  onSync,
  onDisconnect,
  onClose,
}: {
  visible: boolean;
  c: ReturnType<typeof useColors>;
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[modalStyles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose}>
        <Pressable style={[modalStyles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Body style={{ fontFamily: fonts.bodyMedium, color: c.textPrimary }}>Gmail</Body>
          <Pressable
            onPress={onSync}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel="Sync now"
            style={[modalStyles.actionRow, { borderTopColor: c.border }]}
          >
            <Ionicons name="refresh" size={18} color={c.financeText} />
            <Body style={{ color: c.textPrimary }}>Sync now</Body>
          </Pressable>
          <Pressable
            onPress={onDisconnect}
            accessibilityRole="button"
            accessibilityLabel="Disconnect Gmail"
            style={[modalStyles.actionRow, { borderTopColor: c.border }]}
          >
            <Ionicons name="log-out-outline" size={18} color={c.error} />
            <Body style={{ color: c.error }}>Disconnect Gmail</Body>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
  const [filter, setFilter] = useState<TxFilter>('all');
  const [query, setQuery] = useState('');

  if (!gmailConnected && transactions.length === 0) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="No transactions yet"
        caption="Connect Gmail on the Overview tab to start ingesting bank alert emails."
        accent={c.finance}
        cta={
          Platform.OS === 'web'
            ? { label: 'Connect Gmail', onPress: onConnect }
            : undefined
        }
      />
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
                    { backgroundColor: c.surfaceAlt },
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
  // §3.0.6 motion contract (same treatment as the Overview cast).
  const motionScale = useMotionScale();
  const stagger = useStaggerDelay();
  const scaled = (base: number) => (motionScale === 0 ? 0 : base / motionScale);

  // True savings rate from transactions (if available)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const thisMonth = transactions.filter((t) => t.date >= monthStart);
  const credits = thisMonth.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);
  const debits = thisMonth.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount, 0);
  const netPaise = credits - debits;

  if (!hasGoal) {
    return (
      <Animated.View entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}>
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
      <Animated.View entering={FadeInDown.duration(scaled(MOTION_BUDGET.hero))}>
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
        <Animated.View
          entering={FadeIn.delay(stagger(0, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
          <Card style={styles.rateCard}>
            {/* §3.5 Goals-tab swap: SectionTitle + display numeral (TABULAR_NUMS,
                c.financeText) replace the TRUE SAVINGS RATE caps eyebrow. */}
            <SectionTitle>True savings rate</SectionTitle>
            <Text variant="display" numeric color={c.financeText}>
              {netPaise >= 0 ? '+' : '-'}
              {formatInr(Math.abs(netPaise))}
            </Text>
            <Caption style={{ color: c.textMuted }}>
              From real transactions: {formatInr(credits)} in, {formatInr(debits)} out.
            </Caption>
          </Card>
        </Animated.View>
      )}

      {plan && (
        <Animated.View
          entering={FadeIn.delay(stagger(1, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
          <Card style={styles.strategyCard}>
            <SectionTitle>Strategy</SectionTitle>
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
        <Animated.View
          entering={FadeIn.delay(stagger(2, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
          <MilestoneTracker milestones={milestones} onComplete={onCompleteMilestone} />
        </Animated.View>
      )}

      {plan && (
        <Animated.View
          entering={FadeIn.delay(stagger(3, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
          <Card style={styles.tipsCard}>
            <SectionTitle>Weekly tips</SectionTitle>
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
        <Animated.View
          entering={FadeIn.delay(stagger(4, MOTION_BUDGET.staggerTight)).duration(scaled(MOTION_BUDGET.reveal))}
        >
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
          <Body style={{ fontFamily: fonts.bodyMedium, color: c.financeText }}>Recategorise</Body>
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
                      // Active category is data — solid hue border, neutral fill.
                      borderColor: isActive ? col : c.border,
                      backgroundColor: isActive ? c.surfaceAlt : c.surface,
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
      // Violet voice ruling (founder, 2026-06-14): insight severity is finance
      // data, not the brand speaking — default to the domain hue.
      return c.finance;
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
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    scrollInner: {
      paddingHorizontal: spacing.xl,
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
      backgroundColor: c.financeDim,
    },
    tabLabel: {
      fontFamily: fonts.bodyMedium,
      color: c.textSecondary,
      fontSize: fontSizes.sm,
    },
    tabLabelActive: {
      color: c.finance,
      fontWeight: '700',
    },
    // Setup
    setupTitle: { fontSize: fontSizes.xxl, marginBottom: spacing.md },
    fieldLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: c.textSecondary,
    },
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
      backgroundColor: c.financeDim,
    },
    typeTextSelected: { color: c.financeText },
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
    chipSelected: { borderColor: c.finance, backgroundColor: c.financeDim },
    chipTextSelected: { color: c.financeText },
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
    riskCardSelected: { borderColor: c.finance, backgroundColor: c.financeDim },
    riskLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
    riskLabelSelected: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.financeText },
    // Spending mix + top categories (plain section — no Card, §3.5 items 2–3)
    groupBar: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 5,
      overflow: 'hidden',
      marginTop: spacing.sm,
    },
    groupLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    groupLegendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    topCategories: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    reviewCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    reviewIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    // Categories
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    catDot: { width: 10, height: 10, borderRadius: 5 },
    catLabel: { fontSize: fontSizes.sm, color: c.textPrimary },
    catBarTrack: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: 4,
    },
    catBarFill: { height: '100%', borderRadius: 3 },
    // Insight rows (Card dropped; severity rail kept — §3.5 item 5)
    insightRow: {
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingLeft: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: 4,
    },
    insightHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    insightTitle: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
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
      backgroundColor: c.financeDim,
      borderColor: c.finance,
    },
    filterTextActive: { color: c.financeText, fontWeight: '700' },
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
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
