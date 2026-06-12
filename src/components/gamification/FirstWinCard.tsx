import { StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text as AuroraText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { MOTION_BUDGET } from '@/theme/motion';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { STARTER_COPY } from '@/constants/starterCopy';

/**
 * Day-1 Rewards hero action (cold_start_v1, spec §3.2): while totalXP === 0
 * the Rewards scroll renders exactly three sections, and this card is the
 * middle one — the single first-win invitation. One entry animation, then
 * rest quiet: zero idle/repeating animation (machine-checked by AC-8's
 * companion test in src/constants/__tests__/starterCopy.test.ts).
 */
export function FirstWinCard() {
  const c = useColors();
  const router = useRouter();
  const gamification = usePreferencesStore((s) => s.gamification);
  const body =
    gamification === 'off' ? STARTER_COPY.firstWinBodyOff : STARTER_COPY.firstWinBody;

  return (
    <Animated.View entering={FadeInDown.duration(MOTION_BUDGET.hero)} testID="first-win-card">
      <GlassCard style={styles.card}>
        <SectionLabel color={c.xp}>FIRST WIN</SectionLabel>
        <AuroraText variant="h2">{STARTER_COPY.firstWinHeadline}</AuroraText>
        <AuroraText variant="body" color={c.textSecondary}>
          {body}
        </AuroraText>
        <Button
          title={STARTER_COPY.firstWinCta}
          variant="xp"
          onPress={() => router.push('/(tabs)')}
          testID="first-win-cta"
        />
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg },
});
