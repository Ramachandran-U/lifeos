import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { xpForLevel } from '@/utils/gamification';
import { LEVEL_PERKS } from '@/constants/gamification';

interface Props {
  currentLevel: number;
}

export function LevelLadder({ currentLevel }: Props) {
  const c = useColors();
  const steps = [currentLevel, currentLevel + 1, currentLevel + 2, currentLevel + 3, currentLevel + 4];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {steps.map((lvl, i) => {
        const isCurrent = lvl === currentLevel;
        const perks = LEVEL_PERKS[lvl] ?? [];
        return (
          <View key={lvl} style={styles.stepGroup}>
            {i > 0 && (
              <View style={[styles.connector, { backgroundColor: isCurrent ? c.primary : c.border }]} />
            )}
            <View style={styles.stepCol}>
              <View
                style={[
                  styles.circle,
                  {
                    width: isCurrent ? 68 : 52,
                    height: isCurrent ? 68 : 52,
                    borderRadius: isCurrent ? 34 : 26,
                    backgroundColor: isCurrent ? c.primary : c.card,
                    borderColor: isCurrent ? c.primary : c.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: isCurrent ? 20 : 16,
                    color: isCurrent ? '#FFF' : c.textMuted,
                  }}
                >
                  {lvl}
                </Text>
                {isCurrent && (
                  <Text style={{ fontFamily: fonts.body, fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>
                    YOU
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.perkCard,
                  { backgroundColor: c.card, borderColor: isCurrent ? c.primary + '55' : c.border },
                ]}
              >
                <Text style={{ fontFamily: fonts.heading, fontSize: 11, color: c.textMuted, marginBottom: 6, letterSpacing: 0.5 }}>
                  LVL {lvl} PERKS
                </Text>
                {perks.length > 0 ? (
                  perks.map((p, pi) => (
                    <View key={pi} style={styles.perkRow}>
                      <View style={[styles.dot, { backgroundColor: isCurrent ? c.primary : c.textMuted }]} />
                      <Text
                        style={{
                          fontFamily: fonts.body,
                          fontSize: 11,
                          color: isCurrent ? c.textPrimary : c.textSecondary,
                          flex: 1,
                        }}
                      >
                        {p}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.textMuted }}>Perks soon</Text>
                )}
                <Text style={{ fontFamily: fonts.body, fontSize: 10, color: c.textMuted, marginTop: 6 }}>
                  {xpForLevel(lvl).toLocaleString()} XP
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  stepGroup: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol: { alignItems: 'center', gap: 10, width: 160 },
  connector: { width: 40, height: 2, marginTop: 34 },
  circle: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  perkCard: { width: 156, padding: 12, borderRadius: 14, borderWidth: 1 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
