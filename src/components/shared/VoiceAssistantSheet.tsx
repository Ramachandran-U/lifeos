import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View, ScrollView } from 'react-native';
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
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Heading, Body, Label, Caption } from '@/components/ui/Typography';
import { useVoice, type VoiceStatus } from '@/hooks/useVoice';
import { SPRING, useStaggerDelay } from '@/theme/motion';

// ─── Status presentation ──────────────────────────────────────────────────────
function statusColor(c: AppColors, status: VoiceStatus, hasError: boolean): string {
  if (hasError) return c.error;
  switch (status) {
    case 'speaking':
      return c.primary;
    case 'thinking':
      return c.warning;
    case 'listening':
      return c.success;
    case 'connecting':
    case 'idle':
    case 'error':
    default:
      return c.textMuted;
  }
}

function statusHelp(status: VoiceStatus, userSpeaking: boolean, hasError: boolean): string {
  if (hasError) return 'Something went wrong — try again.';
  switch (status) {
    case 'connecting':
      return 'Connecting…';
    case 'listening':
      return userSpeaking ? "I hear you — keep going." : "Listening — go ahead and speak.";
    case 'thinking':
      return 'Thinking…';
    case 'speaking':
      return 'Speaking…';
    default:
      return 'Speak or type to begin.';
  }
}

// Three pulsing dots shown while the assistant is thinking.
function ThinkingDots({ color }: { color: string }) {
  const p = useSharedValue(0.3);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
    return () => cancelAnimation(p);
  }, [p]);
  const dot = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={styles.thinkingRow} testID="voice-thinking">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[styles.thinkingDot, { backgroundColor: color }, dot]}
        />
      ))}
    </View>
  );
}

interface VoiceAssistantSheetProps {
  visible: boolean;
  onClose: () => void;
  systemInstruction?: string;
}

export function VoiceAssistantSheet({
  visible,
  onClose,
  systemInstruction,
}: VoiceAssistantSheetProps) {
  const c = useColors();
  const [input, setInput] = useState('');
  const voice = useVoice({ systemInstruction });
  // 50 ms step matches MOTION scene-06 chart for inner stagger.
  const stagger = useStaggerDelay();

  useEffect(() => {
    if (visible) voice.connect();
    else voice.disconnect();
  }, [visible]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    voice.sendText(trimmed);
    setInput('');
  };

  const statusLabel = voice.error
    ? 'ERROR'
    : voice.isSpeaking
    ? 'SPEAKING'
    : voice.isThinking
    ? 'THINKING'
    : voice.isListening
    ? voice.userSpeaking
      ? 'LISTENING…'
      : 'LISTENING'
    : voice.isConnected
    ? 'CONNECTED'
    : 'CONNECTING…';

  const helpText = statusHelp(voice.status, voice.userSpeaking, !!voice.error);
  const dotColor = statusColor(c, voice.status, !!voice.error);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(480).delay(150)}
        exiting={FadeOut.duration(460).delay(80)}
        style={[styles.backdrop, { backgroundColor: c.background + 'CC' }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.springify().stiffness(SPRING.soft.stiffness).damping(SPRING.soft.damping)}
        exiting={SlideOutDown.duration(520)}
        style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}
        testID="voice-sheet"
      >
          <Animated.View entering={FadeIn.delay(700 + stagger(0, 50)).duration(320)} style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="mic" size={20} color={c.primary} />
              <Heading style={{ color: c.textPrimary, fontSize: fontSizes.lg }}>Voice Assistant</Heading>
            </View>
            <Pressable onPress={onClose} hitSlop={8} testID="voice-close">
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(700 + stagger(1, 50)).duration(320)} style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} testID="voice-status-dot" />
            <Label color={c.textSecondary} testID="voice-status">{statusLabel}</Label>
          </Animated.View>

          {/* Plain-language hint so the user always knows the current state. */}
          <Caption style={{ color: c.textSecondary, textAlign: 'center' }} testID="voice-status-help">
            {helpText}
          </Caption>

          {/* Audio waveform — shows mic intensity while listening */}
          {voice.isListening && (
            <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.waveRow} testID="voice-wave">
              {[0.6, 0.8, 1.0, 0.9, 0.7, 0.5, 0.85].map((weight, i) => {
                const h = Math.max(4, voice.audioLevel * weight * 32);
                return (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: h,
                        backgroundColor: c.primary,
                        opacity: 0.5 + voice.audioLevel * 0.5,
                      },
                    ]}
                  />
                );
              })}
            </Animated.View>
          )}

          {/* Processing indicator — model is generating a reply. */}
          {voice.isThinking && (
            <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
              <ThinkingDots color={c.warning} />
            </Animated.View>
          )}

          {/* Speaking indicator — model audio is playing back. */}
          {voice.isSpeaking && (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={styles.speakingRow}
              testID="voice-speaking"
            >
              <Ionicons name="volume-high" size={16} color={c.primary} />
              <Caption style={{ color: c.primary }}>Responding…</Caption>
            </Animated.View>
          )}

          <ScrollView
            style={[styles.transcript, { borderColor: c.border, backgroundColor: c.card }]}
            contentContainerStyle={styles.transcriptContent}
          >
            {!!voice.userTranscript && (
              <View style={{ marginBottom: spacing.sm }}>
                <Caption style={{ color: c.textMuted, marginBottom: 2 }}>You</Caption>
                <Body
                  style={{ color: c.textSecondary, fontSize: fontSizes.sm }}
                  testID="voice-user-transcript"
                >
                  {voice.userTranscript}
                </Body>
              </View>
            )}
            {!!voice.transcript && (
              <Caption style={{ color: c.textMuted, marginBottom: 2 }}>Assistant</Caption>
            )}
            <Body
              style={{
                color: voice.transcript ? c.textPrimary : c.textMuted,
                fontSize: fontSizes.sm,
              }}
              testID="voice-transcript"
            >
              {voice.transcript || 'Ask anything about your day, goals, or routine.'}
            </Body>
            {voice.error && (
              <Caption style={{ color: c.error, marginTop: spacing.sm }}>
                {voice.error}
              </Caption>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: c.card, color: c.textPrimary, borderColor: c.border },
              ]}
              placeholder="Type a message…"
              placeholderTextColor={c.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              testID="voice-input"
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: c.primary }]}
              onPress={handleSend}
              testID="voice-send"
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          </View>

          <Caption style={{ color: c.textMuted, textAlign: 'center' }}>
            Speak or type — the assistant hears you and responds when you pause.
          </Caption>
        </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  transcript: {
    minHeight: 160,
    maxHeight: 320,
    borderWidth: 1,
    borderRadius: 16,
  },
  transcriptContent: {
    padding: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 40,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 24,
  },
  thinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  speakingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 24,
  },
});
