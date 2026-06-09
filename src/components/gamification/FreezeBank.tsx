import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { FREEZE_EARN_XP, MAX_FREEZES_BANKED } from '@/gamification/streakEngine';

interface Props {
  freezes: number;
  progressXP: number;
}

// Streak-freeze bank (streak_protection_v1). Shields are EARNED through XP —
// the strip shows the banked shields plus a quiet progress bar toward the
// next one. Flat resting state per Aurora Refined: no glow, data first.
export function FreezeBank({ freezes, progressXP }: Props) {
  const c = useColors();
  const bankFull = freezes >= MAX_FREEZES_BANKED;
  const pct = bankFull ? 1 : Math.min(1, Math.max(0, progressXP / FREEZE_EARN_XP));

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.row}>
        <Text style={[styles.shields, { color: c.textPrimary }]}>
          {Array.from({ length: MAX_FREEZES_BANKED }, (_, i) => (i < freezes ? '🛡️' : '⬡')).join(' ')}
        </Text>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: c.textPrimary }]}>
            {freezes === 0 ? 'No streak shields banked' : `${freezes} streak shield${freezes > 1 ? 's' : ''} banked`}
          </Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>
            {bankFull
              ? 'Bank full — a missed day auto-spends one to keep your streak.'
              : `${FREEZE_EARN_XP - progressXP} XP until your next shield. Auto-used if a streak would break.`}
          </Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: c.border }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: c.success, width: `${Math.round(pct * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  shields: { fontSize: fontSizes.lg, letterSpacing: 2 },
  copy: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.heading, fontSize: fontSizes.sm },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 16 },
  track: { height: 4, borderRadius: radii.hairline, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.hairline },
});
