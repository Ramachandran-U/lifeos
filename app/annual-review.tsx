import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { useStaggerDelay } from '@/theme/motion';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useUserStore } from '@/store/useUserStore';
import { useDomainHistoryStore } from '@/store/useDomainHistoryStore';
import { useAnnualReviewStore } from '@/store/useAnnualReviewStore';
import { generateAnnualReview } from '@/ai/functions';
import { buildAnnualReviewInput } from '@/utils/annualReviewBuilder';
import type { AnnualReview } from '@/ai/types';

function reviewToText(name: string | null, r: AnnualReview): string {
  const lines = [
    `LifeOS — Your journey so far${name ? `, ${name}` : ''}`,
    '',
    r.headline,
    '',
    ...r.domains.map((d) => `• ${d.domain}: ${d.summary}`),
    '',
    `Biggest win: ${r.biggestWin}`,
    `Growth area: ${r.growthArea}`,
    `Theme for next year: ${r.themeForNextYear}`,
  ];
  return lines.join('\n');
}

export default function AnnualReviewScreen() {
  const c = useColors();
  const stagger = useStaggerDelay();
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const name = useUserStore((s) => s.name);

  const cache = useAnnualReviewStore((s) => s.cache);
  const setCache = useAnnualReviewStore((s) => s.setCache);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AnnualReview | null>(null);
  // Guard against concurrent generations (rapid refresh taps fire before the
  // disabled-state re-render lands).
  const inFlightRef = useRef(false);

  const generate = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId || inFlightRef.current) return;

    // The review is yearly + Opus-tier — serve the cached copy for the current
    // calendar year unless the user explicitly refreshes.
    const year = new Date().getFullYear();
    if (!opts?.force && cache?.year === year) {
      setReport(cache.review);
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setReport(null);
    try {
      // Earliest composite scores in the retained window → life-score "start".
      const entries = useDomainHistoryStore.getState().entries;
      const startScores: Record<string, number> = {};
      for (const [domain, points] of Object.entries(entries)) {
        if (points && points.length) startScores[domain] = points[0].score;
      }
      const input = buildAnnualReviewInput(userId, name, startScores);
      const result = await generateAnnualReview(input);
      setReport(result);
      setCache({ year, review: result });
    } catch (err) {
      Alert.alert('Review failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [userId, name, cache, setCache]);

  useEffect(() => {
    void generate();
  }, [generate]);

  const handleExport = useCallback(async () => {
    if (!report) return;
    // Web: the browser's print dialog doubles as "Save as PDF". Native: share
    // the text version through the OS share sheet.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
      return;
    }
    try {
      await Share.share({ message: reviewToText(name, report) });
    } catch {
      /* user dismissed */
    }
  }, [report, name]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <InkCanvas />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>
          <View style={styles.topActions}>
            {report && (
              <Pressable onPress={handleExport} hitSlop={12} style={styles.exportBtn}>
                <Ionicons name={Platform.OS === 'web' ? 'download-outline' : 'share-outline'} size={18} color={c.primary} />
                <Caption style={{ color: c.primary, fontFamily: fonts.heading }}>
                  {Platform.OS === 'web' ? 'Save PDF' : 'Share'}
                </Caption>
              </Pressable>
            )}
            <Pressable onPress={() => generate({ force: true })} hitSlop={12} disabled={loading}>
              <Ionicons name="refresh" size={20} color={loading ? c.textMuted : c.primary} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Caption style={{ color: c.primary, fontFamily: fonts.heading, letterSpacing: 1 }}>
            LOOKING BACK
          </Caption>
          <Heading style={[styles.title, { color: c.textPrimary }]}>Your journey so far</Heading>

          {loading ? (
            <Card style={styles.loadCard}>
              <LoadingDots />
              <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>
                Reading a year of your life across six domains…
              </Caption>
            </Card>
          ) : report ? (
            <>
              <Animated.View entering={FadeInDown.delay(stagger(0, 70)).duration(300)}>
                <Card>
                  <Body style={[styles.headline, { color: c.textPrimary }]}>{report.headline}</Body>
                </Card>
              </Animated.View>

              {report.domains.map((d, i) => (
                <Animated.View key={d.domain} entering={FadeInDown.delay(stagger(i + 1, 70)).duration(300)}>
                  <Card>
                    <SectionLabel color={c.textSecondary}>{d.domain.toUpperCase()}</SectionLabel>
                    <Body style={{ color: c.textPrimary, marginTop: spacing.xs }}>{d.summary}</Body>
                  </Card>
                </Animated.View>
              ))}

              <Animated.View entering={FadeInDown.delay(stagger(report.domains.length + 1, 70)).duration(300)}>
                <Card>
                  <SectionLabel color={c.success}>BIGGEST WIN</SectionLabel>
                  <Body style={{ color: c.textPrimary, marginTop: spacing.xs }}>{report.biggestWin}</Body>
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(stagger(report.domains.length + 2, 70)).duration(300)}>
                <Card>
                  <SectionLabel color={c.warning}>GROWTH AREA</SectionLabel>
                  <Body style={{ color: c.textPrimary, marginTop: spacing.xs }}>{report.growthArea}</Body>
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(stagger(report.domains.length + 3, 70)).duration(300)}>
                <Card>
                  <SectionLabel color={c.polymathText}>THEME FOR NEXT YEAR</SectionLabel>
                  <Body style={[styles.theme, { color: c.textPrimary }]}>{report.themeForNextYear}</Body>
                </Card>
              </Animated.View>
            </>
          ) : (
            <Caption style={{ color: c.textMuted, marginTop: spacing.lg }}>No review available.</Caption>
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
    paddingBottom: spacing.xs,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { fontSize: fontSizes.xxl, marginTop: 2, marginBottom: spacing.xs },
  loadCard: { alignItems: 'center', paddingVertical: spacing.xl },
  headline: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    lineHeight: 26,
  },
  theme: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    marginTop: spacing.xs,
  },
});
