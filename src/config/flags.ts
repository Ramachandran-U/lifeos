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
  /** P0: emit rows to the mutation log on writes (shadow — no sync yet). */
  mutationLog: boolean;
  /** P1: push/pull mutations across devices. */
  syncEngine: boolean;
  /** P1: per-entity version history + restore-to-timestamp. */
  versionHistory: boolean;
  /** P1: encrypted backup/export/import. */
  encryptedBackup: boolean;
  /** P2: cognitive detectors + reasoning (shadow-capable). */
  cognitiveEngine: boolean;
  /** P3: coach can take gated, confirmed actions via tool-use. */
  aiCoachActions: boolean;
  /** P4: long-term memory graph projection. */
  memoryGraph: boolean;
  /** P5: autonomous calendar-aware orchestration suggestions. */
  orchestration: boolean;
}

export type FeatureFlag = keyof FeatureFlags;

export const DEFAULT_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  mutationLog: false,
  syncEngine: false,
  versionHistory: false,
  encryptedBackup: false,
  cognitiveEngine: false,
  aiCoachActions: false,
  memoryGraph: false,
  orchestration: false,
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
