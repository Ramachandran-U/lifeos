import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from '@/components/ui/Text';
import { Button3D } from '@/components/ui/Button3D';
import type { RecoveryBand } from '@/utils/recovery';

interface HealthPulseHeroProps {
  kcalLeft: number | null;
  kcalEaten: number;
  kcalTarget: number;
  proteinLeftG: number | null;
  readiness: { score: number; hasData: boolean; band: RecoveryBand };
  hasBaseline: boolean;
  onLogMeal: () => void;
  onAddVitals: () => void;
}

/**
 * THE Health hero (Ink + Signal §3.1): the day's energy budget in display type
 * on health green — not a vitals table. Three states:
 *  - populated: kcal remaining + protein/eaten/readiness metadata + `Log a meal`
 *  - over-target (kcalLeft <= 0): compassion state — kcal logged, target
 *    reached; no red, no deficit math, no "over" copy
 *  - empty (no baseline): the invitation to add height & weight
 *
 * Chrome: type on the screen background behind a 4px `c.health` left border
 * (structural color, R9) — no Card. Display numerals render in `c.healthText`
 * in BOTH themes (ratified amendment R4, supersedes §3.0.6's per-mode rule).
 * No idle motion lives here — the screen owns the one hero-budget entry.
 */
export function HealthPulseHero({
  kcalLeft,
  kcalEaten,
  kcalTarget,
  proteinLeftG,
  readiness,
  hasBaseline,
  onLogMeal,
  onAddVitals,
}: HealthPulseHeroProps) {
  const c = useColors();

  if (!hasBaseline) {
    return (
      <View style={[styles.root, { borderLeftColor: c.health }]}>
        <Text variant="h1">Start with a baseline.</Text>
        <Text variant="body" color={c.textSecondary}>
          Height and weight unlock BMI, calorie targets, and recovery-aware planning. They stay on
          this device.
        </Text>
        <Button3D
          title="Add height & weight"
          tone="health"
          fullWidth
          onPress={onAddVitals}
          style={styles.cta}
        />
      </View>
    );
  }

  const left = kcalLeft ?? 0;
  const overTarget = left <= 0;
  const proteinFragment = proteinLeftG != null ? `Protein ${proteinLeftG} g to go` : null;

  const metaLine = overTarget
    ? [`Target ${kcalTarget.toLocaleString()} reached`, proteinFragment]
        .filter((part): part is string => part != null)
        .join(' · ')
    : [
        proteinFragment,
        `${kcalEaten.toLocaleString()} kcal eaten`,
        readiness.hasData ? `Readiness ${readiness.score}` : null,
      ]
        .filter((part): part is string => part != null)
        .join(' · ');

  return (
    <View style={[styles.root, { borderLeftColor: c.health }]}>
      <Text variant="display" numeric color={c.healthText}>
        {(overTarget ? kcalEaten : left).toLocaleString()}
      </Text>
      <Text variant="h3" color={c.textPrimary}>
        {overTarget ? 'kcal logged today' : 'kcal left today'}
      </Text>
      <Text variant="caption" color={c.textSecondary} numeric>
        {metaLine}
      </Text>
      <Button3D title="Log a meal" tone="health" fullWidth onPress={onLogMeal} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderLeftWidth: 4,
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  cta: {
    marginTop: spacing.sm,
  },
});
