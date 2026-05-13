// ─── BadgeCard ───────────────────────────────────────────────────────────────
// Earned badges glow purple; locked badges render a lock emoji at 45% opacity.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { BADGE_META, BadgeId } from '@/utils/gamification';

interface BadgeCardProps {
  badgeId: BadgeId;
  earned: boolean;
}

export function BadgeCard({ badgeId, earned }: BadgeCardProps) {
  const c = useColors();
  const meta = BADGE_META[badgeId];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.label} badge, ${earned ? 'earned' : 'locked'}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: earned ? c.badge + '44' : c.border,
          opacity: earned ? (pressed ? 0.9 : 1) : 0.45,
        },
      ]}
    >
      <View
        style={[
          styles.orb,
          {
            backgroundColor: earned ? c.badge + '22' : c.border + '44',
            borderColor: earned ? c.badge + '66' : c.border,
          },
        ]}
      >
        <Text style={styles.orbEmoji}>{earned ? meta.emoji : '🔒'}</Text>
      </View>
      <View style={styles.meta}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '600', color: c.textPrimary }}
        >
          {meta.label}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonts.body, fontSize: 11, color: c.textMuted, textAlign: 'center', lineHeight: 15 }}
        >
          {meta.desc}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  meta: {
    alignItems: 'center',
    gap: 4,
  },
});
