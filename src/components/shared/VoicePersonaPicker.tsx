import { useCallback } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { Body, Caption } from '@/components/ui/Typography';
import { useUserStore } from '@/store/useUserStore';
import { updateUser } from '@/db/queries/users';
import { useVoicePreview } from '@/hooks/useVoicePreview';
import {
  VOICE_PERSONAS_BY_GENDER,
  getVoicePersona,
  type VoicePersona,
  type VoiceGender,
} from '@/ai/voicePersonas';

/**
 * Voice companion persona picker (Settings → Voice).
 *
 * Selection is ink, not brand (Manifesto: selection states are `surfaceAlt` /
 * `textPrimary`, never violet). Picking writes through `updateUser` (so the
 * choice persists + flows through the sync/audit log) and updates the reactive
 * store mirror, which makes an open companion reconnect with the new voice.
 * The speaker button plays a live sample via `useVoicePreview`.
 */

const GROUPS: { gender: VoiceGender; label: string }[] = [
  { gender: 'female', label: 'Female' },
  { gender: 'male', label: 'Male' },
];

export function VoicePersonaPicker() {
  const c = useColors();
  const userId = useUserStore((s) => s.userId);
  const preferredVoiceId = useUserStore((s) => s.preferredVoiceId);
  const setPreferredVoiceId = useUserStore((s) => s.setPreferredVoiceId);
  const { previewingId, error, preview } = useVoicePreview();

  const selectedId = getVoicePersona(preferredVoiceId).id;

  const select = useCallback(
    (persona: VoicePersona) => {
      if (!userId) return;
      Haptics.selectionAsync().catch(() => {});
      updateUser(userId, { preferredVoiceId: persona.id });
      setPreferredVoiceId(persona.id);
    },
    [userId, setPreferredVoiceId],
  );

  const onPreview = useCallback(
    (persona: VoicePersona) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      preview(persona);
    },
    [preview],
  );

  return (
    <View style={styles.root}>
      {GROUPS.map(({ gender, label }) => (
        <View key={gender} style={styles.group}>
          <Caption>{label}</Caption>
          {VOICE_PERSONAS_BY_GENDER[gender].map((persona) => {
            const selected = persona.id === selectedId;
            const playing = previewingId === persona.id;
            return (
              <View
                key={persona.id}
                style={[
                  styles.row,
                  {
                    borderColor: c.border,
                    backgroundColor: selected ? c.surfaceAlt : 'transparent',
                  },
                ]}
              >
                <Pressable
                  style={styles.rowMain}
                  onPress={() => select(persona)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${persona.name} — ${persona.blurb}`}
                >
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={selected ? c.textPrimary : c.textMuted}
                  />
                  <View style={styles.rowText}>
                    <Body color={selected ? c.textPrimary : c.textSecondary}>{persona.name}</Body>
                    <Caption>{persona.blurb}</Caption>
                  </View>
                </Pressable>
                <Pressable
                  style={styles.previewBtn}
                  onPress={() => onPreview(persona)}
                  accessibilityRole="button"
                  accessibilityLabel={playing ? `Stop preview of ${persona.name}` : `Hear ${persona.name}`}
                  hitSlop={spacing.sm}
                >
                  {playing ? (
                    <ActivityIndicator size="small" color={c.textPrimary} />
                  ) : (
                    <Ionicons name="volume-medium-outline" size={22} color={c.textSecondary} />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
      {error ? <Caption color={c.error}>{error}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  group: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.control,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  previewBtn: {
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
