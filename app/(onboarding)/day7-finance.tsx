import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { useStaggerDelay } from '@/theme/motion';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { getCurrency, formatMoney } from '@/utils/currency';
import { useAI } from '@/hooks/useAI';
import { generateFinancialPlan } from '@/ai/functions';
import { useUserStore } from '@/store/useUserStore';
import { createFinancialGoal } from '@/db/queries/finance';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import type { FinancialPlan } from '@/ai/types';

const GOAL_TYPES: Array<{ value: string; label: string }> = [
  { value: 'emergency_fund',     label: 'Emergency fund' },
  { value: 'home',               label: 'Down payment' },
  { value: 'retirement',         label: 'Retirement' },
  { value: 'education',          label: 'Education' },
  { value: 'business',           label: 'Business' },
  { value: 'financial_freedom',  label: 'Financial freedom' },
];

const TIMELINE_OPTIONS = [
  { label: '1 yr', months: 12 },
  { label: '3 yrs', months: 36 },
  { label: '5 yrs', months: 60 },
  { label: '10 yrs', months: 120 },
];

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate',     label: 'Moderate' },
  { value: 'aggressive',   label: 'Aggressive' },
];

export default function Day7FinanceScreen() {
  const router = useRouter();
  const c = useColors();
  const stagger = useStaggerDelay();
  const styles = makeStyles(c);
  const { call, loading } = useAI();
  const { userId } = useUserStore();
  const markModuleActivated = useUserStore((s) => s.markModuleActivated);

  const [goalType, setGoalType] = useState<string>('emergency_fund');
  const [targetAmount, setTargetAmount] = useState('');
  // Currency comes from the app-wide single source of truth, not a free-text
  // field — keeps onboarding consistent with the Finance tab (getCurrency()).
  const activeCurrency = getCurrency();
  const [timelineMonths, setTimelineMonths] = useState(36);
  const [monthlySavings, setMonthlySavings] = useState('');
  const [riskProfile, setRiskProfile] = useState<string>('moderate');
  const [plan, setPlan] = useState<FinancialPlan | null>(null);

  const targetAmountNum = parseFloat(targetAmount) || 0;
  const monthlySavingsNum = parseFloat(monthlySavings) || 0;
  const canGenerate = targetAmountNum > 0 && monthlySavingsNum > 0;

  const targetDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + timelineMonths);
    return d.toISOString().slice(0, 10);
  })();

  const handleGenerate = async () => {
    if (!canGenerate) return;
    const result = await call(() =>
      generateFinancialPlan({
        goalType,
        targetAmount: targetAmountNum,
        targetDate,
        monthlySavings: monthlySavingsNum,
        // Localised middle bracket for the active currency (not asked here).
        incomeBracket: activeCurrency.incomeBrackets[2]?.value ?? activeCurrency.incomeBrackets[0]?.value ?? '50k_75k',
        riskProfile,
        currency: activeCurrency.code,
      }),
    );
    if (result) {
      setPlan(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleContinue = () => {
    if (!userId) return;
    try {
      createFinancialGoal({
        title: GOAL_TYPES.find((g) => g.value === goalType)?.label ?? goalType,
        goalType,
        targetAmount: targetAmountNum,
        currency: activeCurrency.code,
        targetDate,
        monthlySavings: monthlySavingsNum,
        riskProfile,
        metadata: plan ? JSON.stringify({ source: 'day7_onboarding', plan }) : undefined,
      });
      logBehaviourEvent('onboarding_day7_finance', 'finance', { goalType, timelineMonths });
      markModuleActivated('finance');
    } catch (err) {
      Alert.alert('Could not save goal', err instanceof Error ? err.message : 'Unknown error');
      return;
    }
    // Day 7 is split across Finance + Social — chain them so the user lands
    // on social next instead of bouncing straight into the Finance Hub.
    router.replace('/(onboarding)/day7-social');
  };

  return (
    <SafeAreaView style={styles.container}>
      <InkCanvas />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>

          <Animated.View entering={FadeInDown.duration(500)}>
            <Caption style={{ color: c.finance, letterSpacing: 1.5 }}>DAY 7 · FINANCE</Caption>
            <Heading style={styles.title}>Set your money goal</Heading>
            <Body style={styles.subtitle}>
              Pick the one financial outcome that would change your year. We'll work backwards from it.
            </Body>
          </Animated.View>

          <View style={styles.form}>
            <Label>Goal type</Label>
            <View style={styles.chipGrid}>
              {GOAL_TYPES.map((g, i) => {
                const active = g.value === goalType;
                return (
                  <Animated.View key={g.value} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                    <Pressable
                      onPress={() => setGoalType(g.value)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? c.financeDim : c.surface,
                          borderColor: active ? c.finance : c.border,
                        },
                      ]}
                    >
                      <Body style={{ color: active ? c.finance : c.textSecondary }}>{g.label}</Body>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Input
              label={`Target amount (${activeCurrency.symbol})`}
              value={targetAmount}
              onChangeText={setTargetAmount}
              keyboardType="numeric"
              placeholder={String(activeCurrency.targetPresets[1])}
            />

            <Label style={styles.fieldLabel}>Timeline</Label>
            <View style={styles.chipRow}>
              {TIMELINE_OPTIONS.map((t, i) => {
                const active = t.months === timelineMonths;
                return (
                  <Animated.View key={t.label} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                    <Pressable
                      onPress={() => setTimelineMonths(t.months)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? c.financeDim : c.surface,
                          borderColor: active ? c.finance : c.border,
                        },
                      ]}
                    >
                      <Body style={{ color: active ? c.finance : c.textSecondary }}>{t.label}</Body>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Input
              label="Monthly savings (current)"
              value={monthlySavings}
              onChangeText={setMonthlySavings}
              keyboardType="numeric"
              placeholder="500"
            />

            <Label style={styles.fieldLabel}>Risk profile</Label>
            <View style={styles.chipRow}>
              {RISK_OPTIONS.map((r, i) => {
                const active = r.value === riskProfile;
                return (
                  <Animated.View key={r.value} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                    <Pressable
                      onPress={() => setRiskProfile(r.value)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? c.financeDim : c.surface,
                          borderColor: active ? c.finance : c.border,
                        },
                      ]}
                    >
                      <Body style={{ color: active ? c.finance : c.textSecondary }}>{r.label}</Body>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {loading ? (
              <Card style={styles.previewCard}>
                <LoadingDots />
                <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>
                  Building your plan…
                </Caption>
              </Card>
            ) : plan ? (
              <Card moduleColor={c.finance} style={styles.previewCard}>
                <Label color={c.finance}>YOUR PLAN</Label>
                <Heading style={[styles.planHeadline, { color: c.textPrimary }]}>
                  {formatMoney(Math.round(plan.monthlyTarget))} / month
                </Heading>
                <Body style={{ color: c.textSecondary, marginTop: spacing.xs }}>{plan.summary}</Body>
                {plan.strategy.length > 0 ? (
                  <View style={{ marginTop: spacing.sm, gap: 4 }}>
                    {plan.strategy.slice(0, 3).map((s, i) => (
                      <Body key={i} style={{ color: c.textPrimary }}>• {s.action}</Body>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : (
              <Button
                title="Generate my plan"
                onPress={handleGenerate}
                disabled={!canGenerate}
              />
            )}

            {plan ? (
              <Button title="Save & open Finance" onPress={handleContinue} />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  back: { alignSelf: 'flex-start', paddingTop: spacing.sm },
  title: { fontSize: fontSizes.hero, marginTop: spacing.xs, color: c.textPrimary, fontFamily: fonts.display },
  subtitle: { color: c.textSecondary, marginTop: spacing.xs },
  form: { gap: spacing.sm, marginTop: spacing.md },
  fieldLabel: { marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  previewCard: { marginTop: spacing.sm },
  planHeadline: { fontSize: fontSizes.xxl, marginTop: spacing.xs },
});
