import { Platform } from 'react-native';
import { TIMING } from '@/theme/motion';

/**
 * Navigation transition presets (Aurora Alive M1, flag: motionTransitions).
 *
 * Centralizes screenOptions fragments so app/_layout.tsx (native stack) and
 * app/(tabs)/_layout.tsx (bottom tabs) read motion from one vocabulary:
 *
 *  - tabs:  'shift' (subtle lateral slide, JS-driven by bottom-tabs v7) with a
 *           TIMING-scaled spec; collapses to 'none' under reduce-motion.
 *  - stack: platform-native push ('ios_from_right' / 'slide_from_right');
 *           native-stack animations are no-ops on web, which keeps the web
 *           build's instant route swaps unchanged.
 *  - modal: 'slide_from_bottom' for full-screen modal routes (chat, settings,
 *           evening-reflect, feedback, annual-review).
 *
 * Callers resolve the flag + motion scale with hooks and pass them in — these
 * are pure factories so they stay unit-testable.
 */

export interface TransitionPrefs {
  /** isEnabled('motionTransitions') at the call site. */
  enabled: boolean;
  /** useMotionScale() at the call site — 0 collapses all motion. */
  motionScale: number;
}

type TabsAnimation = 'none' | 'fade' | 'shift';

export function tabTransition({ enabled, motionScale }: TransitionPrefs): {
  animation: TabsAnimation;
  transitionSpec?: { animation: 'timing'; config: { duration: number } };
} {
  if (!enabled) return { animation: 'fade' }; // pre-M1 behaviour
  if (motionScale === 0) return { animation: 'none' };
  return {
    animation: 'shift',
    // Slightly under TIMING.normal — tab swaps must read as instant-ish.
    transitionSpec: {
      animation: 'timing',
      config: { duration: Math.round((TIMING.normal * 0.8) / motionScale) },
    },
  };
}

type StackAnimation =
  | 'default' | 'fade' | 'none'
  | 'slide_from_right' | 'slide_from_bottom' | 'ios_from_right';

export function stackTransition({ enabled, motionScale }: TransitionPrefs): {
  animation: StackAnimation;
} {
  if (!enabled) return { animation: 'fade' }; // pre-M1 behaviour
  if (motionScale === 0) return { animation: 'none' };
  return {
    animation: Platform.OS === 'ios' ? 'ios_from_right' : 'slide_from_right',
  };
}

export function modalTransition({ enabled, motionScale }: TransitionPrefs): {
  animation: StackAnimation;
} {
  if (!enabled) return { animation: 'fade' };
  if (motionScale === 0) return { animation: 'none' };
  return { animation: 'slide_from_bottom' };
}

/** Routes presented as full-screen modals when motionTransitions is on. */
export const MODAL_ROUTES = [
  'chat',
  'settings',
  'evening-reflect',
  'feedback',
  'annual-review',
] as const;
