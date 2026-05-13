import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Button } from '@/components/ui/Button';
import { Body, Heading, Caption, Label } from '@/components/ui/Typography';
import { AuroraBackground } from '@/components/shared/AuroraBackground';
import { Card } from '@/components/ui/Card';
import { useUserStore, type DomainId } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';

const ALL_DOMAINS: { id: DomainId; emoji: string; label: string; colorKey: keyof AppColors }[] = [
  { id: 'goals',    emoji: '◆', label: 'Goals',        colorKey: 'goal' },
  { id: 'health',   emoji: '♥', label: 'Health',       colorKey: 'health' },
  { id: 'finance',  emoji: '◈', label: 'Finance',      colorKey: 'finance' },
  { id: 'career',   emoji: '▲', label: 'Career',       colorKey: 'career' },
  { id: 'social',   emoji: '●', label: 'Social',       colorKey: 'social' },
  { id: 'polymath', emoji: '✦', label: 'Curiosity',    colorKey: 'polymath' },
];

export default function EditPrioritiesScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { userId, primaryDomains, setPrimaryDomains } = useUserStore();

  const [ordered, setOrdered] = useState<DomainId[]>([]);

  useEffect(() => {
    // Selected (in user order) first, then any remaining unselected at the end.
    const selected = primaryDomains.filter((id) => ALL_DOMAINS.some((d) => d.id === id));
    const rest = ALL_DOMAINS.map((d) => d.id).filter((id) => !selected.includes(id));
    setOrdered([...selected, ...rest]);
    // We deliberately seed once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedSet, setSelectedSet] = useState<Set<DomainId>>(
    () => new Set(primaryDomains),
  );

  const haptic = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  };

  const toggle = (id: DomainId) => {
    haptic();
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    haptic();
    setOrdered((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const selectedInOrder = ordered.filter((id) => selectedSet.has(id));
  const canSave = selectedInOrder.length > 0;

  const handleSave = () => {
    if (!userId || !canSave) return;
    updateUser(userId, { primaryDomains: selectedInOrder });
    setPrimaryDomains(selectedInOrder);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <AuroraBackground />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
            </Pressable>
            <Heading style={{ color: c.textPrimary }}>Priorities</Heading>
            <View style={{ width: 24 }} />
          </View>

          <Body style={{ color: c.textSecondary, marginBottom: spacing.lg }}>
            LifeOS shapes your day around these. Toggle what matters, drag the top of the list to set what matters most.
          </Body>

          <Card style={styles.card}>
            <Label style={styles.cardLabel}>YOUR DOMAINS</Label>
            {ordered.map((id, idx) => {
              const meta = ALL_DOMAINS.find((d) => d.id === id);
              if (!meta) return null;
              const isSelected = selectedSet.has(id);
              const color = c[meta.colorKey];
              const selectedIdx = selectedInOrder.indexOf(id);
              const isFirstSelected = isSelected && selectedIdx === 0;
              const isLastSelected = isSelected && selectedIdx === selectedInOrder.length - 1;
              return (
                <View
                  key={id}
                  style={[
                    styles.row,
                    {
                      borderColor: isSelected ? color : c.border,
                      backgroundColor: isSelected ? color + '14' : 'transparent',
                      borderLeftColor: color,
                    },
                  ]}
                >
                  <Pressable onPress={() => toggle(id)} style={styles.rowLeft} hitSlop={4}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? color : c.border,
                          backgroundColor: isSelected ? color : 'transparent',
                        },
                      ]}
                    >
                      {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                    <Body style={[styles.rowEmoji, { color }]}>{meta.emoji}</Body>
                    <Body style={[styles.rowLabel, isSelected && { color: c.textPrimary }]}>
                      {meta.label}
                    </Body>
                    {isSelected && selectedIdx === 0 ? (
                      <Caption style={[styles.priorityTag, { color, borderColor: color }]}>TOP PRIORITY</Caption>
                    ) : null}
                  </Pressable>

                  <View style={styles.rowRight}>
                    <Pressable
                      onPress={() => move(idx, -1)}
                      disabled={idx === 0 || !isSelected || isFirstSelected}
                      style={[
                        styles.arrowBtn,
                        (idx === 0 || !isSelected || isFirstSelected) && { opacity: 0.25 },
                      ]}
                      hitSlop={6}
                    >
                      <Ionicons name="chevron-up" size={18} color={c.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => move(idx, 1)}
                      disabled={idx === ordered.length - 1 || !isSelected || isLastSelected}
                      style={[
                        styles.arrowBtn,
                        (idx === ordered.length - 1 || !isSelected || isLastSelected) && { opacity: 0.25 },
                      ]}
                      hitSlop={6}
                    >
                      <Ionicons name="chevron-down" size={18} color={c.textPrimary} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Card>

          <Caption style={{ color: c.textMuted, marginTop: spacing.md }}>
            Order matters: higher items get more time in your daily routine. Re-generate today's routine after saving for the changes to take effect.
          </Caption>

          <View style={styles.cta}>
            <Button title={canSave ? 'Save priorities' : 'Pick at least one'} onPress={handleSave} disabled={!canSave} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  backBtn: { padding: spacing.xs },
  card: { gap: spacing.sm },
  cardLabel: { color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    minHeight: 56,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEmoji: { fontSize: 18, width: 22, textAlign: 'center' },
  rowLabel: { color: colors.textSecondary, fontSize: fontSizes.md },
  priorityTag: {
    marginLeft: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: spacing.sm },
  arrowBtn: { padding: 4 },
  cta: { marginTop: spacing.xl },
});
