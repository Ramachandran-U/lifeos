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
});

/** UPPER_SNAKE env-var suffix for each flag, e.g. mutationLog -> MUTATION_LOG. */
function envKey(flag: FeatureFlag): string {
  const snake = flag.replace(/([A-Z])/g, '_$1').toUpperCase();
  return `EXPO_PUBLIC_FLAG_${snake}`;
}

const TRUTHY = new Set(['true', '1', 'on', 'yes']);

function readEnv(flag: FeatureFlag): boolean | undefined {
  const raw = process.env[envKey(flag)];
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
