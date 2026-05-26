import { buildMockDailyBriefing } from '../briefing';
import type { DailyBriefingInput } from '../../types';

const base: DailyBriefingInput = {
  name: 'Sam',
  topGoal: null,
  blocksToday: 0,
  overdueContacts: 0,
  lifeScore: 0,
  lifeScoreBand: 'Building',
  weeklyInsight: null,
  topDomainYesterday: null,
};

describe('buildMockDailyBriefing', () => {
  it('always returns 1-3 lines', () => {
    const out = buildMockDailyBriefing(base);
    expect(out.lines.length).toBeGreaterThanOrEqual(1);
    expect(out.lines.length).toBeLessThanOrEqual(3);
  });

  it('leads with the top goal when present', () => {
    const out = buildMockDailyBriefing({ ...base, topGoal: 'Run a marathon', blocksToday: 3 });
    expect(out.lines[0]).toContain('Run a marathon');
    expect(out.lines[0]).toContain('3 blocks');
  });

  it('adds a social nudge when contacts are overdue', () => {
    const out = buildMockDailyBriefing({ ...base, blocksToday: 1, overdueContacts: 2 });
    expect(out.lines.some((l) => l.includes('2 people'))).toBe(true);
  });

  it('uses the weekly insight when nothing is overdue', () => {
    const out = buildMockDailyBriefing({ ...base, blocksToday: 1, weeklyInsight: 'You workout most on Mondays.' });
    expect(out.lines).toContain('You workout most on Mondays.');
  });

  it('caps output at 3 lines even with all signals', () => {
    const out = buildMockDailyBriefing({
      ...base,
      topGoal: 'Ship LifeOS',
      blocksToday: 4,
      overdueContacts: 1,
      lifeScore: 62,
      weeklyInsight: 'Strong week.',
    });
    expect(out.lines.length).toBe(3);
  });
});
