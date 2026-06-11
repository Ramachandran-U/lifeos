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

const DEPTH_LABEL: Record<string, string> = {
  taste: 'Taste',
  hobbyist: 'Hobbyist',
  deep_dive: 'Deep dive',
};

interface Props {
  interest: Interest;
  weeklyActual: number;
  onLog: () => void;
  onDelete: () => void;
  onEditDepth: () => void;
  onToggleProtect: () => void;
}

export function InterestCard({
  interest,
  weeklyActual,
  onLog,
  onDelete,
  onEditDepth,
  onToggleProtect,
}: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const ratio = progressRatio(weeklyActual, interest.weeklyMinutesTarget);
  const pct = Math.min(1, ratio);
  const iconName = CATEGORY_ICON[interest.category] ?? 'sparkles';
  const protectedOn = !!interest.timeProtected;

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

      <View style={styles.pillsRow}>
        <Caption style={styles.categoryMeta}>{interest.category.toUpperCase()}</Caption>

        <Pressable
          onPress={onEditDepth}
          style={[styles.pill, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Caption style={{ color: c.textSecondary }}>
            {DEPTH_LABEL[interest.explorationDepth] ?? interest.explorationDepth}
          </Caption>
          <Ionicons name="chevron-down" size={12} color={c.textMuted} />
        </Pressable>

        <Pressable
          onPress={onToggleProtect}
          style={[
            styles.pill,
            {
              backgroundColor: protectedOn ? c.polymathDim : c.surface,
              borderColor: protectedOn ? c.polymath : c.border,
            },
          ]}
        >
          <Ionicons
            name={protectedOn ? 'lock-closed' : 'lock-open'}
            size={12}
            color={protectedOn ? c.polymath : c.textMuted}
          />
          <Caption style={{ color: protectedOn ? c.polymath : c.textSecondary }}>
            {protectedOn ? 'Protected' : 'Protect time'}
          </Caption>
        </Pressable>
      </View>

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
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryMeta: {
    color: colors.textMuted,
    letterSpacing: 1,
    marginRight: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
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
    backgroundColor: colors.polymathDim,
  },
});
