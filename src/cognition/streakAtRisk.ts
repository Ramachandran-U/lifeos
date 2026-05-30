/**
 * Streak-at-risk detector (Phase 2 cognitive engine, third detector).
 *
 * Surfaces a streak the user has built that will RESET if they do nothing today,
 * so we can offer a tiny "protect it" nudge late in the day. Complements the
 * other detectors: stagnation watches neglected domains; overcommitment watches
 * overload; this watches momentum the user is about to lose.
 *
 * NOTE on scope: a burnout/overload detector is intentionally NOT added here —
 * `overcommitment.ts` already covers that (load ratio + sleep debt + skip rate).
 *
 * Pure deterministic core: all data is injected, no stores / DB / LLM. The live
 * adapter (real gamification streaks + clock + cooldown) is a thin wrapper.
 *
 * The grace mechanic (see utils/gamification): a streak survives one skipped
 * day, then resets on the next. So a streak is "recoverable today" when the gap
 * since its last advance is 1–2 days; a gap of 3+ means it has already lapsed.
 */

export interface StreakState {
  count: number;
  /** YYYY-MM-DD of the last day this streak was advanced. */
  lastDate: string;
  graceUsed?: boolean;
}

export interface StreakAtRiskDeps {
  /** Keyed by streak name (workout, learning, foodTracking, journaling, social). */
  streaks: Record<string, StreakState>;
  /** Today, YYYY-MM-DD. */
  today: string;
  /** Current hour 0–23 — we only nudge late enough that there's real urgency. */
  currentHour: number;
  /** Is it OK to surface this streak now (not within its cooldown window)? */
  cooldownOk: (streak: string) => boolean;
}

export interface StreakAtRiskCandidate {
  streak: string;
  count: number;
  /** Days since the streak was last advanced (1 or 2 — else it's already lapsed). */
  daysSinceLastAdvance: number;
  /** 0–100; higher means more momentum at stake / more urgent. */
  severity: number;
  reason: string;
}

/** A streak shorter than this isn't worth a late-day interruption. */
export const MIN_STREAK_TO_PROTECT = 3;
/** Only nudge from this hour onward — earlier, the user still has the whole day. */
export const LATE_HOUR = 18;
/** Beyond a 2-day gap the grace window is gone; the streak has already lapsed. */
export const MAX_RECOVERABLE_GAP = 2;

/** Whole-day difference between two YYYY-MM-DD dates (b − a), via UTC midnights. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  if (Number.isNaN(ms)) return NaN;
  return Math.round(ms / 86_400_000);
}

/**
 * Returns the single most at-risk streak to protect today, or null if none
 * qualify. At most one per call — one good nudge beats several ignored ones.
 *
 * A streak qualifies when ALL hold:
 *   - it's late enough in the day (currentHour ≥ LATE_HOUR),
 *   - count ≥ MIN_STREAK_TO_PROTECT (there's something worth saving),
 *   - it hasn't been advanced today (gap ≥ 1),
 *   - the gap is still recoverable (≤ MAX_RECOVERABLE_GAP),
 *   - it isn't inside its cooldown window.
 *
 * Ranking: highest severity first; tie-break on larger count, then larger gap.
 */
export function detectStreakAtRisk(deps: StreakAtRiskDeps): StreakAtRiskCandidate | null {
  if (deps.currentHour < LATE_HOUR) return null; // not urgent yet — whole day ahead

  const candidates: StreakAtRiskCandidate[] = [];

  for (const [streak, state] of Object.entries(deps.streaks)) {
    if (!state || state.count < MIN_STREAK_TO_PROTECT) continue;

    const gap = daysBetween(state.lastDate, deps.today);
    if (Number.isNaN(gap)) continue;
    if (gap <= 0) continue; // already advanced today (or a future lastDate) — safe
    if (gap > MAX_RECOVERABLE_GAP) continue; // already lapsed — nothing to protect
    if (!deps.cooldownOk(streak)) continue;

    // Severity: momentum at stake (count) plus urgency (a 2-day gap is the last
    // chance before reset). Bounded components so neither dominates absurdly.
    const countComponent = Math.min(70, state.count * 5);
    const urgencyComponent = gap >= MAX_RECOVERABLE_GAP ? 30 : 12;
    const severity = Math.min(100, countComponent + urgencyComponent);

    const reason =
      gap >= MAX_RECOVERABLE_GAP
        ? `Your ${state.count}-day ${streak} streak resets if you skip today`
        : `Keep your ${state.count}-day ${streak} streak alive today`;

    candidates.push({ streak, count: state.count, daysSinceLastAdvance: gap, severity, reason });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) =>
    a.severity !== b.severity
      ? b.severity - a.severity
      : a.count !== b.count
        ? b.count - a.count
        : b.daysSinceLastAdvance - a.daysSinceLastAdvance,
  );
  return candidates[0]!;
}

/** Exposed for unit tests only. */
export const daysBetweenForTest = daysBetween;
