import type { DailyBriefingInput, DailyBriefingResult } from '../types';

export function buildMockDailyBriefing(input: DailyBriefingInput): DailyBriefingResult {
  const lines: string[] = [];
  const who = input.name ? `${input.name}, ` : '';

  if (input.topGoal) {
    lines.push(`${who}today moves "${input.topGoal}" forward — ${input.blocksToday} block${input.blocksToday === 1 ? '' : 's'} planned.`);
  } else if (input.blocksToday > 0) {
    lines.push(`${who}you've got ${input.blocksToday} block${input.blocksToday === 1 ? '' : 's'} today. Start with the first one on time.`);
  } else {
    lines.push(`${who}no plan yet today — build one and the rest gets easier.`);
  }

  if (input.overdueContacts > 0) {
    lines.push(`${input.overdueContacts} ${input.overdueContacts === 1 ? 'person is' : 'people are'} overdue a hello — a 2-line message counts.`);
  } else if (input.weeklyInsight) {
    lines.push(input.weeklyInsight);
  }

  if (lines.length < 3 && input.lifeScore > 0) {
    lines.push(`Life score ${input.lifeScore} (${input.lifeScoreBand.toLowerCase()}). One domain at a time.`);
  }

  return { lines: lines.slice(0, 3) };
}
