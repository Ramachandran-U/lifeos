import { View, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Caption } from '@/components/ui/Typography';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { createHealthLog } from '@/db/queries/health';

const WATER_BLUE = '#4DA3FF';
const INCREMENTS = [250, 500];

interface WaterCardProps {
  totalMl: number;
  goalMl: number;
  onLogged: () => void;
}

/** Daily hydration tracker. Each tap logs a `waterMl` increment to health_logs;
 *  the parent sums the day's rows for the total. */
export function WaterCard({ totalMl, goalMl, onLogged }: WaterCardProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const pct = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;

  const add = (ml: number) => {
    createHealthLog({ date: format(new Date(), 'yyyy-MM-dd'), waterMl: ml });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLogged();
  };

  const undo = () => {
    if (totalMl <= 0) return;
    // Log a negative increment to correct an over-count (sum-based total).
    createHealthLog({ date: format(new Date(), 'yyyy-MM-dd'), waterMl: -Math.min(250, totalMl) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLogged();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="water-outline" size={18} color={WATER_BLUE} />
        <SectionLabel color={WATER_BLUE}>HYDRATION</SectionLabel>
      </View>

      <View style={styles.row}>
        <Body style={styles.total}>
          {(totalMl / 1000).toFixed(totalMl % 1000 === 0 ? 0 : 1)}
          <Caption style={{ color: c.textSecondary }}> / {(goalMl / 1000).toFixed(1)} L</Caption>
        </Body>
        {totalMl > 0 && (
          <Pressable onPress={undo} hitSlop={6} accessibilityRole="button" accessibilityLabel="Undo last water">
            <Caption style={{ color: c.textMuted }}>Undo</Caption>
          </Pressable>
        )}
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: WATER_BLUE }]} />
      </View>

      <View style={styles.actions}>
        {INCREMENTS.map((ml) => (
          <Pressable
            key={ml}
            onPress={() => add(ml)}
            style={[styles.addBtn, { borderColor: WATER_BLUE }]}
            accessibilityRole="button"
            accessibilityLabel={`Add ${ml} millilitres of water`}
          >
            <Ionicons name="add" size={14} color={WATER_BLUE} />
            <Caption style={{ color: WATER_BLUE, fontFamily: fonts.bodyMedium }}>{ml} ml</Caption>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontFamily: fonts.display, fontSize: fontSizes.xl },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});
