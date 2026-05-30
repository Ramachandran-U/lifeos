import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { LEVEL_PERKS } from '@/constants/gamification';

interface Props {
  level: number | null;
  userName?: string;
  onClose: () => void;
}

// Aurora level-up nudge. A level-up is a milestone, so it still celebrates —
// but as a NON-BLOCKING top banner, not a full-screen takeover. It slides in,
// auto-dismisses, and lets the rest of the screen stay interactive. (Finishing
// a single routine block should never seize the whole screen.)
const AUTO_DISMISS_MS = 5000;

export function LevelUpOverlay({ level, userName, onClose }: Props) {
  const c = useColors();

  useEffect(() => {
    if (level === null) return;
    const t = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [level, onClose]);

  if (level === null) return null;

  const perks = LEVEL_PERKS[level] ?? ['New features unlocked', 'Keep going!'];
  const firstName = (userName ?? 'Friend').split(' ')[0];
  const glow = Platform.OS === 'web'
    ? ({ boxShadow: `0 12px 40px ${c.primary}44` } as unknown as object)
    : undefined;

  return (
    // box-none lets touches fall through everywhere except the banner itself,
    // so the screen behind stays fully usable while the nudge is up.
    <View pointerEvents="box-none" style={styles.wrap}>
      <Animated.View entering={FadeInDown.duration(360)} exiting={FadeOutUp.duration(240)}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={`Level ${level} reached. Tap to dismiss.`}
          style={[
            styles.banner,
            { backgroundColor: c.surface, borderColor: c.primary + '55' },
            glow as object,
          ]}
        >
          <View style={[styles.levelBadge, { backgroundColor: c.primary + '22', borderColor: c.primary + '55' }]}>
            <Text style={[styles.levelNum, { color: c.primaryLight }]}>{level}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.kicker, { color: c.textMuted }]}>LEVEL UP ✨</Text>
            <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
              Level {level}, {firstName}!
            </Text>
            <Text style={[styles.perk, { color: c.textSecondary }]} numberOfLines={1}>
              {perks[0]}
            </Text>
          </View>
          <Text style={[styles.dismiss, { color: c.textMuted }]}>✕</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    zIndex: 60,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 440,
    width: '100%',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { fontFamily: fonts.heading, fontSize: fontSizes.xl, fontWeight: '800' },
  copy: { flex: 1, gap: 1 },
  kicker: { fontFamily: fonts.heading, fontSize: 10.5, letterSpacing: 1.5 },
  title: { fontFamily: fonts.heading, fontSize: fontSizes.lg },
  perk: { fontFamily: fonts.body, fontSize: fontSizes.sm },
  dismiss: { fontSize: 16, paddingHorizontal: spacing.xs },
});
