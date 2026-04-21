import type { DailyFitPoint } from '@/integrations/googleFit/client';

function avg(nums: number[]): number {
  const valid = nums.filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((s, n) => s + n, 0) / valid.length;
}

/**
 * Week-over-week percentage change. Returns null when either week has no data,
 * so callers can distinguish "no change" from "don't know yet".
 */
export function weekOverWeekPct(
  days: DailyFitPoint[],
  pick: (d: DailyFitPoint) => number,
): number | null {
  if (days.length < 8) return null;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const thisWeek = sorted.slice(-7).map(pick);
  const lastWeek = sorted.slice(-14, -7).map(pick);
  const cur = avg(thisWeek);
  const prev = avg(lastWeek);
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export interface FitInsight {
  id: string;
  headline: string;
  detail: string;
  tone: 'good' | 'warn' | 'neutral';
}

/**
 * Rule-based correlations — no AI call. Only emits an insight when the signal
 * is strong enough to be worth showing (absolute effect size thresholds).
 */
export function computeFitInsights(days: DailyFitPoint[]): FitInsight[] {
  const out: FitInsight[] = [];
  if (days.length < 7) return out;

  const sleepDays = days.filter((d) => d.sleep.total > 0);

  // Sleep vs activity correlation
  if (sleepDays.length >= 5) {
    const highStep = sleepDays.filter((d) => d.steps >= 8000);
    const lowStep = sleepDays.filter((d) => d.steps < 5000);
    if (highStep.length >= 2 && lowStep.length >= 2) {
      const sleepHigh = avg(highStep.map((d) => d.sleep.total));
      const sleepLow = avg(lowStep.map((d) => d.sleep.total));
      const deltaMin = Math.round(sleepHigh - sleepLow);
      if (Math.abs(deltaMin) >= 20) {
        out.push({
          id: 'steps-sleep',
          tone: deltaMin > 0 ? 'good' : 'warn',
          headline: deltaMin > 0
            ? `You sleep ${deltaMin}min more on active days`
            : `You sleep ${Math.abs(deltaMin)}min less on active days`,
          detail: `Across the last ${sleepDays.length} days, high-step days (≥8K) vs low (<5K).`,
        });
      }
    }
  }

  // Resting HR trend
  const hrDays = days.filter((d) => d.avgHeartRate !== null);
  if (hrDays.length >= 10) {
    const hrTrend = weekOverWeekPct(hrDays as DailyFitPoint[], (d) => d.avgHeartRate ?? 0);
    if (hrTrend !== null && Math.abs(hrTrend) >= 3) {
      out.push({
        id: 'hr-trend',
        tone: hrTrend < 0 ? 'good' : 'warn',
        headline: hrTrend < 0
          ? `Resting HR down ${Math.abs(Math.round(hrTrend))}% this week`
          : `Resting HR up ${Math.round(hrTrend)}% this week`,
        detail: hrTrend < 0 ? 'Cardiovascular fitness trending up.' : 'Could be stress, illness, or poor sleep.',
      });
    }
  }

  // Deep-sleep quality
  if (sleepDays.length >= 5) {
    const avgDeepPct = avg(sleepDays.map((d) => d.sleep.deep / Math.max(1, d.sleep.total) * 100));
    if (avgDeepPct > 0) {
      if (avgDeepPct < 13) {
        out.push({
          id: 'deep-sleep-low',
          tone: 'warn',
          headline: `Deep sleep averaging ${Math.round(avgDeepPct)}%`,
          detail: 'Adults typically target 13–23%. Try earlier bedtime or reducing alcohol.',
        });
      } else if (avgDeepPct >= 20) {
        out.push({
          id: 'deep-sleep-good',
          tone: 'good',
          headline: `Deep sleep at ${Math.round(avgDeepPct)}% — strong recovery`,
          detail: 'Hitting the top of the healthy range.',
        });
      }
    }
  }

  // Step goal adherence
  const hit = days.filter((d) => d.steps >= 8000).length;
  const pct = Math.round((hit / days.length) * 100);
  if (days.length >= 7) {
    if (pct >= 70) {
      out.push({
        id: 'step-streak',
        tone: 'good',
        headline: `Hit 8K steps on ${pct}% of days`,
        detail: `${hit} of ${days.length} days. Keep the cadence.`,
      });
    } else if (pct < 30) {
      out.push({
        id: 'step-low',
        tone: 'warn',
        headline: `Only ${pct}% of days above 8K steps`,
        detail: 'Stack a 15-min walk after lunch to close the gap.',
      });
    }
  }

  return out;
}
