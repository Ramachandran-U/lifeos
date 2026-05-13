// ─── DomainMiniCard ──────────────────────────────────────────────────────────
// Embeddable 280×140 card for each domain: score, delta vs last week,
// sparkline, and an XP bar showing % of 100.

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { DOMAIN_META, DomainKey } from '@/utils/gamification';
import { Sparkline } from './Sparkline';
import { XPBar } from './XPBar';

interface DomainMiniCardProps {
  domainKey: DomainKey;
  score: number;
  delta: number;
  xpHistory: number[];
  onPress?: () => void;
}

export function DomainMiniCard({ domainKey, score, delta, xpHistory, onPress }: DomainMiniCardProps) {
  const c = useColors();
  const dm = DOMAIN_META.find((d) => d.key === domainKey);
  if (!dm) return null;

  const color = (c as unknown as Record<string, string>)[dm.colorKey] ?? c.primary;
  const deltaPos = delta >= 0;
  const deltaColor = deltaPos ? c.success : c.error;

  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: color + '33',
        },
      ]}
    >
      <View style={styles.top}>
        <View style={styles.left}>
          <View style={[styles.emoji, { backgroundColor: color + '22' }]}>
            <Text style={{ fontSize: 16 }}>{dm.emoji}</Text>
          </View>
          <View>
            <Text style={[styles.label, { color: c.textSecondary }]}>{dm.label}</Text>
            <Text style={[styles.score, { color: c.textPrimary }]}>{score}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <View
            style={[
              styles.deltaChip,
              { backgroundColor: deltaColor + '22' },
            ]}
          >
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {deltaPos ? '↑' : '↓'}{Math.abs(delta)}
            </Text>
          </View>
          <Sparkline data={xpHistory} color={color} width={80} height={28} />
        </View>
      </View>
      <XPBar pct={score / 100} color={color} height={5} />
    </View>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    minHeight: 140,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  right: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deltaChip: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  deltaText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
  },
});
