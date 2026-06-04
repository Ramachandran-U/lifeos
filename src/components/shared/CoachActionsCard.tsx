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
import { useCoachActions } from '@/hooks/useCoachActions';

/**
 * Today-screen entry point for the propose-and-confirm coach — the acting
 * sibling of WhatNextCard. Runs the agent, shows its one recommendation, and
 * renders each proposed action as a card the user confirms (or skips) one at a
 * time. Nothing mutates until Confirm: useCoachActions → commitActions maps a
 * confirmed proposal to a real DB query.
 *
 * Gated by `ai_coach_actions` (default off). Mounted instead of WhatNextCard
 * when on, so only one "what next" card shows.
 */
export function CoachActionsCard() {
  const c = useColors();
  const styles = makeStyles(c);
  const userId = useUserStore((s) => s.userId);
  const enabled = useFlagStore((s) => s.isEnabled('ai_coach_actions'));
  const { status, answer, error, proposals, run, reset, confirm, dismiss } = useCoachActions(userId);

  if (!enabled || !userId) return null;

  const onAsk = () => {
    Haptics.selectionAsync();
    void run();
  };

  const visible = proposals.filter((p) => p.state !== 'dismissed');

  return (
    <Card moduleColor={c.primary} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles-outline" size={16} color={c.primary} />
        <Label color={c.primary}>YOUR COACH</Label>
      </View>

      {status === 'idle' && (
        <Body style={{ color: c.textSecondary }}>
          Ask and I&apos;ll read your day, pick the one thing that matters most, and offer to set it
          up — you confirm before anything changes.
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

      {status === 'done' && visible.length > 0 && (
        <View style={styles.proposals}>
          {visible.map((p) => {
            const index = proposals.indexOf(p);
            return (
              <View key={index} style={[styles.proposal, { borderColor: c.border }]}>
                <Body style={styles.proposalText}>{p.action.summary}</Body>
                {p.state === 'pending' && (
                  <View style={styles.proposalActions}>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        dismiss(index);
                      }}
                      style={({ pressed }) => [
                        styles.smallBtn,
                        { borderColor: c.border, backgroundColor: pressed ? c.card : 'transparent' },
                      ]}
                    >
                      <Caption style={{ color: c.textSecondary }}>Skip</Caption>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        void confirm(index);
                      }}
                      style={({ pressed }) => [
                        styles.smallBtn,
                        { borderColor: 'transparent', backgroundColor: pressed ? c.primary + 'cc' : c.primary },
                      ]}
                    >
                      <Caption style={{ color: '#FFFFFF', fontFamily: fonts.heading }}>Confirm</Caption>
                    </Pressable>
                  </View>
                )}
                {p.state === 'committing' && <LoadingDots />}
                {p.state === 'done' && (
                  <Ionicons name="checkmark-circle" size={22} color={c.success} />
                )}
                {p.state === 'failed' && (
                  <Caption style={{ color: c.error }}>{p.error ?? "Couldn't apply"}</Caption>
                )}
              </View>
            );
          })}
        </View>
      )}

      {status === 'error' && <Body style={{ color: c.error }}>{error ?? 'Something went wrong.'}</Body>}

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
            <Body style={{ color: c.textSecondary }}>Close</Body>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onAsk}
          disabled={status === 'loading'}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            {
              backgroundColor: pressed ? c.primary + 'cc' : c.primary,
              opacity: status === 'loading' ? 0.7 : 1,
            },
          ]}
        >
          {status === 'loading' ? (
            <LoadingDots />
          ) : (
            <Body style={{ color: '#FFFFFF', fontFamily: fonts.heading }}>
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
    proposals: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    proposal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 52,
    },
    proposalText: {
      flex: 1,
      color: c.textPrimary,
    },
    proposalActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    smallBtn: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: 10,
      borderWidth: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
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
