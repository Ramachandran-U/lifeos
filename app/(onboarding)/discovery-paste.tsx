import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Platform, Pressable } from 'react-native';
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
import { extractDiscoveryProfile } from '@/ai/functions';
import { saveDiscoveryImport } from '@/db/queries/discovery';
import { useUserStore } from '@/store/useUserStore';

const MIN_CHARS = 400;
const SOFT_WARN_CHARS = 1500;

const PHASES = ['Reading your story…', 'Mapping goals…', 'Shaping your engines…'];

export default function DiscoveryPasteScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phaseTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (phaseTimer.current) clearInterval(phaseTimer.current);
    };
  }, []);

  const charCount = text.length;
  const tooShort = charCount < MIN_CHARS;
  const softWarn = charCount >= MIN_CHARS && charCount < SOFT_WARN_CHARS;

  const handleExtract = async () => {
    if (!userId || tooShort || submitting) return;
    setSubmitting(true);
    setError(null);
    setPhaseIdx(0);
    phaseTimer.current = setInterval(() => {
      setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 1));
    }, 1600);

    try {
      const extracted = await extractDiscoveryProfile(text);
      saveDiscoveryImport(userId, text, extracted);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace('/(onboarding)/discovery-confirm');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('invalid') ? "Couldn't parse that cleanly. Edit your paste and try again." : 'Something went wrong. Try again.');
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      if (phaseTimer.current) clearInterval(phaseTimer.current);
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <InkCanvas />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeIn.duration(500)}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
            <Body style={styles.backText}>← Back</Body>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <Heading style={styles.title}>Paste your Discovery output</Heading>
          <Body style={styles.subtitle}>
            Drop the full response from ChatGPT or Claude below. I'll read it and set up your LifeOS.
          </Body>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.editorCard}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            editable={!submitting}
            placeholder="Paste here…"
            placeholderTextColor={c.textMuted}
            style={styles.editor}
            textAlignVertical="top"
          />
          <View style={styles.editorFooter}>
            <Caption style={[styles.count, tooShort && { color: c.textMuted }, softWarn && { color: c.warning }]}>
              {charCount.toLocaleString()} / ~12,000
            </Caption>
            {tooShort && charCount > 0 ? (
              <Caption style={styles.countHint}>At least {MIN_CHARS} characters</Caption>
            ) : softWarn ? (
              <Caption style={styles.countHint}>Looks short — did you run the full prompt?</Caption>
            ) : null}
          </View>
        </Animated.View>

        <Caption style={styles.privacy}>
          Stays on your device. One AI call to structure it — the raw paste never leaves storage.
        </Caption>

        {error ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.errorCard}>
            <Body style={styles.errorText}>{error}</Body>
          </Animated.View>
        ) : null}

        <View style={styles.cta}>
          {submitting ? (
            <View style={styles.loadingPill}>
              <Body style={styles.loadingText}>{PHASES[phaseIdx]}</Body>
            </View>
          ) : (
            <Button
              title="Extract my profile"
              variant="primary"
              onPress={handleExtract}
              disabled={tooShort}
            />
          )}
        </View>
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
  editorCard: {
    marginTop: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  editor: {
    minHeight: 260,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  editorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  count: { color: colors.textSecondary },
  countHint: { color: colors.textMuted },
  privacy: { color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
  errorCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.surfaceAlt,
  },
  errorText: { color: colors.error },
  cta: { marginTop: spacing.xl },
  loadingPill: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: colors.textPrimary, fontFamily: fonts.bodyMedium },
});
