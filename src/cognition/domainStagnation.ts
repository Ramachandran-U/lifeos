/**
 * Domain-stagnation detector (Phase 2 cognitive engine, increment 1).
 *
 * Surfaces the case where a life domain the user *chose to care about* has
 * stopped growing because nothing in their routine feeds it — so we can offer
 * a small, opt-in nudge at end-of-day. See
 * implementation-plan/phase-2-domain-stagnation-detector.md.
 *
 * PRODUCT PRINCIPLE: protect the domains the user chose; never force a balanced
 * hexagon. A domain is only ever a candidate if it's in `primaryDomains`.
 *
 * This module is the PURE deterministic core: all data access is injected, so
 * it is fully unit-testable with no stores, DB, or LLM. The live wiring
 * (real history store + "fed" predicate + cooldown) is a thin adapter built in
 * a later increment.
 */
import type { DomainId } from '@/store/useUserStore';

/** One point in a domain's rolling score history (mirrors useDomainHistoryStore). */
export interface ScorePoint {
  /** YYYY-MM-DD */
  date: string;
  /** 0-100 */
  score: number;
}

export interface StagnationDeps {
  /** Domains the user declared they care about. Only these are ever flagged. */
  primaryDomains: DomainId[];
  /** Full retained score history for a domain, oldest first. */
  fullHistoryFor: (domain: DomainId) => ScorePoint[];
  /** Was the domain "fed" recently (≥1 routine block or behaviour event)? */
  isDomainFed: (domain: DomainId) => boolean;
  /** Is it OK to surface this domain now (not within its cooldown window)? */
  cooldownOk: (domain: DomainId) => boolean;
}

export interface StagnationCandidate {
  domain: DomainId;
  /** Score change over the detection window (≈0 when stagnant). */
  delta: number;
  /** Length of the trailing flat run, in recorded days. */
  daysFlat: number;
  /** Latest recorded score (used for ranking — lowest is most neglected). */
  currentScore: number;
}

/** Two flat weeks is a real signal; one week is too twitchy. */
export const STAGNATION_WINDOW_DAYS = 14;
/** A window delta within this band (0-100 scale) counts as "not growing". */
export const FLAT_EPSILON = 2;
/** Require at least this much history before flagging (new users stay silent). */
export const MIN_SAMPLE_DAYS = 14;

/**
 * Map a scored domain to the routine/behaviour `module` value. Domains use
 * `goals` (plural); routine blocks + behaviour events use `goal` (singular).
 * Every other key is identical.
 */
export function domainToModule(domain: DomainId): string {
  return domain === 'goals' ? 'goal' : domain;
}

/** Trailing run (from the latest point) of days within FLAT_EPSILON of the latest score. */
function trailingFlatRun(history: ScorePoint[]): number {
  if (history.length === 0) return 0;
  const latest = history[history.length - 1]!.score;
  let run = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (Math.abs(history[i]!.score - latest) <= FLAT_EPSILON) run += 1;
    else break;
  }
  return run;
}

/**
 * Returns the single most-stagnant chosen domain to nudge on, or null if none
 * qualify. At most one per call — one good nudge beats three ignored ones.
 *
 * A domain qualifies when ALL hold:
 *   - it is in primaryDomains (the user chose it),
 *   - it has ≥ MIN_SAMPLE_DAYS of history (not a brand-new user),
 *   - its score moved ≤ FLAT_EPSILON over the window (not growing),
 *   - nothing fed it recently (flat *because* it's unfed, not despite effort),
 *   - it isn't inside its cooldown window.
 *
 * Ranking among qualifiers: lowest current score first (most neglected), then
 * longest flat run.
 */
export function detectStagnantDomain(deps: StagnationDeps): StagnationCandidate | null {
  const candidates: StagnationCandidate[] = [];

  for (const domain of deps.primaryDomains) {
    const history = deps.fullHistoryFor(domain);
    if (history.length < MIN_SAMPLE_DAYS) continue; // not enough signal

    const windowStart = history[Math.max(0, history.length - STAGNATION_WINDOW_DAYS)]!;
    const latest = history[history.length - 1]!;
    const delta = latest.score - windowStart.score;
    if (delta > FLAT_EPSILON) continue; // growing — leave it alone

    if (deps.isDomainFed(domain)) continue; // fed but flat = a different insight
    if (!deps.cooldownOk(domain)) continue; // surfaced recently

    candidates.push({
      domain,
      delta,
      daysFlat: trailingFlatRun(history),
      currentScore: latest.score,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) =>
    a.currentScore !== b.currentScore
      ? a.currentScore - b.currentScore // lowest score = most neglected
      : b.daysFlat - a.daysFlat,         // tie-break: longest flat run
  );
  return candidates[0]!;
}

/** Exposed for unit tests only. */
export const trailingFlatRunForTest = trailingFlatRun;
