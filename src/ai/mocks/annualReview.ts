import type { AnnualReview, AnnualReviewInput } from '../types';

const DOMAIN_LABEL: Record<string, string> = {
  goals: 'Goals',
  health: 'Health',
  finance: 'Finance',
  career: 'Career',
  social: 'Social',
  polymath: 'Learning',
};

export function buildMockAnnualReview(input: AnnualReviewInput): AnnualReview {
  const who = input.name ?? 'You';
  const completionPct = Math.round(input.routine.completionRate * 100);
  const scoreDelta = input.lifeScore.current - input.lifeScore.start;

  // Per-domain narrative for domains with any time invested.
  const ranked = Object.entries(input.domainMinutes)
    .filter(([, mins]) => mins > 0)
    .sort(([, a], [, b]) => b - a);

  const domains = (ranked.length ? ranked : [['goals', 0] as [string, number]]).map(
    ([domain, mins]) => ({
      domain: DOMAIN_LABEL[domain] ?? domain,
      summary: `${Math.round(mins / 60)}h invested across the year.`,
    }),
  );

  const topDomain = ranked[0] ? DOMAIN_LABEL[ranked[0][0]] ?? ranked[0][0] : 'your goals';
  const topStreak = input.topStreaks[0];

  return {
    headline:
      scoreDelta > 0
        ? `${who} grew this year — life score up ${scoreDelta} points and ${input.goals.completed} goals completed.`
        : `${who} held steady this year — ${input.goals.completed} goals completed and ${completionPct}% of planned blocks done.`,
    domains: domains.slice(0, 6),
    biggestWin: topStreak
      ? `Your longest streak reached ${topStreak.count} days — consistency was the story of the year.`
      : `You completed ${input.goals.completed} of ${input.goals.total} goals.`,
    growthArea:
      completionPct < 60
        ? `Follow-through dipped — only ${completionPct}% of planned blocks were completed.`
        : `${topDomain} got most of your time; the quieter domains could use more next year.`,
    themeForNextYear: scoreDelta >= 0 ? 'Build on the momentum.' : 'Recommit to the basics.',
  };
}
