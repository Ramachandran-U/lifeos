import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { getSparkByDate, listRecentSparkTitles } from '@/db/queries/sparks';
import { generateRabbitHoleNode, type GeneratedNode, type RabbitHoleDirection } from '@/explore/rabbitHole';
import { exploreThreadNode } from '@/ai/agent/exploreThread';
import { isEnabled } from '@/config/flags';
import { XP_VALUES } from '@/utils/gamification';
import { track, EVENTS } from '@/utils/telemetry';
import { format } from 'date-fns';

interface ThreadNode extends GeneratedNode {
  /** How the user arrived at this node — null for the root. */
  arrivedVia: RabbitHoleDirection | null;
}

const MAX_DEPTH = 12; // soft cap — beyond this we nudge the user to wrap up

export default function RabbitHoleScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { sparkId, seedTitle, seedBody, seedInterest } = useLocalSearchParams<{
    sparkId?: string;
    seedTitle?: string;
    seedBody?: string;
    seedInterest?: string;
  }>();
  const userId = useUserStore((s) => s.userId);
  const addXP = useGameStore((s) => s.addXP);

  // Anchor source: an inline seed (e.g. a "Chasing now" thread) takes
  // precedence; otherwise fall back to today's spark row. sparkId is mainly
  // for telemetry/audit.
  const today = format(new Date(), 'yyyy-MM-dd');
  const inlineAnchor = seedTitle
    ? {
        title: seedTitle,
        body: seedBody ?? '',
        threadStarter: seedTitle,
        seedInterest: seedInterest ?? '',
        adjacentField: '',
      }
    : undefined;
  const anchorSpark = inlineAnchor ?? (userId ? getSparkByDate(userId, today) : undefined);

  const [thread, setThread] = useState<ThreadNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the thread with the spark's threadStarter as node 0.
  useEffect(() => {
    if (!anchorSpark || thread.length > 0) return;
    setThread([{
      title: anchorSpark.title,
      body: anchorSpark.body,
      goDeeperHint: anchorSpark.threadStarter,
      goSidewaysHint: anchorSpark.adjacentField
        ? `connect to ${anchorSpark.adjacentField}`
        : 'an adjacent field',
      arrivedVia: null,
    }]);
  }, [anchorSpark, thread.length]);

  const current = thread[thread.length - 1];

  const advance = useCallback(async (direction: RabbitHoleDirection) => {
    if (!current || !anchorSpark) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError(null);
    try {
      const params = {
        parent: { title: current.title, body: current.body },
        anchor: {
          title: anchorSpark.title,
          seedInterest: anchorSpark.seedInterest,
          adjacentField: anchorSpark.adjacentField,
        },
        direction,
      };
      // Agentic path grounds the node in the user's real exploration history;
      // single-shot is the fallback when the flag is off (or no userId).
      const next = isEnabled('exploreAgenticThread') && userId
        ? await exploreThreadNode({ ...params, userId })
        : await generateRabbitHoleNode(params);
      setThread((prev) => [...prev, { ...next, arrivedVia: direction }]);
      if (userId) addXP(userId, Math.round(XP_VALUES.completeGoalTask / 2));
      track(EVENTS.sparkThreadPulled, { direction, depth: thread.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the next node.');
    } finally {
      setLoading(false);
    }
  }, [current, anchorSpark, userId, addXP, thread.length]);

  const goBack = useCallback(() => {
    if (thread.length <= 1) {
      router.back();
      return;
    }
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setThread((prev) => prev.slice(0, -1));
  }, [thread.length, router]);

  const handleDone = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    track(EVENTS.sparkThreadPulled, { final: true, depth: thread.length - 1 });
    router.back();
  }, [thread.length, router]);

  if (!anchorSpark) {
    return (
      <SafeAreaView style={styles.empty}>
        <Body style={{ color: c.textMuted }}>No spark found.</Body>
        <Button title="Back" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </SafeAreaView>
    );
  }

  const depth = thread.length - 1;
  const hitCap = depth >= MAX_DEPTH;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AuroraBackground />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
            </Pressable>
            <Label color={c.polymath} style={styles.eyebrow}>RABBIT HOLE · DEPTH {depth}</Label>
            <Pressable onPress={handleDone} hitSlop={8} style={styles.doneBtn}>
              <Caption style={{ color: c.textMuted, fontFamily: fonts.heading }}>Done</Caption>
            </Pressable>
          </View>

          {/* Anchor breadcrumb — keeps the user oriented in their wandering. */}
          <Caption style={[styles.anchor, { color: c.textMuted }]} numberOfLines={1}>
            From: {anchorSpark.title}
          </Caption>

          {current && (
            <Animated.View entering={FadeInDown.duration(280)} key={depth}>
              <Card style={[styles.nodeCard, { borderLeftWidth: 4, borderLeftColor: c.polymath }]}>
                {current.arrivedVia && (
                  <Caption style={{ color: c.polymath, fontFamily: fonts.heading, letterSpacing: 0.5 }}>
                    {current.arrivedVia === 'deeper' ? '↓ DEEPER' : '↻ SIDEWAYS'}
                  </Caption>
                )}
                <Heading style={styles.title}>{current.title}</Heading>
                <Body style={styles.body}>{current.body}</Body>
              </Card>
            </Animated.View>
          )}

          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator color={c.polymath} />
              <Body style={{ color: c.textSecondary, marginTop: spacing.sm }}>Pulling the next thread…</Body>
            </View>
          )}

          {error && !loading && (
            <Card style={[styles.errorCard, { borderColor: c.error }]}>
              <Body style={{ color: c.error }}>{error}</Body>
              <Button title="Retry" variant="secondary" onPress={() => current && advance('deeper')} style={{ marginTop: spacing.sm }} />
            </Card>
          )}

          {!loading && !error && current && !hitCap && (
            <Animated.View entering={FadeIn.duration(360)} style={styles.choices}>
              <Pressable onPress={() => advance('deeper')} style={[styles.choice, { borderColor: c.polymath, backgroundColor: c.polymath + '14' }]}>
                <Ionicons name="arrow-down-circle-outline" size={20} color={c.polymath} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Caption style={{ color: c.polymath, fontFamily: fonts.heading, letterSpacing: 0.5 }}>GO DEEPER</Caption>
                  <Body style={{ color: c.textPrimary }}>{current.goDeeperHint}</Body>
                </View>
              </Pressable>
              <Pressable onPress={() => advance('sideways')} style={[styles.choice, { borderColor: c.border }]}>
                <Ionicons name="git-branch-outline" size={20} color={c.textSecondary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Caption style={{ color: c.textSecondary, fontFamily: fonts.heading, letterSpacing: 0.5 }}>BRANCH SIDEWAYS</Caption>
                  <Body style={{ color: c.textPrimary }}>{current.goSidewaysHint}</Body>
                </View>
              </Pressable>
            </Animated.View>
          )}

          {hitCap && (
            <Card style={[styles.errorCard, { borderColor: c.warning }]}>
              <Body style={{ color: c.textPrimary }}>
                You've gone {depth} levels deep — a satisfying rabbit hole. Wrap up here?
              </Body>
              <Button title="Done" onPress={handleDone} style={{ marginTop: spacing.sm }} />
            </Card>
          )}

          {thread.length > 1 && !loading && (
            <View style={styles.trail}>
              <Label color={c.textMuted}>BREADCRUMB</Label>
              {thread.slice(0, -1).map((n, i) => (
                <Body key={i} style={[styles.trailItem, { color: c.textMuted }]} numberOfLines={1}>
                  {i + 1}. {n.title}
                </Body>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  backBtn: { padding: 4 },
  doneBtn: { padding: 4 },
  eyebrow: { letterSpacing: 1 },
  anchor: { fontSize: fontSizes.xs },
  nodeCard: { gap: spacing.sm },
  title: { fontSize: fontSizes.xl, color: c.textPrimary },
  body: { color: c.textPrimary, fontSize: fontSizes.md, lineHeight: 22 },
  loading: { alignItems: 'center', paddingVertical: spacing.xl },
  errorCard: { borderWidth: 1, padding: spacing.md, borderRadius: 16 },
  choices: { gap: spacing.sm },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderWidth: 1, borderRadius: 16,
  },
  trail: { gap: 4, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border },
  trailItem: { fontSize: fontSizes.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
});
