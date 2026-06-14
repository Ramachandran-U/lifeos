import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, TextInput, ScrollView, Platform } from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { format } from 'date-fns';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { useElevation } from '@/theme/elevation';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { TIMING } from '@/theme/motion';
import { Heading, Body, Label, Caption } from '@/components/ui/Typography';
import { useVoice } from '@/hooks/useVoice';
import { callAIStream } from '@/ai/client';
import { buildVoiceTools } from '@/ai/agent/voiceTools';
import { commitActions, type ActionQueue, type ProposedAction } from '@/ai/agent/actionQueue';
import type { ToolContext, AppScreen } from '@/ai/agent/tools';
import { buildVoiceSystemInstruction } from '@/ai/prompts/voiceAgent';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useUserStore } from '@/store/useUserStore';
import { useFlagStore } from '@/store/useFlagStore';
import { getUser } from '@/db/queries/users';
import type { VoiceSessionOptions } from '@/ai/voiceClient';

// ── Screen ↔ route mapping ─────────────────────────────────────────────────────
const ROUTE: Record<AppScreen, string> = {
  today: '/(tabs)',
  goals: '/(tabs)/goals',
  health: '/(tabs)/health',
  finance: '/(tabs)/finance',
  career: '/(tabs)/career',
  social: '/(tabs)/social',
  explore: '/(tabs)/explore',
  life: '/(tabs)/life',
  profile: '/(tabs)/profile',
  rewards: '/(tabs)/rewards',
};

const KNOWN_SCREENS = new Set<AppScreen>([
  'goals', 'health', 'finance', 'career', 'social', 'explore', 'life', 'profile', 'rewards',
]);

function routeToScreen(pathname: string): AppScreen {
  const seg = pathname.replace(/^\//, '').split('/')[0];
  if (seg === '') return 'today';
  return KNOWN_SCREENS.has(seg as AppScreen) ? (seg as AppScreen) : 'today';
}

// Native-only haptic punctuation. Web is the primary target where the haptics
// API is a no-op, so guard the platform and swallow any rejection — feedback is
// a nicety, never load-bearing.
function tapHaptic(kind: 'select' | 'light' | 'success' | 'error') {
  if (Platform.OS === 'web') return;
  if (kind === 'select') void Haptics.selectionAsync().catch(() => {});
  else if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

function ThinkingDots({ color }: { color: string }) {
  const p = useSharedValue(0.3);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: TIMING.slow }), -1, true);
    return () => cancelAnimation(p);
  }, [p]);
  const dot = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={styles.thinkingRow} testID="voice-thinking">
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={[styles.thinkingDot, { backgroundColor: color }, dot]} />
      ))}
    </View>
  );
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Audio-reactive ring hugging the surface — the "voice is flowing" affordance
 * the user asked for (Gemini-style), reconciled to Ink + Signal: it is ink /
 * state-coloured (never violet), its opacity tracks the live mic/speech level,
 * and it collapses to nothing the instant the exchange goes quiet — glow never
 * idles (Manifesto P4). Purely decorative, so it is hidden from a11y.
 */
function VoiceHalo({ active, level, color, radius }: { active: boolean; level: number; color: string; radius: number }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    const target = active ? 0.22 + clamp01(level) * 0.55 : 0;
    glow.value = withTiming(target, { duration: TIMING.fast });
    return () => cancelAnimation(glow);
  }, [active, level, glow]);
  const style = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.03 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.halo, { borderColor: color, borderRadius: radius }, style]}
    />
  );
}

/**
 * Status dot that gently scales with the live audio level while the exchange is
 * active and rests perfectly still otherwise (no idle motion). Colour alone
 * carries the state; the scale just gives a live session a heartbeat.
 */
function PulseDot({ color, level, active, testID }: { color: string; level: number; active: boolean; testID?: string }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withTiming(active ? 1 + clamp01(level) * 0.6 : 1, { duration: TIMING.fast });
    return () => cancelAnimation(s);
  }, [active, level, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[styles.statusDot, { backgroundColor: color }, style]} testID={testID} />;
}

/**
 * The persistent voice companion.
 *
 * Mounted ONCE above the tab navigator (app/(tabs)/_layout.tsx) so the live
 * audio session survives tab navigation — that's what lets the agent open a tab
 * and keep talking. It is NOT a Modal: the expanded panel is a bottom overlay,
 * so the screen stays visible (and tappable) underneath. Two states: a full
 * panel and a collapsed pill.
 *
 * When `voice_agent_actions` is on it wires the agentic tools (navigate / sync /
 * propose-confirm); otherwise it's the read-only grounding assistant in a
 * persistent panel. Writes only happen on confirm — a tap on a card here or the
 * model calling commitProposedActions after a spoken "yes".
 *
 * Colour: this is the AI's voice surface, and it speaks in INK — every accent is
 * an ink / semantic token, never violet (the voice went violet-free; see the
 * violetVoiceCompliance ratchet, from which this file was removed).
 */
export function VoiceCompanion() {
  const c = useColors();
  // Tokenised depth (Manifesto: never write a raw shadowColor) — the panel is a
  // raised floating surface (z3), the collapsed pill a lighter one (z2).
  const elevation = useElevation('z3');
  const elevationPill = useElevation('z2');
  const router = useRouter();
  const pathname = usePathname();
  // Read the live route through a ref so the currentScreen tool closure stays
  // stable for the session yet always reports where the user actually is.
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  const open = useVoiceStore((s) => s.open);
  const minimized = useVoiceStore((s) => s.minimized);
  const pendingActions = useVoiceStore((s) => s.pendingActions);
  const minimize = useVoiceStore((s) => s.minimize);
  const expand = useVoiceStore((s) => s.expand);
  const close = useVoiceStore((s) => s.close);
  const removePendingAction = useVoiceStore((s) => s.removePendingAction);

  const userId = useUserStore((s) => s.userId);
  // Production gates on the runtime flag (Worker /v1/config, default off). But
  // that flag can't be flipped locally, so ALSO honour a compile-time env
  // override for dev/QA: EXPO_PUBLIC_FLAG_VOICE_AGENT_ACTIONS=true turns the
  // agentic tools on in a local/preview build. Additive — it can only enable,
  // never disable, so it never weakens the production gate.
  const flagOn = useFlagStore((s) => s.isEnabled('voice_agent_actions'));
  const agentic = flagOn || process.env.EXPO_PUBLIC_FLAG_VOICE_AGENT_ACTIONS === 'true';
  const today = format(new Date(), 'yyyy-MM-dd');

  const [input, setInput] = useState('');

  // ── Navigation + screen-context (injected into the agentic tools) ───────────
  const navigate = useCallback(
    (screen: AppScreen, params?: Record<string, string>) => {
      const pathname = ROUTE[screen];
      // ROUTE values are plain strings; cast once to the router's Href (typed
      // routes can't know these dynamic values).
      router.push((params ? { pathname, params } : pathname) as Href);
    },
    [router],
  );
  const currentScreen = useCallback(() => routeToScreen(pathnameRef.current), []);

  // Execute a single confirmed action: navigation intents open the domain screen
  // pre-filled (its own loading UI runs the generation); everything else is a DB
  // write via the existing commitActions path.
  const executeAction = useCallback(
    async (action: ProposedAction) => {
      switch (action.kind) {
        case 'createGoalFromVision':
          navigate('goals', { voiceVision: action.payload.visionStatement, autorun: '1' });
          break;
        case 'generateCareerPath': {
          const p = action.payload;
          const params: Record<string, string> = {
            currentRole: p.currentRole,
            targetRole: p.targetRole,
            timelineMonths: String(p.timelineMonths),
            autorun: '1',
          };
          if (p.weeklyHours) params.weeklyHours = String(p.weeklyHours);
          if (p.constraints) params.constraints = p.constraints;
          navigate('career', params);
          break;
        }
        default:
          await commitActions([action]);
      }
    },
    [navigate],
  );

  // Spoken-yes path: apply everything proposed, then collapse so the user sees
  // the screen we landed on. Returns a count so the model can acknowledge.
  const commitPending = useCallback(async () => {
    const actions = useVoiceStore.getState().pendingActions;
    for (const a of actions) {
      try {
        await executeAction(a);
      } catch {
        // Per-action failure is non-fatal; the rest still apply.
      }
    }
    useVoiceStore.getState().clearPending();
    if (actions.length > 0) {
      tapHaptic('success');
      minimize();
    }
    return { committed: actions.length };
  }, [executeAction, minimize]);

  // Card-tap path for a single proposal.
  const confirmOne = useCallback(
    async (action: ProposedAction, index: number) => {
      removePendingAction(index);
      tapHaptic('success');
      await executeAction(action);
      if (action.kind === 'createGoalFromVision' || action.kind === 'generateCareerPath') minimize();
    },
    [executeAction, removePendingAction, minimize],
  );

  // ── Tools + system instruction ──────────────────────────────────────────────
  const queue = useMemo<ActionQueue>(
    () => ({
      propose: (a) => useVoiceStore.getState().addPendingAction(a),
      list: () => useVoiceStore.getState().pendingActions,
    }),
    [],
  );

  const tools = useMemo(() => {
    if (!userId) return undefined;
    const ctx: ToolContext = {
      userId,
      today,
      navigate: agentic ? navigate : undefined,
      currentScreen: agentic ? currentScreen : undefined,
    };
    return agentic ? buildVoiceTools(ctx, { queue, commitPending }) : buildVoiceTools(ctx);
  }, [userId, today, agentic, navigate, currentScreen, queue, commitPending]);

  const systemInstruction = useMemo(
    () => buildVoiceSystemInstruction({ agentic }),
    [agentic],
  );

  // `preferredVoiceId` is mid-landing — read it via a narrow cast (see VoiceAssistantSheet).
  const storedUser = getUser() as { preferredVoiceId?: string | null } | null | undefined;
  const resolvedVoice = (storedUser?.preferredVoiceId ?? undefined) as
    | VoiceSessionOptions['voice']
    | undefined;

  const voice = useVoice({ systemInstruction, tools, voice: resolvedVoice });

  // Connect/disconnect follow the store's open flag (NOT screen mount), so the
  // session lives across tab navigation.
  useEffect(() => {
    if (open) voice.connect();
    else voice.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reconnect after a surfaced error — resume audio inside the gesture, drop the
  // dead socket, and open a fresh session.
  const handleRetry = useCallback(() => {
    voice.resumeAudio();
    voice.disconnect();
    voice.connect();
  }, [voice]);

  // ── Haptic punctuation on meaningful transitions (native only) ───────────────
  const prevStatusRef = useRef(voice.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = voice.status;
    if (prev === voice.status) return;
    if (voice.status === 'listening') tapHaptic('select');
    else if (voice.status === 'error') tapHaptic('error');
  }, [voice.status]);

  const prevPendingRef = useRef(pendingActions.length);
  useEffect(() => {
    if (pendingActions.length > prevPendingRef.current) tapHaptic('light');
    prevPendingRef.current = pendingActions.length;
  }, [pendingActions.length]);

  // ── HTTP text fallback (live socket down) — mirrors VoiceAssistantSheet ──────
  const [httpMessages, setHttpMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [httpStreaming, setHttpStreaming] = useState<string | null>(null);
  const [httpBusy, setHttpBusy] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const sendViaHttp = async (text: string) => {
    const next = [...httpMessages, { role: 'user' as const, content: text }];
    setHttpMessages(next);
    setHttpBusy(true);
    setHttpStreaming('');
    try {
      let acc = '';
      await callAIStream(
        { system: systemInstruction, messages: next, maxTokens: 800, task: 'chatbot', cacheSystem: true },
        (chunk) => { acc += chunk; setHttpStreaming(acc); },
      );
      setHttpMessages((prev) => [...prev, { role: 'assistant', content: acc.trim() }]);
    } catch {
      setHttpMessages((prev) => [...prev, { role: 'assistant', content: "Couldn't reach the assistant. Please try again." }]);
    } finally {
      setHttpStreaming(null);
      setHttpBusy(false);
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || httpBusy) return;
    setInput('');
    voice.resumeAudio();
    if (voice.isConnected) voice.sendText(trimmed);
    else void sendViaHttp(trimmed);
  };

  if (!open) return null;

  // State reads through ink / semantic tokens only — speaking is ink (the AI's
  // own voice), the rest are the shared semantic signals.
  const statusColor = voice.error
    ? c.error
    : voice.isSpeaking
    ? c.textPrimary
    : voice.isThinking
    ? c.warning
    : voice.isListening
    ? c.success
    : c.textMuted;

  // The reactive halo only lives during a genuine exchange; an error or an idle
  // socket collapses it to nothing (glow never idles).
  const interacting = !voice.error && (voice.isListening || voice.isSpeaking || voice.isThinking);

  // ── Collapsed pill ───────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <Animated.View
        entering={FadeIn.duration(TIMING.normal)}
        exiting={FadeOut.duration(TIMING.fast)}
        style={[styles.pill, elevationPill, { backgroundColor: c.surface, borderColor: c.border }]}
        testID="voice-pill"
      >
        <VoiceHalo active={interacting} level={voice.audioLevel} color={statusColor} radius={999} />
        <PulseDot color={statusColor} level={voice.audioLevel} active={interacting} />
        <Pressable
          style={styles.pillBody}
          onPress={expand}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Expand voice assistant"
        >
          <Caption style={{ color: c.textSecondary }} numberOfLines={1}>
            {voice.transcript || voice.userTranscript || 'Voice assistant — tap to expand'}
          </Caption>
        </Pressable>
        {pendingActions.length > 0 && (
          <View
            style={[styles.badge, { backgroundColor: c.textPrimary }]}
            accessibilityLabel={`${pendingActions.length} suggestion${pendingActions.length === 1 ? '' : 's'} awaiting confirmation`}
          >
            <Caption style={{ color: c.background, fontFamily: fonts.heading }}>{pendingActions.length}</Caption>
          </View>
        )}
        <Pressable onPress={close} hitSlop={8} testID="voice-pill-close" accessibilityRole="button" accessibilityLabel="Close voice assistant">
          <Ionicons name="close" size={18} color={c.textSecondary} />
        </Pressable>
      </Animated.View>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────────
  return (
    <Animated.View
      entering={SlideInDown.duration(TIMING.normal)}
      exiting={SlideOutDown.duration(TIMING.fast)}
      style={[styles.panel, elevation, { backgroundColor: c.surface, borderColor: c.border }]}
      testID="voice-sheet"
    >
      <VoiceHalo active={interacting} level={voice.audioLevel} color={statusColor} radius={23} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="mic" size={20} color={c.textPrimary} />
          <Heading style={{ color: c.textPrimary, fontSize: fontSizes.lg }}>Voice Assistant</Heading>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={minimize} hitSlop={8} testID="voice-minimize" accessibilityRole="button" accessibilityLabel="Minimize voice assistant">
            <Ionicons name="chevron-down" size={22} color={c.textSecondary} />
          </Pressable>
          <Pressable onPress={close} hitSlop={8} testID="voice-close" accessibilityRole="button" accessibilityLabel="Close voice assistant">
            <Ionicons name="close" size={22} color={c.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.statusRow} accessibilityLiveRegion="polite">
        <PulseDot color={statusColor} level={voice.audioLevel} active={interacting} testID="voice-status-dot" />
        <Label color={c.textSecondary} testID="voice-status">
          {voice.error ? 'ERROR' : voice.status.toUpperCase()}
        </Label>
        {voice.isThinking && <ThinkingDots color={c.warning} />}
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.transcript, { borderColor: c.border, backgroundColor: c.card }]}
        contentContainerStyle={styles.transcriptContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {httpMessages.map((m, i) => (
          <View key={`http-${i}`} style={{ marginBottom: spacing.sm }}>
            <Caption style={{ color: c.textMuted, marginBottom: 2 }}>{m.role === 'user' ? 'You' : 'Assistant'}</Caption>
            <Body style={{ color: m.role === 'user' ? c.textSecondary : c.textPrimary, fontSize: fontSizes.sm }}>{m.content}</Body>
          </View>
        ))}
        {httpStreaming !== null && (
          <View style={{ marginBottom: spacing.sm }}>
            <Caption style={{ color: c.textMuted, marginBottom: 2 }}>Assistant</Caption>
            <Body style={{ color: c.textPrimary, fontSize: fontSizes.sm }}>{httpStreaming || '…'}</Body>
          </View>
        )}
        {!!voice.userTranscript && (
          <View style={{ marginBottom: spacing.sm }}>
            <Caption style={{ color: c.textMuted, marginBottom: 2 }}>You</Caption>
            <Body style={{ color: c.textSecondary, fontSize: fontSizes.sm }} testID="voice-user-transcript">{voice.userTranscript}</Body>
          </View>
        )}
        {!!voice.transcript && <Caption style={{ color: c.textMuted, marginBottom: 2 }}>Assistant</Caption>}
        <Body
          style={{ color: voice.transcript ? c.textPrimary : c.textMuted, fontSize: fontSizes.sm }}
          testID="voice-transcript"
        >
          {voice.transcript || (httpMessages.length === 0 && httpStreaming === null ? 'Speak or type — ask about your day, or tell me what to do.' : '')}
        </Body>
        {voice.error && (
          <View style={styles.errorRow}>
            <Caption style={{ color: c.error, flex: 1 }}>{voice.error}</Caption>
            <Pressable
              onPress={handleRetry}
              style={[styles.retryBtn, { borderColor: c.border }]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Retry connection"
              testID="voice-retry"
            >
              <Ionicons name="refresh" size={14} color={c.textSecondary} />
              <Caption style={{ color: c.textSecondary }}>Retry</Caption>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Pending writes — confirm cards (the spoken "yes" path commits the same set) */}
      {pendingActions.map((action, i) => (
        <Animated.View
          key={`${action.kind}-${i}`}
          entering={FadeIn.duration(TIMING.fast)}
          style={[styles.confirmCard, { backgroundColor: c.card, borderColor: c.border }]}
          testID="voice-confirm-card"
        >
          <Ionicons name="sparkles-outline" size={16} color={c.textSecondary} />
          <Body style={{ color: c.textPrimary, fontSize: fontSizes.sm, flex: 1 }} numberOfLines={2}>
            {action.summary}
          </Body>
          <View style={styles.confirmActions}>
            <Pressable
              onPress={() => removePendingAction(i)}
              style={[styles.confirmBtn, { borderColor: c.border, borderWidth: 1 }]}
              hitSlop={6}
              testID="voice-confirm-dismiss"
              accessibilityRole="button"
              accessibilityLabel="Dismiss suggestion"
            >
              <Caption style={{ color: c.textSecondary }}>Dismiss</Caption>
            </Pressable>
            <Pressable
              onPress={() => void confirmOne(action, i)}
              style={[styles.confirmBtn, { backgroundColor: c.textPrimary }]}
              hitSlop={6}
              testID="voice-confirm-apply"
              accessibilityRole="button"
              accessibilityLabel={`Confirm: ${action.summary}`}
            >
              <Caption style={{ color: c.background, fontFamily: fonts.heading }}>Confirm</Caption>
            </Pressable>
          </View>
        </Animated.View>
      ))}

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { backgroundColor: c.card, color: c.textPrimary, borderColor: c.border }]}
          placeholder="Type a message…"
          placeholderTextColor={c.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          testID="voice-input"
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: c.textPrimary }, httpBusy && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={httpBusy}
          testID="voice-send"
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Ionicons name="arrow-up" size={18} color={c.background} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const PANEL_BOTTOM = 96; // clears the 88px tab bar

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: PANEL_BOTTOM,
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    maxHeight: '70%',
    zIndex: 1000,
  },
  pill: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: PANEL_BOTTOM,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 1000,
  },
  // The reactive ring sits just outside the surface edge; negative inset + the
  // matching corner radius keep it concentric. pointerEvents:none so it never
  // eats taps.
  halo: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 2,
  },
  pillBody: { flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  transcript: { minHeight: 120, maxHeight: 240, borderWidth: 1, borderRadius: 16 },
  transcriptContent: { padding: spacing.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 32,
  },
  confirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  confirmActions: { flexDirection: 'row', gap: spacing.sm },
  confirmBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
  },
  sendBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: spacing.xs },
  thinkingDot: { width: 6, height: 6, borderRadius: 3 },
});

export default VoiceCompanion;
