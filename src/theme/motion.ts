import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Easing as RNEasing, Platform } from 'react-native';
import { usePreferencesStore, type MotionIntensity } from '@/store/usePreferencesStore';

// Custom easings beyond Reanimated's built-ins.
//   bounce — single-overshoot bounce. Streak +1 number tick.
//   pulse  — drive via Reanimated withSequence; this curve is the "in" half.
// Aurora Refined v2 — see docs/aurora-refined-v2/DELTA.md Phase 2.
export const EASING = {
  out:    RNEasing.out(RNEasing.cubic),
  soft:   RNEasing.bezier(0.2, 0.7, 0.3, 1),
  spring: RNEasing.bezier(0.34, 1.56, 0.64, 1),    // damped overshoot
  bounce: RNEasing.bezier(0.34, 1.86, 0.64, 1),    // 6% overshoot, single oscillation
  inOut:  RNEasing.bezier(0.4, 0, 0.2, 1),
} as const;

// Aurora Refined v2 motion budget — see docs/aurora-refined-v2/MOTION.md.
// Every animation in the app should pick from these or compose them.
export const MOTION_BUDGET = {
  pressFeedback:    120,  // tap scale
  microFeedback:    220,  // chip flash
  reveal:           360,  // standard surface arrival
  hero:             520,  // hero entry
  morphLong:       1600,  // hex radar score morph
  textReveal:      1900,  // AI insight typing (49 chars/sec)
  staggerTight:      40,  // tight row stagger
  stagger:           70,  // standard row stagger (timeline, sheet tiles)
  // Sheets — MOTION.md scene 06. Exit is slightly slower than scrim so the
  // surface visibly leaves before the dim lifts.
  sheetExit:        520,  // sheet slide-out
  scrimEnter:       480,  // scrim fade-in behind a sheet
  scrimExit:        460,  // scrim fade-out after the sheet leaves
  sheetContentEnter: 320, // per-row content arrival inside an open sheet
  // Reward beat choreography (RewardOrchestrator).
  rewardRise:       380,  // chip slide-down + pop in
  rewardHold:      1100,  // chip dwell at full opacity
  rewardExit:       300,  // chip rise-away + shrink
  // Celebration & loading.
  celebrationFall: 2000,  // full-screen confetti fall
  shimmer:          900,  // skeleton shimmer half-cycle (1.8s sweep)
  progressFill:    1000,  // XP / calorie / generic progress bar+ring fill
} as const;

// Input-gesture windows — these are interaction thresholds, not animation
// curves, so they live apart from MOTION_BUDGET and are NOT scaled by motion
// intensity (a hold-to-confirm must take the same effort at every setting;
// reduce-motion gets the shorter window instead).
export const INTERACTION = {
  holdToConfirm:        250,  // RoutineBlock press-and-hold commit window
  holdToConfirmReduced:  80,  // same, when reduce-motion is active
  holdRelease:          200,  // arc rewind after an aborted hold
} as const;

// Ambient loop periods (EVENT-triggered surfaces only — "rest quiet" means
// nothing idles; guardrail: ambient loops never run faster than 3s).
export const AMBIENT = {
  breath:     4000,  // live-block / companion breathing sine
  fieldDrift: 6000,  // particle field rise baseline (also the resting-companion breath)
} as const;

// Aurora Refined motion tokens — see DESIGN_DOC.md / ds-motion.jsx.
// Two physical motions (springs) and four time-based motions cover every case.
//
//   spring.standard → default tap (routine block check, chip select)
//   spring.soft     → large surfaces (bottom sheet enter, modal scale)
//   spring.snappy   → reward beats (XP toast, badge mint)
//   spring.gentle   → breath (hero radar entry, once-per-view)
//
//   timing.fast   150ms · ease-out         → tap feedback
//   timing.normal 300ms · cubic [.4,0,.2,1] → tab swap, sheet fade
//   timing.slow   600ms · cubic [.2,.7,.3,1]→ hero entry, briefing reveal
//   timing.epic   1200ms · cubic + bounce  → level-up, badge mint sequence
//
// Use `useMotionScale()` to multiply spring stiffness and timing durations by
// the user's motion-intensity preference. The hook also honors the OS-level
// reduce-motion setting — when active, scale collapses to 0.

export const SPRING = {
  standard: { stiffness: 180, damping: 22 },
  soft:     { stiffness: 120, damping: 18 },
  snappy:   { stiffness: 260, damping: 24 },
  gentle:   { stiffness:  90, damping: 16 },
} as const;

export type SpringToken = keyof typeof SPRING;

// Legacy-compatible numeric durations. Existing callers do `TIMING.normal` and
// expect a number — keep them happy. New code should reach for `TIMING_CFG`
// or `useTimingConfig()` instead.
export const TIMING = {
  fast: 150,
  normal: 300,
  slow: 600,
  epic: 1200,
} as const;

export type TimingToken = keyof typeof TIMING;

// New: paired duration + easing objects. Use via `useTimingConfig(token)`.
export const TIMING_CFG = {
  fast:   { duration: 150,  easing: Easing.out(Easing.quad) },
  normal: { duration: 300,  easing: Easing.bezier(0.4, 0, 0.2, 1) },
  slow:   { duration: 600,  easing: Easing.bezier(0.2, 0.7, 0.3, 1) },
  epic:   { duration: 1200, easing: Easing.bezier(0.2, 0.7, 0.3, 1.05) },
} as const;

// Motion intensity multiplier. Multiplies stiffness / divides damping / scales
// timing durations. `off` collapses everything to 0 (instant transitions).
const INTENSITY_SCALE: Record<MotionIntensity, number> = {
  off: 0,
  subtle: 0.5,
  normal: 1.0,
  bold: 1.4,
};

let reduceMotionCached = false;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(reduceMotionCached);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotionCached = v;
      if (mounted) setReduce(v);
    }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotionCached = v;
      if (mounted) setReduce(v);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  // On web, prefers-reduced-motion via matchMedia.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return reduce;
}

export function useMotionScale(): number {
  const intensity = usePreferencesStore((s) => s.motionIntensity);
  const reduce = useReduceMotion();
  if (reduce) return 0;
  return INTENSITY_SCALE[intensity];
}

// Returns a spring config scaled by current motion intensity. When scale is 0
// the config returns a near-instant overdamped spring so callers don't need to
// branch — Reanimated will land in one frame.
export function useSpringConfig(token: SpringToken = 'standard') {
  const scale = useMotionScale();
  const base = SPRING[token];
  if (scale === 0) return { stiffness: 1000, damping: 1000 };
  return {
    stiffness: base.stiffness * scale,
    damping: base.damping / Math.max(scale, 0.1),
  };
}

// Returns a timing config scaled by current motion intensity.
export function useTimingConfig(token: TimingToken = 'normal') {
  const scale = useMotionScale();
  const base = TIMING_CFG[token];
  if (scale === 0) return { duration: 0, easing: base.easing };
  return { duration: Math.round(base.duration / scale), easing: base.easing };
}

// Stagger helper — capped at 6 items per Aurora Refined (avoid making users wait).
export function useStaggerDelay() {
  const scale = useMotionScale();
  return (index: number, perItemMs = 40) => {
    if (scale === 0) return 0;
    return Math.min(index, 5) * (perItemMs / scale);
  };
}
