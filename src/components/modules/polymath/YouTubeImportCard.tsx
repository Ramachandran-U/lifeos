import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Card } from '@/components/ui/Card';
import { Body, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { isYouTubeConnected, startYouTubeOAuth } from '@/integrations/youtube/oauth';
import { fetchSubscribedChannels } from '@/integrations/youtube/client';
import { extractInterestsFromYouTube } from '@/ai/functions';
import type { YouTubeImportedInterest } from '@/ai/types';

type Phase = 'idle' | 'loading' | 'review' | 'error';

/**
 * Import interests from the user's YouTube subscriptions (web-only — Google
 * OAuth is web-only). Connect → fetch subscriptions → AI clusters them into
 * interests → the user reviews/toggles → `onImport` creates the chosen ones.
 */
export function YouTubeImportCard({
  existingInterestNames,
  onImport,
}: {
  existingInterestNames: string[];
  onImport: (items: YouTubeImportedInterest[]) => void;
}) {
  const c = useColors();
  const styles = makeStyles(c);

  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [proposed, setProposed] = useState<YouTubeImportedInterest[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') setConnected(isYouTubeConnected());
  }, []);

  if (Platform.OS !== 'web') return null;

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  const handleConnect = () => {
    if (!clientId) {
      setError('Missing EXPO_PUBLIC_GOOGLE_CLIENT_ID — see .env.example.');
      setPhase('error');
      return;
    }
    void startYouTubeOAuth(clientId); // redirects away; returns to Explore via the callback
  };

  const handleImport = async () => {
    if (!clientId) return;
    setPhase('loading');
    setError(null);
    try {
      const channels = await fetchSubscribedChannels(clientId);
      if (channels.length === 0) {
        setError("No subscriptions found on your account — nothing to import.");
        setPhase('error');
        return;
      }
      const result = await extractInterestsFromYouTube({ channels, existingInterests: existingInterestNames });
      const interests = result?.interests ?? [];
      if (interests.length === 0) {
        setError("Couldn't distil any new interests from your subscriptions.");
        setPhase('error');
        return;
      }
      setProposed(interests);
      setSelected(new Set(interests.map((_, i) => i))); // default: all selected
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setPhase('error');
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const confirm = () => {
    onImport(proposed.filter((_, i) => selected.has(i)));
    setPhase('idle');
    setProposed([]);
    setSelected(new Set());
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="logo-youtube" size={18} color="#FF0000" />
        <Label color={c.polymath}>IMPORT FROM YOUTUBE</Label>
      </View>
      <Caption style={{ color: c.textMuted }}>
        Turn the channels you subscribe to into interests to track. Read-only — only your
        subscriptions are used, and you choose what's added.
      </Caption>

      {!connected ? (
        <Pressable onPress={handleConnect} style={[styles.btn, { backgroundColor: c.polymathLight }]}>
          <Ionicons name="link" size={15} color={c.polymath} />
          <Label color={c.polymath}>Connect YouTube</Label>
        </Pressable>
      ) : (
        <Pressable
          onPress={handleImport}
          disabled={phase === 'loading'}
          style={[styles.btn, { backgroundColor: c.polymathLight }]}
        >
          {phase === 'loading' ? (
            <LoadingDots />
          ) : (
            <>
              <Ionicons name="sparkles" size={15} color={c.polymath} />
              <Label color={c.polymath}>Import interests</Label>
            </>
          )}
        </Pressable>
      )}

      {phase === 'error' && error && <Caption style={{ color: c.error }}>{error}</Caption>}

      <ReviewModal
        visible={phase === 'review'}
        proposed={proposed}
        selected={selected}
        c={c}
        onToggle={toggle}
        onCancel={() => setPhase('idle')}
        onConfirm={confirm}
      />
    </Card>
  );
}

function ReviewModal({
  visible,
  proposed,
  selected,
  c,
  onToggle,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  proposed: YouTubeImportedInterest[];
  selected: Set<number>;
  c: AppColors;
  onToggle: (i: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const styles = makeStyles(c);
  const count = selected.size;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Label color={c.polymath}>REVIEW INTERESTS</Label>
          <Caption style={{ color: c.textMuted }}>
            From your subscriptions. Tap to include or exclude, then add.
          </Caption>
          <ScrollView style={styles.list} contentContainerStyle={{ gap: spacing.xs }}>
            {proposed.map((it, i) => {
              const on = selected.has(i);
              return (
                <Pressable
                  key={`${it.name}-${i}`}
                  onPress={() => onToggle(i)}
                  style={[styles.row, { borderColor: on ? c.polymath : c.border, backgroundColor: on ? c.polymath + '15' : 'transparent' }]}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={on ? c.polymath : c.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Body style={{ color: c.textPrimary, fontFamily: fonts.bodyMedium }}>{it.name}</Body>
                    <Caption style={{ color: c.textMuted }}>
                      {it.category} · {it.weeklyMinutesTarget}m/wk — {it.why}
                    </Caption>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Body style={{ color: c.textSecondary }}>Cancel</Body>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={count === 0}
              style={[styles.confirmBtn, { backgroundColor: c.polymath, opacity: count === 0 ? 0.5 : 1 }]}
            >
              <Body style={{ color: '#FFFFFF', fontFamily: fonts.bodyMedium }}>
                Add {count} interest{count === 1 ? '' : 's'}
              </Body>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    card: { gap: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: 14,
      minHeight: 44,
    },
    backdrop: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      padding: spacing.lg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      gap: spacing.sm,
      maxHeight: '80%',
    },
    list: { marginTop: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: 14,
      borderWidth: 1.5,
    },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
    cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, justifyContent: 'center' },
    confirmBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
