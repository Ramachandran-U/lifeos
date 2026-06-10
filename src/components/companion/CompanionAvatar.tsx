import { Pressable, StyleSheet } from 'react-native';
import { Companion } from './Companion';
import { useCompanionStore } from '@/store/useCompanionStore';
import { haptic } from '@/utils/haptics';
import { track, EVENTS } from '@/utils/telemetry';

interface Props {
  onPress: () => void;
  size?: number;
}

// Today-header companion (R3). Small and non-blocking by design — it sits
// beside the greeting, never gates a flow, and tapping it opens the sheet.
// Call sites gate on companion_v1 + gamification !== 'off'.
export function CompanionAvatar({ onPress, size = 44 }: Props) {
  const mood = useCompanionStore((s) => s.mood);
  const identity = useCompanionStore((s) => s.identity);

  const handlePress = () => {
    haptic.selection();
    track(EVENTS.companionTapped, { mood, named: identity !== null });
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={
        identity ? `${identity.name} your companion — ${mood}. Tap to visit.` : 'Meet your companion'
      }
      style={styles.wrap}
      hitSlop={8}
    >
      <Companion mood={mood} size={size} equipped={identity?.equipped ?? []} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
