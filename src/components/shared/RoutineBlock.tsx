import { useMemo } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors, DOMAIN_GLYPHS } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';
import { SPRING, TIMING } from '@/theme/motion';

const MODULE_LABELS: Record<string, string> = {
  goal: 'GOALS', health: 'HEALTH', finance: 'FINANCE', career: 'CAREER',
  social: 'SOCIAL', polymath: 'CURIOSITY', rest: 'REST', work: 'WORK', meal: 'MEAL',
};

const GLYPHS: Record<string, string> = {
  goal: DOMAIN_GLYPHS.goal, health: DOMAIN_GLYPHS.health, finance: DOMAIN_GLYPHS.finance,
  career: DOMAIN_GLYPHS.career, social: DOMAIN_GLYPHS.social, polymath: DOMAIN_GLYPHS.polymath,
  rest: '☾', work: '■', meal: '◎',
};

interface RoutineBlockProps {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  status: string;
  onComplete: (id: string) => void;
  sub?: string;
  xp?: number;
}

function isNowBetween(start: string, end: string): boolean {
  const now = new Date();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= sh * 60 + sm && mins < eh * 60 + em;
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

export function RoutineBlock({ id, startTime, endTime, title, module, status, onComplete, sub, xp }: RoutineBlockProps) {
  const c = useColors();
  const styles = makeStyles(c);
  const MODULE_COLORS: Record<string, string> = {
    goal: c.goal,
    health: c.health,
    finance: c.finance,
    career: c.career,
    social: c.social,
    polymath: c.polymath,
    rest: c.textMuted,
    work: c.textSecondary,
    meal: c.warning,
  };
  const moduleColor = MODULE_COLORS[module] ?? c.textMuted;
  const moduleLabel = MODULE_LABELS[module] ?? module.toUpperCase();
  const glyph = GLYPHS[module] ?? '●';
  const isCompleted = status === 'completed';
  const isActive = useMemo(() => !isCompleted && isNowBetween(startTime, endTime), [isCompleted, startTime, endTime]);
  const duration = useMemo(() => durationLabel(startTime, endTime), [startTime, endTime]);

  const opacity = useSharedValue(isCompleted ? 0.55 : 1);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleComplete = () => {
    if (isCompleted) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSpring(0.97, SPRING.standard, () => {
      scale.value = withSpring(1, SPRING.standard);
    });
    opacity.value = withTiming(0.55, { duration: TIMING.normal });
    onComplete(id);
  };

  const activeGlow = isActive && Platform.OS === 'web'
    ? ({ boxShadow: `0 0 24px ${moduleColor}33, inset 0 0 0 1px ${moduleColor}55` } as unknown as object)
    : undefined;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={animatedStyle}>
      <View
        style={[
          styles.container,
          isActive && { borderColor: moduleColor + '66', backgroundColor: moduleColor + '11' },
          activeGlow as object,
        ]}
      >
        {/* Time rail */}
        <View style={styles.timeCol}>
          <View
            style={[
              styles.dot,
              { backgroundColor: moduleColor },
              isActive && Platform.OS === 'web'
                ? ({ boxShadow: `0 0 12px ${moduleColor}` } as unknown as object)
                : undefined,
            ]}
          />
          <Caption style={[styles.time, { color: isActive ? moduleColor : c.textMuted }]}>
            {startTime}
          </Caption>
          <Caption style={[styles.time, { color: c.textMuted }]}>{endTime}</Caption>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Body style={[styles.title, isCompleted && styles.titleCompleted]}>{title}</Body>
          {sub && <Caption style={styles.sub}>{sub}</Caption>}
          <View style={styles.tagsRow}>
            <View style={[styles.tag, { backgroundColor: moduleColor + '1A', borderColor: moduleColor + '33' }]}>
              <Caption style={[styles.tagText, { color: moduleColor }]}>
                {glyph}  {moduleLabel}
              </Caption>
            </View>
            <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }]}>
              <Caption style={[styles.tagText, { color: c.textSecondary }]}>{duration}</Caption>
            </View>
            {xp !== undefined && (
              <View style={[styles.tag, { backgroundColor: c.primary + '1F', borderColor: c.primary + '33' }]}>
                <Caption style={[styles.tagText, { color: c.primaryLight }]}>+{xp} XP</Caption>
              </View>
            )}
          </View>
        </View>

        {/* Status control */}
        <Pressable onPress={handleComplete} style={styles.statusBtn} hitSlop={8}>
          {isCompleted ? (
            <View style={[styles.checkCircle, { backgroundColor: c.success + '26', borderColor: c.success + '66' }]}>
              <Ionicons name="checkmark" size={16} color={c.success} />
            </View>
          ) : isActive ? (
            <View
              style={[
                styles.nowPill,
                { backgroundColor: moduleColor },
                Platform.OS === 'web'
                  ? ({ boxShadow: `0 0 20px ${moduleColor}77` } as unknown as object)
                  : undefined,
              ]}
            >
              <Caption style={styles.nowText}>NOW</Caption>
            </View>
          ) : (
            <View style={styles.emptyCircle} />
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  timeCol: {
    width: 48,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  time: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
  },
  content: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 11.5,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: fonts.heading,
    fontSize: 9.5,
    letterSpacing: 0.4,
  },
  statusBtn: {
    alignSelf: 'center',
  },
  emptyCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  nowText: {
    fontFamily: fonts.heading,
    fontSize: 10,
    fontWeight: '800',
    color: '#0A0612',
    letterSpacing: 0.6,
  },
});
