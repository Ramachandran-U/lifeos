import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useUserStore } from '@/store/useUserStore';
import { useFlagStore } from '@/store/useFlagStore';
import { useWhatNext } from '@/hooks/useWhatNext';

/**
 * Today-screen entry point for the "what should I do next?" agent.
 *
 * Gated by the `agent_what_next` flag — renders nothing until the flag is on
 * (which itself requires the proxy's function-calling passthrough to be
 * deployed). When tapped, runs the tool-using agent and shows its one concrete
 * recommendation. State lives in useWhatNext.
 */
export function WhatNextCard() {
  const c = useColors();
  const styles = makeStyles(c);
  const userId = useUserStore((s) => s.userId);
  const enabled = useFlagStore((s) => s.isEnabled('agent_what_next'));
  const { status, answer, error, run, reset } = useWhatNext(userId);

  if (!enabled || !userId) return null;

  const onAsk = () => {
    Haptics.selectionAsync();
    void run();
  };

  return (
    // V4 — AI-speaking surface: violet eyebrow + icon; card neutral.
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={16} color={c.primary} />
        <Label color={c.primary}>WHAT NOW</Label>
      </View>

      {status === 'idle' && (
        <Body style={{ color: c.textSecondary }}>
          Not sure where to put your energy? Ask and I&apos;ll read your day and pick the one thing
          that matters most right now.
        </Body>
      )}

      {status === 'loading' && (
        <View style={styles.loadingRow}>
          <LoadingDots />
          <Caption style={{ color: c.textMuted }}>Reading your goals, routine and momentum…</Caption>
        </View>
      )}

      {status === 'done' && answer && (
        <Body style={[styles.answer, { color: c.textPrimary }]}>{answer}</Body>
      )}

      {status === 'error' && (
        <Body style={{ color: c.error }}>{error ?? 'Something went wrong.'}</Body>
      )}

      <View style={styles.actions}>
        {status === 'done' || status === 'error' ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              reset();
            }}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: pressed ? c.card : 'transparent', borderColor: c.border },
            ]}
          >
            <Body style={{ color: c.textSecondary }}>Dismiss</Body>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onAsk}
          disabled={status === 'loading'}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            {
              backgroundColor: c.primary,
              opacity: status === 'loading' ? 0.7 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {status === 'loading' ? (
            <LoadingDots />
          ) : (
            <Body style={{ color: c.onPrimary, fontFamily: fonts.heading }}>
              {status === 'done' || status === 'error' ? 'Ask again' : 'What should I do next?'}
            </Body>
          )}
        </Pressable>
      </View>
    </Card>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    answer: {
      fontFamily: fonts.heading,
      fontSize: fontSizes.md,
      marginTop: spacing.xs,
      lineHeight: 22,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    btn: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    btnPrimary: {
      borderColor: 'transparent',
    },
  });
