import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption } from '@/components/ui/Typography';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'The short version',
    body: 'LifeOS is a personal app you run on your own device. Your data — goals, health logs, finances, contacts, journal entries, blood reports — lives on your device only. There is no LifeOS account, no LifeOS server storing your data, and no advertising. The only outbound calls are to AI providers (Anthropic) and to Google services you explicitly connect.',
  },
  {
    title: 'What we store, and where',
    body: 'On native: SQLite database in the app\'s sandbox. On web: browser localStorage and IndexedDB. This includes your name, email, password hash + salt, goals, routine blocks, food entries, weight history, blood report parses, financial goals and transactions, career profiles, contacts, exploration log, gamification state and any Discovery Import you paste. Uninstalling the app or clearing browser storage permanently deletes this data.',
  },
  {
    title: 'What leaves your device',
    body: 'Three categories of outbound traffic, all initiated by you:\n\n• AI requests to Anthropic (api.anthropic.com): the slice of context needed for one call — e.g. your vision text for goal decomposition, a meal photo for food recognition, your reflection input for tomorrow\'s tweak. We never send your full profile.\n\n• Google APIs you connect: Calendar pushes routine blocks; Fit pulls activity/sleep/heart rate; Gmail (read-only) fetches bank transaction emails so the finance engine can categorise them. Tokens are stored only in your browser/device storage. You can disconnect at any time from the Profile sidebar.\n\n• Auth (optional): if you sign in with Google, your email and display name are read once to create a local user row.',
  },
  {
    title: 'What we do NOT do',
    body: '• We do not run a backend that stores your data.\n• We do not sell, share, or monetise your data.\n• We do not show ads.\n• We do not use third-party analytics, trackers, or session-replay tools.\n• We do not train AI models on your data — Anthropic\'s API terms apply to the calls we make, and by default API inputs are not used for training.\n• We never transmit your raw blood report file, contact list, photos or financial transactions to anyone other than the specific provider you connected (Anthropic for AI parsing, Google for sync).',
  },
  {
    title: 'AI processing details',
    body: 'AI calls go through your configured Anthropic API key (or our development mock mode if no key is set). Each call carries only the specific input the prompt needs: a vision sentence, a goal title, a meal photo as base64, a reflection answer. Responses are JSON-validated against strict schemas before any UI renders them. AI never has access to your other domains unless you explicitly include them in the prompt context.',
  },
  {
    title: 'Google integrations',
    body: 'Each Google integration uses a separate OAuth scope, stored under a distinct token key, and can be disconnected independently:\n\n• Calendar — calendar.events scope. Pushes only your LifeOS routine blocks for today. Never reads other calendar events.\n• Fit — read scopes for activity, heart rate, sleep, body composition, location, SpO2 and blood pressure. Read-only.\n• Gmail — gmail.readonly scope. Used to fetch bank transaction emails, parsed locally with regex (HDFC/ICICI/Axis). Email contents are not stored — only the parsed transaction is persisted.\n\nDisconnecting clears the token and stops all traffic.',
  },
  {
    title: 'Discovery Import',
    body: 'If you paste a self-description from ChatGPT or Claude, the raw text is stored locally in a "discovery_imports" table for transparency. One AI call extracts a structured profile from it. The raw paste itself is never re-sent or shared.',
  },
  {
    title: 'Your rights and controls',
    body: '• Export: your SQLite file (native) or localStorage (web) is yours to copy.\n• Delete: uninstall the app, or clear your browser site data, to permanently remove everything.\n• Disconnect: each Google integration has its own disconnect control in Profile → Connections.\n• Withdraw consent: stop using the app at any time; no server-side state remains.',
  },
  {
    title: 'Security',
    body: 'Passwords are stored as SHA-256 hashes with a per-user salt, computed via expo-crypto. OAuth handshakes use PKCE. We do not transmit passwords to any third party. We rely on the OS keychain (native) or browser storage (web) for at-rest protection — please use device-level encryption (Touch ID, FileVault, BitLocker, or equivalent).',
  },
  {
    title: 'Children',
    body: 'LifeOS is not designed for users under 13. If you are under 13, please do not use the app.',
  },
  {
    title: 'Changes to these terms',
    body: 'When this policy materially changes, the next app update will surface a one-time prompt to review it before continuing. The current version date is shown below.',
  },
  {
    title: 'Contact',
    body: 'Questions, concerns, or data-deletion help: projectm7sct+lifeos@gmail.com',
  },
];

const VERSION_DATE = 'April 2026';

export default function TermsPrivacyScreen() {
  const c = useColors();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <AuroraBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
          <Body style={{ color: c.textSecondary }}>Back</Body>
        </Pressable>

        <Heading style={[styles.title, { color: c.textPrimary }]}>Terms & Privacy</Heading>
        <Caption style={[styles.subtitle, { color: c.textSecondary }]}>
          Plain-language. No dark patterns. Updated {VERSION_DATE}.
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
