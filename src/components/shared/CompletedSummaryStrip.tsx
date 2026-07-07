import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Caption } from '@/components/ui/Typography';
import { formatStripDuration } from '@/utils/todayCollapse';

/**
 * One-line summary strip for a run of finished routine blocks on Today —
 * "✓ 4 done · 1 skipped · 2h 35m". Tapping toggles the run open in place
 * (the strip stays as the collapse handle; blocks render beneath it).
 *
 * Flag `today_collapse_done_v1`; segmentation lives in utils/todayCollapse.
 * Neutral ink surface per the manifesto — finished work rests quiet.
 */
export function CompletedSummaryStrip({
  doneCount,
  skippedCount,
  totalMinutes,
  expanded,
  onToggle,
}: {
  doneCount: number;
  skippedCount: number;
  totalMinutes: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = useColors();
  const styles = makeStyles(c);
  const parts: string[] = [];
  if (doneCount > 0) parts.push(`${doneCount} done`);
  if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
  parts.push(formatStripDuration(totalMinutes));
  const summary = parts.join(' · ');

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.strip, pressed && { backgroundColor: c.surfaceAlt }]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${summary}. ${expanded ? 'Collapse' : 'Expand'} finished blocks`}
      testID="completed-summary-strip"
    >
      <Ionicons name="checkmark-done" size={16} color={c.success} />
      <Caption style={styles.text}>{summary}</Caption>
      <View style={styles.spacer} />
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={c.textMuted} />
    </Pressable>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      marginBottom: spacing.sm,
      backgroundColor: 'transparent',
    },
    text: {
      color: c.textSecondary,
      fontFamily: fonts.heading,
      fontSize: fontSizes.sm,
    },
    spacer: { flex: 1 },
  });
