import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { TIMING } from '@/theme/motion';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { useVoice } from '@/hooks/useVoice';
import { DISCOVERY_VOICE_SYSTEM_PROMPT } from '@/ai/prompts/discoveryChat';
import { extractDiscoveryProfile } from '@/ai/functions';
import { saveDiscoveryImport } from '@/db/queries/discovery';
import { useUserStore } from '@/store/useUserStore';

// Hidden first turn we send to make the guide speak its opener (Gemini Live
// won't generate until prompted). Stripped from the transcript before extraction.
const KICKOFF = 'Begin the onboarding.';

/** Spoken, areas-first onboarding. The user talks; the guide talks back; the
 *  transcript is then run through the same extract→confirm pipeline the paste
 *  flow uses. The text chat (discovery-chat) remains as the no-mic fallback. */
export default function DiscoveryVoiceScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);

  const voice = useVoice({ systemInstruction: DISCOVERY_VOICE_SYSTEM_PROMPT });
  const [started, setStarted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kickoffRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);

  // Kick off the guide's spoken opener once the live session is connected.
  useEffect(() => {
    if (started && voice.isConnected && !kickoffRef.current) {
      kickoffRef.current = true;
      voice.sendText(KICKOFF);
    }
  }, [started, voice.isConnected, voice]);

  // Always close the session when leaving the screen.
  useEffect(() => () => voice.disconnect(), [voice]);

  const handleStart = () => {
    setError(null);
    voice.resumeAudio();
    voice.connect();
    setStarted(true);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  // What the user actually said, with the hidden kickoff line removed.
  const spokenByUser = (): string =>
    voice.userTranscript
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l !== KICKOFF)
      .join('\n')
      .trim();

  const handleDone = async () => {
    const said = spokenByUser();
    if (said.length < 20) {
      setError("I didn't catch enough yet — tell me which areas you'd like to improve, or type instead.");
      return;
    }
    voice.disconnect();
    setExtracting(true);
    setError(null);
    const transcript =
      'Spoken LifeOS onboarding. What the user said about which areas of life they want to improve and themselves:\n' +
      said +
      (voice.transcript ? `\n\nThe guide's questions, for context:\n${voice.transcript}` : '');
    try {
      const extracted = await extractDiscoveryProfile(transcript);
      if (userId) saveDiscoveryImport(userId, transcript, extracted);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.replace('/(onboarding)/discovery-confirm');
    } catch {
      setExtracting(false);
      setError("Couldn't set that up cleanly — give it another go, or type it instead.");
    }
  };

  const statusLabel = voice.error
    ? 'Reconnecting…'
    : voice.isSpeaking
    ? 'LifeOS is talking…'
    : voice.isThinking
    ? 'Thinking…'
    : voice.isListening
    ? voice.userSpeaking
      ? "I'm listening…"
      : 'Listening — go ahead'
    : voice.isConnected
    ? 'Connected'
    : 'Connecting…';

  const dotColor = voice.error
    ? c.error
    : voice.isSpeaking
    ? c.primary
    : voice.isListening
    ? c.success
    : c.textMuted;

  return (
    <SafeAreaView style={styles.container}>
      <InkCanvas />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <Body style={styles.backText}>← Back</Body>
        </Pressable>

        <Animated.View entering={FadeInDown.duration(TIMING.normal)}>
          <Heading style={styles.title}>Talk it through</Heading>
          <Body style={styles.subtitle}>
            Tell me which parts of your life you want to improve — I&apos;m listening. About a minute, hands-free.
          </Body>
        </Animated.View>

        {extracting ? (
          <Animated.View entering={FadeIn.duration(TIMING.normal)} style={styles.loadingPill}>
            <Body style={styles.loadingText}>Building your plan…</Body>
          </Animated.View>
        ) : !started ? (
          <Animated.View entering={FadeInDown.duration(TIMING.normal)} style={styles.startWrap}>
            <Pressable
              onPress={handleStart}
              style={styles.micButton}
              accessibilityRole="button"
              accessibilityLabel="Start talking"
            >
              <Ionicons name="mic" size={36} color={c.onPrimary} />
            </Pressable>
            <Caption style={styles.micHint}>Tap to start talking</Caption>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeIn.duration(TIMING.fast)} style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <Caption style={styles.statusText}>{statusLabel}</Caption>
            </Animated.View>

            <ScrollView
              ref={scrollRef}
              style={styles.transcript}
              contentContainerStyle={styles.transcriptInner}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {!!voice.transcript && (
                <View style={styles.turn}>
                  <Caption style={styles.who}>LifeOS</Caption>
                  <Body style={styles.aiText}>{voice.transcript}</Body>
                </View>
              )}
              {spokenByUser() !== '' && (
                <View style={styles.turn}>
                  <Caption style={styles.who}>You</Caption>
                  <Body style={styles.userText}>{spokenByUser().split('\n').join(' ')}</Body>
                </View>
              )}
              {!voice.transcript && spokenByUser() === '' && (
                <Body style={styles.hint}>Connecting — I&apos;ll start us off in a second…</Body>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <Button title="Done — build my plan" variant="primary" onPress={handleDone} />
            </View>
          </>
        )}

        {error ? (
          <Animated.View entering={FadeIn.duration(TIMING.fast)} style={styles.errorCard}>
            <Body style={styles.errorText}>{error}</Body>
          </Animated.View>
        ) : null}

        <Pressable onPress={() => router.replace('/(onboarding)/discovery-chat')} style={styles.typeInstead} hitSlop={8}>
          <Caption style={styles.typeText}>Prefer to type? Use the chat →</Caption>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  back: { marginTop: spacing.md, marginBottom: spacing.sm },
  backText: { color: colors.textSecondary },
  title: { marginTop: spacing.md },
  subtitle: { color: colors.textSecondary, marginTop: spacing.sm },
  startWrap: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.md },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micHint: { color: colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xl },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: colors.textSecondary },
  transcript: {
    marginTop: spacing.md,
    minHeight: 200,
    maxHeight: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  transcriptInner: { padding: spacing.md, gap: spacing.md },
  turn: { gap: 2 },
  who: { color: colors.textMuted },
  aiText: { color: colors.textPrimary, fontSize: fontSizes.md, lineHeight: 22 },
  userText: { color: colors.textSecondary, fontSize: fontSizes.md, lineHeight: 22 },
  hint: { color: colors.textMuted },
  actions: { marginTop: spacing.lg },
  loadingPill: {
    marginTop: spacing.xxl,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: colors.textPrimary, fontFamily: fonts.bodyMedium },
  errorCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.surfaceAlt,
  },
  errorText: { color: colors.error },
  typeInstead: { alignSelf: 'center', marginTop: spacing.xl, paddingVertical: spacing.sm },
  typeText: { color: colors.textMuted },
});
