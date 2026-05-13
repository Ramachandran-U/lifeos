import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { progressRatio } from '@/utils/polymath';
import type { Interest } from '@/db/queries/interests';

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  arts: 'color-palette',
  science: 'flask',
  tech: 'hardware-chip',
  sports: 'bicycle',
  music: 'musical-notes',
  writing: 'create',
  language: 'language',
  philosophy: 'book',
  other: 'sparkles',
};

interface Props {
  interest: Interest;
  weeklyActual: number;
  onLog: () => void;
  onDelete: () => void;
}

export function InterestCard({ interest, weeklyActual, onLog, onDelete }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const ratio = progressRatio(weeklyActual, interest.weeklyMinutesTarget);
  const pct = Math.min(1, ratio);
  const iconName = CATEGORY_ICON[interest.category] ?? 'sparkles';

  return (
    <Card moduleColor={c.polymath} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name={iconName} size={20} color={c.polymath} />
          <Body style={styles.title}>{interest.name}</Body>
        </View>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>

      <Caption style={styles.meta}>
        {interest.category.toUpperCase()} · {interest.explorationDepth}
      </Caption>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={styles.progressRow}>
        <Label>{weeklyActual} / {interest.weeklyMinutesTarget} min this week</Label>
        <Pressable onPress={onLog} style={styles.logButton}>
          <Ionicons name="add" size={16} color={c.polymath} />
          <Label color={c.polymath}>Log</Label>
        </Pressable>
      </View>
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
  },
  meta: {
    color: colors.textMuted,
    letterSpacing: 1,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.polymath,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.polymathLight,
  },
});
