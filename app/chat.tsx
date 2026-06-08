import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { RotatingPlaceholder } from '@/components/ui/RotatingPlaceholder';
import { useUserStore } from '@/store/useUserStore';
import { usePromptStore } from '@/store/usePromptStore';
import { callAIStream } from '@/ai/client';
import { CHATBOT_SYSTEM_PROMPT } from '@/ai/prompts/chatbot';
import {
  appendChatMessage,
  listChatMessages,
  clearChatMessages,
  type ChatMessage,
} from '@/db/queries/chat';
import { getUserProfile } from '@/db/queries/userProfile';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { buildProfileContext } from '@/ai/profileContext';
import { format } from 'date-fns';

const CHAT_PLACEHOLDERS = [
  'What should I do next?',
  'Why did you skip my workout today?',
  'How am I tracking on my goals?',
  'Plan the rest of my afternoon…',
  'What did I learn this week?',
];

export default function ChatScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // Cached profile-context block, keyed by profile.lastUpdated + today's date.
  // Avoids re-running getUserProfile + getRoutineBlocksByDate + buildProfileContext
  // on every send when nothing relevant has changed (§P2-10).
  const contextCacheRef = useRef<{ key: string; block: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    setMessages(listChatMessages(userId));
  }, [userId]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, [messages, streamingText]);

  const send = async () => {
    if (!userId || !input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    setError(null);
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg = appendChatMessage(userId, 'user', text);
    setMessages((prev) => [...prev, userMsg]);

    try {
      const system = usePromptStore.getState().getPrompt('chatbot_system', CHATBOT_SYSTEM_PROMPT);
      const today = format(new Date(), 'yyyy-MM-dd');
      const profile = await getUserProfile(userId);
      const cacheKey = `${profile?.lastUpdated ?? 'none'}::${today}`;
      let contextBlock = '';
      if (profile) {
        if (contextCacheRef.current?.key === cacheKey) {
          contextBlock = contextCacheRef.current.block;
        } else {
          const todayBlocks = getRoutineBlocksByDate(today)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((b) => ({
              startTime: b.startTime,
              endTime: b.endTime,
              title: b.title,
              module: b.module,
              status: b.status,
            }));
          contextBlock = buildProfileContext(profile, { todayBlocks, todayDate: today });
          contextCacheRef.current = { key: cacheKey, block: contextBlock };
        }
      }
      const history: { role: 'user' | 'assistant'; content: string }[] = [];
      if (contextBlock) {
        // Synthetic priming turn so the static system prompt stays cached.
        history.push({ role: 'user', content: contextBlock });
        history.push({ role: 'assistant', content: "Got it — I'll keep that in mind." });
      }
      for (const m of [...messages, userMsg].slice(-12)) {
        history.push({ role: m.role, content: m.content });
      }
      let streamed = '';
      setStreamingText('');
      try {
        await callAIStream(
          { system, messages: history, maxTokens: 800, task: 'chatbot', cacheSystem: true },
          (chunk) => {
            streamed += chunk;
            setStreamingText(streamed);
          },
        );
        const assistantMsg = appendChatMessage(userId, 'assistant', streamed.trim());
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setStreamingText(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const onClear = () => {
    if (!userId) return;
    if (typeof window !== 'undefined' && !window.confirm('Clear chat history?')) return;
    clearChatMessages(userId);
    setMessages([]);
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Body style={{ color: c.textSecondary }}>← Back</Body>
          </Pressable>
          <Heading style={{ fontSize: fontSizes.lg }}>Ask LifeOS</Heading>
          <Pressable onPress={onClear} hitSlop={12}>
            <Body style={{ color: c.textSecondary, fontSize: fontSizes.sm }}>Clear</Body>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <Animated.View entering={FadeIn} style={styles.empty}>
              <Body style={{ color: c.textSecondary, textAlign: 'center' }}>
                Ask me anything — about you, your routine, or how LifeOS works. Try "what should I do next?" or "why did you skip my workout today?"
              </Body>
              <Caption style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                I read your profile + today's plan to answer. I can't change them from chat yet — direct actions are coming.
              </Caption>
            </Animated.View>
          ) : null}

          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Body style={{ color: m.role === 'user' ? c.textPrimary : c.textPrimary }}>
                {m.content}
              </Body>
            </View>
          ))}

          {streamingText !== null ? (
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <Body style={{ color: c.textPrimary }}>{streamingText || '…'}</Body>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.bubble, { borderColor: c.error, borderWidth: 1, alignSelf: 'stretch' }]}>
              <Body style={{ color: c.error }}>{error}</Body>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.inputWrap}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholderTextColor={c.textMuted}
              style={styles.input}
              multiline
              maxLength={2000}
              editable={!busy}
              onSubmitEditing={send}
              blurOnSubmit
            />
            <RotatingPlaceholder
              phrases={CHAT_PLACEHOLDERS}
              active={!input}
              color={c.textMuted}
              style={styles.rotatingHint}
            />
          </View>
          <Pressable
            onPress={send}
            disabled={busy || !input.trim()}
            style={[styles.sendBtn, (busy || !input.trim()) && { opacity: 0.4 }]}
          >
            <Body style={{ color: c.textPrimary, fontFamily: fonts.body }}>Send</Body>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  bubble: {
    padding: spacing.md,
    borderRadius: 16,
    maxWidth: '85%',
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderColor: colors.border,
    borderWidth: 1,
  },
  composer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  inputWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    maxHeight: 120,
    minHeight: 44,
    borderColor: colors.border,
    borderWidth: 1,
  },
  // Sits over the empty composer at the same inset as the native placeholder.
  rotatingHint: {
    left: spacing.md,
    top: spacing.sm + 1,
    fontSize: fontSizes.md,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
  },
});
