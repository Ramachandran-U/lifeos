import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { useUserStore, ONBOARDING_COMPLETE, type DomainId } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import { seedStarterRoutine } from '@/utils/starterRoutine';

type Chip = { id: DomainId; emoji: string; label: string; color: string };

const CHIPS: Chip[] = [
  { id: 'goals',    emoji: '◆', label: 'Ship a big goal',     color: colors.goal },
  { id: 'health',   emoji: '♥', label: 'Feel strong',         color: colors.health },
  { id: 'finance',  emoji: '◈', label: 'Build wealth',        color: colors.finance },
  { id: 'career',   emoji: '▲', label: 'Level up career',     color: colors.career },
  { id: 'social',   emoji: '●', label: 'Nurture relationships', color: colors.social },
  { id: 'polymath', emoji: '✦', label: 'Learn something new', color: colors.polymath },
];

export default function WelcomeIntentScreen() {
  const router = useRouter();
  const { userId, name, setOnboardingStage, setPrimaryDomains } = useUserStore();
  const [selected, setSelected] = useState<DomainId[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: DomainId) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((d) => d !== id);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, id];
    });
  };

  const handleContinue = async () => {
    if (!userId || selected.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      seedStarterRoutine(selected);
      updateUser(userId, {
        primaryDomains: selected,
        activatedModules: [],
        onboardingStage: ONBOARDING_COMPLETE,
      });
      setPrimaryDomains(selected);
      setOnboardingStage(ONBOARDING_COMPLETE);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace('/(tabs)');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AuroraBackground />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.Text entering={FadeIn.duration(800)} style={styles.logo}>
          LifeOS
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Heading style={styles.title}>What matters most this season{name ? `, ${name.split(' ')[0]}` : ''}?</Heading>
          <Body style={styles.subtitle}>
            Pick 1–3. LifeOS will build a routine around them — the rest can wait.
          </Body>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.grid}>
          {CHIPS.map((chip) => {
            const isSelected = selected.includes(chip.id);
            return (
              <Pressable
                key={chip.id}
                onPress={() => toggle(chip.id)}
                style={[
                  styles.chip,
                  { borderColor: isSelected ? chip.color : colors.border,
                    backgroundColor: isSelected ? chip.color + '22' : colors.surface,
                    borderLeftColor: chip.color },
                ]}
              >
                <Body style={[styles.chipEmoji, { color: chip.color }]}>{chip.emoji}</Body>
                <Body style={[styles.chipLabel, isSelected && { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
                  {chip.label}
                </Body>
              </Pressable>
            );
          })}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.cta}>
          <Button
            title={submitting ? 'Building your day…' : 'Build my day'}
            onPress={handleContinue}
            disabled={selected.length === 0 || submitting}
          />
          <Caption style={styles.ctaHint}>
            We'll seed a starter routine for today. Tap any block to make it yours.
          </Caption>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  logo: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xxxl,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  title: { textAlign: 'center' },
  subtitle: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  hint: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, letterSpacing: 1 },
  grid: { marginTop: spacing.xl, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 4,
    minHeight: 64,
  },
  chipEmoji: { fontSize: 24 },
  chipLabel: { color: colors.textSecondary, fontSize: fontSizes.md },
  cta: { marginTop: spacing.xl, gap: spacing.sm },
  ctaHint: { color: colors.textMuted, textAlign: 'center' },
});
