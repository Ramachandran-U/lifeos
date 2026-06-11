/**
 * Daily summary popup shown after the user completes every block in today's
 * flow. Generates a short, grounded recap of the day via the AI proxy, with a
 * deterministic fallback if the call fails (so the celebration never dead-ends
 * on a network hiccup).
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Body, Caption, Heading } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { callAI } from '@/ai/client';

interface Props {
  visible: boolean;
  onClose: () => void;
  blocks: Array<{ title: string; module: string }>;
}

const SYSTEM = `You are LifeOS. The user just completed every block in today's plan.
Write a short, grounded recap — 2-3 sentences max. Name one concrete thing they
did, acknowledge the consistency without hype, and end with one specific thing to
carry into tomorrow. No emojis, no "amazing job", no exclamation overload.`;

function fallbackSummary(blocks: Props['blocks']): string {
  const n = blocks.length;
  const domains = Array.from(new Set(blocks.map((b) => b.module))).filter((m) => m !== 'rest' && m !== 'meal');
  const domainList = domains.slice(0, 3).join(', ');
  return `You finished all ${n} blocks today${domainList ? ` across ${domainList}` : ''}. That's a full, balanced day done. Tomorrow, protect the first block — starting on time is what made today work.`;
}

export function DailySummarySheet({ visible, onClose, blocks }: Props) {
  const c = useColors();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setSummary(null);
    try {
      const text = await callAI({
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: JSON.stringify({ completedBlocks: blocks.map((b) => ({ title: b.title, module: b.module })) }),
        }],
        maxTokens: 300,
        task: 'dailySummary',
        cacheSystem: true,
      });
      setSummary(text.trim() || fallbackSummary(blocks));
    } catch {
      // Graceful fallback — the celebration shouldn't fail on a network error.
      setSummary(fallbackSummary(blocks));
    } finally {
      setLoading(false);
    }
  }, [blocks]);

  useEffect(() => {
    if (visible) void generate();
  }, [visible, generate]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={[styles.iconBubble, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="checkmark-done" size={22} color={c.success} />
          </View>
          <Heading style={{ color: c.textPrimary }}>Day complete</Heading>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <LoadingDots />
              <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>Looking back at your day…</Caption>
            </View>
          ) : (
            <Body style={[styles.summary, { color: c.textPrimary }]}>{summary}</Body>
          )}
        </ScrollView>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.doneBtn, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Body style={{ color: c.onPrimary, fontFamily: fonts.heading }}>Done</Body>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl,
    maxHeight: '70%',
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  iconBubble: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  summary: { fontSize: fontSizes.lg, lineHeight: 26 },
  doneBtn: { marginTop: spacing.sm, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
