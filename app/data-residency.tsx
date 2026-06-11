import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text as AuroraText } from '@/components/ui/Text';

// Aurora Principle 6 — "Privacy as substance". This screen makes the
// on-device posture visible: what stays local, what is ever transmitted,
// and what is never collected at all.

interface ResidencyRow {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}

const LOCAL_ONLY: ResidencyRow[] = [
  { icon: 'fitness-outline', title: 'Health logs', detail: 'Weight, food, blood reports, vitals — SQLite on this device only.' },
  { icon: 'people-outline', title: 'Contacts & social graph', detail: 'Names, relationships, last-talked-to dates. Never leave the device.' },
  { icon: 'wallet-outline', title: 'Finance entries', detail: 'Goals, milestones, transactions — local SQLite. Plaid sync is opt-in (Phase 3).' },
  { icon: 'document-text-outline', title: 'Reflections & journaling', detail: 'Stored locally and encrypted at rest by iOS / Android.' },
];

const AI_SENT: ResidencyRow[] = [
  { icon: 'sparkles-outline', title: 'Daily briefing prompts', detail: 'A slice of today’s plan + recent events is sent to Claude. No raw health values are included unless the briefing specifically asks about them.' },
  { icon: 'analytics-outline', title: 'Goal decomposition', detail: 'Goal title, deadline, and chosen domain. Personal context is summarised, not raw.' },
  { icon: 'mic-outline', title: 'Voice assistant', detail: 'Audio is transcribed on-device; the resulting text is sent. Toggle in Profile to disable.' },
];

const NEVER: ResidencyRow[] = [
  { icon: 'eye-off-outline', title: 'Background telemetry', detail: 'No third-party analytics. The only behavioural signal stays local for your own Profile insights.' },
  { icon: 'location-outline', title: 'Location', detail: 'LifeOS does not request, read, or store device location.' },
  { icon: 'images-outline', title: 'Photos & media', detail: 'Only photos you explicitly pick (e.g. blood report, food photo) leave the gallery, and only for the duration of that one AI call.' },
];

export default function DataResidencyScreen() {
  const c = useColors();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <InkCanvas />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={[styles.back, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color={c.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <AuroraText variant="micro" muted>PRIVATE BY DESIGN</AuroraText>
              <AuroraText variant="h1" style={{ marginTop: 4 }}>Data residency</AuroraText>
            </View>
          </View>

          <AuroraText variant="body" secondary style={styles.lede}>
            Aurora{'’'}s sixth principle: privacy is substance, not a footnote. Here is exactly where every category of your data lives.
          </AuroraText>

          {/* On device */}
          <Section
            color={c.health}
            eyebrow="01 · ON DEVICE ONLY"
            title="Lives in SQLite on this phone"
            rows={LOCAL_ONLY}
            badge="Local"
            badgeColor={c.health}
            c={c}
            delay={120}
          />

          {/* AI calls */}
          <Section
            color={c.career}
            eyebrow="02 · SENT WHEN YOU ASK"
            title="Outbound only on AI requests"
            rows={AI_SENT}
            badge="On request"
            badgeColor={c.career}
            c={c}
            delay={240}
          />

          {/* Never */}
          <Section
            color={c.error}
            eyebrow="03 · NEVER COLLECTED"
            title="Not asked for. Not stored. Not sent."
            rows={NEVER}
            badge="Never"
            badgeColor={c.error}
            c={c}
            delay={360}
          />

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

interface SectionProps {
  eyebrow: string;
  title: string;
  rows: ResidencyRow[];
  color: string;
  badge: string;
  badgeColor: string;
  c: ReturnType<typeof useColors>;
  delay: number;
}

function Section({ eyebrow, title, rows, color, badge, badgeColor, c, delay }: SectionProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420)}>
      <GlassCard accent={color} style={styles.section}>
        <SectionLabel color={color}>{eyebrow}</SectionLabel>
        <AuroraText variant="h3" style={{ marginTop: 2 }}>{title}</AuroraText>
        <View style={styles.rowList}>
          {rows.map((r, i) => (
            <View
              key={r.title}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
              ]}
            >
              <View style={[styles.rowIcon, { backgroundColor: color + '14', borderColor: color + '33' }]}>
                <Ionicons name={r.icon} size={18} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <AuroraText variant="bodyLg">{r.title}</AuroraText>
                <AuroraText variant="caption" muted style={{ marginTop: 2 }}>{r.detail}</AuroraText>
              </View>
              <View style={[styles.badge, { backgroundColor: badgeColor + '1A', borderColor: badgeColor + '44' }]}>
                <AuroraText variant="micro" color={badgeColor}>{badge.toUpperCase()}</AuroraText>
              </View>
            </View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? spacing.lg : 0,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  lede: { marginBottom: spacing.sm },
  section: { gap: spacing.sm },
  rowList: { marginTop: spacing.sm, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
