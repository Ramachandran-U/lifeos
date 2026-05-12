import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption } from '@/components/ui/Typography';
import { useUserStore } from '@/store/useUserStore';
import { usePromptStore } from '@/store/usePromptStore';
import { callAI } from '@/ai/client';
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

export default function ChatScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!userId) return;
    setMessages(listChatMessages(userId));
  }, [userId]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, busy]);

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
      const profile = await getUserProfile(userId);
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayBlocks = profile
        ? getRoutineBlocksByDate(today)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((b) => ({
              startTime: b.startTime,
              endTime: b.endTime,
              title: b.title,
              module: b.module,
              status: b.status,
            }))
        : [];
      const contextBlock = profile
        ? buildProfileContext(profile, { todayBlocks, todayDate: today })
        : '';
      const history: { role: 'user' | 'assistant'; content: string }[] = [];
      if (contextBlock) {
        // Synthetic priming turn so the static system prompt stays cached.
        history.push({ role: 'user', content: contextBlock });
        history.push({ role: 'assistant', content: "Got it — I'll keep that in mind." });
      }
      for (const m of [...messages, userMsg].slice(-12)) {
        history.push({ role: m.role, content: m.content });
      }
      const reply = await callAI({
        system,
        messages: history,
        maxTokens: 800,
        task: 'chatbot',
        cacheSystem: true,
      });
      const assistantMsg = appendChatMessage(userId, 'assistant', reply.trim());
      setMessages((prev) => [...prev, assistantMsg]);
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

          {busy ? (
            <View style={[styles.bubble, styles.bubbleAssistant, { flexDirection: 'row', alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={c.textSecondary} />
              <Body style={{ color: c.textSecondary, marginLeft: spacing.sm }}>Thinking…</Body>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.bubble, { borderColor: c.error, borderWidth: 1, alignSelf: 'stretch' }]}>
              <Body style={{ color: c.error }}>{error}</Body>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about LifeOS…"
            placeholderTextColor={c.textMuted}
            style={styles.input}
            multiline
            maxLength={2000}
            editable={!busy}
            onSubmitEditing={send}
            blurOnSubmit
          />
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
  input: {
    flex: 1,
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
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
  },
});
