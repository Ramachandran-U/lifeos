import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useTransactionStore } from '@/finance/store/useTransactionStore';
import { cadenceDays, type AnalyticsTx } from '@/finance/analytics';
import { formatInr, prettyCategory, categoryColor } from '@/finance/display';
import type { TransactionCategory } from '@/ai/types';

function cadenceLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days <= 2) return 'multiple times a day';
  if (days <= 9) return `about every ${days} days`;
  if (days <= 20) return 'roughly fortnightly';
  if (days <= 45) return 'roughly monthly';
  return `about every ${Math.round(days / 30)} months`;
}

export default function FinanceMerchantScreen() {
  const c = useColors();
  const router = useRouter();
  const { merchant } = useLocalSearchParams<{ merchant: string }>();
  const name = merchant ?? '';

  const transactions = useTransactionStore((s) => s.transactions);
  const load = useTransactionStore((s) => s.load);
  useEffect(() => {
    if (transactions.length === 0) void load();
  }, [transactions.length, load]);

  const { rows, total, count, cadence, topCategory } = useMemo(() => {
    const mine: AnalyticsTx[] = transactions
      .filter((t) => t.merchant === name)
      .map((t) => ({ date: t.date, amount: t.amount, direction: t.direction, merchant: t.merchant, category: t.category }));
    const debits = mine.filter((t) => t.direction === 'debit');
    const cat = debits[0]?.category ?? 'other';
    return {
      rows: mine.sort((a, b) => (a.date < b.date ? 1 : -1)),
      total: debits.reduce((s, t) => s + t.amount, 0),
      count: debits.length,
      cadence: cadenceLabel(cadenceDays(debits.map((t) => t.date))),
      topCategory: cat as TransactionCategory,
    };
  }, [transactions, name]);

  const accent = categoryColor(topCategory, c.finance);
  const perMonth = count > 0 ? Math.round(total / Math.max(1, count)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <InkCanvas />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/finance'))}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Label color={accent}>MERCHANT</Label>
          <Heading style={[styles.title, { color: c.textPrimary }]} numberOfLines={2}>{name}</Heading>

          <Animated.View entering={FadeInDown.duration(300)}>
            {/* Neutral card — the category-accent label above is the identity mark. */}
            <Card style={styles.summaryCard}>
              <Heading style={{ color: c.textPrimary, fontSize: fontSizes.xxxl }}>{formatInr(total)}</Heading>
              <Caption style={{ color: c.textMuted }}>
                {count} payment{count === 1 ? '' : 's'} · {prettyCategory(topCategory)}
              </Caption>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Caption style={{ color: c.textMuted }}>Avg / payment</Caption>
                  <Body style={{ color: c.textPrimary, fontFamily: fonts.heading }}>{formatInr(perMonth)}</Body>
                </View>
                {cadence && (
                  <View style={styles.stat}>
                    <Caption style={{ color: c.textMuted }}>Frequency</Caption>
                    <Body style={{ color: c.textPrimary, fontFamily: fonts.heading }}>{cadence}</Body>
                  </View>
                )}
              </View>
            </Card>
          </Animated.View>

          {rows.length > 0 && (
            <Animated.View entering={FadeInDown.delay(80).duration(300)}>
              <Card>
                <Label color={c.finance}>HISTORY</Label>
                {rows.map((t, i) => (
                  <View key={`${t.date}-${i}`} style={styles.txRow}>
                    <View style={{ flex: 1 }}>
                      <Caption style={{ color: c.textMuted }}>{t.date}</Caption>
                      <Caption style={{ color: c.textMuted }}>{prettyCategory(t.category as TransactionCategory)}</Caption>
                    </View>
                    <Body style={{ color: t.direction === 'credit' ? c.success : c.textPrimary, fontFamily: fonts.heading }}>
                      {t.direction === 'credit' ? '+' : ''}{formatInr(t.amount)}
                    </Body>
                  </View>
                ))}
              </Card>
            </Animated.View>
          )}

          {rows.length === 0 && (
            <Caption style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.lg }}>
              No transactions for this merchant.
            </Caption>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { fontSize: fontSizes.xxl, marginTop: 2, marginBottom: spacing.xs },
  summaryCard: { gap: spacing.xs },
  statRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  stat: { gap: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
