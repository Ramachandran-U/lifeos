import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Caption } from '@/components/ui/Typography';
import type { UseNarrationResult } from '@/hooks/useNarration';

interface NarrationToggleProps {
  narration: UseNarrationResult;
}

/**
 * Floating narration controls rendered on onboarding screens.
 * Shows the mute/unmute chip and a Skip button (while narration is active
 * and not all cards have been revealed yet).
 *
 * The component is a thin view over UseNarrationResult — all logic lives
 * in the hook, keeping this purely presentational.
 */
export function NarrationToggle({ narration }: NarrationToggleProps) {
  const c = useColors();
  const { isPlaying, isAvailable, isMuted, allCardsRevealed, toggle, skip } = narration;

  if (!isAvailable) return null;

  const icon: React.ComponentProps<typeof Ionicons>['name'] = isMuted
    ? 'volume-mute'
    : isPlaying
      ? 'pause'
      : 'volume-high';

  const label = isMuted ? 'Tap to narrate' : isPlaying ? 'Speaking…' : 'Replay';

  const showSkip = !isMuted && !allCardsRevealed;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? 'Unmute narration' : 'Mute narration'}
        testID="narration-toggle"
        style={[styles.chip, { backgroundColor: c.card, borderColor: c.border }]}
      >
        <Ionicons name={icon} size={16} color={c.primary} />
        <Caption color={c.textSecondary}>{label}</Caption>
      </Pressable>

      {showSkip && (
        <Pressable
          onPress={skip}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Skip narration"
          testID="narration-skip"
          style={[styles.chip, { backgroundColor: c.card, borderColor: c.border }]}
        >
          <Caption color={c.textSecondary}>Skip</Caption>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
});
