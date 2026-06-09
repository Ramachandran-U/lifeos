/**
 * Celebration engine (M2, flag: celebrationEngine) — shared vocabulary.
 *
 * A "celebration" is the full-screen particle layer for PEAK moments only
 * (Aurora ethos: celebration at moments, never resting-state neon). The chip /
 * toast / overlay beats keep rendering through their existing owners
 * (RewardOrchestrator, AchievementToast, MilestoneOverlay, LevelUpOverlay) —
 * this engine only adds the particle weather behind them.
 *
 * Platform-free on purpose (no react-native imports): classify/presets are
 * pure and unit-tested under the node jest harness.
 */

/**
 * micro    → no full-screen layer (the reward chip's own 8-particle burst is
 *            the whole celebration — anything more would cheapen the big ones)
 * standard → one radial burst behind the chip
 * epic     → full-screen confetti
 */
export type CelebrationTier = 'micro' | 'standard' | 'epic';

export type CelebrationKind =
  | 'xp'
  | 'streak'
  | 'badge'
  | 'levelUp'
  | 'dayComplete'
  | 'milestone';

/** What a call site knows at the moment something celebration-worthy happens. */
export interface CelebrationInput {
  kind: CelebrationKind;
  /** XP amount — drives the tier thresholds for `xp` beats. */
  amount?: number;
  /** Streak count / milestone tier — lets presets scale epic milestones. */
  count?: number;
  /** Theme colour key (domain hue) the renderer should lead with. */
  domain?: string;
}

/** A classified beat, queued for the CelebrationHost. */
export interface CelebrationEvent extends CelebrationInput {
  id: string;
  tier: CelebrationTier;
}

/**
 * Contract every renderer (Skia or Reanimated fallback) implements, so the
 * host can swap them freely. `palette` arrives as resolved hex colours —
 * presets carry theme keys; the host resolves them against useColors().
 */
export interface CelebrationRendererProps {
  event: CelebrationEvent;
  preset: CelebrationPreset;
  palette: string[];
  /** Must fire exactly once when the visual finishes — advances the queue. */
  onDone: () => void;
}

/** How a tier×kind combination renders. Resolved by presets.ts. */
export interface CelebrationPreset {
  /**
   * burst         → radial particle burst (Skia when loaded, Reanimated fallback)
   * confettiFall  → full-screen falling confetti
   * confettiCannon→ full-screen cannon volley (epic peaks)
   * none          → host renders nothing (micro tier)
   */
  renderer: 'none' | 'burst' | 'confettiFall' | 'confettiCannon';
  /** Particle count budget for the renderer. */
  particleCount: number;
  /** Total visual lifetime in ms — always a value from MOTION_BUDGET/TIMING. */
  durationMs: number;
  /**
   * Theme colour KEYS (resolved against useColors() at render time so the
   * preset stays platform-free and theme-aware). The event's `domain` hue, if
   * set, is prepended by the renderer.
   */
  paletteKeys: readonly string[];
}
