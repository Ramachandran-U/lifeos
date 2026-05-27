import {
  buildDomainSuggestions,
  isConcreteSuggestion,
  MAX_SUGGESTIONS,
  type MinableGoal,
  type SuggestionDeps,
} from '../domainSuggestions';
import type { InsightSuggestion } from '../types';

function goal(over: Partial<MinableGoal>): MinableGoal {
  return { id: Math.random().toString(36).slice(2), title: 'Read 20 mins', goalType: 'learning', level: 'daily', status: 'active', ...over };
}

function baseDeps(over: Partial<SuggestionDeps> = {}): SuggestionDeps {
  return { domain: 'polymath', goals: [], isGoalScheduled: () => false, ...over };
}

describe('isConcreteSuggestion', () => {
  it('rejects empty titles or non-positive durations', () => {
    expect(isConcreteSuggestion({ title: '', durationMin: 20, module: 'polymath', source: 'ai' })).toBe(false);
    expect(isConcreteSuggestion({ title: 'Read', durationMin: 0, module: 'polymath', source: 'ai' })).toBe(false);
    expect(isConcreteSuggestion({ title: 'Read', durationMin: 15, module: 'polymath', source: 'ai' })).toBe(true);
  });
});

describe('buildDomainSuggestions — goal mining', () => {
  it('surfaces the user\'s own unscheduled, active, weekly/daily goals in the domain', async () => {
    const goals = [
      goal({ id: 'g1', title: 'Read a chapter', goalType: 'learning', level: 'daily' }),
      goal({ id: 'g2', title: 'Sketch practice', goalType: 'learning', level: 'weekly' }),
    ];
    const res = await buildDomainSuggestions(baseDeps({ goals }));
    expect(res).toHaveLength(2);
    expect(res.every((s) => s.source === 'goal')).toBe(true);
    expect(res.map((s) => s.goalId)).toEqual(['g1', 'g2']);
    expect(res.every((s) => s.module === 'polymath')).toBe(true);
  });

  it('excludes scheduled, completed, wrong-domain, and non-actionable goals', async () => {
    const goals = [
      goal({ id: 'sched', title: 'Scheduled one' }),
      goal({ id: 'done', title: 'Done one', status: 'completed' }),
      goal({ id: 'wrong', title: 'Career thing', goalType: 'career' }),
      goal({ id: 'life', title: 'Life goal', level: 'life' }),
      goal({ id: 'ok', title: 'Good one', goalType: 'learning', level: 'weekly' }),
    ];
    const res = await buildDomainSuggestions(
      baseDeps({ goals, isGoalScheduled: (g) => g.id === 'sched' }),
    );
    expect(res.map((s) => s.goalId)).toEqual(['ok']);
  });

  it('maps domain to module for the goals domain (goals -> goal)', async () => {
    const goals = [goal({ id: 'p', title: 'Personal goal', goalType: 'personal', level: 'daily' })];
    const res = await buildDomainSuggestions(baseDeps({ domain: 'goals', goals }));
    expect(res[0]?.module).toBe('goal');
  });

  it('does NOT call AI when 2+ goals are mined', async () => {
    const aiSuggest = jest.fn(async () => [] as InsightSuggestion[]);
    const goals = [goal({ id: 'a' }), goal({ id: 'b' })];
    await buildDomainSuggestions(baseDeps({ goals, aiSuggest }));
    expect(aiSuggest).not.toHaveBeenCalled();
  });
});

describe('buildDomainSuggestions — AI fallback', () => {
  it('tops up with AI when fewer than two goals are mined', async () => {
    const aiSuggest = async (): Promise<InsightSuggestion[]> => [
      { title: 'Listen to a podcast', durationMin: 25, module: 'polymath', source: 'ai' },
      { title: '', durationMin: 20, module: 'polymath', source: 'ai' }, // vague → filtered
    ];
    const goals = [goal({ id: 'g1', title: 'Read a chapter' })];
    const res = await buildDomainSuggestions(baseDeps({ goals, aiSuggest }));
    expect(res).toHaveLength(2);
    expect(res[0]?.source).toBe('goal');
    expect(res[1]).toMatchObject({ title: 'Listen to a podcast', source: 'ai' });
  });

  it('de-duplicates AI suggestions against mined titles', async () => {
    const aiSuggest = async (): Promise<InsightSuggestion[]> => [
      { title: 'Read a chapter', durationMin: 25, module: 'polymath', source: 'ai' }, // dup of mined
      { title: 'New idea', durationMin: 15, module: 'polymath', source: 'ai' },
    ];
    const goals = [goal({ id: 'g1', title: 'Read a chapter' })];
    const res = await buildDomainSuggestions(baseDeps({ goals, aiSuggest }));
    expect(res.map((s) => s.title)).toEqual(['Read a chapter', 'New idea']);
  });

  it('survives an AI failure (returns mined only)', async () => {
    const aiSuggest = async (): Promise<InsightSuggestion[]> => { throw new Error('AI down'); };
    const goals = [goal({ id: 'g1', title: 'Read a chapter' })];
    const res = await buildDomainSuggestions(baseDeps({ goals, aiSuggest }));
    expect(res).toEqual([expect.objectContaining({ goalId: 'g1', source: 'goal' })]);
  });

  it('caps at MAX_SUGGESTIONS', async () => {
    const aiSuggest = async (): Promise<InsightSuggestion[]> =>
      Array.from({ length: 5 }, (_, i) => ({ title: `AI ${i}`, durationMin: 20, module: 'polymath', source: 'ai' as const }));
    const res = await buildDomainSuggestions(baseDeps({ aiSuggest }));
    expect(res.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
  });

  it('returns empty when nothing mined and no AI provided', async () => {
    expect(await buildDomainSuggestions(baseDeps())).toEqual([]);
  });
});
