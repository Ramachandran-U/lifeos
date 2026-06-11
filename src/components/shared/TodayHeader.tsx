/**
 * Today's chrome — two compact decks, ~104px total
 * (docs/design-deep-dive/01-today-hero.md §3.1).
 *
 * Deck 1 is the utility row (avatar → profile, spacer, companion, voice mic);
 * deck 2 is the greeting block (h1 greeting that never wraps + date line).
 * The greeting is the message; everything else stays narrower than 40px.
 *
 * What is deliberately NOT here: the level bar and its labels (Today rests
 * quiet — reward feedback lives with the reward beats and the Rewards tab),
 * and the feedback bug button (relocated to the last utility-stack row of the
 * Today scroll, §3.5 row 13).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { MOTION_BUDGET, useMotionScale } from '@/theme/motion';
import { Text as AuroraText } from '@/components/ui/Text';
import { AvatarRing } from '@/components/gamification/AvatarRing';
import { CompanionAvatar } from '@/components/companion/CompanionAvatar';
import { useFlagStore } from '@/store/useFlagStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';

/**
 * Pure greeting formatter (unit-tested, Acceptance #2).
 *
 * "Morning, {firstName}." / "Afternoon, …" (hour < 17) / "Evening, …".
 * No-name rule (binary): an empty or >12-char first name renders the greeting
 * with no name and no comma — never ellipsize a human's name mid-word.
 */
export function formatGreeting(name: string, hour: number): string {
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  if (firstName.length === 0 || firstName.length > 12) return `${period}.`;
  return `${period}, ${firstName}.`;
}

interface TodayHeaderProps {
  totalXP: number;
  initials: string;
  name: string;
  onVoicePress: () => void;
  onCompanionPress: () => void;
}

export function TodayHeader({ totalXP, initials, name, onVoicePress, onCompanionPress }: TodayHeaderProps) {
  const c = useColors();
  const router = useRouter();
  const motionScale = useMotionScale();
  // Identical companion condition to the legacy Today header.
  const companionOn = useFlagStore((s) => s.isEnabled('companion_v1'));
  const gamification = usePreferencesStore((s) => s.gamification);

  const greeting = formatGreeting(name, new Date().getHours());

  return (
    <Animated.View
      entering={FadeIn.duration(MOTION_BUDGET.reveal * motionScale)}
      style={styles.root}
      testID="today-header"
    >
      {/* Deck 1 — utility row */}
      <View style={styles.utilityRow}>
        <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
          <AvatarRing xp={totalXP} initials={initials || 'U'} size={36} />
        </Pressable>
        <View style={styles.spacer} />
        {companionOn && gamification !== 'off' && (
          <CompanionAvatar size={32} onPress={onCompanionPress} />
        )}
        <Pressable
          onPress={onVoicePress}
          style={[styles.voiceBtn, { backgroundColor: c.primaryDim, borderColor: c.border }]}
          testID="voice-open"
          accessibilityRole="button"
          accessibilityLabel="Voice assistant"
        >
          <Ionicons name="mic" size={18} color={c.primary} />
        </Pressable>
      </View>

      {/* Deck 2 — greeting block */}
      <View style={styles.greetingBlock}>
        <AuroraText variant="h1" numberOfLines={1} testID="today-greeting">
          {greeting}
        </AuroraText>
        <AuroraText variant="micro" muted style={styles.dateLine}>
          {format(new Date(), 'EEEE · MMMM d').toUpperCase()}
        </AuroraText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing.sm,
  },
  utilityRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  spacer: { flex: 1 },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingBlock: {
    marginTop: spacing.sm,
  },
  dateLine: {
    marginTop: 2,
  },
});
