import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform, Linking } from 'react-native';
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
import { DISCOVERY_USER_PROMPT } from '@/ai/prompts/discovery';

async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export default function DiscoveryIntroScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(DISCOVERY_USER_PROMPT);
    if (ok) {
      setCopied(true);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
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
          <Heading style={styles.title}>Bring your AI's read of you</Heading>
          <Body style={styles.subtitle}>
            If you've already chatted with ChatGPT or Claude about yourself, run this prompt there and paste the response back. LifeOS turns it into your starting plan.
          </Body>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.promptCard}>
          <ScrollView style={styles.promptScroll} nestedScrollEnabled>
            <Body style={styles.promptText} selectable>{DISCOVERY_USER_PROMPT}</Body>
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.copyRow}>
          <Button
            title={copied ? 'Copied ✓' : 'Copy prompt'}
            variant="primary"
            onPress={handleCopy}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.linkRow}>
          <Pressable onPress={() => openUrl('https://chat.openai.com/')} style={styles.linkChip} hitSlop={8}>
            <Body style={styles.linkText}>Open ChatGPT ↗</Body>
          </Pressable>
          <Pressable onPress={() => openUrl('https://claude.ai/new')} style={styles.linkChip} hitSlop={8}>
            <Body style={styles.linkText}>Open Claude ↗</Body>
          </Pressable>
        </Animated.View>

        <Caption style={styles.privacy}>
          Stays on your device. One AI call to structure it — the raw paste never leaves storage.
        </Caption>

        <Animated.View entering={FadeInDown.delay(650).duration(500)} style={styles.cta}>
          <Button
            title="I have my response →"
            variant="primary"
            onPress={() => router.push('/(onboarding)/discovery-paste')}
          />
          <Pressable onPress={() => router.back()} style={styles.skip} hitSlop={8}>
            <Caption style={styles.skipText}>Skip — I'll set it up manually</Caption>
          </Pressable>
        </Animated.View>
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
  promptCard: {
    marginTop: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    maxHeight: 240,
  },
  promptScroll: { maxHeight: 210 },
  promptText: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  copyRow: { marginTop: spacing.md },
  linkRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'center' },
  linkChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  linkText: { color: colors.primary, fontFamily: fonts.bodyMedium },
  privacy: { color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' },
  cta: { marginTop: spacing.xl, gap: spacing.md, alignItems: 'stretch' },
  skip: { alignSelf: 'center', paddingVertical: spacing.sm },
  skipText: { color: colors.textMuted },
});
