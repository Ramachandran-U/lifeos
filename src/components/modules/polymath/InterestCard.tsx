import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
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
  const ratio = progressRatio(weeklyActual, interest.weeklyMinutesTarget);
  const pct = Math.min(1, ratio);
  const iconName = CATEGORY_ICON[interest.category] ?? 'sparkles';

  return (
    <Card moduleColor={colors.polymath} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name={iconName} size={20} color={colors.polymath} />
          <Body style={styles.title}>{interest.name}</Body>
        </View>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
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
          <Ionicons name="add" size={16} color={colors.polymath} />
          <Label color={colors.polymath}>Log</Label>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
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
