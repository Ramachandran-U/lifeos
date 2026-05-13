import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { MODULE_META, type Quest } from '@/constants/gamification';
import { XpChip } from './XpChip';
import { XpBar } from './XpBar';

interface Props {
  quest: Quest;
  onPress?: () => void;
  compact?: boolean;
}

export function QuestCard({ quest, onPress, compact = false }: Props) {
  const c = useColors();
  const meta = MODULE_META[quest.module];
  const color = c[meta.colorKey];
  const pct = quest.progress / quest.total;
  const done = pct >= 1;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: color + '33',
          borderLeftColor: color,
          opacity: pressed ? 0.9 : 1,
          padding: compact ? 14 : 16,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: color + '22' }]}>
          <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.bodyMedium, fontSize: compact ? fontSizes.sm : fontSizes.md, color: c.textPrimary, flex: 1 }}
            >
              {quest.title}
            </Text>
            <XpChip amount={quest.xp} />
          </View>
          <View style={styles.progressRow}>
            <View style={{ flex: 1 }}>
              <XpBar pct={pct} color={color} height={4} />
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: c.textMuted }}>
              {quest.progress}/{quest.total}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.check,
            { borderColor: done ? color : c.border, backgroundColor: done ? color : 'transparent' },
          ]}
        >
          {done && <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>✓</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});

// Suppress unused import warnings when spacing is not used directly
void spacing;
