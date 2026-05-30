import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { useUserStore } from '@/store/useUserStore';
import {
  getFactsByUser,
  deleteFact,
  deleteAllFactsForUser,
  decayedSalience,
  isFactLive,
  type MemoryFact,
  type MemoryFactKind,
} from '@/ai/rag/memoryStore';
import { consolidateMemory } from '@/ai/memory/consolidate';

const KIND_META: Record<MemoryFactKind, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  preference: { label: 'Preferences', icon: 'heart-outline' },
  pattern: { label: 'Patterns', icon: 'repeat-outline' },
  milestone: { label: 'Milestones', icon: 'flag-outline' },
  constraint: { label: 'Constraints', icon: 'lock-closed-outline' },
};

const KIND_ORDER: MemoryFactKind[] = ['milestone', 'pattern', 'preference', 'constraint'];

export default function WhatLifeOSRemembersScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);

  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(() => {
    if (!userId) {
      setFacts([]);
      setLoading(false);
      return;
    }
    const now = Date.now();
    const live = getFactsByUser(userId)
      .filter((f) => isFactLive(f, now))
      .sort((a, b) => decayedSalience(b.salience, b.lastSeenAt, now) - decayedSalience(a.salience, a.lastSeenAt, now));
    setFacts(live);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConsolidate = async () => {
    if (!userId || refreshing) return;
    setRefreshing(true);
    try {
      await consolidateMemory(userId);
      load();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteFact(id);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    load();
  };

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    if (userId) deleteAllFactsForUser(userId);
    setConfirmClear(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    load();
  };

  const now = Date.now();
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: facts.filter((f) => f.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <SafeAreaView style={styles.root}>
      <AuroraBackground />
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Body style={{ color: c.textSecondary }}>← Back</Body>
        </Pressable>
        <Pressable onPress={handleConsolidate} hitSlop={12} disabled={refreshing}>
          <Caption style={{ color: refreshing ? c.textMuted : c.primary, fontFamily: fonts.bodyMedium }}>
            {refreshing ? 'Thinking…' : 'Refresh'}
          </Caption>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Heading style={styles.title}>What LifeOS remembers</Heading>
        <Body style={styles.subtitle}>
          Lasting facts I've learned about you over time. These shape your plans long after the
          day-to-day fades. Delete anything that's wrong or you'd rather I forget.
        </Body>

        {loading ? (
          <Caption style={styles.empty}>Loading…</Caption>
        ) : facts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="bulb-outline" size={48} color={c.textMuted} />
            <Body style={{ color: c.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>
              Nothing remembered yet
            </Body>
            <Caption style={{ color: c.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
              As you complete and reflect on your days, I'll distil the lasting patterns here.
              Tap “Refresh” to consolidate what you've done so far.
            </Caption>
          </View>
        ) : (
          <>
            {grouped.map((g) => (
              <Card key={g.kind} style={styles.section}>
                <View style={styles.sectionHead}>
                  <Ionicons name={KIND_META[g.kind].icon} size={18} color={c.primary} />
                  <Body style={styles.sectionTitle}>{KIND_META[g.kind].label}</Body>
                  <Caption style={{ color: c.textMuted, marginLeft: 'auto' }}>{g.items.length}</Caption>
                </View>
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {g.items.map((f) => {
                    const strength = decayedSalience(f.salience, f.lastSeenAt, now);
                    return (
                      <View key={f.id} style={styles.factRow}>
                        <View style={{ flex: 1 }}>
                          <Body style={{ color: c.textPrimary }}>{f.text}</Body>
                          <View style={styles.strengthTrack}>
                            <View
                              style={[
                                styles.strengthFill,
                                { width: `${Math.round(strength * 100)}%`, backgroundColor: c.primary },
                              ]}
                            />
                          </View>
                        </View>
                        <Pressable onPress={() => handleDelete(f.id)} hitSlop={10} style={styles.deleteBtn}>
                          <Ionicons name="close" size={16} color={c.textMuted} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </Card>
            ))}

            <Pressable
              onPress={handleClearAll}
              style={({ pressed }) => [
                styles.clearBtn,
                {
                  borderColor: confirmClear ? c.error : c.border,
                  backgroundColor: pressed ? c.card : 'transparent',
                },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={confirmClear ? c.error : c.textSecondary} />
              <Caption style={{ color: confirmClear ? c.error : c.textSecondary, fontFamily: fonts.bodyMedium }}>
                {confirmClear ? 'Tap again to forget everything' : 'Forget everything'}
              </Caption>
            </Pressable>

            <Caption style={styles.footer}>
              The bar shows how strongly I weigh each fact — it fades over time unless reinforced by
              what you do.
            </Caption>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
    title: { color: c.textPrimary, marginTop: spacing.sm },
    subtitle: { color: c.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
    section: { gap: spacing.xs },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sectionTitle: { fontFamily: fonts.heading, fontSize: fontSizes.md, color: c.textPrimary },
    factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    strengthTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: c.border,
      overflow: 'hidden',
      marginTop: 6,
    },
    strengthFill: { height: '100%' },
    deleteBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    clearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: spacing.sm,
    },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: spacing.xxl },
    emptyWrap: { paddingTop: spacing.xxxl, paddingHorizontal: spacing.xl, alignItems: 'center' },
    footer: { color: c.textMuted, textAlign: 'center', marginTop: spacing.md },
  });
