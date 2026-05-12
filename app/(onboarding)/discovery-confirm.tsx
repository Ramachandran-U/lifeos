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
import { useUserStore } from '@/store/useUserStore';
import * as Haptics from 'expo-haptics';

// Placeholder confirmation screen — shows extracted summary.
// Screen 3 (grouped editable sections + seeding) ships in the next pass.
export default function DiscoveryConfirmScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const [record, setRecord] = useState<DiscoveryImport | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setRecord(getLatestDiscoveryImport(userId));
  }, [userId]);

  const e = record?.extracted;

  const handleConfirm = () => {
    if (!userId || !record || seeding) return;
    setSeeding(true);
    setSeedError(null);
    try {
      seedFromDiscovery(userId, record.extracted, record.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)');
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Could not seed your plan');
      setSeeding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AuroraBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Heading style={styles.title}>Here's what I learned about you</Heading>
          <Body style={styles.subtitle}>
            A quick read of what you shared. You'll be able to edit any of this before it shapes your plan.
          </Body>
        </Animated.View>

        {!e ? (
          <Caption style={styles.empty}>No extraction found.</Caption>
        ) : (
          <View style={styles.sections}>
            <Section title="Identity" confidence={e.identity.confidence}>
              {e.identity.firstName && <Body style={styles.line}>{e.identity.firstName}{e.identity.ageBand ? `, ${e.identity.ageBand}` : ''}</Body>}
              {e.identity.location && <Body style={styles.line}>{e.identity.location}</Body>}
              {e.identity.seasonOfLife && <Body style={styles.lineMuted}>{e.identity.seasonOfLife}</Body>}
            </Section>

            <Section title={`Goals (${e.goals.length})`} confidence={e.goals[0]?.confidence ?? 'low'}>
              {e.goals.map((g, i) => (
                <View key={i} style={styles.goalRow}>
                  <Body style={styles.line}>{g.title}</Body>
                  <Caption style={styles.lineMuted}>{g.domain} · {g.horizon}</Caption>
                </View>
              ))}
            </Section>

            <Section title="Values" confidence="medium">
              <Body style={styles.line}>{e.values.join(' · ') || '—'}</Body>
            </Section>

            <Section title="Career" confidence={e.career.confidence}>
              {e.career.role && <Body style={styles.line}>{e.career.role}</Body>}
              {e.career.aspirations.length > 0 && <Caption style={styles.lineMuted}>→ {e.career.aspirations.join(', ')}</Caption>}
            </Section>

            <Section title="Health" confidence={e.health.confidence}>
              {e.health.constraints.length > 0 && <Caption style={styles.lineMuted}>Constraints: {e.health.constraints.join(', ')}</Caption>}
              {e.health.energyPattern && <Caption style={styles.lineMuted}>{e.health.energyPattern}</Caption>}
            </Section>

            <Section title="Finance" confidence={e.finance.confidence}>
              {e.finance.topGoals.length > 0 && <Body style={styles.line}>{e.finance.topGoals.join(', ')}</Body>}
              {e.finance.anxieties.length > 0 && <Caption style={styles.lineMuted}>Worries: {e.finance.anxieties.join(', ')}</Caption>}
            </Section>

            <Section title="Relationships" confidence={e.relationships.confidence}>
              {e.relationships.keyPeople.map((p, i) => (
                <Caption key={i} style={styles.lineMuted}>{p.firstName} — {p.role}{p.cadence ? ` (${p.cadence})` : ''}</Caption>
              ))}
            </Section>

            <Section title="Curiosity" confidence={e.curiosity.confidence}>
              {e.curiosity.activeInterests.length > 0 && <Body style={styles.line}>{e.curiosity.activeInterests.join(' · ')}</Body>}
            </Section>
          </View>
        )}

        <View style={styles.cta}>
          <Button
            title={seeding ? 'Setting up…' : 'Use this to set up LifeOS'}
            onPress={handleConfirm}
            disabled={!e || seeding}
          />
          {seedError ? (
            <Caption style={[styles.ctaHint, { color: c.error }]}>{seedError}</Caption>
          ) : (
            <Caption style={styles.ctaHint}>
              Adds your top goals and active interests to LifeOS. You can edit or delete any of them later.
            </Caption>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, confidence, children }: { title: string; confidence: 'high' | 'medium' | 'low'; children: React.ReactNode }) {
  const c = useColors();
  const styles = makeStyles(c);
  const dotColor = confidence === 'high' ? c.success : confidence === 'medium' ? c.warning : c.textMuted;
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
  empty: { color: colors.textMuted, marginTop: spacing.xl },
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
