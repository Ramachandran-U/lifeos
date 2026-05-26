import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useUserStore } from '@/store/useUserStore';
import { getUserProfile } from '@/db/queries/userProfile';
import { generateMonthlyInsightReport } from '@/ai/functions';
import { buildMonthlyInsightInput } from '@/utils/monthlyInsightBuilder';
import type { MonthlyInsightReport } from '@/ai/types';

export default function MonthlyInsightScreen() {
  const c = useColors();
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<MonthlyInsightReport | null>(null);
  const [meta, setMeta] = useState<{ completionRate: number; planned: number } | null>(null);

  const generate = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setReport(null);
    try {
      const profile = await getUserProfile(userId);
      if (!profile) {
        Alert.alert('No profile yet', 'Finish onboarding to generate your monthly report.');
        return;
      }
      const input = buildMonthlyInsightInput(profile);
      setMeta({ completionRate: input.totals.completionRate, planned: input.totals.blocksPlanned });
      const result = await generateMonthlyInsightReport(input);
      setReport(result);
    } catch (err) {
      Alert.alert('Report failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void generate();
  }, [generate]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AuroraBackground />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          <Pressable onPress={generate} hitSlop={12} disabled={loading}>
            <Ionicons name="refresh" size={20} color={loading ? c.textMuted : c.primary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Heading style={[styles.title, { color: c.textPrimary }]}>Last 28 days</Heading>
          {meta ? (
            <Caption style={{ color: c.textMuted }}>
              {meta.planned} blocks planned · {Math.round(meta.completionRate * 100)}% completed
            </Caption>
          ) : null}

          {loading ? (
            <Card style={styles.loadCard}>
              <LoadingDots />
              <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>
                Reading the last month of your routine…
              </Caption>
            </Card>
          ) : report ? (
            <>
              <Animated.View entering={FadeInDown.duration(300)}>
                <Card moduleColor={c.success}>
                  <SectionLabel color={c.success}>WINS</SectionLabel>
                  <View style={styles.list}>
                    {report.wins.map((w, i) => (
                      <Body key={i} style={{ color: c.textPrimary }}>• {w}</Body>
                    ))}
                  </View>
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(80).duration(300)}>
                <Card moduleColor={c.primary}>
                  <SectionLabel color={c.primary}>PATTERNS</SectionLabel>
                  <View style={styles.list}>
                    {report.patterns.map((p, i) => (
                      <Body key={i} style={{ color: c.textPrimary }}>• {p}</Body>
                    ))}
                  </View>
                </Card>
              </Animated.View>

              {report.slipping.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(160).duration(300)}>
                  <Card moduleColor={c.warning}>
                    <SectionLabel color={c.warning}>SLIPPING</SectionLabel>
                    <View style={styles.list}>
                      {report.slipping.map((s, i) => (
                        <Body key={i} style={{ color: c.textPrimary }}>• {s}</Body>
                      ))}
                    </View>
                  </Card>
                </Animated.View>
              ) : null}

              <Animated.View entering={FadeInDown.delay(240).duration(300)}>
                <Card moduleColor={c.polymath}>
                  <SectionLabel color={c.polymath}>ONE ADJUSTMENT</SectionLabel>
                  <Body style={[styles.adjustment, { color: c.textPrimary }]}>{report.oneAdjustment}</Body>
                </Card>
              </Animated.View>
            </>
          ) : (
            <Caption style={{ color: c.textMuted, marginTop: spacing.lg }}>
              No report available.
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSizes.xxl,
    marginTop: spacing.sm,
  },
  loadCard: { alignItems: 'center', paddingVertical: spacing.xl },
  list: { marginTop: spacing.xs, gap: spacing.xs },
  adjustment: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    marginTop: spacing.xs,
  },
});
