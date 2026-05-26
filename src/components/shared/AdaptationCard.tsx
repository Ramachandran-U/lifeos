import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type AppColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';
import { Card } from '@/components/ui/Card';
import { Body, Caption, Label } from '@/components/ui/Typography';
import { LoadingDots } from '@/components/ui/LoadingDots';
import { useBehaviourSuggestionsStore } from '@/store/useBehaviourSuggestionsStore';
import { useUserStore } from '@/store/useUserStore';
import { applyBehaviourSuggestion } from '@/ai/behaviourApply';
import type { BehaviourSuggestion, ConfidenceLevel } from '@/utils/behaviourPatterns';

interface Props {
  /** Called after a successful apply, so the parent can reload its block list. */
  onApplied?: () => void;
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  low: 'low confidence',
  medium: 'medium confidence',
  high: 'high confidence',
};

const KIND_ICON: Record<BehaviourSuggestion['kind'], string> = {
  workout_timing:         'time-outline',
  session_length:         'contract-outline',
  weekend_drift:          'calendar-outline',
  dropped_habit:          'trash-outline',
  productive_hour_shift:  'trending-up-outline',
};

export function AdaptationCard({ onApplied }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const userId = useUserStore((s) => s.userId);

  const suggestions = useBehaviourSuggestionsStore((s) => s.suggestions);
  const dismiss = useBehaviourSuggestionsStore((s) => s.dismiss);
  const markApplied = useBehaviourSuggestionsStore((s) => s.markApplied);
  const [applying, setApplying] = useState(false);

  const top = suggestions[0];
  if (!top || !userId) return null;

  const handleApply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      const result = await applyBehaviourSuggestion(userId, top);
      if (!result.ok) {
        Alert.alert('Could not apply', result.message);
        return;
      }
      markApplied(top.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onApplied?.();
      // Soft toast — keep it lightweight; the affected count is in the message.
      Alert.alert('Applied', result.message);
    } catch (err) {
      Alert.alert('Apply failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setApplying(false);
    }
  };

  const handleDismiss = () => {
    dismiss(top.id);
    Haptics.selectionAsync();
  };

  return (
    <Card moduleColor={c.primary} style={styles.card}>
      <View style={styles.header}>
        <Ionicons
          name={KIND_ICON[top.kind] as keyof typeof import('@expo/vector-icons').Ionicons.glyphMap}
          size={16}
          color={c.primary}
        />
        <Label color={c.primary}>ADAPTATION</Label>
        <View style={[styles.confidencePill, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Caption style={{ color: c.textMuted }}>{CONFIDENCE_LABEL[top.confidence]}</Caption>
        </View>
      </View>

      <Body style={[styles.headline, { color: c.textPrimary }]}>{top.headline}</Body>
      <Body style={{ color: c.textSecondary }}>{top.rationale}</Body>

      <View style={styles.actions}>
        <Pressable
          onPress={handleDismiss}
          disabled={applying}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: pressed ? c.card : 'transparent',
              borderColor: c.border,
              opacity: applying ? 0.5 : 1,
            },
          ]}
        >
          <Body style={{ color: c.textSecondary }}>Dismiss</Body>
        </Pressable>
        <Pressable
          onPress={handleApply}
          disabled={applying}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            {
              backgroundColor: pressed ? c.primary + 'cc' : c.primary,
              opacity: applying ? 0.7 : 1,
            },
          ]}
        >
          {applying ? (
            <LoadingDots />
          ) : (
            <Body style={{ color: '#FFFFFF', fontFamily: fonts.heading }}>Apply</Body>
          )}
        </Pressable>
      </View>
    </Card>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  confidencePill: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  headline: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    marginTop: spacing.xs,
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
