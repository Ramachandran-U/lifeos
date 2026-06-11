import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { usePressScale } from '@/hooks/usePressScale';
import { MODULE_META, type Quest } from '@/constants/gamification';
import { XpChip } from './XpChip';
import { XpBar } from './XpBar';

interface Props {
  quest: Quest;
  onPress?: () => void;
  compact?: boolean;
  /** quests_v2: completed-but-unclaimed → render a Claim pill instead of the check. */
  onClaim?: () => void;
}

export function QuestCard({ quest, onPress, compact = false, onClaim }: Props) {
  const c = useColors();
  const meta = MODULE_META[quest.module];
  const color = c[meta.colorKey];
  const pct = quest.progress / quest.total;
  const done = pct >= 1;
  const claimable = !!onClaim && quest.status === 'completed';
  const claimed = quest.status === 'claimed';
  const press = usePressScale(0.98);

  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            padding: compact ? 14 : 16,
          },
          press.animatedStyle,
        ]}
      >
        <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: c.surfaceAlt }]}>
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
        {claimable ? (
          // The reward is EARNED but not banked — an explicit claim makes the
          // XP grant a deliberate, felt moment (variable-reward groundwork).
          <Pressable
            onPress={onClaim}
            accessibilityRole="button"
            accessibilityLabel={`Claim ${quest.xp} XP for ${quest.title}`}
            style={[styles.claimPill, { backgroundColor: color }]}
          >
            <Text style={[styles.claimText, { color: c.inkOnColor }]}>Claim +{quest.xp}</Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.check,
              {
                borderColor: done || claimed ? color : c.border,
                backgroundColor: done || claimed ? color : 'transparent',
              },
            ]}
          >
            {(done || claimed) && <Text style={{ color: c.inkOnColor, fontSize: 14, fontWeight: '700' }}>✓</Text>}
          </View>
        )}
      </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
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
  claimPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: 10,
    marginTop: 2,
  },
  claimText: { fontFamily: fonts.heading, fontSize: fontSizes.xs },
});

// Suppress unused import warnings when spacing is not used directly
void spacing;
