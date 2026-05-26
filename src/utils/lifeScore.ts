/**
 * Cross-module Life Score — P4-01.
 *
 * One composite number across the six domains, weighted so the user's
 * explicitly-chosen primary domains carry a bit more pull. The arithmetic
 * is intentionally simple — clarity beats cleverness for a hero stat.
 *
 *   weight(d) = 1.5 if d ∈ primaryDomains else 1.0
 *   life      = Σ(score_d × weight_d) / Σ(weight_d)
 *
 * Domain scores are clamped to 0..100 by the gamification layer, so the
 * composite stays in 0..100 too.
 *
 * 30/90-day deltas come from `useDomainHistoryStore` — we reconstruct a
 * historical composite from each retained day's per-domain snapshot and
 * subtract.
 */

import type { DomainScores } from '@/utils/gamification';
import type { ScorePoint } from '@/store/useDomainHistoryStore';

const PRIMARY_WEIGHT = 1.5;
const SECONDARY_WEIGHT = 1.0;

type DomainKey = keyof DomainScores;
const DOMAIN_KEYS: DomainKey[] = ['goals', 'health', 'finance', 'career', 'social', 'mind'];

const DOMAIN_TO_PRIMARY_KEY: Record<DomainKey, string> = {
  goals: 'goals', health: 'health', finance: 'finance',
  career: 'career', social: 'social', mind: 'polymath',
};

function isPrimary(domain: DomainKey, primaryDomains: string[]): boolean {
  return primaryDomains.includes(DOMAIN_TO_PRIMARY_KEY[domain]);
}

export function computeLifeScore(
  scores: DomainScores,
  primaryDomains: string[] = [],
): number {
  let sum = 0;
  let weight = 0;
  for (const d of DOMAIN_KEYS) {
    const w = isPrimary(d, primaryDomains) ? PRIMARY_WEIGHT : SECONDARY_WEIGHT;
    sum += (scores[d] ?? 0) * w;
    weight += w;
  }
  if (weight === 0) return 0;
  return Math.round(sum / weight);
}

export interface LifeScoreTrend {
  current: number;
  delta30: number;     // change vs ~30 days ago (positive = improving)
  delta90: number;     // change vs ~90 days ago
  history: number[];   // composite scores oldest → newest, up to 90 entries
}

/**
 * Build a per-day composite score series from the per-domain history store.
 * Each retained snapshot day produces one composite point. Days where a
 * domain has no entry use the most recent known value for that domain.
 */
export function computeLifeScoreTrend(
  current: DomainScores,
  perDomainHistory: Partial<Record<DomainKey, ScorePoint[]>>,
  primaryDomains: string[] = [],
): LifeScoreTrend {
  // Pre-index each domain's series as date → score so the per-day walk is O(1)
  // per lookup instead of a linear find. (Was O(domains × days²).)
  const allDates = new Set<string>();
  const byDate: Record<DomainKey, Map<string, number>> = {
    goals: new Map(), health: new Map(), finance: new Map(),
    career: new Map(), social: new Map(), mind: new Map(),
  };
  for (const d of DOMAIN_KEYS) {
    for (const p of perDomainHistory[d] ?? []) {
      allDates.add(p.date);
      byDate[d].set(p.date, p.score);
    }
  }
  const sortedDates = Array.from(allDates).sort();
  const carry: Record<DomainKey, number> = {
    goals: current.goals, health: current.health, finance: current.finance,
    career: current.career, social: current.social, mind: current.mind,
  };
  // Initialise carry with the EARLIEST known value per domain — gives 0/0
  // domains a sensible starting line rather than today's value (which would
  // wash out any improvement).
  for (const d of DOMAIN_KEYS) {
    const first = (perDomainHistory[d] ?? [])[0];
    if (first) carry[d] = first.score;
  }

  const history: number[] = [];
  for (const date of sortedDates) {
    for (const d of DOMAIN_KEYS) {
      const score = byDate[d].get(date);
      if (score !== undefined) carry[d] = score;
    }
    history.push(computeLifeScore({ ...carry }, primaryDomains));
  }
  // Always include today as the final point so a brand-new user sees one
  // value rather than an empty array.
  if (sortedDates.length === 0 || sortedDates[sortedDates.length - 1] !== todayUtc()) {
    history.push(computeLifeScore(current, primaryDomains));
  }

  const composite = history[history.length - 1] ?? 0;
  const at = (lookbackDays: number): number => {
    if (history.length === 0) return composite;
    const idx = Math.max(0, history.length - 1 - lookbackDays);
    return history[idx]!;
  };

  return {
    current: composite,
    delta30: composite - at(30),
    delta90: composite - at(90),
    history,
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface LifeScoreBand {
  label: string;
  description: string;
}

/**
 * Translate a Life Score number into a one-line user-facing band. Honest
 * about what the number means — no false praise for 30s, no doom for 50s.
 */
export function lifeScoreBand(score: number): LifeScoreBand {
  if (score >= 80) return { label: 'Thriving',  description: 'Every domain is moving. Keep the shape — small tweaks only.' };
  if (score >= 65) return { label: 'Solid',     description: 'You\'re on the curve. One domain at a time is the lift.' };
  if (score >= 50) return { label: 'Building',  description: 'Signal is forming. Pick one domain to push for two weeks.' };
  if (score >= 35) return { label: 'Stalling',  description: 'A couple of domains are quiet. The routine needs trimming.' };
  return { label: 'Resetting',                  description: 'Early days. Log enough to give the system something to learn from.' };
}