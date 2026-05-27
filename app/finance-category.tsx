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
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useTransactionStore } from '@/finance/store/useTransactionStore';
import { categoryRollup, type AnalyticsTx } from '@/finance/analytics';
import { totalConsumptionSpend } from '@/finance/categoryGroups';
import { formatInr, prettyCategory, categoryColor } from '@/finance/display';
import type { TransactionCategory } from '@/ai/types';

export default function FinanceCategoryScreen() {
  const c = useColors();
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = (category ?? 'other') as TransactionCategory;

  const transactions = useTransactionStore((s) => s.transactions);
  const load = useTransactionStore((s) => s.load);
  useEffect(() => {
    if (transactions.length === 0) void load();
  }, [transactions.length, load]);

  const accent = categoryColor(cat, c.finance);

  const { rollup, share, rows } = useMemo(() => {
    const all: AnalyticsTx[] = transactions.map((t) => ({
      date: t.date,
      amount: t.amount,
      direction: t.direction,
      merchant: t.merchant,
      category: t.category,
    }));
    const inCat = all.filter((t) => t.category === cat);
    const r = categoryRollup(inCat);
    const totalSpend = totalConsumptionSpend(
      all.map((t) => ({ amount: t.amount, direction: t.direction, category: t.category as TransactionCategory })),
    );
    return {
      rollup: r,
      share: totalSpend > 0 ? r.total / totalSpend : 0,
      rows: inCat
        .filter((t) => t.direction === 'debit')
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    };
  }, [transactions, cat]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AuroraBackground />
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
          <View style={styles.headerRow}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Label color={accent}>CATEGORY</Label>
          </View>
          <Heading style={[styles.title, { color: c.textPrimary }]}>{prettyCategory(cat)}</Heading>

          <Animated.View entering={FadeInDown.duration(300)}>
            <Card moduleColor={accent} style={styles.summaryCard}>
              <Heading style={{ color: c.textPrimary, fontSize: fontSizes.xxxl }}>
                {formatInr(rollup.total)}
              </Heading>
              <Caption style={{ color: c.textMuted }}>
                {rollup.count} transaction{rollup.count === 1 ? '' : 's'} · {Math.round(share * 100)}% of spend
              </Caption>
            </Card>
          </Animated.View>

          {rollup.topMerchants.length > 0 && (
            <Animated.View entering={FadeInDown.delay(80).duration(300)}>
              <Card>
                <Label color={c.finance}>TOP MERCHANTS</Label>
                {rollup.topMerchants.map((m) => (
                  <Pressable
                    key={m.merchant}
                    style={styles.merchantRow}
                    onPress={() => router.push({ pathname: '/finance-merchant', params: { merchant: m.merchant } })}
                  >
                    <Body style={{ color: c.textPrimary, flex: 1 }} numberOfLines={1}>{m.merchant}</Body>
                    <Caption style={{ color: c.textMuted }}>{m.count}×</Caption>
                    <Body style={{ color: c.textPrimary, fontFamily: fonts.heading, minWidth: 72, textAlign: 'right' }}>
                      {formatInr(m.total)}
                    </Body>
                    <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
                  </Pressable>
                ))}
              </Card>
            </Animated.View>
          )}

          {rows.length > 0 && (
            <Animated.View entering={FadeInDown.delay(160).duration(300)}>
              <Card>
                <Label color={c.finance}>ALL TRANSACTIONS</Label>
                {rows.map((t, i) => (
                  <View key={`${t.merchant}-${t.date}-${i}`} style={styles.txRow}>
                    <View style={{ flex: 1 }}>
                      <Body style={{ color: c.textPrimary }} numberOfLines={1}>{t.merchant}</Body>
                      <Caption style={{ color: c.textMuted }}>{t.date}</Caption>
                    </View>
                    <Body style={{ color: c.textPrimary, fontFamily: fonts.heading }}>{formatInr(t.amount)}</Body>
                  </View>
                ))}
              </Card>
            </Animated.View>
          )}

          {rows.length === 0 && (
            <Caption style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.lg }}>
              No transactions in this category yet.
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: fontSizes.xxl, marginBottom: spacing.xs },
  summaryCard: { gap: spacing.xs },
  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
