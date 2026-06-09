import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { TIMING } from '@/theme/motion';
import { Caption, Label } from '@/components/ui/Typography';
import { ONBOARDING_SCRIPTS } from '@/integrations/elevenlabs/scripts';

const SCRIPT_MAP = Object.fromEntries(ONBOARDING_SCRIPTS.map((s) => [s.id, s]));

interface OnboardingIntroSectionProps {
  scriptId: string;
  revealedCards: ReadonlySet<string>;
  accentColor?: string;
}

/**
 * Renders the subset of a script's intro cards that have been cued so far.
 * Cards fade+slide in one by one as `revealedCards` grows (driven by
 * `useNarration`). When `skip()` is called on the hook, all cards are
 * revealed at once.
 */
export function OnboardingIntroSection({
  scriptId,
  revealedCards,
  accentColor,
}: OnboardingIntroSectionProps) {
  const c = useColors();
  const script = SCRIPT_MAP[scriptId];
  if (!script) return null;

  const visible = script.introCards.filter((card) => revealedCards.has(card.id));
  if (visible.length === 0) return null;

  return (
    <View style={styles.container}>
      {visible.map((card) => (
        <Animated.View
          key={card.id}
          entering={FadeInDown.duration(TIMING.normal)}
        >
          <View
            style={[
              styles.card,
              {
                borderLeftColor: accentColor ?? c.primary,
                backgroundColor: c.card,
                borderColor: c.border,
              },
            ]}
          >
            <View style={styles.iconRow}>
              <Ionicons
                name={card.icon as React.ComponentProps<typeof Ionicons>['name']}
                size={16}
                color={accentColor ?? c.primary}
              />
              <Label style={[styles.title, { color: c.textPrimary }]}>{card.title}</Label>
            </View>
            <Caption style={{ color: c.textSecondary }}>{card.body}</Caption>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    borderLeftWidth: 3,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
  },
});
