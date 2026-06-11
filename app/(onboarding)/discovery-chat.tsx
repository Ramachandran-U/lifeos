import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Platform, Pressable, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { RotatingPlaceholder } from '@/components/ui/RotatingPlaceholder';
import { discoveryChatTurn } from '@/ai/functions';
import { mergeProfilePatch } from '@/ai/profileMerge';
import { track, EVENTS } from '@/utils/telemetry';
import { emptyUserProfile, ROUTINE_CONFIDENCE_THRESHOLD, type UserProfile } from '@/ai/types';
import { getOrInitUserProfile, upsertUserProfile } from '@/db/queries/userProfile';
import { useUserStore } from '@/store/useUserStore';

const STAGE_LABEL: Record<string, string> = {
  identity: 'Getting to know you',
  vision: 'What you want next',
  schedule: 'Your day',
  habits: 'Patterns',
  asks: 'How I can help',
  done: 'Ready',
};

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const ANSWER_PLACEHOLDERS = [
  'Type your answer…',
  'A sentence or two is plenty…',
  "Tell me what's on your mind…",
  'No wrong answers here…',
];

export default function DiscoveryChatScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const scrollRef = useRef<ScrollView>(null);

  const [profile, setProfile] = useState<UserProfile>(emptyUserProfile('chat'));
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<keyof typeof STAGE_LABEL>('identity');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track abandonment — fires on unmount only if the user has taken at least one
  // turn and never reached `done`. We read the latest values from refs so the
  // cleanup observes the most recent state, not the closure at mount time.
  const doneRef = useRef(done);
  const turnsRef = useRef(0);
  const lastStageRef = useRef<keyof typeof STAGE_LABEL>('identity');
  const lastConfidenceRef = useRef(0);
  useEffect(() => { doneRef.current = done; }, [done]);
  useEffect(() => { lastStageRef.current = stage; }, [stage]);
  useEffect(() => { lastConfidenceRef.current = profile.confidence.overall; }, [profile.confidence.overall]);
  useEffect(() => {
    return () => {
      if (turnsRef.current > 0 && !doneRef.current) {
        track(EVENTS.discoveryChatAbandoned, {
          turns: turnsRef.current,
          last_stage: lastStageRef.current,
          confidence_overall: Math.round(lastConfidenceRef.current * 100) / 100,
        });
      }
    };
  }, []);

  // Kick off with the first AI question on mount.
  useEffect(() => {
    if (!userId) return;
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function bootstrap() {
    if (!userId) return;
    setBusy(true);
    try {
      const seed = await getOrInitUserProfile(userId, 'chat');
      setProfile(seed);
      const turn = await discoveryChatTurn({ profile: seed, transcript: [] });
      setTranscript([{ role: 'assistant', content: turn.nextQuestion }]);
      setStage(turn.stage);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || busy || done || !userId) return;
    setInput('');
    setError(null);

    const nextTranscript: ChatTurn[] = [...transcript, { role: 'user', content: text }];
    setTranscript(nextTranscript);
    setBusy(true);

    try {
      const turn = await discoveryChatTurn({ profile, transcript: nextTranscript });
      const mergedProfile = mergeProfilePatch(profile, turn.patch);
      setProfile(mergedProfile);
      await upsertUserProfile(userId, mergedProfile);
      setStage(turn.stage);
      turnsRef.current += 1;

      // One event per non-empty slot patched on this turn.
      for (const key of Object.keys(turn.patch ?? {}) as Array<keyof typeof turn.patch>) {
        if (key === 'confidenceDeltas') continue;
        if (turn.patch[key] === undefined) continue;
        track(EVENTS.slotFilled, {
          slot: key,
          stage: turn.stage,
          confidence_overall: Math.round(mergedProfile.confidence.overall * 100) / 100,
        });
      }

      if (turn.done || mergedProfile.confidence.overall >= ROUTINE_CONFIDENCE_THRESHOLD) {
        setDone(true);
        track(EVENTS.discoveryChatCompleted, {
          turns: turnsRef.current,
          confidence_overall: Math.round(mergedProfile.confidence.overall * 100) / 100,
          unlocked_routine: mergedProfile.confidence.overall >= ROUTINE_CONFIDENCE_THRESHOLD,
        });
        if (turn.nextQuestion) {
          setTranscript((t) => [...t, { role: 'assistant', content: turn.nextQuestion }]);
        }
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setTranscript((t) => [...t, { role: 'assistant', content: turn.nextQuestion }]);
        if (Platform.OS !== 'web') {
          await Haptics.selectionAsync();
        }
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  function handleConfirm() {
    router.replace('/(onboarding)/discovery-confirm');
  }

  const pct = Math.round(profile.confidence.overall * 100);

  return (
    <SafeAreaView style={styles.container}>
      <InkCanvas />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
            <Body style={styles.backText}>← Back</Body>
          </Pressable>
          <View style={styles.stageRow}>
            <View style={styles.stagePill}>
              <Caption style={styles.stageText}>{STAGE_LABEL[stage]}</Caption>
            </View>
            <Caption style={styles.confidence}>{pct}% known</Caption>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <Animated.View entering={FadeInDown.duration(400)}>
            <Heading style={styles.title}>Tell me about your life</Heading>
            <Body style={styles.subtitle}>
              A short chat. I'll only set up your routine once I actually understand you.
            </Body>
          </Animated.View>

          {transcript.map((t, idx) => (
            <Animated.View
              key={idx}
              entering={FadeIn.duration(300)}
              style={[styles.bubble, t.role === 'user' ? styles.userBubble : styles.aiBubble]}
            >
              <Body style={t.role === 'user' ? styles.userText : styles.aiText}>{t.content}</Body>
            </Animated.View>
          ))}

          {busy ? (
            <View style={styles.bubble}>
              <Caption style={styles.thinking}>thinking…</Caption>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Body style={styles.errorText}>{error}</Body>
            </View>
          ) : null}
        </ScrollView>

        {done ? (
          <View style={styles.composer}>
            <Button title="Review what I know about you" onPress={handleConfirm} />
          </View>
        ) : (
          <View style={styles.composer}>
            <View style={styles.inputWrap}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholderTextColor={c.textMuted}
                style={styles.input}
                editable={!busy}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                multiline
              />
              <RotatingPlaceholder
                phrases={ANSWER_PLACEHOLDERS}
                active={!input}
                color={c.textMuted}
                style={styles.rotatingHint}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={busy || !input.trim()}
              style={[styles.sendBtn, (busy || !input.trim()) && styles.sendBtnDisabled]}
            >
              <Body style={styles.sendBtnText}>Send</Body>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid/i.test(msg)) return "I didn't quite catch that. Try again.";
  return "Something went wrong. Please retry.";
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    back: { marginBottom: spacing.sm },
    backText: { color: colors.textSecondary },
    stageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    stagePill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.primaryDim,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    stageText: { color: colors.primary, fontFamily: fonts.bodyMedium },
    confidence: { color: colors.textSecondary },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
    title: { marginTop: spacing.sm },
    subtitle: { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.lg },
    bubble: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: 20,
      maxWidth: '90%',
    },
    aiBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primaryDim,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    aiText: { color: colors.textPrimary },
    userText: { color: colors.textPrimary },
    thinking: { color: colors.textMuted, fontStyle: 'italic' },
    errorCard: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.surfaceAlt,
    },
    errorText: { color: colors.error },
    composer: {
      flexDirection: 'row',
      padding: spacing.md,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    inputWrap: {
      flex: 1,
      justifyContent: 'center',
    },
    input: {
      minHeight: 48,
      maxHeight: 120,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
    },
    // Overlay aligned to the native placeholder inset (fontSize matches input).
    rotatingHint: {
      left: spacing.md,
      top: spacing.sm + 1,
      fontSize: fontSizes.sm,
    },
    sendBtn: {
      paddingHorizontal: spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendBtnText: { color: '#fff', fontFamily: fonts.bodyMedium },
  });
