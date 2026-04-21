import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { BADGE_META } from '@/constants/gamification';
import type { BadgeId } from '@/utils/gamification';

interface Props {
  badgeId: BadgeId;
  earned: boolean;
  onPress?: () => void;
}

export function BadgeTile({ badgeId, earned, onPress }: Props) {
  const c = useColors();
  const meta = BADGE_META[badgeId];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: c.card,
          borderColor: earned ? c.badge + '55' : c.border,
          opacity: earned ? (pressed ? 0.9 : 1) : 0.5,
        },
      ]}
    >
      <View
        style={[
          styles.circle,
          {
            backgroundColor: earned ? c.badge + '22' : c.border + '44',
            borderColor: earned ? c.badge + '66' : c.border,
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
