import type { MonthlyInsightReport, MonthlyInsightReportInput } from '../types';

const HOUR_LABEL: Record<number, string> = {};
for (let h = 0; h < 24; h++) {
  const p = h < 12 ? 'AM' : 'PM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  HOUR_LABEL[h] = `${hh} ${p}`;
}

export function buildMockMonthlyInsightReport(input: MonthlyInsightReportInput): MonthlyInsightReport {
  const { totals, domainMinutes, inferredPreferences, topEvents } = input;
  const pct = Math.round(totals.completionRate * 100);

  const sortedDomains = Object.entries(domainMinutes ?? {})
    .map(([k, v]) => ({ k, v: v ?? 0 }))
    .filter((d) => d.v > 0)
    .sort((a, b) => b.v - a.v);
  const top = sortedDomains[0];
  const totalDomainMinutes = sortedDomains.reduce((s, d) => s + d.v, 0) || 1;

  const wins: string[] = [];
  wins.push(`Completed ${totals.blocksCompleted} blocks (${pct}% completion rate) across the last ${input.windowDays} days.`);
  if (top) {
    const share = Math.round((top.v / totalDomainMinutes) * 100);
    wins.push(`Strongest domain: ${top.k} — ${Math.round(top.v / 60)}h, ${share}% of tracked time.`);
  }
  if (topEvents[0]) {
    wins.push(`Top recurring action: ${topEvents[0].type.replace(/_/g, ' ')} (${topEvents[0].count}×).`);
  }

  const patterns: string[] = [];
  if (inferredPreferences.productiveHours.length > 0) {
    const hrs = inferredPreferences.productiveHours.map((h) => HOUR_LABEL[h]).join(', ');
    patterns.push(`Peak completion clusters around ${hrs}.`);
  }
  if (inferredPreferences.preferredBlockMinutes) {
    patterns.push(`Your typical completed block lasts ~${inferredPreferences.preferredBlockMinutes} min — longer ones tend to slip.`);
  }
  if (top) patterns.push(`Time keeps gravitating to ${top.k}; the other domains average under it.`);
  if (patterns.length === 0) patterns.push('Not enough data yet to call out a clear pattern — keep logging.');

  const slipping: string[] = [];
  if (inferredPreferences.droppedHabits.length > 0) {
    slipping.push(`Dropped: ${inferredPreferences.droppedHabits.slice(0, 2).join(', ')}.`);
  }
  const silentDomains = ['goals', 'health', 'finance', 'career', 'social', 'polymath']
    .filter((d) => (domainMinutes?.[d as keyof typeof domainMinutes] ?? 0) === 0);
  if (silentDomains.length > 0) {
    slipping.push(`Zero time logged for: ${silentDomains.join(', ')}.`);
  }
  if (inferredPreferences.preferredRestDays.length > 0) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const restNames = inferredPreferences.preferredRestDays.map((d) => names[d]).join(', ');
    slipping.push(`Lowest completion days: ${restNames}.`);
  }

  const oneAdjustment = inferredPreferences.droppedHabits[0]
    ? `Shrink "${inferredPreferences.droppedHabits[0]}" by half — or drop it. The current size isn't sticking.`
    : top
      ? `Carve one weekly slot for the silent domains instead of doubling down on ${top.k}.`
      : 'Pick one specific block this week and protect it — small wins build the signal we need to learn from.';

  return { wins, patterns, slipping, oneAdjustment };
}
