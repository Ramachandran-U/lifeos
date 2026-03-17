import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { ModuleHeader } from '@/components/ui/ModuleHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Body, Label, Caption, Heading } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { FinanceGoalCard } from '@/components/modules/finance/FinanceGoalCard';
import { MilestoneTracker } from '@/components/modules/finance/MilestoneTracker';
import { WeeklyInsightCard } from '@/components/modules/finance/WeeklyInsightCard';
import { useAI } from '@/hooks/useAI';
import { generateFinancialPlan, getWeeklyFinanceInsight } from '@/ai/functions';
import { getFinancialGoals, createFinancialGoal, createMilestone, getMilestonesByGoal, completeMilestone } from '@/db/queries/finance';
import type { FinancialPlan, WeeklyFinanceInsight } from '@/ai/types';

const GOAL_TYPES = [
  { value: 'home', label: 'Home Down Payment', icon: 'home' },
  { value: 'retirement', label: 'Retirement', icon: 'umbrella' },
  { value: 'emergency_fund', label: 'Emergency Fund', icon: 'shield-checkmark' },
  { value: 'financial_freedom', label: 'Financial Freedom', icon: 'rocket' },
  { value: 'education', label: 'Education', icon: 'school' },
  { value: 'business', label: 'Start a Business', icon: 'storefront' },
] as const;

const INCOME_BRACKETS = [
  { value: 'under_30k', label: 'Under $30K' },
  { value: '30k_50k', label: '$30K – $50K' },
  { value: '50k_75k', label: '$50K – $75K' },
  { value: '75k_100k', label: '$75K – $100K' },
  { value: '100k_150k', label: '$100K – $150K' },
  { value: '150k_plus', label: '$150K+' },
];

const RISK_PROFILES = [
  { value: 'conservative', label: 'Conservative', desc: 'Steady and safe' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced growth' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Maximum growth' },
];

type SetupStep = 'type' | 'details' | 'generating' | null;

export default function FinanceScreen() {
  const { call, loading } = useAI();
  const [setupStep, setSetupStep] = useState<SetupStep>(null);
  const [hasGoal, setHasGoal] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [insight, setInsight] = useState<WeeklyFinanceInsight | null>(null);
  const [milestones, setMilestones] = useState<Array<{ id: string; title: string; targetAmount: number; targetDate: string; completedAt: string | null }>>([]);

  // Setup form state
  const [selectedType, setSelectedType] = useState('');
  const [targetAmount, setTargetAmount] = useState('75000');
  const [monthlySavings, setMonthlySavings] = useState('2000');
  const [incomeBracket, setIncomeBracket] = useState('75k_100k');
  const [riskProfile, setRiskProfile] = useState('moderate');

  const loadExistingGoal = useCallback(() => {
    const goals = getFinancialGoals();
    if (goals.length > 0) {
      const g = goals[0];
      setHasGoal(true);
      setGoalId(g.id);
      setSelectedType(g.goalType);
      const ms = getMilestonesByGoal(g.id);
      setMilestones(ms);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExistingGoal();
    }, [loadExistingGoal])
  );

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
      })
    );

    if (result) {
      setPlan(result);
      const id = createFinancialGoal({
        title: GOAL_TYPES.find(t => t.value === selectedType)?.label ?? selectedType,
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
        createdMilestones.push({ id: mId, title: m.title, targetAmount: m.targetAmount, targetDate: m.targetDate, completedAt: null });
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
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, completedAt: new Date().toISOString() } : m));
  };

  const handleGetInsight = async () => {
    const completedAmount = milestones
      .filter(m => m.completedAt)
      .reduce((sum, m) => sum + m.targetAmount, 0);
    const result = await call(() =>
      getWeeklyFinanceInsight({
        goalTitle: GOAL_TYPES.find(t => t.value === selectedType)?.label ?? selectedType,
        targetAmount: Number(targetAmount),
        currentSaved: completedAmount,
        monthlySavings: Number(monthlySavings),
        monthsRemaining: 24,
      })
    );
    if (result) setInsight(result);
  };

  // --- Setup Flow ---
  if (!hasGoal && setupStep !== null) {
    if (setupStep === 'type') {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
            <ModuleHeader title="Finance" icon="wallet" color={colors.finance} />
            <Heading style={styles.setupTitle}>What are you saving for?</Heading>
            <View style={styles.typeGrid}>
              {GOAL_TYPES.map(t => (
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
                    color={selectedType === t.value ? colors.finance : colors.textSecondary}
                  />
                  <Caption style={selectedType === t.value ? styles.typeTextSelected : undefined}>
                    {t.label}
                  </Caption>
                </Pressable>
              ))}
            </View>
            {selectedType !== '' && (
              <Button title="Continue" onPress={() => setSetupStep('details')} style={styles.continueBtn} />
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

    if (setupStep === 'details') {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
            <ModuleHeader title="Finance" icon="wallet" color={colors.finance} />
            <Heading style={styles.setupTitle}>Your financial details</Heading>

            <Label>Target amount ($)</Label>
            <View style={styles.inputRow}>
              {['25000', '50000', '75000', '100000', '200000'].map(v => (
                <Pressable
                  key={v}
                  style={[styles.chip, targetAmount === v && styles.chipSelected]}
                  onPress={() => setTargetAmount(v)}
                >
                  <Caption style={targetAmount === v ? styles.chipTextSelected : undefined}>
                    ${Number(v).toLocaleString()}
                  </Caption>
                </Pressable>
              ))}
            </View>

            <Label style={styles.labelSpaced}>Monthly savings ($)</Label>
            <View style={styles.inputRow}>
              {['500', '1000', '2000', '3000', '5000'].map(v => (
                <Pressable
                  key={v}
                  style={[styles.chip, monthlySavings === v && styles.chipSelected]}
                  onPress={() => setMonthlySavings(v)}
                >
                  <Caption style={monthlySavings === v ? styles.chipTextSelected : undefined}>
                    ${Number(v).toLocaleString()}
                  </Caption>
                </Pressable>
              ))}
            </View>

            <Label style={styles.labelSpaced}>Income bracket</Label>
            <View style={styles.inputRow}>
              {INCOME_BRACKETS.map(b => (
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
              {RISK_PROFILES.map(r => (
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

            <Button title="Generate my plan" onPress={handleGeneratePlan} style={styles.continueBtn} />
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

  // --- Empty State ---
  if (!hasGoal) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
          <ModuleHeader title="Finance" icon="wallet" color={colors.finance} />
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={48} color={colors.finance} />
            </View>
            <Heading style={styles.emptyTitle}>Take control of your finances</Heading>
            <Body style={styles.emptyBody}>
              Set a financial goal and get an AI-powered savings plan with milestones, strategies, and weekly insights.
            </Body>
            <Button
              title="Set up my financial goal"
              onPress={() => setSetupStep('type')}
              style={styles.setupButton}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Finance Hub (has goal) ---
  const completedAmount = milestones
    .filter(m => m.completedAt)
    .reduce((sum, m) => sum + m.targetAmount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <ModuleHeader title="Finance" icon="wallet" color={colors.finance} />

        <Animated.View entering={FadeInDown.duration(400)}>
          <FinanceGoalCard
            title={GOAL_TYPES.find(t => t.value === selectedType)?.label ?? selectedType}
            goalType={selectedType}
            targetAmount={Number(targetAmount)}
            currentSaved={completedAmount}
            monthlyTarget={Number(monthlySavings)}
            targetDate="2028-06-01"
          />
        </Animated.View>

        {plan && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Card style={styles.strategyCard}>
              <Label color={colors.finance}>STRATEGY</Label>
              {plan.strategy.map((s, i) => (
                <View key={i} style={styles.strategyRow}>
                  <View style={styles.strategyDot} />
                  <View style={styles.strategyContent}>
                    <Body style={styles.strategyAction}>{s.action}</Body>
                    <Caption>+${s.monthlyImpact.toLocaleString()}/mo</Caption>
                  </View>
                </View>
              ))}
            </Card>
          </Animated.View>
        )}

        {milestones.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <MilestoneTracker milestones={milestones} onComplete={handleCompleteMilestone} />
          </Animated.View>
        )}

        {plan && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Card style={styles.tipsCard}>
              <Label color={colors.finance}>WEEKLY TIPS</Label>
              {plan.weeklyTips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons name="bulb-outline" size={16} color={colors.finance} />
                  <Caption style={styles.tipText}>{tip}</Caption>
                </View>
              ))}
            </Card>
          </Animated.View>
        )}

        {insight ? (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <WeeklyInsightCard insight={insight} />
          </Animated.View>
        ) : (
          <Button
            title={loading ? 'Loading...' : 'Get weekly insight'}
            variant="secondary"
            onPress={handleGetInsight}
            disabled={loading}
            style={styles.insightButton}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  // Setup flow
  setupTitle: {
    fontSize: fontSizes.xxl,
    marginBottom: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeCardSelected: {
    borderColor: colors.finance,
    backgroundColor: colors.finance + '15',
  },
  typeTextSelected: {
    color: colors.finance,
  },
  continueBtn: {
    marginTop: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    borderColor: colors.finance,
    backgroundColor: colors.finance + '15',
  },
  chipTextSelected: {
    color: colors.finance,
  },
  labelSpaced: {
    marginTop: spacing.md,
  },
  riskRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  riskCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  riskCardSelected: {
    borderColor: colors.finance,
    backgroundColor: colors.finance + '15',
  },
  riskLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  riskLabelSelected: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.finance,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.finance + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
  },
  setupButton: {
    marginTop: spacing.sm,
    width: '100%',
  },
  // Hub
  strategyCard: {
    gap: spacing.sm,
  },
  strategyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  strategyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.finance,
    marginTop: 6,
  },
  strategyContent: {
    flex: 1,
  },
  strategyAction: {
    fontSize: fontSizes.sm,
  },
  tipsCard: {
    gap: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tipText: {
    flex: 1,
    color: colors.textSecondary,
  },
  insightButton: {
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
  },
});
