import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Heading, Body, Label, Caption } from '@/components/ui/Typography';
import { useVoice } from '@/hooks/useVoice';
import { useStaggerDelay } from '@/theme/motion';

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
    : voice.isConnected
    ? 'LISTENING'
    : 'CONNECTING…';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: c.background + 'CC' }]}>
        <View
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
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: voice.error
                    ? c.error
                    : voice.isConnected
                    ? c.success
                    : c.textMuted,
                },
              ]}
            />
            <Label color={c.textSecondary}>{statusLabel}</Label>
          </Animated.View>

          <ScrollView
            style={[styles.transcript, { borderColor: c.border, backgroundColor: c.card }]}
            contentContainerStyle={styles.transcriptContent}
          >
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
            Mic streaming ships with the dev build — text works everywhere.
          </Caption>
        </View>
      </View>
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
});
