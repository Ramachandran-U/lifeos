import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors } from '@/theme/colors';
import { useStaggerDelay } from '@/theme/motion';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { InkCanvas } from '@/components/shared/InkCanvas';
import { Button3D } from '@/components/ui/Button3D';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Body, Heading, Label, Caption } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useAI } from '@/hooks/useAI';
import { suggestInterestAreas } from '@/ai/functions';
import { useUserStore } from '@/store/useUserStore';
import { createInterest } from '@/db/queries/interests';
import { usePolymathStore } from '@/store/usePolymathStore';
import { logBehaviourEvent } from '@/db/queries/behaviour';
import type { InterestCategory, SuggestedArea } from '@/ai/types';

const CATEGORIES: Array<{ value: InterestCategory; label: string }> = [
  { value: 'arts',       label: 'Arts'       },
  { value: 'science',    label: 'Science'    },
  { value: 'tech',       label: 'Tech'       },
  { value: 'sports',     label: 'Sports'     },
  { value: 'music',      label: 'Music'      },
  { value: 'writing',    label: 'Writing'    },
  { value: 'language',   label: 'Language'   },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'other',      label: 'Other'      },
];

interface Draft {
  id: string;
  name: string;
  category: InterestCategory;
  weeklyMinutes: number;
}

function newDraft(name = '', category: InterestCategory = 'other'): Draft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    category,
    weeklyMinutes: 60,
  };
}

const MINUTES_OPTIONS = [30, 60, 120, 180];

export default function Day14PolymathScreen() {
  const router = useRouter();
  const c = useColors();
  const stagger = useStaggerDelay();
  const styles = makeStyles(c);
  const { call, loading } = useAI();
  const { userId } = useUserStore();
  const markModuleActivated = useUserStore((s) => s.markModuleActivated);
  const setSuggestions = usePolymathStore((s) => s.setSuggestions);

  const [drafts, setDrafts] = useState<Draft[]>([newDraft(), newDraft()]);
  const [suggestions, setLocalSuggestions] = useState<SuggestedArea[] | null>(null);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const filledDrafts = drafts.filter((d) => d.name.trim().length > 0);

  const handleSuggest = async () => {
    if (filledDrafts.length === 0) {
      Alert.alert('Add at least one interest', 'Name something you want to explore.');
      return;
    }
    const result = await call(() =>
      suggestInterestAreas({
        existingInterests: filledDrafts.map((d) => ({ name: d.name.trim(), category: d.category })),
      }),
    );
    if (result) {
      setLocalSuggestions(result.areas);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleContinue = () => {
    if (!userId || filledDrafts.length === 0) return;
    try {
      const createdIds: string[] = [];
      filledDrafts.forEach((d) => {
        const id = createInterest({
          userId,
          name: d.name.trim(),
          category: d.category,
          weeklyMinutesTarget: d.weeklyMinutes,
          explorationDepth: 'hobbyist',
          discoveredBy: 'user',
        });
        createdIds.push(id);
      });
      if (suggestions) setSuggestions(suggestions, createdIds);
      logBehaviourEvent('onboarding_day14_polymath', 'polymath', { interests: filledDrafts.length });
      markModuleActivated('polymath');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Could not save interests', err instanceof Error ? err.message : 'Unknown error');
      return;
    }
    router.replace('/(tabs)/explore');
  };

  return (
    <SafeAreaView style={styles.container}>
      <InkCanvas />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
          </Pressable>

          <Animated.View entering={FadeInDown.duration(500)}>
            <Caption style={{ color: c.polymath, letterSpacing: 1.5 }}>DAY 14 · POLYMATH</Caption>
            <Heading style={styles.title}>What pulls your curiosity?</Heading>
            <Body style={styles.subtitle}>
              Name 1-3 things you'd like to spend time on each week. We'll suggest adjacent fields you might not have considered.
            </Body>
          </Animated.View>

          <View style={styles.form}>
            {drafts.map((d, idx) => (
              <Card key={d.id} style={styles.row}>
                <Label color={c.textMuted}>INTEREST {idx + 1}</Label>
                <Input
                  value={d.name}
                  onChangeText={(name) => updateDraft(d.id, { name })}
                  placeholder="e.g. Astronomy, Jazz piano, Stoicism"
                />
                <Label style={styles.fieldLabel}>Category</Label>
                <View style={styles.chipGrid}>
                  {CATEGORIES.map((cat, i) => {
                    const active = cat.value === d.category;
                    return (
                      <Animated.View key={cat.value} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                        <Pressable
                          onPress={() => updateDraft(d.id, { category: cat.value })}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: active ? c.polymathDim : c.surface,
                              borderColor: active ? c.polymath : c.border,
                            },
                          ]}
                        >
                          <Caption style={{ color: active ? c.polymath : c.textSecondary }}>{cat.label}</Caption>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
                <Label style={styles.fieldLabel}>Minutes per week</Label>
                <View style={styles.chipRow}>
                  {MINUTES_OPTIONS.map((m, i) => {
                    const active = m === d.weeklyMinutes;
                    return (
                      <Animated.View key={m} entering={FadeIn.delay(200 + stagger(i, 40)).duration(300)}>
                        <Pressable
                          onPress={() => updateDraft(d.id, { weeklyMinutes: m })}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: active ? c.polymathDim : c.surface,
                              borderColor: active ? c.polymath : c.border,
                            },
                          ]}
                        >
                          <Caption style={{ color: active ? c.polymath : c.textSecondary }}>{m}m</Caption>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
              </Card>
            ))}

            {drafts.length < 3 ? (
              <Pressable
                onPress={() => setDrafts((prev) => [...prev, newDraft()])}
                style={({ pressed }) => [
                  styles.addRow,
                  {
                    borderColor: pressed ? c.polymath : c.border,
                    backgroundColor: pressed ? c.polymathDim : 'transparent',
                  },
                ]}
              >
                <Ionicons name="add" size={18} color={c.polymath} />
                <Body style={{ color: c.polymath }}>Add another</Body>
              </Pressable>
            ) : null}

            {loading ? (
              <Card style={styles.previewCard}>
                <LoadingDots />
                <Caption style={{ color: c.textMuted, marginTop: spacing.sm }}>
                  Looking for adjacent fields…
                </Caption>
              </Card>
            ) : suggestions ? (
              <Card style={styles.previewCard}>
                <Label color={c.polymathText}>YOU MIGHT ALSO ENJOY</Label>
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  {suggestions.slice(0, 4).map((s, i) => (
                    <View key={i} style={[styles.suggestion, { borderColor: c.border }]}>
                      <Body style={{ color: c.textPrimary, fontFamily: fonts.heading }}>{s.name}</Body>
                      <Caption style={{ color: c.textMuted }}>{s.blurb}</Caption>
                    </View>
                  ))}
                </View>
              </Card>
            ) : (
              <Button3D
                title="Suggest adjacent fields"
                tone="polymath"
                onPress={handleSuggest}
                disabled={filledDrafts.length === 0}
              />
            )}

            <Button3D
              title="Save & open Explore"
              tone="polymath"
              onPress={handleContinue}
              disabled={filledDrafts.length === 0}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  back: { alignSelf: 'flex-start', paddingTop: spacing.sm },
  title: { fontSize: fontSizes.hero, marginTop: spacing.xs, color: c.textPrimary, fontFamily: fonts.display },
  subtitle: { color: c.textSecondary, marginTop: spacing.xs },
  form: { gap: spacing.sm, marginTop: spacing.md },
  row: { gap: spacing.xs },
  fieldLabel: { marginTop: spacing.xs },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  previewCard: { marginTop: spacing.sm },
  suggestion: {
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
});
