import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Caption } from '@/components/ui/Typography';
import { useOnboardingNarration } from '@/hooks/useOnboardingNarration';
import { usePreferencesStore } from '@/store/usePreferencesStore';

interface NarrationToggleProps {
  scriptId: string;
}

// Small floating control rendered on onboarding screens that have bundled
// narration. Hidden entirely when no MP3 ships for the given scriptId, so
// pre-asset builds look identical to today.
export function NarrationToggle({ scriptId }: NarrationToggleProps) {
  const c = useColors();
  const { isPlaying, isAvailable, toggle } = useOnboardingNarration(scriptId);
  const narrationEnabled = usePreferencesStore((s) => s.narrationEnabled);
  const toggleNarrationPref = usePreferencesStore((s) => s.toggleNarration);

  if (!isAvailable) return null;

  const handlePress = async () => {
    if (!narrationEnabled) {
      toggleNarrationPref();
      return;
    }
    await toggle();
  };

  const icon = !narrationEnabled ? 'volume-mute' : isPlaying ? 'pause' : 'volume-high';

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      testID={`narration-toggle-${scriptId}`}
      style={[styles.container, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <Ionicons name={icon} size={16} color={c.primary} />
      <View>
        <Caption color={c.textSecondary}>
          {!narrationEnabled ? 'Tap to enable voice' : isPlaying ? 'Speaking…' : 'Replay'}
        </Caption>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
});
