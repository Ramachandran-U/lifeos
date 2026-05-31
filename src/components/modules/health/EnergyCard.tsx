import { View, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Caption } from '@/components/ui/Typography';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { createHealthLog } from '@/db/queries/health';

const LEVELS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😴', label: 'Drained' },
  { value: 2, emoji: '🙁', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '⚡', label: 'Charged' },
];

interface EnergyCardProps {
  current: number | null;
  onLogged: () => void;
}

/** One-tap daily energy check-in (1-5). Persists to health_logs.energyLevel —
 *  the column existed but had no UI. Feeds future cross-domain correlations. */
export function EnergyCard({ current, onLogged }: EnergyCardProps) {
  const c = useColors();
  const styles = makeStyles(c);

  const select = (value: number) => {
    createHealthLog({ date: format(new Date(), 'yyyy-MM-dd'), energyLevel: value });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLogged();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <SectionLabel color={c.health}>ENERGY TODAY</SectionLabel>
        {current != null && (
          <Caption style={{ color: c.textSecondary }}>{LEVELS[current - 1]?.label}</Caption>
        )}
      </View>
      <View style={styles.row}>
        {LEVELS.map((l) => {
          const active = current === l.value;
          return (
            <Pressable
              key={l.value}
              onPress={() => select(l.value)}
              style={[styles.level, active && { backgroundColor: c.health, borderColor: c.health }]}
              accessibilityRole="button"
              accessibilityLabel={`Energy ${l.label}`}
            >
              <Caption style={styles.emoji}>{l.emoji}</Caption>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  level: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { fontSize: 22, fontFamily: fonts.body },
});
