/**
 * Typed feature-flag registry.
 *
 * Every risky subsystem in the Adaptive Cognition program ships behind a flag
 * that is OFF by default, so merging incomplete work never changes runtime
 * behaviour. Flags resolve in priority order:
 *
 *   1. in-process override   (setFlagOverride — tests, dogfood, kill switch)
 *   2. environment variable  (EXPO_PUBLIC_FLAG_<UPPER_SNAKE> = "true"|"1"|"on")
 *   3. compiled default      (DEFAULT_FLAGS — all false)
 *
 * Platform-free on purpose: no react-native / expo imports, so it is unit
 * testable under the pure-Node jest harness and importable from anywhere.
 */

export interface FeatureFlags {
  /** P2: domain-stagnation detector runs (detect + store insight). */
  domainNudges: boolean;
  /** P2: render the domain-nudge card. Off + domainNudges on = shadow mode. */
  domainNudgesVisible: boolean;
  /** P2: overcommitment detector runs (detect + store insight). */
  overcommitmentDetector: boolean;
  /** P2: render the overcommitment card. Off + detector on = shadow mode. */
  overcommitmentVisible: boolean;
  /** Priority change → routine adjustment (Phase A: tomorrow; Phase B: adjust-now). */
  priorityAdjust: boolean;
  /** Explore redesign: prefetch the OTHER (un-taken) fork's node so taking it later is instant. Off by default — keep off until cost-ledger data justifies the spend. */
  exploreAgenticPrefetch: boolean;
  /** Profile: upload a photo → AI-generated gamified avatar (nano banana). Paid image-gen — off until billing is enabled. */
  profileAvatarGen: boolean;
  // ── Aurora Alive motion track (UI/UX revamp program) ──────────────────────
  /** M0: behavioural motion additions — sheet exit animations, haptic gap-fill (warning/error/hold-tick/tab-press). Token migration itself is unflagged (behaviour-preserving). */
  motionPolish: boolean;
  /** M1: custom tab/stack/modal transitions + AppSheet standardization + scroll-driven effects. */
  motionTransitions: boolean;
  /** M2: Skia celebration engine (tiered confetti/bursts via CelebrationHost). */
  celebrationEngine: boolean;
  /** M3: Rive companion runtime (dev-client only — not available in Expo Go). */
  riveCompanion: boolean;
  /** M4: victory-native animated charts (XP history, health trends, finance). */
  animatedCharts: boolean;
  /** M5: micro-sound effects on reward beats (opt-in pref on top of this flag). */
  soundEffects: boolean;
}

export type FeatureFlag = keyof FeatureFlags;

export const DEFAULT_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  domainNudges: false,
  domainNudgesVisible: false,
  overcommitmentDetector: false,
  overcommitmentVisible: false,
  priorityAdjust: true,
  exploreAgenticPrefetch: false,
  profileAvatarGen: false,
  // Aurora Alive motion track defaults flipped ON 2026-06-14 (founder-directed
  // next-wave rollout — these ran on the dogfood preview since 2026-06-10).
  // Kill switch: setFlagOverride or the EXPO_PUBLIC_FLAG_* env at build time.
  motionPolish: true,
  motionTransitions: true,
  celebrationEngine: true,
  riveCompanion: true,
  animatedCharts: true,
  // Deliberately stays OFF: sound is opt-in by design (M5) — the soundEnabled
  // preference sits on top of this flag, and the flag stays the master gate.
  soundEffects: false,
});

/**
 * UPPER_SNAKE env-var suffix for each flag, e.g. domainNudges ->
 * EXPO_PUBLIC_FLAG_DOMAIN_NUDGES. Kept as the single definition of the naming
 * rule; `envFlagCompliance.test.ts` asserts ENV_SOURCES below matches it for
 * every flag, so the two can never drift.
 */
export function envKey(flag: FeatureFlag): string {
  const snake = flag.replace(/([A-Z])/g, '_$1').toUpperCase();
  return `EXPO_PUBLIC_FLAG_${snake}`;
}

/**
 * STATIC env reads, one thunk per flag. Do NOT collapse this into a computed
 * `process.env[envKey(flag)]` lookup — that is the bug this map exists to fix.
 *
 * Metro/Expo (and webpack/Vite) substitute a literal `process.env.SOME_NAME`
 * at BUILD time; they cannot see a key computed at runtime. The previous
 * implementation built the key with a template literal, so in the web bundle
 * every EXPO_PUBLIC_FLAG_* read `undefined` and the compiled default silently
 * won. Setting a flag in .env, deploying, and observing no change — with no
 * error anywhere — was the result. (Verified in the shipped bundle: the key
 * builder survived minification while not one flag's variable name appeared.)
 *
 * Thunks rather than plain values: the reference stays static for the bundler,
 * while Node-side tests that mutate or replace `process.env` after import still
 * read the current value.
 *
 * The `Record<FeatureFlag, …>` type makes an omission a COMPILE error — a new
 * flag without its static read will not typecheck.
 */
const ENV_SOURCES: Record<FeatureFlag, () => string | undefined> = {
  domainNudges: () => process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES,
  domainNudgesVisible: () => process.env.EXPO_PUBLIC_FLAG_DOMAIN_NUDGES_VISIBLE,
  overcommitmentDetector: () => process.env.EXPO_PUBLIC_FLAG_OVERCOMMITMENT_DETECTOR,
  overcommitmentVisible: () => process.env.EXPO_PUBLIC_FLAG_OVERCOMMITMENT_VISIBLE,
  priorityAdjust: () => process.env.EXPO_PUBLIC_FLAG_PRIORITY_ADJUST,
  exploreAgenticPrefetch: () => process.env.EXPO_PUBLIC_FLAG_EXPLORE_AGENTIC_PREFETCH,
  profileAvatarGen: () => process.env.EXPO_PUBLIC_FLAG_PROFILE_AVATAR_GEN,
  motionPolish: () => process.env.EXPO_PUBLIC_FLAG_MOTION_POLISH,
  motionTransitions: () => process.env.EXPO_PUBLIC_FLAG_MOTION_TRANSITIONS,
  celebrationEngine: () => process.env.EXPO_PUBLIC_FLAG_CELEBRATION_ENGINE,
  riveCompanion: () => process.env.EXPO_PUBLIC_FLAG_RIVE_COMPANION,
  animatedCharts: () => process.env.EXPO_PUBLIC_FLAG_ANIMATED_CHARTS,
  soundEffects: () => process.env.EXPO_PUBLIC_FLAG_SOUND_EFFECTS,
};

const TRUTHY = new Set(['true', '1', 'on', 'yes']);

function readEnv(flag: FeatureFlag): boolean | undefined {
  const raw = ENV_SOURCES[flag]();
  if (raw === undefined) return undefined;
  return TRUTHY.has(raw.toLowerCase().trim());
}

const overrides: Partial<FeatureFlags> = {};

/** Resolve a single flag through override → env → default. */
export function isEnabled(flag: FeatureFlag): boolean {
  if (flag in overrides) return overrides[flag]!;
  const env = readEnv(flag);
  if (env !== undefined) return env;
  return DEFAULT_FLAGS[flag];
}

/** Snapshot of all resolved flags (useful for telemetry tagging / debug UI). */
export function resolveFlags(): FeatureFlags {
  const out = {} as FeatureFlags;
  (Object.keys(DEFAULT_FLAGS) as FeatureFlag[]).forEach((k) => {
    out[k] = isEnabled(k);
  });
  return out;
}

/**
 * Force flag values at runtime. Used by tests, internal dogfood builds, and as
 * the remote kill switch (e.g. setFlagOverride({ syncEngine: false }) to freeze
 * a misbehaving subsystem without a redeploy).
 */
export function setFlagOverride(partial: Partial<FeatureFlags>): void {
  Object.assign(overrides, partial);
}

/** Clear all in-process overrides (tests should call this in afterEach). */
export function resetFlagOverrides(): void {
  (Object.keys(overrides) as FeatureFlag[]).forEach((k) => delete overrides[k]);
}
