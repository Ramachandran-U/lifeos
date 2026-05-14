import { useMemo, useRef } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type AppColors, DOMAIN_GLYPHS } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Body, Caption } from '@/components/ui/Typography';
import { EASING, SPRING, TIMING, useMotionScale } from '@/theme/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Hold-to-confirm window. Not a motion-budget token — this is an input
// gesture duration, not an animation curve.
const HOLD_MS = 1000;
// Reduce-motion / users with motionIntensity=off get a fast tap window.
const REDUCED_HOLD_MS = 120;

// Progress arc geometry (drawn on the status button when pressed).
const ARC_RADIUS = 13;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;

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
  // pressP: 0 → 1 over the hold window. Drives the arc stroke-dashoffset.
  const pressP = useSharedValue(0);

  const motionScale = useMotionScale();
  // When motion is off (reduce-motion or user pref), fall back to a short
  // tap window so the button still feels responsive without an arc fill.
  const holdMs = motionScale === 0 ? REDUCED_HOLD_MS : HOLD_MS;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Progress arc: stroke-dashoffset goes from full-circumference (empty) to 0 (full).
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_CIRCUMFERENCE * (1 - pressP.value),
  }));

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const commit = () => {
    if (completedRef.current || isCompleted) return;
    completedRef.current = true;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSpring(0.97, SPRING.standard, () => {
      scale.value = withSpring(1, SPRING.standard);
    });
    opacity.value = withTiming(0.55, { duration: TIMING.normal });
    onComplete(id);
  };

  const startHold = () => {
    if (isCompleted || completedRef.current) return;
    pressP.value = withTiming(1, { duration: holdMs, easing: EASING.inOut });
    holdTimer.current = setTimeout(() => commit(), holdMs);
  };

  const cancelHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (!completedRef.current) {
      pressP.value = withTiming(0, { duration: 200, easing: EASING.out });
    }
  };

  // Aurora Refined v2: resting glow removed. Halo moments live in motion
  // scenes (BadgeUnlock, etc.) not steady state.

  // Two-layer animation wrapper: outer view owns the layout entry animation,
  // inner view owns the per-frame opacity/scale. Reanimated 4 warns when both
  // coexist on the same node ("opacity may be overwritten by a layout animation").
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Animated.View style={animatedStyle}>
      <View
        style={[
          styles.container,
          isActive && { borderColor: moduleColor + '66', backgroundColor: moduleColor + '11' },
        ]}
      >
        {/* Time rail */}
        <View style={styles.timeCol}>
          <View
            style={[
              styles.dot,
              { backgroundColor: moduleColor },
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

        {/* Status control — hold to complete (Aurora Refined v2 scene 02). */}
        <Pressable
          onPressIn={startHold}
          onPressOut={cancelHold}
          style={styles.statusBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityHint={isCompleted ? 'Completed' : 'Hold to complete'}
        >
          {isCompleted ? (
            <View style={[styles.checkCircle, { backgroundColor: c.success + '26', borderColor: c.success + '66' }]}>
              <Ionicons name="checkmark" size={16} color={c.success} />
            </View>
          ) : (
            <View style={styles.statusInner}>
              {isActive ? (
                <View
                  style={[
                    styles.nowPill,
                    { backgroundColor: moduleColor },
                  ]}
                >
                  <Caption style={styles.nowText}>NOW</Caption>
                </View>
              ) : (
                <View style={styles.emptyCircle} />
              )}
              {/* Press-progress arc — overlays the button face. */}
              <Svg
                width={32}
                height={32}
                style={styles.progressArc}
                pointerEvents="none"
              >
                <AnimatedCircle
                  cx={16}
                  cy={16}
                  r={ARC_RADIUS}
                  stroke={moduleColor}
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray={ARC_CIRCUMFERENCE}
                  animatedProps={arcProps}
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)"
                />
              </Svg>
            </View>
          )}
        </Pressable>
      </View>
      </Animated.View>
    </Animated.View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  statusInner: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressArc: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
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
