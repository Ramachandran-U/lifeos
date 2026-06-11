import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { BADGE_META, BADGE_TIER, BADGE_TIER_META } from '@/constants/gamification';
import type { BadgeId } from '@/utils/gamification';

interface Props {
  badgeId: BadgeId;
  earned: boolean;
  onPress?: () => void;
}

export function BadgeTile({ badgeId, earned, onPress }: Props) {
  const c = useColors();
  const meta = BADGE_META[badgeId];
  const tier = BADGE_TIER[badgeId];
  // Rarity accent from existing tokens — the tier label carries the meaning
  // (colour-blind safe); colour only reinforces it. Rare = brand violet.
  const tierColor = tier === 'rare' ? c.primary : tier === 'mastery' ? c.xp : c.badge;
  const accent = earned ? tierColor : c.border;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: c.card,
          // Earned state is data — solid tier-accent border.
          borderColor: earned ? accent : c.border,
          opacity: earned ? (pressed ? 0.9 : 1) : 0.5,
        },
      ]}
    >
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 9, letterSpacing: 0.8, color: earned ? accent : c.textMuted }}>
        {BADGE_TIER_META[tier].label.toUpperCase()}
      </Text>
      <View
        style={[
          styles.circle,
          {
            backgroundColor: c.surfaceAlt,
            borderColor: earned ? accent : c.border,
          },
        ]}
      >
        <Text style={{ fontSize: 28 }}>{earned ? meta.emoji : '🔒'}</Text>
      </View>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.textPrimary, textAlign: 'center' }}>
        {meta.label}
      </Text>
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.body, fontSize: 11, color: c.textMuted, textAlign: 'center', lineHeight: 14 }}
      >
        {meta.desc}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    minWidth: 140,
    flex: 1,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
