import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Heading, Label } from '@/components/ui/Typography';
import type { Spark, SparkStatus } from '@/explore/spark';

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

export function SparkHeroCard({ spark, onAction }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const acted = spark.status !== 'new' && spark.status !== 'seen';

  const handleAction = (action: Parameters<Props['onAction']>[0]) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAction(action);
  };

  return (
    // Neutral card — the polymath ink lives in the eyebrow (R2).
    <Card style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="sparkles" size={16} color={c.polymathText} />
        <Label color={c.polymathText}>TODAY'S SPARK</Label>
      </View>
      <Heading style={styles.title}>{spark.title}</Heading>
      <Body style={styles.body}>{spark.body}</Body>
      <View style={[styles.threadBox, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Caption style={{ color: c.textMuted, fontFamily: fonts.heading, letterSpacing: 0.5 }}>PULL THE THREAD</Caption>
        <Body style={{ color: c.textPrimary, marginTop: 2 }}>{spark.threadStarter}</Body>
      </View>
      {spark.seedInterest ? (
        <Caption style={{ color: c.textMuted }}>
          From <Caption style={{ fontFamily: fonts.heading, color: c.polymathText }}>{spark.seedInterest}</Caption>
          {spark.adjacentField ? ` → ${spark.adjacentField}` : ''}
        </Caption>
      ) : null}
      {!acted && (
        <View style={styles.actions}>
          {ACTIONS.map((a) => (
            <Pressable key={a.key} onPress={() => handleAction(a.key)} style={[styles.actionBtn, { borderColor: c.border }]}>
              <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={16} color={a.key === 'dismiss' ? c.textMuted : c.polymathText} />
              <Caption style={{ color: a.key === 'dismiss' ? c.textMuted : c.textPrimary, fontFamily: fonts.heading }}>{a.label}</Caption>
            </Pressable>
          ))}
        </View>
      )}
      {acted && (
        <Caption style={{ color: c.success, fontFamily: fonts.heading, marginTop: spacing.xs }}>
          {spark.status === 'saved' && 'Saved to your constellation.'}
          {spark.status === 'explored' && 'Thread pulled — explore deeper.'}
          {spark.status === 'dismissed' && 'Skipped.'}
        </Caption>
      )}
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: fontSizes.xl, color: c.textPrimary },
  body: { color: c.textPrimary, fontSize: fontSizes.md, lineHeight: 22 },
  threadBox: { borderWidth: 1, borderRadius: 12, padding: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.xs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1,
  },
});
