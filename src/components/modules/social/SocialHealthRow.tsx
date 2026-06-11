import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes, TABULAR_NUMS } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body } from '@/components/ui/Typography';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface SocialHealthRowProps {
  /** computeSocialScore result — null with zero contacts. */
  score: number | null;
}

/**
 * Ink + Signal §3.4 item 3: the social score demoted from SocialScoreCard to a
 * single stat ROW — `Social health` + mono `{score} /100` + a 4px solid
 * `c.social` fill on `c.track` (R3: no gradients). Per §3.0.5 zero-suppression
 * it renders NOTHING at null or 0 — at zero the `Reach out` rows are the
 * action that moves it. Enforced here so the AC8 unit test binds to the
 * component, not the screen.
 */
export function SocialHealthRow({ score }: SocialHealthRowProps) {
  const c = useColors();

  if (score == null || score <= 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Body style={styles.label}>Social health</Body>
        <Body style={[styles.value, { color: c.textSecondary }]}>{`${score} /100`}</Body>
      </View>
      <ProgressBar value={score} color={c.social} height={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.bodyMedium,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    ...TABULAR_NUMS,
  },
});
