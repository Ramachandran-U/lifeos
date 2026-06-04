import type {
  ArchitectLetter,
  ArchitectLetterInput,
  ArchitectLetterDomainSignal,
  PrimaryDomain,
} from '../types';

const DOMAIN_LABEL: Record<PrimaryDomain, string> = {
  goals: 'Goals',
  health: 'Health',
  finance: 'Finance',
  career: 'Career',
  social: 'Social',
  polymath: 'Learning',
};

const hours = (mins: number) => Math.round((mins / 60) * 10) / 10;

/**
 * Deterministic mock of the Architect's Letter. Mirrors the real prompt's shape:
 * finds the brightest-rising domain and the quietest stated-priority domain,
 * names the tension between them, and aims the one brave move at the quiet one.
 * Pure + deterministic (no Date/random) so it's eval- and snapshot-safe.
 */
export function buildMockArchitectLetter(input: ArchitectLetterInput): ArchitectLetter {
  const who = input.name ?? 'friend';
  const greeting = input.name ? `Dear ${input.name},` : 'Hello there,';
  const completionPct = Math.round(input.routine.completionRate * 100);

  const withDelta = input.domains.map((d) => ({
    ...d,
    delta: d.minutesThisWindow - d.minutesPrevWindow,
  }));

  // Brightest spot: biggest positive swing in minutes.
  const rising = [...withDelta].sort((a, b) => b.delta - a.delta)[0] as
    | (ArchitectLetterDomainSignal & { delta: number })
    | undefined;

  // Quiet priority: a stated-priority domain with the least time, else the
  // overall quietest domain. Stagnation-flagged domains are preferred.
  const stagnantFirst = [...withDelta].sort((a, b) => {
    const aStag = input.stagnantDomains.includes(a.domain) ? 0 : 1;
    const bStag = input.stagnantDomains.includes(b.domain) ? 0 : 1;
    if (aStag !== bStag) return aStag - bStag;
    return a.minutesThisWindow - b.minutesThisWindow;
  });
  const priorities = stagnantFirst.filter((d) => d.isStatedPriority);
  const quiet = (priorities[0] ?? stagnantFirst[0]) as
    | (ArchitectLetterDomainSignal & { delta: number })
    | undefined;

  const brokenStreak = input.streaks.find((s) => s.brokeThisWindow);

  // Honesty about signal strength.
  const signal =
    (input.domains.length >= 3 ? 1 : 0) +
    (input.recentReflectionSnippets.length > 0 ? 1 : 0) +
    (input.windowDays >= 7 ? 1 : 0);
  const confidence: ArchitectLetter['confidence'] =
    signal >= 3 ? 'high' : signal === 2 ? 'medium' : 'low';

  // Tension domains: the quiet priority and the rising domain, deduped, 1-3.
  const tension: PrimaryDomain[] = [];
  if (quiet) tension.push(quiet.domain);
  if (rising && rising.domain !== quiet?.domain) tension.push(rising.domain);
  if (tension.length === 0) tension.push('goals');

  const scoreLine =
    input.lifeScore.delta > 0
      ? `Your life score climbed ${input.lifeScore.delta} points to ${input.lifeScore.current}.`
      : input.lifeScore.delta < 0
        ? `Your life score slipped ${Math.abs(input.lifeScore.delta)} points to ${input.lifeScore.current}.`
        : `Your life score held at ${input.lifeScore.current}.`;

  // When only one domain has signal, "rising" and "quiet" collapse to the same
  // domain — there's no real cross-domain tension to name. Detect that so we
  // don't praise and scold the same domain in one breath.
  const sameDomain = !!(rising && quiet && rising.domain === quiet.domain);

  const body: string[] = [
    `${who}, here's what this ${input.period} looked like from where I sit. ${scoreLine} You completed ${input.routine.blocksCompleted} of ${input.routine.blocksPlanned} planned blocks — ${completionPct}%.`,
  ];

  if (rising && rising.delta > 0 && !sameDomain) {
    body.push(
      `${DOMAIN_LABEL[rising.domain]} is the bright spot: ${hours(rising.minutesThisWindow)}h this ${input.period}, up from ${hours(rising.minutesPrevWindow)}h. That's real, and it's yours.`,
    );
  }

  if (quiet && !sameDomain) {
    const brokeNote =
      brokenStreak ? ` Your ${brokenStreak.key} streak broke this ${input.period}.` : '';
    body.push(
      `But ${DOMAIN_LABEL[quiet.domain]} — something you said matters — got just ${hours(quiet.minutesThisWindow)}h.${brokeNote} I'm not scolding; I'm noticing, because you asked me to.`,
    );
  }

  if (sameDomain && quiet) {
    body.push(
      `${DOMAIN_LABEL[quiet.domain]} got ${hours(quiet.minutesThisWindow)}h this ${input.period} — a start, but one domain over ${input.windowDays} days isn't enough for me to read a real pattern yet.`,
    );
  }

  if (input.overcommitted) {
    body.push(
      `You also planned more than the ${input.period} could hold. The fix isn't more discipline — it's fewer, truer commitments.`,
    );
  }

  // Guarantee 2-5 paragraphs.
  if (body.length < 2) {
    body.push(
      `There isn't much signal here yet — give me a little more of your week and I'll have something sharper to say.`,
    );
  }
  const trimmedBody = body.slice(0, 5);

  const risingLabel = rising ? DOMAIN_LABEL[rising.domain] : 'one part of your life';
  const quietLabel = quiet ? DOMAIN_LABEL[quiet.domain] : 'another';
  const crossDomainInsight =
    rising && quiet && rising.domain !== quiet.domain
      ? `The attention powering ${risingLabel} this ${input.period} is the same attention ${quietLabel} stopped getting — they draw from one well, and right now ${risingLabel} is winning.`
      : `The shape of your ${input.period} is still settling; no single tension stands out yet across your domains.`;

  return {
    greeting,
    body: trimmedBody,
    crossDomainInsight,
    domainsInTension: tension.slice(0, 3),
    oneBraveMove: {
      action: quiet && rising && !sameDomain
        ? `Protect one ${quietLabel.toLowerCase()} block this week the way you already protect ${risingLabel.toLowerCase()}.`
        : quiet
          ? `Give ${quietLabel} a single protected block this week and guard it like it counts.`
          : `Pick one domain that matters and give it a single protected block this week.`,
      domain: quiet ? quiet.domain : 'goals',
      why: quiet && rising && !sameDomain
        ? `You've proven you can protect time — point that same muscle at ${quietLabel}.`
        : `One protected block is enough to learn where your attention actually wants to go.`,
    },
    closing: `The building is going up. Let's make sure it's a place you'd want to live in.`,
    signature: '— Your Life Architect',
    confidence,
  };
}
