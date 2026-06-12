import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { useColors, type AppColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Heading, Caption, Label } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { useUserStore } from '@/store/useUserStore';
import {
  getFactsByUser,
  forgetFact,
  setFactPinned,
  updateFact,
  addUserFact,
  deleteAllFactsForUser,
  effectiveSalience,
  isFactLive,
  formatSourceWindow,
  relativeSince,
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<MemoryFact | null>(null);

  const openAdd = () => {
    setEditorInitial(null);
    setEditorOpen(true);
  };
  const openEdit = (fact: MemoryFact) => {
    setEditorInitial(fact);
    setEditorOpen(true);
  };

  const load = useCallback(() => {
    if (!userId) {
      setFacts([]);
      setLoading(false);
      return;
    }
    const now = Date.now();
    const live = getFactsByUser(userId)
      .filter((f) => isFactLive(f, now))
      .sort((a, b) => effectiveSalience(b, now) - effectiveSalience(a, now));
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

  const handleForget = (fact: MemoryFact) => {
    // Deletes AND tombstones, so the next "Refresh" won't re-learn it.
    void forgetFact(fact);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    load();
  };

  const handlePin = (fact: MemoryFact) => {
    setFactPinned(fact.id, !fact.pinned);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    load();
  };

  const handleSaveFact = async (text: string, kind: MemoryFactKind) => {
    const trimmed = text.trim();
    if (trimmed) {
      if (editorInitial) await updateFact(editorInitial.id, trimmed, kind);
      else if (userId) await addUserFact(userId, trimmed, kind);
    }
    setEditorOpen(false);
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
      <InkCanvas />
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Body style={{ color: c.textSecondary }}>← Back</Body>
        </Pressable>
        <Pressable onPress={handleConsolidate} hitSlop={12} disabled={refreshing}>
          <Caption style={{ color: refreshing ? c.textMuted : c.textPrimary, fontFamily: fonts.bodyMedium }}>
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

        <Pressable onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add-circle-outline" size={18} color={c.textSecondary} />
          <Caption style={{ color: c.textPrimary, fontFamily: fonts.bodyMedium }}>Add a memory</Caption>
        </Pressable>

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
                  <Ionicons name={KIND_META[g.kind].icon} size={18} color={c.textSecondary} />
                  <Body style={styles.sectionTitle}>{KIND_META[g.kind].label}</Body>
                  <Caption style={{ color: c.textMuted, marginLeft: 'auto' }}>{g.items.length}</Caption>
                </View>
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {g.items.map((f) => {
                    const strength = effectiveSalience(f, now);
                    const win = formatSourceWindow(f.sourceWindow);
                    const seen = relativeSince(f.lastSeenAt, now);
                    const learned = win
                      ? `From ${win} · seen ${seen}`
                      : `Added ${relativeSince(f.createdAt, now)}`; // no window ⇒ user-authored
                    const provenance = f.pinned
                      ? win
                        ? `Pinned · from ${win}`
                        : 'Pinned'
                      : learned;
                    return (
                      <View key={f.id} style={styles.factRow}>
                        <View style={{ flex: 1 }}>
                          <Body style={{ color: c.textPrimary }}>{f.text}</Body>
                          <View style={styles.strengthTrack}>
                            <View
                              style={[
                                styles.strengthFill,
                                {
                                  width: `${Math.round(strength * 100)}%`,
                                  backgroundColor: f.pinned ? c.success : c.textMuted,
                                },
                              ]}
                            />
                          </View>
                          <View style={styles.provenanceRow}>
                            <Ionicons
                              name={f.pinned ? 'pin' : 'time-outline'}
                              size={11}
                              color={f.pinned ? c.success : c.textMuted}
                            />
                            <Caption style={[styles.provenance, f.pinned && { color: c.success }]}>
                              {provenance}
                            </Caption>
                          </View>
                        </View>
                        <View style={styles.factActions}>
                          <Pressable onPress={() => handlePin(f)} hitSlop={8} style={styles.iconBtn}>
                            <Ionicons
                              name={f.pinned ? 'pin' : 'pin-outline'}
                              size={15}
                              color={f.pinned ? c.success : c.textMuted}
                            />
                          </Pressable>
                          <Pressable onPress={() => openEdit(f)} hitSlop={8} style={styles.iconBtn}>
                            <Ionicons name="pencil-outline" size={14} color={c.textMuted} />
                          </Pressable>
                          <Pressable onPress={() => handleForget(f)} hitSlop={8} style={styles.iconBtn}>
                            <Ionicons name="close" size={16} color={c.textMuted} />
                          </Pressable>
                        </View>
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

      <FactEditorModal
        open={editorOpen}
        initial={editorInitial}
        c={c}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveFact}
      />
    </SafeAreaView>
  );
}

function FactEditorModal({
  open,
  initial,
  c,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: MemoryFact | null; // null = add a new memory
  c: AppColors;
  onClose: () => void;
  onSave: (text: string, kind: MemoryFactKind) => void;
}) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MemoryFactKind>('preference');

  useEffect(() => {
    if (!open) return;
    setText(initial?.text ?? '');
    setKind(initial?.kind ?? 'preference');
  }, [open, initial]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[editorStyles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose}>
        <Pressable style={[editorStyles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Label color={c.primary}>{initial ? 'EDIT MEMORY' : 'ADD A MEMORY'}</Label>
          <TextInput
            style={[editorStyles.input, { color: c.textPrimary, borderColor: c.border, backgroundColor: c.card }]}
            value={text}
            onChangeText={setText}
            placeholder="What should LifeOS remember?"
            placeholderTextColor={c.textMuted}
            multiline
          />
          <View style={editorStyles.kindRow}>
            {KIND_ORDER.map((k) => {
              const active = k === kind;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[
                    editorStyles.kindChip,
                    {
                      borderColor: active ? c.textPrimary : c.border,
                      backgroundColor: active ? c.surfaceAlt : 'transparent',
                    },
                  ]}
                >
                  <Ionicons name={KIND_META[k].icon} size={13} color={active ? c.textPrimary : c.textSecondary} />
                  <Caption style={{ color: active ? c.textPrimary : c.textSecondary }}>{KIND_META[k].label}</Caption>
                </Pressable>
              );
            })}
          </View>
          <View style={editorStyles.actions}>
            <Pressable onPress={onClose} style={editorStyles.cancelBtn}>
              <Body style={{ color: c.textSecondary }}>Cancel</Body>
            </Pressable>
            <Pressable
              onPress={() => onSave(text, kind)}
              disabled={!text.trim()}
              style={[editorStyles.saveBtn, { backgroundColor: c.textPrimary, opacity: text.trim() ? 1 : 0.5 }]}
            >
              <Body style={{ color: c.inkOnColor, fontFamily: fonts.bodyMedium }}>Save</Body>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const editorStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    minHeight: 72,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    textAlignVertical: 'top',
  },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, justifyContent: 'center' },
  saveBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
    subtitle: { color: c.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
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
    provenanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
    provenance: { color: c.textMuted, fontSize: fontSizes.xs },
    factActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    iconBtn: {
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
