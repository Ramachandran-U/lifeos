import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { getLatestDiscoveryImport, type DiscoveryImport } from '@/db/queries/discovery';
import { seedFromDiscovery } from '@/db/queries/discoverySeed';
import { getUserProfile } from '@/db/queries/userProfile';
import { generateAndSaveRoutineForToday, ProfileNotReadyError } from '@/ai/routineFromProfile';
import { ROUTINE_CONFIDENCE_THRESHOLD, type UserProfile, type DiscoveryExtraction } from '@/ai/types';
import { useUserStore, ONBOARDING_COMPLETE } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import { track } from '@/utils/telemetry';
import * as Haptics from 'expo-haptics';

type ConfirmSource =
  | { kind: 'profile'; profile: UserProfile }
  | { kind: 'import'; record: DiscoveryImport };

export default function DiscoveryConfirmScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const setOnboardingStage = useUserStore((s) => s.setOnboardingStage);
  const setPrimaryDomains = useUserStore((s) => s.setPrimaryDomains);

  const [source, setSource] = useState<ConfirmSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Prefer the v2 UserProfile if present (conversational chat path). Fall back
  // to the legacy DiscoveryImport (paste path).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const profile = await getUserProfile(userId);
      if (cancelled) return;
      if (profile) {
        setSource({ kind: 'profile', profile });
      } else {
        const record = getLatestDiscoveryImport(userId);
        if (record) setSource({ kind: 'import', record });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleConfirm = async () => {
    if (!userId || !source || seeding) return;
    setSeeding(true);
    setSeedError(null);
    try {
      if (source.kind === 'profile') {
        await commitProfile(source.profile);
      } else {
        seedFromDiscovery(userId, source.record.extracted, source.record.id);
        updateUser(userId, { onboardingStage: ONBOARDING_COMPLETE });
        setOnboardingStage(ONBOARDING_COMPLETE);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)');
    } catch (err) {
      setSeedError(friendlyError(err));
      setSeeding(false);
    }
  };

  async function commitProfile(profile: UserProfile) {
    if (!userId) return;
    // Persist top-level fields to users row so legacy screens keep working.
    updateUser(userId, {
      wakeTime: profile.schedule.wakeTime ?? undefined,
      sleepTime: profile.schedule.sleepTime ?? undefined,
      workStartTime: profile.schedule.workStartTime ?? undefined,
      workEndTime: profile.schedule.workEndTime ?? undefined,
      visionStatement: profile.vision.statement ?? undefined,
      primaryDomains: profile.primaryDomains,
      onboardingStage: ONBOARDING_COMPLETE,
    });
    setPrimaryDomains(profile.primaryDomains);
    setOnboardingStage(ONBOARDING_COMPLETE);
    // Generate + save today's routine — gated by ProfileNotReadyError on low confidence.
    const routine = await generateAndSaveRoutineForToday(profile);
    track('routine_generated', {
      source: 'discovery_confirm_v2',
      block_count: routine.blocks.length,
      confidence_overall: Math.round(profile.confidence.overall * 100) / 100,
      primary_domains: profile.primaryDomains.length,
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AuroraBackground />
        <Caption style={styles.empty}>Loading…</Caption>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AuroraBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Heading style={styles.title}>Here's what I learned about you</Heading>
          <Body style={styles.subtitle}>
            {source?.kind === 'profile'
              ? "A quick read of our chat. You'll be able to edit any of this later."
              : "A quick read of what you shared. You'll be able to edit any of this before it shapes your plan."}
          </Body>
        </Animated.View>

        {!source ? (
          <Caption style={styles.empty}>No profile found.</Caption>
        ) : source.kind === 'profile' ? (
          <ProfileSummary profile={source.profile} />
        ) : (
          <ExtractionSummary extracted={source.record.extracted} />
        )}

        <View style={styles.cta}>
          <Button
            title={seeding ? 'Building your day…' : ctaTitle(source)}
            onPress={handleConfirm}
            disabled={!source || seeding}
          />
          {seedError ? (
            <Caption style={[styles.ctaHint, { color: c.error }]}>{seedError}</Caption>
          ) : (
            <Caption style={styles.ctaHint}>
              {source?.kind === 'profile'
                ? "I'll generate your first routine and take you to Today. You can edit any block."
                : 'Adds your top goals and active interests to LifeOS. You can edit or delete any of them later.'}
            </Caption>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ctaTitle(source: ConfirmSource | null): string {
  if (!source) return 'Continue';
  if (source.kind === 'profile') {
    return source.profile.confidence.overall >= ROUTINE_CONFIDENCE_THRESHOLD
      ? 'Generate my routine'
      : 'Tell me a bit more first';
  }
  return 'Use this to set up LifeOS';
}

function friendlyError(err: unknown): string {
  if (err instanceof ProfileNotReadyError) {
    return `I need a bit more from you first (${Math.round(err.confidenceOverall * 100)}% / 70% known). Tap back and finish the chat.`;
  }
  return err instanceof Error ? err.message : 'Could not set up your plan.';
}

// --- v2 (UserProfile) summary ---

function ProfileSummary({ profile }: { profile: UserProfile }) {
  const c = useColors();
  const styles = makeStyles(c);
  const conf = profile.confidence;
  return (
    <View style={styles.sections}>
      <Section title="Identity" confidence={conf.identity}>
        {profile.identity.firstName ? (
          <Body style={styles.line}>
            {profile.identity.firstName}
            {profile.identity.ageBand ? `, ${profile.identity.ageBand}` : ''}
          </Body>
        ) : null}
        {profile.identity.seasonOfLife ? (
          <Body style={styles.lineMuted}>{profile.identity.seasonOfLife}</Body>
        ) : null}
      </Section>

      <Section title="Vision" confidence={conf.vision}>
        {profile.vision.statement ? <Body style={styles.line}>{profile.vision.statement}</Body> : null}
        {profile.vision.topGoals.map((g, i) => (
          <Caption key={i} style={styles.lineMuted}>• {g}</Caption>
        ))}
      </Section>

      <Section title="Schedule" confidence={conf.schedule}>
        <Body style={styles.line}>
          Wake {profile.schedule.wakeTime ?? '—'} · Sleep {profile.schedule.sleepTime ?? '—'}
        </Body>
        <Caption style={styles.lineMuted}>
          Work {profile.schedule.workStartTime ?? '—'} – {profile.schedule.workEndTime ?? '—'}
        </Caption>
        {profile.schedule.fixedBlocks.map((b, i) => (
          <Caption key={i} style={styles.lineMuted}>
            ⛓ {b.label} · {b.startTime}–{b.endTime}
          </Caption>
        ))}
      </Section>

      <Section title="Energy & focus" confidence={conf.chronotype}>
        <Body style={styles.line}>{labelChronotype(profile.chronotype)}</Body>
        {profile.primaryDomains.length > 0 ? (
          <Caption style={styles.lineMuted}>Focus: {profile.primaryDomains.join(' · ')}</Caption>
        ) : null}
      </Section>

      <Section title="Habits" confidence={conf.habits}>
        {profile.habits.current.length > 0 ? (
          <Caption style={styles.lineMuted}>Holding: {profile.habits.current.join(', ')}</Caption>
        ) : null}
        {profile.habits.aspirational.length > 0 ? (
          <Caption style={styles.lineMuted}>Wants: {profile.habits.aspirational.join(', ')}</Caption>
        ) : null}
      </Section>

      {profile.constraints.length > 0 ? (
        <Section title="Constraints" confidence={conf.constraints}>
          {profile.constraints.map((x, i) => (
            <Caption key={i} style={styles.lineMuted}>• {x}</Caption>
          ))}
        </Section>
      ) : null}

      {profile.struggles.length > 0 ? (
        <Section title="Struggles" confidence={0.7}>
          {profile.struggles.map((x, i) => (
            <Caption key={i} style={styles.lineMuted}>• {x}</Caption>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

function labelChronotype(chrono: UserProfile['chronotype']): string {
  if (chrono === 'lark') return 'Morning person — sharpest early';
  if (chrono === 'owl') return 'Night owl — peaks late';
  if (chrono === 'balanced') return 'Balanced energy through the day';
  return 'Energy pattern not yet known';
}

// --- v1 (DiscoveryExtraction) summary — preserved for the import path ---

function ExtractionSummary({ extracted: e }: { extracted: DiscoveryExtraction }) {
  const c = useColors();
  const styles = makeStyles(c);
  const lvl = (level: 'high' | 'medium' | 'low'): number =>
    level === 'high' ? 0.9 : level === 'medium' ? 0.6 : 0.3;
  return (
    <View style={styles.sections}>
      <Section title="Identity" confidence={lvl(e.identity.confidence)}>
        {e.identity.firstName && (
          <Body style={styles.line}>
            {e.identity.firstName}
            {e.identity.ageBand ? `, ${e.identity.ageBand}` : ''}
          </Body>
        )}
        {e.identity.location && <Body style={styles.line}>{e.identity.location}</Body>}
        {e.identity.seasonOfLife && <Body style={styles.lineMuted}>{e.identity.seasonOfLife}</Body>}
      </Section>
      <Section title={`Goals (${e.goals.length})`} confidence={lvl(e.goals[0]?.confidence ?? 'low')}>
        {e.goals.map((g, i) => (
          <View key={i} style={styles.goalRow}>
            <Body style={styles.line}>{g.title}</Body>
            <Caption style={styles.lineMuted}>{g.domain} · {g.horizon}</Caption>
          </View>
        ))}
      </Section>
      <Section title="Career" confidence={lvl(e.career.confidence)}>
        {e.career.role && <Body style={styles.line}>{e.career.role}</Body>}
        {e.career.aspirations.length > 0 && (
          <Caption style={styles.lineMuted}>→ {e.career.aspirations.join(', ')}</Caption>
        )}
      </Section>
      <Section title="Health" confidence={lvl(e.health.confidence)}>
        {e.health.constraints.length > 0 && (
          <Caption style={styles.lineMuted}>Constraints: {e.health.constraints.join(', ')}</Caption>
        )}
        {e.health.energyPattern && <Caption style={styles.lineMuted}>{e.health.energyPattern}</Caption>}
      </Section>
      <Section title="Finance" confidence={lvl(e.finance.confidence)}>
        {e.finance.topGoals.length > 0 && <Body style={styles.line}>{e.finance.topGoals.join(', ')}</Body>}
        {e.finance.anxieties.length > 0 && (
          <Caption style={styles.lineMuted}>Worries: {e.finance.anxieties.join(', ')}</Caption>
        )}
      </Section>
      <Section title="Curiosity" confidence={lvl(e.curiosity.confidence)}>
        {e.curiosity.activeInterests.length > 0 && (
          <Body style={styles.line}>{e.curiosity.activeInterests.join(' · ')}</Body>
        )}
      </Section>
    </View>
  );
}

function Section({
  title,
  confidence,
  children,
}: {
  title: string;
  confidence: number;
  children: React.ReactNode;
}) {
  const c = useColors();
  const styles = makeStyles(c);
  const dotColor = confidence >= 0.7 ? c.success : confidence >= 0.4 ? c.warning : c.textMuted;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Body style={styles.sectionTitle}>{title}</Body>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  title: { marginTop: spacing.xl },
  subtitle: { color: colors.textSecondary, marginTop: spacing.sm },
  empty: { color: colors.textMuted, marginTop: spacing.xl, textAlign: 'center' },
  sections: { marginTop: spacing.xl, gap: spacing.md },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: fontSizes.md, color: colors.textPrimary },
  sectionBody: { marginTop: spacing.sm, gap: spacing.xs },
  goalRow: { marginBottom: spacing.xs },
  line: { color: colors.textPrimary },
  lineMuted: { color: colors.textSecondary },
  cta: { marginTop: spacing.xl, gap: spacing.sm },
  ctaHint: { color: colors.textMuted, textAlign: 'center' },
});
