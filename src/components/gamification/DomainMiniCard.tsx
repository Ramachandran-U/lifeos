import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { DOMAIN_META, type DomainKey } from '@/constants/gamification';
import { XpBar } from './XpBar';
import { Sparkline } from './Sparkline';

interface Props {
  domainKey: DomainKey;
  score: number;
  delta: number;
  history: number[];
  onPress?: () => void;
}

export function DomainMiniCard({ domainKey, score, delta, history, onPress }: Props) {
  const c = useColors();
  const dm = DOMAIN_META.find((d) => d.key === domainKey)!;
  const color = c[dm.colorKey];
  const positive = delta >= 0;
  const deltaColor = positive ? c.success : c.error;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: color + '33', borderLeftColor: color, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
            <Text style={{ fontSize: 16 }}>{dm.emoji}</Text>
          </View>
          <View>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: c.textSecondary }}>{dm.label}</Text>
            <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: c.textPrimary, lineHeight: 24 }}>{score}</Text>
          </View>
        </View>
        <View style={styles.rightGroup}>
          <View style={[styles.deltaChip, { backgroundColor: deltaColor + '22' }]}>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 11, color: deltaColor }}>
              {positive ? '↑' : '↓'}{Math.abs(delta)}
            </Text>
          </View>
          <Sparkline data={history} color={color} width={72} height={24} />
        </View>
      </View>
      <XpBar pct={score / 100} color={color} height={5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 16,
    gap: 12,
    minHeight: 120,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leftGroup: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rightGroup: { alignItems: 'flex-end', gap: 6 },
  deltaChip: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
});

void fontSizes;
