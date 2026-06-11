/**
 * The answer card — Today's one hero
 * (docs/design-deep-dive/01-today-hero.md §3.2).
 *
 * One card, four states (block / task / dayDone / plan), resolved by the
 * deterministic useNextMove hook. Structurally colored by the next move's
 * domain: *Dim background + a 4px domain rail (the sanctioned hero rail,
 * resolution 9). No full border — type does the talking.
 *
 * Presentation only: completion goes back through the caller's existing
 * pipelines (handleComplete / the goals completion path) via onPrimary —
 * XP, streaks, ambient sweep, celebration and telemetry all fire unchanged.
 */
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/radii';
import { MOTION_BUDGET, useMotionScale, useSpringConfig } from '@/theme/motion';
import { Text as AuroraText } from '@/components/ui/Text';
import { track, EVENTS } from '@/utils/telemetry';
import type { NextMove } from '@/hooks/useNextMove';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DOMAIN_MODULES = ['goal', 'health', 'finance', 'career', 'social', 'polymath'] as const;
type DomainModule = (typeof DOMAIN_MODULES)[number];

function isDomainModule(module: string | undefined): module is DomainModule {
  return module !== undefined && (DOMAIN_MODULES as readonly string[]).includes(module);
}

/** "HH:mm" → minutes since midnight. */
function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

/** Block duration per the §3.2 formula: "{m} min" / "{h} h" / "{h} h {m} min". */
function formatDuration(startTime: string, endTime: string): string {
  const m = minutesOf(endTime) - minutesOf(startTime);
  if (m < 60) return `${m} min`;
  if (m % 60 === 0) return `${m / 60} h`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

interface NextMoveHeroProps {
  move: NextMove;
  completedCount: number;
  blockCount: number;
  /** block/task → mark done; plan → plan my day; dayDone → see your day. */
  onPrimary: () => void;
  /** block → scroll to Today's flow; task → open Goals. */
  onSecondary: () => void;
}

export function NextMoveHero({ move, completedCount, blockCount, onPrimary, onSecondary }: NextMoveHeroProps) {
  const c = useColors();
  const motionScale = useMotionScale();
  const spring = useSpringConfig('standard');
  const pressScale = useSharedValue(1);

  // next_move_shown — exactly once per kind:title change per mount.
  const shownKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${move.kind}:${move.title}`;
    if (shownKeyRef.current !== key) {
      shownKeyRef.current = key;
      track(EVENTS.nextMoveShown, { kind: move.kind, module: move.module });
    }
  }, [move.kind, move.title, move.module]);

  const domain = isDomainModule(move.module) ? move.module : undefined;

  // Structural color: *Dim surface + solid rail for the six domains;
  // neutral surface with a primary rail for non-domain modules and plan;
  // success rail for dayDone.
  const backgroundColor = domain ? c[`${domain}Dim`] : c.surfaceAlt;
  const railColor = domain ? c[domain] : move.kind === 'dayDone' ? c.success : c.primary;
  const accent = domain ? c[domain] : move.kind === 'dayDone' ? c.success : c.primary;
  const primaryBg = accent;

  // Row 1 — eyebrow. goal → GOALS; every other module key uppercased verbatim.
  const moduleLabel = move.module === 'goal' ? 'GOALS' : (move.module ?? '').toUpperCase();
  const eyebrow =
    move.kind === 'block'
      ? move.upNow
        ? `UP NOW · ${moduleLabel}`
        : `NEXT · ${move.startTime} · ${moduleLabel}`
      : move.kind === 'task'
        ? 'NEXT · GOALS'
        : move.kind === 'plan'
          ? 'DAY ONE'
          : `ALL CLEAR · ${completedCount}/${blockCount}`;

  // Row 3 — meta (rendered only when non-empty).
  const meta =
    move.kind === 'block' && move.startTime && move.endTime
      ? formatDuration(move.startTime, move.endTime)
      : move.kind === 'task' && (move.extraCount ?? 0) > 0
        ? `+${move.extraCount} more task${move.extraCount === 1 ? '' : 's'} today`
        : move.kind === 'plan'
          ? 'Three questions, one plan. Two minutes.'
          : null;

  const primaryLabel =
    move.kind === 'plan' ? 'Plan my day' : move.kind === 'dayDone' ? 'See your day' : 'Mark done';
  const secondaryLabel =
    move.kind === 'block' ? 'Show my plan' : move.kind === 'task' ? 'Open in Goals' : null;

  const handlePrimary = () => {
    if (move.kind === 'block' || move.kind === 'task') {
      track(EVENTS.nextMoveCompleted, { kind: move.kind, module: move.module });
    }
    onPrimary();
  };

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(120 * motionScale).duration(MOTION_BUDGET.reveal * motionScale)}
      style={[styles.card, { backgroundColor, borderLeftColor: railColor }]}
      testID="next-move-hero"
    >
      {/* Keyed swap fades the NEW content in; no `exiting` — on react-native-web
          the exiting clone lingers as a hidden DOM node, duplicating testIDs
          (one ghost per completion). Entering-only reads as the same
          cross-fade; the old content's instant unmount hides behind the
          incoming fade. */}
      <Animated.View
        key={`${move.kind}:${move.title}`}
        entering={FadeIn.duration(MOTION_BUDGET.reveal * motionScale)}
        style={styles.content}
      >
        <AuroraText variant="micro" color={accent}>
          {eyebrow}
        </AuroraText>
        <AuroraText variant="h2" numberOfLines={2}>
          {move.title}
        </AuroraText>
        {meta !== null && (
          <AuroraText variant="caption" secondary>
            {meta}
          </AuroraText>
        )}
        <View style={styles.actions}>
          <AnimatedPressable
            onPress={handlePrimary}
            onPressIn={() => {
              pressScale.value = withSpring(0.97, spring);
            }}
            onPressOut={() => {
              pressScale.value = withSpring(1, spring);
            }}
            style={[styles.primaryBtn, { backgroundColor: primaryBg }, pressStyle]}
            testID="next-move-primary"
            accessibilityRole="button"
          >
            <AuroraText variant="bodyLg" color={c.inkOnColor}>
              {primaryLabel}
            </AuroraText>
          </AnimatedPressable>
          {secondaryLabel !== null && (
            <Pressable
              onPress={onSecondary}
              style={[styles.secondaryBtn, { borderColor: c.border }]}
              testID="next-move-secondary"
              accessibilityRole="button"
            >
              <AuroraText variant="bodyLg" color={c.textSecondary}>
                {secondaryLabel}
              </AuroraText>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
  },
  content: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryBtn: {
    minHeight: 56,
    borderRadius: radii.control,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    minHeight: 56,
    borderRadius: radii.control,
    borderWidth: 1,
    backgroundColor: 'transparent',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
