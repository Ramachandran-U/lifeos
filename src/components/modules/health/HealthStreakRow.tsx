import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes, TABULAR_NUMS } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body } from '@/components/ui/Typography';
import { usePreferencesStore } from '@/store/usePreferencesStore';

interface HealthStreakRowProps {
  /** Sentence-case row label, e.g. "Food log streak" / "Workout streak". */
  label: string;
  days: number;
}

/**
 * Ink + Signal §3.1 item 1 / §3.0.5 zero-suppression: a streak row renders
 * ONLY when the streak is alive (n > 0) AND gamification visibility is on.
 * A zero never renders as a surface — at zero the slot disappears (the meal /
 * workout logging actions are what start the streak). Enforced here so the
 * AC8 unit test binds to the component, not the screen.
 */
export function HealthStreakRow({ label, days }: HealthStreakRowProps) {
  const c = useColors();
  const gamification = usePreferencesStore((s) => s.gamification);

  if (days <= 0 || gamification === 'off') return null;

  return (
    <View style={[styles.row, { borderTopColor: c.border }]}>
      {/* §3.1's committed copy, one line: `Food log streak · {n} days`. */}
      <Body style={styles.label}>{`${label} · ${days} days`}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    ...TABULAR_NUMS,
  },
});
