import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { radii } from '@/theme/radii';
import { DOMAIN_ICONS } from '@/theme/domainIcons';
import type { LucideIcon } from 'lucide-react-native';
import { useUserStore, ONBOARDING_COMPLETE, type DomainId } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import { seedStarterRoutine } from '@/utils/starterRoutine';
import { useFlagStore } from '@/store/useFlagStore';
import { useGameStore } from '@/store/useGameStore';
import { track, EVENTS } from '@/utils/telemetry';

type Chip = { id: DomainId; icon: LucideIcon; label: string; sub: string; color: string };

export default function WelcomeIntentScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const CHIPS: Chip[] = [
    { id: 'goals',    icon: DOMAIN_ICONS.goal,     label: 'Ship a big goal',       sub: 'Turn an ambition into a plan',  color: c.goal },
    { id: 'health',   icon: DOMAIN_ICONS.health,   label: 'Feel strong',           sub: 'Energy, fitness, and sleep',    color: c.health },
    { id: 'finance',  icon: DOMAIN_ICONS.finance,  label: 'Build wealth',          sub: 'Save toward what matters',      color: c.finance },
    { id: 'career',   icon: DOMAIN_ICONS.career,   label: 'Level up career',       sub: 'Grow toward the work you want', color: c.career },
    { id: 'social',   icon: DOMAIN_ICONS.social,   label: 'Nurture relationships', sub: 'Stay close to your people',     color: c.social },
    { id: 'polymath', icon: DOMAIN_ICONS.polymath, label: 'Learn something new',   sub: 'Explore a skill or curiosity',  color: c.polymath },
  ];
  const router = useRouter();
  const { userId, name, setOnboardingStage, setPrimaryDomains } = useUserStore();
  const awardBadge = useGameStore((s) => s.awardBadge);
  const onboardingV2 = useFlagStore((s) => s.isEnabled('onboarding_v2'));
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
      // First-blueprint badge — symmetric with day1-routine + discovery-confirm.
      awardBadge(userId, 'first_blueprint');
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
            const Icon = chip.icon;
            return (
              <Pressable
                key={chip.id}
                onPress={() => toggle(chip.id)}
                style={[
                  styles.chip,
                  { borderColor: isSelected ? chip.color : c.border,
                    backgroundColor: isSelected ? chip.color + '22' : c.surface,
                    borderLeftColor: chip.color },
                ]}
              >
                <Icon size={24} color={chip.color} strokeWidth={2} />
                <View style={styles.chipText}>
                  <Body style={[styles.chipLabel, isSelected && { color: c.textPrimary, fontFamily: fonts.bodyMedium }]}>
                    {chip.label}
                  </Body>
                  <Caption style={styles.chipSub}>{chip.sub}</Caption>
                </View>
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

        {onboardingV2 ? (
          <Animated.View entering={FadeInDown.delay(750).duration(600)} style={styles.importRow}>
            <Pressable
              onPress={() => {
                track(EVENTS.onboardingV2Started, { entry: 'welcome_intent' });
                router.push('/(onboarding)/discovery-chat');
              }}
              style={styles.importLink}
              hitSlop={8}
            >
              <Caption style={styles.importText}>
                Want me to actually <Caption style={styles.importTextAccent}>get to know you first?</Caption> Chat with me →
              </Caption>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.importRow}>
          <Pressable
            onPress={() => router.push('/(onboarding)/discovery-intro')}
            style={styles.importLink}
            hitSlop={8}
          >
            <Caption style={styles.importText}>
              Have a ChatGPT or Claude chat about yourself? <Caption style={styles.importTextAccent}>Import it →</Caption>
            </Caption>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
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
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    minHeight: 64,
  },
  chipText: { flex: 1, gap: 2 },
  chipLabel: { color: colors.textSecondary, fontSize: fontSizes.md },
  chipSub: { color: colors.textMuted },
  cta: { marginTop: spacing.xl, gap: spacing.sm },
  ctaHint: { color: colors.textMuted, textAlign: 'center' },
  importRow: { marginTop: spacing.lg, alignItems: 'center' },
  importLink: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  importText: { color: colors.textSecondary, textAlign: 'center' },
  importTextAccent: { color: colors.primary },
});
