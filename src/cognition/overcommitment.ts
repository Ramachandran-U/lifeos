/**
 * Overcommitment detector (Phase 2 cognitive engine, second detector).
 *
 * Continuously asks: "is the user's planned day larger than they can realistically
 * carry, given how they've been performing, sleeping, and feeling lately?" Mirrors
 * the stagnation detector's pattern: a pure deterministic core with injected
 * data accessors, no DB / store coupling, no LLM. The thin live adapter wires
 * real stores to these injections and renders a card.
 *
 * Fires when ANY of three signals tilt against the user:
 *   1. Planned load > 1.3 × achievable baseline (rolling history of completed minutes)
 *   2. Significant sleep debt (≥2h) AND any high-energy block planned
 *   3. Recent skip rate ≥30% AND planned load > baseline
 *
 * Severity (0-100) is the sum of three components: load (≤50), sleep (≤25),
 * skip (≤25). Higher means a stronger heads-up; below threshold = silent.
 */
import type { DomainId } from '@/store/useUserStore';

export interface OvercommitmentDeps {
  /** Total planned routine-block minutes for the target date. */
  plannedMinutesForDate: (date: string) => number;
  /** Count of high-energy blocks planned for the date. */
  highEnergyBlocksFor: (date: string) => number;
  /** Rolling median (or mean) of *completed* daily block minutes — the user's actual capacity. */
  achievableBaseline: () => number;
  /** Last recorded sleep duration in hours; null if unknown. */
  lastSleepHours: () => number | null;
  /** User's nightly sleep target (from onboarding) in hours; null if not set. */
  sleepTargetHours: () => number | null;
  /** Skip rate as a 0..1 fraction across the last few days. */
  recentSkipRate: () => number;
  /** Most recent mood 1-5, or null. (Reserved — not currently a firing input, but surfaced.) */
  recentMood: () => number | null;
  /** Cooldown predicate — true means it's OK to surface a new insight for this kind. */
  cooldownOk: () => boolean;
}

export interface OvercommitmentCandidate {
  date: string;
  plannedMinutes: number;
  baselineMinutes: number;
  /** `plannedMinutes / baselineMinutes` — 1.0 == matches capacity, >1 == over. */
  loadRatio: number;
  sleepDebtHours: number;
  recentSkipRate: number;
  severity: number;
  /** Plain-language reasons that fired, ordered most→least impactful. */
  reasons: string[];
}

export const OVERLOAD_RATIO = 1.3;
export const SLEEP_DEBT_HOURS = 2;
export const HIGH_SKIP_RATE = 0.3;
/** Need at least this much demonstrated capacity before we'll judge the user's plan. */
export const MIN_BASELINE_MINUTES = 60;
/** Default sleep target if the user hasn't set one (matches sane adult median). */
export const DEFAULT_SLEEP_TARGET_HOURS = 7.5;

export function detectOvercommitment(
  date: string,
  deps: OvercommitmentDeps,
): OvercommitmentCandidate | null {
  const baseline = deps.achievableBaseline();
  if (baseline < MIN_BASELINE_MINUTES) return null; // new user / sparse data — silent
  if (!deps.cooldownOk()) return null;

  const planned = deps.plannedMinutesForDate(date);
  if (planned === 0) return null; // nothing planned, nothing to overload

  const loadRatio = planned / baseline;
  const sleepHours = deps.lastSleepHours();
  const targetSleep = deps.sleepTargetHours() ?? DEFAULT_SLEEP_TARGET_HOURS;
  const sleepDebt = sleepHours !== null ? Math.max(0, targetSleep - sleepHours) : 0;
  const skipRate = deps.recentSkipRate();
  const highEnergy = deps.highEnergyBlocksFor(date);

  const reasons: string[] = [];

  const loadOver = loadRatio > OVERLOAD_RATIO;
  const sleepOver = sleepDebt >= SLEEP_DEBT_HOURS && highEnergy > 0;
  const skipOver = skipRate >= HIGH_SKIP_RATE && planned > baseline;

  if (loadOver) {
    reasons.push(`Planned ${Math.round(planned)} min vs. your usual ${Math.round(baseline)} min`);
  }
  if (sleepOver) {
    reasons.push(`Sleep-deprived by ${sleepDebt.toFixed(1)}h with ${highEnergy} high-energy block${highEnergy === 1 ? '' : 's'}`);
  }
  if (skipOver) {
    reasons.push(`You've been skipping ${Math.round(skipRate * 100)}% of recent blocks`);
  }

  if (reasons.length === 0) return null;

  // Severity components — bounded so the same signal can't blow past its share.
  const loadComponent = loadOver ? Math.min(50, Math.round((loadRatio - 1) * 100)) : 0;
  const sleepComponent = sleepOver ? Math.min(25, Math.round((sleepDebt / 3) * 25)) : 0;
  const skipComponent = skipOver ? Math.min(25, Math.round((skipRate / 0.5) * 25)) : 0;
  const severity = Math.min(100, loadComponent + sleepComponent + skipComponent);

  return {
    date,
    plannedMinutes: planned,
    baselineMinutes: baseline,
    loadRatio,
    sleepDebtHours: sleepDebt,
    recentSkipRate: skipRate,
    severity,
    reasons,
  };
}
