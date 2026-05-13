// ─── QuestCard ───────────────────────────────────────────────────────────────
// Daily / weekly quest row with module emoji, progress bar, XP chip, and a
// checkbox that morphs in on completion.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors, AppColors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { MODULE_META, Quest } from '@/utils/gamification';
import { XPBar } from './XPBar';

interface QuestCardProps {
  quest: Quest;
  compact?: boolean;
  onComplete?: (id: string) => void;
}

function moduleColor(c: AppColors, module: string): string {
  const meta = MODULE_META[module];
  if (!meta) return c.primary;
  return (c as unknown as Record<string, string>)[meta.colorKey] ?? c.primary;
}

export function QuestCard({ quest, compact = false, onComplete }: QuestCardProps) {
  const c = useColors();
  const meta = MODULE_META[quest.module];
  const color = moduleColor(c, quest.module);
  const pct = quest.total > 0 ? quest.progress / quest.total : 0;
  const done = pct >= 1;
  const [completed, setCompleted] = useState(done);

  const handlePress = () => {
    if (!completed) {
      setCompleted(true);
      onComplete?.(quest.id);
    }
  };

  const padH = compact ? 16 : 20;
  const padV = compact ? 14 : 16;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${quest.title}, ${quest.progress} of ${quest.total}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: color + '33',
          paddingHorizontal: padH,
          paddingVertical: padV,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.emoji, { backgroundColor: color + '22' }]}>
          <Text style={{ fontSize: 18 }}>{meta?.emoji ?? '✨'}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.bodyMedium,
                fontSize: compact ? 13 : 14,
                fontWeight: '500',
                color: c.textPrimary,
                flexShrink: 1,
              }}
            >
              {quest.title}
            </Text>
            <View style={[styles.xpChip, { backgroundColor: c.xp + '22', borderColor: c.xp + '44' }]}>
              <Text style={[styles.xpChipText, { color: c.xp }]}>+{quest.xp} XP</Text>
            </View>
          </View>
          <View style={styles.progressRow}>
            <View style={{ flex: 1 }}>
              <XPBar pct={pct} color={color} height={4} />
            </View>
            <Text style={[styles.progressText, { color: c.textMuted }]}>
              {quest.progress}/{quest.total}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.check,
            {
              borderColor: completed ? color : c.border,
              backgroundColor: completed ? color : 'transparent',
            },
          ]}
        >
          {completed && <Text style={styles.checkMark}>✓</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emoji: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  xpChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  xpChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
