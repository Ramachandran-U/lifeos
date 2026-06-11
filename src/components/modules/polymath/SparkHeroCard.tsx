import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Text } from '@/components/ui/Text';
import { Body, Caption } from '@/components/ui/Typography';
import type { Spark } from '@/explore/spark';

interface Props {
  spark: Spark;
  onAction: (action: 'save' | 'dismiss' | 'pull_thread' | 'start_expedition') => void;
}

const ACTIONS: Array<{ key: Parameters<Props['onAction']>[0]; icon: string; label: string }> = [
  { key: 'save', icon: 'bookmark-outline', label: 'Save' },
  { key: 'pull_thread', icon: 'git-branch-outline', label: 'Pull thread' },
  { key: 'start_expedition', icon: 'compass-outline', label: 'Expedition' },
  { key: 'dismiss', icon: 'close-circle-outline', label: 'Skip' },
];

// THE Explore hero (Ink + Signal §3.2). Restyled in the W4 Explore PR
// (2026-06-12): the TODAY'S SPARK / PULL THE THREAD caps eyebrows died, the
// Card wrapper dropped to type-on-background with a 4px polymath left border
// (structural color, R9), the title became an h1, the threadStarter reads as a
// quote block, and Pull thread is the filled primary action.
export function SparkHeroCard({ spark, onAction }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const acted = spark.status !== 'new' && spark.status !== 'seen';

  const handleAction = (action: Parameters<Props['onAction']>[0]) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAction(action);
  };

  return (
    // 4px polymath left border on the screen background — no Card chrome.
    <View style={[styles.root, { borderLeftColor: c.polymath }]}>
      <Text variant="h1">{spark.title}</Text>
      <Body style={styles.body}>{spark.body}</Body>
      {/* The thread starter as a quote block — 2px polymath rail, no inner box. */}
      <View style={[styles.quote, { borderLeftColor: c.polymath }]}>
        <Body style={{ color: c.textPrimary }}>{spark.threadStarter}</Body>
      </View>
      {spark.seedInterest ? (
        <Caption style={{ color: c.textMuted }}>
          From <Caption style={{ fontFamily: fonts.heading, color: c.polymathText }}>{spark.seedInterest}</Caption>
          {spark.adjacentField ? ` → ${spark.adjacentField}` : ''}
        </Caption>
      ) : null}
      {!acted && (
        <View style={styles.actions}>
          {ACTIONS.map((a) => {
            const primary = a.key === 'pull_thread';
            return (
              <Pressable
                key={a.key}
                onPress={() => handleAction(a.key)}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={[
                  styles.actionBtn,
                  primary
                    ? { backgroundColor: c.polymath }
                    : { borderColor: c.border, borderWidth: 1 },
                ]}
              >
                <Ionicons
                  name={a.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={primary ? c.inkOnColor : a.key === 'dismiss' ? c.textMuted : c.polymathText}
                />
                <Caption
                  style={{
                    color: primary ? c.inkOnColor : a.key === 'dismiss' ? c.textMuted : c.textPrimary,
                    fontFamily: fonts.heading,
                  }}
                >
                  {a.label}
                </Caption>
              </Pressable>
            );
          })}
        </View>
      )}
      {acted && (
        <Caption style={{ color: c.success, fontFamily: fonts.heading, marginTop: spacing.xs }}>
          {spark.status === 'saved' && 'Saved to your constellation.'}
          {spark.status === 'explored' && 'Thread pulled — explore deeper.'}
          {spark.status === 'dismissed' && 'Skipped.'}
        </Caption>
      )}
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  root: {
    gap: spacing.sm,
    borderLeftWidth: 4,
    paddingLeft: spacing.md,
  },
  body: { color: c.textPrimary, fontSize: fontSizes.md, lineHeight: 22 },
  quote: { borderLeftWidth: 2, paddingLeft: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.xs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: radii.pill,
  },
});
