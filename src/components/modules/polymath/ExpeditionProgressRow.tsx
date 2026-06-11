import { View, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';
import { PressableScale } from '@/components/ui/PressableScale';
import { progressFraction, type Expedition, type ExpeditionProgress } from '@/explore/expeditions';

interface Props {
  expeditions: Array<{ expedition: Expedition; progress: ExpeditionProgress }>;
  onPress: (expeditionId: string) => void;
}

export function ExpeditionProgressRow({ expeditions, onPress }: Props) {
  const c = useColors();
  const styles = makeStyles(c);

  if (expeditions.length === 0) return null;

  return (
    // Ink + Signal §3.0.7: the ACTIVE EXPEDITIONS caps eyebrow died in the W4
    // Explore sweep (2026-06-12) — the screen renders the `Expeditions`
    // SectionTitle above this row instead.
    <View style={styles.section}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {expeditions.map(({ expedition: e, progress: p }) => {
          const frac = progressFraction(p, e.totalSteps);
          const pct = Math.round(frac * 100);
          return (
            <PressableScale
              key={e.id}
              onPress={() => onPress(e.id)}
              accessibilityRole="button"
              accessibilityLabel={`${e.title}, ${pct}% complete`}
              style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="compass" size={18} color={c.polymath} />
                <Caption style={{ color: c.polymath, fontFamily: fonts.heading }}>{pct}%</Caption>
              </View>
              <Body style={styles.cardTitle} numberOfLines={2}>{e.title}</Body>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.polymath }]} />
              </View>
              <Caption style={{ color: c.textMuted }}>
                {p.completedSteps.length}/{e.totalSteps} steps
              </Caption>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  section: { gap: spacing.xs },
  row: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  card: {
    width: 180, borderRadius: 16, borderWidth: 1, padding: spacing.md, gap: spacing.xs,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.heading, fontSize: fontSizes.md, color: c.textPrimary },
  bar: { height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
});
