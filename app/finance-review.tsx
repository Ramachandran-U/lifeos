import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { useStaggerDelay } from '@/theme/motion';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useTransactionStore } from '@/finance/store/useTransactionStore';
import { useMoneyReviewStore, currentMonthKey } from '@/finance/store/useMoneyReviewStore';
import { buildMoneyReviewInput } from '@/finance/moneyReview';
import { generateMoneyReview } from '@/ai/functions';
import type { MonthlyMoneyReview } from '@/ai/types';

export default function FinanceReviewScreen() {
  const c = useColors();
  const stagger = useStaggerDelay();
  const router = useRouter();
  const transactions = useTransactionStore((s) => s.transactions);
  const load = useTransactionStore((s) => s.load);
  const cache = useMoneyReviewStore((s) => s.cache);
  const setCache = useMoneyReviewStore((s) => s.setCache);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<MonthlyMoneyReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (transactions.length === 0) void load();
  }, [transactions.length, load]);

  const generate = useCallback(
    async (opts?: { force?: boolean }) => {
      if (inFlight.current) return;
      const monthKey = currentMonthKey();
      if (!opts?.force && cache?.monthKey === monthKey) {
        setReport(cache.review);
        return;
      }
      if (transactions.length === 0) return;
      inFlight.current = true;
      setLoading(true);
      setReport(null);
      setError(null);
      try {
        const input = buildMoneyReviewInput(
          transactions.map((t) => ({ date: t.date, amount: t.amount, direction: t.direction, merchant: t.merchant, category: t.category })),
        );
        const result = await generateMoneyReview(input);
        setReport(result);
        setCache({ monthKey, review: result, txCount: transactions.length });
      } catch (err) {
        // Alert.alert is a no-op on web — surface the error inline instead so
        // a rate-limit / schema failure isn't a silent blank screen.
        setError(err instanceof Error ? err.message : 'Could not generate the review.');
      } finally {
        setLoading(false);
        inFlight.current = false;
      }
    },
    [transactions, cache, setCache],
  );

  useEffect(() => {
    void generate();
  }, [generate]);

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
          <Pressable onPress={() => generate({ force: true })} hitSlop={12} disabled={loading}>
            <Ionicons name="refresh" size={20} color={loading ? c.textMuted : c.finance} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Label color={c.finance}>MONTHLY MONEY REVIEW</Label>
          <Heading style={[styles.title, { color: c.textPrimary }]}>Where your money went</Heading>

          {loading ? (
            <Card style={styles.loadCard}>
              <LoadingDots />
              <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>Reading this month's transactions…</Caption>
            </Card>
          ) : report ? (
            <>
              {cache?.txCount != null && transactions.length > cache.txCount && (
                <Caption style={{ color: c.warning, textAlign: 'center' }}>
                  {transactions.length - cache.txCount} new transaction{transactions.length - cache.txCount === 1 ? '' : 's'} since this review — tap refresh ↗ for an updated analysis.
                </Caption>
              )}

              <Animated.View entering={FadeInDown.delay(stagger(0, 80)).duration(300)}>
                <Card>
                  <Body style={[styles.headline, { color: c.textPrimary }]}>{report.headline}</Body>
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(stagger(1, 80)).duration(300)}>
                <Card>
                  <SectionLabel color={c.success}>WINS</SectionLabel>
                  <View style={styles.list}>
                    {report.wins.map((w, i) => (
                      <Body key={i} style={{ color: c.textPrimary }}>• {w}</Body>
                    ))}
                  </View>
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(stagger(2, 80)).duration(300)}>
                <Card>
                  <SectionLabel color={c.warning}>WHERE IT WENT</SectionLabel>
                  <View style={styles.list}>
                    {report.leaks.map((l, i) => (
                      <Body key={i} style={{ color: c.textPrimary }}>• {l}</Body>
                    ))}
                  </View>
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(stagger(3, 80)).duration(300)}>
                {/* V4 — the AI's recommendation: violet eyebrow, card neutral. */}
                <Card>
                  <SectionLabel color={c.primary}>ONE ADJUSTMENT</SectionLabel>
                  <Body style={[styles.adjustment, { color: c.textPrimary }]}>{report.oneAdjustment}</Body>
                </Card>
              </Animated.View>
            </>
          ) : error ? (
            <Card style={styles.loadCard}>
              <Ionicons name="alert-circle-outline" size={28} color={c.error} />
              <Body style={{ color: c.textPrimary, textAlign: 'center', marginTop: spacing.sm }}>
                Couldn't build your review
              </Body>
              <Caption style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.xs }}>{error}</Caption>
              <Pressable onPress={() => generate({ force: true })} style={[styles.retryBtn, { backgroundColor: c.finance }]}>
                <Body style={{ color: c.inkOnColor, fontFamily: fonts.heading }}>Try again</Body>
              </Pressable>
            </Card>
          ) : transactions.length === 0 ? (
            <Caption style={{ color: c.textMuted, marginTop: spacing.lg }}>
              No transactions yet this month — sync your inbox on the Finance tab first.
            </Caption>
          ) : (
            <Caption style={{ color: c.textMuted, marginTop: spacing.lg }}>
              Preparing your review…
            </Caption>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { fontSize: fontSizes.xxl, marginTop: 2, marginBottom: spacing.xs },
  loadCard: { alignItems: 'center', paddingVertical: spacing.xl },
  headline: { fontFamily: fonts.heading, fontSize: fontSizes.lg, lineHeight: 26 },
  list: { marginTop: spacing.xs, gap: spacing.xs },
  adjustment: { fontFamily: fonts.heading, fontSize: fontSizes.lg, marginTop: spacing.xs },
  retryBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 12 },
});
