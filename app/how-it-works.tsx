import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption } from '@/components/ui/Typography';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'The one question LifeOS answers',
    body: 'Every screen, nudge and number in this app exists to answer a single question for you: "What should I do next to improve my life?" Six engines feed one master planner, and the planner turns your week into a livable day.',
  },
  {
    title: 'Six engines, one daily plan',
    body: 'Goals, Health, Finance, Career, Social and Polymath each track one slice of your life. They run independently, then hand their priorities to the Routine Builder which lays out time-boxed blocks for today.',
  },
  {
    title: 'Onboarding in three small steps',
    body: 'You tell LifeOS your vision, your career direction and your daily schedule. Claude turns each into a structured plan you can actually execute. If you already have a self-description from ChatGPT or Claude, the Discovery Import lets you paste it and skip ahead.',
  },
  {
    title: 'How AI is used',
    body: 'AI is used surgically, not constantly. It decomposes goals, parses blood reports, suggests meals from photos, drafts financial plans and rewrites tomorrow based on tonight\'s reflection. Every call is JSON-validated; nothing is invented when context is missing.',
  },
  {
    title: 'Gamification that compounds',
    body: 'Streaks, XP, levels and badges sit on top of real actions — completed routine blocks, logged meals, finished learning resources. The hexagonal Life Balance radar shows whether one domain is being neglected. Nothing is rewarded for activity that doesn\'t move a real outcome.',
  },
  {
    title: 'Your data, on your device',
    body: 'All your data lives in on-device SQLite (or browser storage on web). Nothing syncs to a LifeOS server — there is no LifeOS server. Optional Google integrations (Calendar, Fit, Gmail for transactions) talk directly between your device and Google, never via us.',
  },
  {
    title: 'A nightly 60-second ritual',
    body: 'Each evening, "Wrap up today" gives you a one-minute review: which blocks landed, how the day felt, and one AI-suggested tweak for tomorrow. It is the loop that makes the app actually change your life instead of just tracking it.',
  },
];

export default function HowItWorksScreen() {
  const c = useColors();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <InkCanvas />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
          <Body style={{ color: c.textSecondary }}>Back</Body>
        </Pressable>

        <Heading style={[styles.title, { color: c.textPrimary }]}>How LifeOS works</Heading>
        <Caption style={[styles.subtitle, { color: c.textSecondary }]}>
          A two-minute read on what this app actually does and why.
        </Caption>

        {SECTIONS.map((s) => (
          <View key={s.title} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Body style={[styles.cardTitle, { color: c.textPrimary }]}>{s.title}</Body>
            <Body style={[styles.cardBody, { color: c.textSecondary }]}>{s.body}</Body>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md, marginBottom: spacing.sm },
  title: { marginTop: spacing.sm },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.lg },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: fontSizes.md, marginBottom: spacing.xs },
  cardBody: { fontSize: fontSizes.sm, lineHeight: 22 },
});
