/**
 * HeroStreaksPanel — the Streaks slide of the Today hero carousel.
 *
 * Folds the old stacked "STREAKS" rail into a single tactile panel: the
 * flagship (longest-running) streak gets a large animated flame + its march
 * toward the 30-day badge, and the remaining live streaks sit as compact
 * domain-tinted chips. Neutral ink surface, headline-led (Manifesto P5 — no
 * caps eyebrow); streak ember + domain hues carry the signal, never violet.
 *
 * Presentation only — counts come from useGameStore upstream; tapping the
 * panel opens the full streak ledger (Rewards) via `onPress`.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { usePressScale } from '@/hooks/usePressScale';
import { STREAK_META, type StreakKey } from '@/constants/gamification';
import { Text as AuroraText } from '@/components/ui/Text';
import { StreakFlame } from '@/components/gamification/StreakFlame';
import { XpBar } from '@/components/gamification/XpBar';

export interface HeroStreak {
  key: StreakKey;
  count: number;
  graceUsed: boolean;
}

interface HeroStreaksPanelProps {
  /** Active streaks (count > 0), already sorted longest-first. */
  streaks: HeroStreak[];
  /** Opens the full streak ledger (Rewards). */
  onPress?: () => void;
}

const BADGE_TARGET = 30;

export function HeroStreaksPanel({ streaks, onPress }: HeroStreaksPanelProps) {
  const c = useColors();
  const press = usePressScale(0.98);

  const top = streaks[0];
  const others = streaks.slice(1);
  if (!top) return null;

  const topMeta = STREAK_META[top.key];
  const topColor = c[topMeta.colorKey];
  const badgeCaption =
    top.count >= BADGE_TARGET
      ? '30-day badge earned'
      : `${BADGE_TARGET - top.count} days to a 30-day badge`;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={styles.pressable}
    >
      <Animated.View style={[styles.card, { backgroundColor: c.surfaceAlt }, press.animatedStyle]}>
        <View style={styles.headerRow}>
          <AuroraText variant="h3">Streaks</AuroraText>
          <AuroraText variant="caption" secondary numeric>
            {`${streaks.length} active`}
          </AuroraText>
        </View>

        <View style={styles.flagship}>
          <View style={styles.flagshipHead}>
            <StreakFlame count={top.count} graceUsed={top.graceUsed} size="lg" />
            <View style={styles.flagshipLabel}>
              <AuroraText variant="bodyLg" color={topColor}>
                {topMeta.label}
              </AuroraText>
              <AuroraText variant="caption" secondary>
                day streak
              </AuroraText>
            </View>
          </View>
          <XpBar pct={Math.min(top.count / BADGE_TARGET, 1)} color={topColor} height={6} />
          <AuroraText variant="caption" muted>
            {badgeCaption}
          </AuroraText>
        </View>

        {others.length > 0 ? (
          <View style={styles.chips}>
            {others.map((s) => {
              const meta = STREAK_META[s.key];
              return (
                <View key={s.key} style={[styles.chip, { backgroundColor: c.card }]}>
                  <Text style={styles.chipEmoji}>{meta.emoji}</Text>
                  <AuroraText variant="caption" color={c[meta.colorKey]} numeric>
                    {s.count}
                  </AuroraText>
                </View>
              );
            })}
          </View>
        ) : (
          <AuroraText variant="caption" muted>
            One going strong — start another today.
          </AuroraText>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  flagship: {
    gap: spacing.sm,
  },
  flagshipHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flagshipLabel: {
    flex: 1,
    gap: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.control,
  },
  chipEmoji: {
    fontSize: 16,
  },
});
