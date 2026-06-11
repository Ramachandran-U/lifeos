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

describe('selectDailyQuests — day-1 clamp (cold_start_v1, AC-3)', () => {
  const firstDayCtx: QuestSelectionCtx = {
    primaryDomains: [],
    liveStreakKeys: [],
    isFirstDay: true,
  };

  it('isFirstDay → exactly 3 drafts, never 3–5', () => {
    expect(selectDailyQuests(firstDayCtx, 'u1:2026-06-10')).toHaveLength(3);
    // A few extra seeds so the clamp can't hide behind one lucky rng draw.
    for (let d = 1; d <= 10; d++) {
      const qs = selectDailyQuests(firstDayCtx, `u9:2026-08-${String(d).padStart(2, '0')}`);
      expect(qs).toHaveLength(3);
    }
  });

  it('slot 1 is the pinned first-block quest, constructed below the template range', () => {
    const [first] = selectDailyQuests(firstDayCtx, 'u1:2026-06-10');
    expect(first).toEqual({
      templateId: 't_blocks_small',
      target: 1,
      xp: 10,
      title: 'Complete your first routine block',
      metricKey: 'blocks_completed',
      module: 'goal',
      source: 'pinned',
    });
  });

  it('no other draft shares the blocks_completed metric (no double-tick)', () => {
    const qs = selectDailyQuests(firstDayCtx, 'u1:2026-06-10');
    expect(qs.slice(1).some((q) => q.metricKey === 'blocks_completed')).toBe(false);
  });

  it('isFirstDay: false is BYTE-IDENTICAL to the pre-change output (same seed)', () => {
    // Fixture captured 2026-06-12 on trunk 4e9b367 (pre-change questEngine)
    // by running the then-current selectDailyQuests with this exact ctx+seed.
    const PRE_CHANGE_FIXTURE =
      '[{"templateId":"t_blocks_full","title":"Finish every block before dinner","module":"goal","metricKey":"blocks_completed","target":7,"xp":85},' +
      '{"templateId":"t_journal","title":"Close the day with a reflection","module":"goal","metricKey":"journal","target":1,"xp":30},' +
      '{"templateId":"t_resource","title":"Finish a learning resource","module":"polymath","metricKey":"learning_resource","target":1,"xp":60}]';
    const withFalse = selectDailyQuests(
      { primaryDomains: [], liveStreakKeys: [], isFirstDay: false },
      'u1:2026-06-10',
    );
    const withAbsent = selectDailyQuests({ primaryDomains: [], liveStreakKeys: [] }, 'u1:2026-06-10');
    expect(JSON.stringify(withFalse)).toBe(PRE_CHANGE_FIXTURE);
    expect(JSON.stringify(withAbsent)).toBe(PRE_CHANGE_FIXTURE);
  });

  it('day-1 reroll path: an excluded t_blocks_small is not re-pinned', () => {
    const rerolled = selectDailyQuests(
      { ...firstDayCtx, excludeTemplateIds: ['t_blocks_small'] },
      'u1:2026-06-10:reroll:1',
    );
    expect(rerolled).toHaveLength(3);
    expect(rerolled.some((q) => q.templateId === 't_blocks_small')).toBe(false);
    expect(rerolled.some((q) => q.source === 'pinned')).toBe(false);
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
