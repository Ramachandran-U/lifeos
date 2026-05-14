import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { STREAK_META, type StreakKey } from '@/constants/gamification';
import { StreakFlame } from './StreakFlame';
import { XpBar } from './XpBar';

interface Props {
  streakKey: StreakKey;
  count: number;
  best: number;
  graceUsed: boolean;
}

export function StreakRow({ streakKey, count, best, graceUsed }: Props) {
  const c = useColors();
  const meta = STREAK_META[streakKey];
  const color = c[meta.colorKey];
  const pct = Math.min(1, count / 30);
  const bestPct = Math.min(1, best / 30);
  const size = count >= 20 ? 'lg' : count >= 10 ? 'md' : 'sm';

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderLeftColor: color }]}>
      <View style={styles.flameCol}>
        <StreakFlame count={count} graceUsed={graceUsed} size={size} />
      </View>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.textPrimary }}>
              {meta.label}
            </Text>
            {graceUsed && (
              <View style={[styles.grace, { backgroundColor: c.warning + '22', borderColor: c.warning + '55' }]}>
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 10, color: c.warning }}>GRACE</Text>
              </View>
            )}
          </View>
          <View style={styles.statsRow}>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.textMuted }}>
              Best: <Text style={{ color: c.textSecondary }}>{best}</Text>
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.textMuted }}>
              Now: <Text style={{ color: c.textPrimary }}>{count}</Text>
            </Text>
          </View>
        </View>
        <View style={styles.barWrap}>
          <XpBar pct={pct} color={color} height={6} />
          <View
            style={[
              styles.marker,
              { left: `${bestPct * 100}%`, backgroundColor: color + '99' },
            ]}
          />
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 10, color: c.textMuted, marginTop: 4 }}>
          {Math.max(0, 30 - count)} days to 30-day badge
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 2,
    padding: 14,
  },
  flameCol: { width: 56, alignItems: 'center' },
  body: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statsRow: { flexDirection: 'row', gap: 10 },
  grace: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  barWrap: { position: 'relative' },
  marker: { position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 1 },
});
