import {
  selectDailyQuests,
  clampDraftToTemplate,
  QUEST_TEMPLATES,
  type QuestSelectionCtx,
} from '../questEngine';

const ctx = (over: Partial<QuestSelectionCtx> = {}): QuestSelectionCtx => ({
  primaryDomains: ['health', 'goal'],
  liveStreakKeys: [],
  stagnantDomain: null,
  yesterdayCompletionPct: 0.5,
  ...over,
});

describe('selectDailyQuests — determinism & shape', () => {
  it('same ctx + same seed → identical set (idempotent re-entry)', () => {
    const a = selectDailyQuests(ctx(), 'u1:2026-06-10');
    const b = selectDailyQuests(ctx(), 'u1:2026-06-10');
    expect(a).toEqual(b);
  });

  it('different day → (eventually) different set', () => {
    // Not guaranteed per-day, but across a week at least one set must differ.
    const sets = ['10', '11', '12', '13', '14', '15', '16'].map((d) =>
      JSON.stringify(selectDailyQuests(ctx(), `u1:2026-06-${d}`)),
    );
    expect(new Set(sets).size).toBeGreaterThan(1);
  });

  it('returns 3–5 quests, unique templates and unique metric keys', () => {
    for (let d = 1; d <= 20; d++) {
      const qs = selectDailyQuests(ctx(), `u1:2026-07-${String(d).padStart(2, '0')}`);
      expect(qs.length).toBeGreaterThanOrEqual(3);
      expect(qs.length).toBeLessThanOrEqual(5);
      expect(new Set(qs.map((q) => q.templateId)).size).toBe(qs.length);
      expect(new Set(qs.map((q) => q.metricKey)).size).toBe(qs.length);
    }
  });

  it('targets stay inside the template range at completion extremes', () => {
    for (const pct of [0, 1]) {
      const qs = selectDailyQuests(ctx({ yesterdayCompletionPct: pct }), 'u2:2026-06-10');
      for (const q of qs) {
        const t = QUEST_TEMPLATES.find((x) => x.id === q.templateId)!;
        expect(q.target).toBeGreaterThanOrEqual(t.targetRange[0]);
        expect(q.target).toBeLessThanOrEqual(t.targetRange[1]);
        expect(q.xp).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('excludeTemplateIds is honored (reroll path)', () => {
    const first = selectDailyQuests(ctx(), 'u3:2026-06-10');
    const banned = first[0].templateId;
    const rerolled = selectDailyQuests(
      ctx({ excludeTemplateIds: [banned] }),
      'u3:2026-06-10:reroll:1',
    );
    expect(rerolled.some((q) => q.templateId === banned)).toBe(false);
  });

  it('weighting shifts selection toward the stagnant domain over many seeds', () => {
    let hits = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const qs = selectDailyQuests(ctx({ stagnantDomain: 'social', primaryDomains: [] }), `u4:seed:${i}`);
      if (qs.some((q) => q.module === 'social')) hits++;
    }
    // Only one social template exists (weight 4 vs 1); with ~4 picks/day it
    // should appear in well over half the days. Loose bound to avoid flake.
    expect(hits / N).toBeGreaterThan(0.5);
  });
});

describe('clampDraftToTemplate — AI output safety', () => {
  it('clamps target and xp to template bounds', () => {
    const clamped = clampDraftToTemplate({
      templateId: 't_meals', title: 'Feast like a king', metricKey: 'meals_logged', target: 99, xp: 9999,
    });
    expect(clamped).toMatchObject({ templateId: 't_meals', target: 4 });
    expect(clamped!.xp).toBeLessThanOrEqual(4 * 10);
  });

  it('rejects unknown metric keys (untrackable quests)', () => {
    expect(clampDraftToTemplate({ metricKey: 'steps_walked', target: 1, xp: 10 })).toBeNull();
  });

  it('rejects a templateId whose metric does not match', () => {
    expect(clampDraftToTemplate({ templateId: 't_meals', metricKey: 'journal', target: 1, xp: 10 })).toBeNull();
  });

  it('falls back to the template title when the AI title is empty', () => {
    const clamped = clampDraftToTemplate({ templateId: 't_weight', title: '  ', metricKey: 'weight_logged', target: 1, xp: 15 });
    expect(clamped!.title.length).toBeGreaterThan(0);
  });
});
