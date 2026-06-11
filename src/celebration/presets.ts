import { MOTION_BUDGET, TIMING } from '@/theme/motion';
import type { CelebrationEvent, CelebrationKind, CelebrationPreset, CelebrationTier } from './types';

/**
 * Preset table — tier × kind → how the CelebrationHost renders it. Pure data
 * + one resolver so the mapping is unit-testable without mounting anything.
 *
 * Particle budgets follow the Aurora Refined v2 restraint rules: standard
 * bursts stay under ~24 particles (a flourish, not a storm); epic confetti is
 * the only full-screen moment and reuses the celebrationFall budget the
 * legacy Confetti already honours.
 */

const NONE: CelebrationPreset = {
  renderer: 'none',
  particleCount: 0,
  durationMs: 0,
  paletteKeys: [],
};

const STANDARD_BURST: CelebrationPreset = {
  renderer: 'burst',
  particleCount: 18,
  durationMs: MOTION_BUDGET.hero,
  paletteKeys: ['xp', 'primaryDim'],
};

const EPIC_FALL: CelebrationPreset = {
  renderer: 'confettiFall',
  particleCount: 120,
  durationMs: MOTION_BUDGET.celebrationFall,
  paletteKeys: ['goal', 'health', 'finance', 'career', 'social', 'polymath', 'xp'],
};

const EPIC_CANNON: CelebrationPreset = {
  renderer: 'confettiCannon',
  particleCount: 90,
  durationMs: MOTION_BUDGET.celebrationFall,
  paletteKeys: ['xp', 'primaryDim', 'streak'],
};

/** Per-kind overrides on top of the tier defaults. */
const KIND_PRESETS: Partial<Record<CelebrationKind, Partial<Record<CelebrationTier, CelebrationPreset>>>> = {
  streak: {
    standard: { ...STANDARD_BURST, paletteKeys: ['streak', 'warning', 'xp'] },
  },
  badge: {
    standard: { ...STANDARD_BURST, paletteKeys: ['badge', 'xp', 'primaryDim'] },
  },
  // Day-complete keeps the gentle full-screen fall the legacy Confetti
  // established; the punchier cannon is reserved for identity beats.
  dayComplete: {
    epic: EPIC_FALL,
  },
  levelUp: {
    epic: EPIC_CANNON,
  },
  milestone: {
    epic: { ...EPIC_CANNON, paletteKeys: ['streak', 'xp', 'warning'] },
  },
  // Cold-start first-ever block completion (cold_start_v1) — the identity
  // cannon. (R1: paletteKey primaryLight → primaryDim — *Light tokens died.)
  firstWin: {
    epic: { ...EPIC_CANNON, paletteKeys: ['xp', 'primaryDim', 'streak'] },
  },
};

export function resolvePreset(event: Pick<CelebrationEvent, 'kind' | 'tier'>): CelebrationPreset {
  if (event.tier === 'micro') return NONE;
  const override = KIND_PRESETS[event.kind]?.[event.tier];
  if (override) return override;
  return event.tier === 'epic' ? EPIC_FALL : STANDARD_BURST;
}

/**
 * How long the host keeps a beat mounted before auto-advancing the queue.
 * A small tail past the preset duration lets fades finish; the value is
 * token-composed so the motion ratchet stays clean.
 */
export function presetLifetimeMs(preset: CelebrationPreset): number {
  return preset.durationMs + TIMING.normal;
}
